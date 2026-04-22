"""Claude Code CLI runner.

Why dedicated: the user's Anthropic account is not usable via raw API
from 3rd-party tools, so the ONLY way to use Claude is the official
Claude Code CLI (`claude`). Arctic cannot substitute here.

Headless invocation (from code.claude.com/docs/en/headless):

    claude -p "<prompt>" \
      --output-format stream-json \
      --input-format text \
      --resume <session-id>           # optional, continue a session
      --session-id <uuid>             # optional, pin the session id
      --allowedTools "Read,Grep,Bash(git log:*)" \
      --system-prompt "..."           # replaces default

Stream-json format emits newline-delimited events:
    {"type":"system","subtype":"init",...}
    {"type":"assistant","message":{...},"session_id":"..."}
    {"type":"result","subtype":"success","result":"...","session_id":"..."}

We capture the final `result` event's `result` field as the transcript,
and `session_id` as the resumable handle for the next pass.
"""
from __future__ import annotations

import json
import os
import subprocess
import uuid
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CLAUDE_BIN = os.environ.get("AIRMENTOR_CLAUDE_BIN", "claude")
# Safe default: read/grep/bash-read-only + the tools pipeline needs
DEFAULT_ALLOWED_TOOLS = (
    "Read,Grep,Glob,LS,"
    "Bash(git log:*),Bash(git diff:*),Bash(git status:*),Bash(cat:*),"
    "Bash(rg:*),Bash(ls:*),Bash(head:*),Bash(tail:*),Bash(wc:*),"
    "Write,Edit,MultiEdit"
)


@dataclass
class ClaudeResult:
    session_id: str | None
    transcript: str
    exit_code: int
    stderr: str
    raw_events: list[dict]   # parsed stream-json events


def _flatten_assistant_text(events: list[dict]) -> str:
    """Concat every assistant `content[*].text` across the stream."""
    parts: list[str] = []
    for e in events:
        if not isinstance(e, dict):
            continue
        if e.get("type") == "result" and isinstance(e.get("result"), str):
            # `result` is the final formatted transcript already
            parts.append(e["result"])
            continue
        if e.get("type") != "assistant":
            continue
        msg = e.get("message") or {}
        content = msg.get("content")
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            for c in content:
                if isinstance(c, dict) and c.get("type") == "text":
                    parts.append(c.get("text") or "")
    return "\n".join(x for x in parts if x)


def _first_session_id(events: list[dict]) -> str | None:
    for e in events:
        sid = isinstance(e, dict) and e.get("session_id")
        if sid:
            return sid
    return None


def run(
    *,
    prompt_text: str,
    cwd: Path,
    model: str | None = None,         # e.g. "claude-sonnet-4-6"
    resume_session_id: str | None = None,
    pin_session_id: str | None = None,
    allowed_tools: str = DEFAULT_ALLOWED_TOOLS,
    system_prompt: str | None = None,
    timeout_s: int = 14_400,
    env_overrides: dict[str, str] | None = None,
) -> ClaudeResult:
    """Run a claude CLI pass, returning the aggregated result.

    The prompt is sent via stdin so it can be arbitrarily long without
    argv limits.
    """
    sid = pin_session_id or str(uuid.uuid4())
    argv: list[str] = [
        CLAUDE_BIN,
        "-p",
        "--input-format", "text",
        "--output-format", "stream-json",
        "--session-id", sid,
        "--allowedTools", allowed_tools,
        "--verbose",
        "--dangerously-skip-permissions",  # inside worktree sandbox, safe
    ]
    if model:
        argv += ["--model", model]
    if resume_session_id:
        argv += ["--resume", resume_session_id]
    if system_prompt:
        argv += ["--append-system-prompt", system_prompt]

    env = os.environ.copy()
    if env_overrides:
        env.update(env_overrides)

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
    except subprocess.TimeoutExpired as e:
        return ClaudeResult(
            session_id=sid,
            transcript="",
            exit_code=124,
            stderr=f"timeout after {timeout_s}s: {e}",
            raw_events=[],
        )

    events: list[dict] = []
    for line in (proc.stdout or "").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    return ClaudeResult(
        session_id=_first_session_id(events) or sid,
        transcript=_flatten_assistant_text(events),
        exit_code=proc.returncode,
        stderr=proc.stderr or "",
        raw_events=events,
    )
