"""Shared pytest fixtures. Isolates DB per test via a temp path."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest


# Ensure repo root is on sys.path so `import pipeline` works under pytest.
REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path, monkeypatch):
    """Each test gets its own fresh SQLite DB."""
    db_file = tmp_path / "pipeline.db"
    monkeypatch.setenv("AIRMENTOR_PIPELINE_DB", str(db_file))
    # DAG materialisation verifies that all referenced files are tracked in
    # git so that production runs are reproducible from a clean checkout.
    # Test DAGs legitimately live under pytest's tmp_path (never tracked),
    # so opt into the documented dev-only bypass for every test. Tests that
    # want to exercise the real tracking check can monkeypatch it back to
    # "0" explicitly.
    monkeypatch.setenv("AIRMENTOR_DAG_ALLOW_UNTRACKED", "1")
    # pipeline.orchestrator.db resolves DEFAULT_DB_PATH at import, so force refresh
    from pipeline.orchestrator import db
    monkeypatch.setattr(db, "DEFAULT_DB_PATH", db_file, raising=False)
    # close any cached connection from previous tests
    try:
        db.close_conn()
    except Exception:
        pass
    db.migrate()
    yield
    try:
        db.close_conn()
    except Exception:
        pass
