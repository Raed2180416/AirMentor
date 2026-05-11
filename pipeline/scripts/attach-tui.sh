#!/usr/bin/env bash
# Attach to the live TUI dashboard.
set -euo pipefail
SESSION="airmentor-pipe-tui"
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "no TUI session running; start with pipeline/scripts/start.sh" >&2
  exit 1
fi
exec tmux attach -t "$SESSION"
