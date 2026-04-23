# Playwright Harness Bootstrap

This pass bootstraps a deterministic Playwright end-to-end harness for the fresh-sem1 proof demo without touching product source under `src/**` or `air-mentor-api/src/**`.

The harness is intentionally narrow:

- one browser: Chromium
- one worker
- no retries
- seeded proof run bootstrap through real admin API routes
- HoD smoke coverage only
- artifact output rooted under `tests-e2e/artifacts/`

The implementation stays inside the allowed write scope:

- `tests-e2e/playwright.config.ts`
- `tests-e2e/helpers/login-as.ts`
- `tests-e2e/fixtures/seeded-run-fixture.ts`
- `tests-e2e/specs/smoke.spec.ts`
- `tests-e2e/support/playwright-runtime.ts`
- `package.json`

## What was created

- `tests-e2e/playwright.config.ts` wires a deterministic Playwright runner against `http://localhost:5173`, starts both the seeded API and the Vite dev server, pins `AIRMENTOR_STAGE_REALIZATION_V1=1`, and fixes `AIRMENTOR_SEED_NOW=2026-03-16T00:00:00Z`.
- `tests-e2e/support/playwright-runtime.ts` prefers `@playwright/test`, but accepts an explicit runtime import override for cache-only/offline verification environments.
- `tests-e2e/helpers/login-as.ts` logs in through `/api/session/login`, switches role context through `/api/session/role-context` when needed, and uses realistic seeded MSRUAS faculty identities:
  `devika.shetty` for HoD, `rohit.menon` for Course Leader, `harish.bhat` for Mentor, and `sysadmin` for System Admin.
- `tests-e2e/fixtures/seeded-run-fixture.ts` creates a fresh seeded proof run for `batch_branch_mnc_btech_2023`, activates it, activates Semester 1, verifies that the run exposes the Semester 1 `pre-tt1` checkpoint, returns `{ runId, batchId, simulatedDateIso }`, and archives the throwaway run in best-effort cleanup.
- `tests-e2e/specs/smoke.spec.ts` captures browser console/page errors, boots a fresh run through the fixture, logs in as HoD, opens the academic workspace, and asserts the HoD proof surface renders with `Semester 1 · pre-tt1`.
- `package.json` now declares `@playwright/test` and exposes:
  `npm run e2e`
  `npm run e2e:install`

## Verification Notes

I verified that the Playwright config and spec load correctly by listing tests with the cached local CLI:

```bash
PLAYWRIGHT_TEST_IMPORT=/home/raed/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/test.mjs \
node /home/raed/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/cli.js \
test --config=tests-e2e/playwright.config.ts --list
```

Observed result:

- one test discovered
- file: `smoke.spec.ts`
- title: `hod smoke: fresh seeded proof run loads Semester 1 pre-tt1 without console faults`

I also attempted the real smoke execution in this sandbox with the same cached CLI. The harness itself did not throw config/import errors, but the sandbox blocks local TCP listeners. Both server commands fail with `listen EPERM` before the browser phase:

- backend seeded API: `Error: listen EPERM: operation not permitted 127.0.0.1`
- frontend Vite server: `Error: listen EPERM: operation not permitted 127.0.0.1:5173`

That means end-to-end execution could not complete inside this slot, even though the harness files are wired for a normal developer machine / CI runner where localhost binds are allowed.

## How to run

Run these from the repo root on a machine that allows local listeners:

```bash
npm install
npm run e2e:install
npx playwright test --config=tests-e2e/playwright.config.ts smoke.spec.ts
```

Optional quick sanity check before the full browser run:

```bash
npx playwright test --config=tests-e2e/playwright.config.ts --list
```

If you want the script wrapper instead of the raw CLI:

```bash
npm run e2e -- smoke.spec.ts
```

Expected happy-path outcome:

- seeded API starts on `127.0.0.1:4000`
- Vite starts on `127.0.0.1:5173`
- fixture creates and activates a fresh proof run
- HoD dashboard renders the active proof surface
- the page text includes `Semester 1 · pre-tt1`

## Known limitations

- `student` login is intentionally not wired yet because the seeded backend does not expose a provisioned student session credential path comparable to faculty/system-admin login.
- Verification in this sandbox is blocked by local-port `EPERM` restrictions, so the smoke command could not be observed all the way through a browser assertion here.
- The fixture is pinned to the seeded proof batch and curriculum import constants:
  `batch_branch_mnc_btech_2023`
  `curriculum_import_mnc_2023_first6_v1`
- The harness uses Chromium only. Firefox/WebKit coverage is intentionally deferred until the base flow matrix exists.
- The smoke spec proves bootstrap, login, routing, and banner stability only. It does not yet assert queue counts, student drilldowns, or stage advancement side effects.
- Cleanup is best-effort archival of the generated run after each test. A cleanup failure is attached to the test result instead of masking a passing smoke assertion.

## Next 11 flow specs

1. HoD dashboard boot with seeded Semester 1 `pre-tt1` context and zero console/page errors.
2. Course Leader dashboard boot against the same activated proof run and branch-scoped offerings.
3. Mentor watchlist boot with deterministic mentee scope and proof summary strip parity.
4. HoD risk-explorer launch from the watchlist and checkpoint provenance assertion.
5. HoD student-shell launch from the watchlist and checkpoint provenance assertion.
6. Course Leader course page proof overlay for a seeded Semester 1 offering.
7. Mentor to risk-explorer drilldown for one seeded mentee under the active run.
8. Semester transition `pre-tt1 -> post-tt1` through the admin proof control plane.
9. Semester transition `post-tt1 -> post-tt2` with queue/history stability checks.
10. Faculty intervention apply flow, then next-stage realization proof that future marks changed.
11. HoD queue/reassessment acknowledgement-resolve loop with deterministic post-action refresh.

## Recommended follow-through

- Keep new specs on top of the same `seededRun` fixture so each test owns its own throwaway run.
- Reuse `login-as.ts` instead of UI-form driving for role changes; it is faster and less flaky.
- Add page-object helpers only after the second or third flow spec, not before. Right now the surface area is still small enough to keep selectors explicit.
