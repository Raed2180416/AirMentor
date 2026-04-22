# ML Audit

## Model Scope
Heads: attendanceRisk, ceRisk, seeRisk, overallCourseRisk, downstreamCarryoverRisk.
Yield float [0,1]. Pure inference. (Cite: `air-mentor-api/src/lib/proof-risk-model.ts:20-50`)

## Policy
Map float → operational banding. Do not mix with model. Strict separation. (Cite: `docs/closeout/final-authoritative-plan.md:15`)

## Challenger
Status tracked. Active/passive flag. (Cite: `air-mentor-api/src/lib/inference-engine.ts:60`)

## Missingness
Explicit imputation strategy. Mean fallback. (Cite: `air-mentor-api/src/lib/proof-risk-model.ts:80`)

## Calibration
Beta-by-head default. Isolated logic. (Cite: `air-mentor-api/src/lib/inference-engine.ts:70`)

## Simulation
Simulator handles counterfactuals. Non-linear response. (Cite: `air-mentor-api/src/lib/monitoring-engine.ts:35`)

## Seeded vs Runtime
Defined authority limits. Seeded eval, runtime inference. (Cite: `air-mentor-api/src/lib/proof-observed-state.ts:15`)

## Metrics History
- v6 precision: 0.82 (SUPERSEDED)
- v7 overload precision: 0.85 (CURRENT - see v7 overload diag)
