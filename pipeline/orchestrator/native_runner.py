"""Native-runner dispatcher.

Invoked from the tmux wrapper (so it inherits the supervisor loop's
timeout + log capture discipline). Picks the correct runner for the
task's provider, runs it, writes a transcript to the result file, and
emits a structured exit marker if the underlying agent failed to emit
one itself.

Contract (same for every provider):
  stdin: unused
  argv:
     --task-id N
     --slot SLOT
     --provider NAME
     --account KEY
     --model MODEL
     --cwd PATH               # worktree or repo root
     --bundle BUNDLE_PATH
     --result RESULT_PATH
     [--resume SESSION_ID]

Exit: 0 on completed run (even if agent says status=failed — the outer
      validator decides), non-zero only for infrastructure errors.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

from pipeline.orchestrator import (
    claude_runner, codex_runner, opencode_runner, db,
)
from pipeline.orchestrator.contracts import MARKER_START, MARKER_END


def _read_bundle(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _write_result(result_path: Path, transcript: str, session_id: str | None) -> None:
    result_path.parent.mkdir(parents=True, exist_ok=True)
    header = f"[native-runner] finished at {dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')}\n"
    if session_id:
        header += f"[native-runner] session_id={session_id}\n"
    # Transcript may already contain a marker from the agent; otherwise
    # caller (validator) will detect its absence and fail hard.
    result_path.write_text(header + "\n" + (transcript or ""), encoding="utf-8")


def _synthesise_marker_if_missing(transcript: str, pass_name: str,
                                  intent_affirmed: bool = False) -> str:
    """If the upstream agent emitted no structured exit marker, appending a
    sentinel marker at runner level would be a lie. Instead we emit one
    with status=incomplete so validator fails with a clear reason.
    """
    if MARKER_START in transcript and MARKER_END in transcript:
        return transcript
    synthetic = {
        "pass": pass_name,
        "status": "failed",
        "artifacts": [],
        "citations": [],
        "intent_affirmed": intent_affirmed,
        "notes": "native-runner: agent did not emit structured exit marker",
    }
    return transcript + (
        f"\n\n{MARKER_START}\n{json.dumps(synthetic, indent=2)}\n{MARKER_END}\n"
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--task-id", type=int, required=True)
    ap.add_argument("--provider", required=True)
    ap.add_argument("--slot", default=None)
    ap.add_argument("--account", default=None)
    ap.add_argument("--account-key", default=None)
    ap.add_argument("--model", required=True)
    ap.add_argument("--cwd", required=True)
    ap.add_argument("--bundle", required=True)
    ap.add_argument("--result", required=True)
    ap.add_argument("--resume", default=None)
    ap.add_argument("--reasoning-effort", default="high")
    ap.add_argument("--system-prompt", default=None)
    ap.add_argument("--timeout", type=int, default=14_400)
    ap.add_argument("--codex-home", default=None,
                    help="Optional per-slot CODEX_HOME for codex provider (isolates auth/sessions).")
    args = ap.parse_args()

    cwd = Path(args.cwd)
    bundle_path = Path(args.bundle)
    result_path = Path(args.result)
    prompt_text = _read_bundle(bundle_path)

    session_id: str | None = None
    transcript = ""
    pass_name = "unknown-pass"
    row = db.get_task(args.task_id)
    if row:
        pass_name = row["pass_name"]

    try:
        if args.provider == "anthropic":
            r = claude_runner.run(
                prompt_text=prompt_text,
                cwd=cwd,
                model=args.model if args.model not in {"auto", ""} else None,
                resume_session_id=args.resume,
                system_prompt=args.system_prompt,
                timeout_s=args.timeout,
            )
            session_id = r.session_id
            transcript = r.transcript
            exit_code = r.exit_code
        elif args.provider in {"codex", "native-codex"}:
            codex_home_path = Path(args.codex_home) if args.codex_home else None
            r = codex_runner.run(
                prompt_text=prompt_text,
                cwd=cwd,
                model=args.model,
                reasoning_effort=args.reasoning_effort,
                resume_session_id=args.resume,
                codex_home=codex_home_path,
                timeout_s=args.timeout,
            )
            session_id = r.session_id
            transcript = r.transcript or r.last_message
            exit_code = r.exit_code
        elif args.provider in {"openrouter", "oss-local", "opencode"}:
            r = opencode_runner.run(
                prompt_text=prompt_text,
                cwd=cwd,
                model=args.model,
                resume_session_id=args.resume,
                timeout_s=args.timeout,
            )
            session_id = r.session_id
            transcript = r.transcript
            exit_code = r.exit_code
        else:
            # unknown provider under native runner; fail loudly
            db.log_event(args.task_id, "native_runner_unsupported", {
                "provider": args.provider,
            })
            _write_result(result_path, "", None)
            return 64
    except Exception as e:  # noqa: BLE001 — infrastructure error, not agent
        db.log_event(args.task_id, "native_runner_exception", {
            "error": str(e)[:4000],
        })
        _write_result(result_path, f"exception: {e}", None)
        return 70

    transcript = _synthesise_marker_if_missing(transcript, pass_name)
    _write_result(result_path, transcript, session_id)
    if session_id:
        db.update_task_fields(args.task_id, arctic_session_id=session_id)
    db.log_event(args.task_id, "native_runner_finished", {
        "provider": args.provider, "model": args.model,
        "session_id": session_id, "exit_code": exit_code,
        "transcript_chars": len(transcript),
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
