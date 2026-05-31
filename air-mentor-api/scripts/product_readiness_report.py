#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
import re
import sys
from pathlib import Path
from typing import Any


HEADS = [
    "attendanceRisk",
    "ceRisk",
    "seeRisk",
    "overallCourseRisk",
    "downstreamCarryoverRisk",
]
PRODUCT_THRESHOLDS = [0.4, 0.65]
LOCAL_ECE_LIMIT = 0.08
MIN_LOCAL_CAL_SUPPORT = 100
REQUIRED_DEPLOY_COLUMNS = {
    "student": ["student_id", "studentId"],
    "course": ["course_id", "courseId", "course_code", "courseCode"],
    "semester": ["semester", "semester_number", "semesterNumber"],
    "stage": ["stage_key", "stageKey"],
    "section": ["section_code", "sectionCode"],
    "role": ["assigned_role", "assignedRole", "role"],
    "faculty": ["assigned_faculty_id", "assignedFacultyId", "faculty_id", "facultyId"],
}


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def load_json(path: Path | None) -> dict[str, Any] | None:
    if path is None or not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")


def read_header(path: Path | None) -> list[str]:
    if path is None or not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        return next(reader, [])


def resolve_path(run_dir: Path, explicit: str | None, relative: str) -> Path | None:
    if explicit:
        return Path(explicit)
    candidate = run_dir / relative
    return candidate if candidate.exists() else None


def nested_bool(blob: dict[str, Any] | None, paths: list[tuple[str, ...]]) -> bool:
    if not blob:
        return False
    for path in paths:
        current: Any = blob
        for key in path:
            if not isinstance(current, dict) or key not in current:
                current = None
                break
            current = current[key]
        if current is True:
            return True
    return False


def evidence_gate(name: str, passed: bool, severity: str, message: str, evidence: Any = None) -> dict[str, Any]:
    return {
        "name": name,
        "passed": bool(passed),
        "severity": severity,
        "message": message,
        "evidence": evidence,
    }


def deployment_column_coverage(header: list[str]) -> dict[str, Any]:
    present: dict[str, str] = {}
    missing: list[str] = []
    for family, alternatives in REQUIRED_DEPLOY_COLUMNS.items():
        match = next((col for col in alternatives if col in header), None)
        if match:
            present[family] = match
        else:
            missing.append(family)
    return {
        "passed": not missing,
        "present": present,
        "missing": missing,
        "requiredFamilies": sorted(REQUIRED_DEPLOY_COLUMNS),
    }


def local_calibration_at(metric: dict[str, Any], threshold: float) -> dict[str, Any] | None:
    local = metric.get("localCalibration") or {}
    for item in local.values():
        if not isinstance(item, dict):
            continue
        center = item.get("center")
        if isinstance(center, (int, float)) and abs(float(center) - threshold) < 1e-9:
            return item
    return None


def calibration_threshold_gates(metrics: dict[str, Any] | None) -> tuple[bool, list[dict[str, Any]]]:
    if not metrics:
        return False, [evidence_gate("threshold_calibration", False, "blocker", "training metrics missing")]
    gates: list[dict[str, Any]] = []
    for head in HEADS:
        head_metrics = (metrics.get("heads") or {}).get(head) or {}
        selected = head_metrics.get("challenger") or {}
        for split in ["validation", "test"]:
            split_metric = selected.get(split) or {}
            for threshold in PRODUCT_THRESHOLDS:
                cal = local_calibration_at(split_metric, threshold)
                if cal is None:
                    gates.append(evidence_gate(
                        f"threshold_calibration:{head}:{split}:{threshold}",
                        False,
                        "blocker",
                        f"missing local calibration at product threshold {threshold}",
                    ))
                    continue
                ece = cal.get("ece")
                support = int(cal.get("support") or 0)
                passed = ece is not None and float(ece) <= LOCAL_ECE_LIMIT and support >= MIN_LOCAL_CAL_SUPPORT
                gates.append(evidence_gate(
                    f"threshold_calibration:{head}:{split}:{threshold}",
                    passed,
                    "blocker" if not passed else "info",
                    f"local ECE at {threshold}: ece={ece}, support={support}",
                    cal,
                ))
    return all(g["passed"] for g in gates), gates


def aggregate_fairness_pass(metrics: dict[str, Any] | None) -> dict[str, Any]:
    details: dict[str, Any] = {}
    if not metrics:
        return {"passed": False, "details": details, "failedHeads": HEADS}
    failed: list[str] = []
    for head in HEADS:
        fairness = ((metrics.get("heads") or {}).get(head) or {}).get("fairness")
        if not fairness:
            failed.append(head)
            details[head] = {"available": False}
            continue
        group_failures = [name for name, result in fairness.items() if not result.get("passes_thresholds", True)]
        details[head] = {"available": True, "failedGroups": group_failures, "groups": fairness}
        if group_failures:
            failed.append(head)
    return {"passed": not failed, "details": details, "failedHeads": failed}


def head_readiness(metrics: dict[str, Any] | None) -> dict[str, Any]:
    results: dict[str, Any] = {}
    for head in HEADS:
        item = ((metrics or {}).get("heads") or {}).get(head) or {}
        selected = item.get("selectedModel")
        model_family = (item.get("challenger") or {}).get("modelFamily")
        fairness = item.get("fairness") or {}
        fairness_passed = bool(fairness) and all(group.get("passes_thresholds", True) for group in fairness.values())
        validation = ((item.get("challenger") or {}).get("validation") or {})
        test = ((item.get("challenger") or {}).get("test") or {})
        missing_thresholds = [
            threshold for threshold in PRODUCT_THRESHOLDS
            if local_calibration_at(validation, threshold) is None or local_calibration_at(test, threshold) is None
        ]
        blockers: list[str] = []
        if missing_thresholds:
            blockers.append(f"missing product-threshold calibration: {missing_thresholds}")
        if not fairness_passed:
            blockers.append("fairness unavailable or failed")
        if selected and selected != "baseline":
            blockers.append("non-baseline selected model requires shadow-only status until explanation parity and real validation pass")
        if head == "seeRisk":
            blockers.append("SEE risk requires deep missingness/eligibility fairness review before product use")
        if selected == "baseline" and head in {"attendanceRisk", "overallCourseRisk"}:
            status = "baseline_demo_ok_production_blocked"
        elif head == "seeRisk":
            status = "research_only_blocked_for_product"
        elif selected and selected != "baseline":
            status = "shadow_only"
        else:
            status = "production_blocked"
        results[head] = {
            "status": status,
            "selectedModel": selected,
            "modelFamily": model_family,
            "headPromotableInSyntheticBenchmark": bool(item.get("headPromotable")),
            "validation": {
                "rocAuc": validation.get("rocAuc"),
                "brier": validation.get("brier"),
                "averagePrecision": validation.get("averagePrecision"),
            },
            "test": {
                "rocAuc": test.get("rocAuc"),
                "brier": test.get("brier"),
                "averagePrecision": test.get("averagePrecision"),
            },
            "fairnessPassedInAggregateValidation": fairness_passed,
            "blockers": blockers,
        }
    return results


def normalize_benchmark_decision(metrics: dict[str, Any] | None) -> dict[str, Any]:
    decision = (((metrics or {}).get("promotion") or {}).get("decision"))
    if decision == "promote-as-primary":
        synthetic = "candidate_passed"
    elif decision:
        synthetic = decision.replace("-", "_")
    else:
        synthetic = "unknown"
    return {
        "rawTrainingPromotionDecision": decision,
        "syntheticBenchmarkDecision": synthetic,
        "productionServingAllowed": False,
        "deploymentStatus": "shadow_only" if synthetic == "candidate_passed" else "not_approved",
    }


def production_gates(
    metrics: dict[str, Any] | None,
    synthetic_quality: dict[str, Any] | None,
    policy_results: dict[str, Any] | None,
    header: list[str],
    real_validation: dict[str, Any] | None,
    ablation_report: dict[str, Any] | None,
    fairness_report: dict[str, Any] | None,
    workload_report: dict[str, Any] | None,
    governance: dict[str, Any] | None,
    explanation: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    gates: list[dict[str, Any]] = []
    gates.append(evidence_gate("artifacts.training_metrics", metrics is not None, "blocker", "training/metrics.json is required"))
    gates.append(evidence_gate("artifacts.synthetic_quality", synthetic_quality is not None, "blocker", "synthetic-quality.json is required"))
    gates.append(evidence_gate("artifacts.policy_results", policy_results is not None, "warning", "intervention-policy/policy-results.json improves workload/readiness context"))
    gates.append(evidence_gate(
        "feature_contract",
        bool(((synthetic_quality or {}).get("featureContract") or {}).get("passed")),
        "blocker",
        "v6 feature contract must pass",
        (synthetic_quality or {}).get("featureContract"),
    ))
    gates.append(evidence_gate(
        "temporal_leakage",
        bool(((synthetic_quality or {}).get("temporalLeakage") or {}).get("passed")),
        "blocker",
        "temporal leakage checks must pass",
        (synthetic_quality or {}).get("temporalLeakage"),
    ))
    gates.append(evidence_gate(
        "v6_semantics",
        bool(((synthetic_quality or {}).get("v6SemanticChecks") or {}).get("passed")),
        "blocker",
        "v6 stage, missingness, SEE-null, and backlog-credit semantics must pass",
        (synthetic_quality or {}).get("v6SemanticChecks"),
    ))
    gates.append(evidence_gate(
        "selection_protocol",
        bool(metrics and metrics.get("selectionDataset") == "validation" and metrics.get("finalTestUsedForSelection") is False),
        "blocker",
        "selection and gates must use validation only; final test must be reporting-only",
        {
            "selectionDataset": (metrics or {}).get("selectionDataset"),
            "finalTestUsedForSelection": (metrics or {}).get("finalTestUsedForSelection"),
        },
    ))
    real_passed = nested_bool(real_validation, [("productionValidationPassed",), ("summary", "productionValidationPassed")])
    gates.append(evidence_gate(
        "real_retrospective_validation",
        real_passed,
        "blocker",
        "real temporal validation is required before production ML deployment",
        real_validation,
    ))
    _, cal_gates = calibration_threshold_gates(metrics)
    gates.extend(cal_gates)
    aggregate_fairness = aggregate_fairness_pass(metrics)
    gates.append(evidence_gate(
        "aggregate_fairness_validation",
        aggregate_fairness["passed"],
        "blocker",
        "aggregate validation fairness must be available and pass for every head",
        aggregate_fairness,
    ))
    deep_fairness_passed = nested_bool(fairness_report, [("productionGate", "passed"), ("summary", "productionGatePassed")])
    gates.append(evidence_gate(
        "deep_fairness_review",
        deep_fairness_passed,
        "blocker",
        "deep fairness slices are required, especially for SEE risk",
        fairness_report,
    ))
    coverage = deployment_column_coverage(header)
    workload_passed = nested_bool(workload_report, [("productionGate", "passed"), ("summary", "productionGatePassed")])
    gates.append(evidence_gate(
        "deploy_grade_workload_identifiers",
        coverage["passed"],
        "blocker",
        "features/predictions must include student, course, semester, stage, section, role, and faculty identifiers",
        coverage,
    ))
    gates.append(evidence_gate(
        "queue_workload_evidence",
        workload_passed,
        "blocker",
        "role/faculty queue workload report must pass approved capacity limits",
        workload_report,
    ))
    ablation_passed = nested_bool(ablation_report, [("productionGate", "passed"), ("summary", "productionGatePassed")])
    gates.append(evidence_gate(
        "ablation_evidence",
        ablation_passed,
        "blocker",
        "ablations must prove feature-family value before optimized-product claims",
        ablation_report,
    ))
    explanation_passed = nested_bool(explanation, [("explanationParity", "passed"), ("productionGate", "passed")])
    selected_non_baseline = [
        head for head, item in ((metrics or {}).get("heads") or {}).items()
        if item.get("selectedModel") not in (None, "baseline")
    ]
    gates.append(evidence_gate(
        "explanation_parity",
        explanation_passed or not selected_non_baseline,
        "blocker",
        "non-baseline product serving requires explanations that match the served model family",
        {"selectedNonBaselineHeads": selected_non_baseline, "explanationEvidence": explanation},
    ))
    governance_passed = all([
        nested_bool(governance, [("thresholdPolicy", "approved"), ("thresholdPolicyApproved",)]),
        nested_bool(governance, [("humanReviewPolicy", "approved"), ("humanReviewPolicyApproved",)]),
        nested_bool(governance, [("monitoringPlan", "approved"), ("monitoringPlanApproved",)]),
        nested_bool(governance, [("rollbackPlan", "approved"), ("rollbackPlanApproved",)]),
    ])
    gates.append(evidence_gate(
        "governance_approvals",
        governance_passed,
        "blocker",
        "threshold policy, human-review policy, monitoring, and rollback approvals are required",
        governance,
    ))
    return gates


def research_gates(
    metrics: dict[str, Any] | None,
    synthetic_quality: dict[str, Any] | None,
    family_disjoint_metrics: dict[str, Any] | None,
    ablation_report: dict[str, Any] | None,
    fairness_report: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    ablation_complete = bool(ablation_report and ((ablation_report.get("summary") or {}).get("allTrainerRunsPassed") is True))
    fairness_complete = bool(fairness_report and ((fairness_report.get("summary") or {}).get("productionGatePassed") is True))
    return [
        evidence_gate("feature_contract", bool(((synthetic_quality or {}).get("featureContract") or {}).get("passed")), "blocker", "feature contract must pass"),
        evidence_gate("temporal_leakage", bool(((synthetic_quality or {}).get("temporalLeakage") or {}).get("passed")), "blocker", "temporal leakage checks must pass"),
        evidence_gate("v6_semantics", bool(((synthetic_quality or {}).get("v6SemanticChecks") or {}).get("passed")), "blocker", "v6 semantic checks must pass"),
        evidence_gate("claim_boundaries", bool(metrics and metrics.get("syntheticOnly") is True and metrics.get("productionServingClaimAllowed") is False and metrics.get("causalClaimAllowed") is False), "blocker", "synthetic/no-serving/no-causal claim boundaries must be explicit"),
        evidence_gate("selection_protocol", bool(metrics and metrics.get("selectionDataset") == "validation" and metrics.get("finalTestUsedForSelection") is False), "blocker", "final test must not be used for selection"),
        evidence_gate("family_disjoint_evidence", family_disjoint_metrics is not None, "warning", "family-disjoint metrics strengthen research claims"),
        evidence_gate("ablation_evidence", ablation_complete, "warning", "completed trainer-backed ablations are required before feature-redesign claims", (ablation_report or {}).get("summary")),
        evidence_gate("deep_fairness_evidence", fairness_complete, "warning", "deep fairness evidence must pass before fairness-sensitive claims", (fairness_report or {}).get("summary")),
    ]


def markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# AirMentor Product and Research Readiness",
        "",
        f"Generated: `{report['generatedAt']}`",
        "",
        "## Decisions",
        "",
        f"- **Production deploy allowed:** `{str(report['productionDecision']['deployAllowed']).lower()}`",
        f"- **Production deployment status:** `{report['productionDecision']['deploymentStatus']}`",
        f"- **Research status:** `{report['researchDecision']['status']}`",
        f"- **Internal synthetic research use allowed:** `{str(report['researchDecision']['internalSyntheticResearchUseAllowed']).lower()}`",
        "",
        "## Normalized benchmark decision",
        "",
        "```json",
        json.dumps(report["normalizedBenchmarkDecision"], indent=2, sort_keys=True),
        "```",
        "",
        "## Production blockers",
        "",
    ]
    blockers = report["productionDecision"].get("blockers", [])
    if blockers:
        lines.extend([f"- **{item['name']}:** {item['message']}" for item in blockers])
    else:
        lines.append("- **None:** all production gates passed")
    lines.extend(["", "## Research blockers and warnings", ""])
    for item in report["researchDecision"].get("gates", []):
        if item["passed"]:
            continue
        lines.append(f"- **{item['severity']} / {item['name']}:** {item['message']}")
    lines.extend(["", "## Per-head status", "", "| Head | Status | Selected | Validation AUC | Test AUC | Main blockers |", "|---|---|---:|---:|---:|---|"])
    for head, item in report["headReadiness"].items():
        blockers_text = "; ".join(item.get("blockers") or []) or "none"
        lines.append(
            f"| `{head}` | `{item.get('status')}` | `{item.get('selectedModel')}` | "
            f"{item.get('validation', {}).get('rocAuc')} | {item.get('test', {}).get('rocAuc')} | {blockers_text} |"
        )
    lines.extend(["", "## Required next evidence", ""])
    for item in report["requiredNextEvidence"]:
        lines.append(f"- **{item['title']}:** {item['reason']}")
    lines.append("")
    return "\n".join(lines)


def required_next_evidence(
    ablation_report: dict[str, Any] | None,
    fairness_report: dict[str, Any] | None,
    workload_report: dict[str, Any] | None,
) -> list[dict[str, str]]:
    items = [
        {"title": "Real retrospective validation", "reason": "synthetic benchmark evidence cannot establish real teacher-intervention safety"},
    ]
    ablation_complete = bool(ablation_report and ((ablation_report.get("summary") or {}).get("allTrainerRunsPassed") is True))
    if ablation_complete:
        items.append({"title": "Ablation delta sign-off", "reason": "completed feature-family deltas need product/risk review before optimized-product claims"})
    else:
        items.append({"title": "Trainer-backed ablation suite", "reason": "feature-family value must be proven before optimized-product claims"})
    fairness_passed = bool(fairness_report and ((fairness_report.get("productionGate") or {}).get("passed") is True))
    if not fairness_passed:
        items.append({"title": "SEE fairness remediation", "reason": "SEE risk is missingness- and eligibility-sensitive and deep fairness evidence must pass"})
    if workload_report:
        missing = (workload_report.get("summary") or {}).get("missingColumnFamilies") or workload_report.get("missingColumnFamilies") or []
        workload_passed = bool((workload_report.get("productionGate") or {}).get("passed") is True)
        if missing:
            items.append({"title": "Queue workload identifiers", "reason": f"workload evidence is missing deploy-grade identifier families: {missing}"})
        elif not workload_passed:
            items.append({"title": "Queue capacity approval", "reason": "workload identifiers are present, but role/faculty top-k capacity checks still exceed approved limits"})
    else:
        items.append({"title": "Queue workload report", "reason": "teacher capacity needs role/faculty/student/course identifiers and approved budgets"})
    items.extend([
        {"title": "Threshold calibration at 0.65", "reason": "current local calibration reports 0.4 and 0.85, not the product high threshold"},
        {"title": "Governance approvals", "reason": "thresholds, human review, monitoring, and rollback must be signed off"},
    ])
    return items


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    run_dir = Path(args.run_dir)
    metrics_path = resolve_path(run_dir, args.training_metrics, "training/metrics.json")
    family_disjoint_path = resolve_path(run_dir, args.family_disjoint_metrics, "training-family-disjoint/metrics.json")
    synthetic_quality_path = resolve_path(run_dir, args.synthetic_quality, "synthetic-quality.json")
    policy_path = resolve_path(run_dir, args.policy_results, "intervention-policy/policy-results.json")
    features_path = resolve_path(run_dir, args.features_csv, "features.csv")
    metrics = load_json(metrics_path)
    family_disjoint_metrics = load_json(family_disjoint_path)
    synthetic_quality = load_json(synthetic_quality_path)
    policy_results = load_json(policy_path)
    real_validation = load_json(Path(args.real_validation)) if args.real_validation else None
    ablation_report = load_json(Path(args.ablation_report)) if args.ablation_report else None
    fairness_report = load_json(Path(args.fairness_report)) if args.fairness_report else None
    workload_report = load_json(Path(args.workload_report)) if args.workload_report else None
    governance = load_json(Path(args.governance_evidence)) if args.governance_evidence else None
    explanation = load_json(Path(args.explanation_evidence)) if args.explanation_evidence else None
    header = read_header(features_path)
    prod_gates = production_gates(metrics, synthetic_quality, policy_results, header, real_validation, ablation_report, fairness_report, workload_report, governance, explanation)
    blocker_gates = [gate for gate in prod_gates if gate["severity"] == "blocker" and not gate["passed"]]
    res_gates = research_gates(metrics, synthetic_quality, family_disjoint_metrics, ablation_report, fairness_report)
    research_core_passed = all(gate["passed"] for gate in res_gates if gate["severity"] == "blocker")
    report = {
        "generatedAt": now_iso(),
        "runDir": str(run_dir),
        "inputs": {
            "metrics": str(metrics_path) if metrics_path else None,
            "familyDisjointMetrics": str(family_disjoint_path) if family_disjoint_path else None,
            "syntheticQuality": str(synthetic_quality_path) if synthetic_quality_path else None,
            "policyResults": str(policy_path) if policy_path else None,
            "featuresCsv": str(features_path) if features_path else None,
            "realValidation": args.real_validation,
            "ablationReport": args.ablation_report,
            "fairnessReport": args.fairness_report,
            "workloadReport": args.workload_report,
            "selectedPredictions": args.selected_predictions,
            "governanceEvidence": args.governance_evidence,
            "explanationEvidence": args.explanation_evidence,
        },
        "normalizedBenchmarkDecision": normalize_benchmark_decision(metrics),
        "productionDecision": {
            "deployAllowed": not blocker_gates,
            "deploymentStatus": "production_allowed" if not blocker_gates else "blocked_shadow_only",
            "blockers": blocker_gates,
            "gates": prod_gates,
        },
        "researchDecision": {
            "status": "internal_synthetic_benchmark_usable" if research_core_passed else "blocked",
            "internalSyntheticResearchUseAllowed": research_core_passed,
            "strongResearchOrRealWorldClaimAllowed": False,
            "gates": res_gates,
        },
        "headReadiness": head_readiness(metrics),
        "requiredNextEvidence": required_next_evidence(ablation_report, fairness_report, workload_report),
    }
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Aggregate AirMentor product/research readiness gates for an offline benchmark run.")
    parser.add_argument("--run-dir", required=True, help="Benchmark run directory.")
    parser.add_argument("--training-metrics")
    parser.add_argument("--family-disjoint-metrics")
    parser.add_argument("--synthetic-quality")
    parser.add_argument("--policy-results")
    parser.add_argument("--features-csv")
    parser.add_argument("--real-validation")
    parser.add_argument("--ablation-report")
    parser.add_argument("--fairness-report")
    parser.add_argument("--workload-report")
    parser.add_argument("--selected-predictions")
    parser.add_argument("--governance-evidence")
    parser.add_argument("--explanation-evidence")
    parser.add_argument("--output-json")
    parser.add_argument("--output-md")
    parser.add_argument("--fail-on-production-blockers", action="store_true")
    args = parser.parse_args()
    run_dir = Path(args.run_dir)
    report = build_report(args)
    output_json = Path(args.output_json) if args.output_json else run_dir / "product-readiness.json"
    output_md = Path(args.output_md) if args.output_md else run_dir / "product-readiness.md"
    write_json(output_json, report)
    output_md.parent.mkdir(parents=True, exist_ok=True)
    output_md.write_text(markdown_report(report), encoding="utf-8")
    print(f"Wrote {output_json}")
    print(f"Wrote {output_md}")
    if args.fail_on_production_blockers and not report["productionDecision"]["deployAllowed"]:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
