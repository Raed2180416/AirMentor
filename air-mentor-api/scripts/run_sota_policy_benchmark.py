#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
API_ROOT = REPO_ROOT / "air-mentor-api"
SCRIPT_DIR = API_ROOT / "scripts"
OUTPUT_ROOT = API_ROOT / "output" / "proof-risk-model"
MIN_FREE_DISK_GB = 40.0
WARN_FREE_DISK_GB = 80.0
HEAVY_PACKAGES = ["tabpfn", "autogluon", "pytabkit"]
REQUIRED_FEATURE_SCHEMA_VERSION = "observable-risk-features-v6"


def now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def gb(value: int | float) -> float:
    return float(value) / (1024.0 ** 3)


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


def feature_schema_contract() -> dict[str, Any]:
    source = API_ROOT / "src/lib/proof-risk-model.ts"
    version = read_ts_string_const(source, "RISK_FEATURE_SCHEMA_VERSION")
    keys = read_ts_const_string_array(source, "OBSERVABLE_FEATURE_KEYS")
    return {
        "name": version,
        "featureSchemaVersion": version,
        "requiredFeatureSchemaVersion": REQUIRED_FEATURE_SCHEMA_VERSION,
        "source": str(source),
        "featureCount": len(keys),
        "featureKeyHash": sha256_json(keys),
        "featureKeys": keys,
    }


def read_meminfo() -> dict[str, float]:
    info: dict[str, float] = {}
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            key, raw = line.split(":", 1)
            parts = raw.strip().split()
            if parts and parts[0].isdigit():
                info[key] = int(parts[0]) / (1024.0 ** 2)
    except Exception:
        pass
    return info


def run_command(cmd: list[str], cwd: Path, log_path: Path | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    printable = " ".join(cmd)
    print(f"[benchmark] $ {printable}", flush=True)
    started = time.time()
    proc = subprocess.run(cmd, cwd=str(cwd), text=True, capture_output=True)
    elapsed = time.time() - started
    content = [
        f"$ {printable}",
        f"exit_code={proc.returncode}",
        f"elapsed_seconds={elapsed:.2f}",
        "--- stdout ---",
        proc.stdout,
        "--- stderr ---",
        proc.stderr,
        "",
    ]
    if log_path is not None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write("\n".join(content))
    if check and proc.returncode != 0:
        print(proc.stdout, end="")
        print(proc.stderr, end="", file=sys.stderr)
        raise RuntimeError(f"command failed: {printable}")
    return proc


def gpu_snapshot() -> dict[str, Any]:
    query = [
        "nvidia-smi",
        "--query-gpu=name,memory.total,memory.free,driver_version",
        "--format=csv,noheader,nounits",
    ]
    try:
        proc = subprocess.run(query, text=True, capture_output=True, timeout=10)
    except Exception as exc:
        return {"available": False, "reason": str(exc)}
    if proc.returncode != 0:
        return {"available": False, "reason": proc.stderr.strip() or "nvidia-smi failed"}
    rows = []
    for line in proc.stdout.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 4:
            rows.append({
                "name": parts[0],
                "memoryTotalMiB": int(float(parts[1])),
                "memoryFreeMiB": int(float(parts[2])),
                "driverVersion": parts[3],
            })
    return {"available": bool(rows), "gpus": rows}


def preflight(output_dir: Path, min_free_disk_gb: float) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    usage = shutil.disk_usage(output_dir)
    mem = read_meminfo()
    gpu = gpu_snapshot()
    result = {
        "timestamp": now_stamp(),
        "python": sys.version,
        "outputDir": str(output_dir),
        "disk": {
            "path": str(output_dir),
            "totalGb": gb(usage.total),
            "usedGb": gb(usage.used),
            "freeGb": gb(usage.free),
            "minimumRequiredGb": min_free_disk_gb,
            "warningThresholdGb": WARN_FREE_DISK_GB,
        },
        "memory": mem,
        "gpu": gpu,
        "passed": True,
        "warnings": [],
        "errors": [],
    }
    if gb(usage.free) < min_free_disk_gb:
        result["passed"] = False
        result["errors"].append(f"free disk below {min_free_disk_gb:.1f} GiB")
    elif gb(usage.free) < WARN_FREE_DISK_GB:
        result["warnings"].append(f"free disk below warning threshold {WARN_FREE_DISK_GB:.1f} GiB")
    mem_available = mem.get("MemAvailable", 0.0)
    swap_free = mem.get("SwapFree", 0.0)
    if mem_available + swap_free < 4.0:
        result["passed"] = False
        result["errors"].append("available RAM+swap below 4 GiB")
    return result


def package_probe(python: str) -> dict[str, Any]:
    packages = {}
    for name in HEAVY_PACKAGES:
        proc = subprocess.run(
            [python, "-c", f"import importlib.metadata as m; print(m.version('{name}'))"],
            text=True,
            capture_output=True,
        )
        if proc.returncode == 0:
            packages[name] = {"available": True, "version": proc.stdout.strip()}
        else:
            packages[name] = {"available": False, "reason": "not_installed"}
    return packages


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")


def append_manifest(manifest_path: Path, **updates: Any) -> dict[str, Any]:
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    manifest.update(updates)
    write_json(manifest_path, manifest)
    return manifest


def run_benchmark(args: argparse.Namespace) -> int:
    stamp = args.run_id or f"sota-policy-benchmark-{now_stamp()}"
    output_dir = Path(args.output_dir) if args.output_dir else OUTPUT_ROOT / stamp
    work_dir = output_dir / "work"
    tmp_dir = work_dir / "tmp"
    cache_dir = work_dir / "cache"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)
    os.environ["TMPDIR"] = str(tmp_dir)
    os.environ["TMP"] = str(tmp_dir)
    os.environ["TEMP"] = str(tmp_dir)
    os.environ["RAY_TMPDIR"] = str(tmp_dir / "ray")
    os.environ["HF_HOME"] = str(cache_dir / "huggingface")
    os.environ["TORCH_HOME"] = str(cache_dir / "torch")
    os.environ["TRANSFORMERS_CACHE"] = str(cache_dir / "transformers")
    os.environ["MPLCONFIGDIR"] = str(cache_dir / "matplotlib")
    os.environ["AG_CACHE_HOME"] = str(cache_dir / "autogluon")
    logs_dir = output_dir / "logs"
    manifest_path = output_dir / "manifest.json"
    feature_schema = feature_schema_contract()
    if feature_schema["featureSchemaVersion"] != REQUIRED_FEATURE_SCHEMA_VERSION:
        raise RuntimeError(f"unexpected feature schema version: {feature_schema['featureSchemaVersion']}")
    preflight_result = preflight(output_dir, args.min_free_disk_gb)
    write_json(output_dir / "preflight.json", preflight_result)
    append_manifest(
        manifest_path,
        runId=stamp,
        mode=args.mode,
        startedAt=now_stamp(),
        outputDir=str(output_dir),
        workDir=str(work_dir),
        tempDir=str(tmp_dir),
        cacheDir=str(cache_dir),
        preflight=preflight_result,
        commandArgs=vars(args),
        syntheticOnly=True,
        causalClaimAllowed=False,
        productionServingClaimAllowed=False,
        realWorldGeneralizationClaimAllowed=False,
        featureSchema=feature_schema,
    )
    if not preflight_result["passed"]:
        print(json.dumps(preflight_result, indent=2), file=sys.stderr)
        return 2

    python = sys.executable
    package_status = package_probe(python)
    append_manifest(manifest_path, heavyPackageStatus=package_status)

    features_csv = output_dir / "features.csv"
    synthetic_quality_json = output_dir / "synthetic-quality.json"
    policy_dir = output_dir / "intervention-policy"
    training_dir = output_dir / "training"
    shadow_dir = output_dir / "shadow-benchmark"
    shadow_dir.mkdir(parents=True, exist_ok=True)

    if not args.skip_generation:
        run_command(
            [
                python,
                str(SCRIPT_DIR / "generate_v2_data.py"),
                str(features_csv),
                "--students",
                str(args.students),
                "--semesters",
                str(args.semesters),
                "--seed",
                str(args.seed),
            ],
            cwd=REPO_ROOT,
            log_path=logs_dir / "generate.log",
        )
    elif not features_csv.exists():
        raise RuntimeError(f"--skip-generation requires existing {features_csv}")
    append_manifest(manifest_path, featuresCsv=str(features_csv))

    run_command(
        [
            python,
            str(SCRIPT_DIR / "validate_synthetic_quality.py"),
            str(features_csv),
            "--output-json",
            str(synthetic_quality_json),
        ],
        cwd=REPO_ROOT,
        log_path=logs_dir / "synthetic-quality.log",
    )
    quality = json.loads(synthetic_quality_json.read_text())
    if quality.get("temporalLeakage", {}).get("passed") is not True:
        append_manifest(manifest_path, syntheticQuality=str(synthetic_quality_json), failedPhase="synthetic_quality")
        raise RuntimeError("synthetic temporal leakage validation failed")
    if quality.get("featureContract", {}).get("passed") is not True:
        append_manifest(manifest_path, syntheticQuality=str(synthetic_quality_json), failedPhase="feature_contract")
        raise RuntimeError("synthetic v6 feature-contract validation failed")
    if quality.get("v6SemanticChecks", {}).get("passed") is not True:
        append_manifest(manifest_path, syntheticQuality=str(synthetic_quality_json), failedPhase="v6_semantics")
        raise RuntimeError("synthetic v6 semantic validation failed")
    append_manifest(
        manifest_path,
        syntheticQuality=str(synthetic_quality_json),
        featureContract=quality.get("featureContract"),
        v6SemanticChecks=quality.get("v6SemanticChecks"),
    )

    if args.mode == "full":
        run_command(
            [
                python,
                str(SCRIPT_DIR / "train_sota_ensemble.py"),
                str(features_csv),
                str(training_dir),
                "--device", args.use_gpu,
            ],
            cwd=REPO_ROOT,
            log_path=logs_dir / "train.log",
        )
        append_manifest(manifest_path, trainingDir=str(training_dir))
    else:
        append_manifest(manifest_path, trainingDir=None, trainingSkippedReason="smoke_mode")

    shadow_cmd = [
        python,
        str(SCRIPT_DIR / "run_shadow_tabular_benchmark.py"),
        str(features_csv),
        str(shadow_dir),
        "--use-gpu",
        args.use_gpu,
        "--max-heavy-train-rows",
        str(args.max_heavy_train_rows),
        "--autogluon-time-limit",
        str(args.autogluon_time_limit),
        "--pytabkit-time-limit",
        str(args.pytabkit_time_limit),
        "--pytabkit-epochs",
        str(args.pytabkit_epochs),
    ]
    if args.allow_heavy_models:
        shadow_cmd.append("--allow-heavy-models")
    run_command(
        shadow_cmd,
        cwd=REPO_ROOT,
        log_path=logs_dir / "shadow-benchmark.log",
    )
    shadow_results_json = shadow_dir / "benchmark-results.json"
    selected_test_predictions_csv = shadow_dir / "selected-test-predictions.csv"
    selected_validation_predictions_csv = shadow_dir / "selected-validation-predictions.csv"
    run_command(
        [
            python,
            str(SCRIPT_DIR / "export_shadow_predictions.py"),
            "--features-csv",
            str(features_csv),
            "--shadow-dir",
            str(shadow_dir),
            "--split",
            "test",
            "--output-csv",
            str(selected_test_predictions_csv),
        ],
        cwd=REPO_ROOT,
        log_path=logs_dir / "shadow-prediction-export.log",
    )
    run_command(
        [
            python,
            str(SCRIPT_DIR / "export_shadow_predictions.py"),
            "--features-csv",
            str(features_csv),
            "--shadow-dir",
            str(shadow_dir),
            "--split",
            "validation",
            "--output-csv",
            str(selected_validation_predictions_csv),
        ],
        cwd=REPO_ROOT,
        log_path=logs_dir / "shadow-prediction-export.log",
    )
    append_manifest(
        manifest_path,
        shadowBenchmark=str(shadow_results_json),
        selectedTestPredictions=str(selected_test_predictions_csv),
        selectedValidationPredictions=str(selected_validation_predictions_csv),
    )

    policy_json = policy_dir / "policy-results.json"
    policy_md = policy_dir / "policy-report.md"
    run_command(
        [
            python,
            str(SCRIPT_DIR / "evaluate_intervention_policies.py"),
            str(features_csv),
            "--output-json",
            str(policy_json),
            "--output-md",
            str(policy_md),
            "--seed",
            str(args.seed),
            "--draws",
            str(args.policy_draws),
            "--bootstrap-reps",
            str(args.bootstrap_reps),
        ],
        cwd=REPO_ROOT,
        log_path=logs_dir / "policy.log",
    )
    fairness_json = output_dir / "fairness-deep-dive-seeRisk-selected-test.json"
    workload_json = output_dir / "queue-workload-selected-test.json"
    ablation_dir = output_dir / "ablation-suite"
    run_command(
        [
            python,
            str(SCRIPT_DIR / "fairness_deep_dive.py"),
            "--features-csv",
            str(selected_test_predictions_csv),
            "--head",
            "seeRisk",
            "--prediction-col",
            "prob_seeRisk",
            "--output-json",
            str(fairness_json),
        ],
        cwd=REPO_ROOT,
        log_path=logs_dir / "fairness-deep-dive.log",
    )
    run_command(
        [
            python,
            str(SCRIPT_DIR / "queue_workload_report.py"),
            "--input-csv",
            str(selected_test_predictions_csv),
            "--score-col",
            "prob_overallCourseRisk",
            "--output-json",
            str(workload_json),
        ],
        cwd=REPO_ROOT,
        log_path=logs_dir / "queue-workload.log",
    )
    run_command(
        [
            python,
            str(SCRIPT_DIR / "run_ablation_suite.py"),
            "--features-csv",
            str(features_csv),
            "--output-dir",
            str(ablation_dir),
        ],
        cwd=REPO_ROOT,
        log_path=logs_dir / "ablation-suite.log",
    )
    run_command(
        [
            python,
            str(SCRIPT_DIR / "product_readiness_report.py"),
            "--run-dir",
            str(output_dir),
            "--fairness-report",
            str(fairness_json),
            "--workload-report",
            str(workload_json),
            "--selected-predictions",
            str(selected_test_predictions_csv),
            "--ablation-report",
            str(ablation_dir / "ablation-suite.json"),
        ],
        cwd=REPO_ROOT,
        log_path=logs_dir / "product-readiness.log",
    )
    append_manifest(
        manifest_path,
        interventionPolicyJson=str(policy_json),
        interventionPolicyMarkdown=str(policy_md),
        fairnessDeepDiveJson=str(fairness_json),
        queueWorkloadJson=str(workload_json),
        ablationSuiteJson=str(ablation_dir / "ablation-suite.json"),
        productReadinessJson=str(output_dir / "product-readiness.json"),
        productReadinessMarkdown=str(output_dir / "product-readiness.md"),
        completedAt=now_stamp(),
        status="completed",
    )
    print(f"[benchmark] complete: {output_dir}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Run AirMentor SOTA policy benchmark")
    parser.add_argument("--mode", choices=["smoke", "full"], default="smoke")
    parser.add_argument("--students", type=int, default=2)
    parser.add_argument("--semesters", type=int, default=1)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--skip-generation", action="store_true")
    parser.add_argument("--use-gpu", choices=["auto", "cpu", "cuda"], default="auto")
    parser.add_argument("--allow-heavy-models", action="store_true")
    parser.add_argument("--min-free-disk-gb", type=float, default=MIN_FREE_DISK_GB)
    parser.add_argument("--policy-draws", type=int, default=16)
    parser.add_argument("--bootstrap-reps", type=int, default=20)
    parser.add_argument("--max-heavy-train-rows", type=int, default=50000)
    parser.add_argument("--autogluon-time-limit", type=int, default=7200)
    parser.add_argument("--pytabkit-time-limit", type=int, default=300)
    parser.add_argument("--pytabkit-epochs", type=int, default=64)
    args = parser.parse_args()
    if args.mode == "full" and args.students <= 2 and args.semesters <= 1:
        args.students = 120
        args.semesters = 6
    try:
        return run_benchmark(args)
    except Exception as exc:
        print(f"[benchmark] ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
