#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from pathlib import Path
from typing import Any


LABEL_COLS = {
    "attendanceRisk": "label_attendance",
    "ceRisk": "label_ce",
    "seeRisk": "label_see",
    "overallCourseRisk": "label_overall",
    "downstreamCarryoverRisk": "label_downstream",
}
FAIRNESS_LIMITS = {
    "fprGap": 0.05,
    "tprGap": 0.05,
    "positiveRateGap": 0.05,
    "brierGap": 0.02,
}


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def to_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except Exception:
        return default


def feature(row: dict[str, str], index: int, default: float = 0.5) -> float:
    return to_float(row.get(f"feat_{index}"), default)


def heuristic_probability(row: dict[str, str], head: str) -> float:
    attendance_risk = 1.0 - feature(row, 0)
    ce_risk = sum(feature(row, idx) for idx in [5, 6, 8, 9]) / 4.0
    see_risk = max(feature(row, 7), feature(row, 41, 0.0) * 0.65)
    backlog_risk = max(feature(row, idx, 0.0) for idx in [4, 44, 45, 46, 47])
    prerequisite_risk = sum(feature(row, idx) for idx in [15, 16, 17, 20, 21, 22, 23, 24]) / 8.0
    if head == "attendanceRisk":
        value = attendance_risk
    elif head == "ceRisk":
        value = ce_risk
    elif head == "seeRisk":
        value = see_risk
    elif head == "downstreamCarryoverRisk":
        value = max(prerequisite_risk, backlog_risk)
    else:
        value = max(attendance_risk * 0.4, ce_risk, see_risk, backlog_risk)
    return min(0.9999, max(0.0001, value))


def bucket(value: float, cuts: list[tuple[float, str]], default: str) -> str:
    for upper, label in cuts:
        if value <= upper:
            return label
    return default


def slice_keys(row: dict[str, str]) -> dict[str, str]:
    attendance_pct = feature(row, 0) * 100.0
    ce_risk = sum(feature(row, idx) for idx in [5, 6, 8, 9]) / 4.0
    backlog_pressure = max(feature(row, idx, 0.0) for idx in [4, 44, 45, 46, 47])
    return {
        "split": row.get("split") or "unknown",
        "stage_key": row.get("stage_key") or row.get("stageKey") or "unknown",
        "scenario_family": row.get("scenario_family") or "unknown",
        "section_code": row.get("section_code") or row.get("sectionCode") or "unknown",
        "see_missing": "missing" if feature(row, 41, 0.0) >= 0.5 else "present",
        "tt2_missing": "missing" if feature(row, 40, 0.0) >= 0.5 else "present",
        "attendance_band": bucket(attendance_pct, [(50, "lt50"), (65, "50_65"), (75, "65_75"), (85, "75_85")], "gte85"),
        "ce_risk_band": bucket(ce_risk, [(0.25, "low"), (0.5, "medium"), (0.75, "high")], "very_high"),
        "backlog_pressure_band": bucket(backlog_pressure, [(0.0, "none"), (0.33, "low"), (0.66, "medium")], "high"),
    }


def read_rows(path: Path, head: str, prediction_col: str | None) -> list[dict[str, Any]]:
    label_col = LABEL_COLS[head]
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError(f"CSV has no header: {path}")
        if label_col not in reader.fieldnames:
            raise ValueError(f"missing label column for {head}: {label_col}")
        for raw in reader:
            prob = to_float(raw.get(prediction_col), math.nan) if prediction_col else math.nan
            if math.isnan(prob):
                prob = heuristic_probability(raw, head)
            rows.append({
                "label": to_int(raw.get(label_col)),
                "prob": min(0.9999, max(0.0001, prob)),
                "slices": slice_keys(raw),
            })
    return rows


def metrics_for(rows: list[dict[str, Any]], threshold: float) -> dict[str, Any]:
    if not rows:
        return {
            "support": 0,
            "positiveRate": None,
            "predictedPositiveRate": None,
            "tpr": None,
            "fpr": None,
            "brier": None,
        }
    labels = [int(row["label"]) for row in rows]
    probs = [float(row["prob"]) for row in rows]
    preds = [1 if prob >= threshold else 0 for prob in probs]
    positives = sum(labels)
    negatives = len(labels) - positives
    tp = sum(1 for y, yhat in zip(labels, preds) if y == 1 and yhat == 1)
    fp = sum(1 for y, yhat in zip(labels, preds) if y == 0 and yhat == 1)
    tn = sum(1 for y, yhat in zip(labels, preds) if y == 0 and yhat == 0)
    fn = sum(1 for y, yhat in zip(labels, preds) if y == 1 and yhat == 0)
    brier = sum((prob - label) ** 2 for prob, label in zip(probs, labels)) / len(rows)
    return {
        "support": len(rows),
        "positiveRate": positives / len(rows),
        "predictedPositiveRate": sum(preds) / len(rows),
        "meanProbability": sum(probs) / len(rows),
        "tpr": tp / positives if positives else None,
        "fpr": fp / negatives if negatives else None,
        "brier": brier,
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn,
    }


def gap(values: list[float | None]) -> float | None:
    present = [value for value in values if value is not None]
    if len(present) < 2:
        return None
    return max(present) - min(present)


def analyze_dimension(rows: list[dict[str, Any]], dimension: str, threshold: float, min_support: int) -> dict[str, Any]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        key = row["slices"].get(dimension) or "unknown"
        groups.setdefault(key, []).append(row)
    metrics = {name: metrics_for(items, threshold) for name, items in sorted(groups.items())}
    eligible = {name: item for name, item in metrics.items() if item["support"] >= min_support}
    summary = {
        "groups": metrics,
        "eligibleGroups": sorted(eligible),
        "gaps": {
            "fprGap": gap([item.get("fpr") for item in eligible.values()]),
            "tprGap": gap([item.get("tpr") for item in eligible.values()]),
            "positiveRateGap": gap([item.get("predictedPositiveRate") for item in eligible.values()]),
            "brierGap": gap([item.get("brier") for item in eligible.values()]),
        },
    }
    failed = []
    for metric, limit in FAIRNESS_LIMITS.items():
        value = summary["gaps"].get(metric)
        if value is not None and value > limit:
            failed.append({"metric": metric, "value": value, "limit": limit})
    summary["passed"] = not failed
    summary["failures"] = failed
    return summary


def markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# AirMentor Fairness Deep Dive",
        "",
        f"Head: `{report['head']}`",
        f"Prediction source: `{report['predictionSource']}`",
        f"Production gate passed: `{str(report['productionGate']['passed']).lower()}`",
        "",
        "## Dimension summary",
        "",
        "| Dimension | Passed | FPR gap | TPR gap | Positive-rate gap | Brier gap |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for name, item in report["dimensions"].items():
        gaps = item.get("gaps", {})
        lines.append(
            f"| `{name}` | `{str(item.get('passed')).lower()}` | {gaps.get('fprGap')} | {gaps.get('tprGap')} | "
            f"{gaps.get('positiveRateGap')} | {gaps.get('brierGap')} |"
        )
    lines.extend(["", "## Blockers", ""])
    for reason in report["productionGate"].get("blockedReasons", []):
        lines.append(f"- **Blocked:** {reason}")
    lines.append("")
    return "\n".join(lines)


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    rows = read_rows(Path(args.features_csv), args.head, args.prediction_col)
    dimensions = {
        dimension: analyze_dimension(rows, dimension, args.threshold, args.min_support)
        for dimension in [
            "section_code",
            "stage_key",
            "scenario_family",
            "split",
            "see_missing",
            "tt2_missing",
            "attendance_band",
            "ce_risk_band",
            "backlog_pressure_band",
        ]
    }
    failed_dimensions = [name for name, item in dimensions.items() if not item.get("passed")]
    blockers: list[str] = []
    if args.prediction_col is None:
        blockers.append("selected-model predictions were not supplied; report uses heuristic proxy probabilities")
    if failed_dimensions:
        blockers.append(f"fairness gaps exceed thresholds in dimensions: {failed_dimensions}")
    if args.head == "seeRisk" and "see_missing" not in dimensions:
        blockers.append("SEE missingness slice is required for seeRisk")
    return {
        "featuresCsv": args.features_csv,
        "head": args.head,
        "threshold": args.threshold,
        "minSupport": args.min_support,
        "predictionColumn": args.prediction_col,
        "predictionSource": "csv_column" if args.prediction_col else "heuristic_proxy",
        "rowCount": len(rows),
        "fairnessLimits": FAIRNESS_LIMITS,
        "dimensions": dimensions,
        "productionGate": {
            "passed": not blockers,
            "blockedReasons": blockers,
        },
        "summary": {
            "productionGatePassed": not blockers,
            "failedDimensions": failed_dimensions,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Deep fairness slice analysis for AirMentor risk heads.")
    parser.add_argument("--features-csv", required=True)
    parser.add_argument("--head", choices=sorted(LABEL_COLS), default="seeRisk")
    parser.add_argument("--prediction-col")
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--min-support", type=int, default=100)
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--output-md")
    args = parser.parse_args()
    report = build_report(args)
    output_json = Path(args.output_json)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(report, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
    output_md = Path(args.output_md) if args.output_md else output_json.with_suffix(".md")
    output_md.write_text(markdown_report(report), encoding="utf-8")
    print(f"Wrote {output_json}")
    print(f"Wrote {output_md}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
