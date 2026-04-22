"""Tests for the validator stack."""
from __future__ import annotations

from pathlib import Path

from pipeline.orchestrator import db, validator


def _seed(
    *,
    prompt_file: str = "pipeline/tests/_dummy.md",
    intent_file: str | None = None,
    write_scope_glob: str = "**",
    git_head_before: str | None = None,
    git_head_after: str | None = None,
) -> int:
    tid = db.insert_task(
        dag_run_id="run-v",
        node_id="v",
        pass_name="demo-pass",
        prompt_file=prompt_file,
        intent_file=intent_file,
        write_scope_glob=write_scope_glob,
    )
    db.update_task_fields(
        tid,
        git_head_before=git_head_before,
        git_head_after=git_head_after,
    )
    return tid


def _write_result(tmp_path: Path, body: str) -> Path:
    p = tmp_path / "result.txt"
    p.write_text(body, encoding="utf-8")
    return p


GOOD_RESULT = """
<<AIRMENTOR_PASS_RESULT>>
{"pass":"demo-pass","status":"completed","artifacts":[],"citations":[],"intent_affirmed":true,"notes":"ok"}
<<END>>
"""


def test_missing_marker_fails(tmp_path):
    tid = _seed()
    rf = _write_result(tmp_path, "no marker here")
    report = validator.validate(task_id=tid, attempt=1, result_file=rf)
    assert report.overall_passed is False
    # structured_exit should be first and failing
    assert report.checks[0].name == "structured_exit"
    assert report.checks[0].passed is False


def test_good_no_artifacts_passes_without_scope(tmp_path):
    tid = _seed()
    rf = _write_result(tmp_path, GOOD_RESULT)
    report = validator.validate(task_id=tid, attempt=1, result_file=rf)
    # With no expected artifacts and no git heads, scope check is info-warn,
    # grounding has no citations (warn), intent has no file (info).
    # Overall should pass because all hard gates are satisfied.
    assert report.overall_passed is True


def test_artifact_manifest_missing_file_fails(tmp_path):
    tid = _seed()
    db.set_expected_artifacts(tid, [
        {"path": "pipeline/tests/_definitely_missing.md",
         "min_lines": 5, "min_bytes": 50, "required_sections": []},
    ])
    rf = _write_result(tmp_path, GOOD_RESULT)
    report = validator.validate(task_id=tid, attempt=1, result_file=rf)
    assert report.overall_passed is False
    names = [c.name for c in report.checks if not c.passed]
    assert "artifact_manifest" in names


def test_artifact_manifest_thin_fails(tmp_path):
    target = validator.REPO_ROOT / "pipeline" / "tests" / "_thin.md"
    target.write_text("tiny", encoding="utf-8")
    try:
        tid = _seed()
        db.set_expected_artifacts(tid, [
            {"path": "pipeline/tests/_thin.md",
             "min_lines": 100, "min_bytes": 10000, "required_sections": []},
        ])
        rf = _write_result(tmp_path, GOOD_RESULT)
        report = validator.validate(task_id=tid, attempt=1, result_file=rf)
        assert report.overall_passed is False
    finally:
        target.unlink(missing_ok=True)


def test_artifact_required_section_missing(tmp_path):
    target = validator.REPO_ROOT / "pipeline" / "tests" / "_section.md"
    target.write_text("\n".join(["body"] * 40), encoding="utf-8")
    try:
        tid = _seed()
        db.set_expected_artifacts(tid, [
            {"path": "pipeline/tests/_section.md",
             "min_lines": 10, "min_bytes": 100,
             "required_sections": ["# Required"]},
        ])
        rf = _write_result(tmp_path, GOOD_RESULT)
        report = validator.validate(task_id=tid, attempt=1, result_file=rf)
        assert report.overall_passed is False
        failing = [c for c in report.checks if c.name == "artifact_manifest" and not c.passed]
        assert failing
    finally:
        target.unlink(missing_ok=True)


def test_grounding_rejects_bad_citation(tmp_path):
    body = """
<<AIRMENTOR_PASS_RESULT>>
{"pass":"demo-pass","status":"completed","artifacts":[],
 "citations":["pipeline/tests/_ghost.md:7"],
 "intent_affirmed":true,"notes":"ok"}
<<END>>
"""
    tid = _seed()
    rf = _write_result(tmp_path, body)
    report = validator.validate(task_id=tid, attempt=1, result_file=rf)
    assert report.overall_passed is False
    bad = [c for c in report.checks if c.name == "grounding" and not c.passed]
    assert bad
