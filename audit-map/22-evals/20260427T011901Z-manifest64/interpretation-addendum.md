# Interpretation addendum — `20260427T011901Z-manifest64`

This addendum corrects language in the prior memo `docs/proof-risk-manifest64-lightning-analysis-2026-04-27.md` and any other write-up that uses imprecise wording. The numeric content of the prior memo remains accurate; only the operational claims are refined here.

The corrections below are the **authoritative wording** for any pre-B1 release-position description.

## Correction 1 — seed count

**Old wording (variant)**: "63 seeds × 21,600".

**Why wrong**: The run accepted **64 manifest seeds**. There were 65 requested seeds; one duplicate for seed `101` was a stale older zero-checkpoint run and was correctly skipped. Both `101:train:balanced:simulation_run_748b...` and the prior `sim_mnc_2023_first6_v1` (zero checkpoints) are recorded in `coEvidenceDiagnostics` and `meta.txt`. The complete run for seed `101` was kept.

**Authoritative wording**:

> 64 manifest seeds accepted, with one stale duplicate seed-101 zero-checkpoint run discarded. Each accepted seed produced 30/30 checkpoints with 21,600 stage-evidence rows.

Source: `coEvidenceDiagnostics.totalRows = 1,382,400`, `governedSeeds.length = 64`, `requestedSeeds.length = 65`, `completeRequestedRunCount = 64`, `incompleteRequestedRunCount = 1` in `evaluation-report.json`.

## Correction 2 — release-position language

**Old wording**: "current-v8 is production-ready for synthetic evaluator ranking, queue ordering, and internal intervention prioritization." (`docs/proof-risk-manifest64-lightning-analysis-2026-04-27.md` line 396.)

**Why wrong**: The phrase "production-ready" is read by stakeholders as a real-world deployment claim, not as a synthetic-evaluator claim. The qualifier loses meaning under stakeholder reading even when present in the same sentence.

**Authoritative wording**:

> current-v8 is ready as the active synthetic proof/demo baseline and pre-B1 evaluator baseline, with probability-display guards and calibration caveats.

The two existing deep-dive memos `docs/current-state-technical-deep-dive-2026-04-26.md` line 1483 and `docs/current-state-technical-deep-dive-expanded-2026-04-26.md` line 865 already use the correctly-narrowed phrasing ("…production-ready is supportable only in the narrow sense of internal synthetic evaluator metrics…"). The standalone manifest64 memo should be aligned to that wording, **not the other way around**.

Forbidden phrasings (must not appear in promotion artifacts at this stage):

- "production-ready" (without an inseparable qualifier in the same headline)
- "ready for real deployment"
- "synthetic AUC proves real-world performance"
- "the model is real-world validated"

## Correction 3 — `attendanceRisk` near 0.4

**Old wording (variant)**: "raise threshold +0.05 to 0.45" or any recommendation to retune the alert threshold pre-B1.

**Why wrong**: The local diagnostic at the 0.4 boundary is:

| Metric | Value |
|---|---:|
| Local ECE @ 0.4 | `0.2012` |
| Mean predicted @ 0.4 | `0.3953` |
| Mean actual @ 0.4 | `0.5965` |
| Local support @ 0.4 | `8,427` |

The model **underpredicts** actual risk in this band. Mean actual `0.5965` is well above mean predicted `0.3953`. Raising the threshold from `0.4` to `0.45` reduces the flag rate; it does not compensate for underprediction — it exacerbates the false-negative tail. Threshold-tuning before recalibration is the wrong intervention.

**Authoritative wording**:

> Do not tune `attendanceRisk` threshold before B1. After B1, recalibrate or review threshold policy. For now, avoid raw probability display in the 0.4 region and treat `attendanceRisk` near 0.4 as **conservative / underpredicted**: a `0.4` model output should be read as evidence of risk closer to `0.6` actual, not as evidence of borderline-safe behavior.

This recommendation is for the **attendance** head specifically. It is unrelated to the early-semester `overallCourseRisk` calibration debt, which has its own pattern (sem-1 local ECE @ 0.4 = `0.345`, sem-2 = `0.139`, sem-3 onward < `0.02`).

## Correction 4 — `watchRatesWithinLimit` waiver

**Old wording**: "watchRates gate failure is a simulation artifact, no action needed" / "expected-fail structural stress behavior".

**Why wrong**: The gate failure is real (`acceptanceGateSummary.queueBurden.watchRatesWithinLimit = false`, sem-2 post-tt1 p95 watch-rate `0.4667` against limit `0.45`, max `0.7333`). The simulator may indeed produce stress at that single stage, but no audit has yet proven that the per-run watch-rate gate and the cross-run union watch view are measuring **the same operational quantity** in a way that would justify a waiver. Until that audit is published, treating the failure as cosmetic is premature.

**Authoritative wording**:

> `watchRatesWithinLimit` is **AMBER** pending metric-definition clarification. See `watchrates-definition-audit.md`. Do not waive, do not silently flip the gate from `false` to `true`, and do not retroactively annotate the failure as expected.

## Correction 5 — policy efficacy language

**Old wording (variant)**: "zero regret" / "hard correctness requirement" without a synthetic qualifier.

**Why wrong**: The acceptance gate `noRecommendedActionUnderperformsNoAction = true` is computed from the simulator's intervention-response engine (`derive intervention residual from expected synthetic response` — see commit `ed14a767`). It establishes that, **inside this simulator**, no phenotype slice has the recommended action perform worse than no-action on the chosen counterfactual lift metric. It is not a real-world causal claim and it should not be phrased as one.

**Authoritative wording**:

> No synthetic phenotype currently shows the recommended action underperforming no-action under the current intervention-response model. This is a synthetic policy-safety property; it is not a real-world causal claim.

Forbidden phrasings without the synthetic qualifier:

- "zero regret"
- "hard correctness requirement"
- "policy is provably safe"
- "the model never makes a wrong recommendation"

## Items intentionally **not** changed

The numeric content of the prior memo is consistent with `evaluation-report.json` and remains correct:

- attendanceRisk: AUC `0.9271`, PR-AUC `0.6569`, ECE `0.0937`, P@20% `0.3708`, R@20% `0.8192`
- ceRisk: AUC `0.8716`, PR-AUC `0.2419`, ECE `0.0884`, positive rate `3.47%`, medium threshold `1.95% / 35.52% / 19.96%`
- seeRisk: AUC `0.7473`, PR-AUC `0.3952`, ECE `0.046`
- downstreamCarryoverRisk: AUC `0.9301`, PR-AUC `0.8255`, ECE `0.14`, P@20% `0.7946`, `displayProbabilityAllowed: false`
- overallCourseRisk: AUC `0.7892`, PR-AUC `0.482`, ECE `0.0475`, P@20% `0.4803`, overload ratio `1.0006`
- variant story: ship current-v8, hold challenger, hybrid currently collapses

The hybrid-router collapse explanation is correct: fallback `alpha = 1` for all five heads. The recommendation to reassess hybrid is preserved.

## How to apply this addendum

This file is the **canonical** statement for the run. When external write-ups quote the prior memo, they should additionally reference this addendum and substitute the corrected wording. The prior memo `docs/proof-risk-manifest64-lightning-analysis-2026-04-27.md` is preserved as-is for traceability; do **not** silently rewrite it.
