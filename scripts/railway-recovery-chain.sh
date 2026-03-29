#!/usr/bin/env bash
set -euo pipefail

: "${PLAYWRIGHT_APP_URL:?PLAYWRIGHT_APP_URL is required}"
: "${PLAYWRIGHT_API_URL:?PLAYWRIGHT_API_URL is required}"
: "${AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER:?AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER is required}"
: "${AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD:?AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD is required}"

probe_login_status() {
  node - <<'NODE'
const apiBaseUrl = process.env.PLAYWRIGHT_API_URL
const origin = new URL(process.env.PLAYWRIGHT_APP_URL).origin
const response = await fetch(new URL('/api/session/login', apiBaseUrl), {
  method: 'POST',
  headers: {
    origin,
    'content-type': 'application/json',
    accept: 'application/json',
  },
  body: JSON.stringify({
    identifier: process.env.AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER,
    password: process.env.AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD,
  }),
})
console.log(response.status)
NODE
}

for attempt in $(seq 1 24); do
  status="$(probe_login_status)"
  echo "login-probe-attempt=${attempt} status=${status}"
  if [[ "${status}" == "200" ]]; then
    break
  fi
  if [[ "${attempt}" == "24" ]]; then
    echo "login probe did not recover within the cooldown window" >&2
    exit 1
  fi
  sleep 30
done

gh workflow run deploy-railway-api.yml --ref main
sleep 5

run_id="$(
  gh run list \
    --workflow deploy-railway-api.yml \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId'
)"
echo "railway-run-id=${run_id}"

gh run watch "${run_id}" --exit-status

npm --workspace air-mentor-api run verify:live-session-contract
npm run verify:proof-closure:live
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:teaching-parity
AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:acceptance
node scripts/closeout-stage-02-success.mjs
