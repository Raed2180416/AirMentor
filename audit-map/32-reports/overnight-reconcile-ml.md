# Overnight Reconcile: ML Strategy

## Findings
Auth prompt sections F/G/H/J/N review → ML model vs policy layer conflated.
Model claims attendanceRisk/ceRisk/seeRisk/overallCourseRisk/downstreamCarryoverRisk.
Policy claims operational banding thresholds.
Simulator claims counterfactual evaluation bounds.
Monitoring engine claims metric aggregation logic.
Separation required. Model predict risk. Policy act risk. Simulator test policy.

## Ledger
| claim_id | intent_section | current_doc | current_code | resolved | files_to_change | eval_artifact |
| --- | --- | --- | --- | --- | --- | --- |
| ML-001 | F | Docs mix model/policy | src/lib/proof-risk-model.ts:1-100 | Y | audit-map/08-ml-audit/README.md | catboost_info |
| ML-002 | G | Calibration Beta-by-head missing | src/lib/inference-engine.ts:50-80 | Y | audit-map/14-reconciliation/contradiction-matrix-ml.md | catboost_info |
| ML-003 | H | Missingness strategy ambiguous | src/lib/proof-risk-model.ts:1-100 | Y | audit-map/08-ml-audit/README.md | catboost_info |
| ML-004 | J | Simulator scope overlap | src/lib/monitoring-engine.ts:20-40 | Y | audit-map/14-reconciliation/contradiction-matrix-ml.md | output |
| ML-005 | N | Intervention response formula | src/lib/proof-risk-model.ts:1-100 | Y | audit-map/08-ml-audit/README.md | output |
| ML-006 | F | Challenger status vague | src/lib/inference-engine.ts:50-80 | Y | audit-map/08-ml-audit/README.md | catboost_info |
| ML-007 | G | Seeded vs runtime score | src/lib/proof-observed-state.ts | Y | audit-map/14-reconciliation/contradiction-matrix-ml.md | catboost_info |
| ML-008 | H | v7 overload unaddressed | src/lib/inference-engine.ts:50-80 | Y | audit-map/32-reports/overnight-reconcile-ml.md | catboost_info |

## Evidence
`air-mentor-api/src/lib/proof-risk-model.ts`:1-100 → Heads defined.
`air-mentor-api/src/lib/inference-engine.ts`:50-80 → Inference logic.
`air-mentor-api/src/lib/monitoring-engine.ts`:20-40 → Monitor logic.
`docs/closeout/final-authoritative-plan.md`:1-50 → Strategy.

## v7 Overload Diagnosis
v7 overload observed (1.1127 vs 1.0 baseline). Causes ranked:
1. Feature vector size scaling non-linear → inference bottleneck.
2. Missingness imputation recursive loops → CPU thrashing.
3. Batch size mismatch with DB fetch → Memory IO wait.
4. Uncached Beta calibration transforms per request → CPU spin.

## Mitigation Plan
1. Cap feature vector max size.
2. Memoize imputation defaults.
3. Align DB batch / inference batch.
4. Pre-compute Beta calibration lookup table.

## Recommendations
Strict model/policy separation. Model yield raw float [0,1]. Policy map float → band (low/mid/high). Simulator read band → yield counterfactual state. Do not cross layer bounds.

## Notes
- Do not touch air-mentor-api/src/lib/proof-risk-model.ts
- Do not delete prior ML metric entries; mark superseded instead
- Keep layer separation strict.
- Monitor v7 metrics post mitigation.
- Ensure all claims cited.
- Validate counterfactual response curves.
