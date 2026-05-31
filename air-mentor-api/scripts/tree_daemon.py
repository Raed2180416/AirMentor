#!/usr/bin/env python3
"""
tree_daemon.py — Threaded XGBoost inference daemon.
Listens on 127.0.0.1:14231. Handles concurrent requests safely.
"""
import json
import math
import threading
import numpy as np
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
import xgboost as xgb

# Thread-safe model cache
_model_cache: dict = {}
_model_lock = threading.Lock()


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def apply_calibration(cal: dict, raw_prob: float) -> float:
    clamped = max(0.0001, min(0.9999, raw_prob))
    method = cal.get("method", "identity")
    if method == "identity":
        return clamped
    if method == "sigmoid":
        logit = math.log(clamped / (1.0 - clamped))
        return max(0.0001, min(0.9999, _sigmoid(
            (cal.get("slope", 1.0) * logit) + cal.get("intercept", 0.0)
        )))
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


def load_model(model_path: str) -> xgb.Booster:
    with _model_lock:
        if model_path not in _model_cache:
            bst = xgb.Booster()
            bst.load_model(model_path)
            _model_cache[model_path] = bst
        return _model_cache[model_path]


class RequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            req = json.loads(post_data)

            model_path = req.get('model')
            if not model_path:
                # Health check or bad request — return empty 200
                self._send_json({"ok": True})
                return

            model_type = req.get('model_type', 'xgboost')
            calibration = json.loads(req['calibration'])
            payload = json.loads(req['payload'])
            features = payload['features']

            X = np.array([features], dtype=np.float64)
            bst = load_model(model_path)
            dmat = xgb.DMatrix(X)
            raw = float(bst.predict(dmat)[0])
            calibrated = apply_calibration(calibration, raw)

            res = {
                "rawProbability": round(raw, 6),
                "calibratedProbability": round(calibrated, 6),
                "calibrationMethod": calibration.get("method", "identity"),
            }
            self._send_json(res)
        except (BrokenPipeError, ConnectionResetError):
            # Client disconnected — not an error
            pass
        except Exception as e:
            try:
                self._send_json({"error": str(e)}, status=500)
            except Exception:
                pass

    def _send_json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # suppress access logs for performance


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    """Handles each request in a separate thread."""
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 14231), RequestHandler)
    print(f"[tree_daemon] Listening on 127.0.0.1:14231 (threaded)", flush=True)
    server.serve_forever()
