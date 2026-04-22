"""Grounding probe — anti-hallucination check.

For every `file:line` or `file:start-end` citation the subagent claims, verify:
- the file exists on disk
- the referenced line range is within the file's line count

Citations failing these checks are recorded; if any fail the task is flagged
failed regardless of exit marker status.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

_CITE_RE = re.compile(
    r"""
    (?P<path>[A-Za-z0-9_./\-]+\.(?:
        ts|tsx|js|jsx|mjs|cjs|
        py|pyi|pyx|
        sh|bash|zsh|
        yaml|yml|toml|ini|cfg|conf|env|
        md|mdx|rst|txt|
        sql|
        json|json5|jsonc|jsonl|ndjson|
        rs|go|c|h|cpp|hpp|cc|hh|java|kt|swift|rb|php|cs|scala|
        html|htm|css|scss|sass|less|svg|xml|
        lock|dockerfile|
        log|csv|tsv|out|err|diff|patch
    ))
    :
    (?P<start>\d+)
    (?:-(?P<end>\d+))?
    """,
    re.VERBOSE | re.IGNORECASE,
)


@dataclass
class ProbeResult:
    citation: str
    path: str
    line_start: int | None
    line_end: int | None
    exists_on_disk: bool
    lines_valid: bool

    @property
    def ok(self) -> bool:
        return self.exists_on_disk and self.lines_valid


def _resolve(path: str) -> Path:
    p = Path(path)
    if p.is_absolute():
        return p
    return REPO_ROOT / path


def probe_citation(citation: str) -> ProbeResult:
    m = _CITE_RE.search(citation)
    if not m:
        return ProbeResult(
            citation=citation,
            path=citation,
            line_start=None,
            line_end=None,
            exists_on_disk=False,
            lines_valid=False,
        )
    path = m.group("path")
    start = int(m.group("start"))
    end = int(m.group("end")) if m.group("end") else start
    abs_path = _resolve(path)
    exists = abs_path.is_file()
    lines_valid = False
    if exists:
        try:
            # cheap line count
            with abs_path.open("rb") as fh:
                total = sum(1 for _ in fh)
            lines_valid = 1 <= start <= end <= total
        except OSError:
            lines_valid = False
    return ProbeResult(
        citation=citation,
        path=path,
        line_start=start,
        line_end=end,
        exists_on_disk=exists,
        lines_valid=lines_valid,
    )


def probe_all(citations: list[str]) -> list[ProbeResult]:
    return [probe_citation(c) for c in citations]


def failing(results: list[ProbeResult]) -> list[ProbeResult]:
    return [r for r in results if not r.ok]


def extract_citations_from_text(text: str) -> list[str]:
    """Greedy extraction of file:line citations from arbitrary text.

    Used as fallback if the model's structured citations list is empty.
    """
    seen: set[str] = set()
    out: list[str] = []
    for m in _CITE_RE.finditer(text):
        key = m.group(0)
        if key not in seen:
            seen.add(key)
            out.append(key)
    return out
