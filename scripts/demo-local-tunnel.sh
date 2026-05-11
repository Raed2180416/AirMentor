#!/usr/bin/env bash
# Demo-mode tunnel: expose local backend to GitHub Pages via ngrok HTTPS.
#
# For the production deploy, Pages points at Railway. For the demo-day
# presentation, we keep everything on the presenter's local machine and
# expose the local backend through an ngrok HTTPS tunnel so the already-
# deployed Pages frontend can call it cross-origin.
#
# Usage:
#   bash scripts/demo-local-tunnel.sh
#
# What it does:
#   1. Boots the seeded local backend on 127.0.0.1:4000 with Pages cross-
#      origin cookie posture (SameSite=None; Secure; CSRF_SECRET set).
#   2. Starts an ngrok HTTPS tunnel pointing at that local port.
#   3. Prints the public tunnel URL plus the GitHub Actions variable that
#      must be flipped to point Pages at it:
#         VITE_AIRMENTOR_API_BASE_URL=<tunnel-url>
#   4. Also prints a vite-dev-only equivalent URL in case the presenter
#      wants to run the frontend locally at localhost:5173 pointed at the
#      same tunnel (useful for smoke tests).
#
# When the presenter is done, Ctrl+C shuts down both processes cleanly.
#
# Prerequisites:
#   - ngrok CLI installed + authtoken configured (`ngrok config add-authtoken`)
#   - /home/raed/.config/ngrok/ngrok.yml valid (checked automatically)
#   - Local DB seeded; AIRMENTOR_SEED_NOW is pinned to the demo window
#
# Non-goals:
#   - This script does NOT redeploy Pages. After the tunnel URL is printed,
#     flip the repo variable at
#       https://github.com/Raed2180416/AirMentor/settings/variables/actions
#     and trigger a Pages redeploy. For rapid demo iteration, prefer running
#     `npm run dev:local-backend` at localhost:5173 with the vite proxy.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok CLI not found in PATH." >&2
  exit 1
fi
if ! ngrok config check >/dev/null 2>&1; then
  echo "ngrok config invalid. Run: ngrok config add-authtoken <token>" >&2
  exit 1
fi

pages_origin="${AIRMENTOR_DEMO_PAGES_ORIGIN:-https://raed2180416.github.io}"
api_port="${AIRMENTOR_API_PORT:-4000}"
seed_now="${AIRMENTOR_SEED_NOW:-2026-03-16T00:00:00Z}"
cors_origins="${AIRMENTOR_DEMO_CORS_ORIGINS:-$pages_origin,http://127.0.0.1:5173,http://localhost:5173}"
csrf_secret="${AIRMENTOR_DEMO_CSRF_SECRET:-airmentor-demo-$(date +%s)-csrf}"

backend_log="$repo_root/output/demo-backend.log"
tunnel_log="$repo_root/output/demo-tunnel.log"
mkdir -p "$repo_root/output"

cleanup() {
  echo
  echo "[demo-tunnel] shutting down..."
  if [[ -n "${BACKEND_PID:-}" ]]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [[ -n "${TUNNEL_PID:-}" ]]; then kill "$TUNNEL_PID" 2>/dev/null || true; fi
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "[demo-tunnel] starting seeded backend on 127.0.0.1:${api_port}..."
(
  cd "$repo_root"
  AIRMENTOR_API_PORT="$api_port" \
  HOST="127.0.0.1" \
  CORS_ALLOWED_ORIGINS="$cors_origins" \
  SESSION_COOKIE_SAME_SITE="none" \
  SESSION_COOKIE_SECURE="true" \
  CSRF_SECRET="$csrf_secret" \
  AIRMENTOR_SEED_NOW="$seed_now" \
  AIRMENTOR_STAGE_REALIZATION_V1="1" \
  AIRMENTOR_SECTION_OVERRIDES_V1="1" \
  npm --workspace air-mentor-api run dev:seeded \
    >"$backend_log" 2>&1 &
  echo $! > "$repo_root/output/demo-backend.pid"
)
BACKEND_PID="$(cat "$repo_root/output/demo-backend.pid")"

# Wait for backend health (up to 90s).
echo "[demo-tunnel] waiting for backend health..."
attempts=0
until curl -sf "http://127.0.0.1:${api_port}/health" >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [[ $attempts -ge 90 ]]; then
    echo "[demo-tunnel] backend did not become healthy within 90s. Inspect $backend_log" >&2
    exit 1
  fi
  sleep 1
done
echo "[demo-tunnel] backend healthy."

echo "[demo-tunnel] starting ngrok HTTPS tunnel -> 127.0.0.1:${api_port}..."
ngrok http --log=stdout --log-format=json --log-level=info "127.0.0.1:${api_port}" \
  > "$tunnel_log" 2>&1 &
TUNNEL_PID=$!

# Poll ngrok's local API for the public HTTPS URL (up to 30s).
tunnel_url=""
for _ in $(seq 1 30); do
  tunnel_url="$(curl -sf http://127.0.0.1:4040/api/tunnels 2>/dev/null | \
    python3 -c 'import json,sys
try:
    tunnels = json.load(sys.stdin).get("tunnels", [])
    https = [t for t in tunnels if t.get("public_url", "").startswith("https://")]
    print(https[0]["public_url"] if https else "", end="")
except Exception:
    pass' 2>/dev/null || echo '')"
  if [[ -n "$tunnel_url" ]]; then break; fi
  sleep 1
done

if [[ -z "$tunnel_url" ]]; then
  echo "[demo-tunnel] could not resolve ngrok public URL. Inspect $tunnel_log" >&2
  exit 1
fi

cat <<EOF

==============================================================================
  AIRMENTOR DEMO TUNNEL READY
==============================================================================

  Backend            : http://127.0.0.1:${api_port}  (seeded, flag-on)
  Tunnel URL (HTTPS) : ${tunnel_url}
  Pages origin       : ${pages_origin}

  Backend log        : ${backend_log}
  Tunnel log         : ${tunnel_log}

  To make the live Pages site call this local backend, set:

      VITE_AIRMENTOR_API_BASE_URL=${tunnel_url}

  at https://github.com/Raed2180416/AirMentor/settings/variables/actions
  and trigger the Deploy-to-GitHub-Pages workflow.

  For local-only frontend iteration (no Pages deploy needed), run:

      VITE_AIRMENTOR_API_BASE_URL=${tunnel_url} npm run dev

  and open http://127.0.0.1:5173

  Press Ctrl+C to stop the tunnel and backend.
==============================================================================

EOF

# Block until Ctrl+C.
wait "$BACKEND_PID" "$TUNNEL_PID"
