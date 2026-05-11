# Model Governance Card

## Status

AirMentor's current proof-risk behavior is suitable for synthetic demo and proof-control validation only. It is **not approved for real-data production deployment** until real historical validation, calibration, subgroup review, threshold approval, and human-review policy are completed.

## Intended Use Boundary

- **Allowed current claim:** synthetic proof-control demo can show evidence timing, risk-band progression, HoD analytics, and counterfactual simulator UI behavior.
- **Disallowed current claim:** model is validated on real college data or ready to guide production interventions.
- **Human-impact rule:** model output cannot be the sole basis for grading, discipline, scholarship, placement, denial of opportunity, or punitive action.

## Current Evidence Anchors

- **Six-semester proof-plane audit:** `output/direct-proof-plane/flow10-active-status-20260429T2020Z/direct-proof-plane-audit-2026-04-29.json`
  - 30 checkpoints.
  - 6 semesters × 5 stages.
  - 120 students per checkpoint.
  - 0 findings.
  - 0 future-evidence leakage in the parsed closeout check.
- **Browser Flow10 proof:** `tests-e2e/specs/flow-10-completion-counterfactual.spec.ts`
  - HoD counterfactual simulator route and UI panel passed after seeded-run fixture active-status fix.
- **Backend helper proof:** `air-mentor-api/tests/evaluate-proof-risk-model.test.ts`
  - Focused test run passed 5 tests.
  - Covers challenger route selection and stage-specific hybrid blend behavior.
- **Readiness boundary:** `docs/real-data-production-readiness-2026-04-30.md` states synthetic proof-risk metrics cannot be used as real-world model evidence.

## Synthetic Demo Model Claims

The synthetic proof model may be used to demonstrate:

- **Temporal evidence discipline:** early checkpoints do not expose future TT2, quiz, assignment, or SEE data.
- **Stage progression:** risk can change as stage evidence becomes available.
- **Operational triage:** queue and watch counts can be explained in a demo corpus.
- **HoD analytics flow:** HoD can inspect proof analytics and simulator outputs in browser.
- **Counterfactual framing:** UI must avoid causal certainty and frame simulated impact as a projection.

The synthetic proof model must not be described as:

- **Real predictive validity:** no real-cohort holdout evidence is complete.
- **Fairness validated:** no approved real subgroup/fairness review is complete.
- **Production calibrated:** no real-data calibration report is complete.
- **Autonomous decisioning:** every real intervention must remain human-reviewed.

## Required Real-Data Governance Gates

| Gate | Requirement | Current status |
|---|---|---|
| Training data version | Immutable source cohort, term, import manifest, checksum, and approval IDs | Missing for real data |
| Feature schema freeze | Versioned feature schema and extraction code frozen before evaluation | Missing for real data |
| Label definition | Approved outcome label, time horizon, exclusions, and leakage review | Missing for real data |
| Temporal validation | Train on older terms, validate/test on later held-out terms | Missing |
| Calibration report | Stage/semester calibration curves and calibration method version | Missing for real data |
| Baseline comparison | Compare against prior CGPA, attendance threshold, TT1-only, and backlog history | Missing |
| Precision at capacity | HOD/course-leader workload-based precision and false-positive burden | Missing |
| Subgroup/fairness review | Legally and ethically approved subgroup slices with owner sign-off | Missing |
| Threshold policy | Institution-approved risk bands, queue capacity, and escalation rules | Missing |
| Human review | Written policy that model prioritizes human review and cannot penalize autonomously | Missing formal approval |
| Outcome audit | Track intervention effect, workload, harm signals, and closure outcomes | Missing for real interventions |
| Appeal/correction | Student/faculty correction path for wrong source data or risk-affecting evidence | Missing production workflow |

## Evaluation Report Requirements

A production model validation package must include:

- **Dataset card:** cohort scope, source systems, import manifests, date range, inclusion/exclusion criteria, missingness, and known biases.
- **Feature card:** each feature, source table, stage availability, leakage risk, transformation, and owner.
- **Model card:** model family, version, artifact ID, training source IDs, calibration version, intended use, non-use cases, and known limitations.
- **Temporal split results:** metrics by semester and stage, with held-out term evidence.
- **Calibration report:** calibration curve, expected calibration error, and calibration method for each material stage.
- **Operational report:** precision@capacity, expected case volume, false-positive burden, false-negative misses, and HOD workload approval.
- **Fairness review:** approved slices, observed disparities, mitigation decisions, and sign-off.
- **Leakage review:** proof that future SEE/TT2/assignment evidence cannot affect earlier stage scores.
- **Change-control plan:** promotion, rollback, challenger comparison, monitoring, and deprecation rules.

## UI And Communication Guardrails

Production UI must:

- **Show scope:** model version, cohort scope, calibration date, and feature availability stage.
- **Show uncertainty:** risk bands and probabilities must be framed as estimates, not certainty.
- **Avoid causal overclaim:** counterfactual outputs must say projected or simulated, not guaranteed causal effect.
- **Show human owner:** every intervention recommendation must route to an accountable faculty/HOD/mentor workflow.
- **Show correction path:** users must know how wrong marks, attendance, roster, or transcript evidence can be corrected.
- **Separate synthetic from real:** demo mode and production mode must not share claims or visual language that hides synthetic provenance.

## Go-Live Gate

A real-data model may be enabled only after:

- **Approved data contract:** source owners sign off on all training/evaluation data families.
- **Validation pass:** temporal holdout metrics, calibration, baseline comparisons, and leakage checks pass documented thresholds.
- **Fairness review:** approved subgroup analysis has no unexplained unacceptable concentration or burden.
- **Threshold approval:** HOD/admin accept queue capacity, risk thresholds, false-positive burden, and escalation policy.
- **Human-impact policy:** institution approves non-punitive, human-reviewed usage boundaries.
- **Monitoring plan:** drift, calibration decay, queue volume, intervention outcomes, and incident signals are monitored.
- **Rollback path:** model artifact can be disabled or rolled back without losing audit history.

## Current Verdict

AirMentor has strong synthetic proof-plane and browser-demo evidence. It is **not real-data model-governance ready** until the real validation package, human-impact policy, fairness review, calibration report, and monitoring/rollback evidence are complete.
