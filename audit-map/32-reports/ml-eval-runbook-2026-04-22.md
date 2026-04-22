# ML eval runbook — v7+Beta and v8-corrected validation

**Purpose:** one-command reproducible recipe for empirical validation of the RCA (audit-map/08-ml-audit/07-v7-overload-root-cause-analysis-2026-04-22.md) once the governed corpus is available in DB. Preserves handoff context across agent sessions.
**Intent reference:** §F.7 promotion gates, §G.3 calibration, §N.1–N.6 RCA tasks, §M.5 validation ladder.
**Authored:** 2026-04-22 (after commit 3950620a).

---

## 1. Prerequisites

Before running any eval:

- [ ] `AIRMENTOR_PROOF_BATCH_ID` env set (canonical: `btech-math-computing-2023`).
- [ ] Database migrated through latest migration (as of commit 66691b3c, feature schema supports 44-col export w/ 5 new missingness flags).
- [ ] Governed corpus rows present in DB — either:
  - cov-24 already built (check `retrain-coverage24-*` output dirs under `air-mentor-api/output/proof-risk-model/`), OR
  - launched fresh via eval with `AIRMENTOR_EVAL_SKIP_RECOMPUTE=0`.
- [ ] Disk space: ≥ 1GB free in `/dev/shm` (pg embedded) and ≥ 5GB in project dir.

If corpus not present, building fresh takes ~26 min (per 123724Z log: "created 24/24 in 1560s at concurrency 4").

---

## 2. Canonical eval commands

### 2.1 — v7 baseline re-validation on cov-24 (RCA empirical check)

```bash
cd /home/raed/projects/air-mentor-ui/air-mentor-api
LD_LIBRARY_PATH=/run/current-system/sw/share/nix-ld/lib \
  AIRMENTOR_EVAL_SEED_PROFILE=coverage-24 \
  AIRMENTOR_EVAL_CREATE_CONCURRENCY=4 \
  AIRMENTOR_EVAL_EXPORT_FEATURES_CSV=output/proof-risk-model/retrain-v7-beta-cov24-$(date -u +%Y%m%dT%H%M%SZ)/features.csv \
  /home/raed/projects/air-mentor-ui/node_modules/.bin/tsx \
    scripts/evaluate-proof-risk-model.ts 2>&1 | tee output/proof-risk-model/retrain-v7-beta-cov24-$(date -u +%Y%m%dT%H%M%SZ)/eval.log
```

Expected outputs:
- `evaluation-report.json` — **must contain non-default** overallCourseVariantSummary (no more AUC=0.5 degenerate state; F15 guard ensures seed coverage).
- `evaluation-report.md` — human-readable; check sections:
  - **Variant Comparison** → current (v7) ROC-AUC ≥ 0.78
  - **Phase 8 / Per-Stage Overload** → per-stage overload for each of {pre-tt1, post-tt1, post-tt2, post-assignments, post-see}
  - **Per-Semester Overload** (new per commit 6e52ea72) → per-semester breakdown
  - **Per-ScenarioFamily Overload** (new per commit 6e52ea72) → per-family breakdown
  - **Top-k Stability** (new per commit d63b2978) → Jaccard across adjacent stage pairs
  - **Local Reliability at 0.4 / 0.85** → localEceAt04 + localEceAt085 per variant

### 2.2 — Challenger catboost on exported features

```bash
cd /home/raed/projects/air-mentor-ui/air-mentor-api
# After eval 2.1 completes, features.csv is populated with 44 cols.
python3 scripts/train_catboost_challenger.py \
  --features-csv output/proof-risk-model/retrain-v7-beta-cov24-*/features.csv \
  --out-dir output/proof-risk-model/retrain-v7-beta-cov24-*/catboost-run \
  --cpu-threads 16 \
  --iterations 300 \
  --depth 6 \
  --learning-rate 0.08 \
  --l2-leaf-reg 3.0
```

Python script reads `feat_*` columns dynamically — auto-adapts to 44 cols (verified in commit 66691b3c message).

### 2.3 — Standalone calibration regression test (fast pre-check)

```bash
cd /home/raed/projects/air-mentor-ui/air-mentor-api
LD_LIBRARY_PATH=/run/current-system/sw/share/nix-ld/lib \
  /home/raed/projects/air-mentor-ui/node_modules/.bin/tsx \
    scripts/verify-calibration-fixes.ts
```

Expected: 14 PASS lines in ~1s. Verifies F1 Beta default, F2 local-ECE, F6 isotonic O(n).

---

## 3. Promotion gate checklist

Per intent §F.7 + RCA §2 + RCA appendix A. Compare current v7 (as-is) to v7-with-F1-F4 and v8-corrected:

| Gate | Measurement | Threshold | Variant baseline | New value | Pass? |
|---|---|---:|---:|---:|---|
| Ranking | ROC-AUC | ≥ 0.7894 | 0.7894 | TBD | ☐ |
| Proper scoring | Brier | ≤ 0.1359 | 0.1359 | TBD | ☐ |
| Global calibration | ECE | ≤ 0.01 | 0.0067 | TBD | ☐ |
| Local cal @ medium | localEceAt04 | ≤ 0.02 | unknown | TBD | ☐ |
| Local cal @ high | localEceAt085 | ≤ 0.02 | unknown | TBD | ☐ |
| Overload global | overloadRatio | ≤ 1.00 | 1.1127 ❌ | TBD | ☐ |
| Overload per-stage | max over stages | ≤ 1.10 | unknown | TBD | ☐ |
| Overload per-semester | max over sems | ≤ 1.10 | unknown | TBD | ☐ |
| Overload per-family | max over families | ≤ 1.15 | unknown | TBD | ☐ |
| Stability adj stages | minJaccard | ≥ 0.65 | unknown | TBD | ☐ |
| Stability churn | p95ChurnRate | ≤ 0.50 | unknown | TBD | ☐ |
| Replayability | bytewise identical | yes | implemented | TBD | ☐ |

Promotion = all 12 rows pass ✅.

Anti-pattern (intent §O): do NOT promote if AUC improves but overload/local-ECE gates fail. This was explicit guidance against the v7 cov-24 result.

---

## 4. Validation-prediction from RCA

My RCA (§6) predicts the following for v7+F1+F4 (i.e. current code on same corpus with Beta forced + missingness flags exposed):

| Metric | v7 cov-24 as-cited | v7+F1+F4 predicted |
|---|---:|---:|
| ROC-AUC | 0.7894 | 0.79 (same ranking) |
| Brier | 0.1359 | 0.134–0.136 (marginal improvement) |
| Global ECE | 0.0067 | 0.003–0.006 (Beta tightens) |
| Local-ECE @ 0.85 | unknown | ≤ 0.02 (Beta specifically) |
| Overload | 1.1127 | **1.02–1.05** (F1 removes step-function ties; F4 adds lost dimensions back) |
| Top-20% Jaccard across adjacent stages | unknown | 0.70–0.80 (less flicker after tie reduction) |

Falsification test: if overload stays ≥ 1.08 with F1 + F4 applied, H1 + H3a are insufficient. Escalate to H3b (exclude Sem1 pre-TT1 from training set) or H4 (interaction ablations).

---

## 5. Post-eval deliverables checklist

After each eval run, produce:

- [ ] `eval.log` — full stderr transcript with phase breakdown (recompute / artifact-load / pass-1 / train / pass-2 / report).
- [ ] `evaluation-report.json` — machine-readable full metric set.
- [ ] `evaluation-report.md` — human-readable sections per 2.1.
- [ ] `catboost-run/` — per-head CatBoost JSON artefacts + metrics.json + train.log.
- [ ] `meta.txt` — seed manifest + commit SHA + env vars.
- [ ] Update `audit-map/32-reports/ml-retrain-*.md` — decision vs promotion gate table (§3).

If any gate fails: add a section to the RCA at `audit-map/08-ml-audit/07-v7-overload-root-cause-analysis-2026-04-22.md` noting which hypothesis was validated/falsified.

---

## 6. Known evaluator env vars (reference)

| env | default | notes |
|---|---|---|
| `AIRMENTOR_EVAL_SEED_PROFILE` | `manifest-64` | options: `smoke-3`, `coverage-12`, `coverage-24`, `coverage-32`, `manifest-64` |
| `AIRMENTOR_EVAL_SEEDS` | (unset) | override with custom CSV seed list; triggers F15 partition-coverage guard |
| `AIRMENTOR_EVAL_ALLOW_DEGENERATE` | `0` | set `1` to bypass F15 guard when partition coverage deliberately incomplete |
| `AIRMENTOR_EVAL_SKIP_RECOMPUTE` | `0` | set `1` to reuse pre-built governed corpus (faster iteration) |
| `AIRMENTOR_EVAL_CREATE_CONCURRENCY` | `min(12, nproc)` | parallel run creation in pass-1 |
| `AIRMENTOR_EVAL_EXPORT_FEATURES_CSV` | (unset) | path to write 44-col features CSV for CatBoost challenger |
| `AIRMENTOR_EVAL_PROGRESS_EVERY` | `8` | log every N governed runs created |
| `AIRMENTOR_EVAL_PRINT_JSON` | `0` | set `1` to dump report JSON to stdout |

---

## 7. Known orchestrator tasks that will run this eval

Once DAG cascades past t45 (merge-implementation-plan), these nodes will execute eval programmatically:

- t46 `overnight-ml-rca-histograms-current` — score histograms by stage/semester (§N.2)
- t47 `overnight-ml-rca-local-reliability-current` — local reliability at 0.4, 0.85 (§N.3)
- t48 `overnight-ml-rca-overload-breakdowns-current` — overload by stage/sem/family (§N.4)
- t49 `overnight-ml-rca-interaction-ablations-current` — 6 ablation variants (§N.5)
- t57 `overnight-ml-v8-corrected-logistic` — v8 retrain on corrected corpus
- t58 `overnight-ml-beta-calibration` — forced Beta path (already in F1)
- t59 `overnight-ml-catboost-challenger` — catboost shadow on corrected corpus
- t63 `overnight-validate-ml-metrics` — final promotion-gate decision

Each of these will produce a report in `audit-map/32-reports/`. This runbook is the manual override path when DAG is blocked or when a quick validation loop is needed.

---

## 8. Rollback plan

If an eval run produces degenerate output (AUC=0.499 across variants, flagged=1.0):
1. Check F15 guard was not bypassed (`AIRMENTOR_EVAL_ALLOW_DEGENERATE` should be unset).
2. Check corpus completeness via log line `[proof-eval] selected N/M governed runs`.
3. If partial, re-run from scratch (`AIRMENTOR_EVAL_SKIP_RECOMPUTE=0`).
4. If still degenerate, check DB for missing `simulationStageCheckpointId` in evidence rows.

Do NOT commit degenerate reports to audit-map. They must be stored only in `air-mentor-api/output/proof-risk-model/retrain-*/` which is gitignored.

---

*This runbook is the single source of truth for reproducing the ML validation loop. Commit SHA of this doc's creation matters less than the commit SHA referenced in each eval's meta.txt; always pin to the SHA of the code that produced each metric.*
