# AirMentor Final Closeout Evidence 2026-03-28

## What this area does
This document is the dated evidence ledger for the final closeout pass. It records the exact automated commands, deployed URLs, compatibility-route inventory, live rollout blockers, and remaining human-run checks so completion claims stay evidence-backed.

## Automated closeout commands
- Repo-local deterministic suite:
  - `npm run verify:final-closeout`
- Railway deployment preflight:
  - `npm --workspace air-mentor-api run deploy:railway:preflight`
- Live session contract probe:
  - `npm --workspace air-mentor-api run verify:live-session-contract`
- Deployed deterministic suite:
  - `PLAYWRIGHT_APP_URL=https://raed2180416.github.io/AirMentor/ PLAYWRIGHT_API_URL=https://api-production-ab72.up.railway.app AIRMENTOR_LIVE_STACK=1 npm run verify:final-closeout:live`
- Compatibility-route inventory:
  - `npm run inventory:compat-routes`
- Compatibility-route inventory assert mode:
  - `npm run inventory:compat-routes -- --assert-runtime-clean`

## Closeout status snapshot
- Repo-local engineering bar:
  - `PASS`
- Live GitHub Pages browser bar against the deployed Pages + Railway stack:
  - `PASS`
- Live session-security and operational API-closeout bar:
  - `PASS`

## Repo-local deterministic evidence
- `npm run verify:final-closeout`
  - current run status:
    - `PASS`
  - command contents:
    - `npm run lint`
    - `npm run inventory:compat-routes`
    - `npm run verify:proof-closure:proof-rc`
    - `npm run playwright:admin-live:acceptance`
    - `npm run playwright:admin-live:request-flow`
    - `npm run playwright:admin-live:teaching-parity`
    - `npm run playwright:admin-live:accessibility-regression`
    - `npm run playwright:admin-live:keyboard-regression`
    - `npm run playwright:admin-live:session-security`
- `npm run inventory:compat-routes -- --assert-runtime-clean`
  - current run status:
    - `PASS`
- `npm run inventory:compat-routes`
  - current run status:
    - `PASS`
  - generated timestamp:
    - `2026-03-28T18:31:27.841Z`
- `npm run verify:proof-closure:proof-rc`
  - current run status:
    - `PASS`

## 2026-03-29 repo-local rerun note
- The first `2026-03-29` repo-local rerun of `npm run verify:final-closeout` failed only at:
  - `npm run playwright:admin-live:accessibility-regression`
- Root cause:
  - `scripts/system-admin-live-accessibility-regression.mjs` attempted to inspect faculty-detail admin tabs while the browser was still authenticated as an academic portal role.
- Repo-local fix:
  - the accessibility harness now logs out of the academic portal and re-establishes a system-admin session before the faculty-detail tab assertion.
- Post-fix rerun evidence:
  - `npm run playwright:admin-live:accessibility-regression` -> `PASS`
  - `npm run playwright:admin-live:keyboard-regression` -> `PASS`
  - `npm run playwright:admin-live:session-security` -> `PASS`
- Interpretation:
  - the failure was a verification-harness defect, not an application regression.

## 2026-03-29 live rollout recovery note
- Railway production variable fix:
  - an explicit `CSRF_SECRET` was added to the Railway production service and rotated into the GitHub Actions secret `RAILWAY_CSRF_SECRET`
- Recovery deploy:
  - GitHub Actions run `23694196459`
  - created at `2026-03-28T20:58:55Z`
  - head SHA `7295dbe2b5e77994ae84c888731de9ae6fc8bd04`
  - status `completed`
  - conclusion `success`
- Recovery verification:
  - `GET https://api-production-ab72.up.railway.app/health` -> `200 {"ok":true}`
  - `npm --workspace air-mentor-api run verify:live-session-contract` -> `PASS`
  - direct `POST /api/session/login` probe now returns `csrfToken` and sets both `airmentor_session` and `airmentor_csrf`
  - `PLAYWRIGHT_APP_URL=https://raed2180416.github.io/AirMentor/ PLAYWRIGHT_API_URL=https://api-production-ab72.up.railway.app AIRMENTOR_LIVE_STACK=1 npm run verify:final-closeout:live` -> `PASS`
- Interpretation:
  - the live blocker was deployment-environment drift, not missing repo-local CSRF/session code

## Compatibility route inventory summary
- Deprecated compatibility routes still registered:
  - `/api/academic/runtime/:stateKey`
  - `/api/academic/tasks/sync`
  - `/api/academic/task-placements/sync`
  - `/api/academic/calendar-audit/sync`
- `npm run inventory:compat-routes` reports no first-party runtime callers for any of those routes.
- Residual references are limited to:
  - backend compatibility tests
  - the OpenAPI snapshot
  - audit-pack documentation
  - server route registration

## Deployed targets used for closeout
- GitHub Pages frontend:
  - `https://raed2180416.github.io/AirMentor/`
- Railway API:
  - `https://api-production-ab72.up.railway.app`
- Healthcheck:
  - `GET https://api-production-ab72.up.railway.app/health`

## Deployed closeout evidence
- Live command executed:
  - `PLAYWRIGHT_APP_URL=https://raed2180416.github.io/AirMentor/ PLAYWRIGHT_API_URL=https://api-production-ab72.up.railway.app AIRMENTOR_LIVE_STACK=1 npm run verify:final-closeout:live`
- Live command result:
  - `PASS`
- Live browser scripts now emit structured JSON artifacts for the acceptance and request-flow flows, and the Railway deploy workflow now captures `railway up` stdout/stderr while using explicit health-mode verification.
- Live proof/admin browser surfaces that passed against the deployed stack:
  - `npm run verify:proof-closure:live`
  - `AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:acceptance`
  - `AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:request-flow`
  - `AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:teaching-parity`
  - `AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:accessibility-regression`
  - `AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:keyboard-regression`
- Important artifact note:
  - the deployed-run pass results above were recorded from the live closeout run
  - the shared screenshot paths under `output/playwright/` were later refreshed by the repo-local rerun
  - the live failure JSON called out below is the most specific preserved deployed artifact
- Historical failure evidence retained for comparison:
  - `output/playwright/system-admin-live-session-security-failure.json`
  - `output/railway-live-session-contract.json`
  - generated timestamp:
    - `2026-03-28T18:01:04.915Z`
    - `2026-03-28T19:15:55.601Z`
  - historical failing assertion:
    - expected `login.body.csrfToken` to be a string
    - actual deployed response returned `undefined`
- Current live API corroboration after the recovery deploy:
  - `POST https://api-production-ab72.up.railway.app/api/session/login`
  - observed on `2026-03-28T21:01:43Z`:
    - response status `200`
    - session cookie `airmentor_session` present
    - CSRF cookie `airmentor_csrf` present
    - response body now includes `csrfToken`

## Railway deployment evidence
- Latest failed deploy workflow on `main`:
  - GitHub Actions run `23691251599`
  - created at `2026-03-28T18:11:41Z`
  - head SHA `7295dbe2b5e77994ae84c888731de9ae6fc8bd04`
  - status `completed`
  - conclusion `failure`
- Prior failed deploy workflow on `main`:
  - GitHub Actions run `23691073570`
  - created at `2026-03-28T18:01:47Z`
  - head SHA `12637b4c5f469209716696679e701c8e755787cc`
  - status `completed`
  - conclusion `failure`
- Earlier failed deploy workflow before the host-bind fix:
  - GitHub Actions run `23689386538`
  - created at `2026-03-28T16:29:09Z`
  - head SHA `6c030728b3aed2b1f056c629d8420344b7ba38c2`
  - status `completed`
  - conclusion `failure`
- Common failure pattern from `gh run view 23691251599 --log-failed`:
  - image build completed successfully
  - Railway started the `/health` healthcheck
  - healthcheck attempts repeatedly failed with `service unavailable`
  - deploy failed after the retry window
- Current deploy-hardening artifact paths:
  - `output/railway-up.stdout.log`
  - `output/railway-up.stderr.log`
  - `output/railway-live-healthcheck.json`

## Resolved live blocker
- Evidence-backed conclusion:
  - the stale deployed login/session contract was caused by a missing Railway production `CSRF_SECRET`, which prevented the new backend image from becoming healthy
- Confirmed recovery:
  - Railway production now has an explicit `CSRF_SECRET`
  - GitHub Actions run `23694196459` completed successfully
  - the live API now passes `/health`
  - the live login/session contract now returns `csrfToken` and the `airmentor_csrf` cookie
- Operational note:
  - this blocker is closed, but the deploy-readiness diagnostics and session-contract probe should remain part of the release path for future config-drift detection

## Railway prevention checklist
- Before redeploying the Railway API service, confirm the production service variables include:
  - `CSRF_SECRET=<strong-random-secret>`
  - `CORS_ALLOWED_ORIGINS=https://raed2180416.github.io`
  - `SESSION_COOKIE_SECURE=true`
  - `SESSION_COOKIE_SAME_SITE=none`
  - a valid `DATABASE_URL`
- Confirm there is no explicit loopback host override in production:
  - unset `HOST`, or set `HOST=0.0.0.0`
- Confirm the service is listening on Railway's injected `PORT` rather than a hard-coded port.
- Trigger a fresh Railway deployment after the variable audit.
- Watch Railway runtime logs until `/health` returns `200` and the deployment becomes active.
- Rerun the live closeout bar:
  - `PLAYWRIGHT_APP_URL=https://raed2180416.github.io/AirMentor/ PLAYWRIGHT_API_URL=https://api-production-ab72.up.railway.app AIRMENTOR_LIVE_STACK=1 npm run verify:final-closeout:live`
- Direct success indicator for the session contract:
  - `POST /api/session/login` returns `login.body.csrfToken`
  - the response sets both `airmentor_session` and `airmentor_csrf`

## Artifacts produced by the closeout run set
- Current on-disk screenshot/report paths below reflect the most recent repo-local rerun unless they are explicitly labeled as deployed-failure evidence.
- Proof smoke:
  - `output/playwright/system-admin-proof-control-plane.png`
- Admin acceptance:
  - `output/playwright/system-admin-live-acceptance.png`
- Request flow:
  - `output/playwright/system-admin-live-request-flow.png`
- Teaching parity:
  - `output/playwright/system-admin-teaching-parity-smoke.png`
- Accessibility regression:
  - `output/playwright/system-admin-live-accessibility-regression.png`
  - `output/playwright/system-admin-live-accessibility-report.json`
  - `output/playwright/system-admin-live-screen-reader-preflight.md`
- Keyboard regression:
  - `output/playwright/system-admin-live-keyboard-regression.png`
  - `output/playwright/system-admin-live-keyboard-regression-report.json`
- Session security:
  - local pass artifact:
    - `output/playwright/system-admin-live-session-security-report.json`
  - live failure artifact:
    - `output/playwright/system-admin-live-session-security-failure.json`

## Remaining human-run signoff
- Screen-reader pass on critical proof/admin flows
- Product-intent / qualitative UX review of the live proof/admin flows
- Compatibility-route retirement remains blocked until:
  - caller inventory is empty
  - OpenAPI diff is approved
  - two green release cycles complete
