"""
Fairness audit helpers for AirMentor ML training.

Demographic parity and equalized-odds checks across groups.
Designed to be a warning layer, not a hard gate, until the corpus
includes explicit demographic metadata (section, gender, archetype).
"""

from __future__ import annotations

import numpy as np


def compute_fairness_metrics(
    predictions: np.ndarray,
    labels: np.ndarray,
    demographic_groups: dict[str, np.ndarray],
    threshold: float = 0.5,
) -> dict[str, dict]:
    """
    Compute fairness metrics for each demographic group.

    predictions: array of probabilities in [0, 1]
    labels: array of 0/1
    demographic_groups: dict of {group_name: boolean membership array}
    threshold: classification threshold for equalized-odds computation

    Returns per-group:
        - demographic_parity_gap: |P(Ŷ=1|A=0) - P(Ŷ=1|A=1)|
        - tpr_gap: |TPR(A=0) - TPR(A=1)|
        - fpr_gap: |FPR(A=0) - FPR(A=1)|
        - brier_gap: |Brier(A=0) - Brier(A=1)|
        - passes_thresholds: bool
    """
    results: dict[str, dict] = {}
    for group_name, membership in demographic_groups.items():
        in_group = membership == 1
        out_group = membership == 0

        if in_group.sum() == 0 or out_group.sum() == 0:
            results[group_name] = {
                "demographic_parity_gap": None,
                "tpr_gap": None,
                "fpr_gap": None,
                "brier_gap": None,
                "passes_thresholds": True,
                "note": "empty_group",
            }
            continue

        # Demographic parity: difference in mean predicted positive rate
        in_pos_rate = float(predictions[in_group].mean())
        out_pos_rate = float(predictions[out_group].mean())
        dp_gap = abs(in_pos_rate - out_pos_rate)

        # Equalized odds at threshold
        in_preds_binary = (predictions[in_group] > threshold).astype(int)
        out_preds_binary = (predictions[out_group] > threshold).astype(int)
        in_labels = labels[in_group]
        out_labels = labels[out_group]

        in_tp = int((in_preds_binary & in_labels).sum())
        in_fn = int((in_labels == 1).sum())
        in_fp = int((in_preds_binary & (in_labels == 0)).sum())
        in_tn = int(((in_preds_binary == 0) & (in_labels == 0)).sum())

        out_tp = int((out_preds_binary & out_labels).sum())
        out_fn = int((out_labels == 1).sum())
        out_fp = int((out_preds_binary & (out_labels == 0)).sum())
        out_tn = int(((out_preds_binary == 0) & (out_labels == 0)).sum())

        in_tpr = in_tp / (in_tp + in_fn) if (in_tp + in_fn) > 0 else 0.0
        out_tpr = out_tp / (out_tp + out_fn) if (out_tp + out_fn) > 0 else 0.0
        tpr_gap = abs(in_tpr - out_tpr)

        in_fpr = in_fp / (in_fp + in_tn) if (in_fp + in_tn) > 0 else 0.0
        out_fpr = out_fp / (out_fp + out_tn) if (out_fp + out_tn) > 0 else 0.0
        fpr_gap = abs(in_fpr - out_fpr)

        # Calibration by group (Brier score)
        in_brier = float(((predictions[in_group] - labels[in_group]) ** 2).mean())
        out_brier = float(((predictions[out_group] - labels[out_group]) ** 2).mean())
        brier_gap = abs(in_brier - out_brier)

        results[group_name] = {
            "demographic_parity_gap": round(dp_gap, 4),
            "tpr_gap": round(tpr_gap, 4),
            "fpr_gap": round(fpr_gap, 4),
            "brier_gap": round(brier_gap, 4),
            "passes_thresholds": all([
                dp_gap < 0.05,
                tpr_gap < 0.05,
                fpr_gap < 0.05,
                brier_gap < 0.02,
            ]),
        }

    return results
