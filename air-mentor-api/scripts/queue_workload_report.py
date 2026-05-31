#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from pathlib import Path
from typing import Any


COLUMN_ALIASES = {
    "student": ["student_id", "studentId"],
    "course": ["course_id", "courseId", "course_code", "courseCode"],
    "semester": ["semester", "semester_number", "semesterNumber"],
    "stage": ["stage_key", "stageKey"],
    "section": ["section_code", "sectionCode"],
    "role": ["assigned_role", "assignedRole", "role"],
    "faculty": ["assigned_faculty_id", "assignedFacultyId", "faculty_id", "facultyId"],
}
DEFAULT_TOP_K_FRACTIONS = [0.01, 0.05, 0.10, 0.20]
STAGE_ORDER = {
    "pre-tt1": 0,
    "post-tt1": 1,
    "post-tt2": 2,
    "post-assignments": 3,
    "post-see": 4,
}


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def resolve_columns(header: list[str]) -> dict[str, str | None]:
    return {
        family: next((name for name in aliases if name in header), None)
        for family, aliases in COLUMN_ALIASES.items()
    }


def score_for_row(row: dict[str, str], score_col: str | None) -> float:
    if score_col and score_col in row:
        return to_float(row.get(score_col), 0.0)
    feature_values = []
    for idx in [0, 4, 5, 6, 7, 8, 9, 44, 45, 46, 47]:
        raw = row.get(f"feat_{idx}")
        if raw is not None:
            value = to_float(raw, 0.5)
            if idx == 0:
                value = 1.0 - value
            feature_values.append(value)
    return max(feature_values) if feature_values else 0.0


def canonical_role(value: str) -> str:
    value = (value or "").strip()
    lower = value.lower().replace("_", "-")
    if lower in {"mentor", "faculty-mentor"}:
        return "Mentor"
    if lower in {"course-leader", "course leader", "cl"}:
        return "Course Leader"
    if lower in {"hod", "head-of-department", "head of department"}:
        return "HoD"
    return value or "unknown"


def read_rows(path: Path, score_col: str | None) -> tuple[list[dict[str, Any]], dict[str, str | None]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        header = reader.fieldnames or []
        columns = resolve_columns(header)
        for raw in reader:
            row = {
                "score": score_for_row(raw, score_col),
                "raw": raw,
            }
            for family, column in columns.items():
                row[family] = raw.get(column) if column else None
            row["role"] = canonical_role(row.get("role") or "")
            rows.append(row)
    return rows, columns


def dedupe_mode_for(args: argparse.Namespace, columns: dict[str, str | None]) -> str:
    if args.dedupe_by != "auto":
        return args.dedupe_by
    if columns.get("student") and columns.get("course"):
        return "student_course"
    if columns.get("student"):
        return "student"
    return "none"


def dedupe_key(row: dict[str, Any], mode: str) -> tuple[str, ...] | None:
    if mode == "none":
        return None
    if mode == "student":
        student = row.get("student")
        return (str(student),) if student else None
    if mode == "student_course":
        student = row.get("student")
        course = row.get("course")
        return (str(student), str(course)) if student and course else None
    if mode == "student_course_semester":
        student = row.get("student")
        course = row.get("course")
        semester = row.get("semester")
        return (str(student), str(course), str(semester)) if student and course and semester else None
    raise ValueError(f"unknown dedupe mode: {mode}")


def dedupe_rows(rows: list[dict[str, Any]], mode: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if mode == "none":
        return rows, {"mode": mode, "inputRows": len(rows), "outputRows": len(rows), "collapsedRows": 0, "missingKeyRows": 0}
    grouped: dict[tuple[str, ...], dict[str, Any]] = {}
    passthrough: list[dict[str, Any]] = []
    missing_key_rows = 0
    for row in rows:
        key = dedupe_key(row, mode)
        if key is None:
            missing_key_rows += 1
            passthrough.append(row)
            continue
        current = grouped.get(key)
        if current is None:
            grouped[key] = row
            continue
        row_stage_order = STAGE_ORDER.get(str(row.get("stage") or ""), -1)
        current_stage_order = STAGE_ORDER.get(str(current.get("stage") or ""), -1)
        if (row["score"], row_stage_order) > (current["score"], current_stage_order):
            grouped[key] = row
    output = list(grouped.values()) + passthrough
    output.sort(key=lambda item: (-item["score"], str(item.get("student") or ""), str(item.get("course") or "")))
    return output, {
        "mode": mode,
        "inputRows": len(rows),
        "outputRows": len(output),
        "collapsedRows": len(rows) - len(output),
        "missingKeyRows": missing_key_rows,
    }


def parse_fractions(value: str | None) -> list[float]:
    if not value:
        return DEFAULT_TOP_K_FRACTIONS
    return [float(part.strip()) for part in value.split(",") if part.strip()]


def parse_role_limits(path: str | None, backend_url: str | None) -> dict[str, int]:
    data = {}
    if path:
        if path.startswith("http://") or path.startswith("https://"):
            import urllib.request
            with urllib.request.urlopen(path) as response:
                data = json.loads(response.read().decode('utf-8'))
        else:
            data = json.loads(Path(path).read_text(encoding="utf-8"))
    elif backend_url:
        import urllib.request
        with urllib.request.urlopen(backend_url) as response:
            data = json.loads(response.read().decode('utf-8'))
            
    limits = {}
    for key, value in data.items():
        limits[str(key)] = int(value)
    return limits


def top_k_report(rows: list[dict[str, Any]], fraction: float, role_limits: dict[str, int], identity_available: bool) -> dict[str, Any]:
    if not rows:
        return {"fraction": fraction, "selected": 0, "roleCounts": {}, "facultyCounts": {}, "overCapacity": []}
    selected_count = max(1, math.ceil(len(rows) * fraction))
    selected = sorted(rows, key=lambda item: (-item["score"], str(item.get("student") or ""), str(item.get("course") or "")))[:selected_count]
    role_counts: dict[str, int] = {}
    faculty_counts: dict[str, int] = {}
    role_faculty_counts: dict[str, int] = {}
    stage_counts: dict[str, int] = {}
    section_counts: dict[str, int] = {}
    unique_students = set()
    for row in selected:
        role = str(row.get("role") or "unknown")
        faculty = str(row.get("faculty") or "unknown")
        stage = str(row.get("stage") or "unknown")
        section = str(row.get("section") or "unknown")
        student = str(row.get("student") or "unknown")
        role_counts[role] = role_counts.get(role, 0) + 1
        faculty_counts[faculty] = faculty_counts.get(faculty, 0) + 1
        key = f"{role}::{faculty}"
        role_faculty_counts[key] = role_faculty_counts.get(key, 0) + 1
        stage_counts[stage] = stage_counts.get(stage, 0) + 1
        section_counts[section] = section_counts.get(section, 0) + 1
        unique_students.add(student)
    over_capacity = []
    for key, count in sorted(role_faculty_counts.items()):
        role, faculty = key.split("::", 1)
        limit = role_limits.get(role, role_limits.get("default", 999999))
        if count > limit:
            over_capacity.append({"role": role, "faculty": faculty, "count": count, "limit": limit})
    return {
        "fraction": fraction,
        "selected": len(selected),
        "uniqueStudents": len(unique_students) if identity_available else None,
        "roleCounts": role_counts,
        "facultyCounts": faculty_counts,
        "stageCounts": stage_counts,
        "sectionCounts": section_counts,
        "overCapacity": over_capacity,
    }


def markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# AirMentor Queue Workload Report",
        "",
        f"Input CSV: `{report['inputCsv']}`",
        f"Production gate passed: `{str(report['productionGate']['passed']).lower()}`",
        f"Raw rows: `{report['rowCount']}`",
        f"Queue candidates: `{report['candidateCount']}`",
        f"Dedupe mode: `{report['dedupe']['mode']}`",
        "",
        "## Column coverage",
        "",
    ]
    for family, column in report["columnCoverage"].items():
        lines.append(f"- **{family}:** `{column}`")
    lines.extend(["", "## Top-k workload", "", "| Fraction | Selected | Unique students | Over-capacity owners |", "|---:|---:|---:|---:|"])
    for item in report.get("topK", []):
        lines.append(f"| {item['fraction']} | {item['selected']} | {item['uniqueStudents']} | {len(item['overCapacity'])} |")
    lines.extend(["", "## Blockers", ""])
    for reason in report["productionGate"].get("blockedReasons", []):
        lines.append(f"- **Blocked:** {reason}")
    lines.append("")
    return "\n".join(lines)


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    raw_rows, columns = read_rows(Path(args.input_csv), args.score_col)
    dedupe_mode = dedupe_mode_for(args, columns)
    rows, dedupe_summary = dedupe_rows(raw_rows, dedupe_mode)
    missing = [family for family, column in columns.items() if column is None]
    role_limits = parse_role_limits(args.role_limits_json, args.backend_url)
    top_k = [
        top_k_report(rows, fraction, role_limits, columns.get("student") is not None)
        for fraction in parse_fractions(args.top_k)
    ]
    over_capacity_total = sum(len(item["overCapacity"]) for item in top_k)
    blockers: list[str] = []
    if missing:
        blockers.append(f"missing deploy-grade workload identifier families: {missing}")
    if not args.score_col:
        blockers.append("no score column supplied; workload report used feature-risk proxy ordering")
    if over_capacity_total:
        blockers.append(f"top-k workload exceeds role/faculty limits in {over_capacity_total} capacity checks")
    return {
        "inputCsv": args.input_csv,
        "scoreColumn": args.score_col,
        "scoreSource": "csv_column" if args.score_col else "feature_proxy",
        "rowCount": len(raw_rows),
        "candidateCount": len(rows),
        "dedupe": dedupe_summary,
        "columnCoverage": columns,
        "missingColumnFamilies": missing,
        "roleLimits": role_limits,
        "topK": top_k,
        "productionGate": {
            "passed": not blockers,
            "blockedReasons": blockers,
        },
        "summary": {
            "productionGatePassed": not blockers,
            "missingColumnFamilies": missing,
            "overCapacityCheckCount": over_capacity_total,
            "candidateCount": len(rows),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate role/faculty queue workload evidence for AirMentor deployment readiness.")
    parser.add_argument("--input-csv", required=True)
    parser.add_argument("--score-col")
    parser.add_argument("--dedupe-by", choices=["auto", "none", "student", "student_course", "student_course_semester"], default="auto")
    parser.add_argument("--top-k", help="Comma-separated top-k fractions. Default: 0.01,0.05,0.10,0.20")
    parser.add_argument("--role-limits-json")
    parser.add_argument("--backend-url")
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--output-md")
    args = parser.parse_args()
    report = build_report(args)
    output_json = Path(args.output_json)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(report, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
    output_md = Path(args.output_md) if args.output_md else output_json.with_suffix(".md")
    output_md.write_text(markdown_report(report), encoding="utf-8")
    print(f"Wrote {output_json}")
    print(f"Wrote {output_md}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
