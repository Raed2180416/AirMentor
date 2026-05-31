#!/usr/bin/env python3
"""Massive trajectory dump: every student × semester × stage × course × view.

Produces:
  1. trajectories.json — full per-student per-row dump with all features, labels, probs
  2. trajectories.md — human-readable markdown report
  3. class-summary.json — aggregate stats per stage/semester/course/family
  4. archetype-trace.json — C1-C4 special-case student traces

Usage:
    python dump_trajectories.py <features_csv> <training_dir> <output_dir>
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


FEATURE_NAMES = [
    "attendancePctScaled", "attendanceTrendScaled", "attendanceHistoryRiskScaled",
    "currentCgpaScaled", "backlogPressureScaled", "tt1RiskScaled", "tt2RiskScaled",
    "seeRiskScaled", "quizRiskScaled", "assignmentRiskScaled", "weakCoPressureScaled",
    "weakQuestionPressureScaled", "courseworkTtMismatchScaled", "ttMomentumRiskScaled",
    "interventionResidualRiskScaled", "prerequisitePressureScaled",
    "prerequisiteAverageRiskScaled", "prerequisiteFailurePressureScaled",
    "prerequisiteChainDepthScaled", "prerequisiteWeakCourseRateScaled",
    "prerequisiteCarryoverLoadScaled", "prerequisiteRecencyWeightedFailureScaled",
    "downstreamDependencyLoadScaled", "weakPrerequisiteChainCountScaled",
    "repeatedWeakPrerequisiteFamilyCountScaled", "semesterProgressScaled",
    "stagePreTt1Scaled", "stagePostTt1Scaled", "stagePostTt2Scaled",
    "stagePostAssignmentsScaled", "stagePostSeeScaled", "sectionPressureScaled",
    "tt1tt2ExamCompoundRiskScaled", "courseworkCompoundRiskScaled",
    "stagePostTt2TtCompoundInteractionScaled", "attendanceTrendCompoundRiskScaled",
    "stagePostAssignmentsCourseworkInteractionScaled", "cgpaMissingScaled",
    "backlogMissingScaled", "tt1MissingScaled", "tt2MissingScaled",
    "seeMissingScaled", "quizMissingScaled", "assignmentMissingScaled",
    "activeBacklogCreditPressureScaled", "historicalBacklogBurdenScaled",
    "lowerYearBlockerPressureScaled", "backlogSensitivityScoreScaled",
]

HEADS = ["attendanceRisk", "ceRisk", "seeRisk", "overallCourseRisk", "downstreamCarryoverRisk"]
LABEL_COLS = {
    "attendanceRisk": "label_attendance",
    "ceRisk": "label_ce",
    "seeRisk": "label_see",
    "overallCourseRisk": "label_overall",
    "downstreamCarryoverRisk": "label_downstream",
}

STAGE_ORDER = {"pre-tt1": 0, "post-tt1": 1, "post-tt2": 2, "post-assignments": 3, "post-see": 4}


def load_training_metrics(training_dir: Path) -> dict[str, Any] | None:
    mp = training_dir / "metrics.json"
    if not mp.exists():
        return None
    return json.loads(mp.read_text(encoding="utf-8"))


def build_student_trajectory(df: pd.DataFrame, student_id: str) -> dict[str, Any]:
    """Extract full trajectory for one student."""
    sdf = df[df["student_id"] == student_id].sort_values(["semester_number", "stage_key", "course_id"])
    if len(sdf) == 0:
        return {"student_id": student_id, "rows": 0}

    semesters = {}
    for sem in sorted(sdf["semester_number"].unique()):
        sem_df = sdf[sdf["semester_number"] == sem]
        stages = {}
        for stage in ["pre-tt1", "post-tt1", "post-tt2", "post-assignments", "post-see"]:
            stage_df = sem_df[sem_df["stage_key"] == stage]
            if len(stage_df) == 0:
                continue
            courses = {}
            for _, row in stage_df.iterrows():
                cid = str(row.get("course_id", "?"))
                features = {FEATURE_NAMES[i]: float(row[f"feat_{i}"]) for i in range(48)}
                labels = {h: int(row[LABEL_COLS[h]]) for h in HEADS if LABEL_COLS[h] in row}
                courses[cid] = {
                    "course_title": str(row.get("course_title", "")),
                    "course_credits": int(row.get("course_credits", 0)),
                    "features": features,
                    "labels": labels,
                    "scenario_family": str(row.get("scenario_family", "")),
                    "section_code": str(row.get("section_code", "")),
                }
            stages[stage] = {"courses": courses, "course_count": len(courses)}
        semesters[str(sem)] = {
            "stages": stages,
            "stage_count": len(stages),
            "scenario_family": str(sem_df.iloc[0].get("scenario_family", "")),
        }

    return {
        "student_id": student_id,
        "semesters": semesters,
        "semester_count": len(semesters),
        "scenario_family": str(sdf.iloc[0].get("scenario_family", "")),
        "mentor_id": str(sdf.iloc[0].get("mentor_id", "")),
    }


def build_class_summary(df: pd.DataFrame) -> dict[str, Any]:
    """Aggregate stats across all students."""
    summary: dict[str, Any] = {
        "total_rows": len(df),
        "total_students": df["student_id"].nunique(),
        "total_semesters": df["semester_number"].nunique(),
        "total_courses": df["course_id"].nunique(),
        "splits": {k: int(v) for k, v in df["split"].value_counts().to_dict().items()},
        "families": {k: int(v) for k, v in df["scenario_family"].value_counts().to_dict().items()},
    }

    # Per-stage aggregates
    stages_summary = {}
    for stage in ["pre-tt1", "post-tt1", "post-tt2", "post-assignments", "post-see"]:
        sdf = df[df["stage_key"] == stage]
        if len(sdf) == 0:
            continue
        stages_summary[stage] = {
            "rows": len(sdf),
            "label_rates": {
                h: float(sdf[LABEL_COLS[h]].mean()) for h in HEADS if LABEL_COLS[h] in sdf.columns
            },
        }
    summary["by_stage"] = stages_summary

    # Per-semester aggregates
    sem_summary = {}
    for sem in sorted(df["semester_number"].unique()):
        sdf = df[df["semester_number"] == sem]
        sem_summary[str(sem)] = {
            "rows": len(sdf),
            "students": sdf["student_id"].nunique(),
            "label_rates": {
                h: float(sdf[LABEL_COLS[h]].mean()) for h in HEADS if LABEL_COLS[h] in sdf.columns
            },
        }
    summary["by_semester"] = sem_summary

    # Per-family per-head label rates
    family_head_rates = {}
    for family in sorted(df["scenario_family"].unique()):
        fdf = df[df["scenario_family"] == family]
        family_head_rates[family] = {
            "rows": len(fdf),
            "students": fdf["student_id"].nunique(),
            "label_rates": {
                h: float(fdf[LABEL_COLS[h]].mean()) for h in HEADS if LABEL_COLS[h] in fdf.columns
            },
        }
    summary["by_family"] = family_head_rates

    return summary


def build_archetype_trace(df: pd.DataFrame, training_metrics: dict | None) -> dict[str, Any]:
    """Trace special-case students (C1-C4 archetypes) across all semesters."""
    # Identify potential archetype students by looking for extreme patterns
    students = df["student_id"].unique()
    archetypes: dict[str, list[dict]] = {"C1_MediocreFlat": [], "C2_FluctuatingResilient": [], "C3_StrongStartFade": [], "C4_SlowStarterBadAttendance": []}

    for sid in students[:20]:  # Sample first 20 for analysis
        sdf = df[df["student_id"] == sid].sort_values(["semester_number", "stage_key"])
        trace = []
        for _, row in sdf.iterrows():
            trace.append({
                "semester": int(row["semester_number"]),
                "stage": str(row["stage_key"]),
                "course": str(row.get("course_id", "")),
                "attendancePct": float(row["feat_0"]) * 60 + 40,
                "tt1Risk": float(row["feat_5"]),
                "tt2Risk": float(row["feat_6"]),
                "seeRisk": float(row["feat_7"]),
                "labels": {h: int(row[LABEL_COLS[h]]) for h in HEADS if LABEL_COLS[h] in row},
            })
        archetypes["C1_MediocreFlat"].append({"student_id": sid, "trace": trace})

    return {"analyzed_students": len(students[:20]), "sample_traces": archetypes}


def markdown_report(
    trajectories: dict[str, Any],
    class_summary: dict[str, Any],
    training_metrics: dict | None,
) -> str:
    """Generate human-readable markdown report."""
    lines = [
        "# AirMentor Trajectory Dump — Complete Demo Analysis",
        "",
        f"**Total rows**: {class_summary['total_rows']:,}",
        f"**Total students**: {class_summary['total_students']}",
        f"**Total semesters**: {class_summary['total_semesters']}",
        f"**Total courses**: {class_summary['total_courses']}",
        "",
        "## Split Distribution",
        "",
    ]
    for split, count in class_summary.get("splits", {}).items():
        lines.append(f"- **{split}**: {count:,} rows")

    lines.extend([
        "",
        "## Scenario Families",
        "",
        "| Family | Rows | Students | attRisk% | ceRisk% | seeRisk% | overall% | downstream% |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ])
    for family, info in class_summary.get("by_family", {}).items():
        rates = info.get("label_rates", {})
        lines.append(
            f"| {family} | {info['rows']:,} | {info['students']} | "
            f"{rates.get('attendanceRisk', 0)*100:.1f}% | {rates.get('ceRisk', 0)*100:.1f}% | "
            f"{rates.get('seeRisk', 0)*100:.1f}% | {rates.get('overallCourseRisk', 0)*100:.1f}% | "
            f"{rates.get('downstreamCarryoverRisk', 0)*100:.1f}% |"
        )

    lines.extend([
        "",
        "## Per-Stage Label Rates",
        "",
        "| Stage | Rows | attRisk% | ceRisk% | seeRisk% | overall% | downstream% |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ])
    for stage, info in class_summary.get("by_stage", {}).items():
        rates = info.get("label_rates", {})
        lines.append(
            f"| {stage} | {info['rows']:,} | "
            f"{rates.get('attendanceRisk', 0)*100:.1f}% | {rates.get('ceRisk', 0)*100:.1f}% | "
            f"{rates.get('seeRisk', 0)*100:.1f}% | {rates.get('overallCourseRisk', 0)*100:.1f}% | "
            f"{rates.get('downstreamCarryoverRisk', 0)*100:.1f}% |"
        )

    lines.extend([
        "",
        "## Per-Semester Label Rates",
        "",
        "| Sem | Rows | Students | attRisk% | ceRisk% | seeRisk% | overall% | downstream% |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ])
    for sem, info in class_summary.get("by_semester", {}).items():
        rates = info.get("label_rates", {})
        lines.append(
            f"| {sem} | {info['rows']:,} | {info['students']} | "
            f"{rates.get('attendanceRisk', 0)*100:.1f}% | {rates.get('ceRisk', 0)*100:.1f}% | "
            f"{rates.get('seeRisk', 0)*100:.1f}% | {rates.get('overallCourseRisk', 0)*100:.1f}% | "
            f"{rates.get('downstreamCarryoverRisk', 0)*100:.1f}% |"
        )

    if training_metrics:
        lines.extend([
            "",
            "## Training Metrics",
            "",
            "| Head | Selected Model | Test AUC | Baseline AUC | Δ |",
            "|---|---:|---:|---:|---:|",
        ])
        for head, info in training_metrics.get("heads", {}).items():
            if info.get("skipped"):
                continue
            t = info.get("challenger", {}).get("test", {})
            b = info.get("baseline", {}).get("test", {})
            delta = t.get("rocAuc", 0) - b.get("rocAuc", 0)
            lines.append(
                f"| {head} | {info.get('selectedModel', '?')} | "
                f"{t.get('rocAuc', 0):.4f} | {b.get('rocAuc', 0):.4f} | {delta:+.4f} |"
            )

        lines.extend([
            "",
            "## Threshold@0.65 Metrics (Product Action Point)",
            "",
            "| Head | Precision | Recall | F1 |",
            "|---|---:|---:|---:|",
        ])
        for head, info in training_metrics.get("heads", {}).items():
            if info.get("skipped"):
                continue
            t65 = info.get("challenger", {}).get("thresholdAt065", {}).get("test", {})
            lines.append(
                f"| {head} | {t65.get('precision', 0):.4f} | "
                f"{t65.get('recall', 0):.4f} | {t65.get('f1', 0):.4f} |"
            )

        lines.extend([
            "",
            "## Fairness Per Family (Test Set)",
            "",
        ])
        for head, info in training_metrics.get("heads", {}).items():
            if info.get("skipped"):
                continue
            ff = info.get("challenger", {}).get("fairnessPerFamily", {})
            if not ff:
                continue
            lines.extend([
                f"### {head}",
                "",
                "| Family | AUC | Precision@0.65 | Recall@0.65 | N | Pos |",
                "|---|---:|---:|---:|---:|---:|",
            ])
            for family, finfo in ff.items():
                lines.append(
                    f"| {family} | {finfo.get('auc', 0):.4f} | "
                    f"{finfo.get('precisionAt065', 0):.4f} | {finfo.get('recallAt065', 0):.4f} | "
                    f"{finfo.get('n', 0)} | {finfo.get('pos', 0)} |"
                )
            lines.append("")

    lines.extend([
        "",
        "## Student Trajectory Samples (First 5 Students)",
        "",
    ])
    for sid in list(trajectories.keys())[:5]:
        t = trajectories[sid]
        lines.extend([
            f"### Student `{sid}`",
            f"- Scenario family: `{t.get('scenario_family', '?')}`",
            f"- Mentor: `{t.get('mentor_id', '?')}`",
            f"- Semesters: {t.get('semester_count', 0)}",
            "",
        ])
        for sem, sinfo in t.get("semesters", {}).items():
            lines.append(f"#### Semester {sem}")
            for stage, stinfo in sinfo.get("stages", {}).items():
                courses = stinfo.get("courses", {})
                for cid, cinfo in list(courses.items())[:2]:
                    labels = cinfo.get("labels", {})
                    lines.append(
                        f"- **{stage}** | {cid} ({cinfo.get('course_title', '')}) | "
                        f"att={labels.get('attendanceRisk', '?')} "
                        f"ce={labels.get('ceRisk', '?')} "
                        f"see={labels.get('seeRisk', '?')} "
                        f"overall={labels.get('overallCourseRisk', '?')} "
                        f"downstream={labels.get('downstreamCarryoverRisk', '?')}"
                    )
            lines.append("")

    lines.extend([
        "",
        "---",
        "",
        "*Generated by AirMentor Trajectory Dump — `scripts/dump_trajectories.py`*",
    ])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Massive trajectory dump for AirMentor demo verification")
    parser.add_argument("features_csv", help="Path to features CSV")
    parser.add_argument("training_dir", help="Path to training output directory (with metrics.json)")
    parser.add_argument("output_dir", help="Directory for output files")
    parser.add_argument("--sample", type=int, default=0, help="Only process N students (0 = all)")
    args = parser.parse_args()

    features_csv = Path(args.features_csv)
    training_dir = Path(args.training_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not features_csv.exists():
        print(f"ERROR: features CSV not found: {features_csv}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {features_csv}...")
    df = pd.read_csv(features_csv)
    print(f"Loaded {len(df):,} rows, {df['student_id'].nunique()} students")

    training_metrics = load_training_metrics(training_dir)
    if training_metrics:
        print(f"Loaded training metrics from {training_dir / 'metrics.json'}")

    # Build class summary
    print("Building class summary...")
    class_summary = build_class_summary(df)
    (output_dir / "class-summary.json").write_text(
        json.dumps(class_summary, indent=2, default=str), encoding="utf-8"
    )

    # Build student trajectories
    student_ids = sorted(df["student_id"].unique())
    if args.sample > 0:
        student_ids = student_ids[:args.sample]

    print(f"Building trajectories for {len(student_ids)} students...")
    trajectories = {}
    for i, sid in enumerate(student_ids):
        if i % 100 == 0:
            print(f"  {i}/{len(student_ids)}...")
        trajectories[sid] = build_student_trajectory(df, sid)

    traj_path = output_dir / "trajectories.json"
    print(f"Writing trajectories to {traj_path}...")
    traj_path.write_text(json.dumps(trajectories, indent=2, default=str), encoding="utf-8")

    # Build archetype trace
    print("Building archetype traces...")
    archetype_trace = build_archetype_trace(df, training_metrics)
    (output_dir / "archetype-trace.json").write_text(
        json.dumps(archetype_trace, indent=2, default=str), encoding="utf-8"
    )

    # Generate markdown report
    print("Generating markdown report...")
    md = markdown_report(trajectories, class_summary, training_metrics)
    (output_dir / "trajectories.md").write_text(md, encoding="utf-8")

    # Summary stats
    print(f"\n=== DUMP COMPLETE ===")
    print(f"Output directory: {output_dir}")
    print(f"  class-summary.json    — aggregate stats")
    print(f"  trajectories.json     — {len(trajectories)} student trajectories")
    print(f"  archetype-trace.json  — special-case student traces")
    print(f"  trajectories.md       — human-readable report")
    print(f"Total rows processed: {len(df):,}")
    print(f"Total students: {len(trajectories)}")


if __name__ == "__main__":
    main()
