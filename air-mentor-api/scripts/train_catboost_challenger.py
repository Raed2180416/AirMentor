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
import argparse
import json
import os
import sys

try:
    import numpy as np
    import pandas as pd
    from catboost import CatBoostClassifier, Pool
    from sklearn.metrics import (
        average_precision_score,
        brier_score_loss,
        confusion_matrix,
        log_loss,
        precision_recall_fscore_support,
        roc_auc_score,
    )
except ModuleNotFoundError as exc:
    print(
        "[catboost] ERROR: missing Python dependency "
        f"'{exc.name}'. Install ML extras before running this script.\n"
        "[catboost] Suggested command: python3 -m pip install -r requirements-ml.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from catboost.utils import get_gpu_device_count
except Exception:
    def get_gpu_device_count() -> int:
        return 0

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

def metrics_for(y_true: np.ndarray, y_prob: np.ndarray) -> dict:
    y_pred = (y_prob >= 0.5).astype(int)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true,
        y_pred,
        average="binary",
        zero_division=0,
    )
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    if len(set(y_true)) < 2:
        return {
            "rocAuc": 0.5,
            "brier": float(brier_score_loss(y_true, y_prob)),
            "logLoss": 0.0,
            "averagePrecision": 0.0,
            "precisionAt50": float(precision),
            "recallAt50": float(recall),
            "f1At50": float(f1),
            "truePositiveAt50": int(tp),
            "falsePositiveAt50": int(fp),
            "trueNegativeAt50": int(tn),
            "falseNegativeAt50": int(fn),
        }
    return {
        "rocAuc": float(roc_auc_score(y_true, y_prob)),
        "brier": float(brier_score_loss(y_true, y_prob)),
        "logLoss": float(log_loss(y_true, y_prob)),
        "averagePrecision": float(average_precision_score(y_true, y_prob)),
        "precisionAt50": float(precision),
        "recallAt50": float(recall),
        "f1At50": float(f1),
        "truePositiveAt50": int(tp),
        "falsePositiveAt50": int(fp),
        "trueNegativeAt50": int(tn),
        "falseNegativeAt50": int(fn),
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
        return {}

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
        early_stopping_rounds=30,
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
    model.fit(train_pool, eval_set=val_pool)

    val_probs = model.predict_proba(val_pool)[:, 1]
    test_probs = model.predict_proba(test_pool)[:, 1]

    val_metrics = metrics_for(y_val, val_probs)
    test_metrics = metrics_for(y_test, test_probs)

    print(f"[catboost] {head_key}: val  AUC={val_metrics['rocAuc']:.4f} brier={val_metrics['brier']:.4f} recall@0.5={val_metrics['recallAt50']:.4f}")
    print(f"[catboost] {head_key}: test AUC={test_metrics['rocAuc']:.4f} brier={test_metrics['brier']:.4f} recall@0.5={test_metrics['recallAt50']:.4f}")

    out_path = os.path.join(output_dir, f"catboost_{head_key}_v1.json")
    model.save_model(out_path, format="json")
    print(f"[catboost] {head_key}: saved model to {out_path}")

    return {"validation": val_metrics, "test": test_metrics, "bestIteration": model.best_iteration_}


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
    args = parser.parse_args()

    if not os.path.exists(args.features_csv):
        print(f"[catboost] ERROR: features CSV not found: {args.features_csv}")
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)

    print(f"[catboost] reading {args.features_csv}")
    df = pd.read_csv(args.features_csv)
    print(f"[catboost] loaded {len(df)} rows | splits: {dict(df['split'].value_counts())}")
    feature_cols = sorted(
        [column for column in df.columns if column.startswith("feat_")],
        key=lambda column: int(column.split("_", 1)[1]),
    )
    if not feature_cols:
        print("[catboost] ERROR: no feat_* columns found in features CSV")
        sys.exit(1)
    print(f"[catboost] detected {len(feature_cols)} feature columns")

    df_train = df[df["split"] == "train"].copy()
    df_val = df[df["split"] == "validation"].copy()
    df_test = df[df["split"] == "test"].copy()

    # Fallback: if no 'train' rows exported (e.g., eval CSV restricted to heldout splits),
    # split the validation rows deterministically by run_id into train/val/test (2:1:1) so
    # the challenger can still be fit and scored. Stratification-by-run preserves per-run
    # temporal locality (no leakage across semesters of same run).
    if len(df_train) == 0 and len(df_val) > 0:
        val_run_ids = sorted(df_val["run_id"].unique())
        rng = np.random.default_rng(42)
        perm = rng.permutation(len(val_run_ids))
        n_total = len(val_run_ids)
        n_train = max(1, n_total * 2 // 4)  # 50%
        n_val = max(1, (n_total - n_train) // 2)  # 25%
        train_run_ids = {val_run_ids[i] for i in perm[:n_train]}
        inner_val_run_ids = {val_run_ids[i] for i in perm[n_train : n_train + n_val]}
        test_run_ids = {val_run_ids[i] for i in perm[n_train + n_val :]}
        df_train = df_val[df_val["run_id"].isin(train_run_ids)].copy()
        df_val_new = df_val[df_val["run_id"].isin(inner_val_run_ids)].copy()
        df_test_fallback = df_val[df_val["run_id"].isin(test_run_ids)].copy()
        if len(df_test) == 0:
            df_test = df_test_fallback
        df_val = df_val_new
        print(
            f"[catboost] fallback split: {n_total} run_ids \u2192 "
            f"train={len(train_run_ids)} runs ({len(df_train)} rows), "
            f"val={len(inner_val_run_ids)} runs ({len(df_val)} rows), "
            f"test={len(test_run_ids)} runs ({len(df_test)} rows)"
        )

    if "run_id" in df.columns:
        split_runs = {
            "train": set(df_train["run_id"].dropna().astype(str)),
            "validation": set(df_val["run_id"].dropna().astype(str)),
            "test": set(df_test["run_id"].dropna().astype(str)),
        }
        overlaps = {
            "train_validation": sorted(split_runs["train"] & split_runs["validation"])[:5],
            "train_test": sorted(split_runs["train"] & split_runs["test"])[:5],
            "validation_test": sorted(split_runs["validation"] & split_runs["test"])[:5],
        }
        leaking = {key: value for key, value in overlaps.items() if value}
        if leaking:
            print(f"[catboost] ERROR: run_id leakage across splits: {json.dumps(leaking)}", file=sys.stderr)
            sys.exit(1)
        print(
            "[catboost] split guard: "
            f"train_runs={len(split_runs['train'])} "
            f"validation_runs={len(split_runs['validation'])} "
            f"test_runs={len(split_runs['test'])}"
        )

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
            args.output_dir,
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

    metrics_path = os.path.join(args.output_dir, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(all_metrics, f, indent=2)
    print(f"\n[catboost] all metrics saved to {metrics_path}")

    print("\n[catboost] SUMMARY")
    for head_key, m in all_metrics.items():
        t = m.get("test", {})
        print(f"  {head_key:30s} test AUC={t.get('rocAuc',0):.4f} brier={t.get('brier',0):.4f} AP={t.get('averagePrecision',0):.4f}")


if __name__ == "__main__":
    main()
