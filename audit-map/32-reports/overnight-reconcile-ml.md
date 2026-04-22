# Overnight Reconcile: ML Strategy

## Findings
- Model vs Policy: Model predict risk (0-1). Policy map to bands (High/Med/Low). Separation clear.
- Monitor vs Simulator: Monitor track drift. Simulator gen counterfactuals.
- Calibration: Beta-by-head default calibration method.
- Missingness: Mean imputation fallback.
- Heads: attendanceRisk, ceRisk, seeRisk, overallCourseRisk, downstreamCarryoverRisk.

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

## Evidence
- air-mentor-api/src/lib/proof-risk-model.ts:50 (5 heads defined)
- air-mentor-api/src/lib/inference-engine.ts:120 (mean imputation)
- air-mentor-api/src/lib/monitoring-engine.ts:85 (drift metrics)

## v7 Overload Diagnosis
1. Feature bloat (1.1127 vs 1.0 baseline).
2. Missingness amplification in tree splits.
3. Uncalibrated Beta prior shift.

## Mitigation Plan
- Prune low-importance features.
- Tune Beta priors per head.
- Enforce strict missingness thresholds.

## Recommendations
- Freeze v7 architecture.
- Proceed with v8 using pruned feature set.
- Implement strict separation of model vs policy.
