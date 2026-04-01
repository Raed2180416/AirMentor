#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: bash scripts/finalize-stage-08c-after-session.sh <tmux-session> <detached-log-path>" >&2
  exit 64
fi

session_name="$1"
log_path="$2"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"

while tmux has-session -t "$session_name" 2>/dev/null; do
  sleep 30
done

if ! [ -f "$log_path" ]; then
  echo "Detached log not found: $log_path" >&2
  exit 1
fi

if tail -n 20 "$log_path" | grep -q 'exit=0'; then
  required_bundles=(
    "$repo_root/output/playwright/08c-local-closeout-artifact-bundle.json"
    "$repo_root/output/playwright/08c-live-closeout-artifact-bundle.json"
  )

  for bundle_path in "${required_bundles[@]}"; do
    found_bundle=0
    for _ in $(seq 1 60); do
      if [ -f "$bundle_path" ]; then
        found_bundle=1
        break
      fi
      sleep 5
    done

    if [ "$found_bundle" -ne 1 ]; then
      echo "Timed out waiting for Stage 08C bundle: $bundle_path" >&2
      exit 1
    fi
  done

  (cd "$repo_root" && node scripts/closeout-stage-08c-success.mjs)
  exit 0
fi

echo "Recovery session finished without a successful exit; skipping Stage 08C closeout." >&2
exit 1
