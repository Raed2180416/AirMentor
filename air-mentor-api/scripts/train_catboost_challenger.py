"""
Train per-head CatBoost models on the governed corpus exported by the TypeScript evaluator.

Usage:
    python train_catboost_challenger.py <features_csv> <output_dir> [--depth 6] [--iterations 300]

Input CSV columns (from AIRMENTOR_EVAL_EXPORT_FEATURES_CSV):
    run_id, split, stage_key, scenario_family,
    label_attendance, label_ce, label_see, label_overall, label_downstream,
    feat_0 ... feat_N

Output per head (in output_dir):
    catboost_<head>_v1.json   -- CatBoost oblivious tree model (JSON format)
    metrics.json              -- validation + test metrics for all heads
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
from pathlib import Path

np = None
pd = None
CatBoostClassifier = None
Pool = None
LogisticRegression = None
IsotonicRegression = None
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
    "localEceAt085": (0.85, 0.08),
}


def load_python_ml_dependencies() -> None:
    global np
    global pd
    global CatBoostClassifier
    global Pool
    global LogisticRegression
    global IsotonicRegression
    global average_precision_score
    global brier_score_loss
    global confusion_matrix
    global log_loss
    global precision_recall_fscore_support
    global roc_auc_score

    try:
        import numpy as _np
        import pandas as _pd
        from catboost import CatBoostClassifier as _CatBoostClassifier
        from catboost import Pool as _Pool
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
    except ModuleNotFoundError as exc:
        print(
            "[catboost] ERROR: missing Python dependency "
            f"'{exc.name}'. Install ML extras before running this script.\n"
            "[catboost] Required packages include: numpy, pandas, scikit-learn, catboost",
            file=sys.stderr,
        )
        sys.exit(1)

    np = _np
    pd = _pd
    CatBoostClassifier = _CatBoostClassifier
    Pool = _Pool
    LogisticRegression = _LogisticRegression
    IsotonicRegression = _IsotonicRegression
    average_precision_score = _average_precision_score
    brier_score_loss = _brier_score_loss
    confusion_matrix = _confusion_matrix
    log_loss = _log_loss
    precision_recall_fscore_support = _precision_recall_fscore_support
    roc_auc_score = _roc_auc_score


def get_gpu_device_count() -> int:
    try:
        from catboost.utils import get_gpu_device_count as _get_gpu_device_count
        return int(_get_gpu_device_count())
    except Exception:
        return 0


def read_ts_const_string_array(source_path: Path, const_name: str) -> list[str]:
    text = source_path.read_text(encoding="utf-8")
    match = re.search(rf"export const {re.escape(const_name)} = \[(.*?)\] as const", text, re.S)
    if not match:
        raise ValueError(f"Unable to locate {const_name} in {source_path}")
    return [
        group_one or group_two
        for group_one, group_two in re.findall(r"'([^']+)'|\"([^\"]+)\"", match.group(1))
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
    feature_columns = [column for column in columns if re.fullmatch(r"feat_\d+", column)]
    return sorted(feature_columns, key=lambda column: int(column.split("_", 1)[1]))


def validate_governed_csv(
    features_csv: Path,
    expected_feature_keys: list[str],
    expected_scenario_families: list[str],
    require_all_scenario_families: bool,
) -> dict:
    with features_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        missing_columns = [column for column in REQUIRED_COLUMNS if column not in fieldnames]
        if missing_columns:
            raise ValueError(f"missing required governed export columns: {missing_columns}")

        feature_columns = sorted_feature_columns(fieldnames)
        expected_feature_columns = [f"feat_{index}" for index in range(len(expected_feature_keys))]
        if feature_columns != expected_feature_columns:
            raise ValueError(
                "feature column mismatch: "
                f"expected {len(expected_feature_columns)} sequential columns "
                f"feat_0..feat_{len(expected_feature_columns) - 1}, "
                f"found {len(feature_columns)} columns"
            )

        row_count = 0
        split_counts = {"train": 0, "validation": 0, "test": 0}
        scenario_family_counts = {family: 0 for family in expected_scenario_families}
        unexpected_scenario_families: dict[str, int] = {}
        blank_required_counts = {column: 0 for column in REQUIRED_COLUMNS}
        run_ids_by_split = {"train": set(), "validation": set(), "test": set()}

        for row in reader:
            row_count += 1
            for column in REQUIRED_COLUMNS:
                if not (row.get(column) or "").strip():
                    blank_required_counts[column] += 1
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

    blank_required_counts = {column: count for column, count in blank_required_counts.items() if count}
    if blank_required_counts:
        raise ValueError(f"blank values in required governed export columns: {blank_required_counts}")

    missing_splits = [split for split, count in split_counts.items() if count == 0]
    if missing_splits:
        raise ValueError(f"missing required train/validation/test splits: {missing_splits}")

    leaking_runs = {
        "train_validation": sorted(run_ids_by_split["train"] & run_ids_by_split["validation"])[:5],
        "train_test": sorted(run_ids_by_split["train"] & run_ids_by_split["test"])[:5],
        "validation_test": sorted(run_ids_by_split["validation"] & run_ids_by_split["test"])[:5],
    }
    leaking_runs = {key: value for key, value in leaking_runs.items() if value}
    if leaking_runs:
        raise ValueError(f"run_id leakage across splits: {json.dumps(leaking_runs, sort_keys=True)}")

    if unexpected_scenario_families:
        raise ValueError(f"unexpected scenario_family values: {unexpected_scenario_families}")

    missing_scenario_families = [
        family for family, count in scenario_family_counts.items() if count == 0
    ]
    if require_all_scenario_families and missing_scenario_families:
        raise ValueError(f"missing governed scenario families: {missing_scenario_families}")

    return {
        "rowCount": row_count,
        "featureColumns": feature_columns,
        "featureCount": len(feature_columns),
        "featureKeyHash": sha256_json(expected_feature_keys),
        "splitCounts": split_counts,
        "runCountsBySplit": {split: len(run_ids) for split, run_ids in run_ids_by_split.items()},
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


def fit_isotonic_calibration(raw_probs: np.ndarray, y_true: np.ndarray) -> tuple[np.ndarray, dict | None]:
    if len(set(y_true.tolist())) < 2:
        return raw_probs, None
    calibration = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    calibration.fit(raw_probs, y_true)
    calibration_blob = {
        "method": "isotonic",
        "xThresholds": [float(value) for value in calibration.X_thresholds_],
        "yThresholds": [float(value) for value in calibration.y_thresholds_],
    }
    return calibration.predict(raw_probs), calibration_blob


def apply_isotonic_calibration(raw_probs: np.ndarray, calibration_blob: dict | None) -> np.ndarray:
    if calibration_blob is None:
        return raw_probs
    x_thresholds = np.asarray(calibration_blob["xThresholds"], dtype=np.float64)
    y_thresholds = np.asarray(calibration_blob["yThresholds"], dtype=np.float64)
    return np.interp(raw_probs, x_thresholds, y_thresholds, left=y_thresholds[0], right=y_thresholds[-1])

def metrics_for(y_true: np.ndarray, y_prob: np.ndarray) -> dict:
    y_pred = (y_prob >= 0.5).astype(int)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true,
        y_pred,
        average="binary",
        zero_division=0,
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
        return {
            **base,
            "rocAuc": 0.5,
            "logLoss": 0.0,
            "averagePrecision": 0.0,
        }
    return {
        **base,
        "rocAuc": float(roc_auc_score(y_true, y_prob)),
        "logLoss": float(log_loss(y_true, y_prob)),
        "averagePrecision": float(average_precision_score(y_true, y_prob)),
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
    # Positive risk features should be non-decreasing; protective features should
    # be non-increasing. Stage and missingness flags are unconstrained.
    decreasing_risk_indices = {0, 3}
    increasing_risk_indices = {
        1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
        15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
        32, 33, 34, 35, 36,
    }
    constraints: list[int] = []
    for column in feature_cols:
        index = int(column.split("_", 1)[1])
        if index in decreasing_risk_indices:
            constraints.append(-1)
        elif index in increasing_risk_indices:
            constraints.append(1)
        else:
            constraints.append(0)
    return constraints


def train_logistic_baseline(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    X_test: np.ndarray,
) -> dict:
    model = LogisticRegression(
        penalty="l2",
        C=1.0,
        solver="lbfgs",
        class_weight="balanced",
        max_iter=1000,
        random_state=42,
    )
    model.fit(X_train, y_train)
    raw_val = model.predict_proba(X_val)[:, 1]
    raw_test = model.predict_proba(X_test)[:, 1]
    calibrated_val, calibration_blob = fit_isotonic_calibration(raw_val, y_val)
    calibrated_test = apply_isotonic_calibration(raw_test, calibration_blob)
    return {
        "validationProbs": calibrated_val,
        "testProbs": calibrated_test,
        "calibration": calibration_blob or {"method": "identity"},
        "coefNormL1": float(np.abs(model.coef_).sum()),
        "intercept": float(model.intercept_[0]),
    }


def local_calibration_passes(baseline_metrics: dict, challenger_metrics: dict, tol: float = 1e-4) -> tuple[bool, list[str]]:
    blocked_reasons = []
    for key in LOCAL_ECE_BANDS:
        baseline_ece = (baseline_metrics.get("localCalibration") or {}).get(key, {}).get("ece")
        challenger_ece = (challenger_metrics.get("localCalibration") or {}).get(key, {}).get("ece")
        if baseline_ece is not None and challenger_ece is not None and challenger_ece > baseline_ece + tol:
            blocked_reasons.append(f"{key} worsened: challenger={challenger_ece} baseline={baseline_ece} (tol={tol})")
    return len(blocked_reasons) == 0, blocked_reasons


def overload_passes(baseline_metrics: dict, challenger_metrics: dict, tol: float = 1e-4) -> tuple[bool, str | None]:
    baseline_overload = baseline_metrics.get("overloadRatio")
    challenger_overload = challenger_metrics.get("overloadRatio")
    if baseline_overload is None or challenger_overload is None:
        return True, None
    baseline_distance = abs(float(baseline_overload) - 1.0)
    challenger_distance = abs(float(challenger_overload) - 1.0)
    if challenger_distance <= baseline_distance + tol:
        return True, None
    return False, f"overload worsened: challenger={challenger_overload} baseline={baseline_overload} (tol={tol})"


def promotion_gates_for(
    baseline_metrics: dict,
    challenger_metrics: dict,
    model_path: Path,
) -> dict:
    auc_gain = float(challenger_metrics.get("rocAuc", 0.0)) - float(baseline_metrics.get("rocAuc", 0.0))
    ranking_exception = auc_gain > 0.05
    cal_tol = 0.03 if ranking_exception else 1e-4
    overload_tol = 0.03 if ranking_exception else 1e-4

    gates = {
        "ranking": bool(challenger_metrics.get("rocAuc", 0.0) >= baseline_metrics.get("rocAuc", 0.0) - 1e-4),
        "proper": bool(challenger_metrics.get("brier", 1.0) <= baseline_metrics.get("brier", 1.0) + 1e-4),
        "localCal": True,
        "overload": True,
        "replayable": model_path.exists(),
    }
    blocked_reasons = []
    if not gates["ranking"]:
        blocked_reasons.append(
            f"ranking degraded: challenger={challenger_metrics.get('rocAuc')} baseline={baseline_metrics.get('rocAuc')}"
        )
    if not gates["proper"]:
        blocked_reasons.append(
            f"brier degraded: challenger={challenger_metrics.get('brier')} baseline={baseline_metrics.get('brier')}"
        )
    local_cal_passed, local_cal_blockers = local_calibration_passes(baseline_metrics, challenger_metrics, cal_tol)
    gates["localCal"] = local_cal_passed
    blocked_reasons.extend(local_cal_blockers)
    overload_passed, overload_blocker = overload_passes(baseline_metrics, challenger_metrics, overload_tol)
    gates["overload"] = overload_passed
    if overload_blocker:
        blocked_reasons.append(overload_blocker)
    if not gates["replayable"]:
        blocked_reasons.append(f"missing model artifact: {model_path}")
    gates["passCount"] = sum(1 for value in gates.values() if value is True)
    return {
        "gates": gates,
        "headPromotable": gates["passCount"] == 5,
        "blockedReasons": blocked_reasons,
    }


def train_head(
    df_train: pd.DataFrame,
    df_val: pd.DataFrame,
    df_test: pd.DataFrame,
    head_key: str,
    feature_cols: list[str],
    output_dir: str,
    depth: int,
    iterations: int,
    requested_device: str,
    thread_count: int,
    gpu_ram_part: float | None,
    pinned_memory_size: str | None,
    used_ram_limit: str | None,
    save_snapshot: bool,
    snapshot_interval: int | None,
    border_count: int | None,
    rsm: float | None,
    leaf_estimation_iterations: int | None,
    bootstrap_type: str | None,
    subsample: float | None,
    metric_period: int,
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
        print(f"[catboost] {head_key}: skipping — no positive/negative examples in train")
        return {
            "head": head_key,
            "skipped": True,
            "reason": "no positive/negative examples in train",
        }

    baseline = train_logistic_baseline(X_train, y_train, X_val, y_val, X_test)
    baseline_val_metrics = metrics_for(y_val, baseline["validationProbs"])
    baseline_test_metrics = metrics_for(y_test, baseline["testProbs"])

    # Inverse frequency class weights
    scale_pos_weight = neg_train / max(pos_train, 1)
    print(f"[catboost] {head_key}: train={len(y_train)} pos={pos_train} ({100*pos_train/len(y_train):.1f}%) scale_pos_weight={scale_pos_weight:.2f}")

    if requested_device in {"GPU", "CPU"}:
        resolved_device = requested_device
    else:
        resolved_device = "GPU" if get_gpu_device_count() > 0 else "CPU"
    use_gpu = resolved_device == "GPU"
    print(f"[catboost] {head_key}: device={resolved_device}")
    model_kwargs = dict(
        depth=depth,
        iterations=iterations,
        learning_rate=0.05,
        loss_function="Logloss",
        eval_metric="AUC",
        boosting_type="Plain" if use_gpu else "Ordered",  # Ordered boosting not supported on GPU
        scale_pos_weight=scale_pos_weight,
        random_seed=42,
        verbose=metric_period,
        metric_period=metric_period,
        thread_count=thread_count,
        task_type="GPU" if use_gpu else "CPU",
        devices="0" if use_gpu else None,
    )
    if gpu_ram_part is not None and use_gpu:
        model_kwargs["gpu_ram_part"] = gpu_ram_part
    if pinned_memory_size and use_gpu:
        model_kwargs["pinned_memory_size"] = pinned_memory_size
    if used_ram_limit and not use_gpu:
        model_kwargs["used_ram_limit"] = used_ram_limit
    if save_snapshot:
        model_kwargs["save_snapshot"] = True
        if snapshot_interval is not None:
            model_kwargs["snapshot_interval"] = snapshot_interval
        model_kwargs["snapshot_file"] = os.path.join(output_dir, f"catboost_{head_key}.snapshot")
    if border_count is not None:
        model_kwargs["border_count"] = border_count
    if rsm is not None:
        model_kwargs["rsm"] = rsm
    if leaf_estimation_iterations is not None:
        model_kwargs["leaf_estimation_iterations"] = leaf_estimation_iterations
    if bootstrap_type is not None:
        model_kwargs["bootstrap_type"] = bootstrap_type
    if subsample is not None:
        model_kwargs["subsample"] = subsample
    if os.environ.get("CATBOOST_DISABLE_MONOTONE_CONSTRAINTS", "").lower() not in {"1", "true", "yes"}:
        model_kwargs["monotone_constraints"] = monotone_constraints_for(feature_cols)
    model_kwargs["nan_mode"] = "Min"

    model = CatBoostClassifier(**model_kwargs)
    train_pool = Pool(X_train, y_train, feature_names=feature_cols)
    val_pool = Pool(X_val, y_val, feature_names=feature_cols)
    test_pool = Pool(X_test, y_test, feature_names=feature_cols)
    model.fit(train_pool)

    raw_val_probs = model.predict_proba(val_pool)[:, 1]
    raw_test_probs = model.predict_proba(test_pool)[:, 1]
    val_probs, challenger_calibration = fit_isotonic_calibration(raw_val_probs, y_val)
    test_probs = apply_isotonic_calibration(raw_test_probs, challenger_calibration)

    val_metrics = metrics_for(y_val, val_probs)
    test_metrics = metrics_for(y_test, test_probs)

    print(f"[catboost] {head_key}: val  AUC={val_metrics['rocAuc']:.4f} brier={val_metrics['brier']:.4f} recall@0.5={val_metrics['recallAt50']:.4f}")
    print(f"[catboost] {head_key}: test AUC={test_metrics['rocAuc']:.4f} brier={test_metrics['brier']:.4f} recall@0.5={test_metrics['recallAt50']:.4f}")

    out_path = Path(output_dir) / f"catboost_{head_key}_v1.json"
    model.save_model(str(out_path), format="json")
    print(f"[catboost] {head_key}: saved model to {out_path}")

    gate_summary = promotion_gates_for(baseline_test_metrics, test_metrics, out_path)
    return {
        "head": head_key,
        "skipped": False,
        "baseline": {
            "validation": baseline_val_metrics,
            "test": baseline_test_metrics,
            "calibration": baseline["calibration"],
            "coefNormL1": baseline["coefNormL1"],
            "intercept": baseline["intercept"],
        },
        "challenger": {
            "validation": val_metrics,
            "test": test_metrics,
            "calibration": challenger_calibration or {"method": "identity"},
            "bestIteration": model.best_iteration_,
            "modelArtifact": str(out_path),
            "modelSha256": sha256_file(out_path),
        },
        **gate_summary,
    }


def main():
    parser = argparse.ArgumentParser(description="Train per-head CatBoost models")
    parser.add_argument("features_csv", help="Path to features CSV exported by TypeScript evaluator")
    parser.add_argument("output_dir", help="Directory for output JSON model files")
    parser.add_argument("--depth", type=int, default=6, help="CatBoost tree depth (default 6)")
    parser.add_argument("--iterations", type=int, default=300, help="Max boosting iterations (default 300)")
    parser.add_argument("--device", choices=["auto", "cpu", "gpu"], default=os.environ.get("CATBOOST_DEVICE", "auto").lower(), help="Training device. Use cpu for governed/reproducible comparisons.")
    parser.add_argument("--thread-count", type=int, default=int(os.environ.get("CATBOOST_THREAD_COUNT", "-1")), help="CatBoost thread_count (default -1)")
    parser.add_argument("--gpu-ram-part", type=float, default=float(os.environ["CATBOOST_GPU_RAM_PART"]) if "CATBOOST_GPU_RAM_PART" in os.environ else None, help="Optional GPU RAM fraction for CatBoost.")
    parser.add_argument("--pinned-memory-size", default=os.environ.get("CATBOOST_PINNED_MEMORY_SIZE"), help="Optional CatBoost pinned_memory_size, e.g. 2gb.")
    parser.add_argument("--used-ram-limit", default=os.environ.get("CATBOOST_USED_RAM_LIMIT"), help="Optional CatBoost used_ram_limit for CPU runs, e.g. 8gb.")
    parser.add_argument("--save-snapshot", action="store_true", default=os.environ.get("CATBOOST_SAVE_SNAPSHOT", "").lower() in {"1", "true", "yes"}, help="Enable CatBoost snapshotting for long overnight runs.")
    parser.add_argument("--snapshot-interval", type=int, default=int(os.environ["CATBOOST_SNAPSHOT_INTERVAL"]) if "CATBOOST_SNAPSHOT_INTERVAL" in os.environ else None, help="CatBoost snapshot interval in seconds.")
    parser.add_argument("--border-count", type=int, default=int(os.environ["CATBOOST_BORDER_COUNT"]) if "CATBOOST_BORDER_COUNT" in os.environ else None, help="Optional CatBoost border_count/max_bin. For GPU, 32 is a common fast setting.")
    parser.add_argument("--rsm", type=float, default=float(os.environ["CATBOOST_RSM"]) if "CATBOOST_RSM" in os.environ else None, help="Optional CatBoost random subspace ratio.")
    parser.add_argument("--leaf-estimation-iterations", type=int, default=int(os.environ["CATBOOST_LEAF_ESTIMATION_ITERATIONS"]) if "CATBOOST_LEAF_ESTIMATION_ITERATIONS" in os.environ else None, help="Optional CatBoost leaf_estimation_iterations.")
    parser.add_argument("--bootstrap-type", choices=["Bayesian", "Bernoulli", "MVS", "Poisson", "No"], default=os.environ.get("CATBOOST_BOOTSTRAP_TYPE"), help="Optional CatBoost bootstrap_type.")
    parser.add_argument("--subsample", type=float, default=float(os.environ["CATBOOST_SUBSAMPLE"]) if "CATBOOST_SUBSAMPLE" in os.environ else None, help="Optional CatBoost subsample.")
    parser.add_argument("--metric-period", type=int, default=int(os.environ.get("CATBOOST_METRIC_PERIOD", "50")), help="CatBoost metric_period. Higher values reduce logging/metric overhead.")
    parser.add_argument("--allow-missing-scenario-families", action="store_true", help="Allow schema-smoke exports that do not include every governed scenario family.")
    parser.add_argument("--validate-only", action="store_true", help="Validate the governed CSV contract without importing ML training dependencies.")
    args = parser.parse_args()

    features_csv = Path(args.features_csv)
    output_dir = Path(args.output_dir)
    if not features_csv.exists():
        print(f"[catboost] ERROR: features CSV not found: {features_csv}", file=sys.stderr)
        sys.exit(1)

    api_root = Path(__file__).resolve().parents[1]
    proof_risk_model_source = api_root / "src/lib/proof-risk-model.ts"
    try:
        expected_feature_keys = read_ts_const_string_array(proof_risk_model_source, "OBSERVABLE_FEATURE_KEYS")
        expected_scenario_families = read_ts_const_string_array(proof_risk_model_source, "PROOF_SCENARIO_FAMILIES")
        validation_summary = validate_governed_csv(
            features_csv,
            expected_feature_keys,
            expected_scenario_families,
            not args.allow_missing_scenario_families,
        )
    except Exception as exc:
        print(f"[catboost] ERROR: governed CSV validation failed: {exc}", file=sys.stderr)
        sys.exit(1)

    print(
        "[catboost] governed CSV validation passed | "
        f"rows={validation_summary['rowCount']} "
        f"features={validation_summary['featureCount']} "
        f"splits={validation_summary['splitCounts']} "
        f"families={validation_summary['scenarioFamilyCounts']}"
    )
    if args.validate_only:
        return 0

    load_python_ml_dependencies()
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"[catboost] reading {features_csv}")
    df = pd.read_csv(features_csv)
    print(f"[catboost] loaded {len(df)} rows | splits: {dict(df['split'].value_counts())}")
    feature_cols = validation_summary["featureColumns"]
    print(f"[catboost] detected {len(feature_cols)} feature columns")

    df_train = df[df["split"] == "train"].copy()
    df_val = df[df["split"] == "validation"].copy()
    df_test = df[df["split"] == "test"].copy()

    all_metrics = {}
    for head_key in HEADS:
        print(f"\n{'='*60}")
        print(f"[catboost] training head: {head_key}")
        result = train_head(
            df_train,
            df_val,
            df_test,
            head_key,
            feature_cols,
            str(output_dir),
            args.depth,
            args.iterations,
            args.device.upper(),
            args.thread_count,
            args.gpu_ram_part,
            args.pinned_memory_size,
            args.used_ram_limit,
            args.save_snapshot,
            args.snapshot_interval,
            args.border_count,
            args.rsm,
            args.leaf_estimation_iterations,
            args.bootstrap_type,
            args.subsample,
            args.metric_period,
        )
        if result:
            all_metrics[head_key] = result

    promotable_heads = [
        head_key for head_key, result in all_metrics.items()
        if not result.get("skipped") and result.get("headPromotable")
    ]
    blocked_heads = [
        head_key for head_key, result in all_metrics.items()
        if not result.get("skipped") and not result.get("headPromotable")
    ]
    skipped_heads = [
        head_key for head_key, result in all_metrics.items()
        if result.get("skipped")
    ]
    promotion = {
        "decision": "promote-as-primary" if len(promotable_heads) == len(HEADS) and not blocked_heads and not skipped_heads else "keep-as-shadow",
        "promotableHeads": promotable_heads,
        "blockedHeads": blocked_heads,
        "skippedHeads": skipped_heads,
        "blockedReasonsByHead": {
            head_key: result.get("blockedReasons", [])
            for head_key, result in all_metrics.items()
            if result.get("blockedReasons")
        },
        "reason": (
            "All heads passed ranking, proper scoring, local calibration, overload, and replayability gates."
            if len(promotable_heads) == len(HEADS) and not blocked_heads and not skipped_heads
            else "One or more heads failed or skipped the governed promotion gates; challenger remains shadow."
        ),
    }
    summary = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "challenger": "catboost",
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
    print(f"\n[catboost] all metrics saved to {metrics_path}")
    print(f"[catboost] promotion.decision = {promotion['decision']}")

    print("\n[catboost] SUMMARY")
    for head_key, m in all_metrics.items():
        if m.get("skipped"):
            print(f"  {head_key:30s} skipped: {m.get('reason')}")
            continue
        t = m.get("challenger", {}).get("test", {})
        b = m.get("baseline", {}).get("test", {})
        print(
            f"  {head_key:30s} "
            f"catboost AUC={t.get('rocAuc',0):.4f} brier={t.get('brier',0):.4f} "
            f"baseline AUC={b.get('rocAuc',0):.4f} brier={b.get('brier',0):.4f} "
            f"gates={m.get('gates', {}).get('passCount', 0)}/5"
        )
    return 0


if __name__ == "__main__":
    main()
