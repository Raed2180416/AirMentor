#!/usr/bin/env bash
set -euo pipefail

if ! command -v playwright >/dev/null 2>&1; then
  if [[ "${AIRMENTOR_NIX_PLAYWRIGHT:-0}" == "1" ]]; then
    echo "playwright is still unavailable inside nix develop" >&2
    exit 1
  fi

  exec env AIRMENTOR_NIX_PLAYWRIGHT=1 nix develop -c bash "$0" "$@"
fi

source "$(cd "$(dirname "$0")" && pwd)/live-admin-common.sh"

ui_port="${AIRMENTOR_UI_PORT:-4173}"
ui_host="${AIRMENTOR_UI_HOST:-127.0.0.1}"
app_url="${PLAYWRIGHT_APP_URL:-http://${ui_host}:${ui_port}}"
output_dir="${PLAYWRIGHT_OUTPUT_DIR:-output/playwright}"
preview_log="$output_dir/system-admin-live-teaching-preview.log"
preview_pid=""
playwright_root=$(cd "$(dirname "$(command -v playwright)")/.." && pwd)
playwright_browsers_path="${PLAYWRIGHT_BROWSERS_PATH:-$(ls -d /nix/store/*playwright-browsers 2>/dev/null | LC_ALL=C sort | head -n 1)}"
cors_allowed_origins="http://127.0.0.1:${ui_port},http://localhost:${ui_port}"

if [[ -z "$playwright_browsers_path" ]]; then
  echo "Unable to resolve a Playwright browsers bundle inside the current environment." >&2
  exit 1
fi

cleanup() {
  if [[ -n "$preview_pid" ]]; then
    kill "$preview_pid" >/dev/null 2>&1 || true
    wait "$preview_pid" >/dev/null 2>&1 || true
  fi
  cleanup_live_admin_processes
}

trap cleanup EXIT

start_seeded_api "$cors_allowed_origins" "$output_dir"

mkdir -p "$output_dir"
VITE_AIRMENTOR_API_BASE_URL="$api_base_url" npm run build >/dev/null
npm run preview -- --host "$ui_host" --port "$ui_port" >"$preview_log" 2>&1 &
preview_pid=$!

if ! wait_for_http_ok "$app_url" 45; then
  echo "Preview server did not become ready. Log: $preview_log" >&2
  cat "$preview_log" >&2
  exit 1
fi

echo "Running sysadmin -> teaching parity smoke..."
echo "Frontend URL: $app_url"
echo "Backend URL: $api_base_url"
echo "Backend log: $backend_log"
echo "Preview log: $preview_log"

PLAYWRIGHT_APP_URL="$app_url" \
PLAYWRIGHT_ROOT="$playwright_root" \
PLAYWRIGHT_BROWSERS_PATH="$playwright_browsers_path" \
PLAYWRIGHT_OUTPUT_DIR="$output_dir" \
node scripts/system-admin-teaching-parity-smoke.mjs
