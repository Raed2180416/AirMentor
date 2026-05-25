#!/usr/bin/env python3
"""
LightGBM Scoring Bridge for AirMentor
Loads a LightGBM model + calibration and serves predictions via stdin/stdout JSON.

Usage:
    echo '{"features":[...]}' | python3 lgbm-scoring-bridge.py --model path/to/model.txt --calibration '{"method":"beta",...}'

Deterministic: no randomness, fixed seed not needed for inference.
"""
import argparse
import json
import sys
import math
import numpy as np

try:
    import lightgbm as lgb
except ImportError:
    print(json.dumps({"error": "lightgbm not installed"}), flush=True)
    sys.exit(1)


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def apply_calibration(cal: dict, raw_prob: float) -> float:
    clamped = max(0.0001, min(0.9999, raw_prob))
    method = cal.get("method", "identity")
    if method == "identity":
        return clamped
    if method == "sigmoid":
        logit = math.log(clamped / (1.0 - clamped))
        return max(0.0001, min(0.9999, _sigmoid((cal.get("slope", 1.0) * logit) + cal.get("intercept", 0.0))))
    if method == "beta":
        log_prob = math.log(max(clamped, 1e-6))
        log_inv_prob = -math.log(max(1.0 - clamped, 1e-6))
        return max(0.0001, min(0.9999, _sigmoid(
            (cal.get("logProbWeight", 1.0) * log_prob)
            + (cal.get("logInverseProbWeight", 1.0) * log_inv_prob)
            + cal.get("intercept", 0.0)
        )))
    if method == "isotonic":
        thresholds = cal.get("thresholds", [])
        values = cal.get("values", [])
        if not thresholds or not values:
            return clamped
        idx = next((i for i, t in enumerate(thresholds) if clamped <= t), -1)
        if idx == -1:
            return max(0.0001, min(0.9999, values[-1] if values else clamped))
        return max(0.0001, min(0.9999, values[idx] if idx < len(values) else clamped))
    return clamped


def score(model_path: str, features: list[float], calibration: dict | None) -> dict:
    try:
        bst = lgb.Booster(model_file=model_path)
    except Exception as e:
        return {"error": f"Failed to load model: {e}"}

    X = np.array([features], dtype=np.float64)
    raw = float(bst.predict(X)[0])
    calibrated = apply_calibration(calibration or {"method": "identity"}, raw)
    return {
        "rawProbability": round(raw, 6),
        "calibratedProbability": round(calibrated, 6),
        "calibrationMethod": calibration.get("method", "identity") if calibration else "identity",
    }


def main():
    parser = argparse.ArgumentParser(description="LightGBM scoring bridge")
    parser.add_argument("--model", required=True, help="Path to LightGBM model .txt file")
    parser.add_argument("--calibration", default="{}", help="JSON calibration blob")
    args = parser.parse_args()

    try:
        calibration = json.loads(args.calibration)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid calibration JSON: {e}"}), flush=True)
        sys.exit(1)

    # Read feature vector from stdin
    try:
        line = sys.stdin.readline()
        if not line:
            print(json.dumps({"error": "No input on stdin"}), flush=True)
            sys.exit(1)
        payload = json.loads(line)
        features = payload.get("features")
        if features is None:
            print(json.dumps({"error": "Missing 'features' key in input"}), flush=True)
            sys.exit(1)
        if not isinstance(features, list):
            print(json.dumps({"error": "'features' must be a list"}), flush=True)
            sys.exit(1)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid input JSON: {e}"}), flush=True)
        sys.exit(1)

    result = score(args.model, features, calibration)
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
