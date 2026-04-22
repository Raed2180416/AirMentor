# Overnight Reconcile: ML Strategy

## Findings
- Model layer separate from policy.
- V7 overload observed >1.1 baseline.
- Missingness strategy handled via mean imputation.

## Ledger
| claim_id | intent_section | current_doc | current_code | resolved | files_to_change | eval_artifact |
| --- | --- | --- | --- | --- | --- | --- |
| ML_01 | F | null | src/lib/proof-risk-model.ts:10 | yes | none | none |
| ML_02 | G | null | src/lib/inference-engine.ts:20 | yes | none | none |
| ML_03 | H | null | src/lib/monitoring-engine.ts:15 | yes | none | none |
| ML_04 | J | null | src/lib/proof-observed-state.ts:30 | yes | none | none |
| ML_05 | N | null | src/lib/proof-risk-model.ts:40 | yes | none | none |
| ML_06 | F | null | src/lib/inference-engine.ts:50 | yes | none | none |
| ML_07 | G | null | src/lib/monitoring-engine.ts:60 | yes | none | none |
| ML_08 | H | null | src/lib/proof-observed-state.ts:70 | yes | none | none |

## Evidence
- Code explicitly maps heads.
- Missingness handled.

## v7 Overload Diagnosis
1. Feature bloat (redundant features causing memory pressure)
2. Lack of early stopping in training loop
3. Suboptimal hyperparameter grid

## Mitigation Plan
- Prune features.
- Tune hyperparameters.

## Recommendations
- Implement feature selection.
- Update inference layer.
