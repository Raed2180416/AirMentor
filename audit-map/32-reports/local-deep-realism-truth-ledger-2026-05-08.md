# Local Deep Realism Truth Ledger — 2026-05-08

## Runtime Target

- Frontend: local Vite app at `http://127.0.0.1:5173`.
- Backend: local Fastify API at `http://127.0.0.1:4000`.
- Hosted GitHub Pages/Railway: deferred for this campaign.

## Verification Rules

A claim is green only when browser, API, code path, and a repeatable command or test agree.

## Current Evidence Index

| Evidence | Path | Status | Notes |
|---|---|---|---|
| Design spec | `docs/superpowers/specs/2026-05-08-local-deep-realism-audit-design.md` | green | Approved local-only campaign scope. |
| Local backend health | `curl -fsS http://127.0.0.1:4000/health` | green | Returned `{"ok":true}` on 2026-05-08. |
| Local frontend health | `curl -fsS -I http://127.0.0.1:5173/` | green | Returned `HTTP/1.1 200 OK` after `bash scripts/demo-start-frontend.sh`. |
| Frontend targeted Vitest | terminal output | green | `tests/system-admin-proof-dashboard-workspace.test.tsx`, `tests/faculty-profile-proof.test.tsx`, `tests/academic-route-pages.test.tsx`: 3 files, 36 tests passed. |
| Backend targeted Vitest | terminal output | green | `proof-control-plane-advance-service`, `proof-control-plane-dashboard-service`, `proof-queue-governance`, `academic-proof-routes`: 4 files, 21 tests passed. |
| Frontend TypeScript | terminal output | green | `npx tsc -p tsconfig.app.json --noEmit --pretty false` exited 0. |
| Backend TypeScript | terminal output | green | `npx tsc -p tsconfig.json --noEmit --pretty false` in `air-mentor-api` exited 0. |
| Playwright runtime harness regression | terminal output | green | `npx vitest run tests/api-url.test.ts tests/playwright-runtime.test.ts --reporter=dot`: 2 files, 6 tests passed. |
| Flow 1 local Firefox E2E | `output/playwright/local-deep-realism/flow-1-nix-local-backend` | green | `flow-1-fresh-start.spec.ts`: 2 tests passed in 3.0m with local frontend `5173` and backend `4000`. |
| Flow 4/6/8 local Firefox E2E | `output/playwright/local-deep-realism/flow-4-6-8-nix-local-backend` | green | `flow-4`, `flow-6`, and `flow-8`: 3 tests passed in 4.2m with local frontend `5173` and backend `4000`. |
| E2E API-base grep | terminal output | green | `grep_search` for direct relative `request.*('/api')` calls returned no results across `tests-e2e`. |
| Flow 2/5/9 local Firefox E2E | `output/playwright/local-deep-realism/flow-2-5-9-10-11-nix-local-backend` | green | Same batch produced 5 passed / 2 failed overall; the passing tests covered `flow-2`, `flow-5`, and `flow-9` while `flow-10`/`flow-11` were root-caused separately. |
| Flow 10/11 local Firefox E2E rerun | `output/playwright/local-deep-realism/flow-10-11-rerun-nix-local-backend` | green | `flow-10-completion-counterfactual.spec.ts` and `flow-11-stop.spec.ts`: 3 tests passed in 6.4m after targeted fixes and backend restart. |
| Stop service regression | terminal output | green | `npx vitest run tests/proof-control-plane-playback-reset-service.test.ts --reporter=dot`: 1 file, 3 tests passed. |

## Current Truth Snapshot

| Area | Verified fact | Evidence | Status |
|---|---|---|---|
| Local target | Local frontend + local backend are the only active targets for this pass. | user instruction + design spec | green |

## Current Code Map — Pass 1

| Surface | Authoritative file(s) | Notes |
|---|---|---|
| Local backend startup | `scripts/demo-start-backend.sh`, `scripts/run-local-backend-for-testing.sh`, `air-mentor-api/scripts/start-seeded-server.ts` | Demo backend starts on `127.0.0.1:4000` with seeded embedded/local Postgres mode and local CORS origins. |
| Local frontend startup | `scripts/demo-start-frontend.sh`, `package.json` scripts `dev`, `dev:local-backend` | Local Vite frontend starts on `127.0.0.1:5173` and points at `http://127.0.0.1:4000`. |
| Proof bootstrap | `scripts/demo-bootstrap-proof.mjs`, `air-mentor-api/src/modules/admin-proof-sandbox.ts` | Script logs in as `sysadmin`, creates/validates/approves proof import, recomputes existing active run if needed, and enqueues an activated run if checkpoints are absent. |
| Admin proof APIs | `air-mentor-api/src/modules/admin-proof-sandbox.ts` | Exposes dashboard, model diagnostics, checkpoints, student detail, imports, crosswalk review, run create/retry/activate/activate-semester/archive/advance/rehydrate/stop/recompute/restore/evidence-timeline. |
| E2E fixture | `tests-e2e/fixtures/seeded-run-fixture.ts` | Playwright fixture logs in system admin, rehydrates proof faculty credentials, creates a deterministic fresh proof run, waits for materialization, activates it, activates semester 1, and archives it after use. |
| E2E specs | `tests-e2e/specs/*.spec.ts` | Current flow suite covers fresh start, evidence reaction, next day, boundary crossing, next stage auto-resolve, reopen, HoD cycle, completion/counterfactual, stop, labels, interventions, carryover, receptivity, and smoke. |
| Playwright runtime | `tests-e2e/playwright.config.ts`, `tests-e2e/support/playwright-runtime.ts`, `flake.nix` | Config defaults to Firefox, local frontend/API bases, single worker, retained trace/screenshot on failure, optional Nix-provided browser executable, and webServer bootstrap unless reuse/skip env is set. |
| Nix Playwright helpers | `scripts/playwright-smoke.sh`, `scripts/playwright-firefox-acceptance.sh`, `flake.nix` | Shell scripts recurse into `nix develop` when `playwright` is missing; flake includes `playwright-test` and announces wrapped runtime. |
| Sysadmin proof UI | `src/system-admin-proof-dashboard-workspace.tsx`, `src/proof-simulation-controls.tsx` | UI receives proof dashboard state and exposes create, stop, next stage, next day, previous day, previous stage, reset stage, reset proof run, playback jump/reset, and recompute risk. |
| HoD counterfactual UI | `src/hod-counterfactual-panel.tsx` | Current component compares baseline and realized runs via `loadReport`; wording still references flag-off/flag-on trajectories and must be checked against the newer HoD simulator flow in Pass 2/5. |

## Stale or Risky Prior Claims

| Claim | Source | Risk | New verification needed |
|---|---|---|---|
| GitHub Pages fallback is a target | older demo docs | stale | Ignore for current pass; local only. |

## Flow Matrix

| Flow | Browser proof | API proof | Code path | Result | Evidence path |
|---|---|---|---|---|---|
| Sysadmin login | green | green | `tests-e2e/helpers/login-as.ts`, `tests-e2e/helpers/api-url.ts` | pass | `output/playwright/local-deep-realism/flow-1-nix-local-backend` |
| Proof bootstrap/create/activate | green | green | `tests-e2e/fixtures/seeded-run-fixture.ts` | pass for Flow 1/4/6/8 fixture path | `output/playwright/local-deep-realism/flow-1-nix-local-backend`, `output/playwright/local-deep-realism/flow-4-6-8-nix-local-backend` |
| Course Leader login | green | green | `tests-e2e/specs/flow-1-fresh-start.spec.ts` | pass | `output/playwright/local-deep-realism/flow-1-nix-local-backend` |
| Mentor login | green | green | `tests-e2e/specs/flow-1-fresh-start.spec.ts` | pass | `output/playwright/local-deep-realism/flow-1-nix-local-backend` |
| HoD analytics/counterfactual | green | green | `tests-e2e/specs/flow-1-fresh-start.spec.ts`, `src/hod-counterfactual-panel.tsx` | pass for tab visibility only | `output/playwright/local-deep-realism/flow-1-nix-local-backend` |
| Next Day / Next Stage | green | green | `tests-e2e/specs/flow-4-scheduled-nextday.spec.ts`, `tests-e2e/specs/flow-6-nextstage-autoresolve.spec.ts`, `tests-e2e/specs/flow-8-reopen.spec.ts` | pass | `output/playwright/local-deep-realism/flow-4-6-8-nix-local-backend` |
| Evidence reaction | green | green | `tests-e2e/specs/flow-2-evidence-reaction.spec.ts` | pass | `output/playwright/local-deep-realism/flow-2-5-9-10-11-nix-local-backend` |
| Boundary crossing | green | green | `tests-e2e/specs/flow-5-boundary-cross.spec.ts` | pass | `output/playwright/local-deep-realism/flow-2-5-9-10-11-nix-local-backend` |
| HoD correction cycle | green | green | `tests-e2e/specs/flow-9-hod-cycle.spec.ts` | pass | `output/playwright/local-deep-realism/flow-2-5-9-10-11-nix-local-backend` |
| Counterfactual simulator | green | green | `tests-e2e/specs/flow-10-completion-counterfactual.spec.ts` | pass after explicit proof-bundle wait | `output/playwright/local-deep-realism/flow-10-11-rerun-nix-local-backend` |
| Stop simulation | green | green | `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts`, `tests-e2e/specs/flow-11-stop.spec.ts` | pass after restoring credential/session sweep | `output/playwright/local-deep-realism/flow-10-11-rerun-nix-local-backend` |
| Attendance edit recompute | pending | pending | pending | pending | pending |
| Marks edit recompute | pending | pending | pending | pending | pending |
| Timetable/calendar interaction | pending | pending | pending | pending | pending |
| Stage evidence gating | pending | pending | pending | pending | pending |

## Findings

### Finding 1 — Nix Playwright runner and repo Playwright runtime were split

- Flow: Flow 1 local Firefox E2E.
- Browser evidence: first run under `output/playwright/local-deep-realism/flow-1` failed before app launch.
- Error: local `npx playwright` expected `/home/raed/.cache/ms-playwright/firefox-1511/firefox/firefox`; Nix wrapper provided Playwright `1.57.0` with browser bundle revision `firefox-1497`.
- Root cause: command used local npm runner and browser metadata while the environment browser bundle came from Nix.
- Fix: use Nix `playwright` runner and allow `tests-e2e/support/playwright-runtime.ts` to unwrap explicit CJS/default Playwright runtime modules via `PLAYWRIGHT_TEST_IMPORT`.
- Verification: `npx vitest run tests/playwright-runtime.test.ts --reporter=dot` passed 3 tests; rerun reached API fixture instead of browser-launch failure.

### Finding 2 — E2E API fixture assumed frontend `/api` proxy

- Flow: Flow 1 local Firefox E2E.
- Browser evidence: `output/playwright/local-deep-realism/flow-1-nix-single-runtime` failed in `loginWithApiContext`.
- API evidence: `POST http://127.0.0.1:5173/api/session/login` returned `404`; direct `POST http://127.0.0.1:4000/api/session/login` returned `200`.
- Root cause: `scripts/demo-start-frontend.sh` launches Vite with absolute API base and no `/api` proxy, while Playwright `request` used frontend base for relative `/api` URLs.
- Fix: add `tests-e2e/helpers/api-url.ts` and route fixture/login/core E2E API calls through `AIRMENTOR_PW_API_BASE_URL`.
- Verification: `npx vitest run tests/api-url.test.ts --reporter=dot` passed 3 tests; Flow 1 local Firefox passed 2 tests; Flow 4/6/8 local Firefox passed 3 tests.

### Finding 3 — HoD counterfactual UI test raced slow local proof-bundle response

- Flow: Flow 10 local Firefox E2E.
- Evidence: `output/playwright/local-deep-realism/flow-2-5-9-10-11-nix-local-backend/flow-10-completion-counter-b3ca7-sed-analytics-without-error/trace.zip`.
- Root cause: local `/api/academic/hod/proof-bundle` responses can take about 31s in the seeded proof dataset; the test asserted `[data-proof-surface="hod-proof-analytics"]` with a 30s locator timeout and failed while the UI was still showing `Loading live HoD proof analytics...`.
- Fix: wait for the concrete `proof-bundle` 200 response with a 75s timeout before asserting the HoD surface and counterfactual tab.
- Verification: `flow-10-completion-counterfactual.spec.ts` passed in the `flow-10-11-rerun-nix-local-backend` rerun.

### Finding 4 — Stop service marked runs stopped but skipped credential/session sweep

- Flow: Flow 11 local Firefox E2E.
- Evidence: initial batch failed because `POST /api/session/login` for `devika.shetty` still returned a live `activeRoleGrant` after `/api/admin/proof-runs/:runId/stop`.
- Root cause: `stopProofSimulationRun` in `proof-control-plane-playback-reset-service.ts` updated run lifecycle but returned `deletedCredentialCount: 0` and did not call `deleteProofCredentials` or `invalidateProofBatchSessions`.
- Fix: restore the stop-path calls to proof credential deletion and proof batch session invalidation; update the backend unit regression to require those calls and the deleted credential count.
- Verification: `npx vitest run tests/proof-control-plane-playback-reset-service.test.ts --reporter=dot` passed 3 tests; `flow-11-stop.spec.ts` passed in the `flow-10-11-rerun-nix-local-backend` rerun.

## Fix Queue

| Priority | Finding | Root cause | Proposed fix | Status |
|---|---|---|---|---|
| P1 | Nix Playwright runtime split | local `npx` runner and Nix browser bundle version mismatch | single Nix runner/import/browser bundle | fixed |
| P1 | E2E API 404 against local frontend | Playwright relative API calls hit Vite without proxy | `apiPath()` using `AIRMENTOR_PW_API_BASE_URL` | fixed for core Flow 1/2/4/5/6/8/9/10/11 harness |

## Commands Run

- `curl -fsS http://127.0.0.1:4000/health`: returned `{"ok":true}`.
- `curl -fsS -I http://127.0.0.1:5173/`: initially connection refused; after `bash scripts/demo-start-frontend.sh`, returned `HTTP/1.1 200 OK`.
- `bash scripts/demo-start-frontend.sh`: started Vite on `http://127.0.0.1:5173/`; background command id `158`; log `/tmp/airmentor-demo-logs/frontend.log`.
- `npx vitest run tests/system-admin-proof-dashboard-workspace.test.tsx tests/faculty-profile-proof.test.tsx tests/academic-route-pages.test.tsx --reporter=dot`: 3 files passed, 36 tests passed.
- `npx vitest run tests/proof-control-plane-advance-service.test.ts tests/proof-control-plane-dashboard-service.test.ts tests/proof-queue-governance.test.ts tests/academic-proof-routes.test.ts --reporter=dot` in `air-mentor-api`: 4 files passed, 21 tests passed.
- `npx tsc -p tsconfig.app.json --noEmit --pretty false`: exited 0.
- `npx tsc -p tsconfig.json --noEmit --pretty false` in `air-mentor-api`: exited 0.
- `AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_REUSE_SERVER=1 ... npx playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/flow-1-fresh-start.spec.ts`: failed before launch because local Playwright expected missing `firefox-1511`.
- `nix develop -c playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/flow-1-fresh-start.spec.ts`: failed with split runtime error until `PLAYWRIGHT_TEST_IMPORT` was pointed at the same Nix package and the runtime loader unwrapped CJS/default exports.
- `POST http://127.0.0.1:5173/api/session/login`: returned 404; `POST http://127.0.0.1:4000/api/session/login`: returned 200, proving the local frontend lacked the proxy assumed by relative E2E API calls.
- `npx vitest run tests/api-url.test.ts tests/playwright-runtime.test.ts --reporter=dot`: 2 files passed, 6 tests passed.
- `nix develop -c bash -lc 'source scripts/playwright-browser-common.sh; export PLAYWRIGHT_BROWSERS_PATH="$(resolve_playwright_browsers_path)"; export PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js; export AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4000 AIRMENTOR_PW_DISABLE_VIDEO=1; playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/flow-1-fresh-start.spec.ts --reporter=line --output=output/playwright/local-deep-realism/flow-1-nix-local-backend'`: 2 tests passed in 3.0m.
- `grep_search` for direct relative `request.*('/api')` calls across `tests-e2e`: no results after `apiPath()` harness expansion.
- `ss -ltnp '( sport = :4000 or sport = :5173 )' || true`: local backend and frontend were listening on `127.0.0.1:4000` and `127.0.0.1:5173`.
- `nix develop -c bash -lc 'source scripts/playwright-browser-common.sh; export PLAYWRIGHT_BROWSERS_PATH="$(resolve_playwright_browsers_path)"; export PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js; export AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4000 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox; playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/flow-4-scheduled-nextday.spec.ts tests-e2e/specs/flow-6-nextstage-autoresolve.spec.ts tests-e2e/specs/flow-8-reopen.spec.ts --reporter=line --output=output/playwright/local-deep-realism/flow-4-6-8-nix-local-backend'`: 3 tests passed in 4.2m.
- `nix develop -c bash -lc 'source scripts/playwright-browser-common.sh; export PLAYWRIGHT_BROWSERS_PATH="$(resolve_playwright_browsers_path)"; export PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js; export AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4000 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox; playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/flow-2-evidence-reaction.spec.ts tests-e2e/specs/flow-5-boundary-cross.spec.ts tests-e2e/specs/flow-9-hod-cycle.spec.ts tests-e2e/specs/flow-10-completion-counterfactual.spec.ts tests-e2e/specs/flow-11-stop.spec.ts --reporter=line --output=output/playwright/local-deep-realism/flow-2-5-9-10-11-nix-local-backend'`: 5 tests passed and 2 tests failed in 12.1m; `flow-10` and `flow-11` failures were root-caused in Findings 3 and 4.
- `npx vitest run tests/proof-control-plane-playback-reset-service.test.ts --reporter=dot` in `air-mentor-api`: 1 file passed, 3 tests passed after the stop-service credential/session sweep fix.
- `kill 11384 11432 2>/dev/null || true; npm run backend:dev:seeded`: restarted the seeded backend so the local `4000` process loaded the stop-service fix.
- `nix develop -c bash -lc 'source scripts/playwright-browser-common.sh; export PLAYWRIGHT_BROWSERS_PATH="$(resolve_playwright_browsers_path)"; export PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js; export AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4000 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox; playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/flow-10-completion-counterfactual.spec.ts tests-e2e/specs/flow-11-stop.spec.ts --reporter=line --output=output/playwright/local-deep-realism/flow-10-11-rerun-nix-local-backend'`: 3 tests passed in 6.4m.
