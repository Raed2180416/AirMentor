#!/usr/bin/env bash
set -euo pipefail

if ! command -v playwright >/dev/null 2>&1; then
  if [[ "${AIRMENTOR_NIX_PLAYWRIGHT:-0}" == "1" ]]; then
    echo "playwright is still unavailable inside nix develop" >&2
    exit 1
  fi

  exec env AIRMENTOR_NIX_PLAYWRIGHT=1 nix develop -c bash "$0" "$@"
fi

url="${1:-${PLAYWRIGHT_APP_URL:-http://127.0.0.1:4173}}"
playwright_root=$(cd "$(dirname "$(command -v playwright)")/.." && pwd)
playwright_browsers_path="${PLAYWRIGHT_BROWSERS_PATH:-$(ls -d /nix/store/*playwright-browsers 2>/dev/null | LC_ALL=C sort | head -n 1)}"
preview_pid=""
preview_log=""

if [[ -z "$playwright_browsers_path" ]]; then
  echo "Unable to resolve a Playwright browsers bundle inside the current environment." >&2
  exit 1
fi

cleanup() {
  if [[ -n "$preview_pid" ]]; then
    kill "$preview_pid" >/dev/null 2>&1 || true
    wait "$preview_pid" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

if [[ "$url" == "http://127.0.0.1:4173" && "${PLAYWRIGHT_BOOTSTRAP_SERVER:-1}" == "1" ]]; then
  preview_log="${PLAYWRIGHT_OUTPUT_DIR:-output/playwright}/system-admin-preview.log"
  mkdir -p "$(dirname "$preview_log")"
  npm run build >/dev/null
  npm run preview -- --host 127.0.0.1 --port 4173 >"$preview_log" 2>&1 &
  preview_pid=$!
  for _ in $(seq 1 30); do
    if node -e "fetch(process.argv[1]).then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))" "$url"; then
      break
    fi
    sleep 1
  done
  if ! node -e "fetch(process.argv[1]).then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))" "$url"; then
    echo "Preview server did not become ready. Log: $preview_log" >&2
    cat "$preview_log" >&2
    exit 1
  fi
fi

echo "Running system admin mock acceptance flow..."
echo "URL: $url"
echo "Playwright root: $playwright_root"
echo "Browsers path: $playwright_browsers_path"

PLAYWRIGHT_APP_URL="$url" \
PLAYWRIGHT_ROOT="$playwright_root" \
PLAYWRIGHT_BROWSERS_PATH="$playwright_browsers_path" \
node scripts/system-admin-mock-acceptance.mjs
