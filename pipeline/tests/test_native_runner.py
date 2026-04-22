"""Tests for pipeline.orchestrator.native_runner.

We do NOT invoke real CLIs here. We monkeypatch `subprocess.run` so the
tested logic is the marker-synthesis, transcript-capture, and DB updates.
"""
from __future__ import annotations

import json
from pathlib import Path

from pipeline.orchestrator import db
from pipeline.orchestrator import native_runner
from pipeline.orchestrator import claude_runner, codex_runner, opencode_runner


def test_synthesise_marker_if_missing_adds_failed_marker():
    txt = "agent said some stuff"
    out = native_runner._synthesise_marker_if_missing(txt, "my-pass")
    assert "<<AIRMENTOR_PASS_RESULT>>" in out
    assert "<<END>>" in out
    j_start = out.index("<<AIRMENTOR_PASS_RESULT>>") + len("<<AIRMENTOR_PASS_RESULT>>")
    j_end = out.index("<<END>>")
    data = json.loads(out[j_start:j_end].strip())
    assert data["status"] == "failed"
    assert data["pass"] == "my-pass"
    assert data["intent_affirmed"] is False


def test_synthesise_marker_if_present_leaves_alone():
    txt = (
        "hello\n"
        "<<AIRMENTOR_PASS_RESULT>>\n"
        '{"pass":"x","status":"completed","artifacts":[],"citations":[],'
        '"intent_affirmed":true,"notes":""}\n'
        "<<END>>\n"
    )
    out = native_runner._synthesise_marker_if_missing(txt, "x")
    assert out.count("<<AIRMENTOR_PASS_RESULT>>") == 1
    assert out.count("<<END>>") == 1


def test_native_runner_writes_result_and_updates_session_id(tmp_path, monkeypatch):
    tid = db.insert_task(
        dag_run_id="run-nr",
        node_id="t",
        pass_name="nr-pass",
        prompt_file=str(tmp_path / "prompt.md"),
    )
    bundle = tmp_path / "bundle.md"
    bundle.write_text("do the thing")
    result = tmp_path / "result.txt"

    def fake_claude_run(**kwargs):
        return claude_runner.ClaudeResult(
            session_id="sess_123",
            transcript=(
                "I did the thing\n<<AIRMENTOR_PASS_RESULT>>\n"
                '{"pass":"nr-pass","status":"completed","artifacts":[],'
                '"citations":[],"intent_affirmed":true,"notes":"ok"}\n'
                "<<END>>\n"
            ),
            exit_code=0,
            stderr="",
            raw_events=[],
        )
    monkeypatch.setattr(claude_runner, "run", fake_claude_run)

    rc = native_runner.main.__wrapped__ if hasattr(native_runner.main, "__wrapped__") else None  # noqa: F841
    # invoke main() directly with argv
    argv = [
        "--task-id", str(tid),
        "--provider", "anthropic",
        "--model", "claude-sonnet-4-6",
        "--cwd", str(tmp_path),
        "--bundle", str(bundle),
        "--result", str(result),
    ]
    import sys
    monkeypatch.setattr(sys, "argv", ["native_runner", *argv])
    rc = native_runner.main()
    assert rc == 0
    assert result.is_file()
    body = result.read_text()
    assert "<<AIRMENTOR_PASS_RESULT>>" in body
    assert "sess_123" in body
    # DB got updated
    row = db.get_task(tid)
    assert row["arctic_session_id"] == "sess_123"


def test_native_runner_records_exception_and_still_writes_result(tmp_path, monkeypatch):
    tid = db.insert_task(
        dag_run_id="run-nrex",
        node_id="t",
        pass_name="nr-pass-ex",
        prompt_file=str(tmp_path / "prompt.md"),
    )
    bundle = tmp_path / "bundle.md"
    bundle.write_text("do the thing")
    result = tmp_path / "result.txt"

    def boom(**kwargs):
        raise RuntimeError("simulated infra failure")
    monkeypatch.setattr(codex_runner, "run", boom)

    import sys
    monkeypatch.setattr(sys, "argv", [
        "native_runner",
        "--task-id", str(tid),
        "--provider", "codex",
        "--model", "gpt-5.4",
        "--cwd", str(tmp_path),
        "--bundle", str(bundle),
        "--result", str(result),
    ])
    rc = native_runner.main()
    assert rc == 70
    assert "exception" in result.read_text()
