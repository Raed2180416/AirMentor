"""Structured exit contract.

Each subagent MUST emit exactly one well-formed marker block before ending:

    <<AIRMENTOR_PASS_RESULT>>
    {
      "pass": "<pass-name>",
      "status": "completed" | "partial" | "blocked",
      "artifacts": [ "path1", "path2" ],
      "citations": [ "src/foo.ts:123", "src/bar.ts:45-60" ],
      "intent_affirmed": true,
      "notes": "one-line human-readable"
    }
    <<END>>

If the marker is missing, malformed, or status != "completed", the task is
treated as failed regardless of exit code. This prevents "model exits pretending
done" failure mode.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

MARKER_START = "<<AIRMENTOR_PASS_RESULT>>"
MARKER_END = "<<END>>"

_BLOCK_RE = re.compile(
    re.escape(MARKER_START) + r"\s*(?P<body>.*?)\s*" + re.escape(MARKER_END),
    re.DOTALL,
)

# A value looks like a placeholder if it starts with `<` and ends with `>`
# and contains at least one space (the template uses human-readable hints).
_PLACEHOLDER_RE = re.compile(r"^<[^<>]*\s[^<>]*>$")


def _try_parse_marker_body(body: str) -> dict | None:
    """Parse the body between MARKER_START and MARKER_END.

    Arctic embeds the marker inside a JSON string field of its streaming
    events, so the literal body may contain `\\n` / `\\"` escape sequences
    that need a second unescape pass before `json.loads` succeeds.
    """
    try:
        obj = json.loads(body)
    except json.JSONDecodeError:
        try:
            obj = json.loads(bytes(body, "utf-8").decode("unicode_escape"))
        except Exception:
            return None
    return obj if isinstance(obj, dict) else None


def _looks_like_template(obj: dict) -> bool:
    """True if the parsed marker dict looks like our prompt-contract example.

    The prompt bundle we give every agent literally contains a sample
    marker with placeholder values (see `render_prompt_contract`). When
    arctic exports the session history, that user message is echoed back
    as JSON, and the regex picks up the template marker too. This helper
    distinguishes the template (placeholder-shaped fields) from a real
    emission (real paths, real notes).
    """
    for field in ("artifacts", "citations"):
        vals = obj.get(field) or []
        if not isinstance(vals, list):
            continue
        for v in vals:
            if isinstance(v, str) and _PLACEHOLDER_RE.match(v):
                return True
    notes = obj.get("notes")
    if isinstance(notes, str) and _PLACEHOLDER_RE.match(notes):
        return True
    return False


@dataclass
class PassResult:
    pass_name: str
    status: str
    artifacts: list[str]
    citations: list[str]
    intent_affirmed: bool
    notes: str
    raw: str

    def ok(self) -> bool:
        return self.status == "completed" and self.intent_affirmed


def render_prompt_contract(pass_name: str) -> str:
    """Human-facing prompt fragment injected into every subagent's prompt.

    Instructs the model how to emit the exit marker. Deterministic wording.
    """
    return f"""
## MANDATORY EXIT CONTRACT — THIS IS YOUR LAST INSTRUCTION

You MUST end your final assistant message with EXACTLY ONE marker block in
this literal form (no prose after it, no markdown code fence around it):

{MARKER_START}
{{
  "pass": "{pass_name}",
  "status": "completed",
  "artifacts": ["<absolute or repo-relative paths you wrote>"],
  "citations": ["<file:line or file:start-end references you relied on>"],
  "intent_affirmed": true,
  "notes": "<one concise human line; no secrets>"
}}
{MARKER_END}

CRITICAL — the orchestrator CANNOT detect your work without this marker.
If you skip it, your session is classified as FAILED even if every artifact
is written perfectly. This is non-negotiable.

Rules:
- status="completed" ONLY if every required artifact exists and is substantive.
- status="partial"/"blocked" allowed if you cannot finish; explain in `notes`.
- `citations` MUST reference real existing file paths with real line numbers.
- `intent_affirmed=true` ONLY if you did not change product intent.
- Do NOT print anything after {MARKER_END}.
- Emit the block exactly once.

Copy-paste the block above, fill in the 4 real fields, and send it as the
final lines of your final message. That is all.
"""


def parse_result(output_text: str) -> PassResult | None:
    """Extract and validate the pass-result marker. Returns None if invalid.

    Tolerance rule (round-6, 2026-04-22): arctic's `run --format json`
    streams partial events where each frame re-emits the growing assistant
    text, so the marker appears once per streaming frame plus once inside
    the post-run `arctic export` JSON dump appended by the wrapper. All
    these copies are identical content. We therefore:

    1. Find every marker block in the file.
    2. Deduplicate by JSON-normalised body (ignores whitespace/escapes).
    3. If exactly one unique content remains → accept it.
    4. Otherwise (truly conflicting duplicates) → reject.

    Rejecting on simple count > 1 was too strict and caused every arctic-
    format-json run to fail even when the agent complied perfectly.
    """
    # Pair each MARKER_END with the *latest* preceding MARKER_START such
    # that the body between them parses as a JSON dict with a `pass` field.
    # Forward-non-greedy re.findall() is too fragile: the prompt bundle we
    # inject mentions the marker name in narrative text (e.g. backtick-
    # wrapped  ``<<AIRMENTOR_PASS_RESULT>>`` inside "normal English ONLY
    # for … the JSON marker"), which becomes a MARKER_START that then gets
    # paired with the first MARKER_END (the close of the prompt template
    # example) → a body of narrative junk that fails JSON parsing. The
    # real agent marker at EOF gets skipped entirely.
    start_positions = [m.end() for m in re.finditer(re.escape(MARKER_START), output_text)]
    end_positions = [m.start() for m in re.finditer(re.escape(MARKER_END), output_text)]
    if not start_positions or not end_positions:
        return None

    # Walk ENDs from latest → earliest. The agent's real final emission is
    # always the last `<<END>>` in the file (arctic's post-run export wraps
    # after `<<END_AIRMENTOR_ARCTIC_EXPORT>>`, which itself contains the
    # real marker as the last non-wrapper MARKER_END). Intermediate
    # streaming frames may repeat the marker with evolving content (e.g.
    # agent edits the artifacts path mid-session, re-emits), so the most
    # trustworthy copy is the final one.
    chosen: dict | None = None
    for end_pos in reversed(end_positions):
        # walk starts in reverse (latest first) before this end
        for s_end in reversed(start_positions):
            if s_end > end_pos:
                continue
            raw_body = output_text[s_end:end_pos].strip()
            obj = _try_parse_marker_body(raw_body)
            if not (isinstance(obj, dict) and "pass" in obj and "status" in obj):
                continue
            if _looks_like_template(obj):
                # template echo — this end pairs with the template start;
                # try next earlier end (which will pair with a different
                # earlier start, possibly a real emission).
                break
            chosen = obj
            break
        if chosen is not None:
            break

    if chosen is None:
        return None

    obj = chosen
    try:
        return PassResult(
            pass_name=str(obj["pass"]),
            status=str(obj["status"]),
            artifacts=[str(x) for x in obj.get("artifacts", [])],
            citations=[str(x) for x in obj.get("citations", [])],
            intent_affirmed=bool(obj.get("intent_affirmed", False)),
            notes=str(obj.get("notes", "")),
            raw=json.dumps(obj, indent=2),
        )
    except (KeyError, TypeError, ValueError):
        return None


def parse_result_from_file(path: Path | str) -> PassResult | None:
    p = Path(path)
    if not p.exists():
        return None
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    return parse_result(text)
