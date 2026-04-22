"""Executor smoke tests that avoid launching tmux/ccs/codex.

We exercise the pure pieces: prompt composition, bundle write, wrapper script.
"""
from __future__ import annotations

from pathlib import Path

from pipeline.orchestrator import db, executor, router


def _seed_task(tmp_path: Path, intent: str | None = None, manifest: str | None = None) -> tuple[int, dict]:
    prompt = tmp_path / "prompt.md"
    prompt.write_text("# Do X\n\nRead audit-map/index.md and report.\n", encoding="utf-8")
    intent_path = None
    if intent:
        ip = tmp_path / "intent.yaml"
        ip.write_text(intent, encoding="utf-8")
        intent_path = str(ip)
    manifest_path = None
    if manifest:
        mp = tmp_path / "manifest.yaml"
        mp.write_text(manifest, encoding="utf-8")
        manifest_path = str(mp)
    tid = db.insert_task(
        dag_run_id="run-e",
        node_id="e",
        pass_name="smoke-pass",
        prompt_file=str(prompt),
        intent_file=intent_path,
        manifest_file=manifest_path,
        task_class="structured",
    )
    return tid, dict(db.get_task(tid))


def test_compose_prompt_contains_contract(tmp_path):
    tid, row = _seed_task(tmp_path)
    route = router.Route(
        slot="codex-05", provider="codex", account="codex-05",
        model="gpt-5.4-mini", reasoning_effort="high", reason="test",
        account_key="codex:juniorretard",
    )
    txt = executor._compose_prompt(row, route)
    assert "<<AIRMENTOR_PASS_RESULT>>" in txt
    assert "smoke-pass" in txt
    assert "## Route" in txt
    assert "## WRITE SCOPE" in txt


def test_bundle_and_wrapper_written(tmp_path, monkeypatch):
    # redirect state roots into tmp_path for isolation
    monkeypatch.setattr(executor, "STATE_ROOT", tmp_path)
    monkeypatch.setattr(executor, "LOG_ROOT", tmp_path / "logs")
    monkeypatch.setattr(executor, "BUNDLE_ROOT", tmp_path / "bundles")
    monkeypatch.setattr(executor, "RESULT_ROOT", tmp_path / "results")
    monkeypatch.setattr(executor, "WRAPPER_ROOT", tmp_path / "wrappers")
    for p in (
        executor.LOG_ROOT,
        executor.BUNDLE_ROOT,
        executor.RESULT_ROOT,
        executor.WRAPPER_ROOT,
    ):
        p.mkdir(parents=True, exist_ok=True)

    tid, row = _seed_task(tmp_path)
    route = router.Route(
        slot="native-codex-session", provider="native-codex",
        account="native-codex-session", model="gpt-5.4",
        reasoning_effort="high", reason="test",
    )
    bundle = executor._write_bundle(row, executor._compose_prompt(row, route))
    assert bundle.is_file()
    assert "## Route" in bundle.read_text()

    log_path = executor._log_file_for(row)
    result_path = executor._result_file_for(row)
    wrapper = executor._write_wrapper(
        task_row=row, task_id=tid, route=route,
        cwd=executor.REPO_ROOT,
        bundle_path=bundle, result_path=result_path, log_path=log_path,
    )
    assert wrapper.is_file()
    content = wrapper.read_text()
    # native-codex now goes through native_runner (session-aware JSON exec)
    assert "pipeline.orchestrator.native_runner" in content
    assert "session-start" in content
