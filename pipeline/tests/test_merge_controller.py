"""Tests for merge-controller file+DB lock."""
from __future__ import annotations

import pytest

from pipeline.orchestrator import merge_controller


def test_lock_roundtrip():
    with merge_controller.merge_lock("res-a", holder="h1", ttl_s=30, wait_s=2):
        pass  # enters + exits cleanly


def test_lock_contended_raises(monkeypatch):
    from pipeline.orchestrator import db
    assert db.acquire_merge_lock("res-b", "other-holder", ttl_s=60) is True
    # Another holder must fail quickly
    with pytest.raises(merge_controller.MergeLockError):
        with merge_controller.merge_lock(
            "res-b", holder="me", ttl_s=30, wait_s=1, poll_s=1
        ):
            pass
    db.release_merge_lock("res-b", "other-holder")
