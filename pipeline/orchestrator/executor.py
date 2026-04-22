"""Subagent executor.

Runs a single claimed task in a dedicated tmux session with a deterministic
wrapper script. Enforces:

  - structured exit contract (inserts contract fragment into prompt bundle)
  - idle/hard timeouts (with SIGTERM then SIGKILL)
  - git head recording pre/post (for scope validation)
  - validator stack run post-exit
  - retry with failover via router.choose_route() when recoverable

On success: state → completed, merge-controller releases any held locks.
On unrecoverable failure: state → failed, record_event with full detail.
"""
from __future__ import annotations

import json
import os
import shlex
import signal
import subprocess
import textwrap
import threading
import time
from dataclasses import dataclass
from pathlib import Path

import yaml

from . import (
    briefing, db, router, slot_ledger, validator, worktree,
)
from .contracts import render_prompt_contract

REPO_ROOT = Path(__file__).resolve().parents[2]
AUDIT_MAP = REPO_ROOT / "audit-map"
AUDIT_SCRIPTS = AUDIT_MAP / "16-scripts"
STATE_ROOT = Path.home() / ".local" / "state" / "airmentor" / "pipeline"
STATE_ROOT.mkdir(parents=True, exist_ok=True)

# Per-slot CODEX_HOME root. Each arctic codex-0X slot gets a directory here
# populated with a codex-CLI-shaped auth.json derived from arctic's tokens
# (see pipeline/scripts/build_overnight/provision-codex-homes.py). Distinct
# ChatGPT Team user seats give distinct per-seat quotas, enabling rotation.
CODEX_HOMES_ROOT = Path.home() / ".codex-slots"


def _codex_home_for_slot(slot: str) -> Path | None:
    """Resolve a provisioned CODEX_HOME for an arctic codex slot, or None.

    None means: slot not provisioned; codex_runner falls back to $HOME/.codex.
    """
    if not slot or not slot.startswith("codex-"):
        return None
    candidate = CODEX_HOMES_ROOT / slot
    if (candidate / "auth.json").is_file():
        return candidate
    return None


LOG_ROOT = STATE_ROOT / "logs"
LOG_ROOT.mkdir(parents=True, exist_ok=True)
BUNDLE_ROOT = STATE_ROOT / "prompt-bundles"
BUNDLE_ROOT.mkdir(parents=True, exist_ok=True)
RESULT_ROOT = STATE_ROOT / "results"
RESULT_ROOT.mkdir(parents=True, exist_ok=True)
WRAPPER_ROOT = STATE_ROOT / "wrappers"
WRAPPER_ROOT.mkdir(parents=True, exist_ok=True)

SESSION_PREFIX = "airmentor-pipe"


def _git_head() -> str | None:
    try:
        return (
            subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(REPO_ROOT),
                                    stderr=subprocess.DEVNULL)
            .decode().strip()
        )
    except Exception:
        return None


def _session_name(task_row) -> str:
    safe = f"{task_row['pass_name']}-{task_row['id']}".lower()
    safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in safe)
    return f"{SESSION_PREFIX}-{safe}"[:200]


def _read_manifest(manifest_file: str | None) -> list[dict]:
    if not manifest_file:
        return []
    p = manifest_file if Path(manifest_file).is_absolute() else REPO_ROOT / manifest_file
    p = Path(p)
    if not p.is_file():
        return []
    try:
        data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    except Exception:
        return []
    items = data.get("artifacts") or []
    out: list[dict] = []
    for it in items:
        if isinstance(it, str):
            out.append({"path": it})
        elif isinstance(it, dict):
            out.append(it)
    return out


def _compose_prompt(task_row, route: router.Route, *, briefing_path: Path | None = None) -> str:
    pass_name = task_row["pass_name"]
    prompt_file = task_row["prompt_file"]
    prompt_path = Path(prompt_file) if Path(prompt_file).is_absolute() else REPO_ROOT / prompt_file
    if not prompt_path.is_file():
        raise FileNotFoundError(f"prompt file missing: {prompt_path}")
    base_prompt = prompt_path.read_text(encoding="utf-8")

    intent_txt = ""
    if task_row["intent_file"]:
        ip = Path(task_row["intent_file"])
        if not ip.is_absolute():
            ip = REPO_ROOT / ip
        if ip.is_file():
            intent_txt = f"\n\n## INTENT (do not violate)\n\n```yaml\n{ip.read_text(encoding='utf-8')}\n```\n"

    manifest_txt = ""
    manifest_items = _read_manifest(task_row["manifest_file"])
    if manifest_items:
        manifest_txt = "\n\n## REQUIRED ARTIFACTS (must exist and be substantive)\n\n"
        for it in manifest_items:
            manifest_txt += f"- `{it['path']}` (min_lines={it.get('min_lines', 10)}, min_bytes={it.get('min_bytes', 200)})\n"
            for sec in it.get("required_sections", []) or []:
                manifest_txt += f"  - required section: `{sec}`\n"

    scope_txt = f"\n\n## WRITE SCOPE\n\nYou may only modify files matching: `{task_row['write_scope_glob']}`\n"

    contract_txt = render_prompt_contract(pass_name)

    route_banner = (
        f"## Route\n"
        f"- provider: `{route.provider}`\n"
        f"- slot: `{route.slot}`\n"
        f"- model: `{route.model}`\n"
        f"- reasoning_effort: `{route.reasoning_effort}`\n"
    )

    briefing_txt = ""
    if briefing_path and Path(briefing_path).is_file():
        body = Path(briefing_path).read_text(encoding="utf-8", errors="replace")
        briefing_txt = (
            "\n\n## CONTEXT PACK (ancestor briefings, read-first)\n\n"
            + body + "\n"
        )

    return (
        f"# Pipeline Pass: {pass_name}\n\n"
        f"{route_banner}\n\n"
        f"{intent_txt}{manifest_txt}{scope_txt}{briefing_txt}{contract_txt}\n\n"
        f"---\n\n{base_prompt}\n"
    )


def _write_bundle(task_row, prompt_text: str) -> Path:
    p = BUNDLE_ROOT / f"{_session_name(task_row)}.prompt.md"
    p.write_text(prompt_text, encoding="utf-8")
    return p


def _result_file_for(task_row) -> Path:
    return RESULT_ROOT / f"{_session_name(task_row)}.result.txt"


def _result_file_for_id(task_id: int) -> Path | None:
    row = db.get_task(task_id)
    if not row:
        return None
    return _result_file_for(row)


def _log_file_for(task_row) -> Path:
    return LOG_ROOT / f"{_session_name(task_row)}.log"


def _wrapper_for(task_row) -> Path:
    return WRAPPER_ROOT / f"{_session_name(task_row)}.sh"


# ---------- provider wrappers ----------

def _build_exec_command(
    *,
    task_id: int,
    route: router.Route,
    cwd: Path,
    bundle_path: Path,
    result_path: Path,
    resume_session_id: str | None = None,
) -> list[str]:
    """Inner command run inside the tmux wrapper for the chosen provider.

    Dispatch order:
      - local-dry       → pipeline/scripts/dry-run-agent.py
      - anthropic       → native_runner (claude CLI, session-id pinned)
      - codex, native-codex, openrouter, oss-local, opencode
                        → native_runner (codex/opencode CLIs, JSON)
      - windsurf        → windsurf --stdin (best-effort)
      - github-copilot  → gh copilot suggest
      - ccs             → ccs run (legacy; installed on demand)
      - anything else (antigravity, google, codex via arctic, etc.)
                        → audit-map/16-scripts/arctic-session-wrapper.sh
                          which already handles per-slot XDG isolation
    """
    if route.provider == "local-dry":
        dry_stub = REPO_ROOT / "pipeline" / "scripts" / "dry-run-agent.py"
        return [
            "python3", str(dry_stub),
            "--bundle", str(bundle_path),
            "--result", str(result_path),
        ]

    # Native runners (stdin + stream-json + session pinning).
    # NOTE 2026-04-22 (revised): `codex` is now ALSO dispatched via native
    # codex CLI. Arctic's codex path tunnels through chatgpt.com web session
    # and rejects `gpt-5.4` with HTTP 400 (zero tokens). Native `codex exec`
    # hits the direct API endpoint and accepts gpt-5.4 + model_reasoning_effort=xhigh.
    # Per-slot isolation: one CODEX_HOME dir per arctic codex-0X slot populated
    # from arctic's auth.json (see _codex_home_for_slot). Each dir contains a
    # codex-CLI-shaped auth.json pointing at a different ChatGPT Team user seat,
    # so all 6 slots rotate through distinct per-seat quotas.
    if route.provider in {"anthropic", "codex", "native-codex",
                          "openrouter", "oss-local", "opencode"}:
        native_argv = [
            "python3", "-m", "pipeline.orchestrator.native_runner",
            "--task-id", str(task_id),
            "--provider", route.provider,
            "--slot", route.slot,
            "--model", route.model,
            "--cwd", str(cwd),
            "--bundle", str(bundle_path),
            "--result", str(result_path),
            "--reasoning-effort", route.reasoning_effort,
        ]
        if route.account:
            native_argv += ["--account", route.account]
        if resume_session_id:
            native_argv += ["--resume", resume_session_id]
        # Codex per-slot CODEX_HOME (arctic-derived auth). Skips if the slot
        # hasn't been provisioned yet — codex_runner falls back to $HOME/.codex.
        if route.provider == "codex":
            codex_home = _codex_home_for_slot(route.slot)
            if codex_home is not None:
                native_argv += ["--codex-home", str(codex_home)]
        return native_argv

    if route.provider == "windsurf":
        return [
            "bash", "-c",
            f"windsurf --model {shlex.quote(route.model)} "
            f"--stdin < {shlex.quote(str(bundle_path))} | tee {shlex.quote(str(result_path))}",
        ]
    # github-copilot → handled by arctic wrapper fallback below. Direct
    # `gh copilot suggest` integration was removed 2026-04-22: the extension
    # is not installed on all worker hosts, its CLI contract does not match
    # the pipeline's --slot/--message-file/--output flags, and arctic-session-
    # wrapper already routes copilot traffic through the verified auth path.
    if route.provider == "ccs":
        return [
            "bash", "-c",
            f"ccs run --slot {shlex.quote(route.slot)} "
            f"--message-file {shlex.quote(str(bundle_path))} "
            f"--output {shlex.quote(str(result_path))}",
        ]

    # Fallback: delegate to arctic-session-wrapper with per-slot XDG.
    arctic_wrapper = AUDIT_SCRIPTS / "arctic-session-wrapper.sh"
    model_ref = route.model
    if "/" not in model_ref:
        model_ref = f"{route.provider}/{route.model}"
    argv = [
        "bash", str(arctic_wrapper),
        "--method", "run",
        "--slot", route.slot,
        "--model", model_ref,
        "--message-file", str(bundle_path),
        # --format json: arctic streams JSONL events to stdout, keeping the
        # agent's marker text intact where tee can capture it. `default`
        # renders a TUI that writes directly to the controlling tty and
        # bypasses tee, losing the <<AIRMENTOR_PASS_RESULT>> marker.
        "--format", "json",
    ]
    # tee arctic stdout into the result path so validator can scan it
    return [
        "bash", "-c",
        f"AUDIT_PROMPT_VERBATIM=1 " + " ".join(shlex.quote(x) for x in argv)
        + f" | tee {shlex.quote(str(result_path))}",
    ]


def _write_wrapper(
    *,
    task_row,
    task_id: int,
    route: router.Route,
    cwd: Path,
    bundle_path: Path,
    result_path: Path,
    log_path: Path,
    resume_session_id: str | None = None,
) -> Path:
    wrapper_path = _wrapper_for(task_row)
    inner = _build_exec_command(
        task_id=task_id,
        route=route,
        cwd=cwd,
        bundle_path=bundle_path,
        result_path=result_path,
        resume_session_id=resume_session_id,
    )
    inner_quoted = " ".join(shlex.quote(x) for x in inner)
    script = textwrap.dedent(
        f"""\
        #!/usr/bin/env bash
        set -uo pipefail
        cd {shlex.quote(str(cwd))}
        export PYTHONPATH={shlex.quote(str(REPO_ROOT))}${{PYTHONPATH:+:$PYTHONPATH}}
        export AIRMENTOR_PIPELINE_TASK_ID={task_row['id']}
        export AIRMENTOR_PIPELINE_SESSION={_session_name(task_row)}
        export AIRMENTOR_PIPELINE_PASS={shlex.quote(task_row['pass_name'])}
        export AIRMENTOR_PIPELINE_CWD={shlex.quote(str(cwd))}
        {{
          printf '[%s] session-start task_id=%s pass=%s provider=%s model=%s slot=%s cwd=%s\\n' \\
            "$(date -u +%FT%TZ)" \\
            "{task_row['id']}" \\
            {shlex.quote(task_row['pass_name'])} \\
            {shlex.quote(route.provider)} \\
            {shlex.quote(route.model)} \\
            {shlex.quote(route.slot)} \\
            {shlex.quote(str(cwd))}
          set +e
          {inner_quoted}
          exit_code=$?
          set -e
          printf '[%s] session-exit exit_code=%s\\n' "$(date -u +%FT%TZ)" "$exit_code"
          echo "$exit_code" > {shlex.quote(str(result_path) + '.exitcode')}
        }} >> {shlex.quote(str(log_path))} 2>&1
        """
    )
    wrapper_path.write_text(script, encoding="utf-8")
    wrapper_path.chmod(0o755)
    return wrapper_path


# ---------- tmux ops ----------

def _tmux_has(session: str) -> bool:
    r = subprocess.run(["tmux", "has-session", "-t", session], capture_output=True)
    return r.returncode == 0


def _tmux_start(session: str, wrapper: Path) -> None:
    if _tmux_has(session):
        subprocess.run(["tmux", "kill-session", "-t", session], check=False)
    subprocess.run(
        ["tmux", "new-session", "-d", "-s", session, f"bash {shlex.quote(str(wrapper))}"],
        check=True,
    )


def _tmux_kill(session: str) -> None:
    subprocess.run(["tmux", "kill-session", "-t", session], check=False)


# ---------- supervisor loop ----------

@dataclass
class SuperviseOutcome:
    exit_code: int | None
    idle_timed_out: bool
    hard_timed_out: bool


def _supervise(
    *,
    task_row,
    session: str,
    log_path: Path,
    result_path: Path,
) -> SuperviseOutcome:
    idle = int(task_row["idle_timeout_s"] or 1800)
    hard = int(task_row["hard_timeout_s"] or 14400)
    start = time.time()
    last_activity = start
    last_size = 0
    last_result_size = 0
    while True:
        if not _tmux_has(session):
            break
        # progress signal: log file size or result file size change
        cur_log = log_path.stat().st_size if log_path.exists() else 0
        cur_result = result_path.stat().st_size if result_path.exists() else 0
        if cur_log != last_size or cur_result != last_result_size:
            last_size = cur_log
            last_result_size = cur_result
            last_activity = time.time()
            db.log_event(
                task_row["id"], "progress",
                {"log_bytes": cur_log, "result_bytes": cur_result},
            )
        now = time.time()
        if now - start > hard:
            _tmux_kill(session)
            db.log_event(task_row["id"], "hard_timeout", {"seconds": int(now - start)})
            return SuperviseOutcome(None, False, True)
        if now - last_activity > idle:
            _tmux_kill(session)
            db.log_event(task_row["id"], "idle_timeout",
                         {"idle_seconds": int(now - last_activity)})
            return SuperviseOutcome(None, True, False)
        time.sleep(15)

    # read exit code file written by wrapper
    exit_file = Path(str(result_path) + ".exitcode")
    code = None
    if exit_file.exists():
        try:
            code = int(exit_file.read_text().strip())
        except Exception:
            code = None
    return SuperviseOutcome(code, False, False)


# ---------- public entry ----------

_ROUTE_PICK_LOCK = threading.Lock()


def _busy_sibling_slots(dag_run_id: str, me_task_id: int) -> list[str]:
    """Slots held by OTHER claimed/running/merging tasks in the same DAG run.

    Rationale (2026-04-22 round-6): arctic per-slot XDG isolation does NOT
    make a slot safe for concurrent use — two arctic processes on the same
    slot stomp on the plugin cache + session state dir, and one (or both)
    hang in the "Working..." TUI spinner forever. We therefore enforce
    slot exclusivity at route-pick time: each task sees which slots its
    siblings are already using and excludes them from `choose_route`.
    """
    busy: list[str] = []
    for r in db.list_tasks(dag_run_id):
        if r["state"] not in {"claimed", "running", "merging"}:
            continue
        if int(r["id"]) == int(me_task_id):
            continue
        s = r["slot"]
        if s:
            busy.append(s)
    return busy


def execute_task(task_id: int) -> None:
    task_row = db.get_task(task_id)
    if not task_row:
        return
    import datetime as _dt
    # Route-pick + slot-reservation must be atomic across all worker threads.
    # Without this lock, N parallel workers read `_busy_sibling_slots()`
    # before any has written its slot to DB, so all N pick the same highest-
    # rank slot and stomp each other's arctic XDG state (observed round-6:
    # 3 tasks hung 2h+ in "Working..." TUI spinner on codex-03). Holding
    # the lock until the slot column is persisted guarantees the next
    # caller sees the reservation and excludes it.
    with _ROUTE_PICK_LOCK:
        db.set_task_state(
            task_id, "running",
            started_at=_dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
            git_head_before=_git_head() or "",
        )
        busy_slots = _busy_sibling_slots(task_row["dag_run_id"], task_id)
        db.log_event(task_id, "route_excluding_busy_slots", {"slots": busy_slots})
        route = router.choose_route(task_row, exclude_slots=busy_slots)
        if route is None:
            # wait_for_any_slot can block; release the lock first so siblings
            # can still progress. Re-acquire after we have a route.
            pass
        if route is not None:
            slot_ledger.mark_used(route.slot, task_id)
            db.update_task_fields(
                task_id,
                slot=route.slot,
                provider=route.provider,
                account=route.account,
                account_key=getattr(route, "account_key", None),
                model=route.model,
                reasoning_effort=route.reasoning_effort,
                tmux_session=_session_name(task_row),
            )
    if route is None:
        # Long wait outside lock so other workers can progress.
        busy_slots = _busy_sibling_slots(task_row["dag_run_id"], task_id)
        route = router.wait_for_any_slot(task_row, exclude_slots=busy_slots,
                                         max_wait_seconds=6 * 3600)
        if route is None:
            db.set_task_state(task_id, "failed", last_failure_class="no_route",
                              last_error="no route available within budget")
            return
        with _ROUTE_PICK_LOCK:
            slot_ledger.mark_used(route.slot, task_id)
            db.update_task_fields(
                task_id,
                slot=route.slot,
                provider=route.provider,
                account=route.account,
                account_key=getattr(route, "account_key", None),
                model=route.model,
                reasoning_effort=route.reasoning_effort,
                tmux_session=_session_name(task_row),
            )

    # --- Context handoff: build briefing pack from ancestors ---
    pack_path = briefing.build_pack_for(task_id)
    if pack_path:
        db.update_task_fields(task_id, briefing_path=str(pack_path))

    # --- Isolation: per-task git worktree (safe parallelism) ---
    isolation_mode = os.environ.get("AIRMENTOR_PIPELINE_ISOLATION", "auto")
    try:
        wt = worktree.prepare(task_row, isolation=isolation_mode)
    except Exception as e:
        db.log_event(task_id, "worktree_prepare_failed", {"error": str(e)[:2000]})
        db.set_task_state(task_id, "failed",
                          last_failure_class="worktree_prepare",
                          last_error=str(e)[:2000])
        return

    resume_sid = _find_resume_session_id(task_row, route)

    bundle_text = _compose_prompt(task_row, route, briefing_path=pack_path)
    bundle_path = _write_bundle(task_row, bundle_text)
    result_path = _result_file_for(task_row)
    log_path = _log_file_for(task_row)
    exit_file = Path(str(result_path) + ".exitcode")
    if exit_file.exists():
        exit_file.unlink()

    manifest_items = _read_manifest(task_row["manifest_file"])
    if manifest_items:
        db.set_expected_artifacts(task_id, manifest_items)

    session = _session_name(task_row)
    wrapper = _write_wrapper(
        task_row=task_row,
        task_id=task_id,
        route=route,
        cwd=wt.path,
        bundle_path=bundle_path,
        result_path=result_path,
        log_path=log_path,
        resume_session_id=resume_sid,
    )
    _tmux_start(session, wrapper)
    db.log_event(task_id, "tmux_started", {
        "session": session, "wrapper": str(wrapper),
        "worktree": str(wt.path), "isolated": wt.isolated,
        "resume_session_id": resume_sid,
    })
    outcome = _supervise(task_row=task_row, session=session,
                         log_path=log_path, result_path=result_path)

    # --- Worktree collect + merge ---
    collect_info = worktree.collect(task_row, wt, merge_to="HEAD")
    db.update_task_fields(task_id, git_head_after=collect_info["head_after"] or _git_head() or "")

    if outcome.idle_timed_out or outcome.hard_timed_out:
        db.set_task_state(task_id, "failed",
                          last_failure_class="timeout",
                          last_error=f"idle={outcome.idle_timed_out} hard={outcome.hard_timed_out}")
        # keep worktree for forensics
        return
    if collect_info.get("merge_conflict"):
        db.set_task_state(task_id, "failed",
                          last_failure_class="merge_conflict",
                          last_error=f"worktree {wt.path} left in place for inspection")
        return

    report = validator.validate(
        task_id=task_id, attempt=task_row["attempt"], result_file=result_path
    )
    if report.pass_result is not None:
        db.update_task_fields(task_id, result_json=json.dumps({
            "pass": report.pass_result.pass_name,
            "status": report.pass_result.status,
            "artifacts": report.pass_result.artifacts,
            "citations": report.pass_result.citations,
            "intent_affirmed": report.pass_result.intent_affirmed,
            "notes": report.pass_result.notes,
        }))
    if report.overall_passed:
        db.set_task_state(
            task_id, "completed",
            finished_at=_dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        )
        db.log_event(task_id, "validator_passed",
                     {"checks": [c.name for c in report.checks]})
        # write briefing for downstream
        try:
            briefing.record_outcome(task_id=task_id)
        except Exception as e:
            db.log_event(task_id, "briefing_write_failed", {"error": str(e)[:1000]})
        # cleanup worktree branch after merge
        try:
            worktree.cleanup(task_row, wt, keep_branch=False)
        except Exception:
            pass
        db.mark_ready_if_deps_done(task_row["dag_run_id"])
        return

    failing_checks = [c for c in report.checks if not c.passed]
    detail = [{"name": c.name, "severity": c.severity, "detail": c.detail}
              for c in failing_checks]
    db.log_event(task_id, "validator_failed", {"checks": detail})
    # keep worktree if validation failed — next attempt starts fresh anyway
    if task_row["attempt"] < task_row["max_attempts"]:
        db.set_task_state(task_id, "ready",
                          last_failure_class="validator_failed",
                          last_error=json.dumps(detail)[:2000])
    else:
        db.set_task_state(task_id, "failed",
                          last_failure_class="validator_failed",
                          last_error=json.dumps(detail)[:2000])


def _find_resume_session_id(task_row, route) -> str | None:
    """Pick a session id to resume from a prior attempt on the same slot.

    If this is attempt > 1 and the previous attempt recorded an
    arctic_session_id, resume it so the agent retains its scratchpad.
    """
    if task_row["arctic_session_id"] and task_row["slot"] == route.slot:
        return task_row["arctic_session_id"]
    return None
