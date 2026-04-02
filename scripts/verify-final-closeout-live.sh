#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/live-admin-common.sh"

if [[ -z "${PLAYWRIGHT_APP_URL:-}" ]]; then
  echo "PLAYWRIGHT_APP_URL is required for live closeout verification." >&2
  exit 1
fi

if [[ -z "${PLAYWRIGHT_API_URL:-}" ]]; then
  echo "PLAYWRIGHT_API_URL is required for live closeout verification." >&2
  exit 1
fi

AIRMENTOR_LIVE_STACK=1
ensure_system_admin_live_credentials

frontend_origin="$(node -e "console.log(new URL(process.env.PLAYWRIGHT_APP_URL).origin)")"

npm run inventory:compat-routes -- --assert-runtime-clean
if [[ -n "${RAILWAY_VARIABLES_JSON:-}" || ( -n "${RAILWAY_TOKEN:-}" && -n "${RAILWAY_SERVICE:-}" ) ]]; then
  echo "Running Railway deploy preflight before live closeout verification..."
  sync_railway_service_vars="${SYNC_RAILWAY_SERVICE_VARS:-}"
  if [[ -z "$sync_railway_service_vars" && -n "${RAILWAY_CSRF_SECRET:-}" ]]; then
    sync_railway_service_vars="true"
  fi
  RAILWAY_PUBLIC_API_URL="$PLAYWRIGHT_API_URL" \
  EXPECTED_FRONTEND_ORIGIN="$frontend_origin" \
  SYNC_RAILWAY_SERVICE_VARS="$sync_railway_service_vars" \
  npm --workspace air-mentor-api run deploy:railway:preflight
else
  echo "Skipping Railway deploy preflight because Railway auth/context is not configured."
fi
RAILWAY_PUBLIC_API_URL="$PLAYWRIGHT_API_URL" \
EXPECTED_FRONTEND_ORIGIN="$frontend_origin" \
AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER="$AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER" \
AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD="$AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD" \
npm --workspace air-mentor-api run verify:live-session-contract
if [[ "${SKIP_PROOF_CLOSURE_LIVE:-}" != "1" ]]; then
  AIRMENTOR_LIVE_STACK=1 npm run verify:proof-closure:live
else
  echo "Skipping duplicate proof-closure live smoke because semester-walk verification already covers it."
fi
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:acceptance
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:request-flow
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:teaching-parity
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:accessibility-regression
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:keyboard-regression
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:session-security
