#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: bash scripts/finalize-stage-02-after-session.sh <tmux-session> <detached-log-path>" >&2
  exit 64
fi

session_name="$1"
log_path="$2"

while tmux has-session -t "$session_name" 2>/dev/null; do
  sleep 30
done

if ! [ -f "$log_path" ]; then
  echo "Detached log not found: $log_path" >&2
  exit 1
fi

if tail -n 20 "$log_path" | grep -q 'exit=0'; then
  node scripts/closeout-stage-02-success.mjs
  exit 0
fi

echo "Recovery session finished without a successful exit; skipping Stage 02 closeout." >&2
exit 1
