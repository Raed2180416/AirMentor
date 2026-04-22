"""OpenCode runner.

OpenCode is used as a zero-cost fallback when every Arctic account is
cooling down. It hosts providers OpenAI, Anthropic, Gemini, Bedrock,
Groq, Azure, **OpenRouter**, and local Ollama — all under one CLI.

Headless flow (opencode.ai/docs/cli):

    # one-time: `opencode auth login` (stores creds under ~/.local/share/opencode)
    # preferred: run against a persistent server to avoid MCP cold start

    opencode serve --port 4096 &
    opencode run --attach http://localhost:4096 \
        --model openrouter/deepseek/deepseek-r1:free \
        --format json \
        "<prompt>"

The attach mode shares one server across tasks, so MCP/agent/model
caches amortise. If no server is running, `opencode run` still works
but cold-starts each invocation.

Returns the final assistant text + session id.
"""
from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

OPENCODE_BIN = os.environ.get("AIRMENTOR_OPENCODE_BIN", "opencode")
DEFAULT_SERVER = os.environ.get("AIRMENTOR_OPENCODE_SERVER", "")


@dataclass
class OpenCodeResult:
    session_id: str | None
    transcript: str
    exit_code: int
    stderr: str
    events: list[dict]


def is_available() -> bool:
    try:
        subprocess.run(
            [OPENCODE_BIN, "--version"],
            capture_output=True, timeout=5, check=True,
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError,
            subprocess.TimeoutExpired):
        return False


def ensure_server(port: int = 4096) -> str | None:
    """Start `opencode serve` in the background if not already.

    Returns the attach URL on success, None if `opencode` missing.
    """
    if not is_available():
        return None
    url = f"http://localhost:{port}"
    # probe: curl -s url/health
    probe = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
         f"{url}/health"],
        capture_output=True, text=True, timeout=2,
    )
    if probe.returncode == 0 and (probe.stdout or "").strip() == "200":
        return url
    # spawn detached
    subprocess.Popen(
        [OPENCODE_BIN, "serve", "--port", str(port)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    return url


def run(
    *,
    prompt_text: str,
    cwd: Path,
    model: str = "openrouter/qwen/qwen3-coder:free",
    attach: str | None = None,
    resume_session_id: str | None = None,
    timeout_s: int = 14_400,
) -> OpenCodeResult:
    if not is_available():
        return OpenCodeResult(
            session_id=None, transcript="",
            exit_code=127, stderr="opencode not installed",
            events=[],
        )
    argv: list[str] = [
        OPENCODE_BIN, "run",
        "--format", "json",
        "--model", model,
    ]
    if attach or DEFAULT_SERVER:
        argv += ["--attach", attach or DEFAULT_SERVER]
    if resume_session_id:
        argv += ["--session", resume_session_id]

    try:
        proc = subprocess.run(
            argv,
            cwd=str(cwd),
            input=prompt_text,
            text=True,
            capture_output=True,
            timeout=timeout_s,
        )
    except subprocess.TimeoutExpired:
        return OpenCodeResult(
            session_id=None, transcript="",
            exit_code=124, stderr=f"timeout after {timeout_s}s",
            events=[],
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

    sid = None
    transcript_parts: list[str] = []
    for e in events:
        if not isinstance(e, dict):
            continue
        sid = sid or e.get("session_id") or e.get("sessionID")
        if e.get("type") == "assistant":
            t = (e.get("message") or {}).get("content") or e.get("text")
            if isinstance(t, str):
                transcript_parts.append(t)
            elif isinstance(t, list):
                for c in t:
                    if isinstance(c, dict) and c.get("text"):
                        transcript_parts.append(c["text"])
        elif e.get("type") == "result" and e.get("text"):
            transcript_parts.append(e["text"])

    transcript = "\n".join(transcript_parts).strip()
    if not transcript:
        transcript = proc.stdout or ""   # fallback: raw stdout

    return OpenCodeResult(
        session_id=sid,
        transcript=transcript,
        exit_code=proc.returncode,
        stderr=proc.stderr or "",
        events=events,
    )
