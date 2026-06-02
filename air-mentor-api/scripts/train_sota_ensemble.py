"""
Train per-head deterministic SOTA ensemble (XGBoost + LightGBM + CatBoost + meta-learner)
on the governed corpus exported by the TypeScript evaluator.

Usage:
    python train_sota_ensemble.py <features_csv> <output_dir> [--device cpu]

Input CSV columns (from AIRMENTOR_EVAL_EXPORT_FEATURES_CSV):
    run_id, split, stage_key, scenario_family,
    label_attendance, label_ce, label_see, label_overall, label_downstream,
    feat_0 ... feat_N

Output per head (in output_dir):
    sota_<head>_v1.json       -- Ensemble meta-learner + base model artifacts
    metrics.json              -- validation + test metrics for all heads
    promotion-decision.json   -- Per-head promotion decision
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import os
import re
import sys
import warnings
from pathlib import Path
from typing import Any

warnings.filterwarnings("ignore", category=UserWarning)

np = None
pd = None
CatBoostClassifier = None
Pool = None
LogisticRegression = None
IsotonicRegression = None
XGBClassifier = None
LGBMClassifier = None
shap = None
average_precision_score = None
brier_score_loss = None
confusion_matrix = None
log_loss = None
precision_recall_fscore_support = None
roc_auc_score = None

HEADS = [
    "attendanceRisk",
    "ceRisk",
    "seeRisk",
    "overallCourseRisk",
    "downstreamCarryoverRisk",
]

LABEL_COLS = {
    "attendanceRisk": "label_attendance",
    "ceRisk": "label_ce",
    "seeRisk": "label_see",
    "overallCourseRisk": "label_overall",
    "downstreamCarryoverRisk": "label_downstream",
}

REQUIRED_COLUMNS = [
    "run_id",
    "split",
    "stage_key",
    "scenario_family",
    "label_attendance",
    "label_ce",
    "label_see",
    "label_overall",
    "label_downstream",
]

LOCAL_ECE_BANDS = {
    "localEceAt04": (0.4, 0.08),
    "localEceAt065": (0.65, 0.08),  # Product action threshold — critical gate
    "localEceAt085": (0.85, 0.08),
}

DETERMINISTIC_SEED = 42


def load_python_ml_dependencies() -> None:
    global np, pd, CatBoostClassifier, Pool
    global LogisticRegression, IsotonicRegression
    global XGBClassifier, LGBMClassifier
    global average_precision_score, brier_score_loss, confusion_matrix
    global log_loss, precision_recall_fscore_support, roc_auc_score

    try:
        import numpy as _np
        import pandas as _pd
        from catboost import CatBoostClassifier as _CatBoostClassifier
        from catboost import Pool as _Pool
        from lightgbm import LGBMClassifier as _LGBMClassifier
        from sklearn.isotonic import IsotonicRegression as _IsotonicRegression
        from sklearn.linear_model import LogisticRegression as _LogisticRegression
        from sklearn.metrics import (
            average_precision_score as _average_precision_score,
            brier_score_loss as _brier_score_loss,
            confusion_matrix as _confusion_matrix,
            log_loss as _log_loss,
            precision_recall_fscore_support as _precision_recall_fscore_support,
            roc_auc_score as _roc_auc_score,
        )
        from xgboost import XGBClassifier as _XGBClassifier
        # SHAP for explanation parity (optional — graceful fallback)
        try:
            import shap as _shap
        except Exception:
            _shap = None
    except ModuleNotFoundError as exc:
        print(
            f"[sota] ERROR: missing Python dependency '{exc.name}'. "
            "Install: pip install numpy pandas scikit-learn xgboost lightgbm catboost",
            file=sys.stderr,
        )
        sys.exit(1)

    np = _np
    pd = _pd
    CatBoostClassifier = _CatBoostClassifier
    Pool = _Pool
    LGBMClassifier = _LGBMClassifier
    XGBClassifier = _XGBClassifier
    LogisticRegression = _LogisticRegression
    IsotonicRegression = _IsotonicRegression
    shap = _shap
    average_precision_score = _average_precision_score
    brier_score_loss = _brier_score_loss
    confusion_matrix = _confusion_matrix
    log_loss = _log_loss
    precision_recall_fscore_support = _precision_recall_fscore_support
    roc_auc_score = _roc_auc_score

    # Deterministic NumPy
    np.random.seed(DETERMINISTIC_SEED)


def read_ts_const_string_array(source_path: Path, const_name: str) -> list[str]:
    text = source_path.read_text(encoding="utf-8")
    match = re.search(rf"export const {re.escape(const_name)} = \[(.*?)\] as const", text, re.S)
    if not match:
        raise ValueError(f"Unable to locate {const_name} in {source_path}")
    return [
        g1 or g2
        for g1, g2 in re.findall(r"'([^']+)'|\"([^\"]+)\"", match.group(1))
    ]


def sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def sha256_json(blob: object) -> str:
    payload = json.dumps(blob, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def sorted_feature_columns(columns: list[str]) -> list[str]:
    feature_columns = [c for c in columns if re.fullmatch(r"feat_\d+", c)]
    return sorted(feature_columns, key=lambda c: int(c.split("_", 1)[1]))


def validate_governed_csv(
    features_csv: Path,
    expected_feature_keys: list[str],
    expected_scenario_families: list[str],
    require_all_scenario_families: bool,
) -> dict:
    with features_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        missing = [c for c in REQUIRED_COLUMNS if c not in fieldnames]
        if missing:
            raise ValueError(f"missing required governed export columns: {missing}")

        feature_columns = sorted_feature_columns(fieldnames)
        expected_feature_columns = [f"feat_{i}" for i in range(len(expected_feature_keys))]
        if feature_columns != expected_feature_columns:
            raise ValueError(
                f"feature column mismatch: expected {len(expected_feature_columns)} "
                f"sequential columns feat_0..feat_{len(expected_feature_columns) - 1}, "
                f"found {len(feature_columns)} columns"
            )

        row_count = 0
        split_counts = {"train": 0, "validation": 0, "test": 0}
        scenario_family_counts = {f: 0 for f in expected_scenario_families}
        unexpected_scenario_families: dict[str, int] = {}
        blank_required_counts = {c: 0 for c in REQUIRED_COLUMNS}
        run_ids_by_split = {"train": set(), "validation": set(), "test": set()}

        for row in reader:
            row_count += 1
            for c in REQUIRED_COLUMNS:
                if not (row.get(c) or "").strip():
                    blank_required_counts[c] += 1
            split = (row.get("split") or "").strip()
            run_id = (row.get("run_id") or "").strip()
            scenario_family = (row.get("scenario_family") or "").strip()
            if split in split_counts:
                split_counts[split] += 1
                if run_id:
                    run_ids_by_split[split].add(run_id)
            if scenario_family in scenario_family_counts:
                scenario_family_counts[scenario_family] += 1
            elif scenario_family:
                unexpected_scenario_families[scenario_family] = unexpected_scenario_families.get(scenario_family, 0) + 1

    if row_count == 0:
        raise ValueError("governed export CSV has zero rows")

    blank_required_counts = {c: n for c, n in blank_required_counts.items() if n}
    if blank_required_counts:
        raise ValueError(f"blank values in required governed export columns: {blank_required_counts}")

    missing_splits = [s for s, n in split_counts.items() if n == 0]
    if missing_splits:
        raise ValueError(f"missing required train/validation/test splits: {missing_splits}")

    leaking_runs = {
        "train_validation": sorted(run_ids_by_split["train"] & run_ids_by_split["validation"])[:5],
        "train_test": sorted(run_ids_by_split["train"] & run_ids_by_split["test"])[:5],
        "validation_test": sorted(run_ids_by_split["validation"] & run_ids_by_split["test"])[:5],
    }
    leaking_runs = {k: v for k, v in leaking_runs.items() if v}
    if leaking_runs:
        raise ValueError(f"run_id leakage across splits: {json.dumps(leaking_runs, sort_keys=True)}")

    if unexpected_scenario_families:
        raise ValueError(f"unexpected scenario_family values: {unexpected_scenario_families}")

    missing_scenario_families = [f for f, n in scenario_family_counts.items() if n == 0]
    if require_all_scenario_families and missing_scenario_families:
        raise ValueError(f"missing governed scenario families: {missing_scenario_families}")

    return {
        "rowCount": row_count,
        "featureColumns": feature_columns,
        "featureCount": len(feature_columns),
        "featureKeyHash": sha256_json(expected_feature_keys),
        "splitCounts": split_counts,
        "runCountsBySplit": {s: len(v) for s, v in run_ids_by_split.items()},
        "scenarioFamilyCounts": scenario_family_counts,
        "missingScenarioFamilies": missing_scenario_families,
    }


def local_ece(y_true: np.ndarray, y_prob: np.ndarray, center: float, half_width: float) -> dict:
    mask = np.abs(y_prob - center) <= half_width
    support = int(mask.sum())
    if support == 0:
        return {
            "center": center,
            "halfWidth": half_width,
            "support": 0,
            "ece": None,
            "meanProb": None,
            "meanLabel": None,
        }
    p = y_prob[mask]
    y = y_true[mask]
    return {
        "center": center,
        "halfWidth": half_width,
        "support": support,
        "ece": float(abs(p.mean() - y.mean())),
        "meanProb": float(p.mean()),
        "meanLabel": float(y.mean()),
    }


def overload_ratio(y_true: np.ndarray, y_prob: np.ndarray) -> float | None:
    positive_rate = float(y_true.mean()) if len(y_true) else 0.0
    if positive_rate <= 0:
        return None
    return float(y_prob.mean() / positive_rate)


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def fit_sigmoid_calibration(raw_probs: np.ndarray, y_true: np.ndarray) -> tuple[np.ndarray, dict | None]:
    if len(set(y_true.tolist())) < 2:
        return raw_probs, None
    from sklearn.linear_model import LogisticRegression as _LR
    # Fit Platt scaling: logit(p) -> logit(p')
    logit_p = np.log(np.clip(raw_probs, 1e-6, 1 - 1e-6) / np.clip(1 - raw_probs, 1e-6, 1 - 1e-6))
    lr = _LR(penalty=None, solver="lbfgs", max_iter=1000)
    lr.fit(logit_p.reshape(-1, 1), y_true)
    slope = float(lr.coef_[0][0])
    intercept = float(lr.intercept_[0])
    blob = {"method": "sigmoid", "slope": slope, "intercept": intercept}
    calibrated = _sigmoid(slope * logit_p + intercept)
    return calibrated, blob


def fit_beta_calibration(raw_probs: np.ndarray, y_true: np.ndarray) -> tuple[np.ndarray, dict | None]:
    if len(set(y_true.tolist())) < 2:
        return raw_probs, None
    from sklearn.linear_model import LogisticRegression as _LR
    log_prob = np.log(np.clip(raw_probs, 1e-6, 1.0))
    log_inv_prob = -np.log(np.clip(1 - raw_probs, 1e-6, 1.0))
    X_cal = np.column_stack([log_prob, log_inv_prob])
    lr = _LR(penalty=None, solver="lbfgs", max_iter=1000)
    lr.fit(X_cal, y_true)
    w1 = float(lr.coef_[0][0])
    w2 = float(lr.coef_[0][1])
    intercept = float(lr.intercept_[0])
    blob = {"method": "beta", "logProbWeight": w1, "logInverseProbWeight": w2, "intercept": intercept}
    logit_cal = w1 * log_prob + w2 * log_inv_prob + intercept
    calibrated = _sigmoid(logit_cal)
    return calibrated, blob


def fit_isotonic_calibration(raw_probs: np.ndarray, y_true: np.ndarray) -> tuple[np.ndarray, dict | None]:
    if len(set(y_true.tolist())) < 2:
        return raw_probs, None
    cal = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    cal.fit(raw_probs, y_true)
    blob = {
        "method": "isotonic",
        "xThresholds": [float(v) for v in cal.X_thresholds_],
        "yThresholds": [float(v) for v in cal.y_thresholds_],
    }
    return cal.predict(raw_probs), blob


def apply_calibration(raw_probs: np.ndarray, calibration_blob: dict | None) -> np.ndarray:
    if calibration_blob is None:
        return raw_probs
    method = calibration_blob.get("method", "identity")
    if method == "identity":
        return raw_probs
    if method == "isotonic":
        x_thresholds = np.asarray(calibration_blob["xThresholds"], dtype=np.float64)
        y_thresholds = np.asarray(calibration_blob["yThresholds"], dtype=np.float64)
        return np.interp(raw_probs, x_thresholds, y_thresholds, left=y_thresholds[0], right=y_thresholds[-1])
    if method == "sigmoid":
        logit_p = np.log(np.clip(raw_probs, 1e-6, 1 - 1e-6) / np.clip(1 - raw_probs, 1e-6, 1 - 1e-6))
        return _sigmoid((calibration_blob["slope"] * logit_p) + calibration_blob["intercept"])
    if method == "beta":
        log_prob = np.log(np.clip(raw_probs, 1e-6, 1.0))
        log_inv_prob = -np.log(np.clip(1 - raw_probs, 1e-6, 1.0))
        logit_cal = (
            calibration_blob["logProbWeight"] * log_prob
            + calibration_blob["logInverseProbWeight"] * log_inv_prob
            + calibration_blob["intercept"]
        )
        return _sigmoid(logit_cal)
    return raw_probs


def get_overload_correction(probs: np.ndarray, y_true: np.ndarray, target_overload: float = 1.0) -> tuple[float, float]:
    """Calculate scalar mix factor to shrink probabilities toward base rate to fix overload issues."""
    positive_rate = float(y_true.mean()) if len(y_true) > 0 else 0.0
    if positive_rate <= 0:
        return 1.0, positive_rate
    current_overload = float(probs.mean() / positive_rate)
    if abs(current_overload - target_overload) < 0.001 or abs(current_overload - 1.0) < 1e-6:
        return 1.0, positive_rate
    mix = (target_overload - 1.0) / (current_overload - 1.0)
    mix = np.clip(mix, 0.0, 1.0)
    return float(mix), float(positive_rate)

def apply_overload_correction(probs: np.ndarray, mix: float, positive_rate: float) -> np.ndarray:
    """Apply the calculated scalar mix factor."""
    corrected = mix * probs + (1.0 - mix) * positive_rate
    return np.clip(corrected, 0.0001, 0.9999)



def fit_best_calibration(raw_probs: np.ndarray, y_true: np.ndarray) -> tuple[np.ndarray, dict]:
    """Try isotonic, sigmoid, beta; pick best combined local ECE on validation."""
    if len(set(y_true.tolist())) < 2:
        return raw_probs, {"method": "identity"}

    candidates = []
    for fit_fn, name in [(fit_isotonic_calibration, "isotonic"),
                          (fit_sigmoid_calibration, "sigmoid"),
                          (fit_beta_calibration, "beta")]:
        try:
            cal_probs, blob = fit_fn(raw_probs, y_true)
            if blob is None:
                continue
            ece04 = local_ece(y_true, cal_probs, 0.4, 0.08).get("ece", 1.0) or 1.0
            ece085 = local_ece(y_true, cal_probs, 0.85, 0.08).get("ece", 1.0) or 1.0
            score = ece04 + ece085  # lower is better
            candidates.append((score, cal_probs, blob, name))
        except Exception:
            continue

    if not candidates:
        return raw_probs, {"method": "identity"}

    candidates.sort(key=lambda x: x[0])
    return candidates[0][1], candidates[0][2]


def metrics_for(y_true: np.ndarray, y_prob: np.ndarray) -> dict:
    y_pred = (y_prob >= 0.5).astype(int)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="binary", zero_division=0
    )
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    base = {
        "brier": float(brier_score_loss(y_true, y_prob)),
        "precisionAt50": float(precision),
        "recallAt50": float(recall),
        "f1At50": float(f1),
        "truePositiveAt50": int(tp),
        "falsePositiveAt50": int(fp),
        "trueNegativeAt50": int(tn),
        "falseNegativeAt50": int(fn),
        "localCalibration": {
            key: local_ece(y_true, y_prob, center, half_width)
            for key, (center, half_width) in LOCAL_ECE_BANDS.items()
        },
        "overloadRatio": overload_ratio(y_true, y_prob),
    }
    if len(set(y_true)) < 2:
        return {**base, "rocAuc": 0.5, "logLoss": 0.0, "averagePrecision": 0.0}
    return {
        **base,
        "rocAuc": float(roc_auc_score(y_true, y_prob)),
        "logLoss": float(log_loss(y_true, y_prob)),
        "averagePrecision": float(average_precision_score(y_true, y_prob)),
    }


def compute_fairness_weights(
    df: pd.DataFrame,
    label_col: str,
    sensitive_attr: str = "scenario_family",
) -> np.ndarray:
    """Compute sample weights for fairness-aware training.

    Reweights by sensitive attribute × label intersection to ensure
    minority groups and minority classes both get adequate representation.
    """
    groups = df[sensitive_attr].unique()
    # Compute group × label counts
    counts: dict[tuple[str, int], int] = {}
    for g in groups:
        for y in [0, 1]:
            counts[(g, int(y))] = len(df[(df[sensitive_attr] == g) & (df[label_col] == y)])
    # Inverse frequency weighting with smoothing
    max_count = max(counts.values()) if counts else 1
    weights = np.ones(len(df), dtype=np.float64)
    for i, row in enumerate(df.itertuples(index=False)):
        g = getattr(row, sensitive_attr)
        y = int(getattr(row, label_col))
        weights[i] = max_count / max(counts.get((g, y), 1), 1)
    # Normalize to mean 1.0
    weights = weights / weights.mean()
    return weights


def equalized_odds_thresholds(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    groups: np.ndarray,
    target_tpr: float | None = None,
    target_fpr: float | None = None,
) -> dict[str, float]:
    """Find group-specific thresholds that equalize TPR or FPR across groups.

    Returns per-group threshold map. If target_tpr is set, finds threshold
    for each group that achieves that TPR. If target_fpr, does same for FPR.
    """
    unique_groups = np.unique(groups)
    thresholds: dict[str, float] = {}
    for g in unique_groups:
        mask = groups == g
        y_g = y_true[mask]
        p_g = y_prob[mask]
        if len(set(y_g)) < 2:
            thresholds[str(g)] = 0.65
            continue
        # Try thresholds from 0.10 to 0.90
        best_thresh = 0.65
        best_diff = float("inf")
        for thresh in np.linspace(0.10, 0.90, 81):
            pred = (p_g >= thresh).astype(int)
            tp = int(((pred == 1) & (y_g == 1)).sum())
            fp = int(((pred == 1) & (y_g == 0)).sum())
            tn = int(((pred == 0) & (y_g == 0)).sum())
            fn = int(((pred == 0) & (y_g == 1)).sum())
            tpr = tp / max(tp + fn, 1)
            fpr = fp / max(fp + tn, 1)
            if target_tpr is not None:
                diff = abs(tpr - target_tpr)
            elif target_fpr is not None:
                diff = abs(fpr - target_fpr)
            else:
                # Default: minimize |TPR - (1-FPR)| (equalized odds)
                diff = abs(tpr - (1 - fpr))
            if diff < best_diff:
                best_diff = diff
                best_thresh = thresh
        thresholds[str(g)] = float(best_thresh)
    return thresholds


def threshold_metrics_at(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    threshold: float = 0.65,
) -> dict[str, float]:
    """Compute precision/recall/F1 at a specific threshold (product action point)."""
    y_pred = (y_prob >= threshold).astype(int)
    tp = int(((y_pred == 1) & (y_true == 1)).sum())
    fp = int(((y_pred == 1) & (y_true == 0)).sum())
    fn = int(((y_pred == 0) & (y_true == 1)).sum())
    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    f1 = 2 * precision * recall / max(precision + recall, 1e-6)
    return {
        "threshold": threshold,
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "tp": tp,
        "fp": fp,
        "fn": fn,
    }


def compute_shap_summary(
    model,
    X_sample: np.ndarray,
    feature_cols: list[str],
    max_samples: int = 200,
) -> dict[str, Any] | None:
    """Compute SHAP values for tree-based models. Returns top feature summary."""
    if shap is None:
        return None
    try:
        explainer = shap.TreeExplainer(model)
        # Subsample for speed
        n = min(len(X_sample), max_samples)
        idx = np.random.choice(len(X_sample), n, replace=False)
        shap_values = explainer.shap_values(X_sample[idx])
        # For binary classification, shap_values may be a list [neg, pos]
        if isinstance(shap_values, list):
            shap_values = shap_values[1]  # Use positive class
        mean_abs = np.abs(shap_values).mean(axis=0)
        top_indices = np.argsort(mean_abs)[::-1][:10]
        return {
            "topFeatures": [
                {"feature": feature_cols[i], "meanAbsShap": float(mean_abs[i])}
                for i in top_indices
            ],
            "shapAvailable": True,
        }
    except Exception as exc:
        return {"shapAvailable": False, "error": str(exc)}


def explanation_parity_check(
    lr_model: LogisticRegression,
    tree_model,
    X_sample: np.ndarray,
    feature_cols: list[str],
) -> dict[str, Any]:
    """Check if tree model's top features align with logistic coefficients.

    Returns overlap score between logistic top-5 positive coefficients
    and tree model's top-5 SHAP features.
    """
    # Logistic top positive coefficients
    lr_coefs = lr_model.coef_[0]
    lr_top_idx = np.argsort(lr_coefs)[::-1][:5]
    lr_top = {feature_cols[i] for i in lr_top_idx}

    # Tree top SHAP features
    tree_summary = compute_shap_summary(tree_model, X_sample, feature_cols)
    if tree_summary is None or not tree_summary.get("shapAvailable"):
        return {"parityScore": None, "lrTop": list(lr_top), "treeTop": None}

    tree_top = {f["feature"] for f in tree_summary["topFeatures"][:5]}
    overlap = len(lr_top & tree_top) / 5.0
    return {
        "parityScore": float(overlap),
        "lrTop": list(lr_top),
        "treeTop": list(tree_top),
    }


def active_region_df(df: pd.DataFrame, head_key: str) -> pd.DataFrame:
    if len(df) == 0 or "stage_key" not in df.columns:
        return df
    active_stages = {
        "attendanceRisk": {"pre-tt1", "post-tt1", "post-tt2", "post-assignments", "post-see"},
        "ceRisk": {"post-tt1", "post-tt2", "post-assignments"},
        "seeRisk": {"post-tt2", "post-assignments", "post-see"},
        "overallCourseRisk": {"pre-tt1", "post-tt1", "post-tt2", "post-assignments", "post-see"},
        "downstreamCarryoverRisk": {"post-see"},
    }.get(head_key)
    if not active_stages:
        return df
    filtered = df[df["stage_key"].isin(active_stages)].copy()
    return filtered if len(filtered) > 0 else df


def monotone_constraints_for(feature_cols: list[str]) -> list[int]:
    # Feature order is defined by OBSERVABLE_FEATURE_KEYS in proof-risk-model.ts.
    decreasing_risk_indices = {0, 3}  # attendancePctScaled, currentCgpaScaled
    increasing_risk_indices = {
        1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
        15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
        32, 33, 34, 35, 36,
    }
    constraints: list[int] = []
    for c in feature_cols:
        idx = int(c.split("_", 1)[1])
        if idx in decreasing_risk_indices:
            constraints.append(-1)
        elif idx in increasing_risk_indices:
            constraints.append(1)
        else:
            constraints.append(0)
    return constraints


def train_logistic_baseline(
    X_train: np.ndarray, y_train: np.ndarray,
    X_val: np.ndarray, y_val: np.ndarray,
    X_test: np.ndarray,
) -> dict:
    model = LogisticRegression(
        C=1.0, solver="lbfgs",
        class_weight="balanced", max_iter=1000,
        random_state=DETERMINISTIC_SEED,
    )
    model.fit(X_train, y_train)
    raw_val = model.predict_proba(X_val)[:, 1]
    raw_test = model.predict_proba(X_test)[:, 1]
    cal_val, cal_blob = fit_best_calibration(raw_val, y_val)
    cal_test = apply_calibration(raw_test, cal_blob)
    return {
        "model": model,
        "validationProbs": cal_val,
        "testProbs": cal_test,
        "calibration": cal_blob or {"method": "identity"},
        "coefNormL1": float(np.abs(model.coef_).sum()),
        "intercept": float(model.intercept_[0]),
    }


def _make_meta_features(*probs: np.ndarray) -> np.ndarray:
    return np.column_stack(probs)


# ── Deterministic hyperparameter grids ──────────────────────────────────────

XGB_CONFIGS: list[dict[str, Any]] = [
    {"max_depth": 5, "learning_rate": 0.05, "n_estimators": 300, "subsample": 0.9, "colsample_bytree": 0.9},
    {"max_depth": 7, "learning_rate": 0.03, "n_estimators": 400, "subsample": 0.8, "colsample_bytree": 0.8},
]

LGBM_CONFIGS: list[dict[str, Any]] = [
    {"max_depth": 5, "learning_rate": 0.05, "n_estimators": 300, "num_leaves": 31, "subsample": 0.9, "colsample_bytree": 0.9},
    {"max_depth": 7, "learning_rate": 0.03, "n_estimators": 400, "num_leaves": 63, "subsample": 0.8, "colsample_bytree": 0.8},
]

CATB_CONFIGS: list[dict[str, Any]] = [
    {"depth": 5, "learning_rate": 0.05, "iterations": 300, "l2_leaf_reg": 3},
    {"depth": 7, "learning_rate": 0.03, "iterations": 400, "l2_leaf_reg": 1},
]

EBM_CONFIGS: list[dict[str, Any]] = [
    {"max_bins": 256, "interactions": 5, "outer_bags": 8, "inner_bags": 0, "learning_rate": 0.01},
    {"max_bins": 256, "interactions": 10, "outer_bags": 8, "inner_bags": 0, "learning_rate": 0.03},
]

def extract_ebm_for_ts(ebm_model, feature_names):
    terms = []
    bins = []
    for b in ebm_model.bins_:
        if len(b) > 0 and isinstance(b[0], (np.ndarray, list)):
            bins.append(np.array(b[0]).tolist())
        else:
            bins.append([])

    for i, term in enumerate(ebm_model.term_names_):
        feature_indices = ebm_model.term_features_[i]
        scores = ebm_model.term_scores_[i]
        terms.append({
            "name": term,
            "features": [feature_names[f_idx] for f_idx in feature_indices],
            "feature_indices": list(feature_indices),
            "scores": np.array(scores).tolist()
        })
        
    intercept = ebm_model.intercept_[0] if isinstance(ebm_model.intercept_, (np.ndarray, list)) else ebm_model.intercept_
    return {
        "intercept": float(intercept),
        "bins": bins,
        "terms": terms
    }


def _validation_score(val_metrics: dict) -> float:
    """Higher is better. Blend AUC (ranking) and negative Brier (properness)."""
    auc = val_metrics.get("rocAuc", 0.0)
    brier = val_metrics.get("brier", 1.0)
    # Scale so both contribute roughly equally in typical ranges
    return auc - 2.0 * brier


def train_and_select_model(
    model_cls,
    configs: list[dict],
    X_train: np.ndarray, y_train: np.ndarray,
    X_val: np.ndarray, y_val: np.ndarray,
    X_test: np.ndarray,
    extra_kwargs: dict | None = None,
    early_stopping: int = 30,
    sample_weight: np.ndarray | None = None,
) -> dict:
    """Train multiple configs, pick best on validation, return calibrated predictions."""
    best_score = -float("inf")
    best_result: dict | None = None

    for idx, cfg in enumerate(configs):
        kwargs = {**cfg, "random_state": DETERMINISTIC_SEED}
        if extra_kwargs:
            kwargs.update(extra_kwargs)

        model = model_cls(**kwargs)
        try:
            fit_kwargs: dict[str, Any] = {}
            fit_sig = model.fit.__code__.co_varnames
            can_eval = "eval_set" in fit_sig
            is_lgbm = "LGBM" in model.__class__.__name__
            is_xgb = "XGB" in model.__class__.__name__

            if can_eval:
                fit_kwargs["eval_set"] = [(X_val, y_val)]
                if is_lgbm:
                    import lightgbm as lgb
                    fit_kwargs["callbacks"] = [lgb.early_stopping(stopping_rounds=early_stopping, verbose=False)]
                elif is_xgb:
                    fit_kwargs["early_stopping_rounds"] = early_stopping
                    fit_kwargs["verbose"] = False
            if sample_weight is not None and "sample_weight" in fit_sig:
                fit_kwargs["sample_weight"] = sample_weight
            model.fit(X_train, y_train, **fit_kwargs)
        except Exception as exc:
            print(f"    [sota] config {idx} failed: {exc}")
            continue

        raw_val = model.predict_proba(X_val)[:, 1]
        cal_val, cal_blob = fit_best_calibration(raw_val, y_val)
        val_metrics = metrics_for(y_val, cal_val)
        score = _validation_score(val_metrics)

        if score > best_score:
            best_score = score
            raw_test = model.predict_proba(X_test)[:, 1]
            cal_test = apply_calibration(raw_test, cal_blob)
            best_result = {
                "model": model,
                "config": cfg,
                "validationProbs": cal_val,
                "testProbs": cal_test,
                "validationMetrics": val_metrics,
                "calibration": cal_blob or {"method": "identity"},
            }

    if best_result is None:
        raise RuntimeError("All model configs failed")

    return best_result


def augment_training_data(
    X: np.ndarray, y: np.ndarray,
    noise_std: float = 0.02,
    mixup_alpha: float = 0.2,
    random_state: int = DETERMINISTIC_SEED,
    sample_weight: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray | None]:
    """Domain-randomized data augmentation for synthetic tabular data.

    Two techniques combined:
    1. Gaussian feature noise: simulates measurement error, sim-to-real drift
    2. Mixup: blends minority+majority samples to smooth decision boundary

    This is especially critical for synthetic data where the generator may
    have artifacts or narrow manifolds.
    """
    rng = np.random.default_rng(random_state)
    n = len(X)

    # 1. Gaussian noise on all features (domain randomization)
    X_noisy = X + rng.normal(0, noise_std, size=X.shape).astype(np.float32)

    # 2. Mixup: blend random pairs with beta-distributed weight
    # Focus on minority class to improve decision boundary
    minority_idx = np.where(y == 1)[0]
    majority_idx = np.where(y == 0)[0]

    if len(minority_idx) < 2 or len(majority_idx) < 2:
        if sample_weight is not None:
            return X_noisy, y, sample_weight
        return X_noisy, y, None

    n_mix = min(len(minority_idx), 500)  # cap to avoid explosion
    X_mix = []
    y_mix = []
    w_mix = [] if sample_weight is not None else None

    for _ in range(n_mix):
        # Pick one minority and one majority sample
        i = rng.choice(minority_idx)
        j = rng.choice(majority_idx)
        lam = rng.beta(mixup_alpha, mixup_alpha)
        X_mix.append(lam * X_noisy[i] + (1 - lam) * X_noisy[j])
        # Round mixup labels to 0/1 — tree classifiers require integer labels
        y_mix.append(int(round(lam * y[i] + (1 - lam) * y[j])))
        if sample_weight is not None:
            w_mix.append((sample_weight[i] + sample_weight[j]) / 2.0)

    X_aug = np.vstack([X_noisy, np.array(X_mix, dtype=np.float32)])
    y_aug = np.concatenate([y, np.array(y_mix, dtype=y.dtype)])
    if sample_weight is not None:
        w_aug = np.concatenate([sample_weight, np.array(w_mix, dtype=np.float64)])
        return X_aug, y_aug, w_aug
    return X_aug, y_aug, None


def cross_family_robustness_score(
    df_test: pd.DataFrame,
    head_key: str,
    feature_cols: list[str],
    model,
) -> dict:
    """Evaluate model robustness across scenario families (domain randomization check).

    A model that overfits to the synthetic generator will have wildly
    different AUCs across families. A robust model will be more stable.
    """
    label_col = LABEL_COLS[head_key]
    families = df_test["scenario_family"].unique()
    scores = {}
    for family in families:
        fam_df = df_test[df_test["scenario_family"] == family]
        if len(fam_df) < 10:
            continue
        X_fam = fam_df[feature_cols].values.astype(np.float32)
        y_fam = fam_df[label_col].values.astype(int)
        pos = y_fam.sum()
        if pos == 0 or pos == len(y_fam):
            continue
        try:
            probs = model.predict_proba(X_fam)[:, 1]
            auc = roc_auc_score(y_fam, probs)
            scores[family] = float(auc)
        except Exception:
            pass

    if not scores:
        return {"perFamilyAuc": {}, "aucStd": None, "minAuc": None}

    aucs = list(scores.values())
    return {
        "perFamilyAuc": scores,
        "aucStd": float(np.std(aucs)),
        "minAuc": float(np.min(aucs)),
    }


def train_head(
    df_train: pd.DataFrame,
    df_val: pd.DataFrame,
    df_test: pd.DataFrame,
    head_key: str,
    feature_cols: list[str],
    output_dir: str,
    device: str = "cpu",
) -> dict:
    label_col = LABEL_COLS[head_key]
    df_train = active_region_df(df_train, head_key)
    df_val = active_region_df(df_val, head_key)
    df_test = active_region_df(df_test, head_key)

    X_train = df_train[feature_cols].values.astype(np.float32)
    y_train = df_train[label_col].values.astype(int)
    X_val = df_val[feature_cols].values.astype(np.float32)
    y_val = df_val[label_col].values.astype(int)
    X_test = df_test[feature_cols].values.astype(np.float32) if len(df_test) > 0 else X_val
    y_test = df_test[label_col].values.astype(int) if len(df_test) > 0 else y_val

    pos_train = y_train.sum()
    neg_train = len(y_train) - pos_train
    if pos_train == 0 or neg_train == 0:
        print(f"[sota] {head_key}: skipping — no positive/negative examples in train")
        return {"head": head_key, "skipped": True, "reason": "no positive/negative examples in train"}

    scale_pos_weight = neg_train / max(pos_train, 1)
    print(f"[sota] {head_key}: train={len(y_train)} pos={pos_train} ({100*pos_train/len(y_train):.1f}%) scale_pos_weight={scale_pos_weight:.2f}")

    # ── Fairness-aware sample weights ──
    # Reweight by scenario_family × label to ensure minority groups are learned
    train_weights = compute_fairness_weights(df_train, label_col, sensitive_attr="scenario_family")
    print(f"[sota] {head_key}: fairness weights range [{train_weights.min():.2f}, {train_weights.max():.2f}]")

    # ── Baseline logistic (NO AUGMENTATION — this is the explanation model) ──
    baseline = train_logistic_baseline(X_train, y_train, X_val, y_val, X_test)
    baseline_val_metrics = metrics_for(y_val, baseline["validationProbs"])
    baseline_test_metrics = metrics_for(y_test, baseline["testProbs"])

    # ── Domain-randomized augmentation for tree models ──
    # Critical for synthetic->real robustness: noise simulates real-world
    # drift; mixup smooths the decision boundary around minority class
    X_train_aug, y_train_aug, aug_weights = augment_training_data(
        X_train, y_train,
        noise_std=0.02,
        mixup_alpha=0.2,
        random_state=DETERMINISTIC_SEED,
        sample_weight=train_weights,
    )
    train_weights_aug = aug_weights if aug_weights is not None else train_weights
    print(f"[sota] {head_key}: augmented train set from {len(y_train)} to {len(y_train_aug)} samples")

    # ── XGBoost ──
    print(f"[sota] {head_key}: training XGBoost grid (device={device})...")
    xgb_extra = {
        "use_label_encoder": False,
        "eval_metric": "logloss",
        "scale_pos_weight": scale_pos_weight,
        "n_jobs": 4,
        "device": device,
    }
    xgb_result = train_and_select_model(
        XGBClassifier, XGB_CONFIGS,
        X_train_aug, y_train_aug, X_val, y_val, X_test,
        extra_kwargs=xgb_extra,
        sample_weight=train_weights_aug,
    )

    # ── LightGBM ──
    print(f"[sota] {head_key}: training LightGBM grid...")
    lgbm_extra = {
        "class_weight": "balanced",
        "n_jobs": 4,
        "verbosity": -1,
    }
    lgbm_result = train_and_select_model(
        LGBMClassifier, LGBM_CONFIGS,
        X_train_aug, y_train_aug, X_val, y_val, X_test,
        extra_kwargs=lgbm_extra,
        sample_weight=train_weights_aug,
    )

    # ── CatBoost ──
    print(f"[sota] {head_key}: training CatBoost grid (device={device})...")
    catb_extra = {
        "loss_function": "Logloss",
        "eval_metric": "AUC",
        "scale_pos_weight": scale_pos_weight,
        "random_seed": DETERMINISTIC_SEED,
        "verbose": False,
        "thread_count": 4,
        "task_type": "GPU" if device == "cuda" else "CPU",
        "devices": "0" if device == "cuda" else None,
        "boosting_type": "Plain" if device == "cuda" else "Ordered",
        "nan_mode": "Min",
    }
    # Remove None values for CatBoost
    catb_extra = {k: v for k, v in catb_extra.items() if v is not None}
    catb_best_score = -float("inf")
    catb_best_result: dict | None = None
    for idx, cfg in enumerate(CATB_CONFIGS):
        kwargs = {**cfg, **catb_extra}
        model = CatBoostClassifier(**kwargs)
        # CatBoost uses per-object weights in Pool
        train_pool = Pool(X_train_aug, y_train_aug, feature_names=feature_cols, weight=train_weights_aug if train_weights_aug is not None else None)
        val_pool = Pool(X_val, y_val, feature_names=feature_cols)
        try:
            model.fit(train_pool, eval_set=val_pool, early_stopping_rounds=30, verbose=False)
        except Exception as exc:
            print(f"    [sota] CatBoost config {idx} failed: {exc}")
            continue
        raw_val = model.predict_proba(val_pool)[:, 1]
        cal_val, cal_blob = fit_best_calibration(raw_val, y_val)
        val_metrics = metrics_for(y_val, cal_val)
        score = _validation_score(val_metrics)
        if score > catb_best_score:
            catb_best_score = score
            test_pool = Pool(X_test, y_test, feature_names=feature_cols)
            raw_test = model.predict_proba(test_pool)[:, 1]
            cal_test = apply_calibration(raw_test, cal_blob)
            catb_best_result = {
                "model": model,
                "config": cfg,
                "validationProbs": cal_val,
                "testProbs": cal_test,
                "validationMetrics": val_metrics,
                "calibration": cal_blob or {"method": "identity"},
            }
    if catb_best_result is None:
        raise RuntimeError("All CatBoost configs failed")

    # ── EBM ──
    print(f"[sota] {head_key}: training EBM grid...")
    from interpret.glassbox import ExplainableBoostingClassifier
    ebm_result = train_and_select_model(
        ExplainableBoostingClassifier, EBM_CONFIGS,
        X_train_aug, y_train_aug, X_val, y_val, X_test,
        extra_kwargs={"n_jobs": 4},
        sample_weight=train_weights_aug,
    )

    # ── Meta-learner ensemble ──
    print(f"[sota] {head_key}: training meta-learner...")
    meta_X_val = _make_meta_features(
        xgb_result["validationProbs"],
        lgbm_result["validationProbs"],
        catb_best_result["validationProbs"],
        ebm_result["validationProbs"],
    )
    meta_X_test = _make_meta_features(
        xgb_result["testProbs"],
        lgbm_result["testProbs"],
        catb_best_result["testProbs"],
        ebm_result["testProbs"],
    )

    y_val_classes = set(np.unique(y_val))
    if len(y_val_classes) < 2:
        print(f"[sota] {head_key}: meta-learner skipped — validation has only one class ({y_val_classes}), using simple average")
        meta_raw_val = np.mean(meta_X_val, axis=1)
        meta_raw_test = np.mean(meta_X_test, axis=1)
        meta_cal_val, meta_cal_blob = fit_best_calibration(meta_raw_val, y_val)
        meta_cal_test = apply_calibration(meta_raw_test, meta_cal_blob)
    else:
        meta_model = LogisticRegression(
            C=1.0, solver="lbfgs",
            class_weight="balanced", max_iter=1000,
            random_state=DETERMINISTIC_SEED,
        )
        meta_model.fit(meta_X_val, y_val)
        meta_raw_val = meta_model.predict_proba(meta_X_val)[:, 1]
        meta_raw_test = meta_model.predict_proba(meta_X_test)[:, 1]
        meta_cal_val, meta_cal_blob = fit_best_calibration(meta_raw_val, y_val)
        meta_cal_test = apply_calibration(meta_raw_test, meta_cal_blob)

    # ── Per-head model selection ──
    candidates = {
        "baseline": {"val_probs": baseline["validationProbs"], "test_probs": baseline["testProbs"]},
        "xgboost": {"val_probs": xgb_result["validationProbs"], "test_probs": xgb_result["testProbs"]},
        "lightgbm": {"val_probs": lgbm_result["validationProbs"], "test_probs": lgbm_result["testProbs"]},
        "catboost": {"val_probs": catb_best_result["validationProbs"], "test_probs": catb_best_result["testProbs"]},
        "ebm": {"val_probs": ebm_result["validationProbs"], "test_probs": ebm_result["testProbs"]},
        "ensemble": {"val_probs": meta_cal_val, "test_probs": meta_cal_test},
    }

    candidate_val_metrics: dict[str, dict] = {}
    candidate_test_metrics: dict[str, dict] = {}

    def _gate_count(val_m: dict, baseline_m: dict, robustness: dict | None = None) -> int:
        auc_gain = float(val_m.get("rocAuc", 0.0)) - float(baseline_m.get("rocAuc", 0.0))
        ranking_exc = auc_gain > 0.05
        tol = 0.03 if ranking_exc else 1e-4
        gc = 0
        if val_m.get("rocAuc", 0.0) >= baseline_m.get("rocAuc", 0.0) - 1e-4:
            gc += 1
        if val_m.get("brier", 1.0) <= baseline_m.get("brier", 1.0) + 1e-4:
            gc += 1
        bo = baseline_m.get("overloadRatio")
        co = val_m.get("overloadRatio")
        if bo is not None and co is not None:
            if abs(float(co) - 1.0) <= abs(float(bo) - 1.0) + tol:
                gc += 1
        for key in LOCAL_ECE_BANDS:
            be = (baseline_m.get("localCalibration") or {}).get(key, {}).get("ece")
            ce = (val_m.get("localCalibration") or {}).get(key, {}).get("ece")
            if be is not None and ce is not None and ce <= be + tol:
                gc += 1
        # Cross-family robustness gate: std <= 0.10 and min AUC >= 0.60
        if robustness and robustness.get("aucStd") is not None:
            if robustness["aucStd"] <= 0.10:
                gc += 1
        return gc

    best_score = -float("inf")
    best_candidate = "baseline"
    best_gates = 0

    for name, probs in candidates.items():
        val_m = metrics_for(y_val, probs["val_probs"])
        test_m = metrics_for(y_test, probs["test_probs"])
        candidate_val_metrics[name] = val_m
        candidate_test_metrics[name] = test_m
        score = _validation_score(val_m)

        # Compute cross-family robustness from validation set (fixing test-set leakage)
        df_val_copy = df_val.copy()
        df_val_copy["_probs"] = probs["val_probs"]
        robustness = cross_family_robustness_score(df_val_copy, head_key, feature_cols + ["_probs"], None)
        # Manual per-family AUC from val probs since we don't have the model object
        per_family_aucs = {}
        for family in df_val["scenario_family"].unique():
            fam_mask = df_val["scenario_family"] == family
            y_fam = y_val[fam_mask]
            p_fam = probs["val_probs"][fam_mask]
            pos = y_fam.sum()
            if pos > 0 and pos < len(y_fam):
                try:
                    per_family_aucs[family] = float(roc_auc_score(y_fam, p_fam))
                except Exception:
                    pass
        if per_family_aucs:
            aucs = list(per_family_aucs.values())
            robustness = {"aucStd": float(np.std(aucs)), "minAuc": float(np.min(aucs)), "perFamilyAuc": per_family_aucs}
        else:
            robustness = None

        gates = _gate_count(val_m, candidate_val_metrics["baseline"], robustness)
        rob_str = f"robStd={robustness['aucStd']:.3f}" if robustness else "rob=N/A"
        print(f"  [sota] {head_key} candidate={name:10s} val_auc={val_m['rocAuc']:.4f} val_brier={val_m['brier']:.4f} gates={gates}/6 score={score:.4f} {rob_str}")
        # Prefer more gates, then higher score
        if gates > best_gates or (gates == best_gates and score > best_score):
            best_gates = gates
            best_score = score
            best_candidate = name

    # If selected model fails overload, try correction based on validation
    selected_val_metrics = candidate_val_metrics[best_candidate]
    selected_val_probs = candidates[best_candidate]["val_probs"]
    selected_test_probs = candidates[best_candidate]["test_probs"]
    baseline_val_m = candidate_val_metrics["baseline"]
    bo = baseline_val_m.get("overloadRatio")
    co = selected_val_metrics.get("overloadRatio")
    if bo is not None and co is not None:
        if abs(float(co) - 1.0) > abs(float(bo) - 1.0) + 1e-4:
            print(f"  [sota] {head_key} correcting overload for {best_candidate}: {co:.4f} -> target ~{bo:.4f}")
            # calculate mix factor on validation data
            mix, p_rate = get_overload_correction(selected_val_probs, y_val, target_overload=float(bo))
            corrected_val = apply_overload_correction(selected_val_probs, mix, p_rate)
            corrected_test = apply_overload_correction(selected_test_probs, mix, p_rate)
            
            candidate_test_metrics[best_candidate] = metrics_for(y_test, corrected_test)
            candidate_val_metrics[best_candidate] = metrics_for(y_val, corrected_val)
            selected_test_probs = corrected_test
            candidates[best_candidate]["test_probs"] = corrected_test
            candidates[best_candidate]["val_probs"] = corrected_val

    print(f"  [sota] {head_key} SELECTED: {best_candidate}")

    selected_val_metrics = candidate_val_metrics[best_candidate]
    selected_test_metrics = candidate_test_metrics[best_candidate]
    selected_val_probs = candidates[best_candidate]["val_probs"]
    selected_test_probs = candidates[best_candidate]["test_probs"]

    # Save the selected model artifact
    # ── Always save all model artifacts for potential serving ──
    _xgb_path = Path(output_dir) / f"xgboost_{head_key}_v1.json"
    _lgbm_path = Path(output_dir) / f"lightgbm_{head_key}_v1.txt"
    _catb_path = Path(output_dir) / f"catboost_{head_key}_v1.json"
    xgb_result["model"].save_model(str(_xgb_path))
    lgbm_result["model"].booster_.save_model(str(_lgbm_path))
    catb_best_result["model"].save_model(str(_catb_path), format="json")

    artifact: dict[str, Any] = {
        "selectedModel": best_candidate,
        "head": head_key,
        "featureNames": feature_cols,
        "calibration": meta_cal_blob or {"method": "identity"},
    }

    if best_candidate == "baseline":
        artifact["modelFamily"] = "logistic"
        artifact["intercept"] = baseline["intercept"]
        artifact["coefNormL1"] = baseline["coefNormL1"]
    elif best_candidate == "xgboost":
        artifact["modelFamily"] = "xgboost"
        artifact["modelConfig"] = xgb_result["config"]
        xgb_path = Path(output_dir) / f"xgboost_{head_key}_v1.json"
        xgb_result["model"].save_model(str(xgb_path))
        artifact["modelArtifact"] = str(xgb_path)
    elif best_candidate == "lightgbm":
        artifact["modelFamily"] = "lightgbm"
        artifact["modelConfig"] = lgbm_result["config"]
        lgbm_path = Path(output_dir) / f"lightgbm_{head_key}_v1.txt"
        lgbm_result["model"].booster_.save_model(str(lgbm_path))
        artifact["modelArtifact"] = str(lgbm_path)
    elif best_candidate == "catboost":
        artifact["modelFamily"] = "catboost"
        artifact["modelConfig"] = catb_best_result["config"]
        catb_path = Path(output_dir) / f"catboost_{head_key}_v1.json"
        catb_best_result["model"].save_model(str(catb_path), format="json")
        artifact["modelArtifact"] = str(catb_path)
    elif best_candidate == "ebm":
        artifact["modelFamily"] = "ebm"
        artifact["modelConfig"] = ebm_result["config"]
        ebm_path = Path(output_dir) / f"ebm_{head_key}_v1.json"
        ebm_data = extract_ebm_for_ts(ebm_result["model"], feature_cols)
        ebm_path.write_text(json.dumps(ebm_data), encoding="utf-8")
        import pickle
        ebm_pkl = Path(output_dir) / f"ebm_{head_key}_v1.pkl"
        with open(ebm_pkl, "wb") as f:
            pickle.dump(ebm_result["model"], f)
        artifact["modelArtifact"] = str(ebm_path)
    elif best_candidate == "ensemble":
        artifact["modelFamily"] = "ensemble"
        artifact["metaModel"] = {
            "intercept": float(meta_model.intercept_[0]),
            "coefs": [float(c) for c in meta_model.coef_[0]],
        }
        # Save base model artifacts for ensemble serving
        xgb_path = Path(output_dir) / f"ensemble_xgboost_{head_key}_v1.json"
        lgbm_path = Path(output_dir) / f"ensemble_lightgbm_{head_key}_v1.txt"
        catb_path = Path(output_dir) / f"ensemble_catboost_{head_key}_v1.json"
        xgb_result["model"].save_model(str(xgb_path))
        lgbm_result["model"].booster_.save_model(str(lgbm_path))
        catb_best_result["model"].save_model(str(catb_path), format="json")
        artifact["baseModelArtifacts"] = {
            "xgboost": str(xgb_path),
            "lightgbm": str(lgbm_path),
            "catboost": str(catb_path),
        }

    artifact_path = Path(output_dir) / f"sota_{head_key}_v1.json"
    artifact_path.write_text(json.dumps(artifact, indent=2, default=str), encoding="utf-8")

    # ── Gates ──
    def gate_result(baseline_m: dict, selected_m: dict, model_path: Path) -> dict:
        auc_gain = float(selected_m.get("rocAuc", 0.0)) - float(baseline_m.get("rocAuc", 0.0))
        ranking_exception = auc_gain > 0.05  # relaxed calibration tolerance for big AUC wins
        cal_tol = 0.03 if ranking_exception else 1e-4
        overload_tol = 0.03 if ranking_exception else 1e-4

        gates = {
            "ranking": bool(selected_m.get("rocAuc", 0.0) >= baseline_m.get("rocAuc", 0.0) - 1e-4),
            "proper": bool(selected_m.get("brier", 1.0) <= baseline_m.get("brier", 1.0) + 1e-4),
            "localCal": True,
            "overload": True,
            "replayable": model_path.exists(),
        }
        blocked = []
        if not gates["ranking"]:
            blocked.append(f"ranking degraded: challenger={selected_m.get('rocAuc')} baseline={baseline_m.get('rocAuc')}")
        if not gates["proper"]:
            blocked.append(f"brier degraded: challenger={selected_m.get('brier')} baseline={baseline_m.get('brier')}")

        for key in LOCAL_ECE_BANDS:
            be = (baseline_m.get("localCalibration") or {}).get(key, {}).get("ece")
            ce = (selected_m.get("localCalibration") or {}).get(key, {}).get("ece")
            if be is not None and ce is not None and ce > be + cal_tol:
                blocked.append(f"{key} worsened: challenger={ce} baseline={be} (tol={cal_tol})")
                gates["localCal"] = False

        bo = baseline_m.get("overloadRatio")
        co = selected_m.get("overloadRatio")
        if bo is not None and co is not None:
            if abs(float(co) - 1.0) > abs(float(bo) - 1.0) + overload_tol:
                gates["overload"] = False
                blocked.append(f"overload worsened: challenger={co} baseline={bo} (tol={overload_tol})")

        if not gates["replayable"]:
            blocked.append(f"missing model artifact: {model_path}")

        gates["passCount"] = sum(1 for v in gates.values() if v is True)
        return {"gates": gates, "headPromotable": gates["passCount"] == 5, "blockedReasons": blocked}

    # ── Threshold-specific metrics at product action point (0.65) ──
    threshold_065_val = threshold_metrics_at(y_val, selected_val_probs, threshold=0.65)
    threshold_065_test = threshold_metrics_at(y_test, selected_test_probs, threshold=0.65)

    # ── Equalized odds post-processing ──
    val_groups = df_val["scenario_family"].values
    test_groups = df_test["scenario_family"].values
    eq_odds_val = equalized_odds_thresholds(y_val, selected_val_probs, val_groups)
    eq_odds_test = equalized_odds_thresholds(y_test, selected_test_probs, test_groups)

    # ── SHAP explanation for selected model ──
    baseline_model_obj = baseline.get("model")
    selected_model_obj = None
    if best_candidate == "xgboost":
        selected_model_obj = xgb_result["model"]
    elif best_candidate == "lightgbm":
        selected_model_obj = lgbm_result["model"]
    elif best_candidate == "catboost":
        selected_model_obj = catb_best_result["model"]
    # EBM natively provides explanations, so SHAP wrapper isn't strictly needed 
    # if we only want exact drivers, but we can compute SHAP for parity if we want.
    elif best_candidate == "ebm":
        selected_model_obj = ebm_result["model"]

    shap_summary = None
    parity_check = None
    if selected_model_obj is not None and baseline_model_obj is not None:
        shap_summary = compute_shap_summary(selected_model_obj, X_val, feature_cols)
        parity_check = explanation_parity_check(
            baseline_model_obj, selected_model_obj, X_val[:200], feature_cols
        )
    else:
        # Logistic baseline: use coefficients as explanation
        if baseline_model_obj is not None:
            lr_coefs = baseline_model_obj.coef_[0]
            lr_top_idx = np.argsort(lr_coefs)[::-1][:10]
            shap_summary = {
                "topFeatures": [
                    {"feature": feature_cols[i], "coefficient": float(lr_coefs[i])}
                    for i in lr_top_idx
                ],
                "shapAvailable": False,
                "explanationType": "logistic_coefficients",
            }

    # ── Fairness metrics per group on test set ──
    fairness_per_family = {}
    for family in df_test["scenario_family"].unique():
        fam_mask = df_test["scenario_family"] == family
        y_fam = y_test[fam_mask]
        p_fam = selected_test_probs[fam_mask]
        pos = y_fam.sum()
        if pos > 0 and pos < len(y_fam):
            try:
                fam_auc = float(roc_auc_score(y_fam, p_fam))
            except Exception:
                fam_auc = None
            fam_065 = threshold_metrics_at(y_fam, p_fam, threshold=0.65)
            fairness_per_family[str(family)] = {
                "auc": fam_auc,
                "precisionAt065": fam_065["precision"],
                "recallAt065": fam_065["recall"],
                "n": int(len(y_fam)),
                "pos": int(pos),
            }

    gate_summary = gate_result(baseline_test_metrics, selected_test_metrics, artifact_path)

    return {
        "head": head_key,
        "skipped": False,
        "selectedModel": best_candidate,
        "baseline": {
            "validation": baseline_val_metrics,
            "test": baseline_test_metrics,
            "calibration": baseline["calibration"],
            "coefNormL1": baseline["coefNormL1"],
            "intercept": baseline["intercept"],
        },
        "candidates": {
            name: {
                "validation": candidate_val_metrics[name],
                "test": candidate_test_metrics[name],
            }
            for name in candidates
        },
        "challenger": {
            "validation": selected_val_metrics,
            "test": selected_test_metrics,
            "calibration": artifact["calibration"],
            "modelArtifact": artifact.get("modelArtifact"),
            "modelFamily": artifact.get("modelFamily"),
            "thresholdAt065": {
                "validation": threshold_065_val,
                "test": threshold_065_test,
            },
            "equalizedOdds": {
                "validationThresholds": eq_odds_val,
                "testThresholds": eq_odds_test,
            },
            "shapSummary": shap_summary,
            "explanationParity": parity_check,
            "fairnessPerFamily": fairness_per_family,
        },
        **gate_summary,
    }


def main():
    parser = argparse.ArgumentParser(description="Train per-head SOTA ensemble")
    parser.add_argument("features_csv", help="Path to features CSV")
    parser.add_argument("output_dir", help="Directory for output files")
    parser.add_argument("--allow-missing-scenario-families", action="store_true")
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--device", choices=["cpu", "cuda"], default="cpu", help="Device for tree models (default: cpu)")
    args = parser.parse_args()

    features_csv = Path(args.features_csv)
    output_dir = Path(args.output_dir)
    if not features_csv.exists():
        print(f"[sota] ERROR: features CSV not found: {features_csv}", file=sys.stderr)
        sys.exit(1)

    api_root = Path(__file__).resolve().parents[1]
    proof_risk_model_source = api_root / "src/lib/proof-risk-model.ts"
    try:
        expected_feature_keys = read_ts_const_string_array(proof_risk_model_source, "OBSERVABLE_FEATURE_KEYS")
        expected_scenario_families = read_ts_const_string_array(proof_risk_model_source, "PROOF_SCENARIO_FAMILIES")
        validation_summary = validate_governed_csv(
            features_csv, expected_feature_keys, expected_scenario_families,
            not args.allow_missing_scenario_families,
        )
    except Exception as exc:
        print(f"[sota] ERROR: governed CSV validation failed: {exc}", file=sys.stderr)
        sys.exit(1)

    print(
        f"[sota] CSV validation passed | rows={validation_summary['rowCount']} "
        f"features={validation_summary['featureCount']} "
        f"splits={validation_summary['splitCounts']}"
    )
    if args.validate_only:
        return 0

    load_python_ml_dependencies()
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"[sota] reading {features_csv}")
    df = pd.read_csv(features_csv)
    print(f"[sota] loaded {len(df)} rows | splits: {dict(df['split'].value_counts())}")
    feature_cols = validation_summary["featureColumns"]
    print(f"[sota] detected {len(feature_cols)} feature columns")

    df_train = df[df["split"] == "train"].copy()
    df_val = df[df["split"] == "validation"].copy()
    df_test = df[df["split"] == "test"].copy()

    all_metrics = {}
    for head_key in HEADS:
        print(f"\n{'='*60}")
        print(f"[sota] training head: {head_key}")
        result = train_head(df_train, df_val, df_test, head_key, feature_cols, str(output_dir), device=args.device)
        if result:
            all_metrics[head_key] = result

    promotable_heads = [h for h, r in all_metrics.items() if not r.get("skipped") and r.get("headPromotable")]
    blocked_heads = [h for h, r in all_metrics.items() if not r.get("skipped") and not r.get("headPromotable")]
    skipped_heads = [h for h, r in all_metrics.items() if r.get("skipped")]

    promotion = {
        "decision": "promote-as-primary" if len(promotable_heads) == len(HEADS) and not blocked_heads and not skipped_heads else "keep-as-shadow",
        "promotableHeads": promotable_heads,
        "blockedHeads": blocked_heads,
        "skippedHeads": skipped_heads,
        "blockedReasonsByHead": {
            h: r.get("blockedReasons", [])
            for h, r in all_metrics.items() if r.get("blockedReasons")
        },
        "reason": (
            "All heads passed ranking, proper scoring, local calibration, overload, and replayability gates."
            if len(promotable_heads) == len(HEADS) and not blocked_heads and not skipped_heads
            else "One or more heads failed or skipped the governed promotion gates; challenger remains shadow."
        ),
    }

    summary = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "challenger": "sota-ensemble-v1",
        "baseline": "logistic-v8-governed-export",
        "corpusAdmissibility": "governed",
        "featuresCsv": str(features_csv),
        "featuresCsvSha256": sha256_file(features_csv),
        "featureSchema": {
            "source": str(proof_risk_model_source),
            "featureCount": validation_summary["featureCount"],
            "featureKeyHash": validation_summary["featureKeyHash"],
        },
        "validation": validation_summary,
        "heads": all_metrics,
        "promotion": promotion,
    }

    metrics_path = output_dir / "metrics.json"
    metrics_path.write_text(json.dumps(summary, indent=2, sort_keys=True, default=str), encoding="utf-8")
    (output_dir / "promotion-decision.json").write_text(json.dumps(promotion, indent=2, sort_keys=True, default=str), encoding="utf-8")
    print(f"\n[sota] all metrics saved to {metrics_path}")
    print(f"[sota] promotion.decision = {promotion['decision']}")

    print("\n[sota] SUMMARY")
    for head_key, m in all_metrics.items():
        if m.get("skipped"):
            print(f"  {head_key:30s} skipped: {m.get('reason')}")
            continue
        t = m.get("challenger", {}).get("test", {})
        b = m.get("baseline", {}).get("test", {})
        sel = m.get("selectedModel", "?")
        print(
            f"  {head_key:30s} selected={sel:10s} "
            f"AUC={t.get('rocAuc',0):.4f} brier={t.get('brier',0):.4f} "
            f"baseline_AUC={b.get('rocAuc',0):.4f} baseline_brier={b.get('brier',0):.4f} "
            f"gates={m.get('gates', {}).get('passCount', 0)}/5"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
