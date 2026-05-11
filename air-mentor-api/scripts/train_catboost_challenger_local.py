"""
Phase 10: CatBoost challenger trained on v8-local corpus as shadow.

Context
-------
Downstream of t57 (logistic v8-local) + t58 (Beta calibration diagnostic).
Phase 10 intent: train CatBoost challenger on the corrected-corpus; compare
vs logistic v8 on decision-aware metrics (ranking + proper scoring + local
calibration + overload + replayability); do NOT promote unless all five
gates pass. Challenger kept as shadow only.

Like t57 and t58, this is the cost-free sandbox-bypass fallback: zero
OpenAI calls, deterministic seed=4242, uses the same pre-Phase-2
features.csv on disk. `corpusAdmissibility=interim` inherited.

Differs from existing `train_catboost_challenger.py` by:
  - Does NOT require `run_id` or `scenario_family` columns (our features.csv
    only has split/stage_key/labels/features)
  - Uses same synth train/cal/test splits as t57 for head-to-head parity
  - CPU-only (no GPU availability in nix shell)
  - Emits same `metric-sidecars/` + `meta.txt` + repo-tracked JSON summary
    shape as t57/t58 so downstream tasks (t60..t63) can consume

Outputs
-------
  air-mentor-api/output/proof-risk-model/catboost-challenger-local-<TS>Z/
    catboost-<head>.cbm          CatBoost binary model per head
    per-head-metrics.json        challenger metrics per head
    head-to-head.json            vs logistic v8 baseline per head + global
    promotion-decision.json      5-gate verdict
    metric-sidecars/*.json       category sidecars (same shape as t57/t58)
    meta.txt                     reproducibility manifest
  air-mentor-api/output/proof-risk-model/catboost-challenger-local-latest.json
  audit-map/22-evals/data/overnight-ml-catboost-challenger-*.json  (sidecar copies)

5-gate promotion (must all PASS to promote)
-------------------------------------------
  1. ranking     — challenger ROC-AUC >= logistic ROC-AUC (per head or macro)
  2. proper      — challenger Brier <= logistic Brier
  3. localCal    — challenger local-ECE@0.4 AND @0.85 <= logistic
  4. overload    — |challenger overload - 1.0| <= |logistic overload - 1.0|
  5. replayable  — model .cbm + hashes + seed recorded (always PASS if saved)
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
from catboost import CatBoostClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)

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

STAGE_KEY_LABELS = {
    0: 'pre-tt1', 1: 'post-tt1', 2: 'post-tt2',
    3: 'post-assignments', 4: 'post-see',
}

SEED = 4242
BUDGET_TOP_PCT = 0.20
LOCAL_ECE_BANDS = [(0.4, 0.08), (0.85, 0.08)]
GLOBAL_ECE_BINS = 10

# CatBoost hyperparams — modest depth and iterations for CPU, seeded.
CATBOOST_PARAMS = dict(
    iterations=300,
    depth=6,
    learning_rate=0.05,
    loss_function='Logloss',
    eval_metric='AUC',
    random_seed=SEED,
    allow_writing_files=False,
    logging_level='Silent',
    thread_count=-1,
    l2_leaf_reg=3.0,
)


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
        ece += (mask.sum() / n) * abs(y_prob[mask].mean() - y_true[mask].mean())
    return float(ece)


def _local_ece(y_true: np.ndarray, y_prob: np.ndarray, center: float, hw: float) -> dict:
    mask = np.abs(y_prob - center) <= hw
    support = int(mask.sum())
    if support == 0:
        return {'center': center, 'halfWidth': hw, 'support': 0, 'ece': None,
                'meanProb': None, 'meanLabel': None}
    p = y_prob[mask]; y = y_true[mask]
    return {'center': center, 'halfWidth': hw, 'support': support,
            'ece': float(abs(p.mean() - y.mean())),
            'meanProb': float(p.mean()), 'meanLabel': float(y.mean())}


def _precision_recall_at_budget(y_true, y_prob, top_pct):
    n = len(y_true)
    k = max(1, int(np.ceil(top_pct * n)))
    order = np.argsort(-y_prob)
    top = order[:k]
    tp = int(y_true[top].sum())
    total_pos = int(y_true.sum())
    return {'topPct': top_pct, 'k': k, 'precision': tp / k,
            'recall': tp / total_pos if total_pos > 0 else 0.0,
            'truePositives': tp, 'falsePositives': k - tp,
            'totalPositives': total_pos}


def _overload(p, y):
    return float(p.mean() / y.mean()) if y.mean() > 0 else None


def _safe_roc(y_true, y_prob):
    if len(set(y_true.tolist())) < 2: return None
    return float(roc_auc_score(y_true, y_prob))


def _safe_pr(y_true, y_prob):
    if len(set(y_true.tolist())) < 2: return None
    return float(average_precision_score(y_true, y_prob))


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 16), b''):
            h.update(chunk)
    return h.hexdigest()


def train_logistic_baseline(X_train, y_train, X_test, y_test, X_cal, y_cal):
    """Reproduce the t57 logistic+isotonic baseline for head-to-head parity."""
    clf = LogisticRegression(penalty='l2', C=1.0, solver='lbfgs',
                             class_weight='balanced', max_iter=1000,
                             random_state=SEED)
    clf.fit(X_train, y_train)
    raw_cal = clf.predict_proba(X_cal)[:, 1]
    raw_test = clf.predict_proba(X_test)[:, 1]
    if len(set(y_cal.tolist())) >= 2:
        iso = IsotonicRegression(out_of_bounds='clip', y_min=0.0, y_max=1.0)
        iso.fit(raw_cal, y_cal)
        probs = iso.predict(raw_test)
    else:
        probs = raw_test
    return probs


def train_catboost_head(X_train, y_train, X_cal, y_cal, X_test, y_test, head_key, out_dir):
    # CatBoost handles class imbalance via scale_pos_weight
    pos = int(y_train.sum())
    neg = len(y_train) - pos
    if pos == 0 or neg == 0:
        return None, None
    scale_pos_weight = neg / max(pos, 1)
    params = dict(CATBOOST_PARAMS, scale_pos_weight=scale_pos_weight)
    clf = CatBoostClassifier(**params)
    clf.fit(
        X_train, y_train,
        eval_set=(X_cal, y_cal) if len(y_cal) > 0 else None,
        early_stopping_rounds=30 if len(y_cal) > 0 else None,
        use_best_model=True if len(y_cal) > 0 else False,
    )
    raw_cal = clf.predict_proba(X_cal)[:, 1]
    raw_test = clf.predict_proba(X_test)[:, 1]
    # Isotonic calibration (same pattern as logistic baseline for fair compare)
    if len(set(y_cal.tolist())) >= 2:
        iso = IsotonicRegression(out_of_bounds='clip', y_min=0.0, y_max=1.0)
        iso.fit(raw_cal, y_cal)
        probs = iso.predict(raw_test)
    else:
        probs = raw_test
    # Save CatBoost model
    model_path = out_dir / f'catboost-{head_key}.cbm'
    clf.save_model(str(model_path), format='cbm')
    return probs, {
        'modelArtifact': str(model_path.relative_to(REPO_ROOT)),
        'bestIteration': (int(clf.get_best_iteration()) if hasattr(clf, 'get_best_iteration') else None),
        'treeCount': int(clf.tree_count_),
        'scalePosWeight': float(scale_pos_weight),
        **params,
    }


def _metric_block(y_test, probs, test_df):
    roc = _safe_roc(y_test, probs)
    pr = _safe_pr(y_test, probs)
    brier = float(brier_score_loss(y_test, probs))
    gece = _global_ece(y_test, probs)
    local = [_local_ece(y_test, probs, c, w) for c, w in LOCAL_ECE_BANDS]
    overload = _overload(probs, y_test)
    prbudget = _precision_recall_at_budget(y_test, probs, BUDGET_TOP_PCT)
    stage_rows = []
    for sk, sl in STAGE_KEY_LABELS.items():
        m = test_df['stage_key'].to_numpy() == sk
        if not np.any(m): continue
        stage_rows.append({
            'stageKey': sk, 'stageLabel': sl, 'support': int(m.sum()),
            'rocAuc': _safe_roc(y_test[m], probs[m]),
            'ece': _global_ece(y_test[m], probs[m]),
            'overloadRatio': _overload(probs[m], y_test[m]),
        })
    roc_vals = [s['rocAuc'] for s in stage_rows if s['rocAuc'] is not None]
    return {
        'rocAuc': roc, 'prAuc': pr, 'brier': brier, 'globalEce': gece,
        'localEce': local, 'overloadRatio': overload,
        'precisionRecallAtBudget': prbudget,
        'stageStability': {
            'rocMin': min(roc_vals) if roc_vals else None,
            'rocMax': max(roc_vals) if roc_vals else None,
            'rocSpread': (max(roc_vals) - min(roc_vals)) if roc_vals else None,
            'perStage': stage_rows,
        },
    }


def main() -> int:
    if not FEATURES_CSV.exists():
        print(f'FATAL: features.csv missing at {FEATURES_CSV}', file=sys.stderr); return 1
    ts_utc = _dt.datetime.now(_dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    out_dir = OUTPUT_BASE / f'catboost-challenger-local-{ts_utc}'
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / 'metric-sidecars').mkdir(exist_ok=True)

    df = pd.read_csv(FEATURES_CSV)
    feat_cols = [c for c in df.columns if c.startswith('feat_')]
    miss_cols = []
    for c in feat_cols:
        m = f'miss_{c[5:]}'
        df[m] = df[c].isna().astype(np.int8)
        miss_cols.append(m)
    df[feat_cols] = df[feat_cols].fillna(0.0)

    heads_out: dict[str, dict] = {}
    for head_key, label_col in HEADS.items():
        print(f'[catboost] head={head_key}')
        val = df[df['split'] == 'validation'].copy()
        test = df[df['split'] == 'test'].copy()
        val = val.sample(frac=1.0, random_state=SEED).reset_index(drop=True)
        split_idx = int(0.8 * len(val))
        train = val.iloc[:split_idx]
        cal = val.iloc[split_idx:]
        fcols = feat_cols + miss_cols
        X_train = train[fcols].to_numpy(dtype=np.float64)
        y_train = train[label_col].to_numpy(dtype=np.int64)
        X_cal = cal[fcols].to_numpy(dtype=np.float64)
        y_cal = cal[label_col].to_numpy(dtype=np.int64)
        X_test = test[fcols].to_numpy(dtype=np.float64)
        y_test = test[label_col].to_numpy(dtype=np.int64)

        # Baseline: logistic (t57 style)
        baseline_probs = train_logistic_baseline(X_train, y_train, X_test, y_test, X_cal, y_cal)
        baseline_metrics = _metric_block(y_test, baseline_probs, test)

        # Challenger: CatBoost
        cb_probs, cb_info = train_catboost_head(X_train, y_train, X_cal, y_cal,
                                                X_test, y_test, head_key, out_dir)
        if cb_probs is None:
            heads_out[head_key] = {'head': head_key, 'skipped': True,
                                    'reason': 'no positive train examples'}
            continue
        cb_metrics = _metric_block(y_test, cb_probs, test)

        # 5-gate head-to-head
        g1_ranking = (cb_metrics['rocAuc'] or 0) >= (baseline_metrics['rocAuc'] or 0)
        g2_proper = cb_metrics['brier'] <= baseline_metrics['brier']
        base_l04 = baseline_metrics['localEce'][0]['ece']
        cb_l04 = cb_metrics['localEce'][0]['ece']
        base_l85 = baseline_metrics['localEce'][1]['ece']
        cb_l85 = cb_metrics['localEce'][1]['ece']
        g3_localcal = (
            (base_l04 is None or cb_l04 is None or cb_l04 <= base_l04 + 1e-4)
            and (base_l85 is None or cb_l85 is None or cb_l85 <= base_l85 + 1e-4)
        )
        base_ov = baseline_metrics.get('overloadRatio')
        cb_ov = cb_metrics.get('overloadRatio')
        g4_overload = (base_ov is None or cb_ov is None
                       or abs(cb_ov - 1.0) <= abs(base_ov - 1.0) + 1e-4)
        g5_replayable = True  # .cbm saved + seeded
        gates_pass = int(g1_ranking) + int(g2_proper) + int(g3_localcal) + int(g4_overload) + int(g5_replayable)

        heads_out[head_key] = {
            'head': head_key,
            'skipped': False,
            'baseline': baseline_metrics,
            'challenger': cb_metrics,
            'challengerInfo': cb_info,
            'gates': {
                'ranking': bool(g1_ranking),
                'proper': bool(g2_proper),
                'localCal': bool(g3_localcal),
                'overload': bool(g4_overload),
                'replayable': bool(g5_replayable),
                'passCount': gates_pass,
            },
            'headPromotable': (gates_pass == 5),
        }

    # Global promotion: ALL heads must have passCount=5 (Phase 10 intent strict)
    promotable = [h for h, r in heads_out.items() if not r.get('skipped') and r.get('headPromotable')]
    blocked = [h for h, r in heads_out.items() if not r.get('skipped') and not r.get('headPromotable')]
    summary = {
        'generatedAt': _dt.datetime.now(_dt.timezone.utc).isoformat(timespec='seconds'),
        'challenger': 'catboost',
        'baseline': 'logistic-v8-local (isotonic-calibrated)',
        'corpusAdmissibility': 'interim',
        'seed': SEED,
        'catboostParams': CATBOOST_PARAMS,
        'heads': heads_out,
        'promotion': {
            'decision': ('promote-as-primary' if len(blocked) == 0 and promotable
                         else 'keep-as-shadow'),
            'promotableHeads': promotable,
            'blockedHeads': blocked,
            'reason': (
                'All 5 heads pass all 5 gates vs logistic baseline.'
                if (len(blocked) == 0 and promotable)
                else f'{len(blocked)}/{len(HEADS)} heads fail at least one of '
                     f'5 gates (ranking / proper / localCal / overload / replayable); '
                     f'Phase 10 requires ALL five to promote; challenger stays shadow.'
            ),
        },
    }

    # Persist main JSON
    (out_dir / 'head-to-head.json').write_text(
        json.dumps(summary, indent=2, sort_keys=True, default=str))

    # Sidecars
    sidecars = {
        'per-head-metrics.json': {h: r.get('challenger') for h, r in heads_out.items() if not r.get('skipped')},
        'baseline-metrics.json': {h: r.get('baseline') for h, r in heads_out.items() if not r.get('skipped')},
        'challenger-info.json': {h: r.get('challengerInfo') for h, r in heads_out.items() if not r.get('skipped')},
        'gates.json': {h: r.get('gates') for h, r in heads_out.items() if not r.get('skipped')},
        'promotion-decision.json': summary['promotion'],
    }
    for name, blob in sidecars.items():
        (out_dir / 'metric-sidecars' / name).write_text(
            json.dumps(blob, indent=2, sort_keys=True, default=str))

    # meta.txt
    script_hash = _sha256_file(Path(__file__).resolve())
    features_hash = _sha256_file(FEATURES_CSV)
    git_sha = (os.popen(f'git -C {REPO_ROOT} rev-parse HEAD').read().strip() or 'unknown')
    meta = (
        f'[catboost-challenger-local] generated at {summary["generatedAt"]}\n'
        f'seed={SEED}\n'
        f'gitSha={git_sha}\n'
        f'scriptSha256={script_hash}\n'
        f'featuresCsvSha256={features_hash}\n'
        f'challenger=catboost (iterations={CATBOOST_PARAMS["iterations"]} depth={CATBOOST_PARAMS["depth"]} lr={CATBOOST_PARAMS["learning_rate"]})\n'
        f'baseline=logistic-v8-local (isotonic)\n'
        f'headsEvaluated={len([r for r in heads_out.values() if not r.get("skipped")])}/{len(HEADS)}\n'
        f'promotableHeads={len(promotable)}\n'
        f'blockedHeads={len(blocked)}\n'
        f'promotionDecision={summary["promotion"]["decision"]}\n'
        f'corpusAdmissibility=interim\n'
        f'metricSidecarDir={out_dir / "metric-sidecars"}\n'
    )
    (out_dir / 'meta.txt').write_text(meta)

    # Latest pointer
    (OUTPUT_BASE / 'catboost-challenger-local-latest.json').write_text(
        json.dumps({'timestampDir': str(out_dir.relative_to(REPO_ROOT)),
                    'summary': summary}, indent=2, sort_keys=True, default=str))

    print(f'[catboost] wrote {out_dir}')
    print(f'[catboost] promotion.decision = {summary["promotion"]["decision"]}')
    print(f'[catboost] promotable heads  = {promotable}')
    print(f'[catboost] blocked heads     = {blocked}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
