#!/usr/bin/env bash
# Demo-day sanity probe: round-trips every seeded role against the local
# backend. Prints a one-line pass/fail per role plus an HTTP status line.
#
# Usage:
#   AIRMENTOR_DEMO_API_URL=http://127.0.0.1:4000 bash scripts/demo-role-smoke.sh
#
# The role credentials come from the seeded backend's SEEDED_ROLE_FIXTURES
# (see `@/home/raed/projects/air-mentor-ui/tests-e2e/helpers/login-as.ts:1-34`).
#
# Pre-requisites:
#   - local backend running on AIRMENTOR_DEMO_API_URL (default
#     http://127.0.0.1:4000) — e.g. via bash scripts/demo-local-tunnel.sh
#   - curl + jq
#
# Exit codes:
#   0 — every role login + session restore + logout round-tripped OK
#   1 — any role failed; inspect the per-role output for the red line

set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required but not in PATH" >&2
  exit 1
fi

api_url="${AIRMENTOR_DEMO_API_URL:-http://127.0.0.1:4000}"
origin="${AIRMENTOR_DEMO_ORIGIN:-http://127.0.0.1:5173}"

roles=(
  "system-admin|sysadmin|admin1234"
  "hod|devika.shetty|faculty1234"
  "course-leader|rohit.menon|faculty1234"
  "mentor|harish.bhat|faculty1234"
)

declare -i failures=0

echo "== AirMentor demo role smoke =="
echo "API   : ${api_url}"
echo "Origin: ${origin}"
echo "-----------------------------------"

if ! curl -sf -m 5 "${api_url}/health" >/dev/null 2>&1; then
  echo "FAIL  health  ${api_url}/health unreachable"
  exit 1
fi
echo "PASS  health  ${api_url}/health"

for entry in "${roles[@]}"; do
  IFS='|' read -r role identifier password <<<"$entry"
  cookiejar="$(mktemp -t amc-${role}-XXX.jar)"

  login_body="$(
    curl -s -c "$cookiejar" -b "$cookiejar" \
      -H 'Content-Type: application/json' \
      -H "Origin: ${origin}" \
      -X POST "${api_url}/api/session/login" \
      -d "{\"identifier\":\"${identifier}\",\"password\":\"${password}\"}" \
      || true
  )"

  if [[ -z "$login_body" ]]; then
    echo "FAIL  ${role}  login POST returned empty body"
    failures+=1
    rm -f "$cookiejar"
    continue
  fi

  csrf="$(printf '%s' "$login_body" | jq -r '.csrfToken // empty')"
  active_role="$(printf '%s' "$login_body" | jq -r '.activeRoleGrant.roleCode // empty')"
  if [[ -z "$csrf" ]]; then
    echo "FAIL  ${role}  login responded without csrfToken: ${login_body:0:200}"
    failures+=1
    rm -f "$cookiejar"
    continue
  fi

  restore_status="$(
    curl -s -o /dev/null -w '%{http_code}' \
      -b "$cookiejar" \
      -H "Origin: ${origin}" \
      "${api_url}/api/session"
  )"
  if [[ "$restore_status" != "200" ]]; then
    echo "FAIL  ${role}  session restore HTTP ${restore_status}"
    failures+=1
    rm -f "$cookiejar"
    continue
  fi

  logout_status="$(
    curl -s -o /dev/null -w '%{http_code}' \
      -b "$cookiejar" \
      -H "Origin: ${origin}" \
      -H "X-AirMentor-CSRF: ${csrf}" \
      -X DELETE "${api_url}/api/session"
  )"
  if [[ "$logout_status" != "200" && "$logout_status" != "204" ]]; then
    echo "FAIL  ${role}  logout HTTP ${logout_status}"
    failures+=1
    rm -f "$cookiejar"
    continue
  fi

  printf 'PASS  %-14s login + restore + logout  (role=%s)\n' "$role" "$active_role"
  rm -f "$cookiejar"
done

echo "-----------------------------------"
if [[ $failures -gt 0 ]]; then
  echo "FAILED: ${failures} role(s) did not round-trip."
  exit 1
fi
echo "PASSED: all 4 seeded roles round-tripped."
