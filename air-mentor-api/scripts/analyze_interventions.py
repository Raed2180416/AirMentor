"""
Intervention effectiveness analysis for AirMentor proof-risk-model.

Measures how much ML-driven interventions improve student outcomes compared
to no-intervention baseline. Uses counterfactual simulation: for each student
predicted as high-risk, we simulate what happens with and without intervention.

Usage:
    python analyze_interventions.py <features_csv> <training_dir> [--output report.md]
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# ── Lazy imports for ML dependencies ──
try:
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score, brier_score_loss
    from xgboost import XGBClassifier
    from lightgbm import LGBMClassifier
    from catboost import CatBoostClassifier
except ImportError:
    print("ERROR: Install dependencies: pip install numpy pandas scikit-learn xgboost lightgbm catboost", file=sys.stderr)
    sys.exit(1)

DETERMINISTIC_SEED = 42

HEADS = ["attendanceRisk", "ceRisk", "seeRisk", "overallCourseRisk", "downstreamCarryoverRisk"]
LABEL_COLS = {
    "attendanceRisk": "label_attendance",
    "ceRisk": "label_ce",
    "seeRisk": "label_see",
    "overallCourseRisk": "label_overall",
    "downstreamCarryoverRisk": "label_downstream",
}

# ── Intervention parameters (from learning-dynamics-constants.ts) ──
INTERVENTION_PARAMS = {
    "attendanceRisk": {
        "uplift_attendance": 12.0,  # percentage points
        "uplift_ce": 3.0,
        "uplift_see": 2.0,
        "cost_days": 7,
    },
    "ceRisk": {
        "uplift_attendance": 3.0,
        "uplift_ce": 8.0,
        "uplift_see": 4.0,
        "cost_days": 14,
    },
    "seeRisk": {
        "uplift_attendance": 2.0,
        "uplift_ce": 4.0,
        "uplift_see": 10.0,
        "cost_days": 21,
    },
    "overallCourseRisk": {
        "uplift_attendance": 5.0,
        "uplift_ce": 6.0,
        "uplift_see": 6.0,
        "cost_days": 14,
    },
    "downstreamCarryoverRisk": {
        "uplift_attendance": 3.0,
        "uplift_ce": 5.0,
        "uplift_see": 5.0,
        "cost_days": 21,
    },
}


def load_models(training_dir: Path) -> dict:
    """Load trained models from training directory."""
    metrics_path = training_dir / "metrics.json"
    if not metrics_path.exists():
        print(f"ERROR: metrics.json not found in {training_dir}", file=sys.stderr)
        sys.exit(1)

    metrics = json.loads(metrics_path.read_text())
    models = {}

    for head_key in HEADS:
        head_data = metrics["heads"].get(head_key)
        if not head_data or head_data.get("skipped"):
            continue

        challenger = head_data.get("challenger", {})
        model_family = challenger.get("modelFamily", "logistic")
        model_path_str = challenger.get("modelArtifact")

        if model_family == "logistic":
            # Retrain logistic regression (no artifact to load)
            continue  # Will retrain below

        if model_path_str:
            model_path = Path(model_path_str)
            if model_path.exists():
                try:
                    if model_family == "xgboost":
                        m = XGBClassifier()
                        m.load_model(str(model_path))
                        models[head_key] = m
                    elif model_family == "lightgbm":
                        m = LGBMClassifier()
                        m.booster_ = __import__("lightgbm").Booster(model_file=str(model_path))
                        models[head_key] = m
                    elif model_family == "catboost":
                        m = CatBoostClassifier()
                        m.load_model(str(model_path), format="json")
                        models[head_key] = m
                except Exception as exc:
                    print(f"  WARNING: failed to load {head_key} model: {exc}")

    return models


def train_baseline_models(df_train: pd.DataFrame, feature_cols: list) -> dict:
    """Train logistic regression baselines for heads without saved models."""
    models = {}
    for head_key in HEADS:
        label_col = LABEL_COLS[head_key]
        if label_col not in df_train.columns:
            continue
        y = df_train[label_col].values
        X = df_train[feature_cols].values
        pos = int(y.sum())
        if pos == 0 or pos == len(y):
            continue
        lr = LogisticRegression(
            C=1.0, solver="lbfgs", class_weight="balanced",
            max_iter=1000, random_state=DETERMINISTIC_SEED,
        )
        lr.fit(X, y)
        models[head_key] = lr
    return models


def simulate_intervention(
    row: pd.Series,
    head_key: str,
    intervention_params: dict,
    rng: np.random.Generator,
) -> dict:
    """Simulate the effect of an intervention on a student's outcomes.

    Returns dict with counterfactual outcomes (with and without intervention).
    """
    params = intervention_params[head_key]

    # Extract current state from features
    attendance_pct = row["feat_0"] * 60 + 40  # inverse of s(v,40,100)
    tt1_risk = row["feat_5"]
    tt2_risk = row["feat_6"]
    see_risk = row["feat_7"]
    quiz_risk = row["feat_8"]
    assign_risk = row["feat_9"]

    # Student receptivity to intervention (varies by student)
    receptivity = 0.3 + rng.random() * 0.5  # 0.3-0.8

    # Intervention effects (with noise)
    att_uplift = params["uplift_attendance"] * receptivity + rng.normal(0, 2)
    ce_uplift = params["uplift_ce"] * receptivity + rng.normal(0, 1.5)
    see_uplift = params["uplift_see"] * receptivity + rng.normal(0, 2)

    # Counterfactual: with intervention
    att_with = min(attendance_pct + att_uplift, 98)
    ce_risk_with = max(tt1_risk - ce_uplift / 100, 0)
    see_risk_with = max(see_risk - see_uplift / 100, 0)

    # Outcome metrics
    att_improvement = att_with - attendance_pct
    ce_improvement = (tt1_risk - ce_risk_with) * 100  # percentage points
    see_improvement = (see_risk - see_risk_with) * 100

    return {
        "attendance_before": attendance_pct,
        "attendance_after": att_with,
        "attendance_delta": att_improvement,
        "ce_risk_before": tt1_risk,
        "ce_risk_after": ce_risk_with,
        "ce_delta": ce_improvement,
        "see_risk_before": see_risk,
        "see_risk_after": see_risk_with,
        "see_delta": see_improvement,
        "receptivity": receptivity,
        "cost_days": params["cost_days"],
    }


def analyze_interventions(
    df: pd.DataFrame,
    models: dict,
    feature_cols: list,
    output_path: str = None,
) -> str:
    """Run full intervention effectiveness analysis and return markdown report."""
    rng = np.random.default_rng(DETERMINISTIC_SEED)
    lines = []

    lines.append("# Intervention Effectiveness Analysis")
    lines.append("")
    lines.append(f"**Dataset:** {len(df):,} rows, {len(feature_cols)} features")
    lines.append(f"**Models:** {len(models)} heads with trained models")
    lines.append("")
    lines.append("## Methodology")
    lines.append("")
    lines.append(
        "For each student predicted as high-risk (probability > 0.5), we simulate "
        "a counterfactual intervention and measure the expected outcome improvement. "
        "Intervention effects are calibrated using literature-anchored parameters "
        "from `learning-dynamics-constants.ts`."
    )
    lines.append("")

    # Summary table
    lines.append("## Per-Head Results")
    lines.append("")
    lines.append("| Head | Students at Risk | Mean Attendance Δ | Mean CE Risk Δ | Mean SEE Risk Δ | Mean Cost (days) |")
    lines.append("|---|---:|---:|---:|---:|---:|")

    all_results = {}

    for head_key in HEADS:
        if head_key not in models:
            continue

        label_col = LABEL_COLS[head_key]
        if label_col not in df.columns:
            continue

        model = models[head_key]
        X = df[feature_cols].values

        # Predict risk
        try:
            probs = model.predict_proba(X)[:, 1]
        except Exception:
            continue

        # Identify at-risk students (predicted probability > 0.5)
        at_risk_mask = probs > 0.5
        at_risk_df = df[at_risk_mask].copy()
        n_at_risk = len(at_risk_df)

        if n_at_risk == 0:
            lines.append(f"| {head_key} | 0 | — | — | — | — |")
            continue

        # Simulate interventions for at-risk students
        results = []
        for _, row in at_risk_df.iterrows():
            result = simulate_intervention(row, head_key, INTERVENTION_PARAMS, rng)
            results.append(result)

        results_df = pd.DataFrame(results)

        mean_att_delta = results_df["attendance_delta"].mean()
        mean_ce_delta = results_df["ce_delta"].mean()
        mean_see_delta = results_df["see_delta"].mean()
        mean_cost = results_df["cost_days"].mean()

        lines.append(
            f"| {head_key} | {n_at_risk:,} | {mean_att_delta:+.1f} pp | "
            f"{mean_ce_delta:+.1f} pp | {mean_see_delta:+.1f} pp | {mean_cost:.0f} |"
        )

        all_results[head_key] = {
            "n_at_risk": n_at_risk,
            "mean_att_delta": mean_att_delta,
            "mean_ce_delta": mean_ce_delta,
            "mean_see_delta": mean_see_delta,
            "mean_cost": mean_cost,
            "receptivity_mean": results_df["receptivity"].mean(),
        }

    lines.append("")

    # Aggregate analysis
    lines.append("## Aggregate Analysis")
    lines.append("")

    total_at_risk = sum(r["n_at_risk"] for r in all_results.values())
    avg_att = np.mean([r["mean_att_delta"] for r in all_results.values()])
    avg_ce = np.mean([r["mean_ce_delta"] for r in all_results.values()])
    avg_see = np.mean([r["mean_see_delta"] for r in all_results.values()])
    avg_cost = np.mean([r["mean_cost"] for r in all_results.values()])

    lines.append(f"- **Total students flagged:** {total_at_risk:,}")
    lines.append(f"- **Average attendance improvement:** {avg_att:+.1f} percentage points")
    lines.append(f"- **Average CE risk reduction:** {avg_ce:+.1f} percentage points")
    lines.append(f"- **Average SEE risk reduction:** {avg_see:+.1f} percentage points")
    lines.append(f"- **Average intervention cost:** {avg_cost:.0f} days")
    lines.append("")

    # Cost-benefit
    lines.append("## Cost-Benefit Analysis")
    lines.append("")
    lines.append(
        "Assuming each percentage point of attendance improvement correlates with "
        "~0.4 percentage points of grade improvement (Credé et al., 2010), and each "
        "percentage point of SEE improvement directly translates to pass rate:"
    )
    lines.append("")

    att_grade_impact = avg_att * 0.4
    total_grade_impact = att_grade_impact + avg_see * 0.6  # weighted by exam weight
    lines.append(f"- **Expected grade improvement from attendance:** {att_grade_impact:+.1f} pp")
    lines.append(f"- **Expected grade improvement from SEE:** {avg_see * 0.6:+.1f} pp")
    lines.append(f"- **Total expected grade improvement:** {total_grade_impact:+.1f} pp")
    lines.append("")

    # Conclusion
    lines.append("## Conclusion")
    lines.append("")
    if total_grade_impact > 5:
        lines.append(
            f"ML-driven interventions are projected to improve student outcomes by "
            f"**{total_grade_impact:.1f} percentage points** on average, at a cost of "
            f"**{avg_cost:.0f} intervention-days** per student. This represents a "
            f"meaningful improvement that justifies the intervention cost."
        )
    else:
        lines.append(
            f"ML-driven interventions show modest improvement of "
            f"**{total_grade_impact:.1f} percentage points**. Further calibration "
            f"of intervention parameters may be needed."
        )

    report = "\n".join(lines)

    if output_path:
        Path(output_path).write_text(report)
        print(f"Report written to {output_path}")

    return report


def main():
    parser = argparse.ArgumentParser(description="Analyze intervention effectiveness")
    parser.add_argument("features_csv", help="Path to features CSV")
    parser.add_argument("training_dir", help="Path to training output directory")
    parser.add_argument("--output", "-o", default=None, help="Output markdown report path")
    args = parser.parse_args()

    features_path = Path(args.features_csv)
    training_dir = Path(args.training_dir)

    if not features_path.exists():
        print(f"ERROR: {features_path} not found", file=sys.stderr)
        sys.exit(1)

    print(f"Loading data from {features_path}...")
    df = pd.read_csv(features_path)
    feature_cols = [c for c in df.columns if c.startswith("feat_")]
    print(f"  {len(df):,} rows, {len(feature_cols)} features")

    # Split
    df_train = df[df["split"] == "train"].copy()
    df_test = df[df["split"] == "test"].copy()

    print(f"\nLoading models from {training_dir}...")
    saved_models = load_models(training_dir)
    print(f"  Loaded {len(saved_models)} saved models")

    # Train baselines for missing heads
    baseline_models = train_baseline_models(df_train, feature_cols)
    all_models = {**saved_models, **baseline_models}
    print(f"  Total models: {len(all_models)}")

    print(f"\nRunning intervention analysis on test set ({len(df_test):,} rows)...")
    report = analyze_interventions(df_test, all_models, feature_cols, args.output)
    print(report)


if __name__ == "__main__":
    main()
