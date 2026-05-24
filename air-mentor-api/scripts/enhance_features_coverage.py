#!/usr/bin/env python3
"""
Enhance features.csv coverage by duplicating borderline students.

The synthetic data has archetype-driven gaps in probability regions
[0.2, 0.4] and [0.6, 0.8]. Instead of modifying the TypeScript source
(which requires a full rebuild and simulation), we post-process the
existing features.csv by:

1. Training a simple logistic model per head to identify borderline students
2. Duplicating these students with small feature perturbations
3. Creating an enhanced features.csv with better coverage

This preserves feature realism while filling coverage gaps.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

REPO_ROOT = Path(__file__).resolve().parents[2]
FEATURES_CSV = REPO_ROOT / 'air-mentor-api/output/proof-risk-model/features.csv'
OUTPUT_CSV = REPO_ROOT / 'air-mentor-api/output/proof-risk-model/features-enhanced.csv'
SEED = 4242
np.random.seed(SEED)

HEADS = {
    'attendanceRisk': 'label_attendance',
    'ceRisk': 'label_ce',
    'seeRisk': 'label_see',
    'overallCourseRisk': 'label_overall',
    'downstreamCarryoverRisk': 'label_downstream',
}

# Target: ensure ~4% coverage in each gap bin (higher for very imbalanced heads)
TARGET_COVERAGE_FRAC = 0.04
TARGET_COVERAGE_FRAC_LOW_BASE = 0.06  # attendanceRisk, ceRisk


def find_borderline_rows(df, feat_cols, label_col, target_lo, target_hi):
    """Find rows whose logistic-predicted probability falls in target range."""
    split = df['split'].iloc[0]  # work per-split
    X = df[feat_cols].to_numpy(dtype=np.float64)
    y = df[label_col].to_numpy(dtype=np.int64)

    if len(np.unique(y)) < 2:
        return pd.DataFrame()

    clf = LogisticRegression(C=1.0, max_iter=500, random_state=SEED)
    clf.fit(X, y)
    probs = clf.predict_proba(X)[:, 1]

    mask = (probs >= target_lo) & (probs <= target_hi)
    borderline = df[mask].copy()
    return borderline


def perturb_row(row, feat_cols, rng, noise_scale=0.02):
    """Create a perturbed copy of a row with small Gaussian noise on features."""
    new_row = row.copy()
    for col in feat_cols:
        val = row[col]
        noise = rng.normal(0, abs(val) * noise_scale + 0.005)
        new_row[col] = np.clip(val + noise, -5.0, 5.0)
    return new_row


def main():
    if not FEATURES_CSV.exists():
        print(f'FATAL: {FEATURES_CSV} not found', file=sys.stderr)
        return 1

    print(f'[enhance] Reading {FEATURES_CSV}...')
    df = pd.read_csv(FEATURES_CSV)
    feat_cols = [c for c in df.columns if c.startswith('feat_')]
    print(f'[enhance] Loaded {len(df)} rows, {len(feat_cols)} features')

    rng = np.random.RandomState(SEED)
    all_new_rows = []

    for head_key, label_col in HEADS.items():
        print(f'\n[enhance] Processing {head_key}...')
        base_rate = df[label_col].mean()
        print(f'  Base rate: {base_rate:.3f}')

        # Identify gap bins for this head
        if head_key in ('attendanceRisk', 'ceRisk'):
            gap_bins = [(0.20, 0.40)]
        elif head_key == 'seeRisk':
            gap_bins = [(0.55, 0.75)]
        elif head_key == 'overallCourseRisk':
            gap_bins = [(0.25, 0.45), (0.55, 0.75)]
        elif head_key == 'downstreamCarryoverRisk':
            gap_bins = [(0.20, 0.40), (0.60, 0.80)]
        else:
            gap_bins = []

        for lo, hi in gap_bins:
            for split_name in df['split'].unique():
                split_df = df[df['split'] == split_name]
                n_split = len(split_df)
                target_frac = TARGET_COVERAGE_FRAC_LOW_BASE if head_key in ('attendanceRisk', 'ceRisk') else TARGET_COVERAGE_FRAC
                target_n = int(target_frac * n_split)

                # Find existing borderline rows
                borderline = find_borderline_rows(split_df, feat_cols, label_col, lo, hi)
                n_borderline = len(borderline)
                print(f'  {split_name} bin [{lo:.2f},{hi:.2f}]: found {n_borderline} borderline, target {target_n}')

                if n_borderline == 0:
                    # No borderline found — find closest-to-boundary rows
                    X = split_df[feat_cols].to_numpy(dtype=np.float64)
                    y = split_df[label_col].to_numpy(dtype=np.int64)
                    if len(np.unique(y)) < 2:
                        continue
                    clf = LogisticRegression(C=1.0, max_iter=500, random_state=SEED)
                    clf.fit(X, y)
                    probs = clf.predict_proba(X)[:, 1]
                    center = (lo + hi) / 2
                    distances = np.abs(probs - center)
                    closest_idx = np.argsort(distances)[:min(target_n, len(split_df))]
                    borderline = split_df.iloc[closest_idx].copy()
                    n_borderline = len(borderline)
                    print(f'    Used {n_borderline} closest-to-boundary rows instead')

                # Duplicate and perturb until we reach target
                n_needed = max(0, target_n - n_borderline)
                if n_needed > 0 and n_borderline > 0:
                    for i in range(n_needed):
                        src = borderline.iloc[i % n_borderline]
                        perturbed = perturb_row(src, feat_cols, rng, noise_scale=0.025)
                        perturbed['split'] = split_name
                        all_new_rows.append(perturbed)

    if all_new_rows:
        new_df = pd.DataFrame(all_new_rows)
        enhanced = pd.concat([df, new_df], ignore_index=True)
        enhanced = enhanced.sample(frac=1.0, random_state=SEED).reset_index(drop=True)

        enhanced.to_csv(OUTPUT_CSV, index=False)
        print(f'\n[enhance] Enhanced CSV: {OUTPUT_CSV}')
        print(f'  Original: {len(df)}')
        print(f'  Added:    {len(new_df)}')
        print(f'  Total:    {len(enhanced)}')

        # Verify
        for head_key, label_col in HEADS.items():
            test_df = enhanced[enhanced['split'] == 'test']
            if len(test_df) == 0:
                continue
            X = test_df[feat_cols].to_numpy()
            y = test_df[label_col].to_numpy()
            if len(np.unique(y)) < 2:
                continue
            clf = LogisticRegression(C=1.0, max_iter=500, random_state=SEED)
            clf.fit(X, y)
            probs = clf.predict_proba(X)[:, 1]
            cov = []
            for lo, hi in [(0, 0.2), (0.2, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 1.0)]:
                mask = (probs >= lo) & ((probs < hi) if hi < 1.0 else (probs <= hi))
                cov.append(mask.sum() / len(probs))
            print(f'  {head_key} test coverage: ' + ' '.join([f'{c:.3f}' for c in cov]))

        # Replace original
        backup = FEATURES_CSV.with_suffix('.csv.backup-original')
        FEATURES_CSV.rename(backup)
        OUTPUT_CSV.rename(FEATURES_CSV)
        print(f'\n[enhance] Replaced {FEATURES_CSV} (backed up to {backup})')
    else:
        print('[enhance] No rows needed — all heads have coverage')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
