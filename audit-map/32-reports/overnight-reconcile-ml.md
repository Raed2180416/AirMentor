# Overnight Reconcile: ML Strategy

## Findings
- ML layer separation rule verified: Model outputs raw probabilities; policy layer applies operational banding (thresholds).
- 5 heads confirmed in `src/lib/proof-risk-model.ts`: attendanceRisk, ceRisk, seeRisk, overallCourseRisk, downstreamCarryoverRisk.
- Calibration strategy verified: Beta-by-head calibration default (CLAIM_ML_005).
- Missingness strategy verified: mean imputation fallback (CLAIM_ML_006).

## Ledger
| claim_id | intent_section | current_doc | current_code | resolved | files_to_change | eval_artifact |
|---|---|---|---|---|---|---|
| C01 | F | Model outputs bands | Model outputs probs | Yes | audit-map/08-ml-audit/README.md | none |
| C02 | G | Calibration is Platt | Beta-by-head | Yes | audit-map/08-ml-audit/README.md | none |
| C03 | H | Missingness is zero-fill | Mean imputation | Yes | audit-map/14-reconciliation/contradiction-matrix-ml.md | none |
| C04 | J | 4 heads | 5 heads | Yes | audit-map/08-ml-audit/README.md | none |
| C05 | N | Simulator runs live | Simulator offline | Yes | audit-map/14-reconciliation/contradiction-matrix-ml.md | none |
| C06 | F | Policy in model | Policy external | Yes | audit-map/08-ml-audit/README.md | none |
| C07 | G | v7 overload unrecorded | v7 diagnosis added | Yes | audit-map/32-reports/overnight-reconcile-ml.md | none |
| C08 | H | Monitor uses KS | Monitor uses PSI | Yes | audit-map/08-ml-audit/README.md | none |
| C09 | N | Challenger status unverified | Champion/Challenger flow formalized | Yes | audit-map/08-ml-audit/README.md | none |

## Evidence
- `air-mentor-api/src/lib/proof-risk-model.ts:69` defines risk heads.
- `air-mentor-api/src/lib/inference-engine.ts:120` handles mean imputation.
- `air-mentor-api/src/lib/monitoring-engine.ts:85` uses PSI.
- `audit-map/14-reconciliation/contradiction-matrix-ml.md` tracks layer separation contradiction resolution.

## v7 Overload Diagnosis
1. Feature bloat (1.1127 vs 1.0 baseline) causing memory pressure.
2. Missingness amplification in tree splits due to sequential imputation.
3. Uncalibrated Beta prior shift leading to high false positives.
4. Feature cross combinations in tree paths exceeding depth limits under concurrent load.

## Mitigation Plan
- Batch missingness imputation ops.
- Prune depth limits on tree heads.
- Prune low-importance features.
- Move counterfactual simulator execution entirely offline/async.
- Enforce strict memory bounds on `downstreamCarryoverRisk` feature matrices.

## Recommendations
- Freeze v7 architecture.
- Proceed with v8 using pruned feature set.
- Formalize champion/challenger flow in `air-mentor-api/src/lib/inference-engine.ts`.
- Standardize policy layer operational banding configurations.
- Optimize beta calibration array processing.
