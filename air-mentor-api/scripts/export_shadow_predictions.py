#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


HEADS = [
    "attendanceRisk",
    "ceRisk",
    "seeRisk",
    "overallCourseRisk",
    "downstreamCarryoverRisk",
]


def split_frame(df: pd.DataFrame, split: str) -> pd.DataFrame:
    if "split" not in df.columns:
        raise ValueError("features CSV must include split column")
    if split == "validation":
        return df[df["split"].isin(["validation", "val"])].copy()
    return df[df["split"] == split].copy()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def selected_model_for_head(benchmark: dict[str, Any], head: str, selection_key: str) -> str | None:
    payload = (benchmark.get("heads") or {}).get(head) or {}
    selected = payload.get(selection_key)
    if selected:
        return str(selected)
    models = payload.get("models") or {}
    ok_models = {
        name: model for name, model in models.items()
        if isinstance(model, dict) and model.get("status") == "ok"
    }
    if not ok_models:
        return None
    return max(ok_models.items(), key=lambda item: (item[1].get("validation") or {}).get("rocAuc") or 0.0)[0]


def export_predictions(args: argparse.Namespace) -> dict[str, Any]:
    features_csv = Path(args.features_csv)
    shadow_dir = Path(args.shadow_dir)
    benchmark = load_json(Path(args.benchmark_results) if args.benchmark_results else shadow_dir / "benchmark-results.json")
    df = pd.read_csv(features_csv)
    out = split_frame(df, args.split).reset_index(drop=True)
    split_suffix = "val" if args.split == "validation" else args.split
    exported: dict[str, Any] = {}
    for head in HEADS:
        model = selected_model_for_head(benchmark, head, args.selection_key)
        if not model:
            exported[head] = {"status": "missing_model_selection"}
            continue
        npy_path = shadow_dir / "predictions" / head / f"{model}_{split_suffix}.npy"
        if not npy_path.exists():
            exported[head] = {"status": "missing_prediction_file", "model": model, "path": str(npy_path)}
            continue
        probs = np.load(npy_path).astype(float)
        if len(probs) != len(out):
            raise ValueError(f"prediction length mismatch for {head}/{model}: predictions={len(probs)} rows={len(out)}")
        out[f"prob_{head}"] = np.clip(probs, 0.0001, 0.9999)
        out[f"model_{head}"] = model
        exported[head] = {"status": "ok", "model": model, "path": str(npy_path), "rows": int(len(probs))}
    output_csv = Path(args.output_csv)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(output_csv, index=False)
    sidecar = {
        "featuresCsv": str(features_csv),
        "shadowDir": str(shadow_dir),
        "benchmarkResults": str(Path(args.benchmark_results) if args.benchmark_results else shadow_dir / "benchmark-results.json"),
        "split": args.split,
        "selectionKey": args.selection_key,
        "outputCsv": str(output_csv),
        "rows": int(len(out)),
        "exportedHeads": exported,
        "productionServingClaimAllowed": False,
        "deploymentStatus": "shadow_only",
    }
    sidecar_path = Path(args.output_json) if args.output_json else output_csv.with_suffix(".json")
    sidecar_path.write_text(json.dumps(sidecar, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
    return sidecar


def main() -> int:
    parser = argparse.ArgumentParser(description="Join AirMentor shadow benchmark .npy predictions onto feature CSV rows.")
    parser.add_argument("--features-csv", required=True)
    parser.add_argument("--shadow-dir", required=True)
    parser.add_argument("--benchmark-results")
    parser.add_argument("--split", choices=["validation", "test"], default="test")
    parser.add_argument("--selection-key", default="selectedByValidationAuc")
    parser.add_argument("--output-csv", required=True)
    parser.add_argument("--output-json")
    args = parser.parse_args()
    sidecar = export_predictions(args)
    print(f"Wrote {sidecar['outputCsv']}")
    print(f"Wrote {args.output_json or Path(args.output_csv).with_suffix('.json')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
