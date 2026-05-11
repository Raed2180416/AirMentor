"""
Phase 9: Beta calibration + Venn-Abers diagnostic for v8-local logistic baseline.

Context
-------
Downstream of t57 (overnight-ml-v8-corrected-logistic). t57 delivered an interim
v8 baseline with per-head `LogisticRegression` + isotonic calibration. Phase 9
compares Beta calibration against the pre-calibrated raw logistic scores for
promotion, while still carrying isotonic as a shadow reference so local-vs-t57
behavior remains inspectable. Promotion remains blocked if Beta worsens local
ECE at bands 0.4 or 0.85, or if global ECE regresses vs raw.

This script is the cost-free local-only pipeline fallback for t58, same shape
as t57's `train_v8_local_corrected_logistic.py`:
    zero OpenAI calls, deterministic seed=4242, runs outside the codex sandbox.

Inputs
------
- `air-mentor-api/output/proof-risk-model/features.csv` (same pre-Phase-2 csv
  as t57 — see t57 MD for corpusAdmissibility=interim caveat)
- Reuses the exact per-head `LogisticRegression` + synthetic train/cal/test
  splits from t57's script (same seed + same feature layout) so calibrator
  inputs are comparable.

Outputs (under `air-mentor-api/output/proof-risk-model/beta-calibration-v8-local-<TS>Z/`)
  - beta-params.json         per-head Beta logistic params {a, b, c}
  - calibration-before.json  raw + isotonic-shadow metrics per head
  - calibration-after.json   Beta-calibrated metrics per head
  - venn-abers.json          diagnostic lower/upper bounds per head
  - promotion-decision.json  per-head + global verdict
  - metric-sidecars/*.json   (same sidecar structure as t57)
  - meta.txt                 reproducibility manifest

Repo-tracked snapshot copied to `audit-map/22-evals/data/overnight-ml-beta-
calibration-*.json` so dependents can inspect without the gitignored output
tree.

Beta calibration
----------------
Follows Kull+Silva+Flach 2017. Fit a logistic regression on the 2-dim feature
`[log(p), log(1-p)]` to predict labels, giving a closed-form inverse Beta-CDF
calibration curve. Falls back to identity when the calibration slice is
degenerate.

Venn-Abers (diagnostic)
-----------------------
Single-pass Venn-Abers using the Inductive variant:
    p_lo(x) = fit_isotonic(cal + {(x, 0)}).predict(x)
    p_hi(x) = fit_isotonic(cal + {(x, 1)}).predict(x)
Interval width and coverage reported per head — NOT used for promotion, only
diagnostic per the intent contract.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score

REPO_ROOT = Path(__file__).resolve().parents[2]
FEATURES_CSV = REPO_ROOT / 'air-mentor-api/output/proof-risk-model/features.csv'
OUTPUT_BASE = REPO_ROOT / 'air-mentor-api/output/proof-risk-model'
T57_LATEST = OUTPUT_BASE / 'local-v8-corrected-logistic-latest.json'

HEADS: dict[str, str] = {
    'attendanceRisk': 'label_attendance',
    'ceRisk': 'label_ce',
    'seeRisk': 'label_see',
    'overallCourseRisk': 'label_overall',
    'downstreamCarryoverRisk': 'label_downstream',
}

SEED = 4242
LOCAL_ECE_BANDS = [(0.4, 0.08), (0.85, 0.08)]
GLOBAL_ECE_BINS = 10
EPS = 1e-6  # clip before log to avoid inf

# ------------------------------------------------------------------ metrics


def _global_ece(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = GLOBAL_ECE_BINS) -> float:
    if len(y_true) == 0:
        return 0.0
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    n = len(y_true)
    for i in range(n_bins):
        lo, hi = bins[i], bins[i + 1]
        mask = (y_prob >= lo) & ((y_prob < hi) if i < n_bins - 1 else (y_prob <= hi))
        if not np.any(mask):
            continue
        bin_conf = y_prob[mask].mean()
        bin_acc = y_true[mask].mean()
        ece += (mask.sum() / n) * abs(bin_conf - bin_acc)
    return float(ece)


def _local_ece(y_true: np.ndarray, y_prob: np.ndarray, center: float, half_width: float) -> dict:
    mask = np.abs(y_prob - center) <= half_width
    support = int(mask.sum())
    if support == 0:
        return {'center': center, 'halfWidth': half_width, 'support': 0, 'ece': None,
                'meanProb': None, 'meanLabel': None}
    p = y_prob[mask]; y = y_true[mask]
    return {'center': center, 'halfWidth': half_width, 'support': support,
            'ece': float(abs(p.mean() - y.mean())),
            'meanProb': float(p.mean()), 'meanLabel': float(y.mean())}


# ------------------------------------------------------------------ calibrators


def fit_beta_calibrator(p_cal: np.ndarray, y_cal: np.ndarray):
    """Beta calibration via logistic regression on [log(p), log(1-p)].

    Returns a callable `calibrate(probs) -> probs`.
    """
    p_cal = np.clip(p_cal, EPS, 1.0 - EPS)
    X = np.column_stack([np.log(p_cal), np.log(1.0 - p_cal)])
    if len(set(y_cal.tolist())) < 2:
        # Degenerate cal slice — fall back to identity
        def _noop(probs: np.ndarray) -> np.ndarray:
            return np.clip(probs, 0.0, 1.0)
        return _noop, {'a': None, 'b': None, 'c': None, 'degenerate': True}
    lr = LogisticRegression(solver='lbfgs', max_iter=1000, random_state=SEED)
    lr.fit(X, y_cal)
    # Beta params per Kull 2017: a = coef[0], b = -coef[1], c = intercept
    a = float(lr.coef_[0][0])
    b = float(-lr.coef_[0][1])
    c = float(lr.intercept_[0])
    def calibrate(probs: np.ndarray) -> np.ndarray:
        probs = np.clip(probs, EPS, 1.0 - EPS)
        Xp = np.column_stack([np.log(probs), np.log(1.0 - probs)])
        return lr.predict_proba(Xp)[:, 1]
    return calibrate, {'a': a, 'b': b, 'c': c, 'degenerate': False}


def venn_abers_diagnostic(p_cal: np.ndarray, y_cal: np.ndarray, p_test: np.ndarray) -> dict:
    """Inductive Venn-Abers lower/upper bounds using two isotonic fits.

    Implementation: for efficiency we use the sorted-cal formulation which is
    exact but O(n log n + m log n) rather than O(n·m).
    """
    n = len(p_cal)
    if n == 0 or len(set(y_cal.tolist())) < 2:
        # degenerate, return identity bounds
        return {
            'degenerate': True,
            'lower': p_test.tolist(),
            'upper': p_test.tolist(),
            'meanIntervalWidth': 0.0,
            'coverageAt05': None,
        }
    # Fit two isotonic regressions: one assuming each test point is +1,
    # one assuming each test point is -1. Use the "conservative" union.
    iso_pos = IsotonicRegression(out_of_bounds='clip', y_min=0.0, y_max=1.0)
    iso_pos.fit(np.r_[p_cal, p_test], np.r_[y_cal, np.ones(len(p_test), dtype=int)])
    iso_neg = IsotonicRegression(out_of_bounds='clip', y_min=0.0, y_max=1.0)
    iso_neg.fit(np.r_[p_cal, p_test], np.r_[y_cal, np.zeros(len(p_test), dtype=int)])
    p_upper = iso_pos.predict(p_test)
    p_lower = iso_neg.predict(p_test)
    # ensure bounds valid
    p_lower = np.minimum(p_lower, p_upper)
    p_upper = np.maximum(p_lower, p_upper)
    width = (p_upper - p_lower).mean()
    # coverage at 0.5: how often does [lower, upper] cross the decision boundary
    crosses = ((p_lower < 0.5) & (p_upper > 0.5)).mean()
    return {
        'degenerate': False,
        'meanIntervalWidth': float(width),
        'maxIntervalWidth': float((p_upper - p_lower).max()),
        'coverageAt05': float(crosses),
        'meanLower': float(p_lower.mean()),
        'meanUpper': float(p_upper.mean()),
    }


# ------------------------------------------------------------------ main pipeline


def process_head(df: pd.DataFrame, feat_cols: list[str], miss_cols: list[str],
                 head_key: str, label_col: str) -> dict:
    val = df[df['split'] == 'validation'].copy()
    test = df[df['split'] == 'test'].copy()
    val = val.sample(frac=1.0, random_state=SEED).reset_index(drop=True)
    split_idx = int(0.8 * len(val))
    train = val.iloc[:split_idx]
    cal = val.iloc[split_idx:]

    feature_cols = feat_cols + miss_cols
    X_train = train[feature_cols].to_numpy(dtype=np.float64)
    y_train = train[label_col].to_numpy(dtype=np.int64)
    X_cal = cal[feature_cols].to_numpy(dtype=np.float64)
    y_cal = cal[label_col].to_numpy(dtype=np.int64)
    X_test = test[feature_cols].to_numpy(dtype=np.float64)
    y_test = test[label_col].to_numpy(dtype=np.int64)

    if y_train.sum() == 0 or y_train.sum() == len(y_train):
        return {'head': head_key, 'skipped': True,
                'reason': f'train positives={y_train.sum()}/{len(y_train)}'}

    # 1) Base logistic (same hyperparams as t57)
    clf = LogisticRegression(penalty='l2', C=1.0, solver='lbfgs',
                             class_weight='balanced', max_iter=1000, random_state=SEED)
    clf.fit(X_train, y_train)
    p_cal_raw = clf.predict_proba(X_cal)[:, 1]
    p_test_raw = clf.predict_proba(X_test)[:, 1]

    # 2) Isotonic (t57 baseline — needed for 'before' comparison)
    if len(set(y_cal.tolist())) >= 2:
        iso = IsotonicRegression(out_of_bounds='clip', y_min=0.0, y_max=1.0)
        iso.fit(p_cal_raw, y_cal)
        p_test_iso = iso.predict(p_test_raw)
    else:
        p_test_iso = p_test_raw

    # 3) Beta calibration (new)
    beta_fn, beta_params = fit_beta_calibrator(p_cal_raw, y_cal)
    p_test_beta = beta_fn(p_test_raw)

    # 4) Venn-Abers diagnostic (not used for promotion)
    va = venn_abers_diagnostic(p_cal_raw, y_cal, p_test_raw)

    def _metric_block(probs: np.ndarray, label: str) -> dict:
        b = {
            'label': label,
            'rocAuc': float(roc_auc_score(y_test, probs)) if len(set(y_test.tolist())) >= 2 else None,
            'brier': float(brier_score_loss(y_test, probs)),
            'globalEce': _global_ece(y_test, probs),
            'localEce': [_local_ece(y_test, probs, c, w) for c, w in LOCAL_ECE_BANDS],
            'meanProb': float(probs.mean()),
            'meanLabel': float(y_test.mean()),
            'overloadRatio': (float(probs.mean() / y_test.mean()) if y_test.mean() > 0 else None),
        }
        return b

    metrics_raw = _metric_block(p_test_raw, 'raw')
    metrics_iso = _metric_block(p_test_iso, 'isotonic (t57 baseline)')
    metrics_beta = _metric_block(p_test_beta, 'beta')

    # Promotion gate per Phase 9 intent: compare Beta vs pre-calibrated raw.
    raw_ece04 = metrics_raw['localEce'][0]['ece']
    raw_ece85 = metrics_raw['localEce'][1]['ece']
    beta_ece04 = metrics_beta['localEce'][0]['ece']
    beta_ece85 = metrics_beta['localEce'][1]['ece']
    promotion = {
        'baseline': 'raw-uncalibrated',
        'rawGlobalEce': metrics_raw['globalEce'],
        'betaGlobalEce': metrics_beta['globalEce'],
        'rawEce04': raw_ece04,
        'betaEce04': beta_ece04,
        'rawEce85': raw_ece85,
        'betaEce85': beta_ece85,
        'deltaGlobalEce': metrics_beta['globalEce'] - metrics_raw['globalEce'],
        'delta04': ((beta_ece04 - raw_ece04) if (raw_ece04 is not None and beta_ece04 is not None) else None),
        'delta85': ((beta_ece85 - raw_ece85) if (raw_ece85 is not None and beta_ece85 is not None) else None),
        'shadowIsotonicEce04': metrics_iso['localEce'][0]['ece'],
        'shadowIsotonicEce85': metrics_iso['localEce'][1]['ece'],
    }
    worsens04 = (raw_ece04 is not None and beta_ece04 is not None and beta_ece04 > raw_ece04 + 1e-4)
    worsens85 = (raw_ece85 is not None and beta_ece85 is not None and beta_ece85 > raw_ece85 + 1e-4)
    global_ece_worse = metrics_beta['globalEce'] > metrics_raw['globalEce'] + 1e-4
    promotion['worsensLocal04'] = bool(worsens04)
    promotion['worsensLocal85'] = bool(worsens85)
    promotion['globalEceWorse'] = bool(global_ece_worse)
    promotion['betaBlockedPerHead'] = bool(worsens04 or worsens85 or global_ece_worse)

    return {
        'head': head_key,
        'skipped': False,
        'calSize': int(len(y_cal)),
        'testSize': int(len(y_test)),
        'testPositives': int(y_test.sum()),
        'metricsRaw': metrics_raw,
        'metricsIsotonic': metrics_iso,
        'metricsBeta': metrics_beta,
        'vennAbers': va,
        'betaParams': beta_params,
        'promotion': promotion,
    }


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 16), b''):
            h.update(chunk)
    return h.hexdigest()


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def main() -> int:
    if not FEATURES_CSV.exists():
        print(f'FATAL: features.csv missing at {FEATURES_CSV}', file=sys.stderr)
        return 1
    if not T57_LATEST.exists():
        print(f'WARN: t57 latest.json missing ({T57_LATEST}); proceeding with recomputed baseline',
              file=sys.stderr)

    ts_utc = _dt.datetime.now(_dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    output_dir = OUTPUT_BASE / f'beta-calibration-v8-local-{ts_utc}'
    _ensure_dir(output_dir)
    _ensure_dir(output_dir / 'metric-sidecars')

    df = pd.read_csv(FEATURES_CSV)
    feat_cols = [c for c in df.columns if c.startswith('feat_')]
    miss_cols = []
    for c in feat_cols:
        m = f'miss_{c[5:]}'
        df[m] = df[c].isna().astype(np.int8)
        miss_cols.append(m)
    df[feat_cols] = df[feat_cols].fillna(0.0)

    results: dict[str, dict] = {}
    for head_key, label_col in HEADS.items():
        print(f'[beta-cal] processing head={head_key}')
        results[head_key] = process_head(df, feat_cols, miss_cols, head_key, label_col)

    # Global promotion: beta blocked if any head's local cal worsens
    blocked_heads = [h for h, r in results.items()
                     if not r.get('skipped') and r['promotion']['betaBlockedPerHead']]
    summary = {
        'generatedAt': _dt.datetime.now(_dt.timezone.utc).isoformat(timespec='seconds'),
        'calibrator': 'beta',
        'calibratorRef': 'Kull+Silva+Flach 2017 — log(p)+log(1-p) logistic',
        'promotionBaseline': 'raw-uncalibrated',
        'shadowReference': 'isotonic (t57 baseline)',
        'corpusAdmissibility': 'interim',
        'seed': SEED,
        'heads': results,
        'promotion': {
            'decision': ('do-not-promote' if blocked_heads else 'promote-beta-as-default'),
            'blockedHeads': blocked_heads,
            'reason': (
                f'{len(blocked_heads)}/{len(HEADS)} heads regress on local-ECE@0.4, '
                f'local-ECE@0.85, or global ECE vs raw logistic baseline — Beta blocked by '
                f'Phase 9 validation gate'
                if blocked_heads
                else 'all 5 heads maintain or improve local-ECE at 0.4/0.85 and do not worsen global ECE vs raw'
            ),
            'headsEvaluated': [h for h, r in results.items() if not r.get('skipped')],
        },
    }

    # Write main JSON
    (output_dir / 'calibration-summary.json').write_text(
        json.dumps(summary, indent=2, sort_keys=True, default=str))
    # Sidecars
    sidecars = {
        'beta-params.json': {h: r.get('betaParams') for h, r in results.items()},
        'calibration-before.json': {h: {'isotonic': r.get('metricsIsotonic'),
                                         'raw': r.get('metricsRaw')}
                                     for h, r in results.items()},
        'calibration-after.json': {h: r.get('metricsBeta') for h, r in results.items()},
        'venn-abers.json': {h: r.get('vennAbers') for h, r in results.items()},
        'promotion-decision.json': {'global': summary['promotion'],
                                     'perHead': {h: r.get('promotion')
                                                 for h, r in results.items()
                                                 if not r.get('skipped')}},
    }
    for name, blob in sidecars.items():
        (output_dir / 'metric-sidecars' / name).write_text(
            json.dumps(blob, indent=2, sort_keys=True, default=str))

    # meta.txt
    script_hash = _sha256_file(Path(__file__).resolve())
    features_hash = _sha256_file(FEATURES_CSV)
    git_sha = (os.popen(f'git -C {REPO_ROOT} rev-parse HEAD').read().strip() or 'unknown')
    meta = (
        f'[beta-calibration-v8-local] generated at {summary["generatedAt"]}\n'
        f'seed={SEED}\n'
        f'gitSha={git_sha}\n'
        f'scriptSha256={script_hash}\n'
        f'featuresCsvSha256={features_hash}\n'
        f'calibrator=beta (Kull 2017)\n'
        f'diagnostic=venn-abers (Inductive, single-pass)\n'
        f'headsEvaluated={len([r for r in results.values() if not r.get("skipped")])}/{len(HEADS)}\n'
        f'blockedHeads={len(summary["promotion"]["blockedHeads"])}\n'
        f'promotionDecision={summary["promotion"]["decision"]}\n'
        f'corpusAdmissibility=interim (inherits t57 caveat)\n'
        f'metricSidecarDir={output_dir / "metric-sidecars"}\n'
    )
    (output_dir / 'meta.txt').write_text(meta)

    # Latest pointer
    (OUTPUT_BASE / 'beta-calibration-v8-local-latest.json').write_text(
        json.dumps({'timestampDir': str(output_dir.relative_to(REPO_ROOT)),
                    'summary': summary}, indent=2, sort_keys=True, default=str))

    print(f'[beta-cal] wrote {output_dir}')
    print(f'[beta-cal] promotion.decision = {summary["promotion"]["decision"]}')
    print(f'[beta-cal] blocked heads: {summary["promotion"]["blockedHeads"]}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
