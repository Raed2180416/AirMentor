"""SQLite storage engine for the knowledge graph and audit data.

Schema:
- files: File metadata and metrics
- functions: Function definitions and metrics
- classes: Class definitions
- imports: Import relationships
- calls: Call graph edges
- audit_runs: History of audit executions
- issues: Detected issues
"""

from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path

from ..engine.scanner import ScanResult
from ..engine.parser import ParsedFile
from ..engine.graph import CodeGraph
from ..engine.metrics import FileMetrics, ProjectMetrics


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS audit_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    root_path TEXT NOT NULL,
    started_at REAL NOT NULL,
    finished_at REAL,
    total_files INTEGER,
    total_lines INTEGER,
    total_functions INTEGER,
    status TEXT DEFAULT 'running',
    summary_json TEXT
);

CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_run_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    language TEXT NOT NULL,
    category TEXT NOT NULL,
    extension TEXT,
    size_bytes INTEGER,
    total_lines INTEGER DEFAULT 0,
    code_lines INTEGER DEFAULT 0,
    comment_lines INTEGER DEFAULT 0,
    blank_lines INTEGER DEFAULT 0,
    is_binary INTEGER DEFAULT 0,
    is_test INTEGER DEFAULT 0,
    is_entrypoint INTEGER DEFAULT 0,
    function_count INTEGER DEFAULT 0,
    class_count INTEGER DEFAULT 0,
    import_count INTEGER DEFAULT 0,
    export_count INTEGER DEFAULT 0,
    cyclomatic_complexity INTEGER DEFAULT 0,
    maintainability_index REAL DEFAULT 0,
    fan_in INTEGER DEFAULT 0,
    fan_out INTEGER DEFAULT 0,
    coupling_score REAL DEFAULT 0,
    risk_score REAL DEFAULT 0,
    trust_score REAL DEFAULT 0,
    entropy_contribution REAL DEFAULT 0,
    has_tests INTEGER DEFAULT 0,
    framework_hints TEXT,
    parse_errors TEXT,
    FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id),
    UNIQUE(audit_run_id, path)
);

CREATE TABLE IF NOT EXISTS functions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_run_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    name TEXT NOT NULL,
    start_line INTEGER,
    end_line INTEGER,
    params_json TEXT,
    return_type TEXT,
    is_async INTEGER DEFAULT 0,
    is_exported INTEGER DEFAULT 0,
    decorators_json TEXT,
    complexity INTEGER DEFAULT 0,
    calls_json TEXT,
    FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id)
);

CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_run_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    name TEXT NOT NULL,
    start_line INTEGER,
    end_line INTEGER,
    base_classes_json TEXT,
    is_exported INTEGER DEFAULT 0,
    method_count INTEGER DEFAULT 0,
    FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id)
);

CREATE TABLE IF NOT EXISTS imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_run_id INTEGER NOT NULL,
    importer_file TEXT NOT NULL,
    imported_module TEXT NOT NULL,
    imported_names_json TEXT,
    resolved_file TEXT,
    line INTEGER,
    is_resolved INTEGER DEFAULT 0,
    FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id)
);

CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_run_id INTEGER NOT NULL,
    caller_file TEXT NOT NULL,
    caller_func TEXT NOT NULL,
    callee_name TEXT NOT NULL,
    callee_file TEXT,
    callee_func TEXT,
    line INTEGER,
    is_resolved INTEGER DEFAULT 0,
    is_external INTEGER DEFAULT 0,
    FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id)
);

CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_run_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    function_name TEXT,
    issue_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    line INTEGER,
    description TEXT,
    suggestion TEXT,
    FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_files_path ON files(audit_run_id, path);
CREATE INDEX IF NOT EXISTS idx_files_risk ON files(audit_run_id, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_functions_file ON functions(audit_run_id, file_path);
CREATE INDEX IF NOT EXISTS idx_functions_name ON functions(audit_run_id, name);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(audit_run_id, caller_file, caller_func);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(audit_run_id, callee_name);
CREATE INDEX IF NOT EXISTS idx_imports_importer ON imports(audit_run_id, importer_file);
CREATE INDEX IF NOT EXISTS idx_imports_resolved ON imports(audit_run_id, resolved_file);
CREATE INDEX IF NOT EXISTS idx_issues_file ON issues(audit_run_id, file_path);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_functions USING fts5(
    name, file_path, content='functions', content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_files USING fts5(
    path, language, content='files', content_rowid='id'
);
"""


@dataclass
class AuditStore:
    db_path: Path
    conn: sqlite3.Connection
    audit_run_id: int


def create_store(db_path: Path, root_path: str) -> AuditStore:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(SCHEMA_SQL)

    cursor = conn.execute(
        "INSERT INTO audit_runs (root_path, started_at, status) VALUES (?, ?, 'running')",
        (root_path, time.time()),
    )
    audit_run_id = cursor.lastrowid
    conn.commit()

    return AuditStore(db_path=db_path, conn=conn, audit_run_id=audit_run_id)


def insert_scan_result(store: AuditStore, scan: ScanResult) -> None:
    for fi in scan.files:
        store.conn.execute(
            """INSERT OR REPLACE INTO files (
                audit_run_id, path, language, category, extension,
                size_bytes, total_lines, is_binary, is_test, is_entrypoint,
                framework_hints
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                store.audit_run_id, fi.relative_path, fi.language, fi.category,
                fi.extension, fi.size_bytes, fi.lines,
                1 if fi.is_binary else 0, 1 if fi.is_test else 0,
                1 if fi.is_entrypoint else 0,
                json.dumps(fi.framework_hints) if fi.framework_hints else None,
            ),
        )
    store.conn.commit()


def insert_parsed_file(store: AuditStore, pf: ParsedFile) -> None:
    store.conn.execute(
        """UPDATE files SET
            comment_lines = ?, blank_lines = ?, code_lines = ?,
            function_count = ?, class_count = ?, import_count = ?,
            export_count = ?, parse_errors = ?
        WHERE audit_run_id = ? AND path = ?""",
        (
            pf.comment_lines, pf.blank_lines,
            pf.total_lines - pf.comment_lines - pf.blank_lines,
            len(pf.functions), len(pf.classes), len(pf.imports),
            len(pf.exports),
            json.dumps(pf.parse_errors) if pf.parse_errors else None,
            store.audit_run_id, pf.path,
        ),
    )

    for func in pf.functions:
        store.conn.execute(
            """INSERT INTO functions (
                audit_run_id, file_path, name, start_line, end_line,
                params_json, is_async, is_exported, decorators_json,
                complexity, calls_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                store.audit_run_id, pf.path, func.name, func.start_line,
                func.end_line, json.dumps(func.params),
                1 if func.is_async else 0, 1 if func.is_exported else 0,
                json.dumps(func.decorators) if func.decorators else None,
                func.complexity,
                json.dumps(func.calls) if func.calls else None,
            ),
        )

    for cls in pf.classes:
        store.conn.execute(
            """INSERT INTO classes (
                audit_run_id, file_path, name, start_line, end_line,
                base_classes_json, is_exported, method_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                store.audit_run_id, pf.path, cls.name, cls.start_line,
                cls.end_line, json.dumps(cls.base_classes),
                1 if cls.is_exported else 0, len(cls.methods),
            ),
        )

    for imp in pf.imports:
        store.conn.execute(
            """INSERT INTO imports (
                audit_run_id, importer_file, imported_module,
                imported_names_json, line
            ) VALUES (?, ?, ?, ?, ?)""",
            (
                store.audit_run_id, pf.path, imp.module,
                json.dumps(imp.names) if imp.names else None, imp.line,
            ),
        )

    store.conn.commit()


def insert_graph(store: AuditStore, graph: CodeGraph) -> None:
    for edge in graph.import_edges:
        if edge.is_resolved:
            store.conn.execute(
                """UPDATE imports SET resolved_file = ?, is_resolved = 1
                WHERE audit_run_id = ? AND importer_file = ? AND imported_module = ?""",
                (edge.resolved_file, store.audit_run_id, edge.importer_file, edge.imported_module),
            )

    for edge in graph.call_edges:
        store.conn.execute(
            """INSERT INTO calls (
                audit_run_id, caller_file, caller_func, callee_name,
                callee_file, callee_func, line, is_resolved, is_external
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                store.audit_run_id, edge.caller_file, edge.caller_func,
                edge.callee_name, edge.callee_file, edge.callee_func,
                edge.line, 1 if edge.is_resolved else 0,
                1 if edge.is_external else 0,
            ),
        )

    store.conn.commit()


def insert_metrics(store: AuditStore, file_metrics: list[FileMetrics]) -> None:
    for fm in file_metrics:
        store.conn.execute(
            """UPDATE files SET
                cyclomatic_complexity = ?, maintainability_index = ?,
                fan_in = ?, fan_out = ?, coupling_score = ?,
                risk_score = ?, trust_score = ?, entropy_contribution = ?,
                has_tests = ?
            WHERE audit_run_id = ? AND path = ?""",
            (
                fm.cyclomatic_complexity, fm.maintainability_index,
                fm.fan_in, fm.fan_out, fm.coupling_score,
                fm.risk_score, fm.trust_score, fm.entropy_contribution,
                1 if fm.has_tests else 0,
                store.audit_run_id, fm.path,
            ),
        )
    store.conn.commit()


def insert_issues(store: AuditStore, issues: list[dict]) -> None:
    for issue in issues:
        store.conn.execute(
            """INSERT INTO issues (
                audit_run_id, file_path, function_name, issue_type,
                severity, line, description, suggestion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                store.audit_run_id, issue.get("file_path", ""),
                issue.get("function_name"), issue.get("type", "unknown"),
                issue.get("severity", "info"), issue.get("line"),
                issue.get("description"), issue.get("suggestion"),
            ),
        )
    store.conn.commit()


def finalize_run(store: AuditStore, project_metrics: ProjectMetrics) -> None:
    # Rebuild FTS indexes
    store.conn.execute("INSERT INTO fts_functions(fts_functions) VALUES('rebuild')")
    store.conn.execute("INSERT INTO fts_files(fts_files) VALUES('rebuild')")

    store.conn.execute(
        """UPDATE audit_runs SET
            finished_at = ?, status = 'complete',
            total_files = ?, total_lines = ?, total_functions = ?,
            summary_json = ?
        WHERE id = ?""",
        (
            time.time(), project_metrics.total_files,
            project_metrics.total_lines, project_metrics.total_functions,
            json.dumps({
                "avg_complexity": project_metrics.avg_complexity,
                "avg_maintainability": project_metrics.avg_maintainability,
                "risk_distribution": project_metrics.risk_distribution,
                "trust_distribution": project_metrics.trust_distribution,
                "cycle_count": project_metrics.cycle_count,
                "dead_code_count": project_metrics.dead_code_count,
                "test_coverage_estimate": project_metrics.test_coverage_estimate,
            }),
            store.audit_run_id,
        ),
    )
    store.conn.commit()


def close_store(store: AuditStore) -> None:
    store.conn.close()


def query_riskiest_files(store: AuditStore, limit: int = 20) -> list[dict]:
    rows = store.conn.execute(
        """SELECT path, language, risk_score, trust_score, total_lines,
                  cyclomatic_complexity, maintainability_index
           FROM files
           WHERE audit_run_id = ? AND category = 'source'
           ORDER BY risk_score DESC LIMIT ?""",
        (store.audit_run_id, limit),
    ).fetchall()
    return [
        {"path": r[0], "language": r[1], "risk_score": r[2],
         "trust_score": r[3], "total_lines": r[4],
         "complexity": r[5], "maintainability": r[6]}
        for r in rows
    ]


def query_callers_of(store: AuditStore, func_name: str) -> list[dict]:
    rows = store.conn.execute(
        """WITH RECURSIVE callers AS (
            SELECT caller_file, caller_func, callee_name, 1 AS depth
            FROM calls WHERE audit_run_id = ? AND callee_name = ?
            UNION ALL
            SELECT c.caller_file, c.caller_func, c.callee_name, callers.depth + 1
            FROM calls c JOIN callers ON c.callee_name = callers.caller_func
            WHERE c.audit_run_id = ? AND callers.depth < 20
        )
        SELECT DISTINCT caller_file, caller_func, depth FROM callers ORDER BY depth""",
        (store.audit_run_id, func_name, store.audit_run_id),
    ).fetchall()
    return [{"file": r[0], "function": r[1], "depth": r[2]} for r in rows]


def query_blast_radius(store: AuditStore, file_path: str, max_depth: int = 5) -> dict:
    rows = store.conn.execute(
        """WITH RECURSIVE dependents AS (
            SELECT importer_file, imported_module, 1 AS depth
            FROM imports WHERE audit_run_id = ? AND resolved_file = ?
            UNION ALL
            SELECT i.importer_file, i.imported_module, d.depth + 1
            FROM imports i JOIN dependents d ON i.resolved_file = d.importer_file
            WHERE i.audit_run_id = ? AND d.depth < ?
        )
        SELECT DISTINCT importer_file, depth FROM dependents ORDER BY depth""",
        (store.audit_run_id, file_path, store.audit_run_id, max_depth),
    ).fetchall()
    result: dict[str, list[str]] = {}
    for r in rows:
        depth_key = str(r[1])
        if depth_key not in result:
            result[depth_key] = []
        result[depth_key].append(r[0])
    return result


def query_search(store: AuditStore, query: str, limit: int = 20) -> list[dict]:
    # Use prefix search for partial matches
    fts_query = " OR ".join(f'"{token}"*' for token in query.split())
    func_rows = store.conn.execute(
        """SELECT name, file_path, rank FROM fts_functions
           WHERE fts_functions MATCH ? ORDER BY rank LIMIT ?""",
        (fts_query, limit),
    ).fetchall()
    file_rows = store.conn.execute(
        """SELECT path, language, rank FROM fts_files
           WHERE fts_files MATCH ? ORDER BY rank LIMIT ?""",
        (fts_query, limit),
    ).fetchall()
    results = [
        {"type": "function", "name": r[0], "file": r[1], "rank": r[2]}
        for r in func_rows
    ]
    results.extend([
        {"type": "file", "path": r[0], "language": r[1], "rank": r[2]}
        for r in file_rows
    ])
    return sorted(results, key=lambda x: x.get("rank", 0))[:limit]
