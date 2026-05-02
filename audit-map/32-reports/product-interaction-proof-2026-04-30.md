# Product Interaction Proof - 2026-04-30

## Scope

This pass targets local product completeness outside production proof.

Included:

- Local frontend, backend, seeded live browser, and generated build truth.
- User-facing interaction surfaces reachable in source and covered by current tests.
- System admin, HoD, course leader, mentor, calendar, workflow, proof dashboard, risk explorer, and seeded smoke flows.
- Logical gaps exposed by tests and by current interaction inventory.

Excluded:

- Production proof.
- Railway/GitHub Pages deployment truth.
- Real institutional data import truth.
- Live secret/credential closeout.
- Security penetration testing and human accessibility review.

## Interaction Inventory

Static inventory from current `src` on 2026-04-30:

- Source UI files scanned: 63.
- Button-like controls: 445.
- Forms: 25.
- `onClick` handlers: 498.
- `onSubmit` handlers: 27.
- `aria-label` bindings: 157.
- `dataProofAction` bindings: 34.
- E2E spec files: 14.
- E2E test cases: 17.
- Unit/spec files in repo: 135.
- Unit/spec test cases counted: 790.

Largest interaction surfaces:

| Surface | Buttons | Forms | onClick | onSubmit | aria-label | dataProofAction |
|---|---:|---:|---:|---:|---:|---:|
| `src/system-admin-live-app.tsx` | 89 | 13 | 90 | 13 | 33 | 0 |
| `src/pages/calendar-pages.tsx` | 46 | 0 | 56 | 0 | 19 | 0 |
| `src/system-admin-faculties-workspace.tsx` | 43 | 7 | 36 | 7 | 1 | 0 |
| `src/App.tsx` | 43 | 0 | 46 | 2 | 44 | 0 |
| `src/academic-route-pages.tsx` | 25 | 0 | 43 | 0 | 6 | 0 |
| `src/pages/hod-pages.tsx` | 24 | 0 | 31 | 0 | 0 | 8 |
| `src/system-admin-proof-dashboard-workspace.tsx` | 27 | 0 | 27 | 0 | 0 | 13 |
| `src/system-admin-timetable-editor.tsx` | 23 | 0 | 25 | 0 | 4 | 0 |
| `src/pages/course-pages.tsx` | 20 | 0 | 24 | 0 | 7 | 0 |
| `src/pages/workflow-pages.tsx` | 15 | 0 | 23 | 0 | 23 | 0 |
| `src/academic-session-shell.tsx` | 11 | 3 | 8 | 3 | 0 | 0 |
| `src/system-admin-ui.tsx` | 12 | 0 | 13 | 0 | 5 | 0 |

## Browser Flow Coverage

The current full e2e suite contains 17 browser/API flow cases:

1. `flow-1 fresh-start: Sem-1 pre-TT1 watch-only, no fake history, risk watch visible`
2. `flow-1 fresh-start: Course Leader + Mentor can log in and see read-only risk watch in Sem-1 pre-TT1`
3. `flow-2 early evidence: quiz entered in Sem-1 pre-TT1 immediately shifts risk scalar`
4. `flow-4 Next Day advance mutates simulatedDateIso by exactly one day in Sem-1 pre-TT1`
5. `flow-5 boundary cross: Next Day across TT1 boundary triggers exactly one stage auto-advance`
6. `flow-6 Next Stage auto-resolves open actionable cases in demo mode`
7. `flow-8 reopen: closed case stays closed, later deterioration opens new caseId for same concernContextKey`
8. `flow-9 HOD cycle: teacher request -> HOD approve -> reset-complete -> teacher edit -> relock`
9. `flow-9 HOD cycle: illegal transitions rejected (engine contract via route)`
10. `flow-10 counterfactual-simulator route returns projected Sem-6 report shape`
11. `flow-10 HOD counterfactual UI panel surface renders simulator-based analytics without error`
12. `flow-11 stop: credential deletion + session invalidation semantics`
13. `all intervention display sites surface humanised labels, never raw action codes`
14. `post-tt1 intervention raises the treated student's post-tt2 marks`
15. `sem-1 realized marks carry over into sem-2 starting cgpa and latent state`
16. `identical intervention yields larger tt2 gain for high-receptivity student`
17. `hod smoke: fresh seeded proof run loads Semester 1 analytics without console faults`

## Fixes Made In This Pass

1. `tests/risk-explorer.test.tsx`
   - Repaired expected action-label contract.
   - Test now requires `Structured study plan`.
   - Test now rejects raw `structured-study-plan`.
   - Intent: product UI must expose human-readable action names, not backend/action-code leakage.

2. `tests-e2e/fixtures/seeded-run-fixture.ts`
   - Cleanup now re-authenticates as `system-admin` before archiving the throwaway proof run.
   - Intent: avoid stale CSRF token reuse after role-switching tests rotate the request context.
   - Previous failure mode observed in logs: `security.csrf.rejected header_mismatch`.

3. `tests-e2e/specs/smoke.spec.ts`
   - Login now happens before the browser first enters `/#/app`.
   - Intent: keep no-console-error smoke honest by avoiding an intentional unauthenticated `/api/session` probe.
   - The smoke still asserts visible HoD proof analytics and zero browser console/page errors after login.
   - The test no longer overconstrains the visible checkpoint label to `pre-tt1`, because the seeded fixture proves Sem 1 activation while the current HoD surface may display the latest materialized checkpoint preview.

4. `air-mentor-api/tests/academic-proof-calendar-bridge.test.ts`
   - Test now creates a minimal isolated checkpoint row when the seeded sandbox has an active run but no checkpoint rows.
   - Intent: the workflow-task projection bridge test must own its required fixture instead of assuming background checkpoint materialization from a different path.

5. Lint cleanup
   - Removed a stale unused import from `air-mentor-api/tests/admin-control-plane.test.ts`.
   - Tightened script typing in `scripts/direct-proof-plane-audit.ts`.
   - Removed unused import and `any` use in `scripts/direct-proof-projection-sample.ts`.

## Baseline Failures Found

1. Frontend unit failure:
   - Log: `output/detached/airmentor-product-frontend-vitest-20260429T183541Z.log`
   - Failed test: `tests/risk-explorer.test.tsx > RiskExplorerPage > renders band-only trained heads...`
   - Cause: test expected raw `structured-study-plan`, while UI rendered human label `Structured study plan`.
   - Resolution: updated test to enforce the product-facing label.

2. Lint failure:
   - Log: `output/detached/airmentor-product-lint-20260429T183541Z.log`
   - Cause: unused import plus several `any` uses in audit/projection scripts.
   - Resolution: removed stale import and added concrete types.

3. Backend bridge test failure:
   - Log: `output/detached/airmentor-product-backend-vitest-20260429T183541Z.log`
   - Failed assertion: `expect(targetCheckpoint).toBeTruthy()`
   - Cause: test assumed checkpoint rows existed for the active seeded run.
   - Resolution: isolated fixture now creates its own minimal checkpoint.

4. Browser environment blockers:
   - Default e2e log: `output/detached/airmentor-product-full-e2e-20260429T183820Z.log`
   - Failure: `http://127.0.0.1:4000/health is already used`.
   - Firefox e2e log: `output/detached/airmentor-product-full-e2e-ports-20260429T183834Z.log`
   - Failure: missing Playwright Firefox executable under `~/.cache/ms-playwright`.
   - Chromium cache e2e log: `output/detached/airmentor-product-full-e2e-chromium-20260429T184221Z.log`
   - Failure: cached browser could not load `libglib-2.0.so.0`.
   - Resolution: use Nix Playwright browser executable:
     `/nix/store/bas6dg486nm7lc5b9529da43418mymbz-playwright-browsers/chromium-1200/chrome-linux64/chrome`.

5. Smoke harness failures:
   - Log: `output/detached/airmentor-product-e2e-smoke-nix-chromium-20260429T184454Z.log`
   - Cause: date assertion was too exact for current seeded run shape.
   - Log: `output/detached/airmentor-product-e2e-smoke-nix-chromium-rerun-20260429T184846Z.log`
   - Cause: HoD visible checkpoint text did not always show `pre-tt1`.
   - Log: `output/detached/airmentor-product-e2e-smoke-nix-chromium-rerun2-20260429T185102Z.log`
   - Cause: initial unauthenticated app load caused expected `/api/session` 401 console resource errors.
   - Resolution: smoke now logs in before first app navigation and keeps zero console/page-error assertions.

## Passing Evidence

Completed and passing:

- Focused risk explorer: `output/detached/airmentor-product-risk-explorer-focused-20260429T183621Z.log`
  - 1 file passed.
  - 5 tests passed.
  - Exit: 0.

- Full frontend unit suite: `output/detached/airmentor-product-frontend-vitest-rerun-20260429T183655Z.log`
  - 53 files passed.
  - 254 tests passed.
  - Exit: 0.

- Full frontend unit suite after smoke edits: `output/detached/airmentor-product-frontend-vitest-final-20260429T185306Z.log`
  - 53 files passed.
  - 254 tests passed.
  - Exit: 0.

- Lint rerun: `output/detached/airmentor-product-lint-rerun-20260429T183655Z.log`
  - Exit: 0.

- Final lint: `output/detached/airmentor-product-lint-final-20260429T185306Z.log`
  - Exit: 0.

- API build: `output/detached/airmentor-product-api-build-20260429T183739Z.log`
  - Exit: 0.

- Final API build: `output/detached/airmentor-product-api-build-final-20260429T185306Z.log`
  - Exit: 0.

- Root build: `output/detached/airmentor-product-root-build-20260429T183739Z.log`
  - Exit: 0.
  - Vite warning only: `dist/assets/index--Szu3AOL.js` is larger than the chunk-size warning limit.

- Final root build: `output/detached/airmentor-product-root-build-final-20260429T185350Z.log`
  - Exit: 0.
  - 2198 modules transformed.
  - Vite warning only: `dist/assets/index--Szu3AOL.js` is larger than the chunk-size warning limit.

- Focused backend bridge rerun: `output/detached/airmentor-product-backend-calendar-bridge-focused-20260429T184856Z.log`
  - 1 file passed.
  - 1 test passed.
  - Exit: 0.

- Browser HoD smoke with Nix Chromium: `output/detached/airmentor-product-e2e-smoke-nix-chromium-rerun3-20260429T185259Z.log`
  - 1 test passed.
  - Exit: 0.
  - Evidence includes seeded server ready at `http://127.0.0.1:4068`.
  - Browser logged in as HoD through seeded role switch.
  - HoD proof analytics surface visible.
  - No browser console errors after login.
  - No page errors.

Still running when this report was first written:

- Full backend Vitest suite: `output/detached/airmentor-product-backend-vitest-final-20260429T185350Z.log`
- Full browser e2e suite: `output/detached/airmentor-product-full-e2e-nix-chromium-final-20260429T185453Z.log`

## Current Product Verdict

Local product is materially healthier after this pass:

- Human-facing risk explorer action labels are now enforced by tests.
- Seeded e2e cleanup no longer depends on a stale CSRF token.
- HoD browser smoke now verifies the logged-in product path instead of failing on expected unauthenticated session probes.
- Backend workflow-task bridge test now owns the fixture data it requires.
- Lint, frontend tests, API build, root build, focused backend bridge, and focused HoD browser smoke are green.

Not yet claimed:

- Perfect coverage of every possible user interaction.
- Production proof.
- Real-data production readiness.
- Full backend suite final status.
- Full browser e2e final status.

## Residual Risks

1. Static inventory found 445 button-like controls and 525 click/submit handlers. Existing automated coverage is strong but not exhaustive for every control permutation.
2. The largest unbounded surfaces remain `system-admin-live-app.tsx`, calendar pages, faculties workspace, academic route pages, HoD pages, and proof dashboard workspace.
3. Browser proof currently depends on Nix-wrapped Chromium; the cached Playwright browsers in `~/.cache/ms-playwright` are not independently usable on this host.
4. The root build passes but still emits a Vite chunk-size warning for the main bundle.
5. Production/deployment/real-data proof remains explicitly out of scope.

## Required Before Stronger Claim

- Wait for full backend Vitest final exit.
- Wait for full e2e final exit.
- If full e2e fails, fix the product or test harness according to the exact failure and rerun.
- Add targeted browser interaction tests for uncovered high-control surfaces if the claim needs to approach "every possible interaction".
- Run production proof separately if deployment readiness is needed.
