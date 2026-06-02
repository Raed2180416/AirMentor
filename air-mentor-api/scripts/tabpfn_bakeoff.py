#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
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


def run_bakeoff(
    features_csv: Path,
    target: str,
    max_train_rows: int,
    max_test_rows: int,
    output_path: Path,
) -> dict[str, Any]:
    df = pd.read_csv(features_csv)
    cols = feature_cols(df)
    contract = feature_contract_report(df, cols)
    if not contract["passed"]:
        raise ValueError(f"Feature contract failed: {json.dumps(contract, indent=2)}")
    if target not in df.columns:
        raise ValueError(f"Target column not found: {target}")

    train = df[df["split"] == "train"].copy()
    test = df[df["split"] == "test"].copy()
    if train.empty or test.empty:
        raise ValueError("Expected governed manifest split rows with non-empty train and test partitions")

    train_sample = stratified_sample(train, target, max_train_rows, DETERMINISTIC_SEED)
    test_sample = stratified_sample(test, target, max_test_rows, DETERMINISTIC_SEED + 1000)

    X_train = train_sample[cols].to_numpy(dtype=float)
    y_train = train_sample[target].to_numpy(dtype=int)
    X_test = test_sample[cols].to_numpy(dtype=float)
    y_test = test_sample[target].to_numpy(dtype=int)

    lr = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=DETERMINISTIC_SEED)
    lr.fit(X_train, y_train)
    lr_probs = lr.predict_proba(X_test)[:, 1]

    tabpfn = TabPFNClassifier(device="cpu", ignore_pretraining_limits=True, random_state=DETERMINISTIC_SEED)
    tabpfn.fit(X_train, y_train)
    tabpfn_probs = tabpfn.predict_proba(X_test)[:, 1]

    intervention_feature_idx = int(contract["interventionResidualFeatureIndex"])
    counterfactual_test = test_sample.copy()
    counterfactual_test[cols[intervention_feature_idx]] = 0.0
    counterfactual_probs = tabpfn.predict_proba(counterfactual_test[cols].to_numpy(dtype=float))[:, 1]

    result: dict[str, Any] = {
        "metadata": {
            "featuresCsv": str(features_csv),
            "featuresCsvSha256": sha256_file(features_csv),
            "splitProtocol": "governed-manifest train/test split; no random row k-fold",
            "splitSummary": split_summary(df),
            "target": target,
            "targetLabel": HEAD_TARGETS.get(target, target),
            "trainPopulation": target_summary(train, target),
            "testPopulation": target_summary(test, target),
            "trainSample": target_summary(train_sample, target),
            "testSample": target_summary(test_sample, target),
            "maxTrainRows": max_train_rows,
            "maxTestRows": max_test_rows,
            "seed": DETERMINISTIC_SEED,
            "featureContract": contract,
        },
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

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    print(f"[tabpfn-bakeoff] wrote {output_path}")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Governed AirMentor TabPFN challenger bakeoff")
    parser.add_argument("features_csv", type=Path)
    parser.add_argument("--target", default="label_overall", choices=sorted(HEAD_TARGETS.keys()))
    parser.add_argument("--max-train-rows", type=int, default=20000)
    parser.add_argument("--max-test-rows", type=int, default=5000)
    parser.add_argument("--output", type=Path, default=Path("output/proof-coverage/tabpfn-bakeoff.json"))
    args = parser.parse_args()
    run_bakeoff(args.features_csv, args.target, args.max_train_rows, args.max_test_rows, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
