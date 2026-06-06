#!/usr/bin/env python3
"""Cleanup stale artifacts from AirMentor repo. DRY RUN by default, use --execute to actually delete."""

import argparse
import os
import shutil
from pathlib import Path
from datetime import datetime, timedelta

REPO_ROOT = Path("/home/raed/Projects/air-mentor-ui")
API_ROOT = REPO_ROOT / "air-mentor-api"

def stale_patch_files():
    """find stale patch/scratch files"""
    patterns = [
        API_ROOT / "fix_errors_*.py",
        API_ROOT / "fix_runtime_routes*.cjs",
        API_ROOT / "patch_*.py",
        API_ROOT / "patch_*.sh",
        API_ROOT / "*_patch.py",
        API_ROOT / "debug_*.py",
        API_ROOT / "*.bak",
        API_ROOT / "*.orig",
        API_ROOT / "airmentor-*-*.json",
    ]
    import glob
    files = []
    for p in patterns:
        files.extend(glob.glob(str(p), recursive=False))
    return [Path(f) for f in files]

def old_benchmark_runs(keep_latest=3):
    """find old sota-policy-benchmark runs"""
    prm = API_ROOT / "output" / "proof-risk-model"
    runs = sorted([d for d in prm.iterdir() if d.is_dir() and "sota-policy-benchmark-" in d.name], key=lambda x: x.name)
    if len(runs) <= keep_latest:
        return []
    return runs[:-keep_latest]

def old_smoke_runs():
    """find old smoke benchmark runs"""
    prm = API_ROOT / "output" / "proof-risk-model"
    smoke_dirs = [d for d in prm.iterdir() if d.is_dir() and "smoke" in d.name.lower()]
    return smoke_dirs

def old_feature_csvs():
    """find old feature CSV dumps"""
    prm = API_ROOT / "output" / "proof-risk-model"
    files = [f for f in prm.iterdir() if f.is_file() and f.suffix == ".csv" and "features" in f.name]
    return files

def catboost_info():
    """catboost training artifacts"""
    dirs = [API_ROOT / "catboost_info"]
    files = []
    for d in dirs:
        if d.exists():
            files.extend(d.iterdir())
    return files

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true", help="Actually delete files")
    parser.add_argument(
        "--include-old-benchmarks",
        action="store_true",
        help="Include old benchmark directories. Preserve model artifacts and manifests first.",
    )
    parser.add_argument(
        "--include-training-corpora",
        action="store_true",
        help="Include root feature CSVs. Preserve a compressed, checksummed copy first.",
    )
    args = parser.parse_args()

    all_to_delete = []
    all_to_delete.extend([("stale_patch", f) for f in stale_patch_files()])
    all_to_delete.extend([("old_smoke", d) for d in old_smoke_runs()])
    all_to_delete.extend([("catboost_info", f) for f in catboost_info()])
    if args.include_old_benchmarks:
        all_to_delete.extend([("old_benchmark", d) for d in old_benchmark_runs(keep_latest=3)])
    if args.include_training_corpora:
        all_to_delete.extend([("old_feature_csv", f) for f in old_feature_csvs()])

    total_size = 0
    for kind, path in all_to_delete:
        try:
            if path.is_file():
                size = path.stat().st_size
            elif path.is_dir():
                size = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
            else:
                size = 0
            total_size += size
            size_mb = size / (1024 * 1024)
            action = "DELETE" if args.execute else "WOULD DELETE"
            print(f"[{action}] [{kind}] {path} ({size_mb:.1f} MB)")
            if args.execute:
                if path.is_file():
                    path.unlink()
                elif path.is_dir():
                    shutil.rmtree(path)
        except Exception as e:
            print(f"[ERROR] {path}: {e}")

    print(f"\nTotal: {len(all_to_delete)} items, {total_size / (1024*1024*1024):.2f} GB")
    if not args.execute:
        print("(DRY RUN — use --execute to actually delete)")

if __name__ == "__main__":
    main()
