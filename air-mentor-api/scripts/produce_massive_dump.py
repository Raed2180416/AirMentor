#!/usr/bin/env python3
"""
AirMentor Massive Trajectory Dump & Critical Realism Analysis
===============================================================
Consumes the features.csv from a SOTA benchmark run and produces:
1. Student-by-student trajectories (all stages, all courses, all semesters)
2. Cross-semester carryover validation
3. Feature importance / SHAP-proxy analysis
4. Critical realism checks
5. Per-role view validation (HOD, Mentor, Course Leader)
6. Archetype analysis if special cohort columns exist
"""

import pandas as pd
import numpy as np
import json
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
FEATURES_CSV = sys.argv[1] if len(sys.argv) > 1 else "/home/raed/Projects/air-mentor-ui/air-mentor-api/output/proof-risk-model/sota-policy-benchmark-20260531T000827Z/features.csv"
OUTPUT_DIR = sys.argv[2] if len(sys.argv) > 2 else "/home/raed/Projects/air-mentor-ui/air-mentor-api/output/proof-risk-model/sota-policy-benchmark-20260531T000827Z/massive-dump"
os.makedirs(OUTPUT_DIR, exist_ok=True)

STUDENTS_TO_DUMP = 50  # Limit for detailed trajectories (all students in summary)

# Feature name mapping (from OBSERVABLE_FEATURE_KEYS v6)
FEATURE_NAMES = [
    "attendancePctScaled", "attendanceTrendScaled", "attendanceHistoryRiskScaled",
    "currentCgpaScaled", "backlogPressureScaled", "tt1RiskScaled", "tt2RiskScaled",
    "quizRiskScaled", "assignmentRiskScaled", "ceRiskScaled", "seeRiskScaled",
    "overallRiskScaled", "downstreamRiskScaled", "stageProgressScaled",
    "weakCoPressureScaled", "weakQuestionPressureScaled",
    "courseworkTtMismatchScaled", "ttMomentumRiskScaled",
    "interventionResidualRiskScaled", "prereq1RiskScaled", "prereq2RiskScaled",
    "prereq3RiskScaled", "prereqAvgRiskScaled", "semesterDifficultyScaled",
    "mathFoundationScaled", "computingFoundationScaled", "academicPotentialScaled",
    "selfRegulationScaled", "supportResponsivenessScaled", "examPressureScaled",
    "forgetRateScaled", "relearnRateScaled", "facultySeverityScaled",
    "facultyGenerosityScaled", "peerMeanScaled", "peerGapScaled",
    "sectionSizeScaled", "historicalBacklogScaled", "activeBacklogScaled",
    "backlogAttemptCountScaled", "lowerYearBlockerCreditsScaled",
    "seeEligibleScaled", "seeWrittenScaled", "gradePointScaled",
    "failureModeAttendanceScaled", "failureModeCeScaled", "failureModeSeeScaled",
    "failureModeOverallScaled",
]

# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------
print(f"[DUMP] Loading {FEATURES_CSV} ...")
df = pd.read_csv(FEATURES_CSV)
print(f"[DUMP] Loaded {len(df):,} rows, {len(df.columns)} columns")
print(f"[DUMP] Students: {df['student_id'].nunique()}, Courses: {df['course_id'].nunique()}")
print(f"[DUMP] Semesters: {sorted(df['semester_number'].unique())}")
print(f"[DUMP] Stages: {sorted(df['stage_key'].unique())}")

# ---------------------------------------------------------------------------
# Helper: Risk band from probability/label
# ---------------------------------------------------------------------------
def risk_band(prob):
    if prob >= 0.65:
        return "High"
    elif prob >= 0.40:
        return "Medium"
    return "Low"

# ---------------------------------------------------------------------------
# Section 1: Global Summary Statistics
# ---------------------------------------------------------------------------
print("[DUMP] Computing global summary ...")
summary_lines = []
summary_lines.append("# AirMentor MASSIVE ANALYSIS DUMP")
summary_lines.append(f"**Source:** `{FEATURES_CSV}`")
summary_lines.append(f"**Rows:** {len(df):,} | **Students:** {df['student_id'].nunique()} | **Courses:** {df['course_id'].nunique()}")
summary_lines.append("")

summary_lines.append("## 1. GLOBAL LABEL PREVALENCE BY STAGE")
summary_lines.append("")
summary_lines.append("| Stage | Rows | attRisk% | ceRisk% | seeRisk% | overall% | downstream% |")
summary_lines.append("|---|---:|---:|---:|---:|---:|---:|")
for stage in sorted(df['stage_key'].unique()):
    sub = df[df['stage_key'] == stage]
    summary_lines.append(
        f"| {stage} | {len(sub):,} | "
        f"{sub['label_attendance'].mean()*100:.1f}% | "
        f"{sub['label_ce'].mean()*100:.1f}% | "
        f"{sub['label_see'].mean()*100:.1f}% | "
        f"{sub['label_overall'].mean()*100:.1f}% | "
        f"{sub['label_downstream'].mean()*100:.1f}% |"
    )
summary_lines.append("")

summary_lines.append("## 2. GLOBAL LABEL PREVALENCE BY SEMESTER (POST-SEE)")
summary_lines.append("")
post = df[df['stage_key'] == 'post-see']
summary_lines.append("| Sem | Rows | attRisk% | ceRisk% | seeRisk% | overall% | downstream% | Avg Att% |")
summary_lines.append("|---|---:|---:|---:|---:|---:|---:|---:|")
for sem in sorted(post['semester_number'].unique()):
    sub = post[post['semester_number'] == sem]
    # Approximate attendance from feat_0 (attendancePctScaled -> reverse: att = 100 - feat_0*100)
    avg_att = (100 - sub['feat_0'].mean() * 100) if 'feat_0' in sub.columns else 0
    summary_lines.append(
        f"| {sem} | {len(sub):,} | "
        f"{sub['label_attendance'].mean()*100:.1f}% | "
        f"{sub['label_ce'].mean()*100:.1f}% | "
        f"{sub['label_see'].mean()*100:.1f}% | "
        f"{sub['label_overall'].mean()*100:.1f}% | "
        f"{sub['label_downstream'].mean()*100:.1f}% | "
        f"{avg_att:.1f}% |"
    )
summary_lines.append("")

# ---------------------------------------------------------------------------
# Section 2: Per-Family Analysis
# ---------------------------------------------------------------------------
summary_lines.append("## 3. PER-SCENARIO-FAMILY ANALYSIS (POST-SEE)")
summary_lines.append("")
summary_lines.append("| Family | Students | attRisk% | ceRisk% | seeRisk% | overall% | downstream% |")
summary_lines.append("|---|---:|---:|---:|---:|---:|---:|")
for fam in sorted(post['scenario_family'].unique()):
    sub = post[post['scenario_family'] == fam]
    n_students = sub['student_id'].nunique()
    summary_lines.append(
        f"| {fam} | {n_students} | "
        f"{sub['label_attendance'].mean()*100:.1f}% | "
        f"{sub['label_ce'].mean()*100:.1f}% | "
        f"{sub['label_see'].mean()*100:.1f}% | "
        f"{sub['label_overall'].mean()*100:.1f}% | "
        f"{sub['label_downstream'].mean()*100:.1f}% |"
    )
summary_lines.append("")

# ---------------------------------------------------------------------------
# Section 3: Feature Importance Proxy (correlation with labels)
# ---------------------------------------------------------------------------
summary_lines.append("## 4. FEATURE IMPORTANCE PROXY (Correlation with Labels)")
summary_lines.append("")
summary_lines.append("Correlation between each feature and each risk head label.")
summary_lines.append("")

feat_cols = [c for c in df.columns if c.startswith('feat_')]
importance = []
for head in ['label_attendance', 'label_ce', 'label_see', 'label_overall', 'label_downstream']:
    corr = df[feat_cols + [head]].corr()[head].drop(head)
    top = corr.abs().nlargest(10)
    summary_lines.append(f"### {head}")
    summary_lines.append("| Feature | Name | Correlation |")
    summary_lines.append("|---|---:|---:|")
    for feat, val in top.items():
        idx = int(feat.split('_')[1])
        name = FEATURE_NAMES[idx] if idx < len(FEATURE_NAMES) else feat
        summary_lines.append(f"| {feat} | {name} | {val:+.4f} |")
    summary_lines.append("")

# ---------------------------------------------------------------------------
# Section 4: Student Trajectories (Detailed)
# ---------------------------------------------------------------------------
summary_lines.append("## 5. STUDENT-BY-STUDENT TRAJECTORIES")
summary_lines.append(f"*(Showing first {STUDENTS_TO_DUMP} students with highest risk variance)*")
summary_lines.append("")

# Select students with highest risk variance across stages
student_risk_var = df.groupby('student_id')['label_overall'].var().fillna(0)
interesting_students = student_risk_var.nlargest(STUDENTS_TO_DUMP).index.tolist()

for sid in interesting_students:
    student_df = df[df['student_id'] == sid].sort_values(['semester_number', 'stage_key'])
    if len(student_df) == 0:
        continue
    fam = student_df['scenario_family'].iloc[0]
    summary_lines.append(f"### {sid} (Family: {fam})")
    summary_lines.append("")
    summary_lines.append("| Sem | Stage | Course | AttRisk | CERisk | SEERisk | Overall | Downstream |")
    summary_lines.append("|---|---:|---|---|---:|---:|---:|---:|---:|")
    for _, row in student_df.iterrows():
        summary_lines.append(
            f"| {row['semester_number']} | {row['stage_key']} | {row['course_code']} | "
            f"{row['label_attendance']} | {row['label_ce']} | {row['label_see']} | "
            f"{row['label_overall']} | {row['label_downstream']} |"
        )
    summary_lines.append("")

# ---------------------------------------------------------------------------
# Section 5: Cross-Semester Carryover Validation
# ---------------------------------------------------------------------------
summary_lines.append("## 6. CROSS-SEMESTER CARRYOVER VALIDATION")
summary_lines.append("")
summary_lines.append("This section validates how prior-semester risk propagates into current-semester risk.")
summary_lines.append("")

post_sem = df[df['stage_key'] == 'post-see'].sort_values(['student_id', 'semester_number'])
carryover_checks = []

for sid in post_sem['student_id'].unique()[:200]:  # Sample
    student_post = post_sem[post_sem['student_id'] == sid]
    for i in range(1, len(student_post)):
        prev = student_post.iloc[i-1]
        curr = student_post.iloc[i]
        prev_failed = prev['label_overall'] == 1
        prev_downstream = prev['label_downstream'] == 1
        curr_att = curr['label_attendance'] == 1
        curr_overall = curr['label_overall'] == 1
        curr_downstream = curr['label_downstream'] == 1
        carryover_checks.append({
            'student_id': sid,
            'from_sem': prev['semester_number'],
            'to_sem': curr['semester_number'],
            'prev_failed': prev_failed,
            'prev_downstream': prev_downstream,
            'curr_att': curr_att,
            'curr_overall': curr_overall,
            'curr_downstream': curr_downstream,
        })

if carryover_checks:
    carryover_df = pd.DataFrame(carryover_checks)
    summary_lines.append("| Transition | Count | % with prev fail | % with prev downstream | % curr attRisk | % curr overall |")
    summary_lines.append("|---|---:|---:|---:|---:|---:|")
    
    for from_sem in sorted(carryover_df['from_sem'].unique()):
        sub = carryover_df[carryover_df['from_sem'] == from_sem]
        summary_lines.append(
            f"| Sem {from_sem} → {from_sem+1} | {len(sub)} | "
            f"{sub['prev_failed'].mean()*100:.1f}% | "
            f"{sub['prev_downstream'].mean()*100:.1f}% | "
            f"{sub['curr_att'].mean()*100:.1f}% | "
            f"{sub['curr_overall'].mean()*100:.1f}% |"
        )
    
    # Conditional: if prev failed, what's curr risk?
    prev_failed = carryover_df[carryover_df['prev_failed'] == True]
    if len(prev_failed) > 0:
        summary_lines.append(f"| **Given prev failed** | {len(prev_failed)} | - | - | {prev_failed['curr_att'].mean()*100:.1f}% | {prev_failed['curr_overall'].mean()*100:.1f}% |")
    
    prev_ok = carryover_df[carryover_df['prev_failed'] == False]
    if len(prev_ok) > 0:
        summary_lines.append(f"| **Given prev passed** | {len(prev_ok)} | - | - | {prev_ok['curr_att'].mean()*100:.1f}% | {prev_ok['curr_overall'].mean()*100:.1f}% |")
    
    summary_lines.append("")

# ---------------------------------------------------------------------------
# Section 6: Critical Realism Checks
# ---------------------------------------------------------------------------
summary_lines.append("## 7. CRITICAL REALISM CHECKS")
summary_lines.append("")

issues = []

# Check 1: Attendance risk should correlate with low attendance
if 'feat_0' in df.columns:
    # feat_0 = attendancePctScaled (lower = higher risk)
    att_corr = df[['feat_0', 'label_attendance']].corr().iloc[0, 1]
    issues.append(f"- **Attendance feature-label correlation:** {att_corr:.4f} (expected negative, |corr| > 0.3)")

# Check 2: Overall risk should be >= max of component risks (monotonicity)
for stage in df['stage_key'].unique():
    sub = df[df['stage_key'] == stage]
    max_component = sub[['label_attendance', 'label_ce', 'label_see']].max(axis=1)
    violation = (sub['label_overall'] < max_component).mean() * 100
    if violation > 5:
        issues.append(f"- **Monotonicity violation at {stage}:** {violation:.1f}% of rows have overallRisk < max(componentRisk)")

# Check 3: SEE risk at pre-tt1 should not be 100%
pre = df[df['stage_key'] == 'pre-tt1']
see_pre = pre['label_see'].mean() * 100
issues.append(f"- **SEE risk at pre-tt1:** {see_pre:.1f}% (should be < 20%, no SEE evidence yet)")

# Check 4: CE risk should increase from pre-tt1 to post-assignments
pre_ce = df[df['stage_key'] == 'pre-tt1']['label_ce'].mean()
post_assign_ce = df[df['stage_key'] == 'post-assignments']['label_ce'].mean()
issues.append(f"- **CE risk evolution:** pre-tt1={pre_ce*100:.1f}% → post-assignments={post_assign_ce*100:.1f}% (should increase)")

# Check 5: Downstream risk should decrease in later semesters
s1_down = post[post['semester_number'] == 1]['label_downstream'].mean()
s6_down = post[post['semester_number'] == 6]['label_downstream'].mean()
issues.append(f"- **Downstream risk by semester:** Sem1={s1_down*100:.1f}% → Sem6={s6_down*100:.1f}% (should decrease or Sem6=0)")

# Check 6: Stage progression realism
for stage in ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see']:
    sub = df[df['stage_key'] == stage]
    overall_mean = sub['label_overall'].mean()
    issues.append(f"- **Overall risk at {stage}:** {overall_mean*100:.1f}%")

for issue in issues:
    summary_lines.append(issue)
summary_lines.append("")

# ---------------------------------------------------------------------------
# Section 7: Per-Role View Validation
# ---------------------------------------------------------------------------
summary_lines.append("## 8. PER-ROLE VIEW VALIDATION")
summary_lines.append("")

# HOD view: all students, all courses, all heads
summary_lines.append("### HOD View (All Students, All Courses)")
summary_lines.append(f"- Total students visible: {df['student_id'].nunique()}")
summary_lines.append(f"- Total courses visible: {df['course_id'].nunique()}")
summary_lines.append(f"- Risk heads available: 5 (attendance, CE, SEE, overall, downstream)")
summary_lines.append("")

# Mentor view: assigned mentees, overall risk across courses
summary_lines.append("### Mentor View (Per-Mentee Cross-Course)")
mentor_groups = df.groupby('mentor_id')['student_id'].nunique()
summary_lines.append(f"- Unique mentors: {df['mentor_id'].nunique()}")
summary_lines.append(f"- Avg mentees per mentor: {mentor_groups.mean():.1f}")
summary_lines.append(f"- Max mentees per mentor: {mentor_groups.max()}")
summary_lines.append("")

# Course Leader view: per-course risk
summary_lines.append("### Course Leader View (Per-Course)")
cl_groups = df.groupby('course_leader_id')['course_id'].nunique()
summary_lines.append(f"- Unique course leaders: {df['course_leader_id'].nunique()}")
summary_lines.append(f"- Avg courses per CL: {cl_groups.mean():.1f}")
summary_lines.append("")

# ---------------------------------------------------------------------------
# Section 8: Intervention Bounds Check
# ---------------------------------------------------------------------------
summary_lines.append("## 9. INTERVENTION REALISM BOUNDS")
summary_lines.append("")
summary_lines.append("Intervention effect magnitude constraints:")
summary_lines.append("- Single intervention should reduce risk score by at most 10-15 points on 0-100 scale")
summary_lines.append("- Multiple sustained interventions over 2+ stages may produce larger cumulative effect")
summary_lines.append("- If model reacts with >20 point single-step drop, flag as P1 issue")
summary_lines.append("")
summary_lines.append("**Validation:** (Requires UI interaction — offline analysis uses label-based proxy)")
summary_lines.append("- Students with label_attendance=1 and label_overall=0: potential false negative for intervention need")
summary_lines.append("- Students with label_overall=1 and all component labels=0: check for unrealistic composite risk")

# Find potential composite-only risks
composite_only = df[
    (df['label_overall'] == 1) &
    (df['label_attendance'] == 0) &
    (df['label_ce'] == 0) &
    (df['label_see'] == 0)
]
summary_lines.append(f"- **Composite-only overall risk rows:** {len(composite_only)} / {len(df)} ({len(composite_only)/len(df)*100:.2f}%)")
if len(composite_only) > 0:
    by_stage = composite_only.groupby('stage_key').size()
    summary_lines.append(f"  By stage: {dict(by_stage)}")
summary_lines.append("")

# ---------------------------------------------------------------------------
# Section 9: Archetype Analysis (if special cohort columns exist)
# ---------------------------------------------------------------------------
summary_lines.append("## 10. SPECIAL COHORT / ARCHETYPE ANALYSIS")
summary_lines.append("")

if 'archetype' in df.columns and 'special_cohort' in df.columns:
    summary_lines.append("Special cohort columns found in data.")
    for cohort in sorted(df['special_cohort'].dropna().unique()):
        sub = df[(df['special_cohort'] == cohort) & (df['stage_key'] == 'post-see')]
        summary_lines.append(f"### Cohort {cohort} (n={sub['student_id'].nunique()} students)")
        for arch in sorted(sub['archetype'].dropna().unique()):
            arch_sub = sub[sub['archetype'] == arch]
            summary_lines.append(f"- **{arch}**: overallRisk={arch_sub['label_overall'].mean()*100:.1f}%, "
                                f"attRisk={arch_sub['label_attendance'].mean()*100:.1f}%, "
                                f"ceRisk={arch_sub['label_ce'].mean()*100:.1f}%")
        summary_lines.append("")
else:
    summary_lines.append("No special cohort/archetype columns found in features.csv.")
    summary_lines.append("To enable archetype analysis, run the data generator with archetype overlays.")
    summary_lines.append("")

# ---------------------------------------------------------------------------
# Section 10: Queue Pressure Simulation
# ---------------------------------------------------------------------------
summary_lines.append("## 11. QUEUE PRESSURE SIMULATION")
summary_lines.append("")
summary_lines.append("Simulated queue population per role based on risk thresholds.")
summary_lines.append("")

# High risk = label == 1 (using ground truth as proxy)
for stage in ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see']:
    sub = df[df['stage_key'] == stage]
    at_risk = sub[sub['label_overall'] == 1]
    
    summary_lines.append(f"### {stage}")
    summary_lines.append(f"- Total at-risk students: {at_risk['student_id'].nunique()} / {sub['student_id'].nunique()}")
    
    # Per course leader queue
    cl_queue = at_risk.groupby('course_leader_id')['student_id'].nunique()
    summary_lines.append(f"- Avg queue per Course Leader: {cl_queue.mean():.1f} (max: {cl_queue.max()})")
    
    # Per mentor queue
    mentor_queue = at_risk.groupby('mentor_id')['student_id'].nunique()
    summary_lines.append(f"- Avg queue per Mentor: {mentor_queue.mean():.1f} (max: {mentor_queue.max()})")
    
    # Per HOD queue (all at-risk)
    hod_queue = at_risk.groupby('hod_id')['student_id'].nunique()
    summary_lines.append(f"- Avg queue per HOD: {hod_queue.mean():.1f}")
    summary_lines.append("")

# ---------------------------------------------------------------------------
# Write output
# ---------------------------------------------------------------------------
output_md = os.path.join(OUTPUT_DIR, "massive-analysis-dump.md")
with open(output_md, "w") as f:
    f.write("\n".join(summary_lines))
print(f"[DUMP] Wrote {output_md}")

# Also write a compact JSON for programmatic access
json_data = {
    "source": FEATURES_CSV,
    "rows": len(df),
    "students": int(df['student_id'].nunique()),
    "courses": int(df['course_id'].nunique()),
    "label_prevalence": {
        stage: {
            "attendance": float(df[df['stage_key']==stage]['label_attendance'].mean()),
            "ce": float(df[df['stage_key']==stage]['label_ce'].mean()),
            "see": float(df[df['stage_key']==stage]['label_see'].mean()),
            "overall": float(df[df['stage_key']==stage]['label_overall'].mean()),
            "downstream": float(df[df['stage_key']==stage]['label_downstream'].mean()),
        }
        for stage in sorted(df['stage_key'].unique())
    },
    "student_trajectories": [
        {
            "student_id": sid,
            "family": str(student_df['scenario_family'].iloc[0]),
            "trajectory": [
                {
                    "semester": int(row['semester_number']),
                    "stage": str(row['stage_key']),
                    "course": str(row['course_code']),
                    "attRisk": int(row['label_attendance']),
                    "ceRisk": int(row['label_ce']),
                    "seeRisk": int(row['label_see']),
                    "overallRisk": int(row['label_overall']),
                    "downstreamRisk": int(row['label_downstream']),
                }
                for _, row in student_df.iterrows()
            ]
        }
        for sid, student_df in df[df['student_id'].isin(interesting_students)].groupby('student_id')
    ],
}
json_path = os.path.join(OUTPUT_DIR, "massive-analysis-dump.json")
with open(json_path, "w") as f:
    json.dump(json_data, f, indent=2, default=str)
print(f"[DUMP] Wrote {json_path}")

print("[DUMP] ALL DONE")
