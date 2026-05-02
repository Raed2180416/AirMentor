# AirMentor Proof Readiness Closeout — 2026-04-30

## Intent

Verify current proof realism blockers with concrete evaluator-facing evidence: browser Flow10 HoD counterfactual analytics, backend ML helper routing, and six-semester proof-plane coverage.

## Browser E2E Finding

- **Observed failure:** `tests-e2e/specs/flow-10-completion-counterfactual.spec.ts` timed out while setting up `seededRun`.
- **Root cause:** `activateProofSimulationRun` marks a run as `status='active'` after activation, while `waitForActivatedRun` accepted only `status='completed'`.
- **Fix:** `tests-e2e/fixtures/seeded-run-fixture.ts` now accepts an activated checkpoint-bearing run with `status='completed'` or `status='active'`.
- **Scope note:** the fixture already had other uncommitted local changes; this closeout only claims the active-status acceptance as the current root-cause fix.

## Browser E2E Verification

Command:

```bash
nix develop -c bash -lc 'env AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=chromium AIRMENTOR_PW_CHROMIUM_EXECUTABLE=/nix/store/bas6dg486nm7lc5b9529da43418mymbz-playwright-browsers/chromium-1200/chrome-linux64/chrome AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4091 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5251 npx playwright test --config=tests-e2e/playwright.config.ts --workers=1 tests-e2e/specs/flow-10-completion-counterfactual.spec.ts'
```

Result:

- **Status:** passed.
- **Tests:** 2 passed.
- **Duration:** 5.0m.
- **Covered evaluator view:** HoD login, HoD proof analytics surface, Counterfactual Impact tab, simulator route response, simulator panel render, no prohibited causal wording, no console errors.

## Backend ML Helper Verification

Command:

```bash
npx vitest run tests/evaluate-proof-risk-model.test.ts --reporter=dot
```

Result:

- **Status:** passed.
- **Tests:** 5 passed.
- **Duration:** 1.43s.
- **Meaning:** current helper behavior chooses the challenger route when the challenger clearly beats current and preserves stage-specific routing semantics.

## Six-Semester Proof-Plane Verification

Command:

```bash
AIRMENTOR_DIRECT_PROOF_OUTPUT_DIR=output/direct-proof-plane/flow10-active-status-20260429T2020Z npx tsx scripts/direct-proof-plane-audit.ts
```

Artifact:

```text
output/direct-proof-plane/flow10-active-status-20260429T2020Z/direct-proof-plane-audit-2026-04-29.json
```

Result summary:

- **Status:** passed.
- **Stack:** embedded-test-app.
- **Batch:** `batch_branch_mnc_btech_2023`.
- **Run:** `sim_mnc_2023_first6_v1`.
- **Checkpoints:** 30.
- **Matrix:** 6 semesters × 5 stages.
- **Students per checkpoint:** 120.
- **Findings:** 0.
- **Future-evidence leakage:** 0.
- **Risk-band count mismatches:** 0.

## Proof-Plane Matrix

| Semester | Stage | Students | High | Medium | Low | Open Queue | Playback | Visible fields | Hidden future fields |
|---:|---|---:|---:|---:|---:|---:|---|---|---|
| 1 | pre-tt1 | 120 | 0 | 0 | 120 | 0 | true | - | tt1Pct, tt2Pct, quizPct, assignmentPct, seePct |
| 1 | post-tt1 | 120 | 0 | 0 | 120 | 0 | true | tt1Pct | tt2Pct, quizPct, assignmentPct, seePct |
| 1 | post-tt2 | 120 | 0 | 0 | 120 | 0 | true | tt1Pct, tt2Pct | quizPct, assignmentPct, seePct |
| 1 | post-assignments | 120 | 0 | 0 | 120 | 0 | true | tt1Pct, tt2Pct, quizPct, assignmentPct | seePct |
| 1 | post-see | 120 | 0 | 36 | 84 | 0 | true | tt1Pct, tt2Pct, quizPct, assignmentPct, seePct | - |
| 2 | pre-tt1 | 120 | 9 | 31 | 80 | 0 | true | - | tt1Pct, tt2Pct, quizPct, assignmentPct, seePct |
| 2 | post-tt1 | 120 | 9 | 31 | 80 | 14 | true | tt1Pct | tt2Pct, quizPct, assignmentPct, seePct |
| 2 | post-tt2 | 120 | 9 | 31 | 80 | 0 | true | tt1Pct, tt2Pct | quizPct, assignmentPct, seePct |
| 2 | post-assignments | 120 | 9 | 31 | 80 | 0 | true | tt1Pct, tt2Pct, quizPct, assignmentPct | seePct |
| 2 | post-see | 120 | 21 | 36 | 63 | 0 | true | tt1Pct, tt2Pct, quizPct, assignmentPct, seePct | - |
| 3 | pre-tt1 | 120 | 34 | 38 | 48 | 0 | true | - | tt1Pct, tt2Pct, quizPct, assignmentPct, seePct |
| 3 | post-tt1 | 120 | 34 | 38 | 48 | 23 | true | tt1Pct | tt2Pct, quizPct, assignmentPct, seePct |
| 3 | post-tt2 | 120 | 34 | 38 | 48 | 0 | true | tt1Pct, tt2Pct | quizPct, assignmentPct, seePct |
| 3 | post-assignments | 120 | 34 | 35 | 51 | 0 | true | tt1Pct, tt2Pct, quizPct, assignmentPct | seePct |
| 3 | post-see | 120 | 35 | 42 | 43 | 0 | true | tt1Pct, tt2Pct, quizPct, assignmentPct, seePct | - |
| 4 | pre-tt1 | 120 | 60 | 41 | 19 | 0 | true | - | tt1Pct, tt2Pct, quizPct, assignmentPct, seePct |
| 4 | post-tt1 | 120 | 60 | 40 | 20 | 23 | true | tt1Pct | tt2Pct, quizPct, assignmentPct, seePct |
| 4 | post-tt2 | 120 | 61 | 39 | 20 | 0 | true | tt1Pct, tt2Pct | quizPct, assignmentPct, seePct |
| 4 | post-assignments | 120 | 60 | 39 | 21 | 0 | true | tt1Pct, tt2Pct, quizPct, assignmentPct | seePct |
| 4 | post-see | 120 | 62 | 37 | 21 | 0 | true | tt1Pct, tt2Pct, quizPct, assignmentPct, seePct | - |
| 5 | pre-tt1 | 120 | 76 | 34 | 10 | 0 | true | - | tt1Pct, tt2Pct, quizPct, assignmentPct, seePct |
| 5 | post-tt1 | 120 | 76 | 34 | 10 | 26 | true | tt1Pct | tt2Pct, quizPct, assignmentPct, seePct |
| 5 | post-tt2 | 120 | 76 | 34 | 10 | 0 | true | tt1Pct, tt2Pct | quizPct, assignmentPct, seePct |
| 5 | post-assignments | 120 | 76 | 34 | 10 | 0 | true | tt1Pct, tt2Pct, quizPct, assignmentPct | seePct |
| 5 | post-see | 120 | 85 | 32 | 3 | 0 | true | tt1Pct, tt2Pct, quizPct, assignmentPct, seePct | - |
| 6 | pre-tt1 | 120 | 103 | 17 | 0 | 0 | true | - | tt1Pct, tt2Pct, quizPct, assignmentPct, seePct |
| 6 | post-tt1 | 120 | 103 | 17 | 0 | 27 | true | tt1Pct | tt2Pct, quizPct, assignmentPct, seePct |
| 6 | post-tt2 | 120 | 103 | 17 | 0 | 0 | true | tt1Pct, tt2Pct | quizPct, assignmentPct, seePct |
| 6 | post-assignments | 120 | 103 | 17 | 0 | 0 | true | tt1Pct, tt2Pct, quizPct, assignmentPct | seePct |
| 6 | post-see | 120 | 102 | 18 | 0 | 0 | true | tt1Pct, tt2Pct, quizPct, assignmentPct, seePct | - |

## Current Readiness Verdict

- **Demo proof readiness:** improved and currently supported for Flow10 HoD counterfactual browser proof and six-semester proof-plane evidence.
- **Browser proof:** targeted Flow10 HoD analytics now passes after the fixture status fix.
- **Proof-plane:** 30/30 checkpoints pass stage evidence visibility and risk-band consistency checks.
- **Production readiness:** not fully proven here. Remaining production gates still include real-data import validation, privacy/security runbooks, retention/delete/export policy, model-governance cards, load/rollback proof, and deployment-environment evidence.
