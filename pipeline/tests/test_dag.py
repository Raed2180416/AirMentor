"""Tests for DAG loader + materialisation."""
from __future__ import annotations

from pathlib import Path

import pytest

from pipeline.orchestrator import dag as dag_mod, db


def _write_dag(tmp_path: Path, body: str) -> Path:
    p = tmp_path / "dag.yaml"
    p.write_text(body, encoding="utf-8")
    return p


def test_load_and_materialise(tmp_path):
    prompt = tmp_path / "prompt.md"
    prompt.write_text("# x\n", encoding="utf-8")
    body = f"""
defaults:
  context: test
nodes:
  - id: a
    pass: demo-pass
    prompt_file: {prompt}
    priority: 90
  - id: b
    pass: demo-pass
    prompt_file: {prompt}
    depends_on: [a]
"""
    dag_file = _write_dag(tmp_path, body)
    spec = dag_mod.load_dag(dag_file)
    assert len(spec.nodes) == 2
    assert spec.nodes[0].priority == 90

    dag_mod.materialise(spec)
    tasks = db.list_tasks(spec.dag_run_id)
    states = {t["node_id"]: t["state"] for t in tasks}
    # "a" has no deps -> ready immediately; "b" waits
    assert states["a"] == "ready"
    assert states["b"] == "pending"


def test_cycle_detection(tmp_path):
    prompt = tmp_path / "p.md"
    prompt.write_text("x", encoding="utf-8")
    body = f"""
nodes:
  - id: a
    pass: x
    prompt_file: {prompt}
    depends_on: [b]
  - id: b
    pass: x
    prompt_file: {prompt}
    depends_on: [a]
"""
    dag_file = _write_dag(tmp_path, body)
    with pytest.raises(ValueError):
        dag_mod.load_dag(dag_file)


def test_unknown_dependency(tmp_path):
    prompt = tmp_path / "p.md"
    prompt.write_text("x", encoding="utf-8")
    body = f"""
nodes:
  - id: a
    pass: x
    prompt_file: {prompt}
    depends_on: [ghost]
"""
    dag_file = _write_dag(tmp_path, body)
    with pytest.raises(ValueError):
        dag_mod.load_dag(dag_file)


def test_materialise_idempotent(tmp_path):
    prompt = tmp_path / "p.md"
    prompt.write_text("x", encoding="utf-8")
    body = f"""
nodes:
  - id: only
    pass: x
    prompt_file: {prompt}
"""
    dag_file = _write_dag(tmp_path, body)
    spec = dag_mod.load_dag(dag_file)
    dag_mod.materialise(spec)
    dag_mod.materialise(spec)
    tasks = db.list_tasks(spec.dag_run_id)
    assert len(tasks) == 1
