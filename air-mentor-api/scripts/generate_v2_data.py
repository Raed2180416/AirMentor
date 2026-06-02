"""
Simulator v2 data generator for AirMentor proof-risk-model.

Implements the non-linear interaction terms, threshold effects, peer effects,
and instructor grading curves from msruas-proof-control-plane.ts:1959-2100.

Generates a CSV matching the 48-feature format (v6 schema) expected by train_sota_ensemble.py.

Usage:
    python generate_v2_data.py <output_csv> [--students N] [--semesters S] [--seed SEED]
"""

import argparse
import hashlib
import sys
from pathlib import Path

import numpy as np
import pandas as pd

DETERMINISTIC_SEED = 42

# ── Scenario families ──
SCENARIO_FAMILIES = [
    "balanced", "weak-foundation", "low-attendance", "high-forgetting",
    "coursework-inflation", "exam-fragility", "carryover-heavy", "intervention-resistant",
    "chronic-absentee", "attendance-shock", "mental-health-disruption",
]

TRAIN_FAMILIES = ["coursework-inflation", "high-forgetting", "low-attendance", "weak-foundation", "chronic-absentee"]
VAL_FAMILIES = ["exam-fragility", "carryover-heavy", "attendance-shock"]
TEST_FAMILIES = ["balanced", "intervention-resistant", "mental-health-disruption"]

# ── 48 feature names (matching OBSERVABLE_FEATURE_KEYS v6) ──
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

# ── Course catalog (simplified from M&C 2023 curriculum) ──
COURSE_CATALOG = [
    # Sem 1
    {"id": "MAT101", "title": "Engineering Mathematics I", "sem": 1, "credits": 4,
     "mathWeight": 0.95, "computingWeight": 0.05, "isLab": False, "prereqs": []},
    {"id": "CSE101", "title": "Introduction to Programming", "sem": 1, "credits": 4,
     "mathWeight": 0.30, "computingWeight": 0.70, "isLab": True, "prereqs": []},
    {"id": "PHY101", "title": "Engineering Physics", "sem": 1, "credits": 4,
     "mathWeight": 0.60, "computingWeight": 0.05, "isLab": True, "prereqs": []},
    {"id": "ENG101", "title": "Technical Communication", "sem": 1, "credits": 3,
     "mathWeight": 0.05, "computingWeight": 0.05, "isLab": False, "prereqs": []},
    {"id": "EEE101", "title": "Basic Electrical Engineering", "sem": 1, "credits": 3,
     "mathWeight": 0.40, "computingWeight": 0.10, "isLab": True, "prereqs": []},
    # Sem 2
    {"id": "MAT201", "title": "Engineering Mathematics II", "sem": 2, "credits": 4,
     "mathWeight": 0.95, "computingWeight": 0.05, "isLab": False, "prereqs": ["MAT101"]},
    {"id": "CSE201", "title": "Data Structures", "sem": 2, "credits": 4,
     "mathWeight": 0.25, "computingWeight": 0.75, "isLab": True, "prereqs": ["CSE101"]},
    {"id": "CSE202", "title": "Digital Logic Design", "sem": 2, "credits": 3,
     "mathWeight": 0.35, "computingWeight": 0.55, "isLab": True, "prereqs": []},
    {"id": "HSS201", "title": "Engineering Economics", "sem": 2, "credits": 3,
     "mathWeight": 0.20, "computingWeight": 0.05, "isLab": False, "prereqs": []},
    # Sem 3
    {"id": "MAT301", "title": "Probability and Statistics", "sem": 3, "credits": 4,
     "mathWeight": 0.90, "computingWeight": 0.10, "isLab": False, "prereqs": ["MAT201"]},
    {"id": "CSE301", "title": "Computer Organization", "sem": 3, "credits": 4,
     "mathWeight": 0.20, "computingWeight": 0.70, "isLab": True, "prereqs": ["CSE202"]},
    {"id": "CSE302", "title": "Object Oriented Programming", "sem": 3, "credits": 4,
     "mathWeight": 0.15, "computingWeight": 0.80, "isLab": True, "prereqs": ["CSE201"]},
    {"id": "CSE303", "title": "Discrete Mathematics", "sem": 3, "credits": 3,
     "mathWeight": 0.85, "computingWeight": 0.15, "isLab": False, "prereqs": ["MAT101"]},
    # Sem 4
    {"id": "CSE401", "title": "Operating Systems", "sem": 4, "credits": 4,
     "mathWeight": 0.15, "computingWeight": 0.75, "isLab": True, "prereqs": ["CSE301"]},
    {"id": "CSE402", "title": "Database Systems", "sem": 4, "credits": 4,
     "mathWeight": 0.20, "computingWeight": 0.70, "isLab": True, "prereqs": ["CSE302"]},
    {"id": "CSE403", "title": "Design & Analysis of Algorithms", "sem": 4, "credits": 4,
     "mathWeight": 0.60, "computingWeight": 0.40, "isLab": False, "prereqs": ["CSE201", "CSE303"]},
    {"id": "MAT401", "title": "Numerical Methods", "sem": 4, "credits": 3,
     "mathWeight": 0.80, "computingWeight": 0.20, "isLab": True, "prereqs": ["MAT301"]},
    # Sem 5
    {"id": "CSE501", "title": "Computer Networks", "sem": 5, "credits": 4,
     "mathWeight": 0.20, "computingWeight": 0.70, "isLab": True, "prereqs": ["CSE401"]},
    {"id": "CSE502", "title": "Machine Learning", "sem": 5, "credits": 4,
     "mathWeight": 0.55, "computingWeight": 0.45, "isLab": True, "prereqs": ["MAT301", "CSE403"]},
    {"id": "CSE503", "title": "Software Engineering", "sem": 5, "credits": 3,
     "mathWeight": 0.10, "computingWeight": 0.60, "isLab": False, "prereqs": ["CSE402"]},
    # Sem 6
    {"id": "CSE601", "title": "Compiler Design", "sem": 6, "credits": 4,
     "mathWeight": 0.40, "computingWeight": 0.55, "isLab": True, "prereqs": ["CSE403"]},
    {"id": "CSE602", "title": "Distributed Systems", "sem": 6, "credits": 4,
     "mathWeight": 0.15, "computingWeight": 0.75, "isLab": True, "prereqs": ["CSE501"]},
    {"id": "CSE603", "title": "Capstone Project I", "sem": 6, "credits": 6,
     "mathWeight": 0.20, "computingWeight": 0.60, "isLab": True,
     "prereqs": ["CSE502", "CSE503"]},
]


class SimulatorV2:
    """Reimplementation of msruas-proof-control-plane.ts simulator v2."""

    def __init__(self, seed: int = DETERMINISTIC_SEED, version: str = "v2"):
        self.rng = np.random.default_rng(seed)
        self.version = version  # "v1" = linear only, "v2" = non-linear interactions

    def _stable_between(self, key: str, lo: float, hi: float) -> float:
        """Deterministic pseudo-random in [lo, hi] based on string key."""
        rng = np.random.default_rng(self._stable_seed(key))
        return lo + rng.random() * (hi - lo)

    def _stable_seed(self, key: str) -> int:
        digest = hashlib.sha256(f"{DETERMINISTIC_SEED}:{key}".encode("utf-8")).hexdigest()
        return int(digest[:12], 16) % 1_000_000_000

    def _clamp(self, v: float, lo: float, hi: float) -> float:
        return max(lo, min(hi, v))

    def generate_student_latents(self, family: str, student_idx: int) -> dict:
        """Generate student latent traits based on scenario family."""
        seed_base = f"{family}-student-{student_idx}"

        # Base traits (all students) — wider variance for realistic score spread
        base = {
            "academicPotential": self._clamp(
                0.50 + self._stable_between(f"{seed_base}-academic", -0.35, 0.35), 0.10, 0.95),
            "selfRegulation": self._clamp(
                0.50 + self._stable_between(f"{seed_base}-selfreg", -0.35, 0.35), 0.10, 0.95),
            "mathematicsFoundation": self._clamp(
                0.50 + self._stable_between(f"{seed_base}-math", -0.35, 0.35), 0.10, 0.95),
            "computingFoundation": self._clamp(
                0.50 + self._stable_between(f"{seed_base}-comp", -0.35, 0.35), 0.10, 0.95),
            "attendanceDiscipline": self._clamp(
                0.50 + self._stable_between(f"{seed_base}-attend", -0.35, 0.35), 0.10, 0.95),
            "supportResponsiveness": self._clamp(
                0.50 + self._stable_between(f"{seed_base}-support", -0.35, 0.35), 0.10, 0.95),
            "examPressure": self._clamp(
                0.50 + self._stable_between(f"{seed_base}-exam", -0.35, 0.35), 0.05, 0.95),
            "forgetRate": self._clamp(
                0.30 + self._stable_between(f"{seed_base}-forget", -0.20, 0.30), 0.05, 0.85),
            "relearnRate": self._clamp(
                0.40 + self._stable_between(f"{seed_base}-relearn", -0.25, 0.35), 0.05, 0.90),
        }

        # Family-specific adjustments
        if family == "weak-foundation":
            base["mathematicsFoundation"] = self._clamp(base["mathematicsFoundation"] - 0.25, 0.10, 0.60)
            base["computingFoundation"] = self._clamp(base["computingFoundation"] - 0.20, 0.10, 0.65)
        elif family == "low-attendance":
            base["attendanceDiscipline"] = self._clamp(base["attendanceDiscipline"] - 0.40, 0.05, 0.45)
            base["selfRegulation"] = self._clamp(base["selfRegulation"] - 0.10, 0.10, 0.70)
        elif family == "chronic-absentee":
            base["attendanceDiscipline"] = self._clamp(base["attendanceDiscipline"] - 0.55, 0.03, 0.25)
            base["supportResponsiveness"] = self._clamp(base["supportResponsiveness"] - 0.20, 0.08, 0.60)
            base["selfRegulation"] = self._clamp(base["selfRegulation"] - 0.15, 0.08, 0.65)
        elif family == "attendance-shock":
            # Students who are normally okay but vulnerable to sudden attendance drops
            base["attendanceDiscipline"] = self._clamp(base["attendanceDiscipline"] - 0.15, 0.15, 0.70)
            base["supportResponsiveness"] = self._clamp(base["supportResponsiveness"] - 0.25, 0.08, 0.55)
            base["selfRegulation"] = self._clamp(base["selfRegulation"] - 0.20, 0.10, 0.65)
        elif family == "mental-health-disruption":
            base["attendanceDiscipline"] = self._clamp(base["attendanceDiscipline"] - 0.35, 0.05, 0.50)
            base["selfRegulation"] = self._clamp(base["selfRegulation"] - 0.30, 0.05, 0.55)
            base["examPressure"] = self._clamp(base["examPressure"] + 0.20, 0.25, 0.95)
        elif family == "high-forgetting":
            base["forgetRate"] = self._clamp(base["forgetRate"] + 0.25, 0.20, 0.90)
            base["relearnRate"] = self._clamp(base["relearnRate"] - 0.15, 0.05, 0.60)
        elif family == "coursework-inflation":
            base["selfRegulation"] = self._clamp(base["selfRegulation"] - 0.15, 0.10, 0.70)
            base["examPressure"] = self._clamp(base["examPressure"] + 0.15, 0.20, 0.90)
        elif family == "exam-fragility":
            base["examPressure"] = self._clamp(base["examPressure"] + 0.25, 0.30, 0.95)
        elif family == "carryover-heavy":
            base["academicPotential"] = self._clamp(base["academicPotential"] - 0.15, 0.10, 0.70)
            base["forgetRate"] = self._clamp(base["forgetRate"] + 0.10, 0.10, 0.70)
        elif family == "intervention-resistant":
            base["supportResponsiveness"] = self._clamp(base["supportResponsiveness"] - 0.25, 0.08, 0.55)
            base["selfRegulation"] = self._clamp(base["selfRegulation"] - 0.10, 0.10, 0.70)

        return base

    def simulate_course(self, latents: dict, course: dict, semester: int,
                        prev_scores: dict, section_peer_mean: float,
                        faculty_id: str, run_seed: int) -> dict:
        """Simulate a single course for one student (v2 non-linear model)."""
        sid = f"run{run_seed}-s{semester}-{course['id']}"
        difficulty = 0.18 + semester * 0.03 + self._stable_between(f"{sid}-diff", -0.02, 0.04)

        # ── v2 Non-linear interaction terms ──
        if self.version == "v2":
            ability_disc_interaction = (
                (latents["academicPotential"] - 0.5) * (latents["selfRegulation"] - 0.5) * 0.18
            )
            math_comp_synergy = (
                (latents["mathematicsFoundation"] - 0.5) * (latents["computingFoundation"] - 0.5) * 0.14
            )
            attend_support_interaction = (
                (latents["attendanceDiscipline"] - 0.5) * (latents["supportResponsiveness"] - 0.5) * 0.10
            )
            difficulty_nonlinear = difficulty * difficulty * 0.08
        else:
            ability_disc_interaction = 0.0
            math_comp_synergy = 0.0
            attend_support_interaction = 0.0
            difficulty_nonlinear = 0.0

        # Prerequisite average
        prereq_scores = [prev_scores[p] for p in course["prereqs"] if p in prev_scores]
        prereq_avg = np.mean(prereq_scores) / 100.0 if prereq_scores else 0.55

        # Teaching effect (simplified)
        teaching = self._stable_between(f"{sid}-teach", -0.04, 0.06)

        # Mastery computation
        mastery_raw = (
            latents["academicPotential"] * 0.30
            + latents["mathematicsFoundation"] * course["mathWeight"] * 0.22
            + latents["computingFoundation"] * course["computingWeight"] * 0.22
            + latents["selfRegulation"] * 0.10
            + latents["supportResponsiveness"] * 0.07
            + prereq_avg * 0.16
            + teaching
            - difficulty * 0.20
            - difficulty_nonlinear
            + ability_disc_interaction
            + math_comp_synergy
            + attend_support_interaction
            + 0.05
        )

        # Peer effect
        if self.version == "v2":
            peer_boost = self._clamp((section_peer_mean - 0.5) * 0.06, -0.03, 0.03)
        else:
            peer_boost = 0.0
        mastery = self._clamp(mastery_raw + peer_boost, 0.18, 0.97)

        # Attendance with cliff effect and stochastic shocks
        # Calibrated for realistic classroom: ~88% mean in balanced, ~55% in chronic-absentee
        # Domain-randomized base: 80 for normal, 72 for at-risk families
        att_base = 72 if latents["attendanceDiscipline"] > 0.20 else 64
        attendance_raw = (
            att_base
            + latents["attendanceDiscipline"] * 20
            + latents["selfRegulation"] * 4
            + latents["supportResponsiveness"] * 2
            - difficulty * 2
            + self._stable_between(f"{sid}-att", -8, 8)
        )

        # Attendance shock: medical, family emergency, mental health crisis
        # Affects ~3% of students per course, dropping attendance 5-10 points
        shock_key = f"{sid}-shock"
        shock_rng = np.random.default_rng(self._stable_seed(shock_key))
        has_shock = shock_rng.random() < 0.03
        attendance_shock = 0
        if has_shock:
            shock_severity = shock_rng.uniform(5, 10)
            # More likely to have severe shock if low self-regulation or support
            if latents["selfRegulation"] < 0.35 or latents["supportResponsiveness"] < 0.30:
                shock_severity += shock_rng.uniform(2, 5)
            attendance_shock = -shock_severity

        if self.version == "v2":
            attendance_cliff = (
                -self._stable_between(f"{sid}-cliff", 2, 5)
                if 70 <= attendance_raw < 78
                else 0
            )
        else:
            attendance_cliff = 0

        attendance_pct = self._clamp(round(attendance_raw + attendance_cliff + attendance_shock), 35, 98)

        # Instructor grading curve
        if self.version == "v2":
            grading_severity = self._stable_between(f"{faculty_id}-severity", -0.04, 0.06)
            grading_generosity = self._stable_between(f"{faculty_id}-generosity", -0.03, 0.05)
        else:
            grading_severity = 0.0
            grading_generosity = 0.0

        # Assessment scores — lowered bases, wider noise for realistic spread
        # Target: ~5-10% CE<40, ~15-25% CE<50, mean ~55-60, std ~12-15
        tt1_pct = self._clamp(
            38 + mastery * 42 + self._stable_between(f"{sid}-tt1", -16, 16)
            - difficulty * 8 + grading_severity * 5, 3, 98
        )
        tt2_pct = self._clamp(
            tt1_pct + latents["relearnRate"] * 12 - latents["forgetRate"] * 6
            + grading_severity * 5 + self._stable_between(f"{sid}-tt2", -14, 16), 3, 98
        )
        quiz_pct = self._clamp(
            36 + mastery * 40 + self._stable_between(f"{sid}-quiz", -14, 14)
            - difficulty * 5 + grading_generosity * 4, 3, 98
        )
        assignment_pct = self._clamp(
            36 + mastery * 37 + self._stable_between(f"{sid}-assign", -14, 16)
            + grading_generosity * 3, 3, 98
        )
        # MSRUAS demo branch: CE=60 marks, TT1+TT2=30, quiz+assignment=30 (default split)
        ce_pct = round(tt1_pct * 0.25 + tt2_pct * 0.25 + quiz_pct * 0.25 + assignment_pct * 0.25)
        see_pct = self._clamp(
            40 + mastery * 40 - latents["examPressure"] * 10
            + grading_severity * 6 + self._stable_between(f"{sid}-see", -14, 14), 5, 98
        )
        attendance_eligible = attendance_pct >= 75
        ce_eligible = ce_pct >= 40
        see_eligible = attendance_eligible and ce_eligible
        if see_eligible:
            see_observed = round(see_pct)
            overall = round(ce_pct * 0.60 + see_pct * 0.40)
            see_pass = see_pct >= 40
            passed = overall >= 40 and see_pass
            if not see_pass:
                failure_mode = "see_fail"
            elif overall < 40:
                failure_mode = "overall_fail"
            else:
                failure_mode = None
        else:
            see_observed = None
            overall = None
            passed = False
            failure_mode = "attendance" if not attendance_eligible else "ce_ineligible"

        # Grade point on 10-point scale
        if passed:
            if overall >= 90:
                grade_point = 10.0
            elif overall >= 80:
                grade_point = 9.0
            elif overall >= 70:
                grade_point = 8.0
            elif overall >= 60:
                grade_point = 7.0
            elif overall >= 50:
                grade_point = 6.0
            else:
                grade_point = 5.0
        else:
            grade_point = 0.0

        return {
            "attendancePct": attendance_pct,
            "tt1Pct": round(tt1_pct),
            "tt2Pct": round(tt2_pct),
            "quizPct": round(quiz_pct),
            "assignmentPct": round(assignment_pct),
            "cePct": ce_pct,
            "seePct": see_observed,
            "overallMark": overall,
            "passed": passed,
            "failureMode": failure_mode,
            "gradePoint": grade_point,
            "mastery": round(mastery, 3),
            "difficulty": round(difficulty, 3),
        }

    def compute_features(self, result: dict, history: list, semester: int,
                         cgpa: float, backlog_credits: int, historical_backlog_credits: int,
                         lower_year_blocker_credits: int, backlog_attempt_count: int, stage: str,
                         section_code: str) -> np.ndarray:
        """Compute 48 features from course result and history."""
        f = np.zeros(48, dtype=np.float64)

        # Scale helpers
        def s(v, lo, hi):
            if v is None:
                return 0.5
            return self._clamp((v - lo) / max(hi - lo, 0.001), 0, 1)

        def safe(v, default):
            return default if v is None else v

        # 0: attendancePctScaled
        f[0] = s(result["attendancePct"], 40, 100)
        # 1: attendanceTrendScaled
        att_hist = [h["attendancePct"] for h in history[-3:] if h.get("attendancePct") is not None] if history else [result["attendancePct"]]
        f[1] = s(np.mean(att_hist) - result["attendancePct"], -20, 20) if len(att_hist) > 1 and result["attendancePct"] is not None else 0.5
        # 2: attendanceHistoryRiskScaled
        f[2] = s(100 - np.mean(att_hist), 0, 60) if att_hist else 0.3
        # 3: currentCgpaScaled
        f[3] = s(cgpa, 0, 10)
        # 4: backlogPressureScaled (v5 legacy proxy — simple linear combo)
        active_pressure = s(backlog_credits, 0, 15)
        historical_burden = s(historical_backlog_credits, 0, 45)
        lower_year_pressure = s(lower_year_blocker_credits, 0, 15)
        # v6: non-redundant credit-specific features with unique signals
        # f[44]: credit cliff — non-linear penalty at 15 credit boundary
        credit_cliff = 0.0 if backlog_credits < 15 else self._clamp((backlog_credits - 14) / 5, 0, 1)
        # f[45]: attempt-weighted historical burden (3 fails > 1 fail even if same credits)
        attempt_weight = 1.0 + 0.3 * min(backlog_attempt_count, 5)
        attempt_burden = s(historical_backlog_credits * attempt_weight, 0, 80)
        # f[46]: lower-year blocker amplified for late-semester students
        year_amplification = 1.0 + 0.25 * max(semester - 2, 0)
        amplified_blocker = s(lower_year_blocker_credits * year_amplification, 0, 25)
        # f[47]: time-pressure sensitivity (higher in later semesters, especially sem 5-6)
        time_pressure = self._clamp(semester / 6, 0, 1)
        time_sensitive_score = self._clamp(
            0.35 * (backlog_credits / 15)
            + 0.25 * (historical_backlog_credits / 45)
            + 0.20 * (backlog_attempt_count / 6)
            + 0.10 * (lower_year_blocker_credits / 15)
            + 0.10 * time_pressure,
            0,
            1,
        )
        # Legacy v5 proxy: intentionally different weighting to reduce collinearity with 44-47
        sensitivity_score = self._clamp(
            0.4 * (backlog_credits / 15)
            + 0.3 * (historical_backlog_credits / 45)
            + 0.2 * (backlog_attempt_count / 6)
            + 0.1 * (lower_year_blocker_credits / 15),
            0,
            1,
        )
        f[4] = self._clamp(active_pressure * 0.5 + historical_burden * 0.3 + credit_cliff * 0.2, 0, 1)
        # 5-9: assessment risk (inverted scores)
        f[5] = s(None if result["tt1Pct"] is None else 100 - result["tt1Pct"], 0, 100)
        f[6] = s(None if result["tt2Pct"] is None else 100 - result["tt2Pct"], 0, 100)
        f[7] = s(None if result["seePct"] is None else 100 - result["seePct"], 0, 100)
        f[8] = s(None if result["quizPct"] is None else 100 - result["quizPct"], 0, 100)
        f[9] = s(None if result["assignmentPct"] is None else 100 - result["assignmentPct"], 0, 100)
        # 10: weakCoPressureScaled
        f[10] = s(None if result.get("cePct") is None else 60 - result["cePct"], 0, 60)
        # 11: weakQuestionPressureScaled
        f[11] = f[10] * 0.8
        # 12: courseworkTtMismatchScaled
        cw_avg = (safe(result.get("quizPct"), 50) + safe(result.get("assignmentPct"), 50)) / 2
        tt_avg = (safe(result.get("tt1Pct"), 50) + safe(result.get("tt2Pct"), 50)) / 2
        f[12] = s(abs(cw_avg - tt_avg), 0, 40)
        # 13: ttMomentumRiskScaled
        f[13] = s(safe(result.get("tt1Pct"), 50) - safe(result.get("tt2Pct"), 50), -30, 30)
        # 14: interventionResidualRiskScaled (derived from current missing/poor performance)
        f[14] = s(None if result.get("cePct") is None else 100 - result["cePct"], 0, 100) * 0.5
        
        # 15-24: prerequisite features (MUST be static across current semester stages, based on prior history)
        # We simulate the Prerequisite Pressure (f[15]) using historical CGPA and backlog
        # A student with cgpa 6.0 and 15 backlogs will have high prerequisite pressure.
        base_prereq_pressure = self._clamp((10 - cgpa) * 0.1 + (backlog_credits / 30.0), 0, 1)
        f[15] = base_prereq_pressure
        f[16] = base_prereq_pressure * 0.9
        f[17] = base_prereq_pressure * 0.6
        f[18] = s(semester, 1, 6) * 0.5
        f[19] = base_prereq_pressure * 0.5
        f[20] = base_prereq_pressure * 0.4
        f[21] = base_prereq_pressure * 0.55
        f[22] = s(semester, 1, 6) * 0.4
        f[23] = base_prereq_pressure * 0.45
        f[24] = base_prereq_pressure * 0.35
        # 25: semesterProgressScaled
        stage_order = {"pre-tt1": 0, "post-tt1": 1, "post-tt2": 2, "post-assignments": 3, "post-see": 4}.get(stage, 0)
        f[25] = s(stage_order, 0, 4)
        # 26-30: stage indicators
        stages = ["pre-tt1", "post-tt1", "post-tt2", "post-assignments", "post-see"]
        for i, st in enumerate(stages):
            f[26 + i] = 1.0 if stage == st else 0.0
        # 31: sectionPressureScaled
        f[31] = 0.02 if section_code == "B" else 0.0
        # 32-36: compound interaction features
        f[32] = f[5] * f[6]  # tt1tt2ExamCompoundRiskScaled
        f[33] = f[8] * f[9]  # courseworkCompoundRiskScaled
        f[34] = f[28] * f[32]  # stagePostTt2TtCompoundInteractionScaled
        f[35] = f[0] * f[1]  # attendanceTrendCompoundRiskScaled
        f[36] = f[29] * f[33]  # stagePostAssignmentsCourseworkInteractionScaled
        # 37-38: missingness indicators (no missing data in synthetic)
        f[37] = 0.0
        f[38] = 0.0
        # 39-43: assessment missingness (all present)
        f[39] = 1.0 if result["tt1Pct"] is None else 0.0
        f[40] = 1.0 if result["tt2Pct"] is None else 0.0
        f[41] = 1.0 if result["seePct"] is None else 0.0
        f[42] = 1.0 if result["quizPct"] is None else 0.0
        f[43] = 1.0 if result["assignmentPct"] is None else 0.0
        f[44] = credit_cliff
        f[45] = attempt_burden
        f[46] = amplified_blocker
        f[47] = time_sensitive_score

        return f

    def observed_result_for_stage(self, result: dict, stage: str) -> dict:
        observed = dict(result)
        visible = {
            "pre-tt1": set(),
            "post-tt1": {"tt1Pct"},
            "post-tt2": {"tt1Pct", "tt2Pct"},
            "post-assignments": {"tt1Pct", "tt2Pct", "quizPct", "assignmentPct"},
            "post-see": {"tt1Pct", "tt2Pct", "quizPct", "assignmentPct", "seePct"},
        }.get(stage, set())
        for key in ["tt1Pct", "tt2Pct", "quizPct", "assignmentPct", "seePct"]:
            if key not in visible:
                observed[key] = None
        # MSRUAS demo branch: CE=60 marks, TT1+TT2=30, quiz+assignment=30
        ce_parts = [
            observed["tt1Pct"] * 0.25 if observed["tt1Pct"] is not None else None,
            observed["tt2Pct"] * 0.25 if observed["tt2Pct"] is not None else None,
            observed["quizPct"] * 0.25 if observed["quizPct"] is not None else None,
            observed["assignmentPct"] * 0.25 if observed["assignmentPct"] is not None else None,
        ]
        known_ce_parts = [part for part in ce_parts if part is not None]
        observed["cePct"] = sum(known_ce_parts) / sum([0.25 if observed["tt1Pct"] is not None else 0, 0.25 if observed["tt2Pct"] is not None else 0, 0.25 if observed["quizPct"] is not None else 0, 0.25 if observed["assignmentPct"] is not None else 0]) if known_ce_parts else None
        if observed["cePct"] is None and observed["seePct"] is None:
            observed["overallMark"] = None
        elif observed["seePct"] is None:
            observed["overallMark"] = observed["cePct"]
        elif observed["cePct"] is None:
            observed["overallMark"] = observed["seePct"]
        else:
            observed["overallMark"] = observed["cePct"] * 0.60 + observed["seePct"] * 0.40
        return observed

    def compute_labels(self, result: dict, observed_result: dict, stage: str,
                        cgpa: float, backlog_credits: int, semester: int,
                        prior_history: list, latents: dict, rng_seed: int,
                        course_id: str = "", course_catalog: list = None) -> dict:
        """Independent heuristic label engine — SEPARATE from feature computation.

        Uses different logic, thresholds, and information than compute_features().
        This prevents label-feature leakage and creates a realistic ML problem.

        Mimics real teacher assessment:
        - Uses PRIOR-semester history only (not current semester courses)
        - Stage-dependent thresholds with hard guards for deterministic failures
        - Incorporates student latent traits (not available to ML model)
        - Downstream risk tracks which future courses are affected and why
        """
        rng = np.random.default_rng(self._stable_seed(f"label-{rng_seed}-{stage}"))

        # Use observed_result for stage-appropriate evidence, fallback to result for post-see
        evidence = observed_result if stage != "post-see" else result
        att = evidence["attendancePct"]
        tt1 = evidence.get("tt1Pct")
        tt2 = evidence.get("tt2Pct")
        quiz = evidence.get("quizPct")
        assignment = evidence.get("assignmentPct")
        ce = evidence.get("cePct")
        see = evidence.get("seePct")
        overall = evidence.get("overallMark")
        passed = evidence.get("passed")
        failure_mode = evidence.get("failureMode")

        # ── Attendance risk ──
        # Deterministic: attendance < 75 means ineligible -> always flagged
        ineligible_att = att < 75
        severe_low = att < 60
        moderate_low = att < 70
        recent_att = [h["attendancePct"] for h in prior_history[-3:]] if prior_history else [att]
        att_trend = np.mean(recent_att) - att if len(recent_att) > 1 else 0
        declining = att_trend > 3
        persistent_low = sum(1 for a in recent_att if a < 65) >= 2 and att < 75
        shock_recovery = (
            len(recent_att) > 1 and att < 70 and max(recent_att[:-1]) - att > 12
        )

        attendance_risk = 1 if (ineligible_att or severe_low or (moderate_low and declining)
                                or persistent_low or shock_recovery) else 0

        # ── CE risk ──
        # At pre-tt1: no CE evidence, use attendance proxy + prior-semester history
        # At post-tt1+: deterministic ineligibility when CE < 40
        if stage == "pre-tt1":
            recent_ce_fails = sum(1 for h in prior_history[-3:] if h.get("cePct") is not None and h["cePct"] < 40)
            recent_ce_weak = sum(1 for h in prior_history[-3:] if h.get("cePct") is not None and h["cePct"] < 50)
            ce_risk = 1 if (att < 65 or recent_ce_fails >= 2 or recent_ce_weak >= 3) else 0
        else:
            ineligible_ce = ce is not None and ce < 40
            ce_low = ce is not None and ce < 50
            ce_weak = ce is not None and ce < 55
            tt_gap = abs((tt1 or 50) - (tt2 or 50)) if tt1 is not None and tt2 is not None else 0
            quiz_weak = quiz is not None and quiz < 50
            assignment_weak = assignment is not None and assignment < 50
            ce_pattern = ce_weak and tt_gap > 6 and (quiz_weak or assignment_weak)
            attendance_ce_risk = att < 75 and ce is not None and ce < 55
            ce_risk = 1 if (ineligible_ce or ce_low or ce_pattern or attendance_ce_risk) else 0

        # ── SEE risk ──
        # At post-see: deterministic (SEE < 40 or ineligible)
        # At pre-tt1: only flag extreme attendance or prior SEE failure pattern
        # At post-tt1+: CE evidence + exam pressure + attendance-driven risk amplification
        if stage == "post-see":
            ineligible_see = see is None
            see_low = see is not None and see < 40
            see_fragile = see is not None and see < 50 and latents["examPressure"] > 0.70
            see_risk = 1 if (ineligible_see or see_low or see_fragile) else 0
        elif stage == "pre-tt1":
            att_see_extreme = att < 60
            recent_see_fails = sum(
                1 for h in prior_history[-3:]
                if h.get("seePct") is not None and h["seePct"] < 40
            )
            see_risk = 1 if (att_see_extreme or recent_see_fails >= 2) else 0
        else:
            ce_est = ce if ce is not None else 50
            ce_danger = ce_est < 45
            ce_weak = ce_est < 55 and semester > 2
            # Attendance-driven SEE risk: poor attendance amplifies exam failure probability
            attendance_see_risk = att < 70 and latents["examPressure"] > 0.50
            severe_attendance_see = att < 60
            see_est = ce_est * 0.85 + latents["examPressure"] * (-6) - max(0, (75 - att)) * 0.15
            see_danger = see_est < 45
            see_fragile_est = see_est < 55 and latents["examPressure"] > 0.60
            see_risk = 1 if (ce_danger or ce_weak or see_danger or see_fragile_est
                            or attendance_see_risk or severe_attendance_see) else 0

        # ── Overall risk ──
        # Stage-aware: early stages rely on trajectory/history, late stages on outcomes.
        # CRITICAL: overall_risk >= max(component risks) at all pre-see stages.
        # At post-see: purely deterministic (pass/fail).
        failed_current = overall is not None and overall < 40
        borderline_current = overall is not None and overall < 50 and overall >= 35
        ineligible_systemic = (
            overall is None
            and (backlog_credits >= 12 or (cgpa > 0 and cgpa < 7.5 and semester > 2))
        )
        cgpa_risk = cgpa > 0 and cgpa < 6.5 and semester > 3
        backlog_risk = backlog_credits >= 20
        recent_fails = sum(1 for h in prior_history[-4:] if h.get("overallMark") is not None and h["overallMark"] < 40)
        trend_risk = recent_fails >= 3
        early_caution = stage in ("pre-tt1", "post-tt1") and semester > 3 and cgpa_risk and trend_risk

        overall_risk = 1 if (failed_current or ineligible_systemic or cgpa_risk
                             or backlog_risk or trend_risk or early_caution) else 0
        if overall_risk == 1 and borderline_current and att > 80 and ce is not None and ce > 50:
            overall_risk = 0

        if stage == "pre-tt1":
            if overall_risk == 1:
                strong_signals = sum([
                    attendance_risk == 1,
                    cgpa_risk,
                    trend_risk,
                    backlog_risk,
                ])
                if strong_signals < 2:
                    overall_risk = 0
        elif stage in ("post-tt1", "post-tt2"):
            if overall_risk == 1 and not (attendance_risk == 1 or ce_risk == 1 or see_risk == 1 or trend_risk or backlog_risk):
                overall_risk = 0
        elif stage == "post-assignments":
            if ce is not None and ce < 40 and not overall_risk:
                overall_risk = 1
        elif stage == "post-see":
            overall_risk = 0 if passed else 1

        # Pre-see monotonicity: overall >= max(component risks)
        if stage != "post-see":
            overall_risk = max(overall_risk, attendance_risk, ce_risk, see_risk)

        # ── HARD THRESHOLD GUARDS ──
        # Deterministic failures MUST always be flagged, regardless of stage logic.
        if att < 75:
            attendance_risk = 1
        if ce is not None and ce < 40:
            ce_risk = 1
        if see is not None and see < 40:
            see_risk = 1
        if overall is not None and overall < 40:
            overall_risk = 1
        if stage == "post-see":
            if see is None:
                see_risk = 1
            if not passed:
                overall_risk = 1

        # ── Downstream risk ──
        # At post-see: flag borderline/failed passes in early/mid semesters that may cascade.
        # Failed courses in early sems (1-3) create high cascading risk; later sem failures less so.
        # Borderline passes (35-55) in any sem 1-5 create moderate downstream risk.
        # At earlier stages: use historical borderline pattern as proxy.
        if stage == "post-see":
            borderline = overall is not None and overall < 55 and overall >= 35
            # Failed course: overall < 40 OR SEE-ineligible. Only count as downstream risk in sem 1-3
            # where future course dependency is strongest. In sem 4-5, only borderline counts.
            failed_course = (overall is not None and overall < 40) or (overall is None and passed is False)
            early_sem = semester <= 3
            mid_sem = semester <= 5
            is_prereq = semester < 6
            downstream_risk = 1 if ((failed_course and early_sem) or (borderline and mid_sem and is_prereq)) else 0
        else:
            # Pre-see: estimate from history (students with repeated borderline passes or failures)
            recent_borderline = sum(1 for h in prior_history[-3:] if h.get("overallMark") is not None and 35 <= h["overallMark"] < 55)
            recent_fails = sum(1 for h in prior_history[-3:] if h.get("overallMark") is not None and h["overallMark"] < 40)
            recent_ineligible = sum(1 for h in prior_history[-3:] if h.get("overallMark") is None and h.get("passed") is False)
            downstream_risk = 1 if (recent_borderline >= 2 or recent_fails >= 1 or recent_ineligible >= 1) and semester < 6 else 0

        # Semester 1 guard: no prior history, downstream must be 0
        if semester == 1:
            downstream_risk = 0

        return {
            "label_attendance": attendance_risk,
            "label_ce": ce_risk,
            "label_see": see_risk,
            "label_overall": overall_risk,
            "label_downstream": downstream_risk,
        }

    def generate_dataset(self, n_students: int = 120, n_semesters: int = 6,
                         families: list = None, output_path: str = None) -> pd.DataFrame:
        """Generate full dataset with simulator v2."""
        if families is None:
            families = SCENARIO_FAMILIES

        rows = []
        run_counter = 0

        for family in families:
            # Determine split
            if family in TRAIN_FAMILIES:
                split = "train"
            elif family in VAL_FAMILIES:
                split = "validation"
            else:
                split = "test"

            n_runs = 4  # simulation runs per family
            for run_idx in range(n_runs):
                run_id = f"simulation_run_v2_{family}_{run_counter:04d}"
                run_counter += 1
                run_seed = self._stable_seed(f"{family}-{run_idx}") % 100000

                # Generate students for this run
                students = []
                for si in range(n_students):
                    latents = self.generate_student_latents(family, si)
                    students.append(latents)

                # Section assignment (A/B alternating)
                section_codes = ["A", "B"] * (n_students // 2 + 1)
                section_peer_mean_a = self._clamp(0.50 + self._stable_between(f"run{run_idx}-secA", -0.08, 0.14), 0.40, 0.70)
                section_peer_mean_b = self._clamp(0.50 + self._stable_between(f"run{run_idx}-secB", -0.10, 0.08), 0.38, 0.65)

                # Simulate each student through all semesters
                for si, latents in enumerate(students):
                    section_code = section_codes[si]
                    section_peer = section_peer_mean_a if section_code == "A" else section_peer_mean_b
                    prev_scores = {}
                    history = []
                    prior_history = []  # only courses from previous semesters
                    cgpa = 0.0
                    total_credits = 0
                    backlog_credits = 0
                    historical_backlog_credits = 0
                    backlog_attempt_count = 0
                    grading_faculty_id = f"faculty_{(si % 8) + 1}"
                    mentor_id = f"mentor_{(si % 12) + 1}"

                    for sem in range(1, n_semesters + 1):
                        sem_courses = [c for c in COURSE_CATALOG if c["sem"] == sem]

                        for course_index, course in enumerate(sem_courses):
                            course_leader_id = f"course_leader_{((sem * 7 + course_index * 3 + (0 if section_code == 'A' else 1)) % 10) + 1}"
                            hod_id = f"hod_semester_{sem}"
                            student_id = f"{run_id}_student_{si:03d}"
                            offering_id = f"{run_id}_{course['id']}_{section_code}"
                            result = self.simulate_course(
                                latents, course, sem, prev_scores,
                                section_peer, grading_faculty_id, run_seed,
                            )
                            prev_scores[course["id"]] = result["overallMark"] if result["overallMark"] is not None else 0

                            pre_cgpa = cgpa
                            pre_backlog_credits = backlog_credits
                            pre_historical_backlog_credits = historical_backlog_credits
                            pre_backlog_attempt_count = backlog_attempt_count
                            grade_point = result.get("gradePoint", 0.0)
                            post_backlog_credits = backlog_credits + (0 if result["passed"] else course["credits"])
                            post_historical_backlog_credits = historical_backlog_credits + (0 if result["passed"] else course["credits"])
                            post_backlog_attempt_count = backlog_attempt_count + (1 if not result["passed"] else 0)
                            post_total_credits = total_credits + course["credits"]
                            if post_total_credits > 0:
                                post_cgpa = (cgpa * total_credits + grade_point * course["credits"]) / post_total_credits
                            else:
                                post_cgpa = cgpa
                            post_cgpa = round(post_cgpa, 2)

                            # Generate rows for each stage
                            stages = ["pre-tt1", "post-tt1", "post-tt2", "post-assignments", "post-see"]
                            for stage in stages:
                                observed_result = self.observed_result_for_stage(result, stage)
                                stage_cgpa = post_cgpa if stage == "post-see" else pre_cgpa
                                stage_backlog_credits = post_backlog_credits if stage == "post-see" else pre_backlog_credits
                                stage_historical_backlog_credits = post_historical_backlog_credits if stage == "post-see" else pre_historical_backlog_credits
                                stage_backlog_attempt_count = post_backlog_attempt_count if stage == "post-see" else pre_backlog_attempt_count
                                lower_year_blocker_credits = stage_backlog_credits if sem > 1 else 0
                                features = self.compute_features(
                                    observed_result, history, sem, stage_cgpa, stage_backlog_credits,
                                    stage_historical_backlog_credits, lower_year_blocker_credits,
                                    stage_backlog_attempt_count, stage, section_code,
                                )
                                labels = self.compute_labels(result, observed_result, stage, pre_cgpa, pre_backlog_credits, sem, prior_history, latents, run_seed + si * 100 + sem, course_id=course["id"], course_catalog=COURSE_CATALOG)

                                row = {
                                    "run_id": run_id,
                                    "split": split,
                                    "student_id": student_id,
                                    "semester_number": sem,
                                    "stage_key": stage,
                                    "scenario_family": family,
                                    "section_code": section_code,
                                    "course_id": course["id"],
                                    "course_code": course["id"],
                                    "course_title": course["title"],
                                    "course_credits": course["credits"],
                                    "offering_id": offering_id,
                                    "mentor_id": mentor_id,
                                    "course_leader_id": course_leader_id,
                                    "hod_id": hod_id,
                                    "grading_faculty_id": grading_faculty_id,
                                    "assigned_role": "Mentor",
                                    "assigned_faculty_id": mentor_id,
                                }
                                row.update(labels)
                                for i in range(48):
                                    row[f"feat_{i}"] = features[i]
                                rows.append(row)

                            history.append(result)
                            total_credits = post_total_credits
                            cgpa = post_cgpa
                            backlog_credits = post_backlog_credits
                            historical_backlog_credits = post_historical_backlog_credits
                            backlog_attempt_count = post_backlog_attempt_count

                        # After all courses in this semester: snapshot history for next semester's prior
                        prior_history = list(history)

        df = pd.DataFrame(rows)
        if output_path:
            df.to_csv(output_path, index=False)
            print(f"Wrote {len(df):,} rows to {output_path}")

        return df


def main():
    parser = argparse.ArgumentParser(description="Generate simulator v2 dataset")
    parser.add_argument("output_csv", help="Output CSV path")
    parser.add_argument("--students", type=int, default=120, help="Students per run")
    parser.add_argument("--semesters", type=int, default=6, help="Semesters per student")
    parser.add_argument("--seed", type=int, default=DETERMINISTIC_SEED, help="Random seed")
    args = parser.parse_args()

    sim = SimulatorV2(seed=args.seed)
    df = sim.generate_dataset(
        n_students=args.students,
        n_semesters=args.semesters,
        output_path=args.output_csv,
    )

    # Print summary
    print(f"\nDataset summary:")
    print(f"  Rows: {len(df):,}")
    print(f"  Splits: {dict(df['split'].value_counts())}")
    print(f"  Families: {sorted(df['scenario_family'].unique())}")
    print(f"  Sections: {sorted(df['section_code'].unique())}")
    for col in ["label_attendance", "label_ce", "label_see", "label_overall", "label_downstream"]:
        if col in df.columns:
            pos = df[col].sum()
            print(f"  {col}: {pos:,} positive ({pos/len(df)*100:.1f}%)")


if __name__ == "__main__":
    main()
