#!/usr/bin/env bash
# College demo (2026-04-27): one-command local Vite frontend startup
# pointing at the local seeded backend.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
log_dir="${AIRMENTOR_DEMO_LOG_DIR:-/tmp/airmentor-demo-logs}"
mkdir -p "$log_dir"

export AIRMENTOR_UI_PORT="${AIRMENTOR_UI_PORT:-5173}"
export AIRMENTOR_UI_HOST="${AIRMENTOR_UI_HOST:-127.0.0.1}"
export VITE_AIRMENTOR_API_BASE_URL="${VITE_AIRMENTOR_API_BASE_URL:-http://127.0.0.1:4000}"

cat <<BANNER
============================================================
AirMentor College Demo — Local Frontend
URL:                 http://${AIRMENTOR_UI_HOST}:${AIRMENTOR_UI_PORT}/
API base:            $VITE_AIRMENTOR_API_BASE_URL
Log:                 $log_dir/frontend.log
============================================================
BANNER

if ss -tlnp 2>/dev/null | grep -q ":${AIRMENTOR_UI_PORT}\b"; then
  echo "[demo] port ${AIRMENTOR_UI_PORT} already in use; reusing existing dev server."
  exit 0
fi

cd "$repo_root"
npm run dev -- --host "$AIRMENTOR_UI_HOST" --port "$AIRMENTOR_UI_PORT" 2>&1 | tee "$log_dir/frontend.log"
