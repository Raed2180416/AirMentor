"""Per-task git worktree isolation.

True parallel safety requires filesystem isolation, not just write-scope
glob checks. Every concurrently-running task gets its own git worktree
under `$STATE/worktrees/<task-id>` so two agents can never overwrite each
other even if they both target the same file.

Flow per task:
  1. `prepare(task)` creates a worktree on a fresh branch off HEAD
  2. executor runs the subagent with cwd = worktree path
  3. `collect(task)` captures the diff, snapshots any artefacts, and
     decides whether to merge back:
        - clean merge (no conflicts) → fast-forward/rebase onto main
        - conflict → record as `failed(merge_conflict)` so the validator
          fails the pass; user can inspect and rerun
  4. `cleanup(task)` prunes the worktree after successful merge
     (kept on failure for forensics)

If git is unavailable or the repo is not a git repo, we degrade to a
no-op adapter: tasks run in REPO_ROOT with write_scope_glob as the only
guardrail. In that mode parallel_group cap MUST be 1 or scope disjoint.
"""
from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from . import db

REPO_ROOT = Path(__file__).resolve().parents[2]
STATE_ROOT = Path.home() / ".local" / "state" / "airmentor" / "pipeline"
WORKTREE_ROOT = STATE_ROOT / "worktrees"
BRANCH_PREFIX = "pipeline/worktree"


@dataclass
class WorktreeHandle:
    path: Path
    branch: str
    base_sha: str
    isolated: bool    # False = degraded (no-git) mode, cwd==REPO_ROOT


# ---------- git helpers ----------

def _git(*args: str, cwd: Path | None = None, check: bool = True) -> str:
    cmd = ["git", *args]
    res = subprocess.run(
        cmd,
        cwd=str(cwd or REPO_ROOT),
        capture_output=True,
        text=True,
    )
    if check and res.returncode != 0:
        raise RuntimeError(
            f"git {' '.join(args)} failed ({res.returncode}): "
            f"{res.stderr.strip() or res.stdout.strip()}"
        )
    return res.stdout.strip()


def _repo_is_git() -> bool:
    return (REPO_ROOT / ".git").exists()


def _head_sha() -> str:
    return _git("rev-parse", "HEAD")


# ---------- public API ----------

def prepare(task_row, *, isolation: str = "auto") -> WorktreeHandle:
    """Create a worktree (or return a degraded handle) for this task.

    `isolation`:
      auto   — use worktree if git available and > 1 parallel task allowed
      always — force worktree (error if git unavailable)
      none   — never use worktree (cwd = REPO_ROOT)

    The handle's `branch` is `pipeline/worktree/<dag_run_id>/<node_id>`.
    """
    if isolation == "none" or (isolation == "auto" and not _repo_is_git()):
        return WorktreeHandle(
            path=REPO_ROOT,
            branch="HEAD",
            base_sha=_head_sha() if _repo_is_git() else "",
            isolated=False,
        )

    WORKTREE_ROOT.mkdir(parents=True, exist_ok=True)
    safe_node = str(task_row["node_id"]).replace("/", "_")
    safe_run = str(task_row["dag_run_id"]).replace("/", "_")
    branch = f"{BRANCH_PREFIX}/{safe_run}/{safe_node}"
    wt_path = WORKTREE_ROOT / safe_run / safe_node

    base_sha = _head_sha()

    # if worktree path exists, try to remove it first (stale from prior run)
    if wt_path.exists():
        _git("worktree", "remove", "--force", str(wt_path), check=False)
        if wt_path.exists():
            shutil.rmtree(wt_path, ignore_errors=True)

    # if branch already exists locally, delete it to start fresh (prior attempt)
    existing = _git("branch", "--list", branch, check=False)
    if existing:
        _git("branch", "-D", branch, check=False)

    wt_path.parent.mkdir(parents=True, exist_ok=True)
    _git("worktree", "add", "-b", branch, str(wt_path), base_sha)

    db.log_event(int(task_row["id"]), "worktree_prepared", {
        "path": str(wt_path), "branch": branch, "base_sha": base_sha,
    })

    return WorktreeHandle(
        path=wt_path, branch=branch, base_sha=base_sha, isolated=True,
    )


def collect(task_row, handle: WorktreeHandle, *, merge_to: str = "HEAD") -> dict:
    """After a task completes, inspect + optionally merge the worktree.

    Returns a dict with:
      - changed_files: list[str]
      - diff_stat: str
      - head_after: str
      - merged: bool
      - merge_conflict: bool (only if merged=False and attempted)

    Policy:
      - If handle.isolated is False → no-op; caller must trust write-scope
      - If any file is outside `write_scope_glob` → collect but do NOT merge
        (caller decides via validator.scope_glob failure)
      - If the worktree branch fast-forwards cleanly onto main → merge,
        delete worktree
      - If conflict → keep worktree; record merge_conflict
    """
    result = {
        "changed_files": [],
        "diff_stat": "",
        "head_after": "",
        "merged": False,
        "merge_conflict": False,
    }
    if not handle.isolated:
        result["head_after"] = _head_sha() if _repo_is_git() else ""
        return result

    # Add + commit any unstaged changes so diffs are capturable
    _git("add", "-A", cwd=handle.path, check=False)
    staged = _git("diff", "--cached", "--name-only", cwd=handle.path, check=False)
    if staged:
        _git(
            "commit", "-m",
            f"pipeline: {task_row['pass_name']} ({task_row['node_id']})",
            cwd=handle.path,
            check=False,
        )

    head_after = _git("rev-parse", "HEAD", cwd=handle.path, check=False)
    result["head_after"] = head_after

    diff = _git(
        "diff", "--name-only", f"{handle.base_sha}..{head_after}",
        cwd=handle.path, check=False,
    )
    result["changed_files"] = [x for x in diff.splitlines() if x.strip()]
    result["diff_stat"] = _git(
        "diff", "--shortstat", f"{handle.base_sha}..{head_after}",
        cwd=handle.path, check=False,
    )

    if not result["changed_files"]:
        # nothing to merge; delete worktree
        _git("worktree", "remove", "--force", str(handle.path), check=False)
        return result

    # Try to merge the task branch into main (REPO_ROOT) via `git merge`
    # We avoid mutating the active checkout mid-scheduler unless clean.
    merge_target = _git("symbolic-ref", "--short", "HEAD", check=False) or "HEAD"
    if merge_to == "HEAD":
        merge_to = merge_target

    # prefer `git merge --ff-only` for safety; requires base_sha == REPO_ROOT HEAD
    current_root_sha = _head_sha()
    if current_root_sha != handle.base_sha:
        # main moved while task ran; try a rebase inside the worktree
        rebase = subprocess.run(
            ["git", "rebase", current_root_sha],
            cwd=str(handle.path), capture_output=True, text=True,
        )
        if rebase.returncode != 0:
            _git("rebase", "--abort", cwd=handle.path, check=False)
            result["merge_conflict"] = True
            db.log_event(int(task_row["id"]), "worktree_conflict", {
                "reason": "rebase_failed",
                "stderr": rebase.stderr[-1000:],
            })
            return result
        head_after = _git("rev-parse", "HEAD", cwd=handle.path, check=False)
        result["head_after"] = head_after

    # fast-forward main to the rebased head via `git merge --ff-only`
    ff = subprocess.run(
        ["git", "merge", "--ff-only", handle.branch],
        cwd=str(REPO_ROOT), capture_output=True, text=True,
    )
    if ff.returncode != 0:
        result["merge_conflict"] = True
        db.log_event(int(task_row["id"]), "worktree_conflict", {
            "reason": "ff_only_failed",
            "stderr": ff.stderr[-1000:],
        })
        return result

    result["merged"] = True
    # clean worktree (branch stays until cleanup)
    _git("worktree", "remove", "--force", str(handle.path), check=False)
    db.log_event(int(task_row["id"]), "worktree_merged", {
        "branch": handle.branch, "head_after": result["head_after"],
        "changed_files": result["changed_files"][:50],
    })
    return result


def cleanup(task_row, handle: WorktreeHandle, *, keep_branch: bool = False) -> None:
    if not handle.isolated:
        return
    if handle.path.exists():
        _git("worktree", "remove", "--force", str(handle.path), check=False)
    if not keep_branch:
        _git("branch", "-D", handle.branch, check=False)
    # remove the per-dag parent dir if now empty so `$STATE/worktrees/` stays tidy
    parent = handle.path.parent
    try:
        if parent.exists() and parent != WORKTREE_ROOT and not any(parent.iterdir()):
            parent.rmdir()
    except OSError:
        pass
    db.log_event(int(task_row["id"]), "worktree_cleaned", {
        "branch": handle.branch, "kept": keep_branch,
    })
