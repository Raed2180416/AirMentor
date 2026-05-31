#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable


ABLATIONS = [
    {
        "id": "full-v6-reference",
        "title": "Full v6 reference",
        "zeroFeatures": [],
        "stageFilter": None,
        "description": "Unmodified v6 feature set.",
    },
    {
        "id": "no-backlog-credit-v6",
        "title": "No backlog-credit v6 features",
        "zeroFeatures": [4, 44, 45, 46, 47],
        "stageFilter": None,
        "description": "Zero active backlog credit pressure, historical backlog burden, lower-year blocker pressure, and backlog sensitivity.",
    },
    {
        "id": "v5-backlog-proxy-only",
        "title": "v5-like backlog proxy only",
        "zeroFeatures": [44, 45, 46, 47],
        "stageFilter": None,
        "description": "Retain legacy backlogPressureScaled while removing v6 credit-specific backlog features.",
    },
    {
        "id": "no-missingness-flags",
        "title": "No missingness flags",
        "zeroFeatures": [37, 38, 39, 40, 41, 42, 43],
        "stageFilter": None,
        "description": "Zero CGPA, backlog, TT1, TT2, SEE, quiz, and assignment missingness flags.",
    },
    {
        "id": "no-stage-flags",
        "title": "No stage progress or flags",
        "zeroFeatures": [25, 26, 27, 28, 29, 30],
        "stageFilter": None,
        "description": "Zero semesterProgressScaled and stage one-hot features.",
    },
    {
        "id": "no-interactions",
        "title": "No interaction features",
        "zeroFeatures": [32, 33, 34, 35, 36],
        "stageFilter": None,
        "description": "Zero compound interaction features.",
    },
    {
        "id": "early-warning-only",
        "title": "Early warning rows only",
        "zeroFeatures": [],
        "stageFilter": ["pre-tt1", "post-tt1", "post-tt2", "post-assignments"],
        "description": "Exclude post-SEE rows to evaluate pre-outcome intervention windows.",
    },
]


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")


def sorted_feature_columns(fieldnames: list[str]) -> list[str]:
    return sorted([name for name in fieldnames if name.startswith("feat_")], key=lambda item: int(item.split("_", 1)[1]))


def transform_csv(input_csv: Path, output_csv: Path, zero_features: list[int], stage_filter: list[str] | None, ablation_id: str = "") -> dict[str, Any]:
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    zero_columns = {f"feat_{idx}" for idx in zero_features}
    input_rows = 0
    output_rows = 0
    stage_counts: dict[str, int] = {}
    with input_csv.open("r", encoding="utf-8", newline="") as src, output_csv.open("w", encoding="utf-8", newline="") as dst:
        reader = csv.DictReader(src)
        if not reader.fieldnames:
            raise ValueError(f"CSV has no header: {input_csv}")
        writer = csv.DictWriter(dst, fieldnames=reader.fieldnames)
        writer.writeheader()
        for row in reader:
            input_rows += 1
            stage = row.get("stage_key") or row.get("stageKey") or "unknown"
            if stage_filter is not None and stage not in stage_filter:
                continue
            original_feat_47 = row.get("feat_47", "0.0")
            for col in zero_columns:
                if col in row:
                    row[col] = "0.0"

            output_rows += 1
            stage_counts[stage] = stage_counts.get(stage, 0) + 1
            writer.writerow(row)
    return {
        "inputRows": input_rows,
        "outputRows": output_rows,
        "zeroColumns": sorted(zero_columns, key=lambda item: int(item.split("_", 1)[1])),
        "stageFilter": stage_filter,
        "stageCounts": stage_counts,
        "outputCsv": str(output_csv),
    }


def existing_trainer_result(output_dir: Path) -> dict[str, Any] | None:
    metrics_path = output_dir / "metrics.json"
    if not metrics_path.exists():
        return None
    return {
        "returnCode": 0,
        "metricsPath": str(metrics_path),
        "passed": True,
        "skippedExisting": True,
    }


def run_trainer(python: str, trainer: Path, csv_path: Path, output_dir: Path, device: str, family_disjoint: bool, force_rerun: bool) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [python, str(trainer), str(csv_path), str(output_dir), "--device", device]
    if family_disjoint:
        cmd.append("--family-disjoint")
    if not force_rerun:
        existing = existing_trainer_result(output_dir)
        if existing is not None:
            existing["command"] = cmd
            return existing
    proc = subprocess.run(cmd, text=True, capture_output=True)
    return {
        "command": cmd,
        "returnCode": proc.returncode,
        "stdoutTail": proc.stdout[-4000:],
        "stderrTail": proc.stderr[-4000:],
        "metricsPath": str(output_dir / "metrics.json"),
        "passed": proc.returncode == 0,
    }


def metrics_delta(reference: dict[str, Any] | None, candidate: dict[str, Any] | None) -> dict[str, Any] | None:
    if not reference or not candidate:
        return None
    deltas: dict[str, Any] = {}
    for head, ref_head in (reference.get("heads") or {}).items():
        cand_head = (candidate.get("heads") or {}).get(head) or {}
        ref_test = ((ref_head.get("challenger") or {}).get("test") or {})
        cand_test = ((cand_head.get("challenger") or {}).get("test") or {})
        deltas[head] = {
            "rocAucDelta": safe_float(cand_test.get("rocAuc")) - safe_float(ref_test.get("rocAuc")),
            "brierDelta": safe_float(cand_test.get("brier")) - safe_float(ref_test.get("brier")),
            "averagePrecisionDelta": safe_float(cand_test.get("averagePrecision")) - safe_float(ref_test.get("averagePrecision")),
            "referenceSelectedModel": ref_head.get("selectedModel"),
            "candidateSelectedModel": cand_head.get("selectedModel"),
        }
    return deltas


def safe_float(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def markdown_report(report: dict[str, Any]) -> str:
    def fmt_delta(value: Any) -> str:
        if value is None:
            return "—"
        try:
            return f"{float(value):+.4f}"
        except Exception:
            return "—"

    lines = [
        "# AirMentor Ablation Suite",
        "",
        f"Features CSV: `{report['featuresCsv']}`",
        f"Execution mode: `{report['executionMode']}`",
        "",
        "## Ablations",
        "",
        "| Ablation | Output rows | Trainer | Purpose |",
        "|---|---:|---|---|",
    ]
    for item in report["ablations"]:
        transform = item.get("transform") or {}
        trainer = item.get("trainer") or {}
        output_rows = transform.get("outputRows")
        if output_rows is None:
            output_rows = "existing" if Path(item["outputCsv"]).exists() else "not generated"
        lines.append(
            f"| `{item['id']}` | {output_rows} | "
            f"{trainer.get('returnCode', 'not run')} | {item['description']} |"
        )
    if any(item.get("deltaVsFullV6Reference") for item in report["ablations"]):
        lines.extend([
            "",
            "## Test metric deltas vs full v6 reference",
            "",
            "| Ablation | Head | ROC AUC Δ | AP Δ | Brier Δ | Selected model |",
            "|---|---|---:|---:|---:|---|",
        ])
        for item in report["ablations"]:
            if item["id"] == "full-v6-reference":
                continue
            deltas = item.get("deltaVsFullV6Reference") or {}
            for head in ["attendanceRisk", "ceRisk", "seeRisk", "overallCourseRisk", "downstreamCarryoverRisk"]:
                delta = deltas.get(head) or {}
                lines.append(
                    f"| `{item['id']}` | `{head}` | {fmt_delta(delta.get('rocAucDelta'))} | "
                    f"{fmt_delta(delta.get('averagePrecisionDelta'))} | {fmt_delta(delta.get('brierDelta'))} | "
                    f"`{delta.get('candidateSelectedModel') or '—'}` |"
                )
    lines.extend(["", "## Production gate", "", f"Passed: `{str(report['productionGate']['passed']).lower()}`", ""])
    for reason in report["productionGate"].get("blockedReasons", []):
        lines.append(f"- **Blocked:** {reason}")
    lines.append("")
    return "\n".join(lines)


def build_plan(args: argparse.Namespace) -> dict[str, Any]:
    features_csv = Path(args.features_csv)
    output_dir = Path(args.output_dir)
    trainer = Path(args.trainer)
    ablation_reports: list[dict[str, Any]] = []
    if not features_csv.exists():
        raise FileNotFoundError(features_csv)
    with features_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
    feature_columns = sorted_feature_columns(fieldnames)
    for spec in ABLATIONS:
        item = dict(spec)
        item["featureColumnsAvailable"] = len(feature_columns)
        item["outputCsv"] = str(output_dir / "csv" / f"{spec['id']}.csv")
        item["trainingOutputDir"] = str(output_dir / "training" / spec["id"])
        output_csv_path = Path(item["outputCsv"])
        training_output_dir = Path(item["trainingOutputDir"])
        if args.execute:
            transform = transform_csv(
                features_csv,
                output_csv_path,
                spec["zeroFeatures"],
                spec["stageFilter"],
                spec["id"],
            )
            item["transform"] = transform
        if args.run_trainer:
            item["trainer"] = run_trainer(
                args.python,
                trainer,
                output_csv_path,
                training_output_dir,
                args.device,
                args.family_disjoint,
                args.force_trainer_rerun,
            )
        else:
            existing = existing_trainer_result(training_output_dir)
            if existing is not None:
                item["trainer"] = existing
        ablation_reports.append(item)
    reference_metrics = load_json(output_dir / "training" / "full-v6-reference" / "metrics.json")
    for item in ablation_reports:
        candidate_metrics = load_json(Path(item["trainingOutputDir"]) / "metrics.json")
        item["deltaVsFullV6Reference"] = metrics_delta(reference_metrics, candidate_metrics)
    trainer_runs = [item.get("trainer") for item in ablation_reports if item.get("trainer")]
    completed_runs = [item["id"] for item in ablation_reports if (item.get("trainer") or {}).get("passed")]
    pending_runs = [item["id"] for item in ablation_reports if not (item.get("trainer") or {}).get("passed")]
    all_trained = len(completed_runs) == len(ablation_reports)
    report = {
        "featuresCsv": str(features_csv),
        "outputDir": str(output_dir),
        "executionMode": "execute" if args.execute else "plan_only",
        "trainerExecuted": bool(args.run_trainer and args.execute),
        "featureColumns": feature_columns,
        "ablations": ablation_reports,
        "productionGate": {
            "passed": False,
            "blockedReasons": [
                "ablation deltas must be reviewed by product head and risk head before production claims",
                "real validation and workload gates remain required even if ablations pass",
            ] if all_trained else [
                "ablation suite has not completed trainer runs for all ablations",
                "real validation and workload gates remain required even if ablations pass",
            ],
        },
        "summary": {
            "productionGatePassed": False,
            "allTrainerRunsPassed": all_trained,
            "completedTrainerRuns": completed_runs,
            "pendingTrainerRuns": pending_runs,
        },
    }
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Plan or execute AirMentor feature-family ablations.")
    parser.add_argument("--features-csv", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--trainer", default=str(Path(__file__).resolve().parent / "train_sota_ensemble.py"))
    parser.add_argument("--python", default=sys.executable)
    parser.add_argument("--device", choices=["cpu", "cuda"], default="cpu")
    parser.add_argument("--family-disjoint", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--run-trainer", action="store_true")
    parser.add_argument("--force-trainer-rerun", action="store_true")
    parser.add_argument("--output-json")
    parser.add_argument("--output-md")
    args = parser.parse_args()
    report = build_plan(args)
    output_dir = Path(args.output_dir)
    output_json = Path(args.output_json) if args.output_json else output_dir / "ablation-suite.json"
    output_md = Path(args.output_md) if args.output_md else output_dir / "ablation-suite.md"
    write_json(output_json, report)
    output_md.parent.mkdir(parents=True, exist_ok=True)
    output_md.write_text(markdown_report(report), encoding="utf-8")
    print(f"Wrote {output_json}")
    print(f"Wrote {output_md}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
