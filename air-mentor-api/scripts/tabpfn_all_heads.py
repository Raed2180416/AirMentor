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
    INTERVENTION_RESIDUAL_FEATURE_KEY,
    expected_calibration_error,
    feature_cols,
    feature_contract_report,
    sha256_file,
    split_summary,
    stratified_sample,
    target_summary,
)


def metrics_for(y_true: np.ndarray, y_prob: np.ndarray) -> dict[str, float | None]:
    if len(set(y_true.astype(int).tolist())) < 2:
        auc: float | None = None
    else:
        auc = float(roc_auc_score(y_true, y_prob))
    return {
        "AUC": auc,
        "Brier": float(brier_score_loss(y_true, y_prob)),
        "ECE": expected_calibration_error(y_true, y_prob),
    }


def evaluate_head(
    train: pd.DataFrame,
    test: pd.DataFrame,
    cols: list[str],
    target: str,
    intervention_feature_idx: int,
    max_train_rows: int,
    max_test_rows: int,
    seed_offset: int,
) -> dict[str, Any]:
    if target not in train.columns or target not in test.columns:
        raise ValueError(f"Target column not found: {target}")
    if train[target].nunique() < 2 or test[target].nunique() < 2:
        return {
            "skipped": True,
            "reason": "Target has fewer than two classes in train or test split",
            "trainPopulation": target_summary(train, target),
            "testPopulation": target_summary(test, target),
        }

    train_sample = stratified_sample(train, target, max_train_rows, DETERMINISTIC_SEED + seed_offset)
    test_sample = stratified_sample(test, target, max_test_rows, DETERMINISTIC_SEED + 1000 + seed_offset)
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

    counterfactual_test = test_sample.copy()
    counterfactual_test[cols[intervention_feature_idx]] = 0.0
    counterfactual_probs = tabpfn.predict_proba(counterfactual_test[cols].to_numpy(dtype=float))[:, 1]

    return {
        "skipped": False,
        "trainPopulation": target_summary(train, target),
        "testPopulation": target_summary(test, target),
        "trainSample": target_summary(train_sample, target),
        "testSample": target_summary(test_sample, target),
        "Logistic_Regression": metrics_for(y_test, lr_probs),
        "TabPFN_3": metrics_for(y_test, tabpfn_probs),
        "counterfactualFeaturePerturbation": {
            "model": "TabPFN_3",
            "featureKey": INTERVENTION_RESIDUAL_FEATURE_KEY,
            "setTo": 0.0,
            "meanOriginalProbability": float(np.mean(tabpfn_probs)),
            "meanPerturbedProbability": float(np.mean(counterfactual_probs)),
            "signedOriginalMinusPerturbedDelta": float(np.mean(tabpfn_probs - counterfactual_probs)),
            "interpretation": "Synthetic feature perturbation only; not real-world causal proof.",
        },
    }


def run_all_heads(features_csv: Path, max_train_rows: int, max_test_rows: int, output_path: Path) -> dict[str, Any]:
    df = pd.read_csv(features_csv)
    cols = feature_cols(df)
    contract = feature_contract_report(df, cols)
    if not contract["passed"]:
        raise ValueError(f"Feature contract failed: {json.dumps(contract, indent=2)}")

    train = df[df["split"] == "train"].copy()
    test = df[df["split"] == "test"].copy()
    if train.empty or test.empty:
        raise ValueError("Expected governed manifest split rows with non-empty train and test partitions")

    intervention_feature_idx = int(contract["interventionResidualFeatureIndex"])
    heads: dict[str, Any] = {}
    for index, (target, label) in enumerate(HEAD_TARGETS.items()):
        print(f"[tabpfn-all-heads] evaluating {label} ({target})", file=sys.stderr)
        heads[target] = evaluate_head(
            train,
            test,
            cols,
            target,
            intervention_feature_idx,
            max_train_rows,
            max_test_rows,
            seed_offset=index * 17,
        )

    result = {
        "metadata": {
            "featuresCsv": str(features_csv),
            "featuresCsvSha256": sha256_file(features_csv),
            "splitProtocol": "governed-manifest train/test split; no random row k-fold",
            "splitSummary": split_summary(df),
            "maxTrainRowsPerHead": max_train_rows,
            "maxTestRowsPerHead": max_test_rows,
            "seed": DETERMINISTIC_SEED,
            "pythonVersion": sys.version,
            "tabpfnPackageVersion": getattr(tabpfn_module, "__version__", "unknown"),
            "featureContract": contract,
        },
        "heads": heads,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    print(f"[tabpfn-all-heads] wrote {output_path}")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Governed AirMentor TabPFN all-head challenger bakeoff")
    parser.add_argument("features_csv", type=Path)
    parser.add_argument("--max-train-rows", type=int, default=2000)
    parser.add_argument("--max-test-rows", type=int, default=1000)
    parser.add_argument("--output", type=Path, default=Path("output/proof-coverage/tabpfn-all-heads-benchmark.json"))
    args = parser.parse_args()
    run_all_heads(args.features_csv, args.max_train_rows, args.max_test_rows, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
