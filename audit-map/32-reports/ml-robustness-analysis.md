# ML Optimal Model Deep Tune Pass - Track B: Robustness Analysis

## 1. Generalization to Real Classes

Will model generalize to real classes with varied learning rates/environments?

Current model is trained on a canonical corpus of 64 generated worlds (`coverage-24`). These worlds are constrained by specific assumptions about student behavior, learning rates, and environmental factors.

- **Covered Ranges:** The current worlds likely cover a baseline distribution of attendance patterns, assignment completion rates, and test scores derived from idealized or historically averaged archetypes.
- **Uncovered Ranges:** Real-world classes often exhibit long-tail behaviors, correlated failures (e.g., an entire section struggling due to a specific teaching style or external event), and dynamic shifts in learning rates that static archetypes miss. The model has not been exposed to these out-of-distribution events.
- **Evidence Required for Robustness:** To claim real-world robustness, the model must be evaluated against actual historical data from diverse courses, terms, and instructional contexts. We need to see stable calibration (ECE) and ranking (ROC-AUC) across these unseen real-world distributions, not just on held-out generated worlds.

## 2. Impact of Deferred Configurables

How do deferred configurables affect robustness claims?

Gap-6 notes that section environment parameters and ML thresholds are currently seeded/hardcoded. They are not slider-configurable per run.

- **Current Limitation:** Because these parameters are static, the generated worlds are less diverse than they could be. The model's "robustness" is only proven within the narrow bounds of the hardcoded configurations.
- **Future Improvement:** When slider-configurable worlds are implemented, we can systematically explore the parameter space (e.g., intentionally generating worlds with extreme learning rate variance or high environmental noise).
- **Grounding in Realistic Priors:** If the ranges and defaults for these sliders are grounded in realistic priors (derived from empirical data or expert pedagogical knowledge), training on these diverse, configurable worlds will significantly improve external validity. The model will learn to be robust against a wider, more realistic spectrum of classroom dynamics.

## Next Steps to Operator

* Track B Side Task done. File `audit-map/32-reports/ml-robustness-analysis.md` write good.
* Model need see real world data. 64 fake worlds not enough for wild reality.
* Sliders need move. Hardcode numbers make weak model. Test edge cases with sliders.
* Operator, read report. Plan get real student data for next train.