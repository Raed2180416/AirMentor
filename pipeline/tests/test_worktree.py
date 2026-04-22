"""Tests for the per-task git-worktree isolation helper.

We exercise the real `git worktree` machinery on a temporary repo (not the
workspace repo) so these tests are hermetic.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from pipeline.orchestrator import db, worktree


def _init_tmp_repo(tmp_path: Path) -> Path:
    """Create a throwaway git repo with one initial commit."""
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", "--initial-branch=main"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.email", "bot@example"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.name", "bot"], cwd=repo, check=True)
    (repo / "README.md").write_text("hello\n")
    subprocess.run(["git", "add", "-A"], cwd=repo, check=True)
    subprocess.run(["git", "commit", "-qm", "init"], cwd=repo, check=True)
    return repo


def _seed_task(**overrides) -> dict:
    tid = db.insert_task(
        dag_run_id=overrides.get("dag_run_id", "run-wt"),
        node_id=overrides.get("node_id", "t1"),
        pass_name="p",
        prompt_file="nowhere.md",
    )
    return dict(db.get_task(tid))


def test_worktree_none_mode_returns_repo_root(tmp_path, monkeypatch):
    monkeypatch.setattr(worktree, "REPO_ROOT", tmp_path)
    task_row = _seed_task()
    wt = worktree.prepare(task_row, isolation="none")
    assert wt.isolated is False
    assert wt.path == tmp_path


def test_worktree_isolated_prepare_creates_branch_and_dir(tmp_path, monkeypatch):
    repo = _init_tmp_repo(tmp_path)
    monkeypatch.setattr(worktree, "REPO_ROOT", repo)
    monkeypatch.setattr(worktree, "WORKTREE_ROOT", tmp_path / "wt")
    task_row = _seed_task(dag_run_id="wt-run", node_id="wt-node")
    wt = worktree.prepare(task_row, isolation="always")
    assert wt.isolated is True
    assert wt.path.is_dir()
    assert wt.branch.startswith("pipeline/worktree/")
    # worktree should see the same README as main
    assert (wt.path / "README.md").is_file()


def test_worktree_collect_merges_clean_changes_back(tmp_path, monkeypatch):
    repo = _init_tmp_repo(tmp_path)
    monkeypatch.setattr(worktree, "REPO_ROOT", repo)
    monkeypatch.setattr(worktree, "WORKTREE_ROOT", tmp_path / "wt")
    task_row = _seed_task(dag_run_id="wt-merge", node_id="n1")
    wt = worktree.prepare(task_row, isolation="always")
    # simulate the agent doing work in the worktree
    (wt.path / "out.md").write_text("agent wrote this\n")
    info = worktree.collect(task_row, wt)
    assert info["merged"] is True
    assert "out.md" in info["changed_files"]
    # now the main repo should have that file
    assert (repo / "out.md").is_file()
    worktree.cleanup(task_row, wt)


def test_worktree_cleanup_idempotent(tmp_path, monkeypatch):
    repo = _init_tmp_repo(tmp_path)
    monkeypatch.setattr(worktree, "REPO_ROOT", repo)
    monkeypatch.setattr(worktree, "WORKTREE_ROOT", tmp_path / "wt")
    task_row = _seed_task(dag_run_id="wt-clean", node_id="n2")
    wt = worktree.prepare(task_row, isolation="always")
    worktree.cleanup(task_row, wt)
    worktree.cleanup(task_row, wt)  # second call must not raise
