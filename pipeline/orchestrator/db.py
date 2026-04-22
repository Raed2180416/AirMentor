"""SQLite access layer. WAL + short busy timeout + thread-safe per-connection.

Key contract: every write path uses transactions. Claim operations use the
`claim_pending_task` helper that atomically transitions state pending→claimed.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Sequence

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = Path(
    os.environ.get(
        "AIRMENTOR_PIPELINE_DB",
        str(Path.home() / ".local" / "state" / "airmentor" / "pipeline.db"),
    )
)
SCHEMA_PATH = REPO_ROOT / "pipeline" / "db" / "schema.sql"

_local = threading.local()


def db_path() -> Path:
    p = DEFAULT_DB_PATH
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(
        str(path),
        timeout=30.0,
        isolation_level=None,  # manual BEGIN/COMMIT
        check_same_thread=False,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 10000")
    return conn


def get_conn() -> sqlite3.Connection:
    c = getattr(_local, "conn", None)
    if c is None:
        c = _connect(db_path())
        _local.conn = c
    return c


def close_conn() -> None:
    c = getattr(_local, "conn", None)
    if c is not None:
        c.close()
        _local.conn = None


@contextmanager
def tx() -> Iterator[sqlite3.Connection]:
    """Manual transaction boundary."""
    conn = get_conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    else:
        conn.execute("COMMIT")


def init_schema() -> None:
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    conn = get_conn()
    conn.executescript(schema)


def migrate() -> None:
    """Idempotent migration runner. Safe to call many times."""
    init_schema()
    # Live-add columns for existing databases. PRAGMA table_info is safe.
    conn = get_conn()
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(slots)").fetchall()}
    if "pick_count" not in cols:
        conn.execute("ALTER TABLE slots ADD COLUMN pick_count INTEGER NOT NULL DEFAULT 0")


def increment_slot_pick(slot: str) -> None:
    """Bump the LRU counter when the router selects a slot. This causes the
    slot to rank lower on subsequent picks, spreading load across the fleet.
    """
    with tx() as conn:
        conn.execute(
            "UPDATE slots SET pick_count = COALESCE(pick_count, 0) + 1, "
            "last_used_at = datetime('now') WHERE slot = ?",
            (slot,),
        )


# ---------- task ops ----------

def insert_task(
    *,
    dag_run_id: str,
    node_id: str,
    pass_name: str,
    prompt_file: str,
    context: str = "pipeline",
    task_class: str = "structured",
    risk_class: str = "medium",
    reasoning_effort: str | None = None,
    require_provider: str | None = None,
    require_account_key: str | None = None,
    requested_model: str | None = None,
    intent_file: str | None = None,
    manifest_file: str | None = None,
    write_scope_glob: str = "**",
    parallel_group: str | None = None,
    depends_on: Sequence[str] = (),
    priority: int = 50,
    max_attempts: int = 4,
    idle_timeout_s: int = 1800,
    hard_timeout_s: int = 14400,
) -> int:
    with tx() as conn:
        cur = conn.execute(
            """
            INSERT INTO tasks (
                dag_run_id, node_id, pass_name, context, task_class, risk_class,
                reasoning_effort, require_provider, require_account_key,
                requested_model, prompt_file,
                intent_file, manifest_file, write_scope_glob, parallel_group,
                depends_on, priority, max_attempts, idle_timeout_s, hard_timeout_s
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                dag_run_id, node_id, pass_name, context, task_class, risk_class,
                reasoning_effort, require_provider, require_account_key,
                requested_model, prompt_file,
                intent_file, manifest_file, write_scope_glob, parallel_group,
                json.dumps(list(depends_on)), priority, max_attempts,
                idle_timeout_s, hard_timeout_s,
            ),
        )
        return int(cur.lastrowid)


def get_task(task_id: int) -> sqlite3.Row | None:
    row = get_conn().execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return row


def get_task_by_node(dag_run_id: str, node_id: str) -> sqlite3.Row | None:
    return (
        get_conn()
        .execute(
            "SELECT * FROM tasks WHERE dag_run_id = ? AND node_id = ?",
            (dag_run_id, node_id),
        )
        .fetchone()
    )


def list_tasks(dag_run_id: str) -> list[sqlite3.Row]:
    return list(
        get_conn()
        .execute(
            "SELECT * FROM tasks WHERE dag_run_id = ? ORDER BY priority DESC, id ASC",
            (dag_run_id,),
        )
        .fetchall()
    )


def mark_ready_if_deps_done(dag_run_id: str) -> int:
    """Promote pending tasks to ready if all deps completed.

    Returns number of promotions performed.
    """
    promoted = 0
    with tx() as conn:
        pending = conn.execute(
            "SELECT id, node_id, depends_on FROM tasks "
            "WHERE dag_run_id = ? AND state = 'pending'",
            (dag_run_id,),
        ).fetchall()
        if not pending:
            return 0
        done_nodes = {
            r["node_id"]
            for r in conn.execute(
                "SELECT node_id FROM tasks WHERE dag_run_id = ? "
                "AND state IN ('completed')",
                (dag_run_id,),
            ).fetchall()
        }
        for row in pending:
            deps = json.loads(row["depends_on"]) if row["depends_on"] else []
            if all(d in done_nodes for d in deps):
                conn.execute(
                    "UPDATE tasks SET state = 'ready', "
                    "updated_at = datetime('now') WHERE id = ?",
                    (row["id"],),
                )
                record_event(
                    conn, row["id"], "state_change",
                    {"from": "pending", "to": "ready"},
                )
                promoted += 1
    return promoted


def claim_next_ready(
    *,
    dag_run_id: str,
    allow_parallel_groups: Sequence[str] = (),
    busy_account_keys: Sequence[str] = (),
    group_capacity: int = 1,
) -> sqlite3.Row | None:
    """Atomically claim a single ready task.

    Ordering: higher priority first, then lower id.

    Guards applied, in order:
      1. `parallel_group` capacity — no more than `group_capacity` tasks in the
         same group may be in states {claimed, running, merging}. Groups listed
         in `allow_parallel_groups` bypass the single-concurrent default and
         honour `group_capacity`.
      2. `busy_account_keys` — tasks whose (pre-assigned) `account_key` is in
         this set are skipped. The router pre-fills `account_key` at pick time,
         but the orchestrator passes in keys currently in use by sibling
         tasks to guarantee we never run two tasks on the same arctic
         auth-source simultaneously (quota-clash safe).
    """
    busy_set = set(k for k in busy_account_keys if k)
    with tx() as conn:
        candidates = conn.execute(
            "SELECT * FROM tasks WHERE dag_run_id = ? AND state = 'ready' "
            "ORDER BY priority DESC, id ASC",
            (dag_run_id,),
        ).fetchall()
        for row in candidates:
            group = row["parallel_group"]
            if group:
                concurrent = conn.execute(
                    "SELECT COUNT(*) AS c FROM tasks "
                    "WHERE dag_run_id = ? AND parallel_group = ? "
                    "AND state IN ('claimed','running','merging')",
                    (dag_run_id, group),
                ).fetchone()["c"]
                cap = group_capacity if group in allow_parallel_groups else 1
                if concurrent >= cap:
                    continue
            if row["account_key"] and row["account_key"] in busy_set:
                continue
            # claim
            cur = conn.execute(
                "UPDATE tasks SET state='claimed', "
                "claimed_at = datetime('now'), "
                "updated_at = datetime('now'), "
                "attempt = attempt + 1 "
                "WHERE id = ? AND state = 'ready'",
                (row["id"],),
            )
            if cur.rowcount == 1:
                record_event(conn, row["id"], "state_change",
                             {"from": "ready", "to": "claimed"})
                return get_task(row["id"])
    return None


def update_task_fields(task_id: int, **fields: Any) -> None:
    if not fields:
        return
    sets = ", ".join(f"{k} = ?" for k in fields)
    params: list[Any] = list(fields.values())
    params.append(task_id)
    with tx() as conn:
        conn.execute(
            f"UPDATE tasks SET {sets}, updated_at = datetime('now') WHERE id = ?",
            params,
        )


def set_task_state(task_id: int, state: str, **extra: Any) -> None:
    prev = get_task(task_id)
    with tx() as conn:
        conn.execute(
            "UPDATE tasks SET state = ?, updated_at = datetime('now') WHERE id = ?",
            (state, task_id),
        )
        if extra:
            sets = ", ".join(f"{k} = ?" for k in extra)
            conn.execute(
                f"UPDATE tasks SET {sets}, updated_at = datetime('now') WHERE id = ?",
                (*extra.values(), task_id),
            )
        record_event(
            conn, task_id, "state_change",
            {"from": prev["state"] if prev else None, "to": state, **extra},
        )


# ---------- events ----------

def record_event(conn: sqlite3.Connection, task_id: int, kind: str, payload: dict) -> None:
    conn.execute(
        "INSERT INTO task_events (task_id, kind, payload) VALUES (?, ?, ?)",
        (task_id, kind, json.dumps(payload, default=str)),
    )


def log_event(task_id: int, kind: str, payload: dict) -> None:
    with tx() as conn:
        record_event(conn, task_id, kind, payload)


# ---------- slot ops ----------

_SLOT_COLS = {
    "slot", "provider", "account", "account_key", "preferred_model",
    "execution_model", "last_verified_at", "verified", "ready",
    "cooldown_until", "cooldown_reason", "usage_primary_pct",
    "usage_secondary_pct", "last_used_at", "last_error", "rank_boost",
    # legacy / TSV-ingest fields we store but don't own in schema
    "account_label", "identity_hint", "primary_reset_at",
    "secondary_reset_at", "last_probe_class", "rank_override",
}


def upsert_slot(slot: str, **fields: Any) -> None:
    # Drop fields not in schema so we don't break on evolving callers.
    import sqlite3 as _sq
    conn = get_conn()
    schema_cols = {r["name"] for r in conn.execute("PRAGMA table_info(slots)").fetchall()}
    known = {k: v for k, v in fields.items() if k in schema_cols}
    with tx() as conn2:
        exists = conn2.execute(
            "SELECT 1 FROM slots WHERE slot = ?", (slot,)
        ).fetchone()
        if exists:
            if known:
                sets = ", ".join(f"{k} = ?" for k in known)
                conn2.execute(
                    f"UPDATE slots SET {sets} WHERE slot = ?",
                    (*known.values(), slot),
                )
        else:
            provider = known.pop("provider", fields.get("provider", "unknown"))
            cols = ["slot", "provider", *known.keys()]
            placeholders = ",".join(["?"] * len(cols))
            try:
                conn2.execute(
                    f"INSERT INTO slots ({','.join(cols)}) VALUES ({placeholders})",
                    (slot, provider, *known.values()),
                )
            except _sq.OperationalError:
                # fallback: insert only slot+provider, then update rest
                conn2.execute(
                    "INSERT INTO slots (slot, provider) VALUES (?, ?)",
                    (slot, provider),
                )
                if known:
                    sets = ", ".join(f"{k} = ?" for k in known)
                    conn2.execute(
                        f"UPDATE slots SET {sets} WHERE slot = ?",
                        (*known.values(), slot),
                    )


def list_slots() -> list[sqlite3.Row]:
    return list(get_conn().execute("SELECT * FROM slots ORDER BY slot").fetchall())


def get_slot(slot: str) -> sqlite3.Row | None:
    """Fetch current DB row for a slot, or None if not present.
    Used by slot_ledger.refresh_from_disk() Round-7 cooldown-clear logic to
    distinguish synthesized 'usage-cap-reached' cooldowns from operator-written
    cooldowns (e.g. 48h anthropic OAuth credit lockouts)."""
    return get_conn().execute("SELECT * FROM slots WHERE slot = ?", (slot,)).fetchone()


def record_slot_event(slot: str, kind: str, payload: dict, task_id: int | None = None) -> None:
    with tx() as conn:
        conn.execute(
            "INSERT INTO slot_events (slot, task_id, kind, payload) "
            "VALUES (?, ?, ?, ?)",
            (slot, task_id, kind, json.dumps(payload, default=str)),
        )


# ---------- pipeline_runs ----------

def register_run(dag_run_id: str, dag_file: str, dag_sha256: str) -> None:
    with tx() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO pipeline_runs (dag_run_id, dag_file, dag_sha256) "
            "VALUES (?, ?, ?)",
            (dag_run_id, dag_file, dag_sha256),
        )


def finish_run(dag_run_id: str, state: str, notes: str = "") -> None:
    with tx() as conn:
        conn.execute(
            "UPDATE pipeline_runs SET state = ?, finished_at = datetime('now'), "
            "notes = ? WHERE dag_run_id = ?",
            (state, notes, dag_run_id),
        )


# ---------- merge locks ----------

def acquire_merge_lock(resource: str, holder: str, ttl_s: int = 600) -> bool:
    with tx() as conn:
        existing = conn.execute(
            "SELECT held_by, expires_at FROM merge_locks WHERE resource = ?",
            (resource,),
        ).fetchone()
        if existing and existing["held_by"]:
            # reject unless expired
            expired = conn.execute(
                "SELECT CASE WHEN ? < datetime('now') THEN 1 ELSE 0 END AS e",
                (existing["expires_at"],),
            ).fetchone()["e"]
            if not expired:
                return False
        conn.execute(
            "INSERT INTO merge_locks (resource, held_by, held_since, expires_at) "
            "VALUES (?, ?, datetime('now'), datetime('now', ?)) "
            "ON CONFLICT(resource) DO UPDATE SET "
            "held_by=excluded.held_by, held_since=excluded.held_since, "
            "expires_at=excluded.expires_at",
            (resource, holder, f"+{int(ttl_s)} seconds"),
        )
        return True


def release_merge_lock(resource: str, holder: str) -> None:
    with tx() as conn:
        conn.execute(
            "UPDATE merge_locks SET held_by = NULL, held_since = NULL, expires_at = NULL "
            "WHERE resource = ? AND held_by = ?",
            (resource, holder),
        )


# ---------- expected/produced artifacts ----------

def set_expected_artifacts(task_id: int, manifest: list[dict]) -> None:
    with tx() as conn:
        conn.execute("DELETE FROM expected_artifacts WHERE task_id = ?", (task_id,))
        for item in manifest:
            conn.execute(
                "INSERT INTO expected_artifacts "
                "(task_id, path, min_lines, min_bytes, required_sections, write_mode) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    task_id,
                    item["path"],
                    int(item.get("min_lines", 10)),
                    int(item.get("min_bytes", 200)),
                    json.dumps(item.get("required_sections", [])),
                    item.get("write_mode", "append"),
                ),
            )


def list_expected_artifacts(task_id: int) -> list[sqlite3.Row]:
    return list(
        get_conn()
        .execute("SELECT * FROM expected_artifacts WHERE task_id = ?", (task_id,))
        .fetchall()
    )


def record_produced_artifact(task_id: int, path: str, bytes_: int, lines: int, sha256: str) -> None:
    with tx() as conn:
        conn.execute(
            "INSERT INTO produced_artifacts (task_id, path, bytes, lines, sha256) "
            "VALUES (?, ?, ?, ?, ?)",
            (task_id, path, bytes_, lines, sha256),
        )


# ---------- validator ----------

def record_validator_result(
    *,
    task_id: int,
    attempt: int,
    check_name: str,
    passed: bool,
    severity: str,
    detail: dict,
) -> None:
    with tx() as conn:
        conn.execute(
            "INSERT INTO validator_results "
            "(task_id, attempt, check_name, passed, severity, detail) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (task_id, attempt, check_name, 1 if passed else 0, severity,
             json.dumps(detail, default=str)),
        )


def list_validator_results(task_id: int, attempt: int | None = None) -> list[sqlite3.Row]:
    q = "SELECT * FROM validator_results WHERE task_id = ?"
    params: list[Any] = [task_id]
    if attempt is not None:
        q += " AND attempt = ?"
        params.append(attempt)
    q += " ORDER BY id ASC"
    return list(get_conn().execute(q, params).fetchall())


# ---------- grounding ----------

def record_grounding_probe(
    *,
    task_id: int,
    attempt: int,
    citation: str,
    path: str,
    line_start: int | None,
    line_end: int | None,
    exists_on_disk: bool,
    lines_valid: bool,
) -> None:
    with tx() as conn:
        conn.execute(
            "INSERT INTO grounding_probes "
            "(task_id, attempt, citation, path, line_start, line_end, "
            "exists_on_disk, lines_valid) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (task_id, attempt, citation, path, line_start, line_end,
             1 if exists_on_disk else 0, 1 if lines_valid else 0),
        )
