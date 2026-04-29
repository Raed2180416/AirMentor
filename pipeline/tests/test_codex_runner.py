from __future__ import annotations

import json
import subprocess

from pipeline.orchestrator import codex_runner


def test_codex_runner_maps_max_effort_to_xhigh_for_cli(tmp_path, monkeypatch):
    captured: dict[str, list[str]] = {}

    def fake_run(argv, **kwargs):
        captured["argv"] = argv
        return subprocess.CompletedProcess(
            argv,
            0,
            stdout=json.dumps({"type": "session.created", "session_id": "sess_test"}) + "\n",
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    codex_runner.run(
        prompt_text="do work",
        cwd=tmp_path,
        model="gpt-5.3-codex",
        reasoning_effort="max",
    )

    assert 'model_reasoning_effort="xhigh"' in captured["argv"]
    assert 'model_reasoning_effort="max"' not in captured["argv"]
