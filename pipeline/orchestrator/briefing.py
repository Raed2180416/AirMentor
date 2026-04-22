"""Context handoff between passes.

After a task completes, we record a concise, lossless briefing markdown
into `$STATE/briefings/<node>.md`. Downstream tasks have a briefing pack
built from every ancestor's briefing, attached to the next arctic run
via `--file`.

Briefing contents (deterministic order):
  1. Identity line (pass_name, node_id, dag_run_id)
  2. Pass intent (from intent.yaml) — verbatim
  3. Structured result JSON from the <<AIRMENTOR_PASS_RESULT>> marker
     (artifacts written, citations, notes, intent_affirmed)
  4. Validator summary (check → passed/failed)
  5. Key assistant-transcript excerpts (last N chars from arctic export)
  6. Git heads before/after — so the next agent can `git log -p` the
     delta if it needs to inspect what the previous agent actually did.

Everything is pure data; no interpretation. The next agent decides what
is load-bearing.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Sequence

from . import db

STATE_ROOT = Path.home() / ".local" / "state" / "airmentor" / "pipeline"
BRIEFING_ROOT = STATE_ROOT / "briefings"
BRIEFING_ROOT.mkdir(parents=True, exist_ok=True)
REPO_ROOT = Path(__file__).resolve().parents[2]


def briefing_path_for(dag_run_id: str, node_id: str) -> Path:
    safe = f"{dag_run_id}__{node_id}".replace("/", "_")
    return BRIEFING_ROOT / f"{safe}.md"


def _safe_read_yaml(p: str | None) -> str:
    if not p:
        return ""
    path = Path(p)
    if not path.is_absolute():
        path = REPO_ROOT / path
    if not path.is_file():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def record_outcome(
    *,
    task_id: int,
    transcript_tail_chars: int = 4000,
) -> Path:
    """Write the briefing for a completed task. Idempotent."""
    task = db.get_task(task_id)
    if not task:
        raise ValueError(f"task {task_id} not found")
    out = briefing_path_for(task["dag_run_id"], task["node_id"])
    now_iso = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    intent_text = _safe_read_yaml(task["intent_file"])
    result_json_raw = task["result_json"] or "{}"
    try:
        result_json = json.loads(result_json_raw)
    except json.JSONDecodeError:
        result_json = {"_raw": result_json_raw}
    validators = db.list_validator_results(task["id"])
    transcript = _read_transcript_tail(task["id"], transcript_tail_chars)

    lines: list[str] = []
    lines.append(f"# Briefing: {task['node_id']} ({task['pass_name']})")
    lines.append("")
    lines.append(f"- dag_run_id: `{task['dag_run_id']}`")
    lines.append(f"- task_id: `{task['id']}`")
    lines.append(f"- state: `{task['state']}`  attempt: `{task['attempt']}`")
    lines.append(f"- slot: `{task['slot']}`  provider: `{task['provider']}`"
                 f"  account: `{task['account']}`  model: `{task['model']}`")
    lines.append(f"- arctic_session_id: `{task['arctic_session_id']}`")
    lines.append(f"- git_head_before: `{task['git_head_before']}`")
    lines.append(f"- git_head_after:  `{task['git_head_after']}`")
    lines.append(f"- briefing_written_at: `{now_iso}`")
    lines.append("")
    if intent_text:
        lines.append("## Intent")
        lines.append("")
        lines.append("```yaml")
        lines.append(intent_text.strip())
        lines.append("```")
        lines.append("")
    lines.append("## Structured result")
    lines.append("")
    lines.append("```json")
    lines.append(json.dumps(result_json, indent=2))
    lines.append("```")
    lines.append("")
    if validators:
        lines.append("## Validator trail")
        lines.append("")
        for v in validators:
            mark = "PASS" if v["passed"] else "FAIL"
            lines.append(f"- `{v['check_name']}` — {mark}  ({v['severity']})")
        lines.append("")
    if transcript:
        lines.append("## Transcript tail (last chars)")
        lines.append("")
        lines.append("```text")
        lines.append(transcript.strip())
        lines.append("```")
        lines.append("")

    out.write_text("\n".join(lines), encoding="utf-8")
    return out


def _read_transcript_tail(task_id: int, max_chars: int) -> str:
    """Read the last arctic-exported transcript we stored, if any."""
    from . import executor  # local import to avoid cycle
    result = executor._result_file_for_id(task_id)
    if not result:
        return ""
    if not Path(result).is_file():
        return ""
    try:
        text = Path(result).read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""
    if len(text) <= max_chars:
        return text
    return text[-max_chars:]


def build_pack_for(task_id: int) -> Path | None:
    """Concat briefings of every ancestor task (completed) into one pack.

    Returns the pack path or None if there are no ancestors.
    """
    task = db.get_task(task_id)
    if not task:
        return None
    deps = json.loads(task["depends_on"] or "[]")
    if not deps:
        return None

    ancestors: list[Path] = []
    for dep_node in deps:
        dep = db.get_task_by_node(task["dag_run_id"], dep_node)
        if not dep or dep["state"] != "completed":
            continue
        p = briefing_path_for(dep["dag_run_id"], dep["node_id"])
        if p.is_file():
            ancestors.append(p)
    if not ancestors:
        return None

    pack_path = BRIEFING_ROOT / f"{task['dag_run_id']}__{task['node_id']}__pack.md"
    parts: list[str] = []
    parts.append(f"# Context pack for `{task['node_id']}`")
    parts.append("")
    parts.append(f"Built at {dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')}.")
    parts.append(f"Ancestors: {', '.join(deps)}.")
    parts.append("")
    for a in ancestors:
        parts.append("---")
        parts.append("")
        parts.append(a.read_text(encoding="utf-8"))
        parts.append("")
    pack_path.write_text("\n".join(parts), encoding="utf-8")
    return pack_path
