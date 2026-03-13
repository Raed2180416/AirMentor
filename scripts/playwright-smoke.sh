#!/usr/bin/env bash
set -euo pipefail

if ! command -v playwright >/dev/null 2>&1; then
  if [[ "${AIRMENTOR_NIX_PLAYWRIGHT:-0}" == "1" ]]; then
    echo "playwright is still unavailable inside nix develop" >&2
    exit 1
  fi

  exec env AIRMENTOR_NIX_PLAYWRIGHT=1 nix develop -c bash "$0" "$@"
fi

url="${1:-${PLAYWRIGHT_APP_URL:-http://127.0.0.1:5173}}"
output_dir="${PLAYWRIGHT_OUTPUT_DIR:-output/playwright}"
output_file="${2:-$output_dir/smoke-firefox.png}"

mkdir -p "$(dirname "$output_file")"

echo "Capturing Playwright smoke screenshot..."
echo "URL: $url"
echo "Output: $output_file"

playwright screenshot -b firefox --wait-for-timeout 1000 "$url" "$output_file"

echo "Smoke screenshot saved to $output_file"
