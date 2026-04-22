# Contradiction Matrix ML

## Missingness
- Missingness is handled by mean imputation fallback, not zero-fill.

## Simulator Execution
- Simulator runs offline for counterfactuals, not live.

## Calibration
- Beta-by-head calibration default, not Platt.

## Policy Layer
- Policy layer is external to model, not embedded.
