#!/usr/bin/env python3
"""
Archetype Benchmark Orchestrator
================================
Generates synthetic data with specific classroom distributions and archetypes,
trains the SOTA ensemble, and produces a massive analysis dump.

Classroom Distributions:
- Average: 80 mid (14-20/25 TT1), 20 high (21-25), 20 low (0-13)
- Hard:    60 mid, 10 high, 50 low
- Easy:    60 mid, 50 high, 10 low

Special Cohort (10 students per rotation):
- C1: Mediocre-Flat — mediocre across ALL components
- C2: Fluctuating-Resilient — good TT1, mid TT2, good CE, good SEE
- C3: Strong Start, Fade — good TT1, bad TT2, mid everything else
- C4: Slow Starter, Bad Attendance — bad TT1, good TT2, good SEE, BAD attendance

Rotation: Sem 1-3 has cohort A (10 students). Sem 4-6 has cohort B (10 new students).
"""

import subprocess
import sys
import json
import os
import tempfile
import shutil

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "output", "proof-risk-model", "archetype-benchmark-20260531")
os.makedirs(OUTPUT_DIR, exist_ok=True)

SCENARIOS = [
    {"name": "average", "mid": 80, "high": 20, "low": 20},
    {"name": "hard",    "mid": 60, "high": 10, "low": 50},
    {"name": "easy",    "mid": 60, "high": 50, "low": 10},
]

STUDENTS = 120
SEMESTERS = 6
SEED = 42

PYTHON = os.path.join(BASE_DIR, ".venv", "bin", "python")

# ---------------------------------------------------------------------------
# Step 1: Generate base data
# ---------------------------------------------------------------------------
def generate_base_data(output_csv: str) -> bool:
    """Run the v2 generator to produce base synthetic data."""
    cmd = [
        PYTHON,
        os.path.join(BASE_DIR, "scripts", "generate_v2_data.py"),
        output_csv,
        "--students", str(STUDENTS),
        "--semesters", str(SEMESTERS),
        "--seed", str(SEED),
    ]
    print(f"[GEN] Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[GEN] FAILED:\n{result.stderr}")
        return False
    print(f"[GEN] OK — wrote {output_csv}")
    return True

# ---------------------------------------------------------------------------
# Step 2: Post-process with archetypes & classroom distributions
# ---------------------------------------------------------------------------
def postprocess_archetypes(input_csv: str, output_csv: str, scenario: dict):
    """
    Post-process base data to enforce:
    1. Classroom distribution (mid/high/low bands)
    2. Special cohort archetypes (C1-C4)
    3. Cohort rotation at Semester 4
    """
    import pandas as pd
    import numpy as np

    df = pd.read_csv(input_csv)

    # We only need post-SEE rows to know student IDs and their base performance
    post_see = df[df["stage_key"] == "post-see"].copy()
    student_ids = post_see["student_id"].unique()
    n = len(student_ids)
    print(f"[POST] Found {n} unique students")

    # Assign performance bands
    # For average classroom: we need to look at overall performance across courses
    student_overall = post_see.groupby("student_id")["overallMark"].mean().sort_values()

    # Assign bands based on scenario proportions
    mid_n = scenario["mid"]
    high_n = scenario["high"]
    low_n = scenario["low"]

    # Low performers = lowest overall marks
    low_ids = set(student_overall.index[:low_n])
    # High performers = highest overall marks
    high_ids = set(student_overall.index[-high_n:])
    # Mid = everyone else
    mid_ids = set(student_overall.index[low_n:-high_n])

    print(f"[POST] Bands: low={len(low_ids)}, mid={len(mid_ids)}, high={len(high_ids)}")

    # Assign special cohort A (Sem 1-3): 10 students from the pool
    rng = np.random.default_rng(SEED)
    special_pool = list(student_ids)
    rng.shuffle(special_pool)
    cohort_a = set(special_pool[:10])
    cohort_b = set(special_pool[10:20])  # Rotation: new 10 for Sem 4-6

    # Assign archetypes within cohort A and B
    # C1: 2-3 students, C2: 2-3, C3: 2-3, C4: 2-3
    archetype_counts = {"C1": 3, "C2": 3, "C3": 2, "C4": 2}
    cohort_a_list = list(cohort_a)
    cohort_b_list = list(cohort_b)
    rng.shuffle(cohort_a_list)
    rng.shuffle(cohort_b_list)

    student_archetype = {}
    idx = 0
    for arch, count in archetype_counts.items():
        for _ in range(count):
            if idx < len(cohort_a_list):
                student_archetype[cohort_a_list[idx]] = ("A", arch)
                idx += 1
    idx = 0
    for arch, count in archetype_counts.items():
        for _ in range(count):
            if idx < len(cohort_b_list):
                student_archetype[cohort_b_list[idx]] = ("B", arch)
                idx += 1

    # Add metadata columns
    df["performance_band"] = df["student_id"].apply(
        lambda sid: "low" if sid in low_ids else ("high" if sid in high_ids else "mid")
    )
    df["special_cohort"] = df["student_id"].apply(
        lambda sid: student_archetype.get(sid, (None, None))[0]
    )
    df["archetype"] = df["student_id"].apply(
        lambda sid: student_archetype.get(sid, (None, None))[1]
    )

    # Apply archetype score overrides
    # We modify the raw scores at the post-see level, then recompute CE/SEE/Overall
    # For non-post-see stages, we also need to update the observed scores

    def apply_archetype_override(row):
        sid = row["student_id"]
        sem = row["semester_number"]
        stage = row["stage_key"]
        arch = row.get("archetype")

        if pd.isna(arch):
            return row

        # Only apply for semesters where cohort is active
        cohort = row["special_cohort"]
        if cohort == "A" and sem > 3:
            return row  # Cohort A rotated out
        if cohort == "B" and sem <= 3:
            return row  # Cohort B not yet active

        # Archetype score definitions (percentages, 0-100 scale)
        # TT1 out of 25 -> pct = (mark/25)*100
        archetype_scores = {
            "C1": {"tt1": 52, "tt2": 50, "quiz": 50, "assignment": 50, "see": 50, "attendance": 65},
            "C2": {"tt1": 78, "tt2": 58, "quiz": 75, "assignment": 75, "see": 78, "attendance": 85},
            "C3": {"tt1": 78, "tt2": 42, "quiz": 55, "assignment": 55, "see": 58, "attendance": 70},
            "C4": {"tt1": 42, "tt2": 72, "quiz": 58, "assignment": 58, "see": 72, "attendance": 55},
        }

        scores = archetype_scores[arch]
        noise = rng.normal(0, 4)  # ±4% noise for realism

        # Override raw percentages (only for post-see where all evidence exists)
        if stage == "post-see":
            row["tt1Pct"] = self_clamp(scores["tt1"] + noise, 8, 96)
            row["tt2Pct"] = self_clamp(scores["tt2"] + noise, 8, 98)
            row["quizPct"] = self_clamp(scores["quiz"] + noise, 8, 98)
            row["assignmentPct"] = self_clamp(scores["assignment"] + noise, 8, 98)
            row["seePct"] = self_clamp(scores["see"] + noise, 8, 96)
            row["attendancePct"] = self_clamp(scores["attendance"] + noise, 35, 98)

            # Recompute CE
            row["cePct"] = round(row["tt1Pct"] * 0.25 + row["tt2Pct"] * 0.25 + row["quizPct"] * 0.25 + row["assignmentPct"] * 0.25)

            # Recompute eligibility and outcomes
            att_elig = row["attendancePct"] >= 75
            ce_elig = row["cePct"] >= 40
            see_elig = att_elig and ce_elig

            if see_elig:
                row["seePct"] = round(row["seePct"])
                row["overallMark"] = round(row["cePct"] * 0.60 + row["seePct"] * 0.40)
                row["passed"] = row["overallMark"] >= 40
                if row["seePct"] < 35:
                    row["failureMode"] = "see_fail"
                elif row["overallMark"] < 40:
                    row["failureMode"] = "overall_fail"
                else:
                    row["failureMode"] = None
            else:
                row["seePct"] = None
                row["overallMark"] = None
                row["passed"] = False
                row["failureMode"] = "attendance" if not att_elig else "ce_ineligible"

        return row

    def self_clamp(v, lo, hi):
        return max(lo, min(hi, v))

    # Apply overrides
    df = df.apply(apply_archetype_override, axis=1)

    # Write output
    df.to_csv(output_csv, index=False)
    print(f"[POST] Wrote {output_csv}")
    print(f"[POST] Special cohort A: {df[df['special_cohort']=='A']['student_id'].nunique()} students")
    print(f"[POST] Special cohort B: {df[df['special_cohort']=='B']['student_id'].nunique()} students")
    return output_csv

# ---------------------------------------------------------------------------
# Step 3: Run training
# ---------------------------------------------------------------------------
def run_training(features_csv: str, output_dir: str) -> bool:
    """Run the SOTA ensemble trainer."""
    cmd = [
        PYTHON,
        os.path.join(BASE_DIR, "scripts", "train_sota_ensemble.py"),
        "--features", features_csv,
        "--output-dir", output_dir,
        "--device", "cpu",
    ]
    print(f"[TRAIN] Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[TRAIN] FAILED:\n{result.stderr}")
        return False
    print(f"[TRAIN] OK — artifacts in {output_dir}")
    return True

# ---------------------------------------------------------------------------
# Step 4: Produce massive analysis dump
# ---------------------------------------------------------------------------
def produce_dump(features_csv: str, metrics_json: str, output_md: str, scenario: dict):
    """Produce the massive trajectory analysis dump."""
    import pandas as pd

    df = pd.read_csv(features_csv)
    with open(metrics_json, "r") as f:
        metrics = json.load(f)

    lines = []
    lines.append("# AirMentor Archetype Benchmark — MASSIVE ANALYSIS DUMP")
    lines.append(f"**Scenario:** {scenario['name']} classroom ({scenario['mid']} mid / {scenario['high']} high / {scenario['low']} low)")
    lines.append(f"**Students:** {STUDENTS} | **Semesters:** {SEMESTERS} | **Seed:** {SEED}")
    lines.append("")

    # ML Metrics
    lines.append("## 1. ML MODEL PERFORMANCE")
    lines.append("")
    for head, data in metrics.items():
        if isinstance(data, dict) and "auc" in data:
            lines.append(f"### {head}")
            lines.append(f"- AUC: {data.get('auc', 'N/A')}")
            lines.append(f"- Brier: {data.get('brier', 'N/A')}")
            lines.append(f"- Precision@50: {data.get('precision_50', 'N/A')}")
            lines.append(f"- Recall@50: {data.get('recall_50', 'N/A')}")
            lines.append(f"- F1@50: {data.get('f1_50', 'N/A')}")
            lines.append("")

    # Global distributions
    lines.append("## 2. GLOBAL DISTRIBUTIONS (Post-SEE)")
    post = df[df["stage_key"] == "post-see"]
    lines.append(f"- Total rows: {len(post)}")
    lines.append(f"- Mean attendance: {post['attendancePct'].mean():.1f}%")
    lines.append(f"- % below 75% attendance: {(post['attendancePct'] < 75).mean()*100:.1f}%")
    lines.append(f"- Mean overall: {post['overallMark'].dropna().mean():.1f}")
    lines.append(f"- Course failure rate: {(post['passed'] == False).mean()*100:.1f}%")
    lines.append("")

    # Per-family distributions
    lines.append("## 3. PER-FAMILY POST-SEE RISK")
    for family in sorted(df["scenario_family"].unique()):
        sub = post[post["scenario_family"] == family]
        lines.append(f"### {family}")
        for col in ["label_attendance", "label_ce", "label_see", "label_overall", "label_downstream"]:
            if col in sub.columns:
                lines.append(f"- {col}: {sub[col].mean()*100:.1f}%")
        lines.append("")

    # Archetype analysis
    lines.append("## 4. SPECIAL COHORT ANALYSIS")
    for cohort in ["A", "B"]:
        sub = df[(df["special_cohort"] == cohort) & (df["stage_key"] == "post-see")]
        if len(sub) > 0:
            lines.append(f"### Cohort {cohort}")
            for arch in ["C1", "C2", "C3", "C4"]:
                arch_sub = sub[sub["archetype"] == arch]
                if len(arch_sub) > 0:
                    lines.append(f"#### {arch} (n={len(arch_sub)})")
                    lines.append(f"- Mean overall: {arch_sub['overallMark'].dropna().mean():.1f}")
                    lines.append(f"- Mean attendance: {arch_sub['attendancePct'].mean():.1f}%")
                    lines.append(f"- Failure rate: {(arch_sub['passed'] == False).mean()*100:.1f}%")
                    lines.append("")

    # Student-by-student trajectories
    lines.append("## 5. STUDENT-BY-STUDENT TRAJECTORIES")
    special_students = df[df["special_cohort"].notna()]["student_id"].unique()
    for sid in sorted(special_students)[:20]:  # Limit to first 20 for brevity
        lines.append(f"### {sid}")
        student_df = df[df["student_id"] == sid].sort_values(["semester_number", "stage_key"])
        for _, row in student_df.iterrows():
            lines.append(f"- Sem{row['semester_number']} {row['stage_key']}: overallRisk={row['label_overall']}, attRisk={row['label_attendance']}, ceRisk={row['label_ce']}, seeRisk={row['label_see']}")
        lines.append("")

    with open(output_md, "w") as f:
        f.write("\n".join(lines))
    print(f"[DUMP] Wrote {output_md}")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("AirMentor Archetype Benchmark Orchestrator")
    print("=" * 60)

    # Generate base data once
    base_csv = os.path.join(OUTPUT_DIR, "base-v2.csv")
    if not generate_base_data(base_csv):
        print("[FATAL] Base generation failed")
        sys.exit(1)

    for scenario in SCENARIOS:
        print(f"\n{'='*60}")
        print(f"SCENARIO: {scenario['name'].upper()}")
        print(f"{'='*60}")

        scenario_dir = os.path.join(OUTPUT_DIR, scenario["name"])
        os.makedirs(scenario_dir, exist_ok=True)

        # Post-process
        proc_csv = os.path.join(scenario_dir, "features.csv")
        postprocess_archetypes(base_csv, proc_csv, scenario)

        # Train
        train_dir = os.path.join(scenario_dir, "training")
        # run_training(proc_csv, train_dir)  # Uncomment when ready

        # Dump
        # metrics_json = os.path.join(train_dir, "metrics.json")
        # dump_md = os.path.join(scenario_dir, "massive-dump.md")
        # produce_dump(proc_csv, metrics_json, dump_md, scenario)

    print("\n[ALL DONE]")

if __name__ == "__main__":
    main()
