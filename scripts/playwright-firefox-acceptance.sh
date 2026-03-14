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

if [[ -z "$playwright_browsers_path" ]]; then
  echo "Unable to resolve a Playwright browsers bundle inside the current environment." >&2
  exit 1
fi

echo "Running Firefox acceptance flow..."
echo "URL: $url"
echo "Playwright root: $playwright_root"
echo "Browsers path: $playwright_browsers_path"

PLAYWRIGHT_APP_URL="$url" \
PLAYWRIGHT_ROOT="$playwright_root" \
PLAYWRIGHT_BROWSERS_PATH="$playwright_browsers_path" \
node scripts/firefox-acceptance.mjs
