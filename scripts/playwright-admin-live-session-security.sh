#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/live-admin-common.sh"

pick_ui_port() {
  local preferred_port="$1"
  node - "$preferred_port" <<'NODE'
const net = require('node:net')

const preferredPort = Number(process.argv[2] || '4173')

function portAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

;(async () => {
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    if (await portAvailable(port)) {
      process.stdout.write(String(port))
      return
    }
  }
  process.exit(1)
})().catch(() => process.exit(1))
NODE
}

ui_port="${AIRMENTOR_UI_PORT:-$(pick_ui_port 4173)}"
ui_host="${AIRMENTOR_UI_HOST:-127.0.0.1}"
app_url="${PLAYWRIGHT_APP_URL:-http://${ui_host}:${ui_port}}"
output_dir="${PLAYWRIGHT_OUTPUT_DIR:-output/playwright}"
live_stack_mode="${AIRMENTOR_LIVE_STACK:-0}"
preview_log="$output_dir/system-admin-session-security-preview.log"
preview_pid=""
cors_allowed_origins="http://127.0.0.1:${ui_port},http://localhost:${ui_port}"

cleanup() {
  if [[ -n "$preview_pid" ]]; then
    kill "$preview_pid" >/dev/null 2>&1 || true
    wait "$preview_pid" >/dev/null 2>&1 || true
  fi
  cleanup_live_admin_processes
}

trap cleanup EXIT

mkdir -p "$output_dir"

if [[ "$live_stack_mode" == "1" ]]; then
  api_base_url="${PLAYWRIGHT_API_URL:-}"
  if [[ -z "$api_base_url" ]]; then
    echo "PLAYWRIGHT_API_URL is required when AIRMENTOR_LIVE_STACK=1" >&2
    exit 1
  fi
  if ! wait_for_http_ok "$app_url" 45; then
    echo "Live app URL did not become ready: $app_url" >&2
    exit 1
  fi
  if ! wait_for_http_ok "${api_base_url%/}/health" 45; then
    echo "Live API healthcheck failed: ${api_base_url%/}/health" >&2
    exit 1
  fi
else
  start_seeded_api "$cors_allowed_origins" "$output_dir"

  AIRMENTOR_UI_PROXY_API_TARGET="$api_base_url" \
  VITE_AIRMENTOR_API_BASE_URL="/" \
  npm run build >/dev/null
  AIRMENTOR_UI_PROXY_API_TARGET="$api_base_url" \
  VITE_AIRMENTOR_API_BASE_URL="/" \
  npm run preview -- --host "$ui_host" --port "$ui_port" --strictPort >"$preview_log" 2>&1 &
  preview_pid=$!

  if ! wait_for_http_ok "$app_url" 45; then
    echo "Preview server did not become ready. Log: $preview_log" >&2
    cat "$preview_log" >&2
    exit 1
  fi
fi

echo "Running session security smoke..."
echo "Frontend URL: $app_url"
echo "Backend URL: $api_base_url"
if [[ "$live_stack_mode" != "1" ]]; then
  echo "Backend log: $backend_log"
  echo "Preview log: $preview_log"
fi

PLAYWRIGHT_APP_URL="$app_url" \
PLAYWRIGHT_API_URL="$api_base_url" \
PLAYWRIGHT_OUTPUT_DIR="$output_dir" \
node scripts/system-admin-live-session-security.mjs
