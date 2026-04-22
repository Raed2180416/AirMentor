"""Reattach orphaned in-flight tasks whose orchestrator worker thread died.

Scenario:
  orch crashes or is restarted while `_run_task` is in the middle of executing
  a task. The native_runner child (tmux + codex CLI) was detached from the
  dead orch and continues running (reparented to init). It eventually finishes
  and writes its result file. But no one is alive to call `worktree.collect`
  + `validator.validate` + `db.set_task_state(completed)`. The task row
  remains state=running forever.

Fix:
  Detect the condition post-hoc. For every task where:
    - state = running
    - a `native_runner_finished` event exists
    - no `validator_passed` or `validator_failed` event exists after it
    - the result file exists on disk
  Reconstruct a WorktreeHandle from the `worktree_prepared` event payload,
  invoke the standard `worktree.collect` + `validator.validate` paths, and
  update the DB state exactly as `executor._run_task` would.

Usage:
    python3 -m pipeline.orchestrator.reattach_orphans --dag-run-id <id>
    python3 -m pipeline.orchestrator.reattach_orphans --task-id 46
    python3 -m pipeline.orchestrator.reattach_orphans --all  # scan all DAGs

Dry-run by default to protect against accidental mutation:
    python3 -m pipeline.orchestrator.reattach_orphans --task-id 46 --apply
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import sqlite3
import sys
from pathlib import Path

from . import briefing, db, validator, worktree


def _find_orphans(task_id: int | None, dag_run_id: str | None) -> list[dict]:
    """Return rows that look orphaned (native_runner finished, no validator run)."""
    conn = sqlite3.connect(str(db.db_path()))
    conn.row_factory = sqlite3.Row
    where = ["t.state = 'running'"]
    params: list = []
    if task_id is not None:
        where.append("t.id = ?")
        params.append(task_id)
    if dag_run_id is not None:
        where.append("t.dag_run_id = ?")
        params.append(dag_run_id)
    sql = f"""
        SELECT t.id, t.node_id, t.pass_name, t.dag_run_id, t.attempt, t.max_attempts,
               t.git_head_before, t.git_head_after, t.write_scope_glob, t.slot,
               t.started_at, t.claimed_at
          FROM tasks t
         WHERE {' AND '.join(where)}
         ORDER BY t.id
    """
    orphans: list[dict] = []
    for row in conn.execute(sql, params):
        tid = row["id"]
        finished = list(conn.execute(
            "SELECT at,payload FROM task_events "
            "WHERE task_id=? AND kind='native_runner_finished' "
            "ORDER BY at DESC LIMIT 1", (tid,)
        ))
        if not finished:
            continue
        finish_at = finished[0]["at"]
        validated = list(conn.execute(
            "SELECT at FROM task_events "
            "WHERE task_id=? AND kind IN ('validator_passed','validator_failed') "
            "AND at > ? LIMIT 1", (tid, finish_at)
        ))
        if validated:
            continue
        prepared = list(conn.execute(
            "SELECT payload FROM task_events "
            "WHERE task_id=? AND kind='worktree_prepared' "
            "ORDER BY at DESC LIMIT 1", (tid,)
        ))
        if not prepared:
            continue
        try:
            prep_payload = json.loads(prepared[0]["payload"] or "{}")
        except Exception:
            prep_payload = {}
        wt_path = prep_payload.get("path")
        wt_branch = prep_payload.get("branch")
        wt_base = prep_payload.get("base_sha")
        if not (wt_path and wt_branch):
            continue
        orphans.append({
            "task": dict(row),
            "finish_at": finish_at,
            "worktree_path": Path(wt_path),
            "worktree_branch": wt_branch,
            "worktree_base_sha": wt_base or row["git_head_before"] or "",
        })
    conn.close()
    return orphans


def _result_path_for(task_id: int, dag_run_id: str, node_id: str) -> Path:
    """Match executor's naming convention for result files."""
    state = Path.home() / ".local" / "state" / "airmentor" / "pipeline"
    results = state / "results"
    session = f"airmentor-pipe-{node_id}-{task_id}"
    return results / f"{session}.result.txt"


def reattach(orphan: dict, apply: bool) -> dict:
    task_row = orphan["task"]
    tid = int(task_row["id"])
    out: dict = {
        "task_id": tid,
        "node_id": task_row["node_id"],
        "finish_at": orphan["finish_at"],
        "applied": apply,
        "stage": "scan",
    }

    result_path = _result_path_for(tid, task_row["dag_run_id"], task_row["node_id"])
    if not result_path.is_file():
        out["error"] = f"result file missing: {result_path}"
        return out

    wt = worktree.WorktreeHandle(
        path=orphan["worktree_path"],
        branch=orphan["worktree_branch"],
        base_sha=orphan["worktree_base_sha"],
        isolated=True,
    )
    out["worktree_path"] = str(wt.path)
    out["worktree_exists"] = wt.path.exists()

    if not apply:
        out["stage"] = "dry_run_ok"
        return out

    # Live: collect + merge
    try:
        collect_info = worktree.collect(task_row, wt, merge_to="HEAD")
    except Exception as exc:
        out["stage"] = "collect_failed"
        out["error"] = f"{type(exc).__name__}: {exc}"
        return out
    out["collect"] = {
        "merged": collect_info.get("merged"),
        "merge_conflict": collect_info.get("merge_conflict"),
        "head_after": collect_info.get("head_after"),
        "changed_files_count": len(collect_info.get("changed_files") or []),
    }
    db.update_task_fields(
        tid, git_head_after=collect_info.get("head_after") or task_row["git_head_after"] or "",
    )
    if collect_info.get("merge_conflict"):
        db.set_task_state(tid, "failed", last_failure_class="merge_conflict",
                          last_error="reattach: rebase/ff failed")
        out["stage"] = "failed_merge_conflict"
        return out

    # Live: validate
    try:
        report = validator.validate(
            task_id=tid, attempt=task_row["attempt"], result_file=result_path,
        )
    except Exception as exc:
        out["stage"] = "validator_crashed"
        out["error"] = f"{type(exc).__name__}: {exc}"
        return out

    if report.pass_result is not None:
        db.update_task_fields(tid, result_json=json.dumps({
            "pass": report.pass_result.pass_name,
            "status": report.pass_result.status,
            "artifacts": report.pass_result.artifacts,
            "citations": report.pass_result.citations,
            "intent_affirmed": report.pass_result.intent_affirmed,
            "notes": report.pass_result.notes,
        }))

    if report.overall_passed:
        db.set_task_state(tid, "completed",
                          finished_at=_dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"))
        db.log_event(tid, "validator_passed",
                     {"checks": [c.name for c in report.checks], "source": "reattach_orphans"})
        try:
            briefing.record_outcome(task_id=tid)
        except Exception as exc:
            db.log_event(tid, "briefing_write_failed", {"error": str(exc)[:1000]})
        try:
            worktree.cleanup(task_row, wt, keep_branch=False)
        except Exception:
            pass
        db.mark_ready_if_deps_done(task_row["dag_run_id"])
        out["stage"] = "completed"
        return out

    failing_checks = [c for c in report.checks if not c.passed]
    detail = [{"name": c.name, "severity": c.severity, "detail": c.detail} for c in failing_checks]
    db.log_event(tid, "validator_failed", {"checks": detail, "source": "reattach_orphans"})
    if task_row["attempt"] < task_row["max_attempts"]:
        db.set_task_state(tid, "ready", last_failure_class="validator_failed",
                          last_error=json.dumps(detail)[:2000])
        out["stage"] = "validator_failed_retry"
    else:
        db.set_task_state(tid, "failed", last_failure_class="validator_failed",
                          last_error=json.dumps(detail)[:2000])
        out["stage"] = "validator_failed_final"
    out["failing_checks"] = [c["name"] for c in detail]
    return out


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__ or "")
    p.add_argument("--task-id", type=int, default=None, help="specific task id")
    p.add_argument("--dag-run-id", type=str, default=None, help="dag run id filter")
    p.add_argument("--all", action="store_true", help="scan every DAG run")
    p.add_argument("--apply", action="store_true",
                   help="actually mutate DB + merge worktrees (default is dry-run)")
    args = p.parse_args()

    if not (args.task_id or args.dag_run_id or args.all):
        print("ERROR: specify --task-id, --dag-run-id, or --all", file=sys.stderr)
        return 2

    orphans = _find_orphans(args.task_id, args.dag_run_id if not args.all else None)
    if not orphans:
        print(json.dumps({"orphans": [], "note": "no orphaned in-flight tasks found"}, indent=2))
        return 0

    outcomes = [reattach(o, apply=args.apply) for o in orphans]
    print(json.dumps({
        "apply": args.apply,
        "count": len(outcomes),
        "outcomes": outcomes,
    }, indent=2, default=str))
    any_fail = any(o.get("error") or o.get("stage","").startswith("failed") for o in outcomes)
    return 1 if any_fail else 0


if __name__ == "__main__":
    sys.exit(main())
