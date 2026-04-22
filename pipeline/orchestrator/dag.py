"""DAG loader and scheduler.

YAML schema:

  dag_run_id: optional-str     # default: <sha8>-<timestamp>
  defaults:
    context: pipeline
    idle_timeout_s: 1800
    hard_timeout_s: 14400
    max_attempts: 4
  nodes:
    - id: inventory
      pass: inventory-pass
      task_class: structured
      risk_class: medium
      prompt_file: audit-map/20-prompts/inventory-pass.md
      intent_file: pipeline/agents/manifests/inventory.intent.yaml
      manifest_file: pipeline/agents/manifests/inventory.artifacts.yaml
      write_scope_glob: 'audit-map/**;pipeline/**'
      parallel_group: read-only-waves   # null = serial
      depends_on: []
      priority: 80

  merges:                       # optional: serial merge nodes
    - after_group: read-only-waves
      node:
        id: merge-read-only
        pass: merge-controller
        prompt_file: ...
"""
from __future__ import annotations

import datetime as dt
import hashlib
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from . import db

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass
class NodeSpec:
    id: str
    pass_name: str
    prompt_file: str
    context: str = "pipeline"
    task_class: str = "structured"
    risk_class: str = "medium"
    reasoning_effort: str = "high"
    require_provider: str | None = None
    requested_model: str | None = None
    intent_file: str | None = None
    manifest_file: str | None = None
    write_scope_glob: str = "**"
    parallel_group: str | None = None
    depends_on: list[str] = field(default_factory=list)
    priority: int = 50
    max_attempts: int = 4
    idle_timeout_s: int = 1800
    hard_timeout_s: int = 14400


@dataclass
class DagSpec:
    dag_run_id: str
    dag_file: Path
    nodes: list[NodeSpec]


def _sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def load_dag(path: Path) -> DagSpec:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    defaults = data.get("defaults") or {}
    raw_nodes = data.get("nodes") or []
    explicit_id = data.get("dag_run_id")
    if explicit_id:
        dag_run_id = str(explicit_id)
    else:
        digest = _sha256_file(path)[:8]
        ts = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        dag_run_id = f"{path.stem}-{digest}-{ts}"

    nodes: list[NodeSpec] = []
    seen: set[str] = set()
    for raw in raw_nodes:
        nid = str(raw["id"])
        if nid in seen:
            raise ValueError(f"duplicate node id: {nid}")
        seen.add(nid)
        merged: dict[str, Any] = {**defaults, **raw}
        nodes.append(
            NodeSpec(
                id=nid,
                pass_name=str(merged["pass"]),
                prompt_file=str(merged["prompt_file"]),
                context=str(merged.get("context", "pipeline")),
                task_class=str(merged.get("task_class", "structured")),
                risk_class=str(merged.get("risk_class", "medium")),
                reasoning_effort=str(merged.get("reasoning_effort", "high")),
                require_provider=merged.get("require_provider"),
                requested_model=merged.get("requested_model"),
                intent_file=merged.get("intent_file"),
                manifest_file=merged.get("manifest_file"),
                write_scope_glob=str(merged.get("write_scope_glob", "**")),
                parallel_group=merged.get("parallel_group"),
                depends_on=[str(d) for d in (merged.get("depends_on") or [])],
                priority=int(merged.get("priority", 50)),
                max_attempts=int(merged.get("max_attempts", 4)),
                idle_timeout_s=int(merged.get("idle_timeout_s", 1800)),
                hard_timeout_s=int(merged.get("hard_timeout_s", 14400)),
            )
        )

    # validate: every dep references a known node id
    for n in nodes:
        for d in n.depends_on:
            if d not in seen:
                raise ValueError(f"node {n.id} depends on unknown node {d}")

    # topological sanity: detect cycles
    if _has_cycle(nodes):
        raise ValueError("DAG contains a cycle")

    return DagSpec(dag_run_id=dag_run_id, dag_file=path, nodes=nodes)


def _has_cycle(nodes: list[NodeSpec]) -> bool:
    ids = {n.id for n in nodes}
    adj = {n.id: [d for d in n.depends_on if d in ids] for n in nodes}
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {nid: WHITE for nid in ids}

    def visit(nid: str) -> bool:
        if color[nid] == GRAY:
            return True
        if color[nid] == BLACK:
            return False
        color[nid] = GRAY
        for m in adj[nid]:
            if visit(m):
                return True
        color[nid] = BLACK
        return False

    return any(visit(nid) for nid in ids)


def _git_tracked_paths(paths: list[str]) -> set[str]:
    """Return subset of `paths` that are tracked in git (`ls-files` hit).

    Runs from REPO_ROOT. Unknown/untracked paths are absent from the return set.
    If the repo is not a git repo (or `git` unavailable), returns `set(paths)`
    so the check degrades open instead of blocking non-git test fixtures.
    """
    if not paths:
        return set()
    if not (REPO_ROOT / ".git").exists():
        return set(paths)
    try:
        # --error-unmatch would be stricter but needs one call per path.
        # ls-files with the list returns only tracked matches; we diff against
        # the input to find the missing set.
        res = subprocess.run(
            ["git", "ls-files", "--error-unmatch", "-z", "--", *paths],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=False,
            check=False,
        )
        tracked = {p for p in res.stdout.decode("utf-8", "replace").split("\0") if p}
        return tracked
    except (FileNotFoundError, OSError):
        return set(paths)


def _verify_dag_files_tracked(nodes: list[NodeSpec]) -> None:
    """Round-11 guard: every prompt_file / intent_file / manifest_file must be
    tracked in git at DAG registration time. Prevents the failure mode where a
    DAG spec references files that live only in the working tree as untracked
    paths, which are silently lost on any `git checkout`, `git reset`, or stash
    pop - exactly the class of bug that destroyed the overnight-dag-9f3b5b7d
    pipeline mid-run in April 2026.

    Escape hatch: set `AIRMENTOR_DAG_ALLOW_UNTRACKED=1` in env for dev/testing
    against fixture DAGs that intentionally point to untracked stubs.
    """
    if os.environ.get("AIRMENTOR_DAG_ALLOW_UNTRACKED") == "1":
        return
    # Collect every referenced path from every node.
    referenced: list[str] = []
    for n in nodes:
        for attr in ("prompt_file", "intent_file", "manifest_file"):
            p = getattr(n, attr, None)
            if p:
                referenced.append(str(p))
    if not referenced:
        return
    # de-dupe while preserving input order for stable error messages
    seen: set[str] = set()
    unique: list[str] = []
    for p in referenced:
        if p not in seen:
            seen.add(p)
            unique.append(p)
    tracked = _git_tracked_paths(unique)
    untracked = [p for p in unique if p not in tracked]
    if untracked:
        examples = "\n".join(f"  - {p}" for p in untracked[:10])
        extra = f"\n  ... and {len(untracked) - 10} more" if len(untracked) > 10 else ""
        raise ValueError(
            "DAG references "
            f"{len(untracked)} file(s) not tracked in git. Commit these paths "
            "before registering the DAG so the pipeline is reproducible and "
            "survives a clean git checkout:\n"
            f"{examples}{extra}\n"
            "Set AIRMENTOR_DAG_ALLOW_UNTRACKED=1 to bypass (dev only)."
        )


def materialise(dag: DagSpec) -> None:
    """Insert every node as a task row (idempotent per dag_run_id).

    Round-11 guard: every referenced prompt/intent/manifest path must be
    git-tracked at registration time (see `_verify_dag_files_tracked`).
    """
    _verify_dag_files_tracked(dag.nodes)
    db.register_run(
        dag_run_id=dag.dag_run_id,
        dag_file=str(dag.dag_file),
        dag_sha256=_sha256_file(dag.dag_file),
    )
    for n in dag.nodes:
        existing = db.get_task_by_node(dag.dag_run_id, n.id)
        if existing:
            continue
        db.insert_task(
            dag_run_id=dag.dag_run_id,
            node_id=n.id,
            pass_name=n.pass_name,
            prompt_file=n.prompt_file,
            context=n.context,
            task_class=n.task_class,
            risk_class=n.risk_class,
            reasoning_effort=n.reasoning_effort,
            require_provider=n.require_provider,
            requested_model=n.requested_model,
            intent_file=n.intent_file,
            manifest_file=n.manifest_file,
            write_scope_glob=n.write_scope_glob,
            parallel_group=n.parallel_group,
            depends_on=n.depends_on,
            priority=n.priority,
            max_attempts=n.max_attempts,
            idle_timeout_s=n.idle_timeout_s,
            hard_timeout_s=n.hard_timeout_s,
        )
    # seed-nodes (no deps) go ready immediately
    db.mark_ready_if_deps_done(dag.dag_run_id)
