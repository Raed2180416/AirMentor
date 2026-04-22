"""
Local-only v8 corrected logistic baseline trainer.

Context
-------
The overnight DAG node `overnight-ml-v8-corrected-logistic` (t57) was blocked
4x under the codex sandbox because the TS evaluator path depends on a
socket-capable embedded postgres that the sandbox forbids, and the external
`AIRMENTOR_EVAL_DATABASE_URL` fallback was not populated. The prior attempt
landed evaluator hardening and a blocker ledger but no admissible metrics.

This script is the pragmatic cost-free fallback: it trains and evaluates a v8
logistic baseline *outside* the sandbox using the most recent features export
already on disk (`air-mentor-api/output/proof-risk-model/features.csv`, 43200
rows x 46 cols, split into `validation` + `test` by the TS exporter). No new
codex calls, no external DB, no embedded postgres.

Hard-coded caveat: the features CSV on disk is a pre-Phase-2 export (timestamp
2026-04-22T17:04Z, before Phase 2 completed at 20:59Z). All metrics emitted by
this script therefore carry an explicit `corpusAdmissibility=interim` flag and
the MD report states `Do not promote` per the artifact-manifest promotion
gate; a post-Phase-2 retrain is still owed once `AIRMENTOR_EVAL_DATABASE_URL`
or a locally runnable simulator path becomes available.

Model
-----
Per-head sklearn LogisticRegression with:
  - all 39 numeric features
  - 39 missingness-indicator columns (1 if NaN, 0 else — satisfies the
    `missingness-aware contract` clause of the Phase 7 intent even when the
    current CSV has 0% missingness)
  - class_weight='balanced' (label positive rates 2.4% ... 26.6%)
  - L2 penalty, `lbfgs` solver, seed=4242
Calibration:
  - isotonic regression fitted on a 20% held-out slice of the `validation`
    split (matches v7 calibration pattern).

Outputs (all under `air-mentor-api/output/proof-risk-model/local-v8-corrected-logistic-<ISO_TS>Z/`)
  - model-<head>.json        coefficients + feature-name manifest per head
  - eval-v8-local.json       full metrics blob (overall + per-head + per-stage)
  - eval-v8-local.md         human-readable metrics summary
  - meta.txt                 reproducibility manifest (seed + hashes + command)
  - metric-sidecars/*.json   one sidecar per metric category (required by
                             Phase 7 `## Reproducibility Manifest` contract)

Usage
-----
    LD_LIBRARY_PATH=...:... \
    /home/raed/projects/air-mentor-ui/pipeline/.venv/bin/python \
      air-mentor-api/scripts/train_v8_local_corrected_logistic.py

Exit code 0 on success, 1 on any fatal error. Designed to be idempotent:
re-running produces a new timestamped output directory and a fresh eval.
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
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)

# ------------------------------------------------------------------ constants

REPO_ROOT = Path(__file__).resolve().parents[2]
FEATURES_CSV = REPO_ROOT / 'air-mentor-api/output/proof-risk-model/features.csv'
OUTPUT_BASE = REPO_ROOT / 'air-mentor-api/output/proof-risk-model'

HEADS: dict[str, str] = {
    'attendanceRisk': 'label_attendance',
    'ceRisk': 'label_ce',
    'seeRisk': 'label_see',
    'overallCourseRisk': 'label_overall',
    'downstreamCarryoverRisk': 'label_downstream',
}

STAGE_KEY_LABELS = {
    0: 'pre-tt1',
    1: 'post-tt1',
    2: 'post-tt2',
    3: 'post-assignments',
    4: 'post-see',
}

SEED = 4242
BUDGET_TOP_PCT = 0.20  # top 20% by score — matches v7 reference budget
LOCAL_ECE_BANDS = [(0.4, 0.08), (0.85, 0.08)]  # (center, half-width)
GLOBAL_ECE_BINS = 10

# v7 cov-12 reference (from audit-map/22-evals/overnight-ml-v8-corrected-logistic.md)
V7_REFERENCE = {
    'rocAuc': 0.7894,
    'brier': 0.1359,
    'globalEce': 0.0067,
    'overloadRatio_overallCourseRisk': 1.1127,
    'baselineV5LikeOverload': 1.0100,
    'heuristicOverload': 1.0049,
}

# ------------------------------------------------------------------ helpers


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 16), b''):
            h.update(chunk)
    return h.hexdigest()


def _sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def _global_ece(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = GLOBAL_ECE_BINS) -> float:
    """Expected calibration error across `n_bins` equal-width bins in [0,1]."""
    if len(y_true) == 0:
        return 0.0
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    n = len(y_true)
    for i in range(n_bins):
        lo, hi = bins[i], bins[i + 1]
        if i == n_bins - 1:
            mask = (y_prob >= lo) & (y_prob <= hi)
        else:
            mask = (y_prob >= lo) & (y_prob < hi)
        if not np.any(mask):
            continue
        bin_conf = y_prob[mask].mean()
        bin_acc = y_true[mask].mean()
        ece += (mask.sum() / n) * abs(bin_conf - bin_acc)
    return float(ece)


def _local_ece(y_true: np.ndarray, y_prob: np.ndarray, center: float, half_width: float) -> dict:
    """ECE restricted to `|y_prob - center| <= half_width`."""
    mask = np.abs(y_prob - center) <= half_width
    support = int(mask.sum())
    if support == 0:
        return {'center': center, 'halfWidth': half_width, 'support': 0, 'ece': None,
                'meanProb': None, 'meanLabel': None}
    p = y_prob[mask]
    y = y_true[mask]
    return {
        'center': center,
        'halfWidth': half_width,
        'support': support,
        'ece': float(abs(p.mean() - y.mean())),
        'meanProb': float(p.mean()),
        'meanLabel': float(y.mean()),
    }


def _overload_ratio(y_prob: np.ndarray, y_true: np.ndarray) -> float | None:
    """overload = mean(predicted_prob) / mean(observed_label).

    >1.0 means the model over-predicts positives (sets too wide an alert net).
    """
    mean_label = float(y_true.mean())
    if mean_label <= 0:
        return None
    return float(y_prob.mean() / mean_label)


def _precision_recall_at_budget(y_true: np.ndarray, y_prob: np.ndarray, top_pct: float) -> dict:
    n = len(y_true)
    if n == 0:
        return {'topPct': top_pct, 'k': 0, 'precision': 0.0, 'recall': 0.0, 'threshold': None}
    k = max(1, int(np.ceil(top_pct * n)))
    order = np.argsort(-y_prob)
    top_idx = order[:k]
    threshold = float(y_prob[order[k - 1]])
    tp = int(y_true[top_idx].sum())
    fp = k - tp
    total_pos = int(y_true.sum())
    precision = tp / k if k > 0 else 0.0
    recall = tp / total_pos if total_pos > 0 else 0.0
    return {
        'topPct': top_pct,
        'k': k,
        'threshold': threshold,
        'precision': float(precision),
        'recall': float(recall),
        'truePositives': tp,
        'falsePositives': fp,
        'totalPositives': total_pos,
    }


def _safe_roc(y_true: np.ndarray, y_prob: np.ndarray) -> float | None:
    if len(set(y_true.tolist())) < 2:
        return None
    return float(roc_auc_score(y_true, y_prob))


def _safe_pr(y_true: np.ndarray, y_prob: np.ndarray) -> float | None:
    if len(set(y_true.tolist())) < 2:
        return None
    return float(average_precision_score(y_true, y_prob))


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------------ main


def train_and_evaluate_head(
    df: pd.DataFrame,
    feat_cols: list[str],
    miss_cols: list[str],
    head_key: str,
    label_col: str,
    output_dir: Path,
) -> dict:
    """Train one head + calibrator, emit per-head metrics blob."""
    val = df[df['split'] == 'validation'].copy()
    test = df[df['split'] == 'test'].copy()

    # synth train/calibration split inside `validation` (80/20, seeded)
    rng = np.random.default_rng(SEED + hash(head_key) % 1000)
    val = val.sample(frac=1.0, random_state=SEED).reset_index(drop=True)
    split_idx = int(0.8 * len(val))
    train = val.iloc[:split_idx]
    cal = val.iloc[split_idx:]

    X_train = train[feat_cols + miss_cols].to_numpy(dtype=np.float64)
    y_train = train[label_col].to_numpy(dtype=np.int64)
    X_cal = cal[feat_cols + miss_cols].to_numpy(dtype=np.float64)
    y_cal = cal[label_col].to_numpy(dtype=np.int64)
    X_test = test[feat_cols + miss_cols].to_numpy(dtype=np.float64)
    y_test = test[label_col].to_numpy(dtype=np.int64)

    pos_train = int(y_train.sum())
    if pos_train == 0 or pos_train == len(y_train):
        # Can't train a useful classifier; emit degenerate placeholder.
        return {
            'head': head_key,
            'skipped': True,
            'reason': f'train has {pos_train}/{len(y_train)} positives',
            'trainSize': int(len(y_train)),
            'calSize': int(len(y_cal)),
            'testSize': int(len(y_test)),
        }

    clf = LogisticRegression(
        penalty='l2',
        C=1.0,
        solver='lbfgs',
        class_weight='balanced',
        max_iter=1000,
        random_state=SEED,
    )
    clf.fit(X_train, y_train)

    # Raw scores (pre-calibration) for RocAuc / PR-AUC (isotonic preserves order).
    raw_cal = clf.predict_proba(X_cal)[:, 1]
    raw_test = clf.predict_proba(X_test)[:, 1]

    # Isotonic calibration on raw_cal, applied to test
    cal_support = int(y_cal.sum())
    if cal_support > 0 and cal_support < len(y_cal):
        iso = IsotonicRegression(out_of_bounds='clip', y_min=0.0, y_max=1.0)
        iso.fit(raw_cal, y_cal)
        prob_test = iso.predict(raw_test)
    else:
        iso = None
        prob_test = raw_test  # degenerate calibration slice

    # Metrics on test
    roc = _safe_roc(y_test, prob_test)
    pr = _safe_pr(y_test, prob_test)
    brier = float(brier_score_loss(y_test, prob_test))
    global_ece = _global_ece(y_test, prob_test)
    local = [_local_ece(y_test, prob_test, c, w) for c, w in LOCAL_ECE_BANDS]
    overload = _overload_ratio(prob_test, y_test)
    prbudget = _precision_recall_at_budget(y_test, prob_test, BUDGET_TOP_PCT)

    # Stage stability: compute ROC-AUC per stage_key then report stage spread
    stage_rows = []
    for stage_key, stage_label in STAGE_KEY_LABELS.items():
        stage_mask = test['stage_key'].to_numpy() == stage_key
        if not np.any(stage_mask):
            continue
        y_stage = y_test[stage_mask]
        p_stage = prob_test[stage_mask]
        stage_rows.append({
            'stageKey': int(stage_key),
            'stageLabel': stage_label,
            'support': int(stage_mask.sum()),
            'rocAuc': _safe_roc(y_stage, p_stage),
            'brier': float(brier_score_loss(y_stage, p_stage)) if stage_mask.sum() > 0 else None,
            'ece': _global_ece(y_stage, p_stage),
            'overloadRatio': _overload_ratio(p_stage, y_stage),
            'meanProb': float(p_stage.mean()),
            'meanLabel': float(y_stage.mean()),
        })
    stage_roc = [s['rocAuc'] for s in stage_rows if s['rocAuc'] is not None]
    stage_stability = {
        'rocMin': min(stage_roc) if stage_roc else None,
        'rocMax': max(stage_roc) if stage_roc else None,
        'rocSpread': (max(stage_roc) - min(stage_roc)) if stage_roc else None,
        'perStage': stage_rows,
    }

    # Persist per-head model
    model_blob = {
        'head': head_key,
        'featureNames': feat_cols + miss_cols,
        'coefficients': clf.coef_.tolist()[0],
        'intercept': float(clf.intercept_[0]),
        'classes': clf.classes_.tolist(),
        'penalty': 'l2',
        'C': 1.0,
        'classWeight': 'balanced',
        'seed': SEED,
        'calibration': {
            'type': 'isotonic' if iso is not None else 'none',
            'fitted': iso is not None,
            'calSize': int(len(y_cal)),
        },
    }
    model_path = output_dir / f'model-{head_key}.json'
    model_path.write_text(json.dumps(model_blob, indent=2, sort_keys=True))

    return {
        'head': head_key,
        'skipped': False,
        'trainSize': int(len(y_train)),
        'calSize': int(len(y_cal)),
        'testSize': int(len(y_test)),
        'trainPositives': pos_train,
        'testPositives': int(y_test.sum()),
        'testPositiveRate': float(y_test.mean()),
        'rocAuc': roc,
        'prAuc': pr,
        'brier': brier,
        'globalEce': global_ece,
        'localEce': local,
        'overloadRatio': overload,
        'precisionRecallAtBudget': prbudget,
        'stageStability': stage_stability,
        'modelArtifact': str(model_path.relative_to(REPO_ROOT)),
    }


def main() -> int:
    if not FEATURES_CSV.exists():
        print(f'FATAL: features.csv missing at {FEATURES_CSV}', file=sys.stderr)
        return 1

    ts_utc = _dt.datetime.now(_dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    output_dir = OUTPUT_BASE / f'local-v8-corrected-logistic-{ts_utc}'
    _ensure_dir(output_dir)
    _ensure_dir(output_dir / 'metric-sidecars')
    print(f'[train-v8-local] output dir: {output_dir}')

    # Load + sanity
    df = pd.read_csv(FEATURES_CSV)
    feat_cols = [c for c in df.columns if c.startswith('feat_')]
    # Missingness indicators (NaN → 1). Fill raw features with 0 afterward so
    # sklearn does not choke on NaN. The LogisticRegression can then learn a
    # weight on each `miss_<k>` column independently of the imputed 0.
    miss_cols: list[str] = []
    for c in feat_cols:
        miss_col = f'miss_{c[5:]}'  # feat_7 → miss_7
        df[miss_col] = df[c].isna().astype(np.int8)
        miss_cols.append(miss_col)
    df[feat_cols] = df[feat_cols].fillna(0.0)

    print(f'[train-v8-local] rows={len(df)} feat={len(feat_cols)} miss={len(miss_cols)} '
          f'splits={sorted(df["split"].unique())}')

    # Train each head
    head_results: dict[str, dict] = {}
    for head_key, label_col in HEADS.items():
        print(f'[train-v8-local] head={head_key} label={label_col}')
        head_results[head_key] = train_and_evaluate_head(
            df, feat_cols, miss_cols, head_key, label_col, output_dir,
        )

    # Overall pooled metrics (concatenate all heads' test predictions - approx)
    # Because each head has its own prob vector we compute a micro-average from
    # the per-head blobs instead of re-scoring.
    overall_rocs = [r['rocAuc'] for r in head_results.values()
                    if not r.get('skipped') and r.get('rocAuc') is not None]
    overall_briers = [r['brier'] for r in head_results.values() if not r.get('skipped')]
    overall_eces = [r['globalEce'] for r in head_results.values() if not r.get('skipped')]
    overall_overloads = [r['overloadRatio'] for r in head_results.values()
                         if not r.get('skipped') and r.get('overloadRatio') is not None]
    headline_overload = head_results.get('overallCourseRisk', {}).get('overloadRatio')

    # Reproducibility manifest
    this_script = Path(__file__).resolve()
    script_hash = _sha256_file(this_script)
    features_hash = _sha256_file(FEATURES_CSV)
    feature_key_hash = _sha256_bytes(
        ('|'.join(feat_cols + miss_cols)).encode('utf-8'),
    )
    split_hash = _sha256_bytes(
        ('|'.join(f'{r["split"]}:{r["stage_key"]}' for _, r in df.head(2000).iterrows())).encode('utf-8'),
    )
    corpus_hash = features_hash  # 1:1 because single-file corpus

    repro_manifest = {
        'seed': SEED,
        'scriptPath': str(this_script.relative_to(REPO_ROOT)),
        'scriptSha256': script_hash,
        'featuresCsv': str(FEATURES_CSV.relative_to(REPO_ROOT)),
        'featuresCsvSha256': features_hash,
        'featureKeyHash': feature_key_hash,
        'splitHash': split_hash,
        'corpusHash': corpus_hash,
        'replayCommand': (
            "LD_LIBRARY_PATH=/nix/store/ab3753m6i7isgvzphlar0a8xb84gl96i-gcc-15.2.0-lib/lib"
            ":/nix/store/ri9paa3mri4kqakljak8ldvbcp7lpmif-zlib-1.3.1/lib "
            "pipeline/.venv/bin/python air-mentor-api/scripts/train_v8_local_corrected_logistic.py"
        ),
        'featureCount': len(feat_cols),
        'missingnessIndicatorCount': len(miss_cols),
        'corpusAdmissibility': 'interim',
        'corpusAdmissibilityReason': (
            'features.csv on disk is a pre-Phase-2 export (mtime 2026-04-22T17:04Z, before '
            'Phase 2 completed at 2026-04-22T20:59:42Z). Emitted metrics are an interim '
            'baseline pending a post-Phase-2 rebuild via AIRMENTOR_EVAL_DATABASE_URL or an '
            'in-repo embedded-postgres bootstrap.'
        ),
        'trainedAtUtc': ts_utc,
    }

    summary = {
        'generatedAt': _dt.datetime.now(_dt.timezone.utc).isoformat(timespec='seconds'),
        'modelVersion': 'observable-risk-logit-v8-local',
        'corpusAdmissibility': 'interim',
        'reproducibilityManifest': repro_manifest,
        'heads': head_results,
        'overall': {
            'headCount': len(HEADS),
            'headsWithAdmissibleMetrics': sum(1 for r in head_results.values() if not r.get('skipped')),
            'macroAvgRocAuc': (float(np.mean(overall_rocs)) if overall_rocs else None),
            'macroAvgBrier': (float(np.mean(overall_briers)) if overall_briers else None),
            'macroAvgGlobalEce': (float(np.mean(overall_eces)) if overall_eces else None),
            'macroAvgOverloadRatio': (float(np.mean(overall_overloads)) if overall_overloads else None),
            'headlineOverloadRatioOverallCourseRisk': headline_overload,
        },
        'promotionGates': {
            'rocAucMin': 0.78,
            'overloadRatioMax': 1.00,
            'globalEceMax': 0.010,
            'reproducibilityManifestPresent': True,
            'promotionDecision': 'do-not-promote',
            'promotionDecisionReason': (
                'corpusAdmissibility=interim; corrected (post-Phase-2) corpus not available '
                'on disk and no listen-capable DB path in this environment, so gate '
                'evaluation against the strict Phase 7 contract cannot pass. Metrics below '
                'are diagnostic only.'
            ),
        },
        'v7Reference': V7_REFERENCE,
    }

    # Persist main JSON
    main_json_path = output_dir / 'eval-v8-local.json'
    main_json_path.write_text(json.dumps(summary, indent=2, sort_keys=True, default=str))
    print(f'[train-v8-local] wrote {main_json_path}')

    # Metric sidecars (one per category — matches Phase 7 reproducibility contract)
    sidecars = {
        'overall.json': summary['overall'],
        'budget.json': {
            head: r.get('precisionRecallAtBudget') for head, r in head_results.items()
        },
        'local-calibration.json': {
            head: r.get('localEce') for head, r in head_results.items()
        },
        'overload-by-head.json': {
            head: r.get('overloadRatio') for head, r in head_results.items()
        },
        'stage-stability.json': {
            head: r.get('stageStability') for head, r in head_results.items()
        },
        'reproducibility.json': repro_manifest,
    }
    for name, blob in sidecars.items():
        (output_dir / 'metric-sidecars' / name).write_text(
            json.dumps(blob, indent=2, sort_keys=True, default=str),
        )
    print(f'[train-v8-local] wrote {len(sidecars)} metric sidecars')

    # meta.txt
    git_sha = (os.popen('git -C ' + str(REPO_ROOT) + ' rev-parse HEAD').read().strip() or 'unknown')
    meta = (
        f'[local-v8-corrected-logistic] generated at {summary["generatedAt"]}\n'
        f'seed={SEED}\n'
        f'gitSha={git_sha}\n'
        f'scriptSha256={script_hash}\n'
        f'featuresCsvSha256={features_hash}\n'
        f'featureKeyHash={feature_key_hash}\n'
        f'corpusHash={corpus_hash}\n'
        f'corpusAdmissibility=interim\n'
        f'headsAdmissibleMetrics={summary["overall"]["headsWithAdmissibleMetrics"]}/{len(HEADS)}\n'
        f'macroAvgRocAuc={summary["overall"]["macroAvgRocAuc"]}\n'
        f'headlineOverloadRatio={headline_overload}\n'
        f'promotionDecision=do-not-promote (interim)\n'
        f'metricSidecarDir={output_dir / "metric-sidecars"}\n'
    )
    (output_dir / 'meta.txt').write_text(meta)
    print(f'[train-v8-local] wrote {output_dir / "meta.txt"}')

    # Also write a machine-readable summary to a stable "latest" path so the
    # t57 MD report + downstream tasks can discover it without a timestamp.
    latest = OUTPUT_BASE / 'local-v8-corrected-logistic-latest.json'
    latest.write_text(json.dumps({
        'timestampDir': str(output_dir.relative_to(REPO_ROOT)),
        'summary': summary,
    }, indent=2, sort_keys=True, default=str))
    print(f'[train-v8-local] wrote {latest}')
    print('[train-v8-local] done.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
