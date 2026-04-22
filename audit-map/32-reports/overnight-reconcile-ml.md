# Overnight Reconcile: ML Strategy

## Findings

- The active ML stack is layered, not monolithic: model scoring (`air-mentor-api/src/lib/proof-risk-model.ts:69`), calibration/display gating (`air-mentor-api/src/lib/proof-risk-model.ts:102`), deterministic fallback (`air-mentor-api/src/lib/inference-engine.ts:72`), monitoring governance (`air-mentor-api/src/lib/monitoring-engine.ts:25`), and simulator counterfactuals (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:209`).
- Queue priority authority is explicitly tied to the overall-course head (`air-mentor-api/src/lib/proof-risk-model.ts:351`) and emitted as queue score (`air-mentor-api/src/lib/proof-risk-model.ts:1998`), so queue behavior must not be attributed to monitoring policy alone.
- Probability display is intentionally constrained: `ceRisk` is always non-probabilistic (`air-mentor-api/src/lib/proof-risk-model.ts:701`), and fallback-simulated low-confidence rows suppress display (`air-mentor-api/src/lib/proof-risk-model.ts:391`).
- Calibration scope differs by variant: default includes `beta` and `venn-abers` (`air-mentor-api/src/lib/proof-risk-model.ts:102`), baseline-v5-like excludes both (`air-mentor-api/src/lib/proof-risk-model.ts:112`), which matters for interpreting variant comparison outcomes.
- Runtime queue pressure is structurally coupled to staffing budget through overload penalties (`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:352`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:377`), and not only to thresholding.

## Ledger

| claim_id | statement | status | resolution | evidence |
| --- | --- | --- | --- | --- |
| ML-001 | System uses one risk head | resolved | Reframed to five-head model | `air-mentor-api/src/lib/proof-risk-model.ts:69` |
| ML-002 | Calibration is only sigmoid/isotonic | resolved | Added full default method set with beta/venn-abers | `air-mentor-api/src/lib/proof-risk-model.ts:102` |
| ML-003 | Baseline-v5-like and v6 share same calibration set | resolved | Marked baseline as reduced method set | `air-mentor-api/src/lib/proof-risk-model.ts:112` |
| ML-004 | `ceRisk` probability is available | resolved | Marked as always band-only | `air-mentor-api/src/lib/proof-risk-model.ts:701` |
| ML-005 | Fallback rows keep normal probability display | resolved | Added fallback-simulated suppression behavior | `air-mentor-api/src/lib/proof-risk-model.ts:391`, `air-mentor-api/src/lib/proof-risk-model.ts:401` |
| ML-006 | Queue rank source is generic policy | resolved | Anchored queue rank source to overall head | `air-mentor-api/src/lib/proof-risk-model.ts:351`, `air-mentor-api/src/lib/proof-risk-model.ts:1998` |
| ML-007 | Heuristic fallback equals ML output path | resolved | Split deterministic fallback from trained model path | `air-mentor-api/src/lib/inference-engine.ts:72`, `air-mentor-api/src/lib/inference-engine.ts:77` |
| ML-008 | Monitoring is part of model inference | resolved | Classified monitoring as operational policy layer | `air-mentor-api/src/lib/monitoring-engine.ts:25` |
| ML-009 | Counterfactual lift is undocumented | resolved | Anchored formula and runtime write path | `air-mentor-api/src/lib/proof-control-plane-playback-service.ts:209`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:771` |
| ML-010 | Overload is only metric artifact | resolved | Anchored overload-to-budget coupling in runtime | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:352`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:377` |
| ML-011 | v7 overload = 1.1127 has direct source | open | No direct numeric anchor found; track as missing evidence | `air-mentor-api/scripts/evaluate-proof-risk-model.ts:102`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:500` |
| ML-012 | Mean queue burden equals real operational saturation | resolved | Added cross-run union evidence for near-saturation | `audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:172` |

## Evidence

- Variant context and baseline/hybrid/challenger comparators are present in the wide report table (`audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:74`).
- Queue burden run-level means and gate outcomes are present (`audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:133`, `audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:166`).
- Cross-run union diagnostics show open-rate near/full saturation in multiple stages and semesters (`audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:173`, `audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:174`).
- Expanded metrics report independently confirms watch-rate gate failures while actionable-rate gates pass (`audit-map/17-artifacts/local/2026-04-20T211458Z--proof-risk-v6-expanded-metrics--local--evaluation-report.md:117`).
- Evaluator code defines overload ratio from `flaggedRateAtBudget / budgetRate` and emits those values per variant (`air-mentor-api/scripts/evaluate-proof-risk-model.ts:500`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:1981`).

## v7 Overload Diagnosis

Ranked candidate causes for the reported v7 overload elevation (relative to baseline), based on available evidence:

1. Cross-run union saturation effect (highest likelihood)
- Multiple stage/semester cells have open-rate at or near 1.0 (`audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:173`, `audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:174`).
- This indicates broad flag concentration across runs even when per-run means look threshold-compliant.

2. Watch-rate gate instability under broader scenario spread
- Watch gate explicitly fails in both wide and expanded reports (`audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:166`, `audit-map/17-artifacts/local/2026-04-20T211458Z--proof-risk-v6-expanded-metrics--local--evaluation-report.md:117`).
- High watch rates increase operational burden even when open queue rates are clamped.

3. Runtime overload penalty feedback into staffing budget
- Runtime applies overload penalties to faculty budgets (`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:352`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:377`).
- Reduced budgets can amplify apparent overload when actionable rows remain high.

4. Mixed variant calibration/actionability tradeoff
- Hybrid/current/challenger differ in calibration and action metrics (`audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:76`).
- If a variant improves ranking but increases budget-flag concentration, overload ratio can rise despite better headline metrics.

Direct numeric gap note:
- The exact anchor `v7 overload 1.1127 vs baseline 1.0` is not present in checked-in JSON/MD/code searched in this pass; treat this value as source-missing until an artifact line is provided.
- Traceable proxy metrics already present and suitable for interim diagnosis are `budgetRate`, `flaggedRateAtBudget`, and `overloadRatio` (`air-mentor-api/scripts/evaluate-proof-risk-model.ts:97`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:99`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:102`).

## Mitigation Plan

- Short-term: Gate promotion decisions on queue-budget diagnostics, not only Brier/AUC; require explicit pass on actionable, watch, and section tolerance checks (`air-mentor-api/scripts/evaluate-proof-risk-model.ts:377`).
- Short-term: Add an artifact-level requirement to include explicit overload ratio lines for current vs baseline vs candidate in all promotion reports (`air-mentor-api/scripts/evaluate-proof-risk-model.ts:1979`).
- Medium-term: Split evaluation dashboards into run-level and cross-run-union panels so mean and union saturation cannot be conflated (`audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:133`, `audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:172`).
- Medium-term: Tune routing/threshold policy with explicit overload cap constraints before widening challenger routing.
- Medium-term: Preserve layer boundaries in documentation and reporting templates (model vs fallback vs monitoring vs simulator) to avoid diagnosis drift.

## Recommendations

- Keep current v6 as production default until overload evidence is complete and directly anchored.
- Treat v7 overload `1.1127` as unverified claim for now; require direct artifact line before sign-off.
- Use `flaggedRateAtBudget` and `overloadRatio` as mandatory acceptance metrics for all future model comparisons.
- Maintain `ceRisk` as band-only in external communication unless display policy code changes.
- Continue documenting superseded conclusions rather than deleting prior metric history.
