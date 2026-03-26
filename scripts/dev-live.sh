#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/live-admin-common.sh"

ui_port="${AIRMENTOR_UI_PORT:-5173}"
ui_host="${AIRMENTOR_UI_HOST:-127.0.0.1}"
output_dir="${AIRMENTOR_OUTPUT_DIR:-output/live-admin}"
cors_allowed_origins="http://127.0.0.1:${ui_port},http://localhost:${ui_port}"

trap cleanup_live_admin_processes EXIT

start_seeded_api "$cors_allowed_origins" "$output_dir"

echo "Starting live admin development stack..."
echo "Frontend URL: http://${ui_host}:${ui_port}"
echo "Backend URL: $api_base_url"
echo "Backend log: $backend_log"

AIRMENTOR_UI_PROXY_API_TARGET="$api_base_url" \
VITE_AIRMENTOR_API_BASE_URL="/" \
npm exec vite -- --host "$ui_host" --port "$ui_port"
