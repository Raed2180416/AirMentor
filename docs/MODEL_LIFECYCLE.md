# Model Lifecycle

> Companion to `docs/MASTER_ROADMAP_2026-05-01.md` §P3 (decision L8).

## Terms

| Term | Meaning | When used |
|---|---|---|
| **Recalibrate** | Adjust the existing model's decision boundary or probability outputs using new real-student outcome data without re-fitting the feature weights. | After a live semester ends and outcome labels are available. Implemented in P7 (`RecalibrationService`). |
| **Retrain** | Re-fit the full model from scratch on a new training set. | Reserved for P7+ once a sufficient real-data corpus exists. Do **not** use in the UI until then. |

## Why "Recalibrate" before "Retrain"

The proof simulation corpus (64 synthetic worlds) is sufficient for *ranking* relative risk but is not representative of the true joint distribution over a real cohort.  
Fitting a new model on it would produce a model no more reliable than the current one — but with a false sense of novelty.

Recalibration (Platt scaling, isotonic regression, beta calibration, or Venn–Abers) adjusts the *output probabilities* while preserving the ranking order established by the existing feature weights. This is the correct first step once a semester's worth of real labels is available.

Full retraining is appropriate when the recalibrated model shows sustained, reproducible AUC improvement on held-out semesters — not before.

## Current state (P3)

- The risk model (`production-v8`) is inference-rule + logistic hybrid trained on synthetic worlds only.
- No recalibration or retraining has occurred on real data.
- All UI labels must say **"Recalibrate"** (not "Retrain") until P7 ships.
- The `CalibrationMethod` type in `proof-risk-model.ts` already enumerates `identity | sigmoid | isotonic | beta | venn-abers` as forward-looking scaffolding.

## Planned P7 work

- `RecalibrationService` — takes a labelled outcome set and runs the selected `CalibrationMethod`
- Endpoint `POST /api/admin/proof-runs/:runId/recalibrate`
- UI: "Recalibrate Model" button with before/after reliability diagram
- Metrics: Brier score + ECE delta reported as recalibration gain
