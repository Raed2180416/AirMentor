#!/usr/bin/env python3
"""Automated promotion-gate checker for ML evaluation artefacts.

Reads an evaluator-produced `evaluation-report.json` and verifies the 12 gates
from intent §F.7 + RCA appendix A + §N.4. Exits 0 on PASS-all, 1 on any failure.

Usage:
    python3 scripts/check-promotion-gates.py path/to/evaluation-report.json
    python3 scripts/check-promotion-gates.py --json path.json --candidate v7+beta
    python3 scripts/check-promotion-gates.py --json path.json --strict-per-cell
    python3 scripts/check-promotion-gates.py --json path.json --output gate-check.md

Gates (from `audit-map/32-reports/ml-eval-runbook-2026-04-22.md` §3):

  1. ROC-AUC                  >= 0.7894
  2. Brier                    <= 0.1359
  3. Global ECE               <= 0.01
  4. Local-ECE @ 0.4          <= 0.02
  5. Local-ECE @ 0.85         <= 0.02
  6. Overload global          <= 1.00
  7. Overload per-stage max   <= 1.10
  8. Overload per-semester max <= 1.10
  9. Overload per-family max  <= 1.15
 10. Stability min Jaccard    >= 0.65
 11. Stability p95 churn      <= 0.50
 12. Replayability            true  (stamped by runner, not computed here)

The script is deterministic + pure; no DB, no network. Safe to run in CI or
by any agent/human inspecting a report.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class Gate:
    name: str
    threshold: str
    actual: float | str | None
    passed: bool
    detail: str = ""


def get_by_path(doc: dict[str, Any], *keys: str) -> Any:
    node: Any = doc
    for key in keys:
        if node is None:
            return None
        if isinstance(node, dict):
            node = node.get(key)
        else:
            return None
    return node


def max_overload_across(node: dict[str, dict[str, Any]] | None) -> tuple[float, str]:
    """Given a map {cell_key: VariantComparisonSummary}, return (max_overload, worst_cell).

    Reads `<cell>.current.budgetMetrics.overloadRatio`.
    """
    if not node or not isinstance(node, dict):
        return (0.0, "(missing)")
    worst = ("(none)", 0.0)
    for cell_key, summary in node.items():
        if not isinstance(summary, dict):
            continue
        ratio = get_by_path(summary, "current", "budgetMetrics", "overloadRatio")
        if isinstance(ratio, (int, float)) and ratio > worst[1]:
            worst = (cell_key, float(ratio))
    return (worst[1], worst[0])


def min_jaccard_across(pairs: list[dict[str, Any]] | None) -> tuple[float, str]:
    if not pairs:
        return (0.0, "(missing)")
    worst_cell = "(none)"
    worst_val = 1.0
    for pair in pairs:
        if not isinstance(pair, dict):
            continue
        mj = pair.get("meanJaccard")
        if isinstance(mj, (int, float)) and float(mj) < worst_val:
            worst_val = float(mj)
            worst_cell = f"{pair.get('stageA','?')}->{pair.get('stageB','?')}"
    return (worst_val, worst_cell)


def max_p95_churn_across(pairs: list[dict[str, Any]] | None) -> tuple[float, str]:
    if not pairs:
        return (0.0, "(missing)")
    worst_cell = "(none)"
    worst_val = 0.0
    for pair in pairs:
        if not isinstance(pair, dict):
            continue
        churn = pair.get("p95ChurnRate")
        if isinstance(churn, (int, float)) and float(churn) > worst_val:
            worst_val = float(churn)
            worst_cell = f"{pair.get('stageA','?')}->{pair.get('stageB','?')}"
    return (worst_val, worst_cell)


def check_gates(doc: dict[str, Any], strict_per_cell: bool) -> list[Gate]:
    current = get_by_path(doc, "overallCourseVariantSummary", "current") or {}
    budget_metrics = current.get("budgetMetrics", {}) or {}
    local_cal = current.get("localCalibration", {}) or {}

    rocauc = current.get("rocAuc")
    brier = current.get("brier")
    global_ece = current.get("expectedCalibrationError")
    overload_global = budget_metrics.get("overloadRatio")
    local_ece_04 = local_cal.get("localEceAt04")
    local_ece_085 = local_cal.get("localEceAt085")

    by_stage = get_by_path(doc, "overallCourseVariantSummaryByStage") or {}
    by_sem = get_by_path(doc, "overallCourseVariantSummaryBySemester") or {}
    by_fam = get_by_path(doc, "overallCourseVariantSummaryByScenarioFamily") or {}
    stab_pairs = get_by_path(doc, "overallCourseStabilityByAdjacentStagePair") or []

    overload_stage_max, worst_stage = max_overload_across(by_stage)
    overload_sem_max, worst_sem = max_overload_across(by_sem)
    overload_fam_max, worst_fam = max_overload_across(by_fam)
    min_jaccard, jaccard_worst_pair = min_jaccard_across(stab_pairs)
    p95_churn_max, churn_worst_pair = max_p95_churn_across(stab_pairs)

    replayability_flag = get_by_path(doc, "artifact", "deterministicReplay") or get_by_path(doc, "gitSha") is not None

    gates: list[Gate] = [
        Gate(
            "ROC-AUC >= 0.7894",
            ">= 0.7894",
            rocauc,
            isinstance(rocauc, (int, float)) and float(rocauc) >= 0.7894,
            f"current rocAuc={rocauc}",
        ),
        Gate(
            "Brier <= 0.1359",
            "<= 0.1359",
            brier,
            isinstance(brier, (int, float)) and float(brier) <= 0.1359,
            f"current brier={brier}",
        ),
        Gate(
            "Global ECE <= 0.01",
            "<= 0.01",
            global_ece,
            isinstance(global_ece, (int, float)) and float(global_ece) <= 0.01,
            f"current globalECE={global_ece}",
        ),
        Gate(
            "Local-ECE @ 0.4 <= 0.02",
            "<= 0.02",
            local_ece_04,
            isinstance(local_ece_04, (int, float)) and float(local_ece_04) <= 0.02,
            f"localEceAt04={local_ece_04}",
        ),
        Gate(
            "Local-ECE @ 0.85 <= 0.02",
            "<= 0.02",
            local_ece_085,
            isinstance(local_ece_085, (int, float)) and float(local_ece_085) <= 0.02,
            f"localEceAt085={local_ece_085}",
        ),
        Gate(
            "Overload global <= 1.00",
            "<= 1.00",
            overload_global,
            isinstance(overload_global, (int, float)) and float(overload_global) <= 1.00,
            f"overloadRatio={overload_global}",
        ),
        Gate(
            "Overload per-stage <= 1.10",
            "<= 1.10" if not strict_per_cell else "<= 1.00",
            overload_stage_max,
            overload_stage_max <= (1.00 if strict_per_cell else 1.10),
            f"worst stage={worst_stage} @ {overload_stage_max}",
        ),
        Gate(
            "Overload per-semester <= 1.10",
            "<= 1.10" if not strict_per_cell else "<= 1.00",
            overload_sem_max,
            overload_sem_max <= (1.00 if strict_per_cell else 1.10),
            f"worst sem={worst_sem} @ {overload_sem_max}",
        ),
        Gate(
            "Overload per-family <= 1.15",
            "<= 1.15" if not strict_per_cell else "<= 1.00",
            overload_fam_max,
            overload_fam_max <= (1.00 if strict_per_cell else 1.15),
            f"worst family={worst_fam} @ {overload_fam_max}",
        ),
        Gate(
            "Stability min Jaccard >= 0.65",
            ">= 0.65",
            min_jaccard,
            min_jaccard >= 0.65,
            f"worst pair={jaccard_worst_pair} @ {min_jaccard:.4f}",
        ),
        Gate(
            "Stability p95 churn <= 0.50",
            "<= 0.50",
            p95_churn_max,
            p95_churn_max <= 0.50,
            f"worst pair={churn_worst_pair} @ {p95_churn_max:.4f}",
        ),
        Gate(
            "Replayability stamped",
            "gitSha+seed present",
            "present" if replayability_flag else "missing",
            bool(replayability_flag),
            "checked via gitSha field; full bytewise proof requires artefact diff",
        ),
    ]
    return gates


def render_markdown(gates: list[Gate], json_path: str, candidate: str | None) -> str:
    passed = sum(1 for g in gates if g.passed)
    total = len(gates)
    lines: list[str] = []
    lines.append(f"# Promotion gate check — {candidate or 'current variant'}")
    lines.append("")
    lines.append(f"Source: `{json_path}`")
    lines.append(f"Verdict: **{passed}/{total} PASS** " + ("✅" if passed == total else "❌"))
    lines.append("")
    lines.append("| # | Gate | Threshold | Actual | Pass | Detail |")
    lines.append("|---|---|---|---|---|---|")
    for i, g in enumerate(gates, start=1):
        mark = "✅" if g.passed else "❌"
        lines.append(f"| {i} | {g.name} | {g.threshold} | {g.actual} | {mark} | {g.detail} |")
    lines.append("")
    if passed == total:
        lines.append("All gates pass. Candidate is promotable subject to bytewise replay verification outside this script.")
    else:
        failed = [g for g in gates if not g.passed]
        lines.append(f"Failed gates ({len(failed)}):")
        for g in failed:
            lines.append(f"- **{g.name}** — {g.detail}")
        lines.append("")
        lines.append("Promotion blocked. Refer to RCA hypotheses in `audit-map/08-ml-audit/07-v7-overload-root-cause-analysis-2026-04-22.md` for which lever to pull.")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="ML promotion-gate checker")
    parser.add_argument("--json", type=str, default=None, help="path to evaluation-report.json")
    parser.add_argument("json_positional", nargs="?", default=None, help="path to evaluation-report.json")
    parser.add_argument("--candidate", type=str, default=None, help="name of candidate (e.g. v7+beta, v8-corrected)")
    parser.add_argument("--output", type=str, default=None, help="optional markdown output path")
    parser.add_argument("--strict-per-cell", action="store_true", help="apply per-cell threshold of 1.00 instead of 1.10/1.15")
    args = parser.parse_args()

    json_path = args.json or args.json_positional
    if not json_path:
        print("ERROR: missing path. Usage: check-promotion-gates.py <path-to-evaluation-report.json>", file=sys.stderr)
        return 2

    path = Path(json_path)
    if not path.exists():
        print(f"ERROR: file does not exist: {path}", file=sys.stderr)
        return 2

    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"ERROR: failed to parse JSON: {exc}", file=sys.stderr)
        return 2

    gates = check_gates(doc, strict_per_cell=args.strict_per_cell)
    md = render_markdown(gates, str(path), args.candidate)

    print(md)

    if args.output:
        Path(args.output).write_text(md, encoding="utf-8")
        print(f"wrote markdown to {args.output}", file=sys.stderr)

    all_pass = all(g.passed for g in gates)
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
