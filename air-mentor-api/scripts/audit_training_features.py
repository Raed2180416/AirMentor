#!/usr/bin/env python3
"""
Audit CatBoost training data features and class balance.

Usage:
    python audit_training_features.py <features_csv>

Outputs:
    - Feature registry JSON with provenance
    - Class balance report
    - Missingness analysis
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import numpy as np
    import pandas as pd
except ModuleNotFoundError as exc:
    print(f"[audit] ERROR: missing dependency '{exc.name}'. Install: pip install pandas numpy")
    sys.exit(1)


def audit_features(df: pd.DataFrame) -> dict:
    """Audit feature columns from training CSV."""
    feature_cols = [c for c in df.columns if c.startswith("feat_")]
    
    features = []
    for col in feature_cols:
        series = df[col]
        missing_count = series.isna().sum()
        missing_rate = missing_count / len(series)
        
        features.append({
            "columnName": col,
            "index": int(col.split("_", 1)[1]),
            "type": "float32",
            "count": int(len(series)),
            "missingCount": int(missing_count),
            "missingRate": round(float(missing_rate), 4),
            "mean": round(float(series.mean()), 4) if missing_count < len(series) else None,
            "std": round(float(series.std()), 4) if missing_count < len(series) else None,
            "min": round(float(series.min()), 4) if missing_count < len(series) else None,
            "max": round(float(series.max()), 4) if missing_count < len(series) else None,
        })
    
    return {
        "featureCount": len(features),
        "features": features,
    }


def audit_class_balance(df: pd.DataFrame) -> dict:
    """Audit class balance across all label columns."""
    label_cols = [c for c in df.columns if c.startswith("label_")]
    
    balance_report = {}
    for col in label_cols:
        counts = df[col].value_counts().to_dict()
        total = len(df[col])
        pos_rate = counts.get(1, 0) / total if total > 0 else 0
        
        balance_report[col] = {
            "total": int(total),
            "positive": int(counts.get(1, 0)),
            "negative": int(counts.get(0, 0)),
            "positiveRate": round(float(pos_rate), 4),
            "balanced": 0.3 <= pos_rate <= 0.7,  # Heuristic: 30-70% is balanced
        }
    
    return balance_report


def audit_scenario_families(df: pd.DataFrame) -> dict:
    """Audit scenario family distribution for training diversity."""
    if "scenario_family" not in df.columns:
        return {"error": "No scenario_family column found"}
    
    family_counts = df["scenario_family"].value_counts().to_dict()
    total = len(df)
    
    return {
        "totalRows": int(total),
        "families": {k: int(v) for k, v in family_counts.items()},
        "familyRates": {k: round(v/total, 4) for k, v in family_counts.items()},
        "diverse": len(family_counts) >= 3,  # At least 3 different families
    }


def audit_splits(df: pd.DataFrame) -> dict:
    """Audit train/val/test split integrity."""
    if "split" not in df.columns:
        return {"error": "No split column found"}
    
    split_counts = df["split"].value_counts().to_dict()
    
    # Check run_id leakage
    leakage_report = {}
    if "run_id" in df.columns:
        for split_a in ["train", "validation", "test"]:
            for split_b in ["train", "validation", "test"]:
                if split_a >= split_b:
                    continue
                runs_a = set(df[df["split"] == split_a]["run_id"].dropna())
                runs_b = set(df[df["split"] == split_b]["run_id"].dropna())
                overlap = runs_a & runs_b
                if overlap:
                    leakage_report[f"{split_a}_{split_b}"] = list(overlap)[:5]
    
    return {
        "splitCounts": {k: int(v) for k, v in split_counts.items()},
        "leakage": leakage_report if leakage_report else None,
        "integrity": "PASS" if not leakage_report else "FAIL",
    }


def main():
    parser = argparse.ArgumentParser(description="Audit CatBoost training features")
    parser.add_argument("features_csv", help="Path to features CSV")
    parser.add_argument("--output", "-o", default=None, help="Output JSON path")
    args = parser.parse_args()
    
    if not Path(args.features_csv).exists():
        print(f"[audit] ERROR: File not found: {args.features_csv}")
        sys.exit(1)
    
    print(f"[audit] Reading {args.features_csv}...")
    df = pd.read_csv(args.features_csv)
    print(f"[audit] Loaded {len(df)} rows, {len(df.columns)} columns")
    
    report = {
        "auditVersion": "1.0.0",
        "sourceFile": args.features_csv,
        "rowCount": int(len(df)),
        "featureAudit": audit_features(df),
        "classBalance": audit_class_balance(df),
        "scenarioFamilyAudit": audit_scenario_families(df),
        "splitAudit": audit_splits(df),
    }
    
    # Summary
    print(f"[audit] Features: {report['featureAudit']['featureCount']}")
    print(f"[audit] Scenario families: {len(report['scenarioFamilyAudit'].get('families', {}))}")
    print(f"[audit] Split integrity: {report['splitAudit']['integrity']}")
    
    # Check for class imbalance issues
    for label, stats in report["classBalance"].items():
        status = "✅" if stats["balanced"] else "⚠️"
        print(f"[audit] {status} {label}: {stats['positiveRate']:.1%} positive")
    
    # Output
    if args.output:
        with open(args.output, "w") as f:
            json.dump(report, f, indent=2)
        print(f"[audit] Wrote report to {args.output}")
    else:
        print(json.dumps(report, indent=2))
    
    return report


if __name__ == "__main__":
    main()
