-- AirMentor Pipeline v2 schema
-- SQLite with WAL for parallel safety.
-- Atomic task claim via UPDATE...WHERE state='pending' + RETURNING.

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 10000;

CREATE TABLE IF NOT EXISTS schema_version (
    version      INTEGER PRIMARY KEY,
    applied_at   TEXT    NOT NULL
);
INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (1, datetime('now'));

-- Tasks: DAG nodes. One row per (dag_run, node).
CREATE TABLE IF NOT EXISTS tasks (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    dag_run_id          TEXT    NOT NULL,
    node_id             TEXT    NOT NULL,
    pass_name           TEXT    NOT NULL,
    context             TEXT    NOT NULL DEFAULT 'pipeline',
    task_class          TEXT    NOT NULL DEFAULT 'structured',
    risk_class          TEXT    NOT NULL DEFAULT 'medium',
    reasoning_effort    TEXT,
    require_provider    TEXT,
    require_account_key TEXT,       -- pin to a specific arctic account (auth_source_key)
    requested_model     TEXT,
    prompt_file         TEXT    NOT NULL,
    intent_file         TEXT,
    manifest_file       TEXT,
    write_scope_glob    TEXT    NOT NULL DEFAULT '**',
    parallel_group      TEXT,               -- NULL = serial; same group = can run concurrently
    depends_on          TEXT    NOT NULL DEFAULT '[]', -- JSON array of node_ids
    priority            INTEGER NOT NULL DEFAULT 50,
    max_attempts        INTEGER NOT NULL DEFAULT 4,
    idle_timeout_s      INTEGER NOT NULL DEFAULT 1800,
    hard_timeout_s      INTEGER NOT NULL DEFAULT 14400,
    state               TEXT    NOT NULL DEFAULT 'pending',
        -- pending, ready, claimed, running, merging, completed, failed, blocked, waiting_slot, cancelled
    attempt             INTEGER NOT NULL DEFAULT 0,
    last_failure_class  TEXT,
    last_error          TEXT,
    tmux_session        TEXT,
    slot                TEXT,
    provider            TEXT,
    account             TEXT,
    account_key         TEXT,          -- arctic auth_source_key, e.g. codex:steamraed
    model               TEXT,
    arctic_session_id   TEXT,          -- ses_... returned by arctic
    briefing_path       TEXT,          -- upstream-context briefing md attached to this task
    git_head_before     TEXT,
    git_head_after      TEXT,
    result_json         TEXT,               -- parsed from structured exit marker
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    claimed_at          TEXT,
    started_at          TEXT,
    finished_at         TEXT,
    UNIQUE(dag_run_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_state   ON tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_dag_run ON tasks(dag_run_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group   ON tasks(parallel_group);

-- Task events: append-only audit trail
CREATE TABLE IF NOT EXISTS task_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    at          TEXT    NOT NULL DEFAULT (datetime('now')),
    kind        TEXT    NOT NULL,   -- state_change, route_change, validator, stall, retry, error, note
    payload     TEXT    NOT NULL    -- JSON
);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);

-- Slots: one row per account/provider combo
CREATE TABLE IF NOT EXISTS slots (
    slot                TEXT PRIMARY KEY,
    provider            TEXT,
    account             TEXT,
    account_key         TEXT,                  -- unique auth identity (auth_source_key)
    preferred_model     TEXT,
    execution_model     TEXT,                  -- model currently verified to run
    last_verified_at    TEXT,
    verified            INTEGER NOT NULL DEFAULT 0,
    ready               INTEGER NOT NULL DEFAULT 0,
    cooldown_until      TEXT,                  -- NULL if available
    cooldown_reason     TEXT,
    usage_primary_pct   REAL,                  -- 0..100
    usage_secondary_pct REAL,
    last_used_at        TEXT,
    last_error          TEXT,
    rank_boost          INTEGER NOT NULL DEFAULT 0,  -- operator override
    pick_count          INTEGER NOT NULL DEFAULT 0   -- LRU decay: router subtracts N*5 from rank
);
CREATE INDEX IF NOT EXISTS idx_slots_account_key ON slots(account_key);

-- Slot events: append-only audit trail of cycling decisions
CREATE TABLE IF NOT EXISTS slot_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    at          TEXT    NOT NULL DEFAULT (datetime('now')),
    slot        TEXT    NOT NULL,
    task_id     INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    kind        TEXT    NOT NULL,   -- picked, cooldown_hit, cooldown_clear, rejected, probe
    payload     TEXT    NOT NULL    -- JSON
);
CREATE INDEX IF NOT EXISTS idx_slot_events_slot ON slot_events(slot);

-- Artifact manifest: expected outputs per pass
CREATE TABLE IF NOT EXISTS expected_artifacts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    path        TEXT    NOT NULL,
    min_lines   INTEGER NOT NULL DEFAULT 10,
    min_bytes   INTEGER NOT NULL DEFAULT 200,
    required_sections TEXT NOT NULL DEFAULT '[]',  -- JSON array of markdown headings required
    write_mode  TEXT    NOT NULL DEFAULT 'append', -- append|replace|merge
    UNIQUE(task_id, path)
);

-- Produced artifacts: observed after task run
CREATE TABLE IF NOT EXISTS produced_artifacts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    path        TEXT    NOT NULL,
    bytes       INTEGER NOT NULL,
    lines       INTEGER NOT NULL,
    sha256      TEXT    NOT NULL,
    at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Validator results: one per check per task attempt
CREATE TABLE IF NOT EXISTS validator_results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    attempt     INTEGER NOT NULL,
    check_name  TEXT    NOT NULL,   -- structured_exit, artifact_manifest, grounding, scope_glob, intent_guard
    passed      INTEGER NOT NULL,   -- 0|1
    severity    TEXT    NOT NULL DEFAULT 'error',  -- error|warn|info
    detail      TEXT    NOT NULL,   -- JSON
    at          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_validator_task ON validator_results(task_id);

-- Grounding probes: file:line citation existence checks
CREATE TABLE IF NOT EXISTS grounding_probes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    attempt     INTEGER NOT NULL,
    citation    TEXT    NOT NULL,   -- raw "path:line[-line]"
    path        TEXT    NOT NULL,
    line_start  INTEGER,
    line_end    INTEGER,
    exists_on_disk INTEGER NOT NULL,
    lines_valid INTEGER NOT NULL,
    at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Pipeline runs: top-level run registry
CREATE TABLE IF NOT EXISTS pipeline_runs (
    dag_run_id  TEXT    PRIMARY KEY,
    dag_file    TEXT    NOT NULL,
    dag_sha256  TEXT    NOT NULL,
    started_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    state       TEXT    NOT NULL DEFAULT 'running',  -- running, completed, failed, paused
    notes       TEXT
);

-- Merge-controller locks: shared-ledger serialisation
CREATE TABLE IF NOT EXISTS merge_locks (
    resource    TEXT    PRIMARY KEY,   -- e.g. coverage-ledger.md
    held_by     TEXT,                  -- dag_run_id:node_id
    held_since  TEXT,
    expires_at  TEXT
);

-- Intent registry: feature intent source of truth
CREATE TABLE IF NOT EXISTS feature_intents (
    feature_id  TEXT    PRIMARY KEY,   -- slug
    title       TEXT    NOT NULL,
    purpose     TEXT    NOT NULL,      -- one-line product intent
    nonneg      TEXT    NOT NULL DEFAULT '[]',  -- JSON: invariants (list)
    owner_files TEXT    NOT NULL DEFAULT '[]',  -- JSON: canonical files
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
