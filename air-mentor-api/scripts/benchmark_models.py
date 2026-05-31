"""
Comprehensive benchmark suite for AirMentor ML models.

Reads metrics.json from training runs and produces a unified benchmark
report comparing baseline, challenger, and ensemble performance across
all risk heads.

Usage:
    python benchmark_models.py <metrics_dir> [output_md]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def load_metrics(metrics_path: Path) -> dict[str, Any]:
    return json.loads(metrics_path.read_text(encoding="utf-8"))


def benchmark_head(head_key: str, metrics: dict) -> dict[str, Any]:
    baseline = metrics.get("baseline", {}).get("test", {})
    challenger = metrics.get("challenger", {}).get("test", {})
    gates = metrics.get("gates", {})
    fairness = metrics.get("fairness")

    return {
        "head": head_key,
        "baselineAuc": baseline.get("rocAuc"),
        "baselineBrier": baseline.get("brier"),
        "challengerAuc": challenger.get("rocAuc"),
        "challengerBrier": challenger.get("brier"),
        "aucDelta": _delta(challenger.get("rocAuc"), baseline.get("rocAuc")),
        "brierDelta": _delta(challenger.get("brier"), baseline.get("brier")),
        "gatesPassed": gates.get("passCount", 0),
        "promotable": metrics.get("headPromotable", False),
        "fairnessWarnings": _count_fairness_warnings(fairness),
    }


def _delta(challenger: float | None, baseline: float | None) -> float | None:
    if challenger is None or baseline is None:
        return None
    return round(challenger - baseline, 4)


def _count_fairness_warnings(fairness: dict | None) -> int:
    if not fairness:
        return 0
    return sum(1 for r in fairness.values() if not r.get("passes_thresholds", True))


def generate_markdown_report(results: list[dict[str, Any]]) -> str:
    lines = [
        "# AirMentor ML Benchmark Report",
        "",
        "| Head | Baseline AUC | Challenger AUC | Δ AUC | Baseline Brier | Challenger Brier | Δ Brier | Gates | Promotable | Fairness Warnings |",
        "|------|-------------:|---------------:|------:|---------------:|-----------------:|--------:|------:|:----------:|------------------:|",
    ]
    for r in results:
        lines.append(
            f"| {r['head']:22s} | {r['baselineAuc'] or '-':>12} | {r['challengerAuc'] or '-':>14} | "
            f"{r['aucDelta'] or '-':>5} | {r['baselineBrier'] or '-':>14} | {r['challengerBrier'] or '-':>16} | "
            f"{r['brierDelta'] or '-':>7} | {r['gatesPassed']:>5}/5 | {'Yes' if r['promotable'] else 'No':>10} | {r['fairnessWarnings']:>17} |"
        )

    promotable = sum(1 for r in results if r["promotable"])
    lines.append("")
    lines.append(f"**Summary:** {promotable}/{len(results)} heads promotable.")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark AirMentor ML models")
    parser.add_argument("metrics_dir", help="Directory containing metrics.json files")
    parser.add_argument("output_md", nargs="?", help="Optional Markdown output path")
    args = parser.parse_args()

    metrics_dir = Path(args.metrics_dir)
    if not metrics_dir.is_dir():
        print(f"[benchmark] ERROR: not a directory: {metrics_dir}", file=sys.stderr)
        return 1

    metrics_files = sorted(metrics_dir.glob("*/metrics.json")) + sorted(metrics_dir.glob("metrics.json"))
    if not metrics_files:
        print(f"[benchmark] WARNING: no metrics.json found in {metrics_dir}", file=sys.stderr)
        return 0

    results: list[dict[str, Any]] = []
    for mf in metrics_files:
        data = load_metrics(mf)
        heads = data.get("heads", {})
        for head_key, head_metrics in heads.items():
            results.append(benchmark_head(head_key, head_metrics))

    report = generate_markdown_report(results)
    print(report)

    if args.output_md:
        out_path = Path(args.output_md)
        out_path.write_text(report, encoding="utf-8")
        print(f"\n[benchmark] Report saved to {out_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
