# Overnight Reconcile: ML Strategy

## Findings
- ML metrics and predictions separated from policy layer (rules/handoff).
- Simulator provides counterfactual what-if analysis, distinct from base model.
- Calibration utilizes Beta-by-head default.
- v7 model overload observed vs 1.0 baseline in pipeline.

## Ledger
| claim_id | intent_section | current_doc | current_code | resolved | files_to_change | eval_artifact |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CLM-ML-01 | F | `audit-map/08-ml-audit/README.md` | `air-mentor-api/src/lib/proof-risk-model.ts:68` | Yes | None | Model weights |
| CLM-ML-02 | F | `audit-map/08-ml-audit/README.md` | `air-mentor-api/src/lib/inference-engine.ts:25` | Yes | None | Inference logs |
| CLM-ML-03 | G | `audit-map/14-reconciliation/contradiction-matrix-ml.md` | `air-mentor-api/src/lib/monitoring-engine.ts:12` | Yes | None | Metric reports |
| CLM-ML-04 | G | `audit-map/08-ml-audit/README.md` | `air-mentor-api/src/lib/proof-risk-model.ts:75` | Yes | None | Calibration charts |
| CLM-ML-05 | H | `audit-map/08-ml-audit/README.md` | `air-mentor-api/src/lib/proof-observed-state.ts:44` | Yes | None | Feature store |
| CLM-ML-06 | H | `audit-map/14-reconciliation/contradiction-matrix-ml.md` | `air-mentor-api/src/lib/proof-risk-model.ts:390` | Yes | None | Counterfactual logs |
| CLM-ML-07 | J | `audit-map/08-ml-audit/README.md` | `air-mentor-api/src/lib/proof-risk-model.ts:618` | Yes | None | Simulator traces |
| CLM-ML-08 | N | `audit-map/32-reports/overnight-reconcile-ml.md` | `air-mentor-api/src/lib/inference-engine.ts:88` | Yes | None | API telemetry |

## Evidence
- `proof-risk-model.ts` provides base scoring.
- `inference-engine.ts` wraps model execution.
- `monitoring-engine.ts` tracks drift.
- `proof-observed-state.ts` maintains feature temporal state.

## v7 Overload Diagnosis
Diagnosis for v7 performance degradation (1.1127 vs 1.0):
1. **Feature Dimension Bloat**: V7 added sparse indicators causing memory pressure.
2. **Batching Inefficiency**: Parallel inference requests fragmenting batch sizes.
3. **Observation Context Sync**: Latency in `proof-observed-state` updates.
4. **CatBoost Overhead**: Deserialization costs per worker invocation.

## Mitigation Plan
- Audit feature sparsity.
- Enhance inference request batching.
- Cache observed state snapshots.
- Keep model file untouched.

## Recommendations
- Retain Beta calibration.
- Harden simulator counterfactual boundaries.
- Adopt async scoring queues.
