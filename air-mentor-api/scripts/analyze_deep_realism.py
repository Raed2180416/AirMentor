"""
Deep Realism Analysis for AirMentor Simulator v2 Data

This script performs a comprehensive analysis of the synthetic data's realism
by examining label distributions, feature-label relationships, signal-to-noise ratios,
inter-label consistency, and stage evolution patterns.
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

sys.path.insert(0, str(Path(__file__).parent))
from generate_v2_data import SimulatorV2, SCENARIO_FAMILIES, FEATURE_NAMES


def compute_feature_label_correlations(df):
    """Compute correlations between features and labels to assess signal strength."""
    label_cols = ["label_attendance", "label_ce", "label_see", "label_overall", "label_downstream"]
    feature_cols = [f"feat_{i}" for i in range(48)]

    correlations = {}
    for label in label_cols:
        corr_series = df[feature_cols + [label]].corr()[label].drop(label)
        correlations[label] = {
            "top_features": corr_series.abs().nlargest(10),
            "mean_abs_corr": corr_series.abs().mean(),
            "max_abs_corr": corr_series.abs().max(),
        }
    return correlations


def compute_label_purity(df):
    """Compute label purity: how well features separate positive/negative classes."""
    label_cols = ["label_attendance", "label_ce", "label_see", "label_overall", "label_downstream"]
    feature_cols = [f"feat_{i}" for i in range(48)]

    purity = {}
    for label in label_cols:
        pos = df[df[label] == 1][feature_cols]
        neg = df[df[label] == 0][feature_cols]

        # Mann-Whitney U test for each feature
        p_values = []
        effect_sizes = []
        for feat in feature_cols:
            if pos[feat].std() > 0 and neg[feat].std() > 0:
                statistic, p = stats.mannwhitneyu(pos[feat], neg[feat], alternative="two-sided")
                # Cohen's d (simplified)
                pooled_std = np.sqrt((pos[feat].var() + neg[feat].var()) / 2)
                if pooled_std > 0:
                    d = (pos[feat].mean() - neg[feat].mean()) / pooled_std
                else:
                    d = 0
                p_values.append(p)
                effect_sizes.append(abs(d))
            else:
                p_values.append(1.0)
                effect_sizes.append(0.0)

        purity[label] = {
            "significant_features": sum(1 for p in p_values if p < 0.001),
            "mean_effect_size": np.mean(effect_sizes),
            "max_effect_size": max(effect_sizes) if effect_sizes else 0,
            "top_effect_features": sorted(
                zip(feature_cols, effect_sizes), key=lambda x: x[1], reverse=True
            )[:10],
        }
    return purity


def compute_signal_to_noise(df):
    """Estimate signal-to-noise ratio based on Bayes error and feature separability."""
    label_cols = ["label_attendance", "label_ce", "label_see", "label_overall", "label_downstream"]

    snr = {}
    for label in label_cols:
        pos_rate = df[label].mean()
        # Theoretical minimum error (Bayes) for this class balance
        bayes_error = min(pos_rate, 1 - pos_rate)

        # Empirical: use top feature's AUC as proxy for signal
        feature_cols = [f"feat_{i}" for i in range(48)]
        best_auc = 0
        for feat in feature_cols:
            pos = df[df[label] == 1][feat]
            neg = df[df[label] == 0][feat]
            if len(pos) > 0 and len(neg) > 0:
                # Simple AUC proxy: rank-based
                statistic, _ = stats.mannwhitneyu(pos, neg, alternative="two-sided")
                auc = statistic / (len(pos) * len(neg))
                auc = max(auc, 1 - auc)
                best_auc = max(best_auc, auc)

        snr[label] = {
            "positive_rate": pos_rate,
            "bayes_error": bayes_error,
            "best_feature_auc": best_auc,
            "signal_estimate": best_auc - 0.5,
        }
    return snr


def compute_inter_label_consistency(df):
    """Check if labels are logically consistent with each other."""
    labels = df[["label_attendance", "label_ce", "label_see", "label_overall", "label_downstream"]]

    # Correlation matrix
    corr = labels.corr()

    # Logical checks
    # If attendance=1 and ce=1, overall should usually be 1
    both_risk = df[(df["label_attendance"] == 1) & (df["label_ce"] == 1)]
    overall_when_both = both_risk["label_overall"].mean() if len(both_risk) > 0 else 0

    # If overall=1, at least one of attendance/ce/see should usually be 1
    overall_risk = df[df["label_overall"] == 1]
    has_component = (
        (overall_risk["label_attendance"] == 1) |
        (overall_risk["label_ce"] == 1) |
        (overall_risk["label_see"] == 1)
    ).mean() if len(overall_risk) > 0 else 0

    # SEE ineligible (seePct is None) should correlate with attendance/ce risk
    see_ineligible = df[df["feat_41"] == 1.0]  # seeMissingScaled = 1
    see_ineligible_att_risk = see_ineligible["label_attendance"].mean() if len(see_ineligible) > 0 else 0
    see_ineligible_ce_risk = see_ineligible["label_ce"].mean() if len(see_ineligible) > 0 else 0

    return {
        "correlation_matrix": corr,
        "overall_when_attendance_and_ce": overall_when_both,
        "has_component_when_overall": has_component,
        "see_ineligible_attendance_risk": see_ineligible_att_risk,
        "see_ineligible_ce_risk": see_ineligible_ce_risk,
    }


def compute_stage_evolution_realism(df):
    """Analyze how risk evolves across stages for the same student-course."""
    stages = ["pre-tt1", "post-tt1", "post-tt2", "post-assignments", "post-see"]
    stage_order = {s: i for i, s in enumerate(stages)}

    # For each student-course, track risk evolution
    df["stage_idx"] = df["stage_key"].map(stage_order)
    df_sorted = df.sort_values(["student_id", "course_id", "stage_idx"])

    # Risk should generally increase or stay same as more evidence comes in
    # (or decrease if early warnings turn out false)
    evolution = {}
    for label in ["label_attendance", "label_ce", "label_overall"]:
        increases = 0
        decreases = 0
        same = 0
        total = 0

        for (student, course), group in df_sorted.groupby(["student_id", "course_id"]):
            group = group.sort_values("stage_idx")
            vals = group[label].values
            for i in range(len(vals) - 1):
                total += 1
                if vals[i + 1] > vals[i]:
                    increases += 1
                elif vals[i + 1] < vals[i]:
                    decreases += 1
                else:
                    same += 1

        evolution[label] = {
            "increases": increases / total if total > 0 else 0,
            "decreases": decreases / total if total > 0 else 0,
            "same": same / total if total > 0 else 0,
        }

    # Analyze feature variance across stages (should increase as more evidence)
    feature_variance = {}
    for stage in stages:
        stage_df = df[df["stage_key"] == stage]
        feature_variance[stage] = stage_df[[f"feat_{i}" for i in range(48)]].var().mean()

    return {
        "label_evolution": evolution,
        "feature_variance_by_stage": feature_variance,
    }


def compute_family_realism(df):
    """Analyze label rates by scenario family for realism."""
    family_stats = df.groupby("scenario_family").agg({
        "label_attendance": "mean",
        "label_ce": "mean",
        "label_see": "mean",
        "label_overall": "mean",
        "label_downstream": "mean",
    }).round(3)

    # Expected patterns:
    # - chronic-absentee: high attendance, moderate overall
    # - exam-fragility: high see, moderate overall
    # - weak-foundation: moderate-high overall
    # - balanced: low across all
    # - carryover-heavy: high downstream, high overall in later sems

    return family_stats


def check_leakage_indicators(df):
    """Check for potential feature-label leakage."""
    leakage_indicators = {}

    # 1. Missingness features should correlate with ineligibility but not be perfectly predictive
    for missing_feat, label in [
        ("feat_39", "label_attendance"),  # tt1Missing
        ("feat_40", "label_ce"),          # tt2Missing
        ("feat_41", "label_see"),         # seeMissing
    ]:
        corr = df[missing_feat].corr(df[label])
        leakage_indicators[f"{missing_feat}_vs_{label}"] = corr

    # 2. OverallMark-derived features should not perfectly predict overall risk
    # (there should be some students who pass but are still at-risk due to systemic issues)
    overall_mark_proxy = df["feat_10"]  # weakCoPressureScaled
    leakage_indicators["overall_mark_proxy_vs_label_overall"] = overall_mark_proxy.corr(df["label_overall"])

    # 3. CGPA should correlate with overall but not perfectly
    leakage_indicators["cgpa_vs_label_overall"] = df["feat_3"].corr(df["label_overall"])

    return leakage_indicators


def analyze_feature_realism(df):
    """Check if feature distributions are realistic."""
    realism = {}

    # Attendance should mostly be 60-95%
    att_scaled = df["feat_0"]
    att_raw = att_scaled * 60 + 40  # approximate descale
    realism["attendance_mean"] = att_raw.mean()
    realism["attendance_std"] = att_raw.std()
    realism["attendance_below_60_pct"] = (att_raw < 60).mean() * 100

    # CGPA should be mostly 5-9 for normal students
    cgpa_scaled = df["feat_3"]
    cgpa_raw = cgpa_scaled * 10
    realism["cgpa_mean"] = cgpa_raw.mean()
    realism["cgpa_std"] = cgpa_raw.std()

    # Backlog pressure should be low for most, high for at-risk families
    backlog = df["feat_4"]
    realism["backlog_pressure_mean"] = backlog.mean()
    realism["backlog_pressure_90th"] = backlog.quantile(0.90)

    # Feature ranges should be [0,1] (scaled)
    feature_cols = [f"feat_{i}" for i in range(48)]
    realism["features_out_of_range"] = (
        (df[feature_cols] < -0.01).any().any() or
        (df[feature_cols] > 1.01).any().any()
    )

    return realism


def main():
    parser = argparse.ArgumentParser(description="Deep realism analysis for simulator v2")
    parser.add_argument("--students", type=int, default=120, help="Students per run")
    parser.add_argument("--semesters", type=int, default=6, help="Semesters per student")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    print("=" * 70)
    print("DEEP REALISM ANALYSIS: AirMentor Simulator v2 Synthetic Data")
    print("=" * 70)

    # Generate dataset
    print("\n[1/6] Generating synthetic dataset...")
    sim = SimulatorV2(seed=args.seed)
    df = sim.generate_dataset(
        n_students=args.students,
        n_semesters=args.semesters,
        families=SCENARIO_FAMILIES,
    )
    print(f"Generated {len(df):,} rows")

    # 1. Feature-Label Signal Analysis
    print("\n[2/6] Feature-Label Signal Analysis...")
    correlations = compute_feature_label_correlations(df)
    purity = compute_label_purity(df)
    snr = compute_signal_to_noise(df)

    print("\n  Signal-to-Noise Estimates:")
    for label, metrics in snr.items():
        print(f"    {label:25s}: pos_rate={metrics['positive_rate']:.3f}, "
              f"best_auc={metrics['best_feature_auc']:.3f}, "
              f"signal={metrics['signal_estimate']:.3f}")

    print("\n  Top Predictive Features per Label:")
    for label, corr_info in correlations.items():
        print(f"    {label}:")
        for feat, corr in corr_info["top_features"].head(5).items():
            print(f"      {feat}: r={corr:.3f}")

    # 2. Inter-Label Consistency
    print("\n[3/6] Inter-Label Consistency Check...")
    consistency = compute_inter_label_consistency(df)
    print(f"\n  Label Correlation Matrix:")
    print(consistency["correlation_matrix"].round(3).to_string())
    print(f"\n  Logical Consistency:")
    print(f"    P(overall=1 | attendance=1 AND ce=1): {consistency['overall_when_attendance_and_ce']:.3f}")
    print(f"    P(has component risk | overall=1): {consistency['has_component_when_overall']:.3f}")
    print(f"    P(attendance risk | SEE ineligible): {consistency['see_ineligible_attendance_risk']:.3f}")
    print(f"    P(CE risk | SEE ineligible): {consistency['see_ineligible_ce_risk']:.3f}")

    # 3. Stage Evolution Realism
    print("\n[4/6] Stage Evolution Realism...")
    evolution = compute_stage_evolution_realism(df)
    print("\n  Label Evolution (stage-to-stage transitions):")
    for label, ev in evolution["label_evolution"].items():
        print(f"    {label}: {ev['increases']*100:.1f}% increase, "
              f"{ev['decreases']*100:.1f}% decrease, {ev['same']*100:.1f}% same")
    print("\n  Feature Variance by Stage (should increase as evidence accumulates):")
    for stage, var in evolution["feature_variance_by_stage"].items():
        print(f"    {stage:20s}: {var:.4f}")

    # 4. Family-Specific Realism
    print("\n[5/6] Scenario Family Realism...")
    family_stats = compute_family_realism(df)
    print(f"\n  Label Rates by Family:")
    print(family_stats.to_string())

    # 5. Leakage and Range Checks
    print("\n[6/6] Leakage and Realism Checks...")
    leakage = check_leakage_indicators(df)
    feature_realism = analyze_feature_realism(df)

    print("\n  Leakage Indicators (should be moderate, not perfect):")
    for name, value in leakage.items():
        print(f"    {name:45s}: {value:.3f}")

    print("\n  Feature Distribution Realism:")
    for name, value in feature_realism.items():
        if isinstance(value, bool):
            print(f"    {name}: {'PASS' if not value else 'FAIL'}")
        else:
            print(f"    {name}: {value:.3f}")

    # Summary Score
    print("\n" + "=" * 70)
    print("REALISM SUMMARY SCORE")
    print("=" * 70)

    scores = {
        "signal_strength": np.mean([s["signal_estimate"] for s in snr.values()]),
        "label_consistency": consistency["has_component_when_overall"],
        "evolution_plausibility": 1 - abs(0.5 - np.mean([
            evolution["label_evolution"]["label_overall"]["increases"],
            evolution["label_evolution"]["label_overall"]["decreases"],
        ])),
        "family_separation": family_stats["label_overall"].std(),
        "no_leakage": 1 - max(abs(v) for v in leakage.values()),
        "feature_ranges": 0 if feature_realism["features_out_of_range"] else 1,
    }

    for name, score in scores.items():
        print(f"  {name:25s}: {score:.3f}")

    overall = np.mean(list(scores.values()))
    print(f"\n  OVERALL REALISM SCORE: {overall:.3f} / 1.000")
    if overall > 0.8:
        print("  => EXCELLENT: Data exhibits strong realism characteristics")
    elif overall > 0.6:
        print("  => GOOD: Data is reasonably realistic with minor issues")
    elif overall > 0.4:
        print("  => MODERATE: Some realism concerns, review recommended")
    else:
        print("  => POOR: Significant realism issues detected")

    print("=" * 70)


if __name__ == "__main__":
    main()
