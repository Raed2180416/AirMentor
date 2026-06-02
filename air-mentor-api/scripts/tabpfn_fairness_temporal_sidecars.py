#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import tabpfn as tabpfn_module
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from tabpfn import TabPFNClassifier

from tabpfn_eval_common import (
    DETERMINISTIC_SEED,
    HEAD_TARGETS,
    feature_cols,
    feature_contract_report,
    sha256_file,
    split_summary,
    stratified_sample,
    target_summary,
)


STAGE_ORDER = {
    "pre-tt1": 0,
    "post-tt1": 1,
    "post-tt2": 2,
    "post-assignments": 3,
    "post-see": 4,
}

FAIRNESS_LIMITS = {
    "fprGap": 0.12,
    "tprGap": 0.12,
    "positiveRateGap": 0.20,
    "brierGap": 0.08,
}


def metrics_for(y_true: np.ndarray, y_prob: np.ndarray) -> dict[str, float | None]:
    if len(set(y_true.astype(int).tolist())) < 2:
        auc: float | None = None
    else:
        auc = float(roc_auc_score(y_true, y_prob))
    return {
        "AUC": auc,
        "Brier": float(brier_score_loss(y_true, y_prob)),
    }


def bucket(value: float, cuts: list[tuple[float, str]], default: str) -> str:
    for upper, label in cuts:
        if value <= upper:
            return label
    return default


def enriched_sample(sample: pd.DataFrame) -> pd.DataFrame:
    enriched = sample.copy()
    enriched["semester_bucket"] = enriched["semester_number"].astype(str)
    enriched["attendance_band"] = [
        bucket(float(value) * 100.0, [(50, "lt50"), (65, "50_65"), (75, "65_75"), (85, "75_85")], "gte85")
        for value in enriched["feat_0"].fillna(0.0)
    ]
    enriched["backlog_pressure_band"] = [
        bucket(
            max(float(row.get(col, 0.0)) for col in ["feat_4", "feat_44", "feat_45", "feat_46", "feat_47"]),
            [(0.0, "none"), (0.33, "low"), (0.66, "medium")],
            "high",
        )
        for _, row in enriched.iterrows()
    ]
    enriched["prerequisite_pressure_band"] = [
        bucket(
            float(row.get("feat_15", 0.0)) + float(row.get("feat_16", 0.0)) + float(row.get("feat_17", 0.0)),
            [(0.35, "low"), (0.95, "medium"), (1.6, "high")],
            "very_high",
        )
        for _, row in enriched.iterrows()
    ]
    return enriched


def group_metrics(y_true: np.ndarray, y_prob: np.ndarray, threshold: float) -> dict[str, Any]:
    y_true = y_true.astype(int)
    y_pred = (y_prob >= threshold).astype(int)
    positives = int(y_true.sum())
    negatives = int(len(y_true) - positives)
    tp = int(((y_true == 1) & (y_pred == 1)).sum())
    fp = int(((y_true == 0) & (y_pred == 1)).sum())
    tn = int(((y_true == 0) & (y_pred == 0)).sum())
    fn = int(((y_true == 1) & (y_pred == 0)).sum())
    return {
        "support": int(len(y_true)),
        "positiveRate": float(positives / len(y_true)) if len(y_true) else None,
        "predictedPositiveRate": float(y_pred.mean()) if len(y_pred) else None,
        "meanProbability": float(y_prob.mean()) if len(y_prob) else None,
        "tpr": float(tp / positives) if positives else None,
        "fpr": float(fp / negatives) if negatives else None,
        "brier": float(brier_score_loss(y_true, y_prob)) if len(y_true) else None,
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn,
    }


def gap(values: list[float | None]) -> float | None:
    present = [value for value in values if value is not None]
    if len(present) < 2:
        return None
    return float(max(present) - min(present))


def fairness_for_dimension(
    frame: pd.DataFrame,
    y_true: np.ndarray,
    y_prob: np.ndarray,
    dimension: str,
    threshold: float,
    min_support: int,
) -> dict[str, Any]:
    groups: dict[str, Any] = {}
    for value in sorted(str(item) for item in frame[dimension].fillna("unknown").unique()):
        mask = frame[dimension].astype(str).to_numpy() == value
        groups[value] = group_metrics(y_true[mask], y_prob[mask], threshold)
    eligible = {name: item for name, item in groups.items() if item["support"] >= min_support}
    gaps = {
        "fprGap": gap([item["fpr"] for item in eligible.values()]),
        "tprGap": gap([item["tpr"] for item in eligible.values()]),
        "positiveRateGap": gap([item["predictedPositiveRate"] for item in eligible.values()]),
        "brierGap": gap([item["brier"] for item in eligible.values()]),
    }
    failures = [
        {"metric": metric, "value": value, "limit": FAIRNESS_LIMITS[metric]}
        for metric, value in gaps.items()
        if value is not None and value > FAIRNESS_LIMITS[metric]
    ]
    return {
        "groups": groups,
        "eligibleGroups": sorted(eligible),
        "gaps": gaps,
        "passed": not failures,
        "failures": failures,
    }


def stage_population_summary(frame: pd.DataFrame, target: str) -> dict[str, Any]:
    by_stage: dict[str, Any] = {}
    for stage, stage_df in frame.groupby("stage_key", sort=False):
        labels = stage_df[target].to_numpy(dtype=int)
        by_stage[str(stage)] = {
            "support": int(len(stage_df)),
            "positiveCount": int(labels.sum()),
            "positiveRate": float(labels.mean()) if len(labels) else None,
        }
    ordered = sorted(by_stage, key=lambda stage: STAGE_ORDER.get(stage, 99))
    transitions = []
    for left, right in zip(ordered[:-1], ordered[1:]):
        left_rate = by_stage[left]["positiveRate"]
        right_rate = by_stage[right]["positiveRate"]
        transitions.append({
            "stageA": left,
            "stageB": right,
            "labelPositiveRateDelta": None if left_rate is None or right_rate is None else float(right_rate - left_rate),
        })
    return {
        "byStage": by_stage,
        "adjacentTransitions": transitions,
    }


def prediction_stage_summary(sample: pd.DataFrame, y_true: np.ndarray, y_prob: np.ndarray, threshold: float) -> dict[str, Any]:
    by_stage: dict[str, Any] = {}
    for stage in sorted(sample["stage_key"].astype(str).unique(), key=lambda value: STAGE_ORDER.get(value, 99)):
        mask = sample["stage_key"].astype(str).to_numpy() == stage
        by_stage[stage] = group_metrics(y_true[mask], y_prob[mask], threshold)
    transitions = []
    for left, right in zip(by_stage.keys(), list(by_stage.keys())[1:]):
        transitions.append({
            "stageA": left,
            "stageB": right,
            "meanProbabilityDelta": None
            if by_stage[left]["meanProbability"] is None or by_stage[right]["meanProbability"] is None
            else float(by_stage[right]["meanProbability"] - by_stage[left]["meanProbability"]),
            "predictedPositiveRateDelta": None
            if by_stage[left]["predictedPositiveRate"] is None or by_stage[right]["predictedPositiveRate"] is None
            else float(by_stage[right]["predictedPositiveRate"] - by_stage[left]["predictedPositiveRate"]),
        })
    return {
        "byStage": by_stage,
        "adjacentTransitions": transitions,
    }


def evaluate_head(
    train: pd.DataFrame,
    test: pd.DataFrame,
    cols: list[str],
    target: str,
    max_train_rows: int,
    max_test_rows: int,
    seed_offset: int,
    threshold: float,
    min_support: int,
) -> dict[str, Any]:
    train_sample = stratified_sample(train, target, max_train_rows, DETERMINISTIC_SEED + seed_offset)
    test_sample = stratified_sample(test, target, max_test_rows, DETERMINISTIC_SEED + 1000 + seed_offset)
    if train_sample[target].nunique() < 2 or test_sample[target].nunique() < 2:
        return {
            "skipped": True,
            "reason": "Target has fewer than two classes in train or test sample",
            "trainPopulation": target_summary(train, target),
            "testPopulation": target_summary(test, target),
        }

    X_train = train_sample[cols].to_numpy(dtype=float)
    y_train = train_sample[target].to_numpy(dtype=int)
    X_test = test_sample[cols].to_numpy(dtype=float)
    y_test = test_sample[target].to_numpy(dtype=int)

    lr = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=DETERMINISTIC_SEED + seed_offset)
    lr.fit(X_train, y_train)
    lr_probs = lr.predict_proba(X_test)[:, 1]

    tabpfn = TabPFNClassifier(
        device="cpu",
        ignore_pretraining_limits=True,
        random_state=DETERMINISTIC_SEED + seed_offset,
    )
    tabpfn.fit(X_train, y_train)
    tabpfn_probs = tabpfn.predict_proba(X_test)[:, 1]

    enriched = enriched_sample(test_sample)
    dimensions = [
        "scenario_family",
        "section_code",
        "semester_bucket",
        "stage_key",
        "attendance_band",
        "backlog_pressure_band",
        "prerequisite_pressure_band",
    ]
    tabpfn_fairness = {
        dimension: fairness_for_dimension(enriched, y_test, tabpfn_probs, dimension, threshold, min_support)
        for dimension in dimensions
    }
    lr_fairness = {
        dimension: fairness_for_dimension(enriched, y_test, lr_probs, dimension, threshold, min_support)
        for dimension in dimensions
    }
    return {
        "skipped": False,
        "trainPopulation": target_summary(train, target),
        "testPopulation": target_summary(test, target),
        "trainSample": target_summary(train_sample, target),
        "testSample": target_summary(test_sample, target),
        "Logistic_Regression": {
            "metrics": metrics_for(y_test, lr_probs),
            "fairness": lr_fairness,
            "temporalPredictionSummary": prediction_stage_summary(enriched, y_test, lr_probs, threshold),
        },
        "TabPFN_3": {
            "metrics": metrics_for(y_test, tabpfn_probs),
            "fairness": tabpfn_fairness,
            "temporalPredictionSummary": prediction_stage_summary(enriched, y_test, tabpfn_probs, threshold),
        },
        "populationTemporalLabelSummary": stage_population_summary(test, target),
    }


def run_sidecars(
    features_csv: Path,
    max_train_rows: int,
    max_test_rows: int,
    threshold: float,
    min_support: int,
    output_path: Path,
) -> dict[str, Any]:
    df = pd.read_csv(features_csv)
    cols = feature_cols(df)
    contract = feature_contract_report(df, cols)
    if not contract["passed"]:
        raise ValueError(f"Feature contract failed: {json.dumps(contract, indent=2)}")
    train = df[df["split"] == "train"].copy()
    test = df[df["split"] == "test"].copy()
    if train.empty or test.empty:
        raise ValueError("Expected governed manifest split rows with non-empty train and test partitions")

    heads: dict[str, Any] = {}
    for index, (target, label) in enumerate(HEAD_TARGETS.items()):
        print(f"[tabpfn-sidecars] evaluating {label} ({target})", file=sys.stderr)
        heads[target] = evaluate_head(
            train,
            test,
            cols,
            target,
            max_train_rows,
            max_test_rows,
            seed_offset=index * 17,
            threshold=threshold,
            min_support=min_support,
        )

    result = {
        "metadata": {
            "featuresCsv": str(features_csv),
            "featuresCsvSha256": sha256_file(features_csv),
            "splitProtocol": "governed-manifest train/test split; no random row k-fold",
            "splitSummary": split_summary(df),
            "maxTrainRowsPerHead": max_train_rows,
            "maxTestRowsPerHead": max_test_rows,
            "threshold": threshold,
            "minSupport": min_support,
            "fairnessLimits": FAIRNESS_LIMITS,
            "seed": DETERMINISTIC_SEED,
            "pythonVersion": sys.version,
            "tabpfnPackageVersion": getattr(tabpfn_module, "__version__", "unknown"),
            "featureContract": contract,
            "claimBoundary": "Challenger-model sidecar only. It does not promote TabPFN to serving and does not prove real-world fairness without approved real subgroup data.",
        },
        "heads": heads,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    print(f"[tabpfn-sidecars] wrote {output_path}")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Governed AirMentor TabPFN fairness and temporal sidecars")
    parser.add_argument("features_csv", type=Path)
    parser.add_argument("--max-train-rows", type=int, default=2000)
    parser.add_argument("--max-test-rows", type=int, default=1000)
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--min-support", type=int, default=50)
    parser.add_argument("--output", type=Path, default=Path("output/proof-coverage/tabpfn-fairness-temporal-sidecars.json"))
    args = parser.parse_args()
    run_sidecars(
        args.features_csv,
        args.max_train_rows,
        args.max_test_rows,
        args.threshold,
        args.min_support,
        args.output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
