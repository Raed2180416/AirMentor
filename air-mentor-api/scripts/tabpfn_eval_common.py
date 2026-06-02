from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


DETERMINISTIC_SEED = 42
API_ROOT = Path(__file__).resolve().parents[1]
PROOF_RISK_MODEL_SOURCE = API_ROOT / "src/lib/proof-risk-model.ts"
REQUIRED_FEATURE_SCHEMA_VERSION = "observable-risk-features-v6"
INTERVENTION_RESIDUAL_FEATURE_KEY = "interventionResidualRiskScaled"
HEAD_TARGETS = {
    "label_attendance": "Attendance Risk",
    "label_ce": "CE Risk",
    "label_see": "SEE Risk",
    "label_overall": "Overall Course Risk",
    "label_downstream": "Downstream Carryover Risk",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_json(blob: object) -> str:
    payload = json.dumps(blob, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


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
    return [single or double for single, double in re.findall(r"'([^']+)'|\"([^\"]+)\"", match.group(1))]


def feature_cols(df: pd.DataFrame) -> list[str]:
    return sorted([col for col in df.columns if col.startswith("feat_")], key=lambda col: int(col.split("_")[1]))


def feature_contract_report(df: pd.DataFrame, cols: list[str]) -> dict[str, Any]:
    version = read_ts_string_const(PROOF_RISK_MODEL_SOURCE, "RISK_FEATURE_SCHEMA_VERSION")
    keys = read_ts_const_string_array(PROOF_RISK_MODEL_SOURCE, "OBSERVABLE_FEATURE_KEYS")
    expected_cols = [f"feat_{idx}" for idx in range(len(keys))]
    return {
        "passed": version == REQUIRED_FEATURE_SCHEMA_VERSION and cols == expected_cols,
        "featureSchemaVersion": version,
        "requiredFeatureSchemaVersion": REQUIRED_FEATURE_SCHEMA_VERSION,
        "featureCount": len(cols),
        "expectedFeatureCount": len(keys),
        "featureKeyHash": sha256_json(keys),
        "featureKeys": keys,
        "missingFeatureColumns": [col for col in expected_cols if col not in df.columns],
        "unexpectedFeatureColumns": [col for col in cols if col not in expected_cols],
        "interventionResidualFeatureIndex": keys.index(INTERVENTION_RESIDUAL_FEATURE_KEY),
    }


def expected_calibration_error(y_true: np.ndarray, y_prob: np.ndarray, bins: int = 15) -> float:
    edges = np.linspace(0.0, 1.0, bins + 1)
    ece = 0.0
    for left, right in zip(edges[:-1], edges[1:]):
        mask = (y_prob >= left) & ((y_prob < right) if right < 1.0 else (y_prob <= right))
        if np.any(mask):
            ece += float(mask.mean()) * abs(float(y_true[mask].mean()) - float(y_prob[mask].mean()))
    return float(ece)


def stratified_sample(df: pd.DataFrame, target: str, max_rows: int, seed: int) -> pd.DataFrame:
    if max_rows <= 0 or len(df) <= max_rows:
        return df.copy()
    parts: list[pd.DataFrame] = []
    remaining = max_rows
    groups = list(df.groupby(target, sort=True))
    for index, (_, group) in enumerate(groups):
        if index == len(groups) - 1:
            take = min(len(group), remaining)
        else:
            take = min(len(group), max(1, round(max_rows * (len(group) / len(df)))))
        remaining -= take
        parts.append(group.sample(n=take, random_state=seed + index))
    sampled = pd.concat(parts).sample(frac=1.0, random_state=seed).reset_index(drop=True)
    return sampled


def split_summary(df: pd.DataFrame) -> dict[str, int]:
    if "split" not in df.columns:
        return {}
    return {str(key): int(value) for key, value in df["split"].value_counts().sort_index().items()}


def target_summary(df: pd.DataFrame, target: str) -> dict[str, Any]:
    values = df[target].to_numpy(dtype=int)
    return {
        "rowCount": int(len(values)),
        "positiveCount": int(values.sum()),
        "positiveRate": float(values.mean()) if len(values) else None,
    }
