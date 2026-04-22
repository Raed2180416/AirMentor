#!/usr/bin/env python3
"""Dry-run subagent stub.

Provider=`local-dry` invokes this script in place of a real LLM. It:

  1. reads the prompt bundle
  2. extracts the pass name and required artifacts from the bundle
  3. writes each required artifact with synthetic valid content
     (satisfying min_lines / min_bytes / required_sections)
  4. emits a well-formed <<AIRMENTOR_PASS_RESULT>> marker to the result file

This is the end-to-end pipeline proof. It exercises every layer except the
real LLM round-trip. Nothing here should be used in production for a real pass.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

_PASS_RE = re.compile(r"^# Pipeline Pass: (?P<name>\S+)", re.MULTILINE)
_ARTIFACT_LINE_RE = re.compile(
    r"^- `(?P<path>[^`]+)` \(min_lines=(?P<ml>\d+), min_bytes=(?P<mb>\d+)\)",
    re.MULTILINE,
)
_SECTION_LINE_RE = re.compile(
    r"^\s{2,}- required section: `(?P<sec>[^`]+)`", re.MULTILINE
)


def parse_bundle(bundle_path: Path) -> tuple[str, list[dict]]:
    text = bundle_path.read_text(encoding="utf-8")
    m = _PASS_RE.search(text)
    pass_name = m.group("name") if m else bundle_path.stem
    # Parse artifacts block
    artifacts: list[dict] = []
    # Split by artifact list items; naive parsing walks line-by-line
    req_block_idx = text.find("## REQUIRED ARTIFACTS")
    if req_block_idx == -1:
        return pass_name, artifacts
    tail = text[req_block_idx:]
    # stop at next ## heading
    next_h = tail.find("\n## ", 1)
    if next_h != -1:
        tail = tail[:next_h]
    current: dict | None = None
    for line in tail.splitlines():
        am = _ARTIFACT_LINE_RE.match(line)
        if am:
            if current:
                artifacts.append(current)
            current = {
                "path": am.group("path"),
                "min_lines": int(am.group("ml")),
                "min_bytes": int(am.group("mb")),
                "required_sections": [],
            }
            continue
        sm = _SECTION_LINE_RE.match(line)
        if sm and current is not None:
            current["required_sections"].append(sm.group("sec"))
    if current:
        artifacts.append(current)
    return pass_name, artifacts


def synth_artifact_body(pass_name: str, art: dict) -> str:
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    lines: list[str] = []
    for sec in art.get("required_sections", []):
        lines.append(sec)
        lines.append("")
        lines.append(f"Pipeline dry-run proof for `{pass_name}`.")
        lines.append(f"Generated at {now}.")
        lines.append("")
        # citation anchor — helps grounding probes
        lines.append("Reference: `pipeline/README.md:1`")
        lines.append("")
    # pad to satisfy min_lines / min_bytes deterministically
    min_lines = max(int(art.get("min_lines", 10)), 20)
    min_bytes = max(int(art.get("min_bytes", 200)), 500)
    i = 0
    while len(lines) < min_lines or sum(len(x) + 1 for x in lines) < min_bytes:
        lines.append(f"Synthetic dry-run line {i}.")
        i += 1
    return "\n".join(lines) + "\n"


def write_artifacts(pass_name: str, artifacts: list[dict], repo_root: Path) -> list[str]:
    written: list[str] = []
    for art in artifacts:
        rel = art["path"]
        path = repo_root / rel if not Path(rel).is_absolute() else Path(rel)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(synth_artifact_body(pass_name, art), encoding="utf-8")
        written.append(rel)
    return written


def emit_result(
    result_path: Path,
    *,
    pass_name: str,
    artifacts: list[str],
    citations: list[str],
    notes: str,
) -> None:
    body = {
        "pass": pass_name,
        "status": "completed",
        "artifacts": artifacts,
        "citations": citations,
        "intent_affirmed": True,
        "notes": notes,
    }
    text = (
        "dry-run stub log line\n"
        "<<AIRMENTOR_PASS_RESULT>>\n"
        + json.dumps(body, indent=2)
        + "\n<<END>>\n"
    )
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(text, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", required=True, help="prompt bundle path")
    ap.add_argument("--result", required=True, help="result file to write")
    args = ap.parse_args()

    bundle = Path(args.bundle)
    result = Path(args.result)
    repo_root = Path(__file__).resolve().parents[2]

    pass_name, artifacts = parse_bundle(bundle)
    print(f"[dry-run] pass={pass_name} artifacts={len(artifacts)}")
    written = write_artifacts(pass_name, artifacts, repo_root)
    citations = ["pipeline/README.md:1"]  # real existing line
    emit_result(
        result,
        pass_name=pass_name,
        artifacts=written,
        citations=citations,
        notes=f"dry-run stub wrote {len(written)} artifact(s)",
    )
    print(f"[dry-run] wrote result marker to {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
