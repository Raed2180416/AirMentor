# ML Contradiction Matrix

## Resolved
- Model vs Policy: Separated. Model predict (cite: `air-mentor-api/src/lib/proof-risk-model.ts:20-50`), Policy act.
- Simulator Scope: Bound to counterfactuals (cite: `air-mentor-api/src/lib/monitoring-engine.ts:35`).
- Seeded vs Runtime: Defined authority limits (cite: `air-mentor-api/src/lib/proof-observed-state.ts:15`).
- Calibration: Beta-by-head missing in docs, present in code (cite: `air-mentor-api/src/lib/inference-engine.ts:70`).

## Ledger
| claim_id | intent_section | current_doc | current_code | resolved | files_to_change | eval_artifact |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CL-ML-01 | F | audit-map/08-ml-audit/README.md | air-mentor-api/src/lib/proof-risk-model.ts | yes | None | None |
| CL-ML-02 | G | audit-map/08-ml-audit/README.md | air-mentor-api/src/lib/inference-engine.ts | yes | None | None |
| CL-ML-03 | H | audit-map/08-ml-audit/README.md | air-mentor-api/src/lib/monitoring-engine.ts | yes | None | None |
| CL-ML-04 | J | audit-map/08-ml-audit/README.md | air-mentor-api/src/lib/proof-observed-state.ts | yes | None | None |
| CL-ML-05 | N | audit-map/08-ml-audit/README.md | air-mentor-api/src/lib/proof-risk-model.ts | yes | None | None |
| CL-ML-06 | v7 | audit-map/32-reports/overnight-reconcile-ml.md | catboost_info/ | yes | None | None |
| CL-ML-07 | cal | audit-map/08-ml-audit/README.md | air-mentor-api/src/lib/proof-risk-model.ts | yes | None | None |
| CL-ML-08 | cf | audit-map/08-ml-audit/README.md | air-mentor-api/src/lib/proof-risk-model.ts | yes | None | None |
