import json
import os
import sys
import numpy as np
from catboost import CatBoostClassifier
from sklearn.metrics import (
    roc_auc_score,
    brier_score_loss,
    log_loss,
    average_precision_score,
)


def main():
    dump_path = os.path.join(
        os.path.dirname(__file__), "../output/proof-risk-model/dataset_dump.json"
    )
    if not os.path.exists(dump_path):
        print(f"Dataset dump not found at {dump_path}")
        sys.exit(1)

    with open(dump_path, "r") as f:
        dataset = json.load(f)

    feature_keys = dataset["featureKeys"]
    head_masks = dataset["headMasks"]
    rows = dataset["rows"]

    print(f"Loaded {len(rows)} rows with {len(feature_keys)} features.")

    # Prepare data
    X_train, y_train_masks = [], []
    X_val, y_val_masks = [], []
    X_test, y_test_masks = [], []

    for row in rows:
        split = row["split"]
        if split == "train":
            X_train.append(row["features"])
            y_train_masks.append(row["labelMask"])
        elif split == "validation":
            X_val.append(row["features"])
            y_val_masks.append(row["labelMask"])
        elif split == "test":
            X_test.append(row["features"])
            y_test_masks.append(row["labelMask"])

    X_train = np.array(X_train)
    X_val = np.array(X_val)
    X_test = np.array(X_test)

    print(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")

    results = {}

    for head_key, mask in head_masks.items():
        print(f"\nTraining CatBoost for {head_key}...")

        y_train = np.array([(m & mask) != 0 for m in y_train_masks]).astype(int)
        y_val = np.array([(m & mask) != 0 for m in y_val_masks]).astype(int)
        y_test = np.array([(m & mask) != 0 for m in y_test_masks]).astype(int)

        if sum(y_train) == 0 or sum(y_train) == len(y_train):
            print(
                f"Skipping {head_key} due to lack of positive/negative examples in train set."
            )
            continue

        model = CatBoostClassifier(
            iterations=500,
            learning_rate=0.05,
            depth=4,
            loss_function="Logloss",
            eval_metric="AUC",
            random_seed=42,
            verbose=False,
        )

        model.fit(X_train, y_train, eval_set=(X_val, y_val), early_stopping_rounds=50)

        # Evaluate on test set (or validation if test is empty)
        eval_X = X_test if len(X_test) > 0 else X_val
        eval_y = y_test if len(y_test) > 0 else y_val

        if len(eval_X) == 0:
            print(f"No evaluation data for {head_key}.")
            continue

        preds = model.predict_proba(eval_X)[:, 1]

        auc = roc_auc_score(eval_y, preds) if len(set(eval_y)) > 1 else 0.5
        brier = brier_score_loss(eval_y, preds)
        ll = log_loss(eval_y, preds) if len(set(eval_y)) > 1 else 0
        ap = average_precision_score(eval_y, preds) if len(set(eval_y)) > 1 else 0

        results[head_key] = {
            "rocAuc": auc,
            "brier": brier,
            "logLoss": ll,
            "averagePrecision": ap,
        }

        print(f"  ROC-AUC: {auc:.4f}")
        print(f"  Brier:   {brier:.4f}")
        print(f"  LogLoss: {ll:.4f}")
        print(f"  PR-AUC:  {ap:.4f}")

    out_path = os.path.join(
        os.path.dirname(__file__), "../output/proof-risk-model/catboost_results.json"
    )
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved CatBoost results to {out_path}")


if __name__ == "__main__":
    main()
