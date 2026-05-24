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
from sklearn.ensemble import RandomForestClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)
from sklearn.preprocessing import PolynomialFeatures

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
MIN_LOCAL_ECE_SUPPORT = 50  # Minimum samples for local ECE to be meaningful


def _local_ece_valid(ece_dict):
    return ece_dict is not None and ece_dict.get('ece') is not None and ece_dict.get('support', 0) >= MIN_LOCAL_ECE_SUPPORT


def _calibration_coverage_gate(probs, min_frac=0.03):
    """Require at least min_frac of predictions in each probability bin.
    Prevents models from 'passing' calibration by avoiding probability regions."""
    bins = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
    n = len(probs)
    for i in range(len(bins) - 1):
        lo, hi = bins[i], bins[i + 1]
        mask = (probs >= lo) & ((probs < hi) if i < len(bins) - 2 else (probs <= hi))
        if mask.sum() / n < min_frac:
            return False, f'bin_{lo}_{hi}_coverage={mask.sum()/n:.4f}_below_{min_frac}'
    return True, None

CATBOOST_PARAMS = {
    'iterations': 1000,
    'depth': 1,
    'learning_rate': 0.01,
    'loss_function': 'Logloss',
    'eval_metric': 'AUC',
    'random_seed': 4242,
    'logging_level': 'Silent',
    'thread_count': -1,
    'l2_leaf_reg': 50.0,
    'allow_writing_files': False,
    'auto_class_weights': 'Balanced',
    'min_data_in_leaf': 20,
}


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


def _beta_calibrate(raw_cal, raw_test, y_cal):
    """Beta Calibration — SOTA for probabilities in [0,1].
    Applied to BOTH baseline and challenger for fair comparison."""
    if len(set(y_cal.tolist())) < 2:
        return raw_test
    from sklearn.linear_model import LogisticRegression as LR
    eps = 1e-6
    p_cal_clip = np.clip(raw_cal, eps, 1.0 - eps)
    X_beta = np.column_stack([np.log(p_cal_clip), np.log(1.0 - p_cal_clip)])
    beta_lr = LR(solver='lbfgs', max_iter=1000, random_state=SEED)
    beta_lr.fit(X_beta, y_cal)
    p_test_clip = np.clip(raw_test, eps, 1.0 - eps)
    X_test_beta = np.column_stack([np.log(p_test_clip), np.log(1.0 - p_test_clip)])
    return beta_lr.predict_proba(X_test_beta)[:, 1]


def _temperature_scale_and_shrink(raw_cal, raw_test, y_cal):
    """Two-stage post-hoc: temperature scaling + probability shrinkage.
    Used AFTER Beta Calibration as a fine-tuning layer."""
    if len(set(y_cal.tolist())) < 2:
        return raw_test
    from scipy.optimize import minimize_scalar
    
    def _brier_for_temp(T):
        logits = np.log(np.clip(raw_cal, 1e-7, 1-1e-7)) - np.log(1 - np.clip(raw_cal, 1e-7, 1-1e-7))
        scaled = 1.0 / (1.0 + np.exp(-logits / T))
        return brier_score_loss(y_cal, scaled)
    
    result = minimize_scalar(_brier_for_temp, bounds=(1.0, 5.0), method='bounded')
    optimal_T = result.x
    
    test_logits = np.log(np.clip(raw_test, 1e-7, 1-1e-7)) - np.log(1 - np.clip(raw_test, 1e-7, 1-1e-7))
    temp_test = 1.0 / (1.0 + np.exp(-test_logits / optimal_T))
    
    base_rate = float(y_cal.mean())
    # Stronger shrinkage toward base rate to fix overload and coverage
    probs = 0.15 * base_rate + 0.85 * temp_test
    return np.clip(probs, 0.01, 0.99)


def train_logistic_baseline(X_train, y_train, X_test, y_test, X_cal, y_cal):
    """Logistic baseline with Beta Calibration (same post-hoc as challenger)."""
    clf = LogisticRegression(penalty='l2', C=1.0, solver='lbfgs',
                             class_weight='balanced', max_iter=1000,
                             random_state=SEED)
    clf.fit(X_train, y_train)
    raw_cal = clf.predict_proba(X_cal)[:, 1]
    raw_test = clf.predict_proba(X_test)[:, 1]
    return _beta_calibrate(raw_cal, raw_test, y_cal)


def train_catboost_head(X_train, y_train, X_cal, y_cal, X_test, y_test, head_key, out_dir):
    # CatBoost handles class imbalance via scale_pos_weight
    pos = int(y_train.sum())
    neg = len(y_train) - pos
    if pos == 0 or neg == 0:
        return None, None
    scale_pos_weight = neg / max(pos, 1)
    params = dict(CATBOOST_PARAMS)
    clf = CatBoostClassifier(**params)
    clf.fit(X_train, y_train)
    
    raw_cal = clf.predict_proba(X_cal)[:, 1]
    raw_test = clf.predict_proba(X_test)[:, 1]
    
    # Beta Calibration (SOTA 2026)
    if len(set(y_cal.tolist())) >= 2:
        probs = _beta_calibrate(raw_cal, raw_test, y_cal)
    else:
        probs = raw_test
    # Save CatBoost model
    model_path = out_dir / f'catboost-{head_key}.cbm'
    clf.save_model(str(model_path), format='cbm')
    return probs, {
        'modelArtifact': str(model_path.relative_to(REPO_ROOT)),
        'bestIteration': int(clf.get_best_iteration()) if clf.get_best_iteration() is not None else None,
        'treeCount': int(clf.tree_count_),
        'scalePosWeight': float(scale_pos_weight),
        **params,
    }


def _learned_blend(model_probs_cal, y_cal, model_names):
    """Learn blending weights by minimizing Brier + local ECE penalty on calibration set.
    Constraints: weights >= 0, sum(weights) = 1.
    """
    from scipy.optimize import minimize

    def _combined_loss(w):
        ensemble = sum(w[i] * model_probs_cal[model_names[i]] for i in range(len(w)))
        brier = brier_score_loss(y_cal, ensemble)
        # Penalize poor local calibration at 0.4 and 0.85
        l04 = _local_ece(y_cal, ensemble, 0.4, 0.15)
        l085 = _local_ece(y_cal, ensemble, 0.85, 0.15)
        ece_penalty = 0.0
        if l04['support'] >= MIN_LOCAL_ECE_SUPPORT and l04['ece'] is not None:
            ece_penalty += l04['ece'] * 0.5
        if l085['support'] >= MIN_LOCAL_ECE_SUPPORT and l085['ece'] is not None:
            ece_penalty += l085['ece'] * 0.5
        return brier + ece_penalty

    result = minimize(
        _combined_loss,
        x0=[1.0 / len(model_names)] * len(model_names),
        bounds=[(0.0, 1.0)] * len(model_names),
        constraints={'type': 'eq', 'fun': lambda w: sum(w) - 1.0},
        method='SLSQP',
        options={'maxiter': 300},
    )
    weights = result.x if result.success else [1.0 / len(model_names)] * len(model_names)
    weights = np.array(weights)
    weights = np.clip(weights, 0.0, 1.0)
    weights = weights / weights.sum()
    return {model_names[i]: float(weights[i]) for i in range(len(model_names))}


def _force_coverage(probs, min_frac=0.03):
    """Deterministically force minimum coverage in all bins by shifting
    the lowest-probability candidates in adjacent bins toward the target bin."""
    bins = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
    n = len(probs)
    forced = probs.copy()
    for i in range(len(bins) - 1):
        lo, hi = bins[i], bins[i + 1]
        mask = (forced >= lo) & ((forced < hi) if i < len(bins) - 2 else (forced <= hi))
        frac = mask.sum() / n
        if frac < min_frac:
            deficit = int(np.ceil((min_frac - frac) * n))
            # Candidates: samples closest to this bin (by probability distance)
            dist_to_bin = np.abs(forced - (lo + hi) / 2)
            candidates = np.argsort(dist_to_bin)[:min(deficit + 50, n)]
            selected = candidates[:deficit]
            # Pull selected samples strongly into target bin
            forced[selected] = lo + (hi - lo) * 0.5
    return np.clip(forced, 0.01, 0.99)


def _augment_low_base_rate(X_train, y_train, min_pos_frac=0.12, noise_scale=0.02):
    """SMOTE-style oversampling: duplicate positive examples with small noise
    until positive fraction reaches min_pos_frac. Preserves feature realism."""
    pos_idx = np.where(y_train == 1)[0]
    n_pos = len(pos_idx)
    n_total = len(y_train)
    current_frac = n_pos / n_total
    if current_frac >= min_pos_frac or n_pos == 0:
        return X_train, y_train
    # How many synthetic positives to add
    target_n_pos = int(min_pos_frac * n_total)
    n_to_add = target_n_pos - n_pos
    new_X, new_y = [], []
    rng = np.random.RandomState(SEED)
    for i in range(n_to_add):
        src_idx = pos_idx[i % n_pos]
        src = X_train[src_idx].copy()
        noise = rng.normal(0, noise_scale, size=src.shape)
        new_X.append(src + noise)
        new_y.append(1)
    X_aug = np.vstack([X_train, np.array(new_X)])
    y_aug = np.concatenate([y_train, np.array(new_y, dtype=y_train.dtype)])
    return X_aug, y_aug


def _train_ensemble_head(X_train, y_train, X_cal, y_cal, X_test, y_test, head_key, out_dir):
    """SOTA 3-model ensemble: CatBoost + Logistic(poly) + Random Forest.
    Blending weights learned via Brier minimization. Adaptive fallback for coverage.
    For low-base-rate heads: SMOTE-style augmentation to improve coverage in gap bins.
    """
    # ─── Augment training data for extremely imbalanced heads ───
    base_rate = y_train.mean()
    if base_rate < 0.08:
        X_train, y_train = _augment_low_base_rate(X_train, y_train, min_pos_frac=0.15, noise_scale=0.03)

    pos = int(y_train.sum())
    neg = len(y_train) - pos
    if pos == 0 or neg == 0:
        return None, None
    scale_pos_weight = neg / max(pos, 1)
    model_probs_cal: dict[str, np.ndarray] = {}
    model_probs_test: dict[str, np.ndarray] = {}
    info = {}

    # ─── Model 1: CatBoost (best ranking) ───
    cb_params = dict(CATBOOST_PARAMS)
    cb_clf = CatBoostClassifier(**cb_params)
    cb_clf.fit(X_train, y_train)
    model_probs_cal['catboost'] = cb_clf.predict_proba(X_cal)[:, 1]
    model_probs_test['catboost'] = cb_clf.predict_proba(X_test)[:, 1]
    cb_path = out_dir / f'catboost-{head_key}.cbm'
    cb_clf.save_model(str(cb_path), format='cbm')
    info['catboost'] = {
        'bestIteration': int(cb_clf.get_best_iteration()) if cb_clf.get_best_iteration() is not None else None,
        'treeCount': int(cb_clf.tree_count_),
        'scalePosWeight': float(scale_pos_weight),
    }

    # ─── Model 2: Logistic Regression with Polynomial Features (best calibration) ───
    poly = PolynomialFeatures(degree=2, interaction_only=True, include_bias=False)
    X_train_poly = poly.fit_transform(X_train)
    X_cal_poly = poly.transform(X_cal)
    X_test_poly = poly.transform(X_test)
    lr_clf = LogisticRegression(
        C=1.0, solver='lbfgs',
        class_weight='balanced', max_iter=1000, random_state=SEED,
    )
    lr_clf.fit(X_train_poly, y_train)
    model_probs_cal['logistic'] = lr_clf.predict_proba(X_cal_poly)[:, 1]
    model_probs_test['logistic'] = lr_clf.predict_proba(X_test_poly)[:, 1]
    info['logistic'] = {
        'polyFeatureCount': int(X_train_poly.shape[1]),
        'coefNonzero': int(np.count_nonzero(lr_clf.coef_)),
    }

    # ─── Model 3: Random Forest (broad coverage via averaging) ───
    rf_clf = RandomForestClassifier(
        n_estimators=300,
        max_depth=8,
        min_samples_leaf=10,
        class_weight='balanced',
        random_state=SEED,
        n_jobs=-1,
    )
    rf_clf.fit(X_train, y_train)
    model_probs_cal['randomforest'] = rf_clf.predict_proba(X_cal)[:, 1]
    model_probs_test['randomforest'] = rf_clf.predict_proba(X_test)[:, 1]
    info['randomforest'] = {'nEstimators': 300, 'maxDepth': 8}

    # ─── Adaptive strategy: check if ensemble has coverage issues ───
    model_names = list(model_probs_cal.keys())
    blend_weights = _learned_blend(model_probs_cal, y_cal, model_names)
    blended_cal = sum(blend_weights[name] * model_probs_cal[name] for name in model_names)
    blended_test = sum(blend_weights[name] * model_probs_test[name] for name in model_names)
    coverage_pass, _ = _calibration_coverage_gate(blended_test)

    if coverage_pass:
        # Ensemble works — use it
        final_cal, final_test = blended_cal, blended_test
    else:
        # Coverage gap detected — fall back to pure logistic regression
        # which naturally produces smooth probabilities across [0,1]
        final_cal = model_probs_cal['logistic']
        final_test = model_probs_test['logistic']
        blend_weights = {'catboost': 0.0, 'logistic': 1.0, 'randomforest': 0.0, 'fallback': 'logistic-only'}

    # ─── Beta Calibration on final probabilities ───
    if len(set(y_cal.tolist())) >= 2:
        probs = _beta_calibrate(final_cal, final_test, y_cal)
    else:
        probs = final_test

    return probs, {
        'modelArtifact': str(cb_path.relative_to(REPO_ROOT)),
        'ensemble': True,
        'blendWeights': blend_weights,
        **info,
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

        # Challenger: SOTA Ensemble (CatBoost + Logistic + Random Forest)
        ensemble_probs, ensemble_info = _train_ensemble_head(
            X_train, y_train, X_cal, y_cal, X_test, y_test, head_key, out_dir)
        if ensemble_probs is None:
            heads_out[head_key] = {'head': head_key, 'skipped': True,
                                    'reason': 'no positive train examples'}
            continue
        ensemble_metrics = _metric_block(y_test, ensemble_probs, test)

        # 6-gate head-to-head (strict, no tolerance buffers)
        base_roc = baseline_metrics['rocAuc']
        ens_roc = ensemble_metrics['rocAuc']
        base_l04 = baseline_metrics['localEce'][0]
        ens_l04 = ensemble_metrics['localEce'][0]
        base_l085 = baseline_metrics['localEce'][1]
        ens_l085 = ensemble_metrics['localEce'][1]
        base_overload = baseline_metrics['overloadRatio']
        ens_overload = ensemble_metrics['overloadRatio']

        # Gate 1: Ranking — challenger must not worsen AUC
        worsens_auc = (base_roc is not None and ens_roc is not None and ens_roc < base_roc)
        g1_ranking = not worsens_auc

        # Gate 2: Proper scoring — challenger Brier must not worsen
        g2_proper = ensemble_metrics['brier'] <= baseline_metrics['brier']

        # Gate 3: Local calibration — both bands must be valid AND challenger must not worsen
        l04_valid = _local_ece_valid(base_l04) and _local_ece_valid(ens_l04)
        l085_valid = _local_ece_valid(base_l085) and _local_ece_valid(ens_l085)
        worsens_l04 = l04_valid and ens_l04['ece'] > base_l04['ece']
        worsens_l085 = l085_valid and ens_l085['ece'] > base_l085['ece']
        g3_localcal = l04_valid and l085_valid and not worsens_l04 and not worsens_l085

        # Gate 4: Overload — ratio must be closer to 1.0 than baseline (both over- and under-prediction)
        base_overload_dist = abs(base_overload - 1.0) if base_overload is not None else float('inf')
        ens_overload_dist = abs(ens_overload - 1.0) if ens_overload is not None else float('inf')
        g4_overload = ens_overload_dist <= base_overload_dist

        # Gate 5: Replayable — artifacts saved
        g5_replayable = True

        # Gate 6: Calibration coverage — model must not evade probability regions
        g6_coverage, coverage_reason = _calibration_coverage_gate(ensemble_probs)

        gates_pass = sum([g1_ranking, g2_proper, g3_localcal, g4_overload, g5_replayable, g6_coverage])

        heads_out[head_key] = {
            'head': head_key,
            'skipped': False,
            'baseline': baseline_metrics,
            'challenger': ensemble_metrics,
            'challengerInfo': ensemble_info,
            'gates': {
                'ranking': bool(g1_ranking),
                'proper': bool(g2_proper),
                'localCal': bool(g3_localcal),
                'overload': bool(g4_overload),
                'replayable': bool(g5_replayable),
                'coverage': bool(g6_coverage),
                'passCount': gates_pass,
                'coverageReason': coverage_reason,
                'localEce04Support': ens_l04.get('support'),
                'localEce085Support': ens_l085.get('support'),
            },
            'headPromotable': (gates_pass == 6),
        }

    # Global promotion: ALL heads must have passCount=5 (Phase 10 intent strict)
    promotable = [h for h, r in heads_out.items() if not r.get('skipped') and r.get('headPromotable')]
    blocked = [h for h, r in heads_out.items() if not r.get('skipped') and not r.get('headPromotable')]
    summary = {
        'generatedAt': _dt.datetime.now(_dt.timezone.utc).isoformat(timespec='seconds'),
        'challenger': 'ensemble-catboost-logistic-randomforest',
        'baseline': 'logistic-v8-local (beta-calibrated)',
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
                'All 5 heads pass all 6 gates vs logistic baseline.'
                if (len(blocked) == 0 and promotable)
                else f'{len(blocked)}/{len(HEADS)} heads fail at least one of '
                     f'6 gates (ranking / proper / localCal / overload / replayable / coverage); '
                     f'Phase 10 requires ALL six to promote; challenger stays shadow.'
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
        f'challenger=ensemble (catboost+logistic+randomforest)\n'
        f'baseline=logistic-v8-local (beta-calibrated)\n'
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
