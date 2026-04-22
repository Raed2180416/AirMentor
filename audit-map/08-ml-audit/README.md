# ML Audit

## Model Scope
Heads: attendanceRisk, ceRisk, seeRisk, overallCourseRisk, downstreamCarryoverRisk.
Yield float [0,1].

## Policy
Map float → operational banding. Do not mix with model.

## Challenger
Status tracked.

## Missingness
Explicit imputation strategy.

## Calibration
Beta-by-head default.
