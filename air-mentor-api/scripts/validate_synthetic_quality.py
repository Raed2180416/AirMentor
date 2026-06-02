#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score, brier_score_loss
    from sklearn.model_selection import train_test_split
    from sklearn.neighbors import NearestNeighbors
    from sklearn.preprocessing import StandardScaler
except ModuleNotFoundError:
    RandomForestClassifier = None
    LogisticRegression = None
    roc_auc_score = None
    brier_score_loss = None
    train_test_split = None
    NearestNeighbors = None
    StandardScaler = None


LABEL_COLS = {
    "attendanceRisk": "label_attendance",
    "ceRisk": "label_ce",
    "seeRisk": "label_see",
    "overallCourseRisk": "label_overall",
    "downstreamCarryoverRisk": "label_downstream",
}

REQUIRED_FEATURE_SCHEMA_VERSION = "observable-risk-features-v6"
REQUIRED_FEATURE_COUNT = 48
API_ROOT = Path(__file__).resolve().parents[1]
PROOF_RISK_MODEL_SOURCE = API_ROOT / "src/lib/proof-risk-model.ts"

STAGE_FORBIDDEN_FEATURES = {
    # Prerequisite pressure is prior-semester evidence and is intentionally
    # available at pre-TT1 for carryover risk. Current-semester assessment
    # outcomes still must remain neutral until their stage is observed.
    "pre-tt1": [5, 6, 7, 8, 9, 10, 14],
    "post-tt1": [6, 7, 8, 9],
    "post-tt2": [7, 8, 9],
    "post-assignments": [7],
}

STAGE_MISSING_FLAGS = {
    "pre-tt1": {39: 1, 40: 1, 41: 1, 42: 1, 43: 1},
    "post-tt1": {39: 0, 40: 1, 41: 1, 42: 1, 43: 1},
    "post-tt2": {39: 0, 40: 0, 41: 1, 42: 1, 43: 1},
    "post-assignments": {39: 0, 40: 0, 41: 1, 42: 0, 43: 0},
    "post-see": {39: 0, 40: 0, 42: 0, 43: 0},
}

NEUTRAL_FEATURE_VALUES = {
    14: 0.25,
    15: 0.35,
}

STAGE_PROGRESS_VALUES = {
    "pre-tt1": 0.0,
    "post-tt1": 0.25,
    "post-tt2": 0.5,
    "post-assignments": 0.75,
    "post-see": 1.0,
}

STAGE_INDICATOR_INDEXES = {
    "pre-tt1": 26,
    "post-tt1": 27,
    "post-tt2": 28,
    "post-assignments": 29,
    "post-see": 30,
}

V6_BACKLOG_FEATURES = {
    44: "activeBacklogCreditPressureScaled",
    45: "historicalBacklogBurdenScaled",
    46: "lowerYearBlockerPressureScaled",
    47: "backlogSensitivityScoreScaled",
}


def feature_cols(df: pd.DataFrame) -> list[str]:
    cols = [c for c in df.columns if c.startswith("feat_")]
    return sorted(cols, key=lambda c: int(c.split("_")[1]))


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
    feature_schema_version = read_ts_string_const(PROOF_RISK_MODEL_SOURCE, "RISK_FEATURE_SCHEMA_VERSION")
    feature_keys = read_ts_const_string_array(PROOF_RISK_MODEL_SOURCE, "OBSERVABLE_FEATURE_KEYS")
    expected_cols = [f"feat_{idx}" for idx in range(len(feature_keys))]
    missing_cols = [col for col in expected_cols if col not in df.columns]
    unexpected_cols = [col for col in cols if col not in expected_cols]
    exact_columns = cols == expected_cols
    exact_v6 = (
        feature_schema_version == REQUIRED_FEATURE_SCHEMA_VERSION
        and len(feature_keys) == REQUIRED_FEATURE_COUNT
        and exact_columns
    )
    return {
        "passed": exact_v6,
        "featureSchemaVersion": feature_schema_version,
        "requiredFeatureSchemaVersion": REQUIRED_FEATURE_SCHEMA_VERSION,
        "featureCount": len(cols),
        "expectedFeatureCount": len(feature_keys),
        "requiredFeatureCount": REQUIRED_FEATURE_COUNT,
        "featureColumns": cols,
        "expectedFeatureColumns": expected_cols,
        "missingFeatureColumns": missing_cols,
        "unexpectedFeatureColumns": unexpected_cols,
        "featureKeyHash": sha256_json(feature_keys),
        "featureKeys": feature_keys,
    }


def hellinger_distance(a: np.ndarray, b: np.ndarray, bins: int = 40) -> float:
    lo = float(min(np.nanmin(a), np.nanmin(b)))
    hi = float(max(np.nanmax(a), np.nanmax(b)))
    if not math.isfinite(lo) or not math.isfinite(hi) or abs(hi - lo) < 1e-12:
        return 0.0
    pa, edges = np.histogram(a, bins=bins, range=(lo, hi), density=False)
    pb, _ = np.histogram(b, bins=edges, density=False)
    pa = pa.astype(float) / max(float(pa.sum()), 1.0)
    pb = pb.astype(float) / max(float(pb.sum()), 1.0)
    return float(np.sqrt(np.sum((np.sqrt(pa) - np.sqrt(pb)) ** 2)) / np.sqrt(2.0))


def fidelity_report(reference: pd.DataFrame, candidate: pd.DataFrame, cols: list[str]) -> dict[str, Any]:
    shared = [c for c in cols if c in reference.columns and c in candidate.columns]
    per_feature = {
        c: hellinger_distance(reference[c].dropna().to_numpy(), candidate[c].dropna().to_numpy())
        for c in shared
    }
    ref_corr = reference[shared].corr(numeric_only=True).fillna(0.0).to_numpy()
    cand_corr = candidate[shared].corr(numeric_only=True).fillna(0.0).to_numpy()
    upper = np.triu_indices(len(shared), k=1)
    corr_diff = np.abs(ref_corr[upper] - cand_corr[upper]) if len(shared) > 1 else np.array([])
    return {
        "featureCount": len(shared),
        "meanHellinger": float(np.mean(list(per_feature.values()))) if per_feature else None,
        "maxHellinger": float(np.max(list(per_feature.values()))) if per_feature else None,
        "meanPairwiseCorrelationDifference": float(np.mean(corr_diff)) if corr_diff.size else None,
        "maxPairwiseCorrelationDifference": float(np.max(corr_diff)) if corr_diff.size else None,
        "perFeatureHellinger": per_feature,
    }


def distinguishability_auc(reference: pd.DataFrame, candidate: pd.DataFrame, cols: list[str]) -> dict[str, Any]:
    shared = [c for c in cols if c in reference.columns and c in candidate.columns]
    if RandomForestClassifier is None or train_test_split is None or roc_auc_score is None:
        return {"available": False, "reason": "sklearn not installed"}
    if len(reference) < 20 or len(candidate) < 20 or not shared:
        return {"available": False, "reason": "insufficient rows or features"}
    n = min(len(reference), len(candidate), 50_000)
    ref = reference.sample(n=n, random_state=42)[shared].to_numpy(dtype=float)
    cand = candidate.sample(n=n, random_state=43)[shared].to_numpy(dtype=float)
    X = np.vstack([ref, cand])
    y = np.concatenate([np.zeros(n), np.ones(n)])
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.35, random_state=42, stratify=y)
    clf = RandomForestClassifier(n_estimators=120, max_depth=8, random_state=42, n_jobs=2)
    clf.fit(X_train, y_train)
    prob = clf.predict_proba(X_test)[:, 1]
    return {
        "available": True,
        "auc": float(roc_auc_score(y_test, prob)),
        "interpretation": "0.5 is indistinguishable; higher means lower synthetic fidelity",
    }


def train_eval_logistic(train_df: pd.DataFrame, test_df: pd.DataFrame, cols: list[str], label: str) -> dict[str, Any] | None:
    if LogisticRegression is None or StandardScaler is None or roc_auc_score is None or brier_score_loss is None:
        return {"available": False, "reason": "sklearn not installed"}
    if label not in train_df.columns or label not in test_df.columns:
        return None
    y_train = train_df[label].to_numpy(dtype=int)
    y_test = test_df[label].to_numpy(dtype=int)
    if len(set(y_train.tolist())) < 2 or len(set(y_test.tolist())) < 2:
        return None
    scaler = StandardScaler()
    X_train = scaler.fit_transform(train_df[cols].to_numpy(dtype=float))
    X_test = scaler.transform(test_df[cols].to_numpy(dtype=float))
    model = LogisticRegression(C=1.0, solver="lbfgs", class_weight="balanced", max_iter=1000, random_state=42)
    model.fit(X_train, y_train)
    prob = model.predict_proba(X_test)[:, 1]
    return {
        "rocAuc": float(roc_auc_score(y_test, prob)),
        "brier": float(brier_score_loss(y_test, prob)),
        "support": int(len(y_test)),
        "positives": int(y_test.sum()),
    }


def utility_report(synthetic: pd.DataFrame, real: pd.DataFrame | None, cols: list[str]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    synth_train = synthetic[synthetic.get("split", "") == "train"] if "split" in synthetic.columns else synthetic.sample(frac=0.7, random_state=42)
    synth_test = synthetic[synthetic.get("split", "") == "test"] if "split" in synthetic.columns else synthetic.drop(synth_train.index)
    result["syntheticTrainSyntheticTest"] = {
        head: train_eval_logistic(synth_train, synth_test, cols, label)
        for head, label in LABEL_COLS.items()
    }
    if real is not None:
        real_train, real_test = train_test_split(real, test_size=0.35, random_state=42)
        result["trainRealTestReal"] = {
            head: train_eval_logistic(real_train, real_test, cols, label)
            for head, label in LABEL_COLS.items()
        }
        result["trainSyntheticTestReal"] = {
            head: train_eval_logistic(synthetic, real_test, cols, label)
            for head, label in LABEL_COLS.items()
        }
    return result


def privacy_proxy_report(synthetic: pd.DataFrame, real: pd.DataFrame | None, cols: list[str]) -> dict[str, Any]:
    if real is None:
        return {"available": False, "reason": "real reference data not supplied"}
    if StandardScaler is None or NearestNeighbors is None:
        return {"available": False, "reason": "sklearn not installed"}
    shared = [c for c in cols if c in real.columns and c in synthetic.columns]
    if len(shared) < 2 or len(real) < 10 or len(synthetic) < 10:
        return {"available": False, "reason": "insufficient rows or shared features"}
    n_real = min(len(real), 20_000)
    n_synth = min(len(synthetic), 20_000)
    real_x = real.sample(n=n_real, random_state=42)[shared].to_numpy(dtype=float)
    synth_x = synthetic.sample(n=n_synth, random_state=43)[shared].to_numpy(dtype=float)
    scaler = StandardScaler()
    combined = scaler.fit_transform(np.vstack([real_x, synth_x]))
    real_scaled = combined[:n_real]
    synth_scaled = combined[n_real:]
    nn = NearestNeighbors(n_neighbors=1)
    nn.fit(synth_scaled)
    distances, _ = nn.kneighbors(real_scaled)
    distances = distances[:, 0]
    return {
        "available": True,
        "medianNearestSyntheticDistance": float(np.median(distances)),
        "p01NearestSyntheticDistance": float(np.quantile(distances, 0.01)),
        "p05NearestSyntheticDistance": float(np.quantile(distances, 0.05)),
        "recordsWithDistanceBelow0_05": int((distances < 0.05).sum()),
        "interpretation": "Lower distances indicate higher memorization/linkability concern; this is a proxy, not a full privacy audit.",
    }


def temporal_leakage_report(df: pd.DataFrame) -> dict[str, Any]:
    if "stage_key" not in df.columns:
        return {"available": False, "reason": "stage_key missing"}
    violations: dict[str, Any] = {}
    for stage, feature_indexes in STAGE_FORBIDDEN_FEATURES.items():
        stage_df = df[df["stage_key"] == stage]
        if stage_df.empty:
            continue
        feature_violations = {}
        for idx in feature_indexes:
            col = f"feat_{idx}"
            if col in stage_df.columns:
                expected = NEUTRAL_FEATURE_VALUES.get(idx, 0.5)
                non_neutral = int((np.abs(stage_df[col].to_numpy(dtype=float) - expected) > 1e-9).sum())
                if non_neutral:
                    feature_violations[col] = {"expected": expected, "mismatches": non_neutral}
        flag_violations = {}
        for idx, expected in STAGE_MISSING_FLAGS.get(stage, {}).items():
            col = f"feat_{idx}"
            if col in stage_df.columns:
                mismatch = int((stage_df[col].astype(int) != expected).sum())
                if mismatch:
                    flag_violations[col] = {"expected": expected, "mismatches": mismatch}
        if feature_violations or flag_violations:
            violations[stage] = {"featureViolations": feature_violations, "flagViolations": flag_violations}
    return {
        "available": True,
        "passed": not violations,
        "violations": violations,
    }


def v6_semantic_report(df: pd.DataFrame, cols: list[str]) -> dict[str, Any]:
    if "stage_key" not in df.columns:
        return {"available": False, "passed": False, "reason": "stage_key missing"}
    violations: dict[str, Any] = {}
    progress_violations: dict[str, Any] = {}
    if "feat_25" in df.columns:
        for stage, expected in STAGE_PROGRESS_VALUES.items():
            stage_df = df[df["stage_key"] == stage]
            if stage_df.empty:
                continue
            mismatches = int((np.abs(stage_df["feat_25"].to_numpy(dtype=float) - expected) > 1e-9).sum())
            if mismatches:
                progress_violations[stage] = {"expected": expected, "mismatches": mismatches}
    else:
        progress_violations["missing"] = {"feature": "feat_25"}
    if progress_violations:
        violations["stageProgress"] = progress_violations

    indicator_violations: dict[str, Any] = {}
    for stage, active_idx in STAGE_INDICATOR_INDEXES.items():
        stage_df = df[df["stage_key"] == stage]
        if stage_df.empty:
            continue
        stage_mismatches: dict[str, int] = {}
        for idx in STAGE_INDICATOR_INDEXES.values():
            col = f"feat_{idx}"
            if col not in stage_df.columns:
                stage_mismatches[col] = len(stage_df)
                continue
            expected = 1.0 if idx == active_idx else 0.0
            mismatches = int((np.abs(stage_df[col].to_numpy(dtype=float) - expected) > 1e-9).sum())
            if mismatches:
                stage_mismatches[col] = mismatches
        if stage_mismatches:
            indicator_violations[stage] = stage_mismatches
    if indicator_violations:
        violations["stageIndicators"] = indicator_violations

    see_missing_report: dict[str, Any] = {"available": "feat_41" in df.columns and "feat_7" in df.columns}
    if see_missing_report["available"]:
        post_see = df[df["stage_key"] == "post-see"]
        pre_outcome = df[df["stage_key"].isin(["pre-tt1", "post-tt1", "post-tt2", "post-assignments"])]
        post_values = sorted(float(v) for v in post_see["feat_41"].dropna().unique().tolist())
        invalid_post_values = [v for v in post_values if v not in {0.0, 1.0}]
        missing_post_see = post_see[post_see["feat_41"].astype(float) == 1.0]
        present_post_see = post_see[post_see["feat_41"].astype(float) == 0.0]
        missing_see_neutral_mismatches = int((np.abs(missing_post_see["feat_7"].to_numpy(dtype=float) - 0.5) > 1e-9).sum()) if not missing_post_see.empty else 0
        pre_outcome_mismatches = int((pre_outcome["feat_41"].astype(float) != 1.0).sum()) if not pre_outcome.empty else 0
        see_missing_report.update({
            "passed": not invalid_post_values and missing_see_neutral_mismatches == 0 and pre_outcome_mismatches == 0,
            "postSeePresentRows": int(len(present_post_see)),
            "postSeeMissingRows": int(len(missing_post_see)),
            "postSeeValues": post_values,
            "invalidPostSeeValues": invalid_post_values,
            "missingSeeNeutralRiskMismatches": missing_see_neutral_mismatches,
            "preOutcomeSeeMissingMismatches": pre_outcome_mismatches,
        })
    else:
        see_missing_report["passed"] = False
    if not see_missing_report.get("passed"):
        violations["seeMissingSemantics"] = see_missing_report

    backlog_report: dict[str, Any] = {}
    backlog_passed = True
    for idx, name in V6_BACKLOG_FEATURES.items():
        col = f"feat_{idx}"
        if col not in df.columns:
            backlog_report[name] = {"available": False}
            backlog_passed = False
            continue
        values = df[col].to_numpy(dtype=float)
        out_of_range = int(((values < -1e-9) | (values > 1.0 + 1e-9) | ~np.isfinite(values)).sum())
        backlog_report[name] = {
            "available": True,
            "min": float(np.nanmin(values)) if len(values) else None,
            "max": float(np.nanmax(values)) if len(values) else None,
            "mean": float(np.nanmean(values)) if len(values) else None,
            "uniqueCount": int(pd.Series(values).nunique(dropna=True)),
            "outOfRangeCount": out_of_range,
        }
        backlog_passed = backlog_passed and out_of_range == 0
    if "feat_44" in df.columns:
        backlog_report["activeCreditsAtOrAbovePromotionLimitProxyRows"] = int((df["feat_44"].astype(float) >= 1.0).sum())
    if not backlog_passed:
        violations["backlogCreditFeatures"] = backlog_report

    non_finite_count = 0
    if cols:
        matrix = df[cols].to_numpy(dtype=float)
        non_finite_count = int((~np.isfinite(matrix)).sum())
    if non_finite_count:
        violations["nonFiniteFeatureValues"] = {"count": non_finite_count}

    return {
        "available": True,
        "passed": not violations,
        "stageProgress": {"passed": "stageProgress" not in violations, "violations": progress_violations},
        "seeMissingSemantics": see_missing_report,
        "backlogCreditFeatures": {"passed": backlog_passed, "features": backlog_report},
        "nonFiniteFeatureValues": non_finite_count,
        "violations": violations,
    }


def temporal_split_evaluation(df: pd.DataFrame, cols: list[str]) -> dict[str, Any]:
    if "stage_key" not in df.columns:
        return {"available": False, "reason": "stage_key missing"}
    
    train_stages = ["pre-tt1", "post-tt1", "post-tt2"]
    test_stages = ["post-assignments", "post-see"]
    
    train_df = df[df["stage_key"].isin(train_stages)]
    test_df = df[df["stage_key"].isin(test_stages)]
    
    if train_df.empty or test_df.empty:
        return {"available": False, "reason": "insufficient temporal stages"}
        
    result = {
        head: train_eval_logistic(train_df, test_df, cols, label)
        for head, label in LABEL_COLS.items()
    }
    return {"available": True, "results": result, "train_size": len(train_df), "test_size": len(test_df)}

def causal_intervention_test(df: pd.DataFrame, cols: list[str]) -> dict[str, Any]:
    if LogisticRegression is None or StandardScaler is None:
        return {"available": False, "reason": "sklearn not installed"}
        
    label = "label_overall"
    if label not in df.columns or "feat_31" not in cols:
        return {"available": False, "reason": "feat_31 missing or label_overall missing"}
        
    y = df[label].to_numpy(dtype=int)
    if len(set(y.tolist())) < 2: return {"available": False, "reason": "single class"}
    
    scaler = StandardScaler()
    X = scaler.fit_transform(df[cols].to_numpy(dtype=float))
    
    model = LogisticRegression(C=1.0, solver="lbfgs", class_weight="balanced", max_iter=1000, random_state=42)
    model.fit(X, y)
    
    orig_prob = model.predict_proba(X)[:, 1]
    high_risk_idx = np.where(orig_prob > 0.6)[0]
    
    if len(high_risk_idx) == 0:
        return {"available": False, "reason": "no high risk students found"}
        
    df_intervened = df.copy()
    df_intervened["feat_31"] = 1.0 # Max intervention response
    
    X_intervened = scaler.transform(df_intervened[cols].to_numpy(dtype=float))
    new_prob = model.predict_proba(X_intervened)[:, 1]
    
    delta = orig_prob[high_risk_idx] - new_prob[high_risk_idx]
    
    return {
        "available": True,
        "highRiskCount": int(len(high_risk_idx)),
        "meanCausalDelta": float(np.mean(delta)),
        "maxCausalDelta": float(np.max(delta))
    }

def algorithmic_fairness_report(df: pd.DataFrame, cols: list[str]) -> dict[str, Any]:
    if LogisticRegression is None or StandardScaler is None:
        return {"available": False, "reason": "sklearn not installed"}
        
    label = "label_overall"
    if label not in df.columns:
        return {"available": False, "reason": "label_overall missing"}
        
    y = df[label].to_numpy(dtype=int)
    if len(set(y.tolist())) < 2: return {"available": False, "reason": "single class"}
    
    X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
        df[cols].to_numpy(dtype=float), y, np.arange(len(df)), test_size=0.35, random_state=42, stratify=y
    )
    
    df_test = df.iloc[idx_test]
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    model = LogisticRegression(C=1.0, solver="lbfgs", class_weight="balanced", max_iter=1000, random_state=42)
    model.fit(X_train_scaled, y_train)
    preds = model.predict(X_test_scaled)
    
    results = {}
    for subgroup_name, mask in [
        ("Baseline", np.ones(len(df_test), dtype=bool)),
        ("Hacker (Low Attendance)", df_test["feat_0"].to_numpy(dtype=float) < 0.4 if "feat_0" in df_test.columns else np.zeros(len(df_test), dtype=bool)),
        ("Sustained Friction (High Backlog)", df_test["feat_4"].to_numpy(dtype=float) >= 3 if "feat_4" in df_test.columns else np.zeros(len(df_test), dtype=bool))
    ]:
        if not mask.any(): continue
        
        y_sub = y_test[mask]
        p_sub = preds[mask]
        
        tp = ((p_sub == 1) & (y_sub == 1)).sum()
        fp = ((p_sub == 1) & (y_sub == 0)).sum()
        fn = ((p_sub == 0) & (y_sub == 1)).sum()
        tn = ((p_sub == 0) & (y_sub == 0)).sum()
        
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        fnr = fn / (fn + tp) if (fn + tp) > 0 else 0
        
        results[subgroup_name] = {
            "size": int(mask.sum()),
            "FPR": float(fpr),
            "FNR": float(fnr)
        }
        
    return {"available": True, "subgroups": results}


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate AirMentor synthetic tabular data quality")
    parser.add_argument("synthetic_csv")
    parser.add_argument("--real-csv", default=None)
    parser.add_argument("--output-json", default=None)
    args = parser.parse_args()

    synthetic_path = Path(args.synthetic_csv)
    if not synthetic_path.exists():
        print(f"ERROR: synthetic CSV not found: {synthetic_path}", file=sys.stderr)
        return 1
    synthetic = pd.read_csv(synthetic_path)
    real = pd.read_csv(args.real_csv) if args.real_csv else None
    cols = feature_cols(synthetic)
    if real is not None:
        cols = [c for c in cols if c in real.columns]
    contract = feature_contract_report(synthetic, feature_cols(synthetic))
    v6_semantics = v6_semantic_report(synthetic, feature_cols(synthetic))
    temporal = temporal_leakage_report(synthetic)
    temporal_eval = temporal_split_evaluation(synthetic, cols)
    causal_intervention = causal_intervention_test(synthetic, cols)
    fairness = algorithmic_fairness_report(synthetic, cols)

    report = {
        "syntheticCsv": str(synthetic_path),
        "realCsv": args.real_csv,
        "syntheticOnly": True,
        "featureSchemaVersion": contract["featureSchemaVersion"],
        "featureSchema": {
            "name": contract["featureSchemaVersion"],
            "featureCount": contract["featureCount"],
            "featureKeyHash": contract["featureKeyHash"],
        },
        "rowCounts": {
            "synthetic": int(len(synthetic)),
            "real": int(len(real)) if real is not None else None,
        },
        "featureCount": len(cols),
        "featureContract": contract,
        "temporalLeakage": temporal,
        "v6SemanticChecks": v6_semantics,
        "syntheticSplitFidelity": fidelity_report(
            synthetic[synthetic["split"] == "train"] if "split" in synthetic.columns else synthetic.sample(frac=0.7, random_state=42),
            synthetic[synthetic["split"] == "test"] if "split" in synthetic.columns else synthetic.sample(frac=0.3, random_state=43),
            cols,
        ),
        "realSyntheticFidelity": fidelity_report(real, synthetic, cols) if real is not None else {"available": False, "reason": "real reference data not supplied"},
        "distinguishability": distinguishability_auc(real, synthetic, cols) if real is not None else {"available": False, "reason": "real reference data not supplied"},
        "utility": utility_report(synthetic, real, cols),
        "privacyProxy": privacy_proxy_report(synthetic, real, cols),
        "sotaValidation": {
            "temporalEvaluation": temporal_eval,
            "causalInterventionTesting": causal_intervention,
            "algorithmicFairness": fairness
        },
        "claimBoundary": "Without real data, this report supports internal consistency only. Realism and deployment utility require real-vs-synthetic fidelity, TRTR/TSTR, distinguishability, and privacy review.",
    }

    text = json.dumps(report, indent=2, sort_keys=True)
    if args.output_json:
        Path(args.output_json).write_text(text + "\n", encoding="utf-8")
    print(text)
    if contract.get("passed") is not True or temporal.get("passed") is not True or v6_semantics.get("passed") is not True:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
