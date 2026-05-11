"""Tests for the briefing pack context-handoff machinery."""
from __future__ import annotations

from pathlib import Path

from pipeline.orchestrator import briefing, db


def _seed(depends_on=(), state="pending", **extra) -> int:
    tid = db.insert_task(
        dag_run_id="run-brf",
        node_id=extra.get("node_id", "x"),
        pass_name=extra.get("pass_name", "p"),
        prompt_file=extra.get("prompt_file", "prompt.md"),
        depends_on=list(depends_on),
    )
    if state != "pending":
        db.set_task_state(tid, state)
    return tid


def test_record_outcome_writes_deterministic_markdown(tmp_path, monkeypatch):
    monkeypatch.setattr(briefing, "BRIEFING_ROOT", tmp_path / "brf")
    briefing.BRIEFING_ROOT.mkdir(parents=True, exist_ok=True)
    tid = _seed(node_id="root", pass_name="root-pass", state="completed")
    db.update_task_fields(tid, result_json='{"pass":"root-pass","status":"completed","artifacts":["a.md"],"citations":["x.ts:1"],"intent_affirmed":true,"notes":"done"}')
    db.record_validator_result(
        task_id=tid, attempt=1, check_name="structured_exit",
        passed=True, severity="info", detail={"ok": True},
    )
    path = briefing.record_outcome(task_id=tid)
    assert path.is_file()
    body = path.read_text()
    assert "# Briefing: root" in body
    assert "## Intent" not in body or "Intent" in body
    assert "## Structured result" in body
    assert "root-pass" in body
    assert "structured_exit" in body


def test_build_pack_for_concats_ancestor_briefings(tmp_path, monkeypatch):
    monkeypatch.setattr(briefing, "BRIEFING_ROOT", tmp_path / "brf")
    briefing.BRIEFING_ROOT.mkdir(parents=True, exist_ok=True)
    a = _seed(node_id="a", pass_name="a-pass", state="completed")
    b = _seed(node_id="b", pass_name="b-pass", state="completed")
    db.update_task_fields(a, result_json='{"pass":"a-pass","status":"completed","artifacts":[],"citations":[],"intent_affirmed":true,"notes":"from a"}')
    db.update_task_fields(b, result_json='{"pass":"b-pass","status":"completed","artifacts":[],"citations":[],"intent_affirmed":true,"notes":"from b"}')
    briefing.record_outcome(task_id=a)
    briefing.record_outcome(task_id=b)

    child = _seed(node_id="c", depends_on=["a", "b"], pass_name="c-pass")
    pack = briefing.build_pack_for(child)
    assert pack is not None
    assert pack.is_file()
    text = pack.read_text()
    assert "from a" in text
    assert "from b" in text
    assert "Ancestors: a, b" in text


def test_build_pack_for_returns_none_when_ancestors_incomplete(tmp_path, monkeypatch):
    monkeypatch.setattr(briefing, "BRIEFING_ROOT", tmp_path / "brf")
    briefing.BRIEFING_ROOT.mkdir(parents=True, exist_ok=True)
    a = _seed(node_id="a", state="pending")   # not completed
    child = _seed(node_id="c", depends_on=["a"])
    pack = briefing.build_pack_for(child)
    assert pack is None
