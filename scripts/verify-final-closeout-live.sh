#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PLAYWRIGHT_APP_URL:-}" ]]; then
  echo "PLAYWRIGHT_APP_URL is required for live closeout verification." >&2
  exit 1
fi

if [[ -z "${PLAYWRIGHT_API_URL:-}" ]]; then
  echo "PLAYWRIGHT_API_URL is required for live closeout verification." >&2
  exit 1
fi

npm run inventory:compat-routes
npm run verify:proof-closure:live
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:acceptance
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:request-flow
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:teaching-parity
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:accessibility-regression
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:keyboard-regression
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:session-security
