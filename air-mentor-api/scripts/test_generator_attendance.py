"""
Dedicated test suite for AirMentor synthetic data generator attendance behavior.

Validates that the generator produces realistic attendance patterns and
sufficient positive attendance risk labels across all scenario families.

Usage:
    python test_generator_attendance.py [--students N] [--seed SEED]

Exit code 0 = all tests pass, 1 = any test fails.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import pointbiserialr

sys.path.insert(0, str(Path(__file__).parent))
from generate_v2_data import SimulatorV2, SCENARIO_FAMILIES, TRAIN_FAMILIES, VAL_FAMILIES, TEST_FAMILIES

DETERMINISTIC_SEED = 42


def test_attendance_label_rates_by_family(df: pd.DataFrame) -> list[str]:
    """Each scenario family should have attendance risk rates in expected ranges."""
    failures = []
    family_rates = df.groupby("scenario_family")["label_attendance"].mean()

    expectations = {
        "chronic-absentee": (0.25, 0.70),
        "low-attendance": (0.15, 0.50),
        "attendance-shock": (0.10, 0.45),
        "mental-health-disruption": (0.12, 0.55),
        "balanced": (0.03, 0.20),
        "weak-foundation": (0.05, 0.25),
        "high-forgetting": (0.05, 0.25),
        "coursework-inflation": (0.05, 0.25),
        "exam-fragility": (0.05, 0.25),
        "carryover-heavy": (0.05, 0.25),
        "intervention-resistant": (0.05, 0.25),
    }

    for family, (lo, hi) in expectations.items():
        if family not in family_rates.index:
            failures.append(f"Family '{family}' missing from dataset")
            continue
        rate = family_rates[family]
        if rate < lo:
            failures.append(f"Family '{family}' attendance risk {rate:.1%} below threshold {lo:.0%}")
        elif rate > hi:
            failures.append(f"Family '{family}' attendance risk {rate:.1%} above threshold {hi:.0%}")

    return failures


def test_minimum_positive_labels_per_split(df: pd.DataFrame) -> list[str]:
    """Every split must have at least 10 positive labels for every head."""
    failures = []
    label_cols = [
        "label_attendance", "label_ce", "label_see",
        "label_overall", "label_downstream",
    ]
    for split_name in ["train", "validation", "test"]:
        split_df = df[df["split"] == split_name]
        if len(split_df) == 0:
            failures.append(f"Split '{split_name}' has zero rows")
            continue
        for col in label_cols:
            pos = int(split_df[col].sum())
            if pos < 10:
                failures.append(f"Split '{split_name}' / {col}: only {pos} positive (< 10)")
    return failures


def test_feature_label_correlations(df: pd.DataFrame) -> list[str]:
    """Attendance features must correlate meaningfully with attendance risk."""
    failures = []
    y = df["label_attendance"].values

    # feat_0 = attendancePctScaled (should be negative)
    r0, _ = pointbiserialr(y, df["feat_0"].values)
    if r0 > -0.10:
        failures.append(f"feat_0 (attendancePct) correlation {r0:+.3f} not sufficiently negative")

    # feat_1 = attendanceTrendScaled (should be positive — declining = higher risk)
    r1, _ = pointbiserialr(y, df["feat_1"].values)
    if r1 < 0.02:
        failures.append(f"feat_1 (attendanceTrend) correlation {r1:+.3f} not positive enough")

    # feat_2 = attendanceHistoryRiskScaled (should be positive)
    r2, _ = pointbiserialr(y, df["feat_2"].values)
    if r2 < 0.02:
        failures.append(f"feat_2 (attendanceHistory) correlation {r2:+.3f} not positive enough")

    # feat_35 = attendanceTrendCompoundRiskScaled (interaction: attendancePct × attendanceTrend)
    # Can be negative because low attendance + declining trend = high risk
    r35, _ = pointbiserialr(y, df["feat_35"].values)
    if abs(r35) < 0.05:
        failures.append(f"feat_35 (attendanceTrendCompound) correlation {r35:+.3f} magnitude too weak")

    return failures


def test_attendance_distribution_realism(df: pd.DataFrame) -> list[str]:
    """Attendance percentages must span realistic ranges with sufficient low values."""
    failures = []
    att = df["feat_0"] * 60 + 40  # reverse scale: feat_0 = (att - 40) / 60

    # Must have some students below 60%
    below_60 = (att < 60).sum()
    if below_60 < 50:
        failures.append(f"Only {below_60} rows with attendance < 60% (expected >= 50)")

    # Must have some students below 50%
    below_50 = (att < 50).sum()
    if below_50 < 10:
        failures.append(f"Only {below_50} rows with attendance < 50% (expected >= 10)")

    # Chronic-absentee family should have mean below 65%
    chronic = df[df["scenario_family"] == "chronic-absentee"]
    if len(chronic) > 0:
        chronic_att = chronic["feat_0"] * 60 + 40
        if chronic_att.mean() > 65:
            failures.append(f"chronic-absentee mean attendance {chronic_att.mean():.1f}% > 65%")

    return failures


def test_cross_family_robustness(df: pd.DataFrame) -> list[str]:
    """All expected families must appear in each split."""
    failures = []
    for split_name, expected in [
        ("train", TRAIN_FAMILIES),
        ("validation", VAL_FAMILIES),
        ("test", TEST_FAMILIES),
    ]:
        split_families = set(df[df["split"] == split_name]["scenario_family"].unique())
        missing = set(expected) - split_families
        if missing:
            failures.append(f"Split '{split_name}' missing families: {sorted(missing)}")
    return failures


def test_shock_recovery_labels(df: pd.DataFrame) -> list[str]:
    """Attendance shock family should produce shock-recovery type labels."""
    failures = []
    shock_df = df[df["scenario_family"] == "attendance-shock"]
    if len(shock_df) == 0:
        failures.append("attendance-shock family missing from dataset")
        return failures

    shock_rate = shock_df["label_attendance"].mean()
    if shock_rate < 0.08:
        failures.append(f"attendance-shock label rate {shock_rate:.1%} < 8%")

    return failures


def run_all_tests(n_students: int = 60, seed: int = DETERMINISTIC_SEED):
    print("=" * 60)
    print("AirMentor Generator Attendance Test Suite")
    print("=" * 60)

    sim = SimulatorV2(seed=seed)
    df = sim.generate_dataset(n_students=n_students, n_semesters=6)

    all_failures = []
    test_functions = [
        ("attendance_label_rates_by_family", test_attendance_label_rates_by_family),
        ("minimum_positive_labels_per_split", test_minimum_positive_labels_per_split),
        ("feature_label_correlations", test_feature_label_correlations),
        ("attendance_distribution_realism", test_attendance_distribution_realism),
        ("cross_family_robustness", test_cross_family_robustness),
        ("shock_recovery_labels", test_shock_recovery_labels),
    ]

    for name, test_fn in test_functions:
        failures = test_fn(df)
        if failures:
            print(f"\n❌ {name}: FAILED")
            for f in failures:
                print(f"   - {f}")
            all_failures.extend(failures)
        else:
            print(f"\n✅ {name}: PASSED")

    print("\n" + "=" * 60)
    if all_failures:
        print(f"RESULT: {len(all_failures)} failures across {len(test_functions)} tests")
        print("=" * 60)
        return 1
    else:
        print("RESULT: ALL TESTS PASSED")
        print("=" * 60)
        return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--students", type=int, default=60, help="Students per run")
    parser.add_argument("--seed", type=int, default=DETERMINISTIC_SEED)
    args = parser.parse_args()
    sys.exit(run_all_tests(args.students, args.seed))
