# AirMentor Final Closeout Evidence 2026-03-28

## What this area does
This document is the dated evidence ledger for the final closeout pass. It records the exact automated commands, deployed URLs, compatibility-route inventory, and remaining human-run checks so completion claims stay evidence-backed.

## Automated closeout commands
- Repo-local deterministic suite:
  - `npm run verify:final-closeout`
- Deployed deterministic suite:
  - `PLAYWRIGHT_APP_URL=https://raed2180416.github.io/AirMentor/ PLAYWRIGHT_API_URL=https://api-production-ab72.up.railway.app npm run verify:final-closeout:live`
- Compatibility-route inventory:
  - `npm run inventory:compat-routes`

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

## Pending evidence fill-in
- Record the exact pass/fail results from:
  - `npm run verify:final-closeout`
  - `npm run verify:final-closeout:live`
  - `npm run inventory:compat-routes`
- Record the output artifact locations for:
  - proof smoke
  - admin acceptance
  - request flow
  - teaching parity
  - accessibility regression
  - keyboard regression
  - session security smoke

## Remaining human-run signoff
- Screen-reader pass on critical proof/admin flows
- Final deployed cookie/origin/CSRF validation review
- Compatibility-route retirement remains blocked until:
  - caller inventory is empty
  - OpenAPI diff is approved
  - two green release cycles complete
