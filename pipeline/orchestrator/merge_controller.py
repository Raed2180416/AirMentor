"""Merge controller.

Serialises writes to shared ledger files so parallel disjoint-scope passes
cannot corrupt them. Uses SQLite merge_locks table + a small file-level advisory
lock as a defense-in-depth belt-and-suspenders.

Usage:

    with merge_lock("audit-map/23-coverage/coverage-ledger.md", holder="dag-run:node"):
        # perform the write
        ...

Locks expire by TTL so a crashed holder cannot block forever.
"""
from __future__ import annotations

import contextlib
import fcntl
import os
import time
from pathlib import Path

from . import db

REPO_ROOT = Path(__file__).resolve().parents[2]
LOCK_DIR = Path.home() / ".local" / "state" / "airmentor" / "merge-locks"
LOCK_DIR.mkdir(parents=True, exist_ok=True)


class MergeLockError(RuntimeError):
    pass


@contextlib.contextmanager
def merge_lock(resource: str, *, holder: str, ttl_s: int = 600,
               wait_s: int = 300, poll_s: int = 2):
    """DB-backed + fcntl file lock. Raises MergeLockError on timeout."""
    fpath = LOCK_DIR / _safe_name(resource)
    fpath.touch(exist_ok=True)
    fd = os.open(str(fpath), os.O_RDWR)
    try:
        # 1. file-level exclusive lock (blocks other processes on same host)
        deadline = time.time() + wait_s
        acquired_file = False
        while time.time() < deadline:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                acquired_file = True
                break
            except BlockingIOError:
                time.sleep(poll_s)
        if not acquired_file:
            raise MergeLockError(
                f"failed to acquire file lock for {resource} within {wait_s}s"
            )
        # 2. db-level lock (visible across hosts / non-flock-aware FS)
        while time.time() < deadline:
            if db.acquire_merge_lock(resource, holder, ttl_s=ttl_s):
                break
            time.sleep(poll_s)
        else:
            fcntl.flock(fd, fcntl.LOCK_UN)
            raise MergeLockError(
                f"failed to acquire db lock for {resource} within {wait_s}s"
            )
        try:
            yield
        finally:
            db.release_merge_lock(resource, holder)
    finally:
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        except Exception:
            pass
        os.close(fd)


def _safe_name(resource: str) -> str:
    return resource.replace("/", "__").replace("\\", "__")[:240] + ".lock"
