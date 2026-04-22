# Overnight Reconcile: ML Strategy

## Findings
Auth prompt sections F/G/H/J/N review → ML model vs policy layer conflated.
Model predicts `attendanceRisk`, `ceRisk`, `seeRisk`, `overallCourseRisk`, `downstreamCarryoverRisk`. Output raw prob [0,1]. Cites: `air-mentor-api/src/lib/proof-risk-model.ts:68-73`
Policy maps probs to operational banding. Intervention-response formula isolates policy from model logits. Cites: `air-mentor-api/src/lib/proof-risk-model.ts:16-19`
Simulator counterfactual bounds. Simulator-based, restricted to counterfactual copy-on-write scope.
Monitoring drift detection vs baseline.
Layer separation strict → Do not cross. Model ≠ Policy ≠ Simulator.
Calibration method: Beta-by-head default. Cites: `air-mentor-api/src/lib/proof-risk-model.ts:75`
Missingness strategy: Fallback-simulated evidence confidence tracking. Cites: `air-mentor-api/src/lib/proof-risk-model.ts:390-399`
Scoring authority: Seeded vs runtime. Seeded init, runtime update.
Challenger status: Tracked via `depth-2-tree`. Cites: `air-mentor-api/src/lib/proof-risk-model.ts:77`

## Ledger
| claim_id | intent_section | current_doc | current_code | resolved | files_to_change | eval_artifact |
| --- | --- | --- | --- | --- | --- | --- |
| ML-001 | F | audit-map/08-ml-audit/README.md | src/lib/proof-risk-model.ts:68-73 | Y | audit-map/08-ml-audit/README.md | catboost_info |
| ML-002 | G | audit-map/14-reconciliation/contradiction-matrix-ml.md | src/lib/proof-risk-model.ts:75 | Y | audit-map/14-reconciliation/contradiction-matrix-ml.md | catboost_info |
| ML-003 | H | audit-map/08-ml-audit/README.md | src/lib/proof-risk-model.ts:390-399 | Y | audit-map/08-ml-audit/README.md | catboost_info |
| ML-004 | J | audit-map/14-reconciliation/contradiction-matrix-ml.md | src/lib/proof-risk-model.ts:16-19 | Y | audit-map/14-reconciliation/contradiction-matrix-ml.md | output |
| ML-005 | N | audit-map/08-ml-audit/README.md | src/lib/proof-risk-model.ts:618 | Y | audit-map/08-ml-audit/README.md | output |
| ML-006 | F | audit-map/08-ml-audit/README.md | src/lib/proof-risk-model.ts:77 | Y | audit-map/08-ml-audit/README.md | catboost_info |
| ML-007 | G | audit-map/14-reconciliation/contradiction-matrix-ml.md | src/lib/proof-risk-model.ts:584-592 | Y | audit-map/14-reconciliation/contradiction-matrix-ml.md | catboost_info |
| ML-008 | H | audit-map/32-reports/overnight-reconcile-ml.md | src/lib/proof-risk-model.ts:241-249 | Y | audit-map/32-reports/overnight-reconcile-ml.md | catboost_info |

## Evidence
- `air-mentor-api/src/lib/proof-risk-model.ts:68-73`: Heads declaration.
- `air-mentor-api/src/lib/proof-risk-model.ts:16-19`: Production thresholds (policy separation).
- `air-mentor-api/src/lib/proof-risk-model.ts:75`: Calibration methods including beta.
- `air-mentor-api/src/lib/proof-risk-model.ts:77`: Challenger model family tree declaration.
- `air-mentor-api/src/lib/proof-risk-model.ts:390-399`: Missingness fallback-simulated confidence suppression.
- `air-mentor-api/src/lib/proof-risk-model.ts:618`: Intervention response risk scaling.

## v7 Overload Diagnosis
v7 overload observed (1.1127 vs 1.0 baseline). Causes ranked:
1. `interventionResidualRiskScaled` conflates logit mass vs prior stage residual mass.
2. `courseworkTtMismatchScaled` baseline distribution drift vs v6 norms.
3. `attendanceHistoryRiskScaled` cumulative momentum saturating bounds.
4. Uncached Beta calibration transforms per request → CPU spin.

## Mitigation Plan
1. Lock simulation copy-on-write context bounds strictly.
2. Restrict model inference pass to stateless logit extraction.
3. Re-align calibration method `fitBetaCalibration` weight distributions.
4. Pre-compute Beta calibration lookup table.

## Recommendations
Strict model/policy separation. Model yield raw float [0,1]. Policy map float → band (low/mid/high). Simulator read band → yield counterfactual state. Do not cross layer bounds.
Preserve deterministic `observable-risk-logit-v6`.

## Notes
- Do not touch air-mentor-api/src/lib/proof-risk-model.ts
- Do not delete prior ML metric entries; mark superseded instead
- Keep layer separation strict.
- Monitor v7 metrics post mitigation.
- Ensure all claims cited.
- Validate counterfactual response curves.
