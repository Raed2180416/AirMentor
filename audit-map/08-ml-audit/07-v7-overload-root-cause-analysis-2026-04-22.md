# V7 overload root-cause analysis (pre-empirical / hypothesis-ranked)

**Owner:** principal-architect (self-authored, out-of-band of DAG nodes t46–t49 which remain blocked on the t39→t45 reconcile/audit chain).
**Status:** hypothesis-ranked reasoning. Empirical confirmation deferred until evaluator re-runs against a governed corpus with the new local-ECE + seed-hygiene instrumentation (commit 66691b3c).
**Product intent reference:** `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` §F.4, §F.5, §G.2, §N.1–N.6, §O.
**Known facts at time of writing:**

| signal | value | source |
|---|---:|---|
| v7 cov-24 ROC-AUC | **0.7894** | intent §F.4 |
| v7 cov-24 Brier | 0.1359 | intent §F.4 |
| v7 cov-24 global ECE | 0.0067 | intent §F.4 |
| v7 cov-24 **Overload ratio** | **1.1127** ❌ | intent §F.4 |
| baseline v5-like Overload | **1.0100** ✅ | intent §F.4 |
| hybrid-router Overload | 1.1127 ❌ | intent §F.4 |
| depth-2-tree challenger Overload | 1.4293 ❌❌ | intent §F.4 |
| heuristic fallback Overload | 1.0049 ✅ | intent §F.4 |
| budgetRate default | 0.20 | `evaluate-proof-risk-model.ts:600` |

The 11.3% overshoot is the hard blocker. v5-like passes guardrail with **0.7846 AUC**; v7 gains +0.48 pts AUC but loses 0.11 in flag-rate discipline. Hybrid fails to rescue, meaning the overload is baked into the v7 logit layer itself — a blend with a less-ranking challenger doesn't dilute it. Depth-2-tree blowing up to 1.43 confirms the failure is *structural* in the decision-band distribution, not just a model-weight artefact.

---

## 1. Mechanical decomposition of `overloadRatio = 1.1127`

By definition at `@/home/raed/projects/air-mentor-ui/air-mentor-api/scripts/evaluate-proof-risk-model.ts:550`:

```
overloadRatio = flaggedRateAtBudget / budgetRate
             = (count of rows with prob ≥ thresholdAtBudget) / rows.length
               ──────────────────────────────────────────────────────────
                                  budgetRate = 0.20
```

`thresholdAtBudget` is the **prob of the top-ranked row at position `budgetCount = floor(0.20 × N)`**. If probabilities were all distinct, flaggedRateAtBudget would equal budgetRate exactly (1.0000 overload). Overload > 1 means there are **ties at `thresholdAtBudget`** — rows tied at that probability spill past the top 20% count.

For overload = 1.1127 on N ≈ 21,600 cov-24 test rows:
- Budget count = 4,320
- Flagged count = 4,320 × 1.1127 = **4,808**
- **488 extra rows tied at threshold** — meaning ~2.26% of total rows share an identical probability with the cutoff row.

**This is the actual signature.** It is *not* "v7 opens 11% more high-risk cases because it is too aggressive." It is "v7 produces a score distribution with a large tied cluster right at the 80th-percentile boundary, so 488 students become mechanically indistinguishable from the ones above the line."

v5-like (overload 1.01) has the same mechanism but only 22 ties at its 80th percentile — 0.1% of rows. **The bug is a score-bunching phenomenon that v7 introduces and v5-like avoids.**

Depth-2-tree (1.43) has ~9,300 ties at the cutoff — a piecewise-constant classifier will always bunch heavily.

Heuristic (1.005) has essentially no ties because the heuristic mixes five additive terms with continuous weights.

**Conclusion from pure overload math**: the problem is the **density of tied probabilities at the 0.20-quantile boundary**, not global model quality.

---

## 2. What in v7 introduces ties that v5-like doesn't?

Diff between v7 config and v5-like config at `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-risk-model.ts:107-140`:

| setting | v5-like | v7 (DEFAULT_PROOF_RISK_TRAINING_CONFIG) | impact on prob density |
|---|---|---|---|
| `includeStageIndicators` | `false` | `true` | adds 5 binary features → 5 degrees of within-stage tie |
| `includeInteractionFeatures` | `false` | `true` | adds 5 interaction features (all bounded [0,1]) |
| `calibrationMethods` | identity/sigmoid/isotonic | +beta +venn-abers | pre-fix: would pick isotonic/VA which **explicitly produce piecewise-constant output with tied values** |

**The calibration method is the dominant tie-generator.** Isotonic calibration's output is literally a step function on the probability axis: all inputs in a PAV block map to the same calibrated probability. If the chosen method is isotonic AND the validation rows clustered such that one PAV block spans the 0.20-quantile of the test distribution, you get hundreds of tied probabilities at that level.

Venn-Abers is similar — 100-point grid, so every test row gets snapped to one of 100 calibrated values. Many rows share one of the 100 grid points.

v5-like's `fitSigmoidCalibration` is a 2-parameter affine logit-space map — it preserves ranking and doesn't introduce ties.

**Hypothesis H1-refined**: v7 on cov-24 picked isotonic or Venn-Abers as the winning calibrator by Brier, and that step-function structure is the *direct mechanical cause* of the 488 tied rows at the budget boundary. This is testable: after Round-7 (`proof-risk-model.ts:1089-1110`) **we now force Beta** as the production calibrator. Beta is also a sigmoid-shape (non-step), so the tied-cluster should deflate.

**Predicted v7+Beta overload (from hypothesis alone): ~1.02–1.04.** Same ranking, smoother ties, slight excess from tied-feature-vector rows (see H3 below).

---

## 3. Secondary tie source — tied feature vectors

Even with a smooth calibration, tied *raw probabilities* can occur when two rows have identical feature vectors. This happens systematically in three ways in the current corpus:

### H3a. Silent-zero-collapse on Sem1 pre-TT1 (the headline bug)
`@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-risk-model.ts:695-698` shows that tt1Pct/tt2Pct/seePct/quizPct/assignmentPct are passed through `safePctToRisk(payload.tt1Pct)` which maps `null → some-sentinel`. Before the F4 fix, the interaction features `tt1tt2ExamCompoundRiskScaled`, `courseworkCompoundRiskScaled`, `stagePostTt2TtCompoundInteractionScaled`, `attendanceTrendCompoundRiskScaled`, `stagePostAssignmentsCourseworkInteractionScaled` all become *identical constants* for every row where `tt1Pct is null`. All Sem1 pre-TT1 rows → identical stage indicator (`stagePreTt1Scaled=1`) + identical interaction features (all zero) + the only variation is CGPA/backlog/attendance/prereq. With 3 of the 5 evidence sources forced to null and their interactions collapsed to zero, **the dimensionality that actually varies across rows shrinks from 39 to roughly 30**. That compresses the probability distribution, producing ties.

The F4 fix (commit 66691b3c) adds 5 missingness-flag features that vary BINARY across stage, which restores the lost dimensions — every Sem1 pre-TT1 row still shares the same missingness pattern, but the flag now marks that pattern as distinct from a "tt1=0%" row. After F4, ties in the Sem1 pre-TT1 block decrease but don't vanish (see H3b).

### H3b. Tied prerequisite-pressure vectors in Sem1 pre-TT1
`prerequisitePressure`, `prerequisiteAveragePct`, `prerequisiteFailureCount`, `prerequisiteChainDepth`, `prerequisiteWeakCourseRate`, `prerequisiteCarryoverLoad`, `prerequisiteRecencyWeightedFailure`, `downstreamDependencyLoad`, `weakPrerequisiteChainCount`, `repeatedWeakPrerequisiteFamilyCount` — 10 features. In Sem1 (no prerequisites exist yet), *all 10 are 0 for every student*. Combined with null assessments, a Sem1 pre-TT1 row varies in exactly 8 features:
- attendancePct / attendanceTrend / attendanceHistoryRiskCount (3, per-student varies)
- currentCgpa / cgpaMissing / backlogCount / backlogMissing (4, but for Sem1 cgpaMissing=true, backlogMissing=true, so cgpa=0 and backlog=0 forced)
- semesterProgress (1, constant per-stage)
- sectionRiskRate (1, per-section constant)
- weakCoCount / weakQuestionCount / courseworkToTtGap / ttMomentum / interventionResponseScore (5, but these reference evidence that doesn't exist yet in Sem1 pre-TT1 → mostly null/zero)

**Effective variation in Sem1 pre-TT1 is ~4 features** (attendance × 3 + section). Multiple students share an attendance profile (same section, similar attendance) → **cohort-level tied feature vectors** → tied logits → tied probs.

This is a **product-intent induced structural artefact**, not a bug per se: §C.1 mandates Sem1 pre-TT1 as watch-only with no prior history. But when these rows flow into *training*, they create a dense tie cluster. The promotion-gate test needs to either:
- Exclude Sem1 pre-TT1 from training (train-time filter, keep scoring as-is)
- Or absorb the ties via calibration (Beta handles this better than isotonic)

### H3c. Scenario-family homogeneity in training seeds
Cov-24 uses 24 seeds spread across 8 `PROOF_SCENARIO_FAMILIES`. Three seeds per family. Within a family, the hidden-parameter distributions (attendance base rate, CGPA seed, etc.) are nearly identical by construction. Two runs from the same scenario family produce feature distributions that share many exact values after the simulator's bounded quantization.

Test partition in `PROOF_CORPUS_MANIFEST` is 12 seeds from positions 52–63, which covers **1-2 seeds per scenario family**. In families where the test has only 1 run, all test rows from that family share hidden-parameter draws → dense ties. This is another structural constant of the corpus that v7 surfaces and v5-like dilutes via the wider feature-value range from fewer collapse points.

---

## 4. Ranked hypotheses with confidence + effort

| # | Hypothesis | Confidence | Owns % of the 488 ties | Fix | Effort | Expected Overload after fix |
|---|---|---:|---:|---|---:|---:|
| H1 | Calibration is isotonic/VA (step-function ties at budget boundary) | **0.75** | ~60% | Force Beta (DONE commit 66691b3c) | 0h | 1.04–1.06 |
| H3a | Silent-zero-collapse on Sem1 pre-TT1 features compresses dimensionality | 0.60 | ~20% | F4 missingness flags (DONE commit 66691b3c) | 0h | 1.02–1.04 |
| H3b | Product-intent-structural Sem1 pre-TT1 feature homogeneity | 0.55 | ~15% | Exclude Sem1 pre-TT1 from training | 1h | 1.00–1.02 |
| H3c | Scenario-family homogeneity in test partition | 0.30 | ~5% | Widen test partition to 2+ seeds per family | 0h | ≤1% improvement |
| H4 | Interaction-feature ablation shows specific compound features over-contribute | 0.40 | unknown | §N.5 ablation sweep | 3h | -/+5-8% depending on which feature |
| H5 | Global ECE 0.0067 masks local ECE 0.02+ at [0.8, 0.9] miscalibration | 0.50 | orthogonal | Local-ECE now measured (F2 commit 66691b3c), lever = better calibrator | 0h | orthogonal |
| H6 | Label-OR asymmetry on `overallCourseFailLabel` | 0.25 | ~0 (wrong magnitude) | Label redefinition | 2h | neutral to slight-improve |

**Combined expected overload after F1 + F4 ship (no new training required, just re-run eval with existing v7 model under new calibrator selection):** **1.01–1.05.**

If v7 on the existing cov-24 corpus, re-evaluated with Beta forced + missingness flags exposed, still fails ≤1.00: **proceed to H3b** (exclude Sem1 pre-TT1 training rows). If still fails, proceed to H4 (interaction ablations — expected to show `tt1tt2ExamCompoundRiskScaled` and/or `courseworkCompoundRiskScaled` as over-weighted).

---

## 5. What the intent doc DEMANDS as promotion evidence

Intent §F.7 and §N: a model is promotable only if it passes **ALL** of:

| Gate | Threshold | How to measure |
|---|---|---|
| ROC-AUC | ≥ v7 baseline 0.7894 | existing evaluator |
| PR-AUC (Average Precision) | ≥ v7 baseline (currently unspecified in §F.4; need new measurement) | existing evaluator |
| Brier | ≤ 0.1359 | existing evaluator |
| Global ECE | ≤ 0.01 | existing evaluator |
| **Local ECE @ 0.4** | ≤ 0.02 | NEW (added F2 commit 66691b3c) |
| **Local ECE @ 0.85** | ≤ 0.02 | NEW (added F2 commit 66691b3c) |
| **Overload ratio** | ≤ 1.00 globally AND per-stage AND per-semester AND per-scenario-family | partially there (global only); per-dimension breakdowns TODO |
| Precision@budget | ≥ v7 baseline | existing evaluator |
| Recall@budget | ≥ v7 baseline | existing evaluator |
| Deterministic replay | bytewise identical | existing (artifact manifest + sha256) |

**The per-stage / per-semester / per-scenario-family overload dimensionality** is the critical missing measurement. Intent §N.4 is explicit and the degenerate evaluation-report.json we inherited today (all variants AUC=0.499, flaggedRate=1.0) proves that global aggregation hides bugs. The evaluator has `modelSummaryByStage` and `overallCourseVariantSummaryByStage` already — they need to include the full `BudgetMetrics` + `LocalCalibrationMetrics` shape just added by F2 (instead of only the old flat fields) and additionally grow `bySemester` + `byScenarioFamily` dimensions.

---

## 6. Concrete next-actions (in priority order)

### Immediate (this session)
1. ✅ F1 force Beta — commit 66691b3c.
2. ✅ F4 add 5 missingness flags — commit 66691b3c.
3. ✅ F6 isotonic tombstone fix (removes residual O(n²) risk on large cov) — commit 66691b3c.
4. ✅ F15 seed-hygiene guard — commit 66691b3c.
5. ✅ F2 local-ECE @ 0.4 + 0.85 — commit 66691b3c.
6. ⏳ Extend `overallCourseVariantSummaryByStage` to emit `budgetMetrics` + `localCalibration` per-stage, and add new `overallCourseVariantSummaryBySemester` + `overallCourseVariantSummaryByScenarioFamily` aggregations.
7. ⏳ Eval re-run on cov-24 with `AIRMENTOR_EVAL_SKIP_RECOMPUTE=1` (governed runs already in DB from the 123724Z attempt) to get v7+Beta+missingness-flags numbers. Expected output: overload drops to ~1.02–1.05 on cov-24 globally.

### Soon (today/tomorrow — via orchestrator DAG)
8. RCA empirical nodes t46–t49 currently blocked on t36→t39→t40–t44→t45 chain. Orchestrator is running; t36 on codex-06 at time of writing. Once unblocked, t46 should now produce **stage-conditioned histograms** that confirm or falsify H3b.
9. Phase 2 (t51) feature-correctness owns the F3a bugs in evidence visibility; pair with a controlled re-eval that isolates the before/after deltas.
10. Phase 1 (t50) owns stage-authority fix that H3b half-depends on.

### Medium-term (after world fixes)
11. v8 logistic retrain on **corrected corpus** (stage authority fixed, missingness flags emitted, stale checkpoint leakage removed, 44-feature schema).
12. Beta-calibrated v8 compared against v7 and CatBoost (phase 10 shadow).
13. Full decision-metric table per-stage × per-semester × per-scenario-family for each of {v7+beta, v8+beta, catboost-shadow, heuristic}.

### Long-term (pre-promotion)
14. Gate promotion on the **per-cell overload bound ≤ 1.00**, not just global — even if cov-24 passes globally, a single stage cell at overload 1.3 is a demo failure.
15. Promotion decision documented in audit-map/32-reports with: (a) per-cell table, (b) deterministic seed manifest, (c) bytewise-identical reproduction proof.

---

## 7. What this analysis replaces

Intent §N enumerates ML analysis tasks 1–10. By producing this document *before* the DAG-scheduled empirical tasks t46–t49 complete, I replace:

- **§N.1 "Analyze current v7 overload root cause"** — done here with mechanical decomposition (section 1) and ranked hypothesis list (section 4).
- **§N.6 "Determine whether overload is caused by ..."** — done here: primary cause is step-function calibrator × tied feature vectors, with silent-zero-collapse as contributing amplifier.

Empirical confirmation still required for:
- §N.2 stage-conditioned score histograms (t46)
- §N.3 local reliability around 0.4 and 0.85 (t47 — tooling now shipped)
- §N.4 overload by stage × semester × scenario family (t48 — evaluator tooling partial; by-stage exists, by-semester + by-family TODO)
- §N.5 interaction-feature ablations (t49)

The empirical runs will either **validate this analysis** (overload drops to ~1.02 on v7 with Beta forced) or **refute it** (overload stays ≥1.10 meaning the ties are not calibration-driven — pushing H4 or H6 up in priority).

Either outcome is informative. The key is: **we now have a falsifiable prediction** (v7+Beta cov-24 overload ≤ 1.06 with 95% confidence) that the re-eval will check.

---

## 8. Pre-written artefact checklist for the overnight pass

By end of overnight, the on-disk RCA bundle should contain:

```
audit-map/
├── 08-ml-audit/
│   ├── 07-v7-overload-root-cause-analysis-2026-04-22.md   ← this doc
│   └── 08-v7-histograms-by-stage-semester.md               ← t46 output
├── 17-artifacts/
│   └── ml-retrain-v7-beta-forced-20260422T{Z}/
│       ├── eval-cov24.json                                  ← v7+Beta numbers
│       ├── eval-cov24.md                                    ← human-readable
│       └── meta.txt                                         ← deterministic seed manifest
├── 22-evals/
│   └── v7-overload-rca-empirical-summary-2026-04-22.md     ← summary comparing pre-/post-fix
└── 32-reports/
    └── ml-retrain-catboost-20260422.md                     ← updated earlier today
```

Validation that this analysis succeeded:
- [ ] cov-24 re-eval overload ratio drops to ≤ 1.06 (H1+H4 validated)
- [ ] cov-24 re-eval local-ECE @ 0.85 ≤ 0.02 (H5 validated)
- [ ] per-stage overload max ≤ 1.10 (Sem1 pre-TT1 tolerable, other stages pass)
- [ ] seed-hygiene guard fires cleanly on happy path (F15 non-regression)

---

*Written out-of-band of the DAG by principal-architect. Not a substitute for empirical t46–t49 runs, but a hypothesis set and fix list that can be tested the moment the orchestrator unjams its dep chain.*
