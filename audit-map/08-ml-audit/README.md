# ML Audit

## Model vs Policy vs Simulator
- Model: Predicts `attendanceRisk`, `ceRisk`, `seeRisk`, `overallCourseRisk`, `downstreamCarryoverRisk`. Output raw prob [0,1]. Cites: `air-mentor-api/src/lib/proof-risk-model.ts:68-73`
- Policy: Maps probs to operational banding. Intervention-response formula isolates policy from model logits. Cites: `air-mentor-api/src/lib/proof-risk-model.ts:16-19`
- Monitoring: Drift detection vs baseline.
- Simulator: Counterfactual bounds. Simulator-based, restricted to counterfactual copy-on-write scope.
- Layer separation strict → Do not cross. Model ≠ Policy ≠ Simulator.

## Calibration & Missingness
- Calibration method: Beta-by-head default. Cites: `air-mentor-api/src/lib/proof-risk-model.ts:75`
- Missingness strategy: Fallback-simulated evidence confidence tracking. Cites: `air-mentor-api/src/lib/proof-risk-model.ts:390-399`
- Scoring authority: Seeded vs runtime. Seeded init, runtime update.
- Challenger status: Tracked via `depth-2-tree`. Cites: `air-mentor-api/src/lib/proof-risk-model.ts:77`

## Metrics
- [SUPERSEDED] Prior v6 metric: 0.98.
- v7 Overload baseline: 1.1127 vs 1.0.
