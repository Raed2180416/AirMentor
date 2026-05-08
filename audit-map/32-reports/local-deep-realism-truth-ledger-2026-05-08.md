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
| Sysadmin login | pending | pending | pending | pending | pending |
| Proof bootstrap/create/activate | pending | pending | pending | pending | pending |
| Course Leader login | pending | pending | pending | pending | pending |
| Mentor login | pending | pending | pending | pending | pending |
| HoD analytics/counterfactual | pending | pending | pending | pending | pending |
| Next Day / Previous Day / Next Stage | pending | pending | pending | pending | pending |
| Attendance edit recompute | pending | pending | pending | pending | pending |
| Marks edit recompute | pending | pending | pending | pending | pending |
| Timetable/calendar interaction | pending | pending | pending | pending | pending |
| Stage evidence gating | pending | pending | pending | pending | pending |

## Findings

No findings yet.

## Fix Queue

| Priority | Finding | Root cause | Proposed fix | Status |
|---|---|---|---|---|

## Commands Run

- `curl -fsS http://127.0.0.1:4000/health`: returned `{"ok":true}`.
- `curl -fsS -I http://127.0.0.1:5173/`: initially connection refused; after `bash scripts/demo-start-frontend.sh`, returned `HTTP/1.1 200 OK`.
- `bash scripts/demo-start-frontend.sh`: started Vite on `http://127.0.0.1:5173/`; background command id `158`; log `/tmp/airmentor-demo-logs/frontend.log`.
- `npx vitest run tests/system-admin-proof-dashboard-workspace.test.tsx tests/faculty-profile-proof.test.tsx tests/academic-route-pages.test.tsx --reporter=dot`: 3 files passed, 36 tests passed.
- `npx vitest run tests/proof-control-plane-advance-service.test.ts tests/proof-control-plane-dashboard-service.test.ts tests/proof-queue-governance.test.ts tests/academic-proof-routes.test.ts --reporter=dot` in `air-mentor-api`: 4 files passed, 21 tests passed.
- `npx tsc -p tsconfig.app.json --noEmit --pretty false`: exited 0.
- `npx tsc -p tsconfig.json --noEmit --pretty false` in `air-mentor-api`: exited 0.
