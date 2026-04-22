# ML Audit

## Model vs Policy
- Model: Predicts risk probabilities (0-1).
- Policy: Maps probabilities to operational bands (High/Med/Low).

## Heads
1. attendanceRisk
2. ceRisk
3. seeRisk
4. overallCourseRisk
5. downstreamCarryoverRisk

## Calibration
- Beta-by-head default calibration method.

## Monitor vs Simulator
- Monitor: Tracks drift via PSI.
- Simulator: Generates counterfactual what-if analysis.
