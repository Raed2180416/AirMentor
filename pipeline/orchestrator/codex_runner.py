"""Codex CLI native runner (`codex exec`).

Headless invocation (developers.openai.com/codex/cli/reference):

    codex exec -C <cwd> --json \
        -m gpt-5.4 \
        -c model_reasoning_effort=xhigh \
        --output-last-message <file> \
        --full-auto \
        "<prompt>"                 # or pipe via stdin with -

`--json` streams one JSON event per line. `--output-last-message <file>`
writes only the final assistant message. Codex also writes a rollout
JSONL to `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl`.

Session resume: `codex resume <session-id>` OR `codex resume --last`.

Multi-account: point `CODEX_HOME` at a per-account credentials dir.
Arctic already handles this via `run_arctic_for_slot`; for direct
codex usage (bypassing arctic) use `CODEX_HOME=~/.codex-alt1 codex exec ...`.
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

CODEX_BIN = os.environ.get("AIRMENTOR_CODEX_BIN", "codex")


@dataclass
class CodexResult:
    session_id: str | None
    last_message: str
    transcript: str          # concatenated assistant events
    exit_code: int
    stderr: str
    events: list[dict]


def _extract_session_id(events: list[dict]) -> str | None:
    for e in events:
        if not isinstance(e, dict):
            continue
        # codex emits `session.created` {session_id: ...}
        if e.get("type") in {"session.created", "session_created", "session"}:
            sid = e.get("session_id") or (e.get("data") or {}).get("session_id")
            if sid:
                return sid
    return None


def _flatten_transcript(events: list[dict]) -> str:
    out: list[str] = []
    for e in events:
        if not isinstance(e, dict):
            continue
        if e.get("type") in {"assistant.message", "message.assistant"}:
            t = e.get("text") or e.get("content") or (e.get("data") or {}).get("text")
            if isinstance(t, str):
                out.append(t)
        elif e.get("type") == "exec.command.end":
            # include tool output snippets for downstream context
            stdout = (e.get("data") or {}).get("stdout") or ""
            if stdout:
                out.append(f"[tool stdout] {stdout[:500]}")
    return "\n".join(out)


def run(
    *,
    prompt_text: str,
    cwd: Path,
    model: str = "gpt-5.4",
    reasoning_effort: str = "high",
    resume_session_id: str | None = None,
    codex_home: Path | None = None,
    timeout_s: int = 14_400,
    extra_config: list[str] | None = None,
) -> CodexResult:
    """Run a codex exec pass.

    Prompt text is piped via stdin (codex exec accepts `-` for stdin).
    """
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".last.txt", delete=False
    ) as last_msg_fp:
        last_msg_path = Path(last_msg_fp.name)

    argv: list[str] = [
        CODEX_BIN, "exec",
        "-C", str(cwd),
        "-m", model,
        "-c", f"model_reasoning_effort=\"{reasoning_effort}\"",
        "--json",
        "--output-last-message", str(last_msg_path),
        "--full-auto",
    ]
    for cfg in extra_config or []:
        argv += ["-c", cfg]
    if resume_session_id:
        # `codex exec` does not itself accept --resume; we prepend
        # `codex resume` flow by delegating to the resume subcommand
        # when a session id is supplied.
        argv = [
            CODEX_BIN, "resume", resume_session_id,
            "-C", str(cwd),
            "-m", model,
            "-c", f"model_reasoning_effort=\"{reasoning_effort}\"",
            "--json",
            "--output-last-message", str(last_msg_path),
            "--full-auto",
        ]
    argv.append("-")  # read prompt from stdin

    env = os.environ.copy()
    if codex_home:
        env["CODEX_HOME"] = str(codex_home)

    try:
        proc = subprocess.run(
            argv,
            cwd=str(cwd),
            input=prompt_text,
            text=True,
            capture_output=True,
            timeout=timeout_s,
            env=env,
        )
    except subprocess.TimeoutExpired:
        return CodexResult(
            session_id=None, last_message="", transcript="",
            exit_code=124, stderr=f"timeout after {timeout_s}s",
            events=[],
        )
    finally:
        # we keep last_msg_path after the run for the caller to read
        pass

    events: list[dict] = []
    for line in (proc.stdout or "").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    last_message = ""
    try:
        last_message = last_msg_path.read_text(encoding="utf-8")
    except OSError:
        pass
    finally:
        try:
            last_msg_path.unlink()
        except OSError:
            pass

    transcript = _flatten_transcript(events) or last_message
    if proc.returncode != 0 and proc.stderr:
        stderr_text = proc.stderr.strip()
        if stderr_text:
            transcript = (transcript + "\n\n" if transcript else "") + f"[codex stderr]\n{stderr_text}"

    return CodexResult(
        session_id=_extract_session_id(events),
        last_message=last_message,
        transcript=transcript,
        exit_code=proc.returncode,
        stderr=proc.stderr or "",
        events=events,
    )
