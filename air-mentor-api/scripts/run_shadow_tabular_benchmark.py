#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import math
import re
import time
from pathlib import Path
from typing import Any, Callable

import numpy as np
import pandas as pd
try:
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
    from sklearn.preprocessing import StandardScaler
except ModuleNotFoundError:
    LogisticRegression = None
    HistGradientBoostingClassifier = None
    average_precision_score = None
    brier_score_loss = None
    roc_auc_score = None
    StandardScaler = None


DETERMINISTIC_SEED = 42
HEADS = ["attendanceRisk", "ceRisk", "seeRisk", "overallCourseRisk", "downstreamCarryoverRisk"]
STAGES = ["pre-tt1", "post-tt1", "post-tt2", "post-assignments", "post-see"]
REQUIRED_FEATURE_SCHEMA_VERSION = "observable-risk-features-v6"
REQUIRED_FEATURE_COUNT = 48
API_ROOT = Path(__file__).resolve().parents[1]
PROOF_RISK_MODEL_SOURCE = API_ROOT / "src/lib/proof-risk-model.ts"
LABEL_COLS = {
    "attendanceRisk": "label_attendance",
    "ceRisk": "label_ce",
    "seeRisk": "label_see",
    "overallCourseRisk": "label_overall",
    "downstreamCarryoverRisk": "label_downstream",
}


def feature_cols(df: pd.DataFrame) -> list[str]:
    return sorted([c for c in df.columns if c.startswith("feat_")], key=lambda c: int(c.split("_")[1]))


def read_ts_string_const(source_path: Path, const_name: str) -> str:
    text = source_path.read_text(encoding="utf-8")
    match = re.search(rf"export const {re.escape(const_name)} = ['\"]([^'\"]+)['\"]", text)
    if not match:
        raise ValueError(f"Unable to locate {const_name} in {source_path}")
    return match.group(1)


def read_ts_const_string_array(source_path: Path, const_name: str) -> list[str]:
    text = source_path.read_text(encoding="utf-8")
    match = re.search(rf"export const {re.escape(const_name)} = \[(.*?)\] as const", text, re.S)
    if not match:
        raise ValueError(f"Unable to locate {const_name} in {source_path}")
    return [
        g1 or g2
        for g1, g2 in re.findall(r"'([^']+)'|\"([^\"]+)\"", match.group(1))
    ]


def sha256_json(blob: object) -> str:
    payload = json.dumps(blob, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def feature_contract_report(df: pd.DataFrame, cols: list[str]) -> dict[str, Any]:
    version = read_ts_string_const(PROOF_RISK_MODEL_SOURCE, "RISK_FEATURE_SCHEMA_VERSION")
    keys = read_ts_const_string_array(PROOF_RISK_MODEL_SOURCE, "OBSERVABLE_FEATURE_KEYS")
    expected_cols = [f"feat_{idx}" for idx in range(len(keys))]
    return {
        "passed": version == REQUIRED_FEATURE_SCHEMA_VERSION and len(keys) == REQUIRED_FEATURE_COUNT and cols == expected_cols,
        "featureSchemaVersion": version,
        "requiredFeatureSchemaVersion": REQUIRED_FEATURE_SCHEMA_VERSION,
        "featureCount": len(cols),
        "expectedFeatureCount": len(keys),
        "requiredFeatureCount": REQUIRED_FEATURE_COUNT,
        "featureKeyHash": sha256_json(keys),
        "featureKeys": keys,
        "missingFeatureColumns": [col for col in expected_cols if col not in df.columns],
        "unexpectedFeatureColumns": [col for col in cols if col not in expected_cols],
    }


def expected_calibration_error(y_true: np.ndarray, prob: np.ndarray, bins: int = 15) -> float:
    edges = np.linspace(0.0, 1.0, bins + 1)
    ece = 0.0
    for left, right in zip(edges[:-1], edges[1:]):
        mask = (prob >= left) & (prob < right if right < 1.0 else prob <= right)
        if not np.any(mask):
            continue
        ece += float(mask.mean()) * abs(float(y_true[mask].mean()) - float(prob[mask].mean()))
    return ece


def fallback_brier_score(y_true: np.ndarray, prob: np.ndarray) -> float:
    return float(np.mean((prob.astype(float) - y_true.astype(float)) ** 2))


def fallback_roc_auc_score(y_true: np.ndarray, prob: np.ndarray) -> float | None:
    y = y_true.astype(int)
    positives = int(y.sum())
    negatives = int(len(y) - positives)
    if positives == 0 or negatives == 0:
        return None
    ranks = pd.Series(prob.astype(float)).rank(method="average").to_numpy(dtype=float)
    positive_rank_sum = float(ranks[y == 1].sum())
    return float((positive_rank_sum - positives * (positives + 1) / 2.0) / (positives * negatives))


def fallback_average_precision(y_true: np.ndarray, prob: np.ndarray) -> float | None:
    y = y_true.astype(int)
    positives = int(y.sum())
    if positives == 0:
        return None
    order = np.argsort(-prob.astype(float))
    sorted_y = y[order]
    cumulative_hits = np.cumsum(sorted_y)
    ranks = np.arange(1, len(sorted_y) + 1)
    precision_at_hits = cumulative_hits[sorted_y == 1] / ranks[sorted_y == 1]
    return float(np.mean(precision_at_hits)) if precision_at_hits.size else None


def metric_auc(y_true: np.ndarray, prob: np.ndarray) -> float | None:
    if len(set(y_true.astype(int).tolist())) < 2:
        return None
    if roc_auc_score is not None:
        return float(roc_auc_score(y_true, prob))
    return fallback_roc_auc_score(y_true, prob)


def metric_average_precision(y_true: np.ndarray, prob: np.ndarray) -> float | None:
    if len(set(y_true.astype(int).tolist())) < 2:
        return None
    if average_precision_score is not None:
        return float(average_precision_score(y_true, prob))
    return fallback_average_precision(y_true, prob)


def metric_brier(y_true: np.ndarray, prob: np.ndarray) -> float:
    if brier_score_loss is not None:
        return float(brier_score_loss(y_true, prob))
    return fallback_brier_score(y_true, prob)


def feature_array(df: pd.DataFrame, col: str, default: float = 0.5) -> np.ndarray:
    if col in df.columns:
        return df[col].to_numpy(dtype=float)
    return np.full(len(df), default, dtype=float)


def heuristic_probability(df: pd.DataFrame, head: str) -> np.ndarray:
    attendance_risk = 1.0 - feature_array(df, "feat_0")
    ce_risk = np.mean(np.column_stack([
        feature_array(df, "feat_5"),
        feature_array(df, "feat_6"),
        feature_array(df, "feat_8"),
        feature_array(df, "feat_9"),
    ]), axis=1)
    see_risk = np.maximum(feature_array(df, "feat_7"), feature_array(df, "feat_41", 0.0) * 0.65)
    backlog_risk = np.maximum.reduce([
        feature_array(df, "feat_4"),
        feature_array(df, "feat_44", 0.0),
        feature_array(df, "feat_45", 0.0),
        feature_array(df, "feat_46", 0.0),
        feature_array(df, "feat_47", 0.0),
    ])
    prerequisite_risk = np.mean(np.column_stack([
        feature_array(df, "feat_15"),
        feature_array(df, "feat_16"),
        feature_array(df, "feat_17"),
        feature_array(df, "feat_20"),
        feature_array(df, "feat_21"),
        feature_array(df, "feat_22"),
        feature_array(df, "feat_23"),
        feature_array(df, "feat_24"),
    ]), axis=1)
    if head == "attendanceRisk":
        prob = attendance_risk
    elif head == "ceRisk":
        prob = ce_risk
    elif head == "seeRisk":
        prob = see_risk
    elif head == "downstreamCarryoverRisk":
        prob = np.maximum(prerequisite_risk, backlog_risk)
    else:
        prob = np.maximum.reduce([attendance_risk * 0.4, ce_risk, see_risk, backlog_risk])
    return np.clip(prob, 0.0001, 0.9999)


def clean_json(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): clean_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean_json(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        value = float(value)
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    return value


def split_data(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    if "split" in df.columns:
        train = df[df["split"] == "train"].copy()
        val = df[df["split"].isin(["validation", "val"])].copy()
        test = df[df["split"] == "test"].copy()
        if not train.empty and not test.empty:
            if val.empty:
                val = train.sample(frac=0.2, random_state=DETERMINISTIC_SEED)
                train = train.drop(val.index)
            return train, val, test
    shuffled = df.sample(frac=1.0, random_state=DETERMINISTIC_SEED).reset_index(drop=True)
    train_end = int(len(shuffled) * 0.6)
    val_end = int(len(shuffled) * 0.8)
    return shuffled.iloc[:train_end].copy(), shuffled.iloc[train_end:val_end].copy(), shuffled.iloc[val_end:].copy()


def sample_for_heavy(X: np.ndarray, y: np.ndarray, max_rows: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    if max_rows <= 0 or len(y) <= max_rows:
        return X, y
    rng = np.random.default_rng(seed)
    pos = np.where(y == 1)[0]
    neg = np.where(y == 0)[0]
    pos_take = min(len(pos), max(1, int(max_rows * max(float(y.mean()), 0.05))))
    neg_take = min(len(neg), max_rows - pos_take)
    chosen = np.concatenate([
        rng.choice(pos, size=pos_take, replace=False) if pos_take else np.array([], dtype=int),
        rng.choice(neg, size=neg_take, replace=False) if neg_take else np.array([], dtype=int),
    ])
    rng.shuffle(chosen)
    return X[chosen], y[chosen]


def metrics_for(y_true: np.ndarray, prob: np.ndarray) -> dict[str, Any]:
    prob = np.clip(prob.astype(float), 0.0001, 0.9999)
    has_two_classes = len(set(y_true.astype(int).tolist())) >= 2
    return {
        "rocAuc": metric_auc(y_true, prob) if has_two_classes else None,
        "averagePrecision": metric_average_precision(y_true, prob) if has_two_classes else None,
        "brier": metric_brier(y_true, prob),
        "ece": expected_calibration_error(y_true, prob),
        "support": int(len(y_true)),
        "positives": int(y_true.sum()),
        "prevalence": float(y_true.mean()) if len(y_true) else None,
    }


def metrics_by_stage(df: pd.DataFrame, label: str, prob: np.ndarray) -> dict[str, Any]:
    stage_metrics: dict[str, Any] = {}
    stage_values = df["stage_key"].to_numpy()
    y = df[label].astype(int).to_numpy()
    for stage in STAGES:
        mask = stage_values == stage
        if not np.any(mask):
            continue
        stage_metrics[stage] = metrics_for(y[mask], prob[mask])
    return stage_metrics


def timing_window_metrics(df: pd.DataFrame, label: str, prob: np.ndarray) -> dict[str, Any]:
    stage_values = df["stage_key"].to_numpy()
    y = df[label].astype(int).to_numpy()
    windows = {
        "earlyWarningPreOutcome": ["pre-tt1", "post-tt1", "post-tt2", "post-assignments"],
        "lateOutcomeDetection": ["post-see"],
        "courseworkEvidenceAvailable": ["post-tt1", "post-tt2", "post-assignments", "post-see"],
        "fullSemesterPooled": STAGES,
    }
    result: dict[str, Any] = {}
    for name, stages in windows.items():
        mask = np.isin(stage_values, stages)
        if not np.any(mask):
            continue
        result[name] = metrics_for(y[mask], prob[mask])
    return result


def fit_predict_logistic(X_train: np.ndarray, y_train: np.ndarray, X_val: np.ndarray, X_test: np.ndarray, _use_gpu: str) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    if LogisticRegression is None or StandardScaler is None:
        raise RuntimeError("sklearn not installed")
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_val_s = scaler.transform(X_val)
    X_test_s = scaler.transform(X_test)
    model = LogisticRegression(C=1.0, solver="lbfgs", class_weight="balanced", max_iter=1000, random_state=DETERMINISTIC_SEED)
    model.fit(X_train_s, y_train)
    return model.predict_proba(X_val_s)[:, 1], model.predict_proba(X_test_s)[:, 1], {"scaled": True}


def fit_predict_stage_logistic(df_train: pd.DataFrame, df_val: pd.DataFrame, df_test: pd.DataFrame, cols: list[str], label: str) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    if LogisticRegression is None or StandardScaler is None:
        raise RuntimeError("sklearn not installed")
    val_prob = np.zeros(len(df_val), dtype=float)
    test_prob = np.zeros(len(df_test), dtype=float)
    trained_stages: list[str] = []
    skipped_stages: list[str] = []
    for stage in STAGES:
        train_mask = df_train["stage_key"].to_numpy() == stage
        val_mask = df_val["stage_key"].to_numpy() == stage
        test_mask = df_test["stage_key"].to_numpy() == stage
        if not np.any(train_mask) or not np.any(val_mask) or not np.any(test_mask):
            skipped_stages.append(stage)
            continue
        y_train = df_train.loc[train_mask, label].astype(int).to_numpy()
        if len(set(y_train.tolist())) < 2:
            skipped_stages.append(stage)
            val_prob[val_mask] = float(y_train.mean()) if len(y_train) else 0.5
            test_prob[test_mask] = float(y_train.mean()) if len(y_train) else 0.5
            continue
        X_train = df_train.loc[train_mask, cols].to_numpy(dtype=float)
        X_val = df_val.loc[val_mask, cols].to_numpy(dtype=float)
        X_test = df_test.loc[test_mask, cols].to_numpy(dtype=float)
        scaler = StandardScaler()
        X_train_s = scaler.fit_transform(X_train)
        model = LogisticRegression(C=1.0, solver="lbfgs", class_weight="balanced", max_iter=1000, random_state=DETERMINISTIC_SEED)
        model.fit(X_train_s, y_train)
        val_prob[val_mask] = model.predict_proba(scaler.transform(X_val))[:, 1]
        test_prob[test_mask] = model.predict_proba(scaler.transform(X_test))[:, 1]
        trained_stages.append(stage)
    return val_prob, test_prob, {"trainedStages": trained_stages, "skippedStages": skipped_stages, "stageSpecialist": True, "baseModel": "logistic"}


def fit_predict_stage_hist_gradient_boosting(df_train: pd.DataFrame, df_val: pd.DataFrame, df_test: pd.DataFrame, cols: list[str], label: str) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    if HistGradientBoostingClassifier is None:
        raise RuntimeError("sklearn not installed")
    val_prob = np.zeros(len(df_val), dtype=float)
    test_prob = np.zeros(len(df_test), dtype=float)
    trained_stages: list[str] = []
    skipped_stages: list[str] = []
    for stage in STAGES:
        train_mask = df_train["stage_key"].to_numpy() == stage
        val_mask = df_val["stage_key"].to_numpy() == stage
        test_mask = df_test["stage_key"].to_numpy() == stage
        if not np.any(train_mask) or not np.any(val_mask) or not np.any(test_mask):
            skipped_stages.append(stage)
            continue
        y_train = df_train.loc[train_mask, label].astype(int).to_numpy()
        if len(set(y_train.tolist())) < 2:
            skipped_stages.append(stage)
            val_prob[val_mask] = float(y_train.mean()) if len(y_train) else 0.5
            test_prob[test_mask] = float(y_train.mean()) if len(y_train) else 0.5
            continue
        X_train = df_train.loc[train_mask, cols].to_numpy(dtype=float)
        X_val = df_val.loc[val_mask, cols].to_numpy(dtype=float)
        X_test = df_test.loc[test_mask, cols].to_numpy(dtype=float)
        model = HistGradientBoostingClassifier(max_iter=200, learning_rate=0.05, l2_regularization=0.01, random_state=DETERMINISTIC_SEED)
        model.fit(X_train, y_train)
        val_prob[val_mask] = model.predict_proba(X_val)[:, 1]
        test_prob[test_mask] = model.predict_proba(X_test)[:, 1]
        trained_stages.append(stage)
    return val_prob, test_prob, {"trainedStages": trained_stages, "skippedStages": skipped_stages, "stageSpecialist": True, "baseModel": "hist_gradient_boosting"}


def fit_predict_xgboost(X_train: np.ndarray, y_train: np.ndarray, X_val: np.ndarray, X_test: np.ndarray, use_gpu: str) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    mod = importlib.import_module("xgboost")
    pos = max(int(y_train.sum()), 1)
    neg = max(len(y_train) - pos, 1)
    params = {
        "max_depth": 6,
        "learning_rate": 0.05,
        "n_estimators": 300,
        "scale_pos_weight": neg / pos,
        "random_state": DETERMINISTIC_SEED,
        "verbosity": 0,
        "eval_metric": "logloss",
        "n_jobs": 8,
    }
    if use_gpu in {"auto", "cuda"}:
        params["device"] = "cuda"
        params["tree_method"] = "hist"
    model = mod.XGBClassifier(**params)
    model.fit(X_train, y_train)
    return model.predict_proba(X_val)[:, 1], model.predict_proba(X_test)[:, 1], params


def fit_predict_lightgbm(X_train: np.ndarray, y_train: np.ndarray, X_val: np.ndarray, X_test: np.ndarray, use_gpu: str) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    mod = importlib.import_module("lightgbm")
    pos = max(int(y_train.sum()), 1)
    neg = max(len(y_train) - pos, 1)
    params = {
        "max_depth": 6,
        "learning_rate": 0.05,
        "n_estimators": 300,
        "scale_pos_weight": neg / pos,
        "random_state": DETERMINISTIC_SEED,
        "verbose": -1,
        "n_jobs": 8,
    }
    if use_gpu == "cuda":
        params["device"] = "gpu"
    feature_names = [f"feat_{idx}" for idx in range(X_train.shape[1])]
    X_train_df = pd.DataFrame(X_train, columns=feature_names)
    X_val_df = pd.DataFrame(X_val, columns=feature_names)
    X_test_df = pd.DataFrame(X_test, columns=feature_names)
    model = mod.LGBMClassifier(**params)
    model.fit(X_train_df, y_train)
    return model.predict_proba(X_val_df)[:, 1], model.predict_proba(X_test_df)[:, 1], params


def fit_predict_catboost(X_train: np.ndarray, y_train: np.ndarray, X_val: np.ndarray, X_test: np.ndarray, use_gpu: str) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    mod = importlib.import_module("catboost")
    pos = max(int(y_train.sum()), 1)
    neg = max(len(y_train) - pos, 1)
    params = {
        "depth": 6,
        "learning_rate": 0.05,
        "iterations": 300,
        "scale_pos_weight": neg / pos,
        "random_seed": DETERMINISTIC_SEED,
        "verbose": False,
        "allow_writing_files": False,
    }
    if use_gpu in {"auto", "cuda"}:
        params["task_type"] = "GPU"
        params["devices"] = "0"
    model = mod.CatBoostClassifier(**params)
    model.fit(X_train, y_train, silent=True)
    return model.predict_proba(X_val)[:, 1], model.predict_proba(X_test)[:, 1], params


def fit_predict_tabpfn(X_train: np.ndarray, y_train: np.ndarray, X_val: np.ndarray, X_test: np.ndarray, use_gpu: str) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    mod = importlib.import_module("tabpfn")
    kwargs: dict[str, Any] = {}
    if use_gpu in {"auto", "cuda"}:
        kwargs["device"] = "cuda"
    try:
        model = mod.TabPFNClassifier(**kwargs)
    except TypeError:
        model = mod.TabPFNClassifier()
        kwargs = {"device": "default"}
    model.fit(X_train, y_train)
    return model.predict_proba(X_val)[:, 1], model.predict_proba(X_test)[:, 1], kwargs


def fit_predict_autogluon(X_train: np.ndarray, y_train: np.ndarray, X_val: np.ndarray, X_test: np.ndarray, use_gpu: str, output_dir: Path, head: str, time_limit: int) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    mod = importlib.import_module("autogluon.tabular")
    label = "__label"
    train_df = pd.DataFrame(X_train, columns=[f"feat_{i}" for i in range(X_train.shape[1])])
    train_df[label] = y_train
    path = output_dir / "autogluon" / head
    predictor = mod.TabularPredictor(label=label, path=str(path), eval_metric="roc_auc", verbosity=0)
    fit_kwargs: dict[str, Any] = {
        "train_data": train_df,
        "presets": "best_quality",
        "time_limit": time_limit if time_limit > 0 else None,
    }
    if use_gpu in {"auto", "cuda"}:
        fit_kwargs["num_gpus"] = 1
    fit_kwargs = {k: v for k, v in fit_kwargs.items() if v is not None}
    predictor.fit(**fit_kwargs)
    val_features = pd.DataFrame(X_val, columns=[f"feat_{i}" for i in range(X_val.shape[1])])
    test_features = pd.DataFrame(X_test, columns=[f"feat_{i}" for i in range(X_test.shape[1])])
    val_prob = predictor.predict_proba(val_features).iloc[:, 1].to_numpy(dtype=float)
    test_prob = predictor.predict_proba(test_features).iloc[:, 1].to_numpy(dtype=float)
    return val_prob, test_prob, {"path": str(path), "timeLimitSeconds": time_limit, "presets": "best_quality"}


def fit_predict_pytabkit(X_train: np.ndarray, y_train: np.ndarray, X_val: np.ndarray, y_val: np.ndarray, X_test: np.ndarray, use_gpu: str, output_dir: Path, head: str, time_limit: int, epochs: int) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    mod = importlib.import_module("pytabkit")
    tmp_folder = output_dir / "pytabkit" / head
    tmp_folder.mkdir(parents=True, exist_ok=True)
    requested_device = "cuda" if use_gpu in {"auto", "cuda"} else "cpu"
    last_error: Exception | None = None
    for cls_name in ["TabM_D_Classifier", "RealMLP_TD_S_Classifier", "MLP_SKL_D_Classifier"]:
        cls = getattr(mod, cls_name)
        for device in [requested_device, "cpu"] if requested_device != "cpu" else ["cpu"]:
            try:
                model = cls(
                    device=device,
                    random_state=DETERMINISTIC_SEED,
                    n_threads=8,
                    tmp_folder=tmp_folder,
                    verbosity=0,
                    n_epochs=epochs,
                )
                model.fit(X_train, y_train, X_val=X_val, y_val=y_val, time_to_fit_in_seconds=time_limit)
                return (
                    model.predict_proba(X_val)[:, 1],
                    model.predict_proba(X_test)[:, 1],
                    {"modelClass": cls_name, "device": device, "tmpFolder": str(tmp_folder), "nEpochs": epochs, "timeLimitSeconds": time_limit},
                )
            except Exception as exc:
                last_error = exc
    raise RuntimeError(str(last_error) if last_error is not None else "pytabkit failed")


def package_available(name: str) -> bool:
    try:
        importlib.import_module(name)
        return True
    except Exception:
        return False


def model_specs(allow_heavy: bool) -> dict[str, Callable[..., tuple[np.ndarray, np.ndarray, dict[str, Any]]]]:
    specs: dict[str, Callable[..., tuple[np.ndarray, np.ndarray, dict[str, Any]]]] = {
        "logistic": fit_predict_logistic,
        "xgboost": fit_predict_xgboost,
        "lightgbm": fit_predict_lightgbm,
        "catboost": fit_predict_catboost,
    }
    if allow_heavy:
        specs["tabpfn"] = fit_predict_tabpfn
        specs["autogluon"] = fit_predict_autogluon
        specs["pytabkit"] = fit_predict_pytabkit
    return specs


def run_for_head(
    head: str,
    df_train: pd.DataFrame,
    df_val: pd.DataFrame,
    df_test: pd.DataFrame,
    cols: list[str],
    output_dir: Path,
    allow_heavy: bool,
    use_gpu: str,
    max_heavy_train_rows: int,
    autogluon_time_limit: int,
    pytabkit_time_limit: int,
    pytabkit_epochs: int,
) -> dict[str, Any]:
    label = LABEL_COLS[head]
    y_train = df_train[label].astype(int).to_numpy()
    y_val = df_val[label].astype(int).to_numpy()
    y_test = df_test[label].astype(int).to_numpy()
    if len(set(y_train.tolist())) < 2 or len(set(y_val.tolist())) < 2 or len(set(y_test.tolist())) < 2:
        return {"status": "skipped", "reason": "single_class_split"}
    if LogisticRegression is None:
        val_prob = heuristic_probability(df_val, head)
        test_prob = heuristic_probability(df_test, head)
        return {
            "status": "ok",
            "models": {
                "heuristic_v6_contract_fallback": {
                    "status": "ok",
                    "trainRows": int(len(df_train)),
                    "elapsedSeconds": 0.0,
                    "config": {"reason": "sklearn not installed"},
                    "validation": metrics_for(y_val, val_prob),
                    "test": metrics_for(y_test, test_prob),
                    "validationByStage": metrics_by_stage(df_val, label, val_prob),
                    "testByStage": metrics_by_stage(df_test, label, test_prob),
                    "validationTimingWindows": timing_window_metrics(df_val, label, val_prob),
                    "testTimingWindows": timing_window_metrics(df_test, label, test_prob),
                }
            },
            "selectedByValidationAuc": "heuristic_v6_contract_fallback",
            "selectedByEarlyWarningValidationAuc": "heuristic_v6_contract_fallback",
            "bestReportedTestAuc": metrics_for(y_test, test_prob).get("rocAuc"),
        }
    X_train = df_train[cols].to_numpy(dtype=float)
    X_val = df_val[cols].to_numpy(dtype=float)
    X_test = df_test[cols].to_numpy(dtype=float)
    head_result: dict[str, Any] = {"status": "ok", "models": {}}
    predictions_dir = output_dir / "predictions" / head
    predictions_dir.mkdir(parents=True, exist_ok=True)
    val_predictions: dict[str, np.ndarray] = {}
    test_predictions: dict[str, np.ndarray] = {}
    for name, fitter in model_specs(allow_heavy).items():
        package_name = {"xgboost": "xgboost", "lightgbm": "lightgbm", "catboost": "catboost", "tabpfn": "tabpfn", "autogluon": "autogluon.tabular", "pytabkit": "pytabkit"}.get(name)
        if package_name and not package_available(package_name):
            head_result["models"][name] = {"status": "skipped", "reason": "package_not_installed"}
            continue
        started = time.time()
        try:
            train_X, train_y = X_train, y_train
            if name in {"tabpfn", "autogluon", "pytabkit"}:
                train_X, train_y = sample_for_heavy(X_train, y_train, max_heavy_train_rows, DETERMINISTIC_SEED)
            if name == "autogluon":
                val_prob, test_prob, config = fitter(train_X, train_y, X_val, X_test, use_gpu, output_dir, head, autogluon_time_limit)
            elif name == "pytabkit":
                val_prob, test_prob, config = fitter(train_X, train_y, X_val, y_val, X_test, use_gpu, output_dir, head, pytabkit_time_limit, pytabkit_epochs)
            else:
                val_prob, test_prob, config = fitter(train_X, train_y, X_val, X_test, use_gpu)
            val_predictions[name] = np.clip(val_prob, 0.0001, 0.9999)
            test_predictions[name] = np.clip(test_prob, 0.0001, 0.9999)
            np.save(predictions_dir / f"{name}_val.npy", val_predictions[name])
            np.save(predictions_dir / f"{name}_test.npy", test_predictions[name])
            head_result["models"][name] = {
                "status": "ok",
                "trainRows": int(len(train_y)),
                "elapsedSeconds": time.time() - started,
                "config": config,
                "validation": metrics_for(y_val, val_predictions[name]),
                "test": metrics_for(y_test, test_predictions[name]),
                "validationByStage": metrics_by_stage(df_val, label, val_predictions[name]),
                "testByStage": metrics_by_stage(df_test, label, test_predictions[name]),
                "validationTimingWindows": timing_window_metrics(df_val, label, val_predictions[name]),
                "testTimingWindows": timing_window_metrics(df_test, label, test_predictions[name]),
            }
        except Exception as exc:
            head_result["models"][name] = {"status": "failed", "reason": str(exc), "elapsedSeconds": time.time() - started}
    if head in {"ceRisk", "seeRisk"}:
        for name, fitter in {
            "stage_specialist_logistic": fit_predict_stage_logistic,
            "stage_specialist_hist_gradient_boosting": fit_predict_stage_hist_gradient_boosting,
        }.items():
            started = time.time()
            try:
                val_prob, test_prob, config = fitter(df_train, df_val, df_test, cols, label)
                val_predictions[name] = np.clip(val_prob, 0.0001, 0.9999)
                test_predictions[name] = np.clip(test_prob, 0.0001, 0.9999)
                np.save(predictions_dir / f"{name}_val.npy", val_predictions[name])
                np.save(predictions_dir / f"{name}_test.npy", test_predictions[name])
                head_result["models"][name] = {
                    "status": "ok",
                    "trainRows": int(len(df_train)),
                    "elapsedSeconds": time.time() - started,
                    "config": config,
                    "validation": metrics_for(y_val, val_predictions[name]),
                    "test": metrics_for(y_test, test_predictions[name]),
                    "validationByStage": metrics_by_stage(df_val, label, val_predictions[name]),
                    "testByStage": metrics_by_stage(df_test, label, test_predictions[name]),
                    "validationTimingWindows": timing_window_metrics(df_val, label, val_predictions[name]),
                    "testTimingWindows": timing_window_metrics(df_test, label, test_predictions[name]),
                }
            except Exception as exc:
                head_result["models"][name] = {"status": "failed", "reason": str(exc), "elapsedSeconds": time.time() - started}
    available_for_ensemble = [name for name in ["xgboost", "lightgbm", "catboost", "tabpfn"] if name in val_predictions]
    if len(available_for_ensemble) >= 2:
        weights = np.array([1.0 / max(metrics_for(y_val, val_predictions[name])["ece"], 1e-4) for name in available_for_ensemble])
        weights = weights / weights.sum()
        val_ens = np.average(np.column_stack([val_predictions[name] for name in available_for_ensemble]), axis=1, weights=weights)
        test_ens = np.average(np.column_stack([test_predictions[name] for name in available_for_ensemble]), axis=1, weights=weights)
        np.save(predictions_dir / "calibration_weighted_ensemble_val.npy", val_ens)
        np.save(predictions_dir / "calibration_weighted_ensemble_test.npy", test_ens)
        head_result["models"]["calibration_weighted_ensemble"] = {
            "status": "ok",
            "members": available_for_ensemble,
            "weights": {name: float(weight) for name, weight in zip(available_for_ensemble, weights)},
            "validation": metrics_for(y_val, val_ens),
            "test": metrics_for(y_test, test_ens),
            "validationByStage": metrics_by_stage(df_val, label, val_ens),
            "testByStage": metrics_by_stage(df_test, label, test_ens),
            "validationTimingWindows": timing_window_metrics(df_val, label, val_ens),
            "testTimingWindows": timing_window_metrics(df_test, label, test_ens),
        }
    ok_models = {k: v for k, v in head_result["models"].items() if v.get("status") == "ok"}
    if ok_models:
        selected = max(ok_models.items(), key=lambda item: item[1]["validation"]["rocAuc"] or 0.0)
        head_result["selectedByValidationAuc"] = selected[0]
        head_result["bestReportedTestAuc"] = max((v["test"]["rocAuc"] or 0.0) for v in ok_models.values())
        head_result["selectedByEarlyWarningValidationAuc"] = max(
            ok_models.items(),
            key=lambda item: item[1].get("validationTimingWindows", {}).get("earlyWarningPreOutcome", {}).get("rocAuc") or 0.0,
        )[0]
    return head_result


def write_markdown(report: dict[str, Any], output_path: Path) -> None:
    def fmt(value: Any) -> str:
        return "—" if value is None else f"{float(value):.4f}"

    lines = [
        "# AirMentor Shadow Tabular Benchmark",
        "",
        "This benchmark is shadow-only. Results do not change product serving.",
        "",
        f"- **Synthetic only:** `{report['syntheticOnly']}`",
        f"- **Feature schema:** `{report['featureSchemaVersion']}`",
        f"- **Feature count:** `{report['featureCount']}`",
        f"- **Production serving claim allowed:** `{report['productionServingClaimAllowed']}`",
        f"- **Heavy models allowed:** `{report['allowHeavyModels']}`",
        "",
        "## CE/SEE Product Interpretation",
        "",
        "CE/SEE risk should be interpreted as stage-aware academic early warning. A single pooled AUC across all semester stages mixes different product questions:",
        "",
        "- `earlyWarningPreOutcome`: risk before the final outcome is fully observed.",
        "- `lateOutcomeDetection`: risk once outcome evidence is available.",
        "- `fullSemesterPooled`: historical comparability only; not the main product-readiness metric.",
        "",
        "## Per-head Results",
        "",
    ]
    for head, payload in report["heads"].items():
        lines.extend([f"### {head}", ""])
        if payload.get("status") != "ok":
            lines.extend([f"Skipped: `{payload.get('reason')}`", ""])
            continue
        lines.extend(["| Model | Status | Val AUC | Test AUC | Test AP | Test Brier | Test ECE | Early-warning Test AUC | Late-detection Test AUC | Seconds |", "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|"])
        for model_name, model_payload in payload["models"].items():
            if model_payload.get("status") != "ok":
                lines.append(f"| {model_name} | {model_payload.get('status')}: {model_payload.get('reason')} | — | — | — | — | — | — | — | {model_payload.get('elapsedSeconds', 0):.1f} |")
                continue
            windows = model_payload.get("testTimingWindows", {})
            early_auc = windows.get("earlyWarningPreOutcome", {}).get("rocAuc")
            late_auc = windows.get("lateOutcomeDetection", {}).get("rocAuc")
            lines.append(
                f"| {model_name} | ok | {fmt(model_payload['validation']['rocAuc'])} | "
                f"{fmt(model_payload['test']['rocAuc'])} | {fmt(model_payload['test'].get('averagePrecision'))} | "
                f"{fmt(model_payload['test']['brier'])} | {fmt(model_payload['test']['ece'])} | "
                f"{fmt(early_auc)} | {fmt(late_auc)} | {model_payload.get('elapsedSeconds', 0):.1f} |"
            )
        lines.extend([
            "",
            f"Selected by validation AUC: `{payload.get('selectedByValidationAuc')}`",
            f"Selected by early-warning validation AUC: `{payload.get('selectedByEarlyWarningValidationAuc')}`",
            "",
        ])
        if head in {"ceRisk", "seeRisk"}:
            selected_name = payload.get("selectedByValidationAuc")
            selected_payload = payload["models"].get(selected_name, {}) if selected_name else {}
            stage_metrics = selected_payload.get("testByStage", {})
            if stage_metrics:
                lines.extend(["Stage breakdown for selected model:", "", "| Stage | Test AUC | Test AP | Test Brier | Prevalence | Support |", "|---|---:|---:|---:|---:|---:|"])
                for stage in STAGES:
                    metrics = stage_metrics.get(stage)
                    if not metrics:
                        continue
                    lines.append(
                        f"| {stage} | {fmt(metrics.get('rocAuc'))} | {fmt(metrics.get('averagePrecision'))} | "
                        f"{fmt(metrics.get('brier'))} | {fmt(metrics.get('prevalence'))} | {metrics.get('support', 0)} |"
                    )
                lines.append("")
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run shadow tabular benchmark for AirMentor synthetic features")
    parser.add_argument("features_csv")
    parser.add_argument("output_dir")
    parser.add_argument("--allow-heavy-models", action="store_true")
    parser.add_argument("--use-gpu", choices=["auto", "cpu", "cuda"], default="auto")
    parser.add_argument("--max-heavy-train-rows", type=int, default=50000)
    parser.add_argument("--autogluon-time-limit", type=int, default=7200)
    parser.add_argument("--pytabkit-time-limit", type=int, default=300)
    parser.add_argument("--pytabkit-epochs", type=int, default=64)
    args = parser.parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(args.features_csv)
    cols = feature_cols(df)
    feature_contract = feature_contract_report(df, cols)
    if feature_contract["passed"] is not True:
        print(f"ERROR: v6 feature contract failed: {json.dumps(feature_contract, sort_keys=True)}")
        return 1
    df_train, df_val, df_test = split_data(df)
    report: dict[str, Any] = {
        "syntheticOnly": True,
        "productionServingClaimAllowed": False,
        "causalClaimAllowed": False,
        "realWorldGeneralizationClaimAllowed": False,
        "featuresCsv": args.features_csv,
        "featureSchemaVersion": feature_contract["featureSchemaVersion"],
        "featureSchema": {
            "name": feature_contract["featureSchemaVersion"],
            "featureCount": feature_contract["featureCount"],
            "featureKeyHash": feature_contract["featureKeyHash"],
        },
        "featureContract": feature_contract,
        "featureCount": len(cols),
        "allowHeavyModels": bool(args.allow_heavy_models),
        "useGpu": args.use_gpu,
        "splitCounts": {"train": int(len(df_train)), "validation": int(len(df_val)), "test": int(len(df_test))},
        "heads": {},
    }
    for head in HEADS:
        report["heads"][head] = run_for_head(
            head,
            df_train,
            df_val,
            df_test,
            cols,
            output_dir,
            args.allow_heavy_models,
            args.use_gpu,
            args.max_heavy_train_rows,
            args.autogluon_time_limit,
            args.pytabkit_time_limit,
            args.pytabkit_epochs,
        )
    results_path = output_dir / "benchmark-results.json"
    markdown_path = output_dir / "benchmark-report.md"
    results_path.write_text(json.dumps(clean_json(report), indent=2, sort_keys=True), encoding="utf-8")
    write_markdown(clean_json(report), markdown_path)
    print(f"Wrote {results_path}")
    print(f"Wrote {markdown_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
