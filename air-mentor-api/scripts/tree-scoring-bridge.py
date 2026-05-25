#!/usr/bin/env python3
"""
Tree Scoring Bridge for AirMentor
Supports XGBoost (.json) and LightGBM (.txt) models.
Serves predictions via stdin/stdout JSON.

Usage:
    echo '{"features":[...]}' | python3 tree-scoring-bridge.py --model path/to/model --model-type xgboost --calibration '{"method":"beta",...}'
"""
import argparse
import json
import sys
import math
import numpy as np

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

def score(model_path: str, model_type: str, features: list[float], calibration: dict | None) -> dict:
    X = np.array([features], dtype=np.float64)
    
    if model_type == "xgboost":
        try:
            import xgboost as xgb
            bst = xgb.Booster()
            bst.load_model(model_path)
            dmat = xgb.DMatrix(X)
            raw = float(bst.predict(dmat)[0])
        except Exception as e:
            return {"error": f"XGBoost load/predict failed: {e}"}
    elif model_type == "lightgbm":
        try:
            import lightgbm as lgb
            bst = lgb.Booster(model_file=model_path)
            raw = float(bst.predict(X)[0])
        except Exception as e:
            return {"error": f"LightGBM load/predict failed: {e}"}
    else:
        return {"error": f"Unknown model_type: {model_type}"}
    
    calibrated = apply_calibration(calibration or {"method": "identity"}, raw)
    return {
        "rawProbability": round(raw, 6),
        "calibratedProbability": round(calibrated, 6),
        "calibrationMethod": calibration.get("method", "identity") if calibration else "identity",
    }

def main():
    parser = argparse.ArgumentParser(description="Tree scoring bridge")
    parser.add_argument("--model", required=True, help="Path to model file")
    parser.add_argument("--model-type", required=True, choices=["xgboost", "lightgbm"], help="Model type")
    parser.add_argument("--calibration", default="{}", help="JSON calibration blob")
    args = parser.parse_args()
    
    try:
        calibration = json.loads(args.calibration)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid calibration JSON: {e}"}), flush=True)
        sys.exit(1)
    
    try:
        line = sys.stdin.readline()
        if not line:
            print(json.dumps({"error": "No input on stdin"}), flush=True)
            sys.exit(1)
        payload = json.loads(line)
        features = payload.get("features")
        if features is None:
            print(json.dumps({"error": "Missing 'features' key"}), flush=True)
            sys.exit(1)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid input JSON: {e}"}), flush=True)
        sys.exit(1)
    
    result = score(args.model, args.model_type, features, calibration)
    print(json.dumps(result), flush=True)

if __name__ == "__main__":
    main()
