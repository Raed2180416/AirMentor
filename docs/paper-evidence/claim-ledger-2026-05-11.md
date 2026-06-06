# AirMentor Claim Ledger — 2026-05-11

## Intent

Make every AirMentor demo/product/paper claim traceable to evidence and a boundary.

## Feature Intent

A college evaluator can distinguish local synthetic proof from real institutional validation, hosted deployment readiness, real causal impact, and multi-program generality.

## Ledger

| Claim ID | Claim | Scope | Runtime proof | Evidence paths | Status | Boundary | Owner lane | Forbidden overclaim |
|---|---|---|---|---|---|---|---|---|
| CL-LOCAL-MC-DEMO | AirMentor can run a local synthetic M&C 2023 proof demo with populated sysadmin, Course Leader, Mentor, and HoD surfaces. | Local synthetic M&C demo | Browser + API + artifact | tests-e2e/specs/full-demo-ladder.spec.ts<br>tests-e2e/specs/proof-ui-population.spec.ts<br>docs/AIRMENTOR_COMPLETE_REALISM_AUDIT_2026-06-04.md | proven | Local seeded synthetic proof only; not real institutional validation and not hosted production readiness. | Lane 0 | Forbidden: claiming the local synthetic demo proves institutional deployment readiness. |
| CL-STAGE-EVIDENCE-MATRIX | The seeded M&C proof run has 30 checkpoints with stage-authoritative evidence visibility and no future assessment leakage under the tested projection rows. | Local synthetic M&C proof run | Backend test + artifact | air-mentor-api/tests/stage-evidence-matrix.test.ts<br>docs/AIRMENTOR_COMPLETE_REALISM_AUDIT_2026-06-04.md | proven | Valid for local synthetic seeded M&C proof rows; not evidence that real cohorts follow the same trajectories. | Lane 1 | Forbidden: claiming real students follow this synthetic stage matrix. |
| CL-PROOF-REALISM-SANITY | Existing proof realism audit checks checkpoint coverage, mark ranges, mark dispersion, risk alignment, and Section B stress comparison. | Local synthetic M&C proof run | Backend test + artifact | air-mentor-api/tests/proof-realism-audit.test.ts<br>air-mentor-api/src/lib/proof-realism-audit.ts<br>docs/AIRMENTOR_COMPLETE_REALISM_AUDIT_2026-06-04.md | proven | Local synthetic sanity checks only; not university-calibrated real-data fidelity. | Lane 1 | Forbidden: claiming synthetic sanity thresholds are real MSRUAS validation. |
| CL-FORENSIC-REALISM | The seeded M&C proof run passes forensic checks for stage visibility, trajectory anomalies, risk-driver explainability, and aggregate realism. | Local synthetic M&C proof run | Backend test + artifact | air-mentor-api/tests/proof-forensic-realism-audit.test.ts<br>air-mentor-api/src/lib/proof-forensic-realism-audit.ts<br>docs/paper-evidence/proof-forensic-realism-2026-05-11.md | proven | Local synthetic M&C forensic realism only; not real institutional cohort behavior. | Lane 1 | Forbidden: claiming forensic internal realism proves real MSRUAS cohort behavior. |
| CL-ATTENDANCE-RECOMPUTE | Course Leader attendance edit can propagate into recomputed proof evidence in the tested local demo path. | Local synthetic M&C demo | Browser + API | tests-e2e/specs/editable-data-recompute.spec.ts<br>air-mentor-api/tests/academic-parity.test.ts | proven | Local synthetic demo attendance path only; not all editable academic data. | Lane 2 | Forbidden: claiming every arbitrary academic edit is production-safe. |
| CL-CO-TRACE | AirMentor traces marks to CO-level risk explanations visible to evaluators. | Product architecture | None | none | blocked | Lane 3 implementation is not complete in Phase 1. | Lane 3 | Forbidden: claiming official MSRUAS CO mapping without sourced official data. |
| CL-PAPER-BOUNDARIES | Paper/demo wording distinguishes synthetic local proof, architecture claims, missing evidence, and forbidden overclaims for N1/N2/N3. | Paper evidence | Text guard + artifact | tests/causal-language.test.ts<br>docs/paper-evidence/airmentor-paper-evidence-boundaries-2026-05-11.md | proven | Local synthetic/paper-boundary claim only; not accepted real-world publication evidence. | Lane 8 | Forbidden: implying accepted real-world publication results. |
| CL-P6-MULTI-PROGRAM | AirMentor supports at least two synthetic program templates with no M&C identifier leakage. | Multi-program synthetic proof | None | none | blocked | P6 is out of Phase 1 scope. | Lane 5 | Forbidden: claiming generality across programs or institutions. |
| CL-P7-RECALIBRATION | AirMentor has a versioned recalibration spine with active model version traceability. | Model governance architecture | None | none | blocked | P7 is out of Phase 1 scope. | Lane 4 | Forbidden: claiming real-history model training or active per-program recalibration. |
| CL-REAL-DATA-VALIDATION | AirMentor predictive performance is validated on real institutional student data. | Production/real-data validation | None | none | blocked | No real institutional dataset has been imported, governed, calibrated, and externally validated. | Lane 8 | Forbidden: claiming real institutional predictive validity. |
| CL-PRODUCTION-ML | AirMentor risk model has production ML accuracy for live students. | Production ML | None | none | blocked | Synthetic-only metrics and local proof cannot establish production accuracy. | Lane 8 | Forbidden: claiming production predictive accuracy. |
| CL-CAUSAL-IMPACT | AirMentor interventions have proven real-world causal impact. | Causal evaluation | None | none | blocked | Current counterfactuals are simulated; no randomized or credible quasi-experimental study exists. | Lane 8 | Forbidden: claiming real causal intervention proof. |
| CL-HOSTED-DEPLOYMENT | AirMentor is ready for hosted production deployment. | Hosted deployment | None | none | blocked | Current user constraint keeps frontend/backend local until explicitly requested. | Lane 7 | Forbidden: claiming hosted production readiness from local proof. |

## Current Claim Boundary

Phase 1 may only upgrade claims with passing local tests and durable evidence artifacts. Synthetic proof remains local and demo-scoped. Real institutional validation, production ML accuracy, causal impact, P6 multi-program generality, P7 recalibration, and hosted deployment remain blocked until their own evidence lanes pass.
