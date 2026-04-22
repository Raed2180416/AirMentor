"""Validator stack. Runs after every subagent attempt.

Checks, in order (short-circuits on hard fail):
 1. structured_exit      — parseable <<AIRMENTOR_PASS_RESULT>> block present
 2. artifact_manifest    — every declared expected artifact exists, min lines/bytes met,
                           required sections present
 3. scope_glob           — git diff touched only files matching write_scope_glob
 4. grounding            — every citation path+line resolves on disk
 5. intent_guard         — (optional, low-cost probe) intent_affirmed field is true AND
                           no file listed in intent.owner_files was renamed or deleted
"""
from __future__ import annotations

import fnmatch
import hashlib
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

import yaml

from . import db, grounding
from .contracts import PassResult, parse_result_from_file

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass
class CheckOutcome:
    name: str
    passed: bool
    severity: str  # error|warn|info
    detail: dict


def _count_lines_bytes(path: Path) -> tuple[int, int]:
    try:
        data = path.read_bytes()
    except OSError:
        return 0, 0
    return data.count(b"\n") + (0 if data.endswith(b"\n") or not data else 1), len(data)


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    try:
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                h.update(chunk)
    except OSError:
        return ""
    return h.hexdigest()


# ---------- individual checks ----------

def check_structured_exit(result_file: Path) -> tuple[CheckOutcome, PassResult | None]:
    pr = parse_result_from_file(result_file)
    if pr is None:
        return (
            CheckOutcome(
                "structured_exit", False, "error",
                {"reason": "missing_or_malformed_marker", "file": str(result_file)},
            ),
            None,
        )
    if pr.status != "completed":
        return (
            CheckOutcome(
                "structured_exit", False, "error",
                {"reason": "status_not_completed", "status": pr.status, "notes": pr.notes},
            ),
            pr,
        )
    if not pr.intent_affirmed:
        return (
            CheckOutcome(
                "structured_exit", False, "error",
                {"reason": "intent_not_affirmed", "notes": pr.notes},
            ),
            pr,
        )
    return CheckOutcome("structured_exit", True, "info", {"notes": pr.notes}), pr


def check_artifact_manifest(task_id: int) -> CheckOutcome:
    rows = db.list_expected_artifacts(task_id)
    if not rows:
        return CheckOutcome(
            "artifact_manifest", True, "info",
            {"reason": "no_expected_artifacts_declared"},
        )
    missing: list[dict] = []
    thin: list[dict] = []
    sections_missing: list[dict] = []
    for row in rows:
        rel_path = row["path"]
        abs_path = REPO_ROOT / rel_path if not Path(rel_path).is_absolute() else Path(rel_path)
        if not abs_path.is_file():
            missing.append({"path": rel_path})
            continue
        lines, bytes_ = _count_lines_bytes(abs_path)
        sha = _sha256(abs_path)
        db.record_produced_artifact(task_id, rel_path, bytes_, lines, sha)
        if lines < row["min_lines"] or bytes_ < row["min_bytes"]:
            thin.append(
                {
                    "path": rel_path,
                    "lines": lines,
                    "bytes": bytes_,
                    "min_lines": row["min_lines"],
                    "min_bytes": row["min_bytes"],
                }
            )
            continue
        required = json.loads(row["required_sections"]) if row["required_sections"] else []
        if required:
            text = abs_path.read_text(encoding="utf-8", errors="replace")
            missing_sections = [
                s for s in required if s.strip() and s.strip() not in text
            ]
            if missing_sections:
                sections_missing.append({"path": rel_path, "missing_sections": missing_sections})
    passed = not (missing or thin or sections_missing)
    return CheckOutcome(
        "artifact_manifest",
        passed,
        "error" if not passed else "info",
        {
            "missing": missing,
            "thin": thin,
            "sections_missing": sections_missing,
        },
    )


def _git_head() -> str | None:
    try:
        return (
            subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=str(REPO_ROOT), stderr=subprocess.DEVNULL
            )
            .decode()
            .strip()
        )
    except Exception:
        return None


def _git_diff_files(base: str, head: str) -> list[str]:
    try:
        out = subprocess.check_output(
            ["git", "diff", "--name-only", base, head],
            cwd=str(REPO_ROOT),
            stderr=subprocess.DEVNULL,
        ).decode()
    except Exception:
        return []
    return [line.strip() for line in out.splitlines() if line.strip()]


def _git_pipeline_commits(base: str, head: str, node_id: str) -> list[str]:
    """Return SHAs of commits on base..head whose message references node_id.

    The orchestrator's worktree merge path stamps each task's commit with a
    message of the form `pipeline: <node_id> (<node_id>)`. Out-of-band commits
    authored on main between task claim and task finish (e.g. principal-architect
    ongoing work) do NOT carry this marker. Filtering by node_id isolates the
    task's own diff from interleaved parallel main-branch commits.
    """
    try:
        out = subprocess.check_output(
            ["git", "log", "--format=%H %s", f"{base}..{head}"],
            cwd=str(REPO_ROOT),
            stderr=subprocess.DEVNULL,
        ).decode()
    except Exception:
        return []
    commits: list[str] = []
    for line in out.splitlines():
        parts = line.split(" ", 1)
        if len(parts) == 2 and f"pipeline: {node_id}" in parts[1]:
            commits.append(parts[0].strip())
    return commits


def _git_diff_files_for_commits(commits: list[str]) -> list[str]:
    """Union of files touched by the given commits."""
    all_files: set[str] = set()
    for sha in commits:
        try:
            out = subprocess.check_output(
                ["git", "diff-tree", "--no-commit-id", "--name-only", "-r", sha],
                cwd=str(REPO_ROOT),
                stderr=subprocess.DEVNULL,
            ).decode()
        except Exception:
            continue
        for line in out.splitlines():
            file = line.strip()
            if file:
                all_files.add(file)
    return sorted(all_files)


def check_scope_glob(task_id: int) -> CheckOutcome:
    row = db.get_task(task_id)
    if not row:
        return CheckOutcome("scope_glob", False, "error", {"reason": "no_task"})
    scope = row["write_scope_glob"] or "**"
    base = row["git_head_before"]
    head = row["git_head_after"] or _git_head()
    node_id = row["node_id"] or ""
    if not base or not head:
        return CheckOutcome(
            "scope_glob", True, "warn",
            {"reason": "git_head_missing", "base": base, "head": head},
        )
    if base == head:
        return CheckOutcome(
            "scope_glob", True, "info",
            {"reason": "no_commits", "base": base, "head": head},
        )
    globs = [g.strip() for g in scope.split(";") if g.strip()]
    # Round-8 fix (2026-04-22): previously `git diff base..head` included
    # out-of-band commits that landed on main between task claim and task
    # finish (e.g. principal-architect parallel commits). Those commits do
    # not carry the `pipeline: <node_id>` marker, so filter to pipeline
    # commits only. Fallback to full diff when no pipeline commits found
    # (preserves behaviour for tasks that deliberately edit files outside
    # their worktree via other mechanisms).
    pipeline_commits = _git_pipeline_commits(base, head, node_id)
    if pipeline_commits:
        changed = _git_diff_files_for_commits(pipeline_commits)
        scope_mode = "pipeline_commits_only"
    else:
        changed = _git_diff_files(base, head)
        scope_mode = "full_diff_fallback_no_pipeline_marker"
    violators: list[str] = []
    for f in changed:
        if not any(fnmatch.fnmatch(f, g) for g in globs):
            violators.append(f)
    passed = not violators
    return CheckOutcome(
        "scope_glob",
        passed,
        "error" if not passed else "info",
        {
            "globs": globs,
            "changed": changed,
            "violators": violators,
            "scope_mode": scope_mode,
            "pipeline_commits": pipeline_commits,
        },
    )


def check_grounding(task_id: int, attempt: int, pr: PassResult) -> CheckOutcome:
    citations = list(pr.citations)
    # Fallback: also extract from result raw text
    citations.extend(grounding.extract_citations_from_text(pr.raw))
    # dedupe
    citations = list(dict.fromkeys(citations))
    if not citations:
        return CheckOutcome(
            "grounding", True, "warn",
            {"reason": "no_citations_claimed"},
        )
    probes = grounding.probe_all(citations)
    for p in probes:
        db.record_grounding_probe(
            task_id=task_id,
            attempt=attempt,
            citation=p.citation,
            path=p.path,
            line_start=p.line_start,
            line_end=p.line_end,
            exists_on_disk=p.exists_on_disk,
            lines_valid=p.lines_valid,
        )
    bad = grounding.failing(probes)
    passed = not bad
    return CheckOutcome(
        "grounding",
        passed,
        "error" if not passed else "info",
        {
            "total": len(probes),
            "failed": [
                {"citation": b.citation, "exists": b.exists_on_disk, "lines_valid": b.lines_valid}
                for b in bad
            ],
        },
    )


def check_intent_guard(task_id: int, pr: PassResult) -> CheckOutcome:
    row = db.get_task(task_id)
    if not row or not row["intent_file"]:
        return CheckOutcome("intent_guard", True, "info",
                            {"reason": "no_intent_file_declared"})
    intent_path = REPO_ROOT / row["intent_file"] if not Path(row["intent_file"]).is_absolute() else Path(row["intent_file"])
    if not intent_path.is_file():
        return CheckOutcome("intent_guard", False, "error",
                            {"reason": "intent_file_missing", "path": str(intent_path)})
    try:
        data = yaml.safe_load(intent_path.read_text(encoding="utf-8")) or {}
    except Exception as e:
        return CheckOutcome("intent_guard", False, "error",
                            {"reason": "intent_yaml_parse_error", "error": str(e)})
    owner_files = data.get("owner_files") or []
    missing: list[str] = []
    for f in owner_files:
        p = REPO_ROOT / f if not Path(f).is_absolute() else Path(f)
        if not p.exists():
            missing.append(f)
    passed = pr.intent_affirmed and not missing
    return CheckOutcome(
        "intent_guard",
        passed,
        "error" if not passed else "info",
        {
            "intent_affirmed": pr.intent_affirmed,
            "missing_owner_files": missing,
            "nonneg": data.get("nonneg", []),
            "purpose": data.get("purpose", ""),
        },
    )


# ---------- top-level runner ----------

@dataclass
class ValidationReport:
    overall_passed: bool
    checks: list[CheckOutcome]
    pass_result: PassResult | None


def validate(
    *,
    task_id: int,
    attempt: int,
    result_file: Path,
) -> ValidationReport:
    checks: list[CheckOutcome] = []

    # 1. structured exit (hard gate)
    exit_check, pr = check_structured_exit(result_file)
    checks.append(exit_check)
    db.record_validator_result(
        task_id=task_id, attempt=attempt, check_name=exit_check.name,
        passed=exit_check.passed, severity=exit_check.severity, detail=exit_check.detail,
    )
    if not exit_check.passed or pr is None:
        return ValidationReport(False, checks, pr)

    # 2. artifact manifest (hard gate)
    manifest_check = check_artifact_manifest(task_id)
    checks.append(manifest_check)
    db.record_validator_result(
        task_id=task_id, attempt=attempt, check_name=manifest_check.name,
        passed=manifest_check.passed, severity=manifest_check.severity,
        detail=manifest_check.detail,
    )
    if not manifest_check.passed:
        return ValidationReport(False, checks, pr)

    # 3. scope glob (hard gate if enabled)
    scope_check = check_scope_glob(task_id)
    checks.append(scope_check)
    db.record_validator_result(
        task_id=task_id, attempt=attempt, check_name=scope_check.name,
        passed=scope_check.passed, severity=scope_check.severity, detail=scope_check.detail,
    )
    if not scope_check.passed:
        return ValidationReport(False, checks, pr)

    # 4. grounding
    grounding_check = check_grounding(task_id, attempt, pr)
    checks.append(grounding_check)
    db.record_validator_result(
        task_id=task_id, attempt=attempt, check_name=grounding_check.name,
        passed=grounding_check.passed, severity=grounding_check.severity,
        detail=grounding_check.detail,
    )
    if not grounding_check.passed:
        return ValidationReport(False, checks, pr)

    # 5. intent guard
    intent_check = check_intent_guard(task_id, pr)
    checks.append(intent_check)
    db.record_validator_result(
        task_id=task_id, attempt=attempt, check_name=intent_check.name,
        passed=intent_check.passed, severity=intent_check.severity, detail=intent_check.detail,
    )
    if not intent_check.passed:
        return ValidationReport(False, checks, pr)

    return ValidationReport(True, checks, pr)
