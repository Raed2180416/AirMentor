# Contradiction Matrix ML

## Missingness
- Missingness is handled by mean imputation fallback, not zero-fill.

## Simulator Execution
- Simulator runs offline for counterfactuals, not live.

## Calibration
- Beta-by-head calibration default, not Platt.

## Policy Layer
- Policy layer is external to model, not embedded.

| claim_id | intent_section | current_doc | current_code | resolved | files_to_change | eval_artifact |
|---|---|---|---|---|---|---|
| CLAIM_ML_001 | F/G | Model predicts attendance, CE, SEE, overall, downstream | `attendanceRisk` head exists | true | - | `air-mentor-api/catboost_info/` |
| CLAIM_ML_002 | F/G | Operational banding applies thresholds to raw probs | Unknown | true | `audit-map/08-ml-audit/README.md` | - |
| CLAIM_ML_003 | H | v7 model overloaded baseline (1.1127 vs 1.0) | Unknown | true | `audit-map/32-reports/overnight-reconcile-ml.md` | - |
| CLAIM_ML_004 | J | Challenger status defined for champion/challenger flow | Unknown | true | `audit-map/08-ml-audit/README.md` | - |
| CLAIM_ML_005 | N | Calibration uses Beta-by-head default | Unknown | true | `audit-map/08-ml-audit/README.md` | - |
| CLAIM_ML_006 | N | Missingness strategy defined | Unknown | true | `audit-map/08-ml-audit/README.md` | - |
| CLAIM_ML_007 | N | Seeded vs runtime scoring authority separate | Unknown | true | `audit-map/08-ml-audit/README.md` | - |
| CLAIM_ML_008 | N | Counterfactual scope simulator-based | Unknown | true | `audit-map/08-ml-audit/README.md` | - |
