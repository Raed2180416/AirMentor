"""
Generate augmented CSV with section_code + adversarial CSVs for OOD evaluation.

Usage:
    python generate_adversarial_csvs.py <input_csv> <output_dir>

Produces:
    output_dir/features-augmented.csv   -- Original CSV + synthetic section_code
    output_dir/adversarial-power-law.csv
    output_dir/adversarial-thresholded-recovery.csv
    output_dir/adversarial-workload-shock.csv
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd


DETERMINISTIC_SEED = 42
rng = np.random.default_rng(DETERMINISTIC_SEED)

# Scenario families from the proof-risk-model
TRAIN_FAMILIES = [
    "coursework-inflation",
    "high-forgetting",
    "low-attendance",
    "weak-foundation",
]
TEST_FAMILIES = ["balanced", "intervention-resistant"]
ALL_FAMILIES = TRAIN_FAMILIES + TEST_FAMILIES + [
    "carryover-heavy",
    "exam-fragility",
]


def add_section_code(df: pd.DataFrame) -> pd.DataFrame:
    """Add synthetic section_code column.

    Section assignment is deterministic based on student position within each
    (run_id, scenario_family) group. Students alternate A/B/A/B... with Section A
    getting a slight ability advantage (matching the simulator's sectionAbility
    values: A=0.64, B=0.50).

    We also nudge feature values to reflect section differences:
    - Section A: +0.5-1.5% on CGPA-related features
    - Section B: -0.5-1.0% on CGPA-related features
    """
    df = df.copy()
    df["section_code"] = "A"

    # Group by run_id to assign sections within each simulation run
    for run_id, group_indices in df.groupby("run_id").groups.items():
        indices = sorted(group_indices)
        for i, idx in enumerate(indices):
            df.loc[idx, "section_code"] = "A" if i % 2 == 0 else "B"

    # Apply section-specific feature shifts to make the distinction meaningful
    section_a_mask = df["section_code"] == "A"
    section_b_mask = df["section_code"] == "B"

    # CGPA-related features get a small section effect
    cgpa_col = "feat_3"  # currentCgpaScaled
    if cgpa_col in df.columns:
        shift_a = rng.uniform(0.005, 0.015, size=section_a_mask.sum())
        shift_b = rng.uniform(-0.010, -0.005, size=section_b_mask.sum())
        df.loc[section_a_mask, cgpa_col] = np.clip(
            df.loc[section_a_mask, cgpa_col].values + shift_a, 0, 1
        )
        df.loc[section_b_mask, cgpa_col] = np.clip(
            df.loc[section_b_mask, cgpa_col].values + shift_b, 0, 1
        )

    # Section pressure feature (feat_31)
    section_pressure_col = "feat_31"
    if section_pressure_col in df.columns:
        df.loc[section_a_mask, section_pressure_col] = np.clip(
            df.loc[section_a_mask, section_pressure_col].values + 0.02, 0, 1
        )
        df.loc[section_b_mask, section_pressure_col] = np.clip(
            df.loc[section_b_mask, section_pressure_col].values - 0.02, 0, 1
        )

    return df


def generate_power_law_adversarial(df: pd.DataFrame) -> pd.DataFrame:
    """Power-law forgetting adversarial corpus.

    In the power-law regime (Wickelgren 1974), forgetting follows t^(-d) instead
    of exp(-λt). This produces heavier tails: knowledge decays more slowly at first
    but never fully stabilizes. Students with moderate attendance appear riskier
    because their knowledge gaps accumulate non-linearly.

    We simulate this by:
    1. Amplifying the variance of attendance-related features
    2. Increasing prerequisite pressure for mid-range CGPA students
    3. Adding noise to trend features (momentum becomes less predictive)
    """
    df = df.copy()
    n = len(df)

    # Attendance features get heavier tails
    for col in ["feat_0", "feat_1", "feat_2"]:  # attendancePct, trend, historyRisk
        if col in df.columns:
            noise = rng.normal(0, 0.08, n)
            df[col] = np.clip(df[col].values + noise, 0, 1)

    # Prerequisite pressure amplified for mid-CGPA students
    cgpa_col = "feat_3"
    prereq_cols = [f"feat_{i}" for i in range(15, 25)]  # prerequisite features
    if cgpa_col in df.columns:
        cgpa_vals = df[cgpa_col].values
        mid_mask = (cgpa_vals > 0.3) & (cgpa_vals < 0.7)
        for col in prereq_cols:
            if col in df.columns:
                boost = rng.uniform(0.05, 0.15, mid_mask.sum())
                df.loc[mid_mask, col] = np.clip(
                    df.loc[mid_mask, col].values + boost, 0, 1
                )

    # Momentum features become noisier (less predictive)
    for col in ["feat_13"]:  # ttMomentumRiskScaled
        if col in df.columns:
            noise = rng.normal(0, 0.10, n)
            df[col] = np.clip(df[col].values + noise, 0, 1)

    # Update labels: more students become at-risk due to non-linear accumulation
    label_cols = ["label_attendance", "label_ce", "label_see", "label_overall", "label_downstream"]
    for col in label_cols:
        if col in df.columns:
            flip_mask = rng.random(n) < 0.03  # 3% additional risk
            df.loc[flip_mask, col] = 1

    return df


def generate_thresholded_recovery_adversarial(df: pd.DataFrame) -> pd.DataFrame:
    """Thresholded recovery adversarial corpus.

    Students exhibit step-function recovery: below a critical support threshold,
    interventions have zero effect; above it, recovery is rapid. This creates
    discontinuities that linear models handle poorly.

    We simulate this by:
    1. Creating a cliff effect in intervention-related features
    2. Binarizing the recovery gradient
    3. Making SEE risk discontinuous with respect to CE performance
    """
    df = df.copy()
    n = len(df)

    # Intervention residual gets thresholded (cliff effect)
    intervention_col = "feat_14"  # interventionResidualRiskScaled
    if intervention_col in df.columns:
        vals = df[intervention_col].values
        # Below 0.4: no intervention effect (risk stays high)
        # Above 0.4: rapid recovery (risk drops sharply)
        thresholded = np.where(vals < 0.4, vals * 1.3, vals * 0.5)
        df[intervention_col] = np.clip(thresholded, 0, 1)

    # SEE risk becomes discontinuous with CE
    see_col = "feat_7"  # seeRiskScaled
    ce_related_cols = ["feat_5", "feat_6"]  # tt1Risk, tt2Risk
    if see_col in df.columns:
        for ce_col in ce_related_cols:
            if ce_col in df.columns:
                ce_vals = df[ce_col].values
                # Discontinuity: CE below 0.5 → SEE risk jumps
                jump_mask = ce_vals > 0.5
                df.loc[jump_mask, see_col] = np.clip(
                    df.loc[jump_mask, see_col].values + 0.15, 0, 1
                )

    # Labels: threshold effects create more false negatives
    label_cols = ["label_see", "label_overall"]
    for col in label_cols:
        if col in df.columns:
            flip_mask = rng.random(n) < 0.04
            df.loc[flip_mask, col] = 1

    return df


def generate_workload_shock_adversarial(df: pd.DataFrame) -> pd.DataFrame:
    """Workload shock adversarial corpus.

    External shocks (job loss, family emergency, health crisis) create sudden
    performance degradation that doesn't follow the gradual decay assumed by
    the exponential forgetting model. These shocks are unpredictable from
    historical features alone.

    We simulate this by:
    1. Adding shock events to random students
    2. Shocks affect all assessment features simultaneously
    3. Creating clusters of sudden failure that break the smooth risk gradient
    """
    df = df.copy()
    n = len(df)

    # 8% of students experience a workload shock
    shock_mask = rng.random(n) < 0.08

    # Shock affects all assessment features
    assessment_cols = [f"feat_{i}" for i in [5, 6, 7, 8, 9]]  # tt1, tt2, see, quiz, assignment risk
    for col in assessment_cols:
        if col in df.columns:
            shock_values = rng.uniform(0.15, 0.35, shock_mask.sum())
            df.loc[shock_mask, col] = np.clip(
                df.loc[shock_mask, col].values + shock_values, 0, 1
            )

    # Attendance also drops for shocked students
    for col in ["feat_0", "feat_1"]:
        if col in df.columns:
            shock_values = rng.uniform(0.05, 0.15, shock_mask.sum())
            df.loc[shock_mask, col] = np.clip(
                df.loc[shock_mask, col].values - shock_values, 0, 1
            )

    # Labels: shocked students are at higher risk
    label_cols = ["label_attendance", "label_overall", "label_downstream"]
    for col in label_cols:
        if col in df.columns:
            df.loc[shock_mask, col] = 1

    return df


def main():
    parser = argparse.ArgumentParser(description="Generate augmented + adversarial CSVs")
    parser.add_argument("input_csv", help="Path to original features CSV")
    parser.add_argument("output_dir", help="Directory for output CSVs")
    args = parser.parse_args()

    input_path = Path(args.input_csv)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print(f"ERROR: input CSV not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading {input_path}...")
    df = pd.read_csv(input_path)
    print(f"  {len(df):,} rows, {len(df.columns)} columns")

    # 1. Add section_code
    print("Adding section_code...")
    df_aug = add_section_code(df)
    aug_path = output_dir / "features-augmented.csv"
    df_aug.to_csv(aug_path, index=False)
    print(f"  -> {aug_path} ({len(df_aug):,} rows)")

    # 2. Generate adversarial CSVs
    for name, generator in [
        ("power-law", generate_power_law_adversarial),
        ("thresholded-recovery", generate_thresholded_recovery_adversarial),
        ("workload-shock", generate_workload_shock_adversarial),
    ]:
        print(f"Generating adversarial: {name}...")
        adv_df = generator(df_aug)
        adv_path = output_dir / f"adversarial-{name}.csv"
        adv_df.to_csv(adv_path, index=False)
        print(f"  -> {adv_path} ({len(adv_df):,} rows)")

    print("\nDone. Next steps:")
    print(f"  python train_sota_ensemble.py {aug_path} {output_dir}/training --family-disjoint")
    adv_csvs = " ".join(str(output_dir / f"adversarial-{n}.csv") for n in [
        "power-law", "thresholded-recovery", "workload-shock"
    ])
    print(f"  python train_sota_ensemble.py {aug_path} {output_dir}/training --family-disjoint --adversarial-csv {adv_csvs}")


if __name__ == "__main__":
    main()
