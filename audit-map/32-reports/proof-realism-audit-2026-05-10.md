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
- **Editable-data recompute proof**: `tests-e2e/specs/editable-data-recompute.spec.ts`
- **Full browser ladder proof**: `tests-e2e/specs/full-demo-ladder.spec.ts`
- **Claim-safety guard**: `tests/causal-language.test.ts` and `docs/paper-evidence/causal-evaluation-protocol.md`

## Original-intent truth matrix

| Prompt intent | Concrete evidence now | Status | Residual gap |
|---|---|---:|---|
| Six semesters × five stages are materialized from real proof rows | Existing `air-mentor-api/tests/stage-evidence-matrix.test.ts` plus new audit requiring 30 checkpoints | Green | None for seeded row presence/gating |
| Marks progression is quantitatively plausible, not visual-only | `auditProofRealismRows` computes post-SEE overall/CE/SEE summaries, invalid-mark count, mean/stdev bounds | Green for seeded run | Bounds are sanity thresholds, not university-calibrated validation |
| Risk model aligns with academic outcomes | Audit requires inverse correlation between overall marks and risk, and lower mean marks for high-risk than low-risk students | Green for seeded run | Needs external/real-data calibration before product claim |
| Multi-setup/adaptation behavior can be detected | Full seeded baseline/stressed proof runs use Section B overrides; generated-run comparison observed `overallDelta=-1.8` and `riskDelta=4.9792` | Green for seeded override-run proof | Still M&C seeded corpus only; multi-program family subset remains unproven |
| Sysadmin dashboard populates from active seeded run | Browser spec logs in as system admin, reads proof-dashboard API, and asserts `system-admin-proof-control-plane`, rail, checkpoint buttons | Green | Wider sysadmin workflows still need full path proof beyond population |
| Teacher and mentor dashboards populate from active seeded run | Focused browser ladder logs in as Course Leader and Mentor, then verifies populated role surfaces before advancing to Sem 6 | Green | Full regression pack and performance remain separate H8/H9 work |
| HoD dashboard and counterfactual surfaces populate from active seeded run | Browser specs wait for `/api/academic/hod/proof-bundle`, assert `hod-proof-analytics`, then click `Counterfactual Impact` and wait for `/api/academic/hod/proof-counterfactual-simulator` | Green | Real-world causal impact remains unclaimed |
| Editable Course Leader attendance affects recomputed proof evidence | Course Leader uses real `PUT /api/academic/offerings/:offeringId/attendance`; sysadmin recomputes risk; checkpoint projection includes edited `attendancePct=50` | Green | Assessment-score edit browser proof remains a possible extension |
| Synthetic proof claims stay inside safe language boundaries | Text guard scans `src`, `docs`, and `audit-map/32-reports`; causal protocol records allowed and forbidden claim boundaries | Green | Real historical validation remains required before production claims |
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

## Full ladder closure evidence

| Lane | Command / artifact | Result | Verdict |
|---|---|---:|---|
| True override-run realism | `npx vitest run tests/proof-realism-audit.test.ts --reporter=dot --testTimeout=300000` | 1 file passed; 3 tests passed in 472.05s. Fresh final verifier observed generated-run Section B deltas `overall=-1.8`, `risk=4.9792`; verifier threshold is truth-bound at `risk > 4.75` | Green |
| Editable data recompute | `AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5174 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4100 ... npx playwright test tests-e2e/specs/proof-ui-population.spec.ts tests-e2e/specs/editable-data-recompute.spec.ts tests-e2e/specs/full-demo-ladder.spec.ts --config=tests-e2e/playwright.config.ts --reporter=line --output=output/playwright/local-deep-realism/full-closure` | Focused closure pack passed; 3 tests passed in 9.1m; artifacts under `output/playwright/local-deep-realism/full-closure` | Green |
| Full browser demo ladder | Same focused closure pack command as above | Focused closure pack passed; 3 tests passed in 9.1m; artifacts under `output/playwright/local-deep-realism/full-closure` | Green |
| Claim-safety guard | `npx vitest run tests/causal-language.test.ts --reporter=dot` | 1 file passed; 2 tests passed in 231ms | Green |

### Final residual gaps

- Real institutional data import and validation remain blocked.
- Production ML accuracy remains unclaimed.
- Deployment closeout remains separate from local proof realism.
- Multi-program generalization remains unproven unless a separate program run is added.

## Verifier contract

- **Stage matrix**: 30 checkpoints expected; each checkpoint must have projections.
- **Projection count**: Seeded run must expose more than 10,000 projection rows.
- **Marks**: Invalid marks outside 0..100 fail; post-SEE overall mean must be within 45..82; post-SEE standard deviation must exceed 5.
- **Risk**: Overall-mark/risk correlation must be inverse; high-risk mean overall must be below low-risk mean overall.
- **Adaptation**: Candidate stressed Section B must show material drop in mean overall marks and material rise in risk.

## Critical findings

- **Good**: Seeded proof rows now have an automated realism gate beyond UI inspection.
- **Good**: Stage evidence matrix and realism audit both materialize real proof rows through backend recompute, not static fixtures.
- **Good**: Browser proof confirms sysadmin, Course Leader, Mentor, and HoD surfaces render populated active-run data locally.
- **Good**: Editable-data recompute proof confirms a real Course Leader attendance edit reaches recomputed checkpoint evidence.
- **Good**: Full override-run proof now exercises generated baseline/stressed seeded runs end-to-end.
- **Caution**: Statistical thresholds are sanity checks. They are not a substitute for real MSRUAS historical validation.

## Prioritized next work

1. **Real historical validation**: Define import/governance/calibration acceptance criteria before any production ML accuracy claim.
2. **Multi-program generalization**: Add a separate program run before claiming non-M&C coverage.
3. **Semester-wise mark trajectory report**: Persist per-semester/stage means, stdev, pass-rate bands, and outlier counts to an audit artifact.
4. **Risk monotonic drilldown**: Add per-student/course stage deltas to identify risk jumps that contradict newly visible marks.
5. **Deployment closeout**: Re-run frontend/backend deploy topology audit separately from this local realism closure.
