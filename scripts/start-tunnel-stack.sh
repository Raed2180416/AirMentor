#!/usr/bin/env bash
# start-tunnel-stack.sh
# Starts: mailpit (local email inbox) + AirMentor backend + ngrok tunnel
# Usage:  bash scripts/start-tunnel-stack.sh
#
# One-time setup required first:
#   1. Sign up at https://ngrok.com (free)
#   2. Copy your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
#   3. ngrok config add-authtoken <your-token>
#   4. Claim a free static domain at https://dashboard.ngrok.com/domains
#   5. Fill NGROK_DOMAIN in air-mentor-api/.env.tunnel

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
env_file="$repo_root/air-mentor-api/.env.tunnel"

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

# ── cleanup on exit ───────────────────────────────────────────────────────────
MAILPIT_PID=""
BACKEND_PID=""
NGROK_PID=""

cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down tunnel stack...${NC}"
  [[ -n "$NGROK_PID" ]]    && kill "$NGROK_PID"    2>/dev/null || true
  [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null || true
  [[ -n "$MAILPIT_PID" ]]  && kill "$MAILPIT_PID"  2>/dev/null || true
  wait 2>/dev/null || true
  echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

# ── check prerequisites ───────────────────────────────────────────────────────
for cmd in node npm ngrok mailpit; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo -e "${RED}ERROR: '$cmd' not found in PATH.${NC}" >&2
    exit 1
  fi
done

if [[ ! -f "$env_file" ]]; then
  echo -e "${RED}ERROR: $env_file not found.${NC}" >&2
  exit 1
fi

# ── load .env.tunnel ─────────────────────────────────────────────────────────
set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

if [[ "${NGROK_DOMAIN:-}" == "__FILL_IN_YOUR_NGROK_STATIC_DOMAIN__" || -z "${NGROK_DOMAIN:-}" ]]; then
  echo -e "${RED}ERROR: NGROK_DOMAIN is not set in $env_file${NC}" >&2
  echo ""
  echo "Steps to fix:"
  echo "  1. Sign up free at https://ngrok.com"
  echo "  2. Run: ngrok config add-authtoken <your-token>"
  echo "  3. Claim a free static domain at https://dashboard.ngrok.com/domains"
  echo "  4. Set NGROK_DOMAIN=your-domain.ngrok-free.app in air-mentor-api/.env.tunnel"
  exit 1
fi

# ── validate ngrok auth ───────────────────────────────────────────────────────
if ! ngrok config check >/dev/null 2>&1; then
  echo -e "${RED}ERROR: ngrok auth token not configured.${NC}" >&2
  echo "  Run: ngrok config add-authtoken <your-token>"
  exit 1
fi

export PASSWORD_SETUP_BASE_URL="https://${NGROK_DOMAIN}"
BACKEND_PUBLIC_URL="https://${NGROK_DOMAIN}"

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  AirMentor Tunnel Stack${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""

# ── start mailpit ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/3] Starting mailpit (local email inbox)...${NC}"
mailpit --smtp 127.0.0.1:1025 --listen 127.0.0.1:8025 >/dev/null 2>&1 &
MAILPIT_PID=$!
sleep 1
if ! kill -0 "$MAILPIT_PID" 2>/dev/null; then
  echo -e "${RED}ERROR: mailpit failed to start. Port 1025 or 8025 may be in use.${NC}" >&2
  exit 1
fi
echo -e "${GREEN}  mailpit running — view emails at http://localhost:8025${NC}"

# ── start backend ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/3] Starting AirMentor backend on port ${PORT:-4000}...${NC}"
(
  cd "$repo_root/air-mentor-api"
  exec npm run dev 2>&1
) &
BACKEND_PID=$!

# wait for backend to be ready
echo -n "  Waiting for backend"
for i in $(seq 1 30); do
  if node -e "fetch('http://127.0.0.1:${PORT:-4000}/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" 2>/dev/null; then
    echo ""
    echo -e "${GREEN}  Backend ready at http://127.0.0.1:${PORT:-4000}${NC}"
    break
  fi
  echo -n "."
  sleep 1
  if [[ $i -eq 30 ]]; then
    echo ""
    echo -e "${RED}ERROR: Backend did not become ready after 30s.${NC}" >&2
    exit 1
  fi
done

# ── start ngrok ───────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/3] Starting ngrok tunnel (domain: ${NGROK_DOMAIN})...${NC}"
ngrok http "${PORT:-4000}" \
  --domain="${NGROK_DOMAIN}" \
  --log=stdout \
  --log-level=warn \
  >/tmp/airmentor-ngrok.log 2>&1 &
NGROK_PID=$!
sleep 3
if ! kill -0 "$NGROK_PID" 2>/dev/null; then
  echo -e "${RED}ERROR: ngrok failed to start. Check /tmp/airmentor-ngrok.log${NC}" >&2
  cat /tmp/airmentor-ngrok.log >&2
  exit 1
fi
echo -e "${GREEN}  ngrok tunnel active${NC}"

# ── print summary ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Stack is LIVE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Backend public URL : ${CYAN}${BACKEND_PUBLIC_URL}${NC}"
echo -e "  Email inbox        : ${CYAN}http://localhost:8025${NC}"
echo -e "  Backend local      : ${CYAN}http://127.0.0.1:${PORT:-4000}${NC}"
echo ""
echo -e "${YELLOW}  GitHub Pages must point to: ${BACKEND_PUBLIC_URL}${NC}"
echo -e "${YELLOW}  If you haven't updated it yet, see the instructions below.${NC}"
echo ""
echo -e "  To update GitHub Pages frontend:"
echo -e "    gh variable set VITE_AIRMENTOR_API_BASE_URL --body \"${BACKEND_PUBLIC_URL}\""
echo -e "    gh workflow run deploy-pages.yml"
echo ""
echo -e "${CYAN}  Press Ctrl+C to stop all processes.${NC}"
echo ""

# ── keep running ─────────────────────────────────────────────────────────────
wait
