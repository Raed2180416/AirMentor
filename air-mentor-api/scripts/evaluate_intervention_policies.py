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
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import brier_score_loss, roc_auc_score
    from sklearn.preprocessing import StandardScaler
except ModuleNotFoundError:
    LogisticRegression = None
    brier_score_loss = None
    roc_auc_score = None
    StandardScaler = None


DETERMINISTIC_SEED = 42
HEADS = ["attendanceRisk", "ceRisk", "seeRisk", "overallCourseRisk", "downstreamCarryoverRisk"]
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
INTERVENTION_PARAMS = {
    "attendanceRisk": {"uplift_attendance": 12.0, "uplift_ce": 3.0, "uplift_see": 2.0, "cost_days": 7},
    "ceRisk": {"uplift_attendance": 3.0, "uplift_ce": 8.0, "uplift_see": 4.0, "cost_days": 14},
    "seeRisk": {"uplift_attendance": 2.0, "uplift_ce": 4.0, "uplift_see": 10.0, "cost_days": 21},
    "overallCourseRisk": {"uplift_attendance": 5.0, "uplift_ce": 6.0, "uplift_see": 6.0, "cost_days": 14},
    "downstreamCarryoverRisk": {"uplift_attendance": 3.0, "uplift_ce": 5.0, "uplift_see": 5.0, "cost_days": 21},
}
CAPACITY_FRACTIONS = [0.01, 0.05, 0.10, 0.20, 0.40, 0.60, 0.80, 1.00]
CLAIM_BOUNDARY = (
    "Synthetic-only scenario-planning evidence. These results do not prove real-world "
    "intervention effectiveness. Real treated/untreated or randomized data is required "
    "before causal claims."
)


def stable_unit_interval(*parts: Any) -> float:
    payload = "::".join(str(p) for p in parts)
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]
    return int(digest, 16) / float(16**12 - 1)


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


def metric_brier(y_true: np.ndarray, prob: np.ndarray) -> float:
    if brier_score_loss is not None:
        return float(brier_score_loss(y_true, prob))
    return fallback_brier_score(y_true, prob)


def metric_auc(y_true: np.ndarray, prob: np.ndarray) -> float | None:
    if len(set(y_true.astype(int).tolist())) < 2:
        return None
    if roc_auc_score is not None:
        return float(roc_auc_score(y_true, prob))
    return fallback_roc_auc_score(y_true, prob)


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


def split_data(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    if "split" in df.columns:
        train = df[df["split"].isin(["train", "validation"])].copy()
        test = df[df["split"] == "test"].copy()
        if not train.empty and not test.empty:
            return train, test
    shuffled = df.sample(frac=1.0, random_state=DETERMINISTIC_SEED).reset_index(drop=True)
    cut = max(1, int(len(shuffled) * 0.70))
    return shuffled.iloc[:cut].copy(), shuffled.iloc[cut:].copy()


def train_risk_models(df_train: pd.DataFrame, df_eval: pd.DataFrame, cols: list[str]) -> tuple[dict[str, np.ndarray], dict[str, Any]]:
    predictions: dict[str, np.ndarray] = {}
    metrics: dict[str, Any] = {}
    for head in HEADS:
        label = LABEL_COLS[head]
        if label not in df_train.columns or label not in df_eval.columns:
            metrics[head] = {"status": "skipped", "reason": "label_missing"}
            continue
        y_train = df_train[label].astype(int).to_numpy()
        y_eval = df_eval[label].astype(int).to_numpy()
        if len(set(y_train.tolist())) < 2 or len(set(y_eval.tolist())) < 2:
            metrics[head] = {"status": "skipped", "reason": "single_class"}
            continue
        if LogisticRegression is not None and StandardScaler is not None:
            scaler = StandardScaler()
            X_train = scaler.fit_transform(df_train[cols].to_numpy(dtype=float))
            X_eval = scaler.transform(df_eval[cols].to_numpy(dtype=float))
            model = LogisticRegression(C=1.0, solver="lbfgs", class_weight="balanced", max_iter=1000, random_state=DETERMINISTIC_SEED)
            model.fit(X_train, y_train)
            prob = model.predict_proba(X_eval)[:, 1]
            family = "logistic_baseline_internal"
        else:
            prob = heuristic_probability(df_eval, head)
            family = "heuristic_v6_contract_fallback"
        predictions[head] = np.clip(prob, 0.0001, 0.9999)
        metrics[head] = {
            "status": "ok",
            "modelFamily": family,
            "rocAuc": metric_auc(y_eval, prob),
            "brier": metric_brier(y_eval, prob),
            "support": int(len(y_eval)),
            "positives": int(y_eval.sum()),
        }
    return predictions, metrics


def row_base_state(row: pd.Series) -> dict[str, float]:
    attendance_pct = float(row.get("feat_0", 0.5)) * 60.0 + 40.0
    tt1_risk = float(row.get("feat_5", 0.5))
    tt2_risk = float(row.get("feat_6", 0.5))
    see_risk = float(row.get("feat_7", 0.5))
    quiz_risk = float(row.get("feat_8", 0.5))
    assign_risk = float(row.get("feat_9", 0.5))
    ce_risk = float(np.mean([tt1_risk, tt2_risk, quiz_risk, assign_risk]))
    overall_risk = max(ce_risk, see_risk)
    return {
        "attendancePct": attendance_pct,
        "ceRisk": ce_risk,
        "seeRisk": see_risk,
        "overallRisk": overall_risk,
    }


def simulate_expected_effect(row: pd.Series, head: str, row_idx: int, draws: int) -> dict[str, float]:
    params = INTERVENTION_PARAMS[head]
    base = row_base_state(row)
    att_deltas: list[float] = []
    ce_deltas: list[float] = []
    see_deltas: list[float] = []
    overall_deltas: list[float] = []
    for draw in range(draws):
        u = stable_unit_interval(row_idx, head, draw, "receptivity")
        receptivity = 0.3 + u * 0.5
        att_noise = (stable_unit_interval(row_idx, head, draw, "att_noise") - 0.5) * 4.0
        ce_noise = (stable_unit_interval(row_idx, head, draw, "ce_noise") - 0.5) * 3.0
        see_noise = (stable_unit_interval(row_idx, head, draw, "see_noise") - 0.5) * 4.0
        att_uplift = params["uplift_attendance"] * receptivity + att_noise
        ce_uplift = params["uplift_ce"] * receptivity + ce_noise
        see_uplift = params["uplift_see"] * receptivity + see_noise
        att_after = min(max(base["attendancePct"] + att_uplift, 0.0), 100.0)
        ce_after = max(base["ceRisk"] - ce_uplift / 100.0, 0.0)
        see_after = max(base["seeRisk"] - see_uplift / 100.0, 0.0)
        overall_after = max(ce_after, see_after)
        att_deltas.append(att_after - base["attendancePct"])
        ce_deltas.append((base["ceRisk"] - ce_after) * 100.0)
        see_deltas.append((base["seeRisk"] - see_after) * 100.0)
        overall_deltas.append((base["overallRisk"] - overall_after) * 100.0)
    overall = float(np.mean(overall_deltas))
    att = float(np.mean(att_deltas))
    ce = float(np.mean(ce_deltas))
    see = float(np.mean(see_deltas))
    total = overall + 0.15 * att + 0.35 * ce + 0.35 * see
    cost = float(params["cost_days"])
    return {
        "attendanceDelta": att,
        "ceDelta": ce,
        "seeDelta": see,
        "overallRiskDelta": overall,
        "totalBenefit": total,
        "costDays": cost,
        "benefitPerDay": total / cost if cost > 0 else 0.0,
    }


def build_policy_frame(df_eval: pd.DataFrame, predictions: dict[str, np.ndarray], draws: int, seed: int) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for local_idx, (_, row) in enumerate(df_eval.reset_index(drop=True).iterrows()):
        head_effects = {head: simulate_expected_effect(row, head, local_idx, draws) for head in HEADS if head in predictions}
        if not head_effects:
            continue
        risk_head = max(head_effects, key=lambda h: float(predictions[h][local_idx]))
        uplift_head = max(head_effects, key=lambda h: float(predictions[h][local_idx]) * head_effects[h]["totalBenefit"])
        efficiency_head = max(head_effects, key=lambda h: float(predictions[h][local_idx]) * head_effects[h]["benefitPerDay"])
        oracle_head = max(head_effects, key=lambda h: head_effects[h]["totalBenefit"])
        random_score = stable_unit_interval(seed, local_idx, "random_policy")
        base_record = {
            "rowIndex": local_idx,
            "scenarioFamily": row.get("scenario_family", "unknown"),
            "stageKey": row.get("stage_key", "unknown"),
            "sectionCode": row.get("section_code", "unknown"),
            "randomScore": random_score,
        }
        choices = {
            "risk_only": (risk_head, float(predictions[risk_head][local_idx])),
            "uplift_style": (uplift_head, float(predictions[uplift_head][local_idx]) * head_effects[uplift_head]["totalBenefit"]),
            "efficiency": (efficiency_head, float(predictions[efficiency_head][local_idx]) * head_effects[efficiency_head]["benefitPerDay"]),
            "oracle_synthetic": (oracle_head, head_effects[oracle_head]["totalBenefit"]),
            "random": (risk_head, random_score),
        }
        for policy, (head, score) in choices.items():
            effect = head_effects[head]
            rows.append({
                **base_record,
                "policy": policy,
                "selectedHead": head,
                "policyScore": float(score),
                **effect,
            })
    return pd.DataFrame(rows)


def summarize_selection(selection: pd.DataFrame) -> dict[str, Any]:
    if selection.empty:
        return {
            "selectedStudents": 0,
            "totalCostDays": 0.0,
            "totalBenefit": 0.0,
            "benefitPerDay": 0.0,
            "attendanceDeltaMean": 0.0,
            "ceDeltaMean": 0.0,
            "seeDeltaMean": 0.0,
            "overallRiskDeltaMean": 0.0,
            "selectedHeadCounts": {},
            "scenarioFamilyCounts": {},
            "stageKeyCounts": {},
            "sectionCodeCounts": {},
        }
    total_cost = float(selection["costDays"].sum())
    total_benefit = float(selection["totalBenefit"].sum())
    return {
        "selectedStudents": int(len(selection)),
        "totalCostDays": total_cost,
        "totalBenefit": total_benefit,
        "benefitPerDay": total_benefit / total_cost if total_cost > 0 else 0.0,
        "attendanceDeltaMean": float(selection["attendanceDelta"].mean()),
        "ceDeltaMean": float(selection["ceDelta"].mean()),
        "seeDeltaMean": float(selection["seeDelta"].mean()),
        "overallRiskDeltaMean": float(selection["overallRiskDelta"].mean()),
        "selectedHeadCounts": count_values(selection, "selectedHead"),
        "scenarioFamilyCounts": count_values(selection, "scenarioFamily"),
        "stageKeyCounts": count_values(selection, "stageKey"),
        "sectionCodeCounts": count_values(selection, "sectionCode"),
    }


def bootstrap_ci(values: np.ndarray, rng: np.random.Generator, reps: int) -> dict[str, float] | None:
    if reps <= 0 or values.size == 0:
        return None
    stats = []
    for _ in range(reps):
        sample = rng.choice(values, size=values.size, replace=True)
        stats.append(float(np.mean(sample)))
    return {
        "low": float(np.quantile(stats, 0.025)),
        "high": float(np.quantile(stats, 0.975)),
    }


def evaluate_policies(policy_frame: pd.DataFrame, capacity_fractions: list[float], bootstrap_reps: int, seed: int) -> dict[str, Any]:
    rng = np.random.default_rng(seed)
    results: dict[str, Any] = {}
    n_students = int(policy_frame["rowIndex"].nunique()) if not policy_frame.empty else 0
    random_curve: dict[str, float] = {}
    oracle_curve: dict[str, float] = {}
    for policy in sorted(policy_frame["policy"].unique().tolist()):
        policy_df = policy_frame[policy_frame["policy"] == policy].copy()
        ascending = policy == "random"
        policy_df = policy_df.sort_values("policyScore", ascending=ascending, kind="mergesort")
        curve = []
        for fraction in capacity_fractions:
            k = max(1, min(len(policy_df), int(math.ceil(n_students * fraction)))) if n_students else 0
            selected = policy_df.head(k).copy()
            summary = summarize_selection(selected)
            benefit_ci = bootstrap_ci(selected["totalBenefit"].to_numpy(dtype=float), rng, bootstrap_reps)
            summary.update({
                "capacityFraction": fraction,
                "capacityPercent": round(fraction * 100.0, 2),
                "meanBenefitCi95": benefit_ci,
            })
            curve.append(summary)
            key = f"{fraction:.2f}"
            if policy == "random":
                random_curve[key] = summary["totalBenefit"]
            if policy == "oracle_synthetic":
                oracle_curve[key] = summary["totalBenefit"]
        results[policy] = {
            "curve": curve,
            "scenarioFamily": grouped_summary(policy_df, "scenarioFamily"),
            "stageKey": grouped_summary(policy_df, "stageKey"),
            "sectionCode": grouped_summary(policy_df, "sectionCode"),
        }
    for policy, payload in results.items():
        qini_like = 0.0
        regret_like = 0.0
        for point in payload["curve"]:
            key = f"{point['capacityFraction']:.2f}"
            qini_like += point["totalBenefit"] - random_curve.get(key, 0.0)
            regret_like += oracle_curve.get(key, point["totalBenefit"]) - point["totalBenefit"]
        payload["qiniLikeAreaVsRandom"] = float(qini_like)
        payload["regretAreaVsOracleSynthetic"] = float(regret_like)
    return results


def grouped_summary(df: pd.DataFrame, column: str) -> dict[str, Any]:
    if column not in df.columns or df.empty:
        return {}
    grouped = {}
    for value, group in df.groupby(column):
        grouped[str(value)] = {
            "candidateCount": int(len(group)),
            "meanTotalBenefit": float(group["totalBenefit"].mean()),
            "meanCostDays": float(group["costDays"].mean()),
            "meanBenefitPerDay": float(group["benefitPerDay"].mean()),
        }
    return grouped


def count_values(df: pd.DataFrame, column: str) -> dict[str, int]:
    if column not in df.columns or df.empty:
        return {}
    return {str(k): int(v) for k, v in df[column].value_counts().sort_index().items()}


def write_markdown(report: dict[str, Any], path: Path) -> None:
    lines = [
        "# AirMentor Synthetic Intervention Policy Evaluation",
        "",
        f"**Synthetic only:** `{report['syntheticOnly']}`",
        f"**Feature schema:** `{report['featureSchemaVersion']}`",
        f"**Feature count:** `{report['featureCount']}`",
        f"**Causal claim allowed:** `{report['causalClaimAllowed']}`",
        "",
        f"> {CLAIM_BOUNDARY}",
        "",
        "## Risk Model Metrics",
        "",
        "| Head | Status | AUC | Brier | Support | Positives |",
        "|---|---|---:|---:|---:|---:|",
    ]
    for head, metrics in report["riskModelMetrics"].items():
        lines.append(
            f"| {head} | {metrics.get('status')} | {metrics.get('rocAuc', 0):.4f} | "
            f"{metrics.get('brier', 0):.4f} | {metrics.get('support', 0)} | {metrics.get('positives', 0)} |"
        )
    lines.extend(["", "## Policy Capacity Curves", ""])
    for policy, payload in report["policies"].items():
        lines.extend([
            f"### {policy}",
            "",
            f"- **Qini-like area vs random:** {payload['qiniLikeAreaVsRandom']:.4f}",
            f"- **Regret area vs oracle synthetic:** {payload['regretAreaVsOracleSynthetic']:.4f}",
            "",
            "| Capacity | Students | Cost days | Total benefit | Benefit/day | Attendance Δ | CE Δ | SEE Δ | Overall risk Δ |",
            "|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
        ])
        for point in payload["curve"]:
            lines.append(
                f"| {point['capacityPercent']:.0f}% | {point['selectedStudents']} | {point['totalCostDays']:.1f} | "
                f"{point['totalBenefit']:.3f} | {point['benefitPerDay']:.4f} | "
                f"{point['attendanceDeltaMean']:.3f} | {point['ceDeltaMean']:.3f} | "
                f"{point['seeDeltaMean']:.3f} | {point['overallRiskDeltaMean']:.3f} |"
            )
        lines.append("")
    lines.extend([
        "## Deferred Decision",
        "",
        "No default capacity threshold is selected in this report. The operating point should be chosen after reviewing policy curves, workload feasibility, and faculty role constraints.",
        "",
    ])
    path.write_text("\n".join(lines), encoding="utf-8")


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


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate synthetic-only AirMentor intervention policies")
    parser.add_argument("features_csv")
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--output-md", required=True)
    parser.add_argument("--seed", type=int, default=DETERMINISTIC_SEED)
    parser.add_argument("--draws", type=int, default=32)
    parser.add_argument("--bootstrap-reps", type=int, default=50)
    parser.add_argument("--capacity-fractions", default=",".join(str(v) for v in CAPACITY_FRACTIONS))
    args = parser.parse_args()

    features_path = Path(args.features_csv)
    if not features_path.exists():
        print(f"ERROR: features CSV not found: {features_path}", file=sys.stderr)
        return 1
    df = pd.read_csv(features_path)
    cols = feature_cols(df)
    if not cols:
        print("ERROR: no feat_N columns found", file=sys.stderr)
        return 1
    feature_contract = feature_contract_report(df, cols)
    if feature_contract["passed"] is not True:
        print(f"ERROR: v6 feature contract failed: {json.dumps(feature_contract, sort_keys=True)}", file=sys.stderr)
        return 1
    df_train, df_eval = split_data(df)
    predictions, metrics = train_risk_models(df_train, df_eval, cols)
    if not predictions:
        print("ERROR: no risk models could be trained", file=sys.stderr)
        return 1
    fractions = [float(v.strip()) for v in args.capacity_fractions.split(",") if v.strip()]
    fractions = sorted(set(v for v in fractions if 0 < v <= 1))
    policy_frame = build_policy_frame(df_eval, predictions, max(1, args.draws), args.seed)
    policies = evaluate_policies(policy_frame, fractions, max(0, args.bootstrap_reps), args.seed)
    report = {
        "syntheticOnly": True,
        "causalClaimAllowed": False,
        "productionServingClaimAllowed": False,
        "realWorldGeneralizationClaimAllowed": False,
        "claimBoundary": CLAIM_BOUNDARY,
        "featuresCsv": str(features_path),
        "featureSchemaVersion": feature_contract["featureSchemaVersion"],
        "featureSchema": {
            "name": feature_contract["featureSchemaVersion"],
            "featureCount": feature_contract["featureCount"],
            "featureKeyHash": feature_contract["featureKeyHash"],
        },
        "featureContract": feature_contract,
        "rowCounts": {
            "all": int(len(df)),
            "train": int(len(df_train)),
            "eval": int(len(df_eval)),
        },
        "featureCount": len(cols),
        "capacityFractions": fractions,
        "riskModelMetrics": metrics,
        "policies": policies,
        "oracleSyntheticIsProductEligible": False,
        "defaultCapacitySelected": None,
    }
    output_json = Path(args.output_json)
    output_md = Path(args.output_md)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_md.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(clean_json(report), indent=2, sort_keys=True), encoding="utf-8")
    write_markdown(clean_json(report), output_md)
    print(f"Wrote {output_json}")
    print(f"Wrote {output_md}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
