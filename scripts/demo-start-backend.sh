#!/usr/bin/env bash
# College demo (2026-04-27): one-command local backend startup.
# Boots the seeded backend on 127.0.0.1:4000 with embedded Postgres,
# allows the GitHub Pages origin in CORS, and prints a status banner
# the presenter can read aloud.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
log_dir="${AIRMENTOR_DEMO_LOG_DIR:-/tmp/airmentor-demo-logs}"
mkdir -p "$log_dir"

export AIRMENTOR_API_PORT="${AIRMENTOR_API_PORT:-4000}"
export HOST="${HOST:-127.0.0.1}"
export AIRMENTOR_LOCAL_BACKEND_MODE="${AIRMENTOR_LOCAL_BACKEND_MODE:-seeded}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173,https://raed2180416.github.io}"

cat <<BANNER
============================================================
AirMentor College Demo — Local Backend
Mode:                $AIRMENTOR_LOCAL_BACKEND_MODE (embedded Postgres, ephemeral)
Port:                http://${HOST}:${AIRMENTOR_API_PORT}
Health:              http://${HOST}:${AIRMENTOR_API_PORT}/health
Allowed origins:     $CORS_ALLOWED_ORIGINS
Log:                 $log_dir/backend.log
Demo data is LOCAL-ONLY. Restart wipes proof runs.
============================================================
BANNER

# If port already taken, refuse and tell the presenter.
if ss -tlnp 2>/dev/null | grep -q ":${AIRMENTOR_API_PORT}\b"; then
  echo "[demo] port ${AIRMENTOR_API_PORT} is already in use." >&2
  echo "[demo] either keep using the running backend, or run:" >&2
  echo "        lsof -ti :${AIRMENTOR_API_PORT} | xargs -r kill -9" >&2
  echo "       and re-run this script." >&2
  echo "[demo] checking health on existing process..." >&2
  if curl -fsS -m 3 "http://${HOST}:${AIRMENTOR_API_PORT}/health" >/dev/null 2>&1; then
    echo "[demo] existing backend is healthy. continuing without restart." >&2
    exit 0
  fi
  exit 1
fi

cd "$repo_root"

# Background the seeded backend; tee logs to file.
( bash scripts/run-local-backend-for-testing.sh > "$log_dir/backend.log" 2>&1 ) &
backend_pid=$!
echo "[demo] backend pid=${backend_pid} log=$log_dir/backend.log"

# Wait up to 90s for /health to come up.
for attempt in $(seq 1 90); do
  if curl -fsS -m 2 "http://${HOST}:${AIRMENTOR_API_PORT}/health" >/dev/null 2>&1; then
    echo "[demo] backend ready after ${attempt}s"
    break
  fi
  sleep 1
done

if ! curl -fsS -m 2 "http://${HOST}:${AIRMENTOR_API_PORT}/health" >/dev/null 2>&1; then
  echo "[demo] backend did NOT become healthy in 90s. tail of log:" >&2
  tail -50 "$log_dir/backend.log" >&2
  exit 1
fi

cat <<NEXT

============================================================
Backend healthy. Next steps:

1. In a second terminal:
     bash scripts/demo-start-frontend.sh
   (or:  npm run dev:local-backend)

2. Open the demo browser:
     http://127.0.0.1:5173/

3. To bootstrap an active proof run if missing, run:
     node scripts/demo-bootstrap-proof.mjs
   (the proof dashboard's "Create / Run Simulation" button does the
   same thing through the browser.)
============================================================
NEXT
