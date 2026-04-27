# Pre-B1 baseline freeze — `20260427T011901Z-manifest64`

Status: **frozen synthetic proof/demo baseline (pre-B1)**
Authority: synthetic manifest evaluator only — **not** real-world predictive validation.

## 1. Identity

| Field | Value |
|---|---|
| Run ID | `20260427T011901Z-manifest64` |
| Git SHA (short) | `a6dd67e8` |
| Git SHA (full) | `a6dd67e8a8baaf8fe680bce88494e51edec15836` |
| Branch | `gitignore-hygiene-ctxo-cache` (post-blocker-fix HEAD; pushed to `origin/gitignore-hygiene-ctxo-cache`). Two parallel branch labels `proof-truth-fixes-2026-04-25` and `proof-truth-fixes-blockers-2026-04-26` both still point at the prior SHA `a587a78e` and do **not** contain the four blocker fixes that produced this run. |
| Evaluator output (local) | `/tmp/manifest64-done/` (rsync from Lightning Studio `/teamspace/studios/this_studio/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/20260427T011901Z-manifest64/`) |
| Evaluator output (origin) | Lightning.ai Studio `airmentor-proof-validation` |
| Generated at | `2026-04-27T02:55:02.150Z` |

## 2. Blocker fixes that enabled this run

Five commits on `gitignore-hygiene-ctxo-cache` are the actual delta from `proof-truth-fixes-2026-04-25` (`a587a78e`) to this baseline (`a6dd67e8`):

1. `b39ba67a` chore(gitignore): ignore ctxo local cache
2. `2aef0beb` fix(lint): resolve all ESLint errors across frontend and test files
3. `3d5873d2` fix(timetable): graceful slot overflow instead of crashing eval run
4. `d9d1cde0` feat(eval): persistent DB mode so killed runs can resume without full re-run
5. `a6dd67e8` fix(eval): skip dataset dump gracefully when corpus too large for `JSON.stringify`

The third and fifth commits are the ones that unblocked the manifest64 run end-to-end (timetable builder no longer aborts; dataset dump no longer crashes the entire run on the 1.38M-row corpus).

## 3. Corpus

| Field | Value |
|---|---|
| Total rows | `1,382,400` |
| Test rows (held-out) | `259,200` |
| Manifest seeds requested | `65` |
| Manifest seeds accepted | `64` |
| Stale duplicate skipped | seed `101` zero-checkpoint older run discarded; the complete run for seed `101` was kept |
| Checkpoints per accepted seed | `30 / 30` |
| `stageEvidenceCount` per accepted seed | `21,600` |
| CO evidence fallback rows | `0` across `1,382,400` |
| `coEvidence.theoryCoursesDefaultToBlueprintEvidence` | `true` |
| `coEvidence.fallbackOnlyInExplicitCases` | `true` |
| Mode breakdown | `synthetic-blueprint` `960,000` + `rubric-derived` `422,400` |
| Course-family breakdown | `theory-heavy` `806,400`, `lab-like` `422,400`, `nontechnical_continuous` `153,600` |
| `currentVariantName` | `current-v8` |
| `seedProfile` | `manifest-64` |

## 4. Required artifacts present locally

| Artifact | Status | Size |
|---|---|---|
| `evaluation-report.json` | present | `1.2M` |
| `evaluation-report.md` | present | `26K` |
| `meta.txt` | present | `8.9K` |
| `metric-sidecars/` | present (8 sidecar JSONs) | dir |
| `dataset_dump.jsonl` | **absent** by design — `a6dd67e8` skips dump gracefully when in-memory `JSON.stringify` would overflow at this corpus size | n/a |
| `evaluate-proof-risk-model.log` | not synced from Lightning Studio | n/a |

The two absent artifacts do not invalidate the run. The dump skip is a deliberate engineering response to a corpus size that exceeds Node's max string length (`Invalid string length`). The log lives on the Lightning Studio side.

## 5. Failure-signal scan

Searched `evaluation-report.json` and `evaluation-report.md` for: `Invalid string length`, `RangeError`, `timetable builder exhausted`, `mnc_t2`, `zero-train`, `zero train`, `Error:`. **None present.** No log file available locally to scan; this is recorded as a known artifact gap, not a hidden failure signal.

## 6. Operational verdict

> Current-v8 is frozen as the pre-B1 synthetic manifest64 baseline and remains the active proof/demo model. This does not establish real-world predictive validity.

The three forbidden phrasings are explicitly rejected:

- "production-ready" — not used.
- "ready for real deployment" — not used.
- "synthetic AUC proves real-world performance" — not used.

## 7. Per-head metric summary (`current-v8`, `support = 259,200`)

### attendanceRisk

| Metric | Value |
|---|---:|
| ROC-AUC | `0.9271` |
| PR-AUC | `0.6569` |
| ECE (global) | `0.0937` |
| Precision@20% | `0.3708` |
| Recall@20% | `0.8192` |
| Local ECE @ 0.4 | `0.2012` |
| Mean predicted @ 0.4 | `0.3953` |
| Mean actual @ 0.4 | `0.5965` |

### ceRisk

| Metric | Value |
|---|---:|
| ROC-AUC | `0.8716` |
| PR-AUC | `0.2419` |
| ECE | `0.0884` |
| Positive rate | `3.47%` |
| Medium threshold | flagged `1.95%`, precision `35.52%`, recall `19.96%` |

### seeRisk

| Metric | Value |
|---|---:|
| ROC-AUC | `0.7473` |
| PR-AUC | `0.3952` |
| ECE | `0.046` |

### overallCourseRisk

| Metric | Value |
|---|---:|
| ROC-AUC | `0.7892` |
| PR-AUC | `0.482` |
| ECE | `0.0475` |
| Precision@20% | `0.4803` |
| Overload ratio | `1.0006` |
| Local ECE @ 0.4 (global) | `0.0061` |
| Local ECE @ 0.4 by semester | sem-1 `0.345`, sem-2 `0.139`, sem-3 `0.0052`, sem-4 `0.0122`, sem-5 `0.0026`, sem-6 `0.0164` |

### downstreamCarryoverRisk

| Metric | Value |
|---|---:|
| ROC-AUC | `0.9301` |
| PR-AUC | `0.8255` |
| ECE | `0.14` |
| Precision@20% | `0.7946` |
| `displayProbabilityAllowed` | `false` |

## 8. Variant comparison (overallCourseRisk surface)

| Variant | AUC | ECE | Precision@20% | Overload Ratio |
|---|---:|---:|---:|---:|
| `current-v8` | `0.7892` | `0.0475` | `0.4803` | `1.0006` |
| `baseline-v5-like` | `0.7843` | `0.0028` | `0.4731` | `1.0475` |
| `hybrid-router` | `0.7892` | `0.0475` | `0.4803` | `1.0006` (collapsed to current) |
| `challenger` | `0.7583` | `0.0025` | `0.3590` | `2.3084` |
| `heuristic` | `0.7494` | `0.2812` | `0.4419` | `1.0859` |

`hybrid-router` fully collapsed to `current-v8`: fallback `alpha = 1` for all five heads.
`challenger` is **not usable** — overload ratio `2.3084` makes the queue uncontrollable.

## 9. Acceptance gates (from `acceptanceGateSummary`)

| Family | Gate | Status |
|---|---|---|
| coEvidence | `theoryCoursesDefaultToBlueprintEvidence` | `true` |
| coEvidence | `fallbackOnlyInExplicitCases` | `true` |
| policy | `structuredStudyPlanWithinLimit` | `true` |
| policy | `targetedTutoringBeatsStructuredStudyPlanAcademicSlice` | `true` |
| policy | `noRecommendedActionUnderperformsNoAction` | `true` |
| queueBurden | `actionableRatesWithinLimit` | `true` |
| queueBurden | `sectionToleranceWithinLimit` | `true` |
| queueBurden | `actionableQueuePpvProxyWithinLimit` | `true` |
| queueBurden | `watchRatesWithinLimit` | **`false`** — pending audit (`watchrates-definition-audit.md`) |

## 10. Required caveats

1. This is synthetic manifest evaluation, not real-world validation.
2. B1 mark realism is not implemented yet, so mark distributions may change once `realizeAssessmentMark` / `stableAnchoredBeta` is wired into `simulateSemesterCourse`.
3. Sem-1 and sem-2 `overallCourseRisk` calibration at the `0.4` threshold is poor (local ECE `0.345` and `0.139` respectively).
4. `attendanceRisk` underpredicts actual risk near the `0.4` boundary (mean predicted `0.3953` vs mean actual `0.5965`).
5. `downstreamCarryoverRisk` is ranking-useful but probability display remains disabled (`displayProbabilityAllowed: false`, ECE `0.14`).
6. `watchRatesWithinLimit` failed and is **not** waived in this freeze. See `watchrates-definition-audit.md` for the metric-definition audit and current AMBER classification.
7. `hybrid-router` collapsed to `current-v8` and currently adds no value; revisit before retaining as a first-class variant.

## 11. Pointers

- `interpretation-addendum.md` — corrections to language used in the prior memo `docs/proof-risk-manifest64-lightning-analysis-2026-04-27.md`.
- `watchrates-definition-audit.md` — exact numerator/denominator/threshold definitions for the failed gate, with status classification.
- `/tmp/manifest64-done/evaluation-report.md` — the evaluator's own markdown narrative (not committed; large generated artifact).

## 12. Explicit synthetic-only warning

This baseline is built entirely from a deterministic seeded simulator. No real student outcomes, no real grade distributions, no real attendance, and no real intervention responses were used. Every metric, every gate, and every variant comparison in this baseline reflects the **internal consistency of the simulator and the model trained on its output**, not real predictive performance on MSRUAS BTech Mathematics and Computing 2023 batch.
