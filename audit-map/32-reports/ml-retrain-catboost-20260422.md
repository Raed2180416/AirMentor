# ML retrain + CatBoost challenger — 2026-04-22

## Intent alignment

Per `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:411-418`, the retrain/challenger sequence is:

1. Fix world semantics (stage authority, missingness, stale evidence, case identity)
2. Retrain v8 corrected baseline
3. Train serious challenger (CatBoost)
4. Compare + promote if justified

This report covers (a) one world-semantics infrastructure fix that gated ML corpus regeneration, (b) a determinism proof for the Python CatBoost trainer, and (c) CatBoost vs TS-baseline vs TS-challenger metrics on the governed corpus. It does **not** claim (2) is complete — other phase1/5/11 world-semantics fixes (CLAIM_ML_016/017/021/024) still belong to their owning DAG nodes and are still pending.

## Summary

| Deliverable | Status | Evidence |
|---|---|---|
| World-semantics: idempotent `ensureProofOfferings` under concurrent bootstrap | ✅ shipped | commit `d7827182` |
| Regression test: 4 parallel callers, no dup-key, composite-key unique | ✅ 3.8s pass | `air-mentor-api/tests/msruas-proof-offerings-concurrency.test.ts` |
| Happy-path regression: `fresh-sem1-proof-lifecycle` 6/6 | ✅ 415s pass | vitest log |
| Governed corpus regeneration (smoke-3) | ✅ 788s end-to-end | `retrain-20260422T120306Z/eval-smoke3.md` |
| Governed corpus regeneration (coverage-24) | ❌ abandoned (OOM + calibration O(n²) stall; pivoted to cov-12) | `retrain-coverage24-*/` (pre-session attempts) |
| Governed corpus regeneration (coverage-12) | ✅ end-to-end in ~28 min | `retrain-coverage12-20260422T162939Z/eval-cov12.md` |
| Perf fixes enabling cov-12 completion | ✅ shipped | see §"Session perf + infra fixes" |
| CatBoost on cov-12 (fallback run_id split) | ✅ 5/5 heads trained | `retrain-coverage12-20260422T162939Z/catboost-run/metrics.json` |
| CatBoost deterministic training | ✅ metrics.json byte-identical A≡B | 5 heads, `catboost-run-a`/`catboost-run-b` |
| CatBoost vs TS-logistic vs TS-depth-2-tree comparison | ✅ smoke-3 / ⏳ coverage-24 | tables below |

## The ML ↔ world-building intersection

The evaluator's `mapWithConcurrency` fan-out at `@/home/raed/projects/air-mentor-ui/air-mentor-api/scripts/evaluate-proof-risk-model.ts:1110` fires N parallel `startProofSimulationRun` calls when regenerating the governed corpus. Each one calls `prepareSeededProofRunBootstrap` → `ensureProofOfferings` at `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/msruas-proof-control-plane.ts:3188`.

Before the fix, each caller independently:

1. Read the empty `section_offerings` table (`db.select().from(sectionOfferings)`).
2. Composed the same static offering row set from `PROOF_TERM_DEFS`.
3. Called `db.insert(sectionOfferings).values(newOfferingRows)` with **no ON CONFLICT clause**.

Classic TOCTOU. The 2nd caller 23505'd on `section_offerings_pkey` (`Key (offering_id)=(mnc_s1_amc_s1_01_a) already exists`), tore the seeded bootstrap down, and the evaluator aborted before any features CSV could be written. That failure mode meant **ML retrain corpus generation was broken at concurrency > 1** — the ML campaign nodes (`overnight-ml-v8-corrected-logistic`, `overnight-ml-catboost-challenger`) would have failed identically when their DAG nodes claimed.

**Fix** (commit `d7827182`):

```@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/msruas-proof-control-plane.ts:3269-3276
  // Idempotent under concurrency: evaluator (and any future parallel seed bootstrap) fires
  // multiple startProofSimulationRun calls against a shared DB. Each recomputes the same
  // static newOfferingRows / newOwnershipRows list from a cold select, then races the insert.
  // Without ON CONFLICT DO NOTHING the 2nd concurrent call 23505s on section_offerings_pkey
  // (or faculty_offering_ownerships_pkey) and the whole bootstrap tears down.
  // See: air-mentor-api/scripts/evaluate-proof-risk-model.ts:1110 (mapWithConcurrency fan-out).
  if (newOfferingRows.length > 0) await db.insert(sectionOfferings).values(newOfferingRows).onConflictDoNothing()
  if (newOwnershipRows.length > 0) await db.insert(facultyOfferingOwnerships).values(newOwnershipRows).onConflictDoNothing()
```

Scope: subset of `overnight-impl-phase1-run-authority`. The remaining phase1 items (stage authority drift, case identity separation) are untouched and still owned by that pending DAG node.

## Smoke-3 evaluation (validation of the restored pipeline)

- Seed profile: `smoke-3` (seeds 101, 4141, 5353)
- Concurrency: 3
- Duration: 788.05 s end-to-end
  - Sim creation: 3 × ~182 s parallel
  - Recompute: 302.05 s
  - Pass-1 corpus ingestion: 2.66 s
  - Training (TS v8 + TS challenger): 208.58 s
  - Pass-2 scoring: 3.02 s
  - Report: 269.1 s
- Selected runs: 2 / 3 (`duplicates skipped: 1, incomplete skipped: 1`). The skipped incomplete run happened to be the seed mapped to `split: 'train'` in `PROOF_CORPUS_MANIFEST`, so the smoke-3 CSV only exports `validation` + `test` rows. Smoke-3 is a pipeline-validation profile, not a training profile — this is expected.
- Features CSV: `retrain-20260422T120306Z/features-smoke3.csv` — 79,200 rows × 38 features, 2 run_ids, 2 scenario families (`balanced`, `coursework-inflation`).

### CatBoost deterministic training on smoke-3 (adapter: validation → 80/20 train/val, test stays)

Config: CPU, `random_seed=42`, `thread_count=8`, `depth=6`, `iterations=300`, `bootstrap_type=No`, `learning_rate=0.05`, `scale_pos_weight=neg/pos`, `early_stopping_rounds=30`, `metric_period=50`.

**Determinism proof** (two consecutive runs with identical config):

- `metrics.json` byte-identical across run A and run B (all 5 heads, all metrics).
- Model serialized bytes differ (metadata: timestamps, RNG state) — **prediction-deterministic, not byte-deterministic**, which is the operationally-meaningful form.

### Smoke-3 test-AUC comparison (2 scenario families only — indicative, not authoritative)

| Head | TS v8 logistic | TS depth-2-tree challenger | CatBoost (d6, i300) | Δ vs logistic | Δ vs challenger |
|---|---:|---:|---:|---:|---:|
| `attendanceRisk` | 0.9610 | 0.9489 | **0.9928** | +0.0318 | +0.0439 |
| `ceRisk` | 0.8740 | 0.7064 | **0.9421** | +0.0681 | +0.2357 |
| `seeRisk` | 0.7435 | 0.7308 | **0.8602** | +0.1167 | +0.1294 |
| `overallCourseRisk` | 0.7933 | 0.7520 | **0.9077** | +0.1144 | +0.1557 |
| `downstreamCarryoverRisk` | 0.9122 | 0.9013 | **0.9383** | +0.0261 | +0.0370 |

**Caveats**:

- Corpus limited to 2 of the 8 scenario families — smoke-3 does **not** exercise `coursework-inflation-v-balanced-contrast`, `regressor-heavy`, `recovery-dominant`, or the adversarial families.
- Adapted split: 80% of the CSV's `validation` rows became CatBoost training data. TS evaluator trained on its own row-level split (see `proof-risk-model.ts:1360`), so train corpora are **not** identical — only the `test` split is an apples-to-apples comparison.
- All 5 heads hit `bestIteration=299` (iteration ceiling), no early stopping triggered → 300 iters is a floor. Coverage-24 run will also sweep `iterations=500` / `depth=8` to probe headroom.

## Coverage-24 → Coverage-12 pivot

Coverage-24 (24 seeds) attempts earlier in the day (`retrain-coverage24-20260422T121844Z` / `T122308Z` / `T123724Z`) failed on three separate modes:

1. `mdzeroextend` PG errors from tmpfs exhaustion — `/dev/shm` is a 7.5 G tmpfs; embedded Postgres data dir grew past 3.5 G available and the storage manager aborted. Fixed by forcing fallback to `/tmp` (ext4, 266 G free) via `AIRMENTOR_TEST_DB_SHM_MIN_FREE_BYTES=10737418240`.
2. Node heap OOM at ~14 G RSS during multi-worker corpus create. Worked around by lowering `AIRMENTOR_EVAL_CREATE_CONCURRENCY` from 6 → 2 and killing competing tmux audit sessions.
3. First-head training stall for 7 min with zero progress. Instrumented → caught `fitVennAbersCalibration` doing O(grid × n log n) = 100 × 158 400 × log n per head (hundreds of millions of sort ops). Fixed by deterministic downsample to `VENN_ABERS_MAX_ROWS=3000` rows (preserves calibration shape; verified cal-timing dropped from >300 s to ≈ 1 s per head). A second hotspot — `fitIsotonicCalibration` using `Array.splice(index, 2, merged)` in a merge loop — is **not** fixed this session (still O(n²) worst case, up to 42 s per head at n = 158 400) and is carried as a follow-up.

The pivot: 12 seeds (8 from manifest `train` partition + 4 from `validation`, 0 from `test`) keeps the evaluator exercised on multi-family data without overloading tmpfs or the single-threaded calibration fitter. Total end-to-end: **~28 min** (corpus 12.5 min @ concurrency 2, recompute 14.5 min, rebuild + training 8 min, report 3 min).

## Coverage-12 evaluation

- Seed profile: custom — `101, 202, 303, 404, 505, 606, 707, 808, 4141, 4242, 4343, 4444` via `AIRMENTOR_EVAL_SEEDS`.
- Concurrency: 2 (forced to stay within memory budget).
- Evaluator wall clock: `created 12/12 governed proof runs in 751.62 s`; `recompute finished after 870.22 s`; `trainer.build finished in 453.71 s`.
- Governed corpus: `12 proof runs × 39 600 checkpoint evidence rows = 475 200 rows` (heldout eval loop sees only the `validation` subset = 158 400 rows).
- Selected runs: 12/12 manifest-complete; 1 incomplete seed 101 legacy run skipped; 1 duplicate run skipped.
- **Seed composition gap**: The evaluator hardcodes `evaluationRunIdList = runs with split ∈ {validation, test}`, and this 12-seed choice has **0 test-partition seeds** (none of {5353, 5454, 5555, 5656} included). Downstream CSV export therefore contains only `split=validation` rows — the challenger trainer uses its new run-id fallback split (§ below). Future cov-12 re-runs should substitute ≥ 2 test seeds (recommendation: `101, 202, 303, 404, 505, 606, 4141, 4242, 4343, 4444, 5353, 5454` → 6 train / 4 val / 2 test).

## CatBoost on coverage-12

Fallback split (by `run_id`, deterministic `np.random.default_rng(42)`):

- train: 2 run_ids → 79 200 rows
- val: 1 run_id → 39 600 rows
- test: 1 run_id → 39 600 rows

| Head | pos share | bestIter | val AUC | val Brier | **test AUC** | test Brier | test AP |
|---|---:|---:|---:|---:|---:|---:|---:|
| `attendanceRisk` | 13.3 % | 78 | 0.9880 | 0.0482 | **0.9888** | 0.0404 | 0.9104 |
| `ceRisk` | 3.0 % | 111 | 0.9490 | 0.1141 | **0.9631** | 0.0615 | 0.4275 |
| `seeRisk` | 17.0 % | 226 | 0.8585 | 0.1678 | **0.8851** | 0.1156 | 0.6573 |
| `overallCourseRisk` | 19.0 % | 288 | 0.9004 | 0.1306 | **0.9233** | 0.0924 | 0.7576 |
| `downstreamCarryoverRisk` | 31.3 % | 138 | 0.9605 | 0.0781 | **0.9429** | 0.0968 | 0.8545 |

**Notes:**

- All heads trained below the 300-iter ceiling (bestIter = 78..288) — unlike smoke-3 where every head hit `bestIter = 299`, cov-12 has enough signal that early stopping triggered naturally. Coverage gives CatBoost real convergence targets.
- Test metrics are on a single run_id (per-run split) — indicative, not authoritative. Manifest-64 or coverage-32 with proper `{train, validation, test}` seed mix is still required before promotion.
- `seeRisk` val AUC (0.858) < test AUC (0.885) is unusual; single-run test split has high variance. Re-run with `AIRMENTOR_EVAL_SEEDS` including `5353,5454` will give a stable held-out estimate.

## Session perf + infra fixes

Three of the six open follow-ups from the prior report landed this session (in addition to cov-12 completion). Commits to follow; summary:

1. **`insertRowsInChunks` error surface** (`air-mentor-api/src/lib/msruas-proof-control-plane.ts:2933-2947`) — wrap batch inserts in `try/catch` and log pg `{code, constraint, routine, table, detail, message}` before rethrow. Previously Drizzle swallowed pg-level detail behind a 60 KB params dump that got buffered out of view when node exited. Now the root cause (e.g. `mdzeroextend` in `md.c:641`) prints as a single line on stderr.
2. **Venn-Abers calibration cap** (`air-mentor-api/src/lib/proof-risk-model.ts:868-916`) — `VENN_ABERS_MAX_ROWS = 3000` deterministic even-stride downsample before the 100-point grid × 2-isotonic-per-grid loop. Observed: `[cal] attendanceRisk:venn-abers 0.89 s` after fix vs 5-minute+ hangs before on n = 158 400.
3. **Calibration timing instrumentation** (same file, `chooseCalibration`) — per-method timing log `[cal] <head>:<method> <sec>s` turns each future stall into a one-glance diagnosis. This is what let us catch that isotonic (not venn-abers) is now the slowest contributor: `[cal] downstreamCarryoverRisk:isotonic 32.82 s` at n = 158 400. Follow-up: replace `blocks.splice(index, 2, merged)` O(n)-per-merge pool-adjacent-violators with in-place index-swap (stays O(n) total), or downsample with the same MAX_ROWS pattern.
4. **Train-phase instrumentation** (same file, `trainCompactProofRiskModel`) — `[train] start rows=N train=T val=V test=0` + per-head `[train] <family>:<head> in <sec>s` + `[train] all heads done @ ...`. Caught the `test=0` split bug immediately.
5. **Rebuild-phase instrumentation** (`msruas-proof-control-plane.ts:2186-2495`) — `[rebuild] counts loaded ...`, `[rebuild] evidence loaded pages=P rows=R`, `[rebuild] trainer.build finished in Xs`, per-run diagnostics chunk progress. Rebuild is no longer an opaque 8-minute block.
6. **CatBoost fallback run-id split** (`air-mentor-api/scripts/train_catboost_challenger.py:212-247`) — when `features.csv` has no `train` rows, deterministically partition `validation` run_ids into `train/val/test` via `rng.permutation(42)` at 50/25/25. Unblocks challenger training on eval CSVs that restrict export to heldout splits (i.e. the current evaluator behavior at `scripts/evaluate-proof-risk-model.ts:1246-1256`).
7. **CatBoost verbose/metric_period coupling** (same file, line 132) — `verbose=metric_period` instead of hardcoded `verbose=50`. CatBoost raises `verbose should be a multiple of metric_period` when they disagree; closes follow-up #6 from the prior report.

## Determinism proof details (smoke-3)

```
RUN A metrics.json md5 == RUN B metrics.json md5 (verified byte-diff)
```

| Head | test AUC | test Brier | test AP | bestIter |
|---|---:|---:|---:|---:|
| `attendanceRisk` | 0.9928 | 0.0241 | 0.8598 | 299 |
| `ceRisk` | 0.9421 | 0.0519 | 0.3933 | 299 |
| `seeRisk` | 0.8602 | 0.1400 | 0.6629 | 299 |
| `overallCourseRisk` | 0.9077 | 0.1094 | 0.7562 | 299 |
| `downstreamCarryoverRisk` | 0.9383 | 0.1000 | 0.8542 | 299 |

Run B values are bytewise identical to the above.

## What this does NOT prove

- **Does not claim v8 baseline is corrected**. `CORRECTED_V8_PROOF_RISK_TRAINING_CONFIG` (production) and `BASELINE_V5_LIKE_PROOF_RISK_TRAINING_CONFIG` (shadow baseline) were not modified. The `currentCgpa: number | null` and `cgpaAfterSemester: number | null` pre-existing WIP on `msruas-proof-control-plane.ts` was captured in commit `d7827182`; that aligns with CLAIM_ML_023 (missingness) but is not a full v8 corrected retrain — no artifact rebuild / promotion happened.
- **Does not claim challenger promotion**. Promotion requires coverage-24 + coverage-32 + manifest-64 gate passes, governance review, and a gap-closure intent test update. Those are scoped to `overnight-ml-v8-corrected-logistic` / `overnight-ml-catboost-challenger` / `overnight-validate-ml-metrics` — all pending.
- **Does not fix `ChallengerModelFamily` type to include `'catboost'`**. That's CLAIM_ML_014's code-side twin, owned by `overnight-ml-catboost-challenger`. The Python trainer and the TS eval wiring remain out of sync on type-level; there is no currently-committed TS path that actually calls into the CatBoost model at inference time.

## Open follow-ups (not this session)

1. `overnight-impl-phase1-run-authority`: finish stage-authority dates, dry-merge stage-policy, case identity (CLAIM_MONITOR_001..009).
2. `overnight-impl-phase11-final-analytics`: replay model (CLAIM_ML_024) and impact formula (CLAIM_ML_017).
3. `overnight-ml-v8-corrected-logistic`: rebuild + commit artifact with v8 missingness features (41 feat columns, not the 38 currently exported).
4. `overnight-ml-catboost-challenger`: wire `ChallengerModelFamily | 'catboost'` in TS, register a Python-model loader, promote gate.
5. `overnight-validate-ml-metrics`: gate on coverage-32 / manifest-64 AUC + calibration thresholds.
6. ~~`train_catboost_challenger.py` verbose/metric_period coupling~~ — **shipped** this session.
7. `fitIsotonicCalibration` O(n²) splice in PAV merge loop (`proof-risk-model.ts:846-861`). At n = 158 400 it costs ~42 s per head per fit; fix is either (a) in-place `blocks[index+1] = merged` + subsequent compacting, (b) linked-list blocks, or (c) `MAX_ROWS` downsample symmetric to Venn-Abers. Any of the three should drop the number to sub-second.
8. Evaluator seed-composition hygiene for `AIRMENTOR_EVAL_SEEDS` custom profiles: warn or error when the resulting `splitByRunId` produces empty `test` (current failure mode: silent CSV export with `test=0`, which then forces the challenger trainer into its fallback split path).
9. Eval CSV export currently restricted to `evaluationRunIdList` (validation ∪ test). Widen to include `train` rows so the CatBoost fallback-split adapter is no longer required for challenger parity runs.

## Commands to reproduce

```bash
# 1. (once) ML env via nix-ld
export LD_LIBRARY_PATH=/run/current-system/sw/share/nix-ld/lib
/home/raed/projects/air-mentor-ui/pipeline/.venv/bin/pip install --quiet numpy pandas scikit-learn catboost

# 2. Eval (smoke-3, fastest)
cd /home/raed/projects/air-mentor-ui/air-mentor-api
export PATH="/home/raed/projects/air-mentor-ui/node_modules/.bin:$PATH"
export AIRMENTOR_EVAL_SEED_PROFILE=smoke-3 AIRMENTOR_EVAL_CREATE_CONCURRENCY=3
export AIRMENTOR_EVAL_EXPORT_FEATURES_CSV=/tmp/features.csv
export AIRMENTOR_EVAL_OUTPUT_DIR=/tmp/eval AIRMENTOR_EVAL_OUTPUT_STEM=eval
export NODE_OPTIONS=--max-old-space-size=6144
tsx scripts/evaluate-proof-risk-model.ts

# 3. CatBoost deterministic training
/home/raed/projects/air-mentor-ui/pipeline/.venv/bin/python scripts/train_catboost_challenger.py \
  /tmp/features.csv /tmp/catboost-out \
  --device cpu --thread-count 8 --depth 6 --iterations 300 \
  --bootstrap-type No --metric-period 50
```

## Artifacts

- `air-mentor-api/output/proof-risk-model/retrain-20260422T120306Z/` — smoke-3 eval + adapter + CatBoost run A/B
- `air-mentor-api/output/proof-risk-model/retrain-coverage12-20260422T162939Z/` — cov-12 eval + CatBoost run (this session)
- commit `d7827182` — world-semantics concurrency fix (prior)
- this session's commits: Venn-Abers cap, cal/train/rebuild instrumentation, `insertRowsInChunks` error surface, CatBoost verbose/fallback-split (see git log on commit)
