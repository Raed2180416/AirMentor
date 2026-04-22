# ML Audit

## Model vs Policy vs Simulator
- Model: Predicts `attendanceRisk`, `ceRisk`, `seeRisk`, `overallCourseRisk`, `downstreamCarryoverRisk`. Output raw prob [0,1].
- Policy: Maps probs to operational banding.
- Monitoring: Drift detection vs baseline.
- Simulator: Counterfactual bounds.
- Layer separation strict → Do not cross.

## Calibration & Missingness
- Calibration method: Beta-by-head default.
- Missingness strategy: Imputed explicitly.
- Scoring authority: Seeded vs runtime. Seeded init, runtime update.
- Challenger status tracked.

## Metrics
- [SUPERSEDED] Prior v6 metric: 0.98.
- v7 Overload baseline: 1.1127 vs 1.0.
