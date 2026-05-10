---
title: Proof realism audit truth matrix
created: 2026-05-10
scope: local-only
---

# Proof Realism Audit Truth Matrix — 2026-05-10

## Scope lock

- **Mode**: Local-only audit. No deployment changes.
- **Data source**: Seeded MSRUAS proof run rows, runtime recompute/materialized checkpoint rows, and real browser surfaces.
- **Protected boundary**: Seeded model and generator were not changed.
- **New verifier boundary**: Read-only audit module and tests only.

## Implementation evidence

- **Audit module**: `air-mentor-api/src/lib/proof-realism-audit.ts`
- **Backend verifier test**: `air-mentor-api/tests/proof-realism-audit.test.ts`
- **Browser population proof**: `tests-e2e/specs/proof-ui-population.spec.ts`

## Original-intent truth matrix

| Prompt intent | Concrete evidence now | Status | Residual gap |
|---|---|---:|---|
| Six semesters × five stages are materialized from real proof rows | Existing `air-mentor-api/tests/stage-evidence-matrix.test.ts` plus new audit requiring 30 checkpoints | Green | None for seeded row presence/gating |
| Marks progression is quantitatively plausible, not visual-only | `auditProofRealismRows` computes post-SEE overall/CE/SEE summaries, invalid-mark count, mean/stdev bounds | Green for seeded run | Bounds are sanity thresholds, not university-calibrated validation |
| Risk model aligns with academic outcomes | Audit requires inverse correlation between overall marks and risk, and lower mean marks for high-risk than low-risk students | Green for seeded run | Needs external/real-data calibration before product claim |
| Multi-setup/adaptation behavior can be detected | `compareProofClassroomSetups` verifies a stressed Section B candidate has lower marks and higher risk than baseline | Green as verifier capability | Current test uses row-level candidate perturbation; next step should exercise full seeded override run end-to-end |
| Sysadmin dashboard populates from active seeded run | Browser spec logs in as system admin, reads proof-dashboard API, and asserts `system-admin-proof-control-plane`, rail, checkpoint buttons | Green | Wider sysadmin workflows still need full path proof beyond population |
| Teacher dashboard populates from active seeded run | Browser spec logs in as Course Leader and asserts `academic-proof-summary` for `course-leader-dashboard`, proof queue/semester copy, total students | Green | Mentor role separately covered by existing flow-1; new focused spec checks Course Leader only |
| HoD dashboard populates from active seeded run | Browser spec logs in as HoD, waits for `/api/academic/hod/proof-bundle`, asserts `hod-proof-analytics` with active simulation text and Sem 1 | Green | Deep HoD counterfactual remains covered by existing flow-10, not this focused proof |
| Deployment readiness | Explicitly out of scope for this pass | Deferred | Re-run frontend/backend deploy topology audit later |

## Verification commands

- **RED verifier**: `npx vitest run tests/proof-realism-audit.test.ts --reporter=dot --testTimeout=300000`
  - Result: Failed as expected before implementation with missing `../src/lib/proof-realism-audit.js`.
- **GREEN realism verifier**: `npx vitest run tests/proof-realism-audit.test.ts --reporter=dot --testTimeout=300000`
  - Result: Passed 2/2 in 159.07s.
- **Backend typecheck**: `npx tsc -p tsconfig.json --noEmit --pretty false`
  - Result: Passed.
- **Existing stage evidence proof**: `npx vitest run tests/stage-evidence-matrix.test.ts --reporter=dot --testTimeout=300000`
  - Result: Passed 1/1 in 79.55s.
- **Browser UI population proof**: `AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_FIREFOX_EXECUTABLE=/nix/store/jqpxpar1pvk37f1kjwhkp26dj1wrpw4d-playwright-firefox/firefox/firefox npx playwright test tests-e2e/specs/proof-ui-population.spec.ts --config=tests-e2e/playwright.config.ts`
  - Result: Passed 1/1 in 1.8m.
  - Note: Initial non-reuse run failed safely because `http://127.0.0.1:4000/health` was already in use. Rerun used existing server.

## Verifier contract

- **Stage matrix**: 30 checkpoints expected; each checkpoint must have projections.
- **Projection count**: Seeded run must expose more than 10,000 projection rows.
- **Marks**: Invalid marks outside 0..100 fail; post-SEE overall mean must be within 45..82; post-SEE standard deviation must exceed 5.
- **Risk**: Overall-mark/risk correlation must be inverse; high-risk mean overall must be below low-risk mean overall.
- **Adaptation**: Candidate stressed Section B must show material drop in mean overall marks and material rise in risk.

## Critical findings

- **Good**: Seeded proof rows now have an automated realism gate beyond UI inspection.
- **Good**: Stage evidence matrix and realism audit both materialize real proof rows through backend recompute, not static fixtures.
- **Good**: Browser proof confirms sysadmin, Course Leader, and HoD surfaces render populated active-run data locally.
- **Caution**: The new adaptation test proves the auditor detects setup deltas, but it does not yet prove a full section-override seeded run creates those deltas end-to-end.
- **Caution**: Statistical thresholds are sanity checks. They are not a substitute for real MSRUAS historical validation.

## Prioritized next work

1. **Full override-run realism proof**: Create two seeded proof runs with distinct `sectionOverridesJson`, materialize both, and compare generated rows without synthetic row perturbation.
2. **Semester-wise mark trajectory report**: Persist per-semester/stage means, stdev, pass-rate bands, and outlier counts to an audit artifact.
3. **Risk monotonic drilldown**: Add per-student/course stage deltas to identify risk jumps that contradict newly visible marks.
4. **Browser flow ladder**: Re-run the broader reused-server Firefox pack after the new UI proof spec is stable.
5. **Calibration readiness**: Define acceptance criteria for real historical marks/attendance validation before claiming production ML accuracy.
