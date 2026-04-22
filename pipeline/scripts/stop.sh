#!/usr/bin/env bash
# Stop all pipeline tmux sessions. Does NOT cancel running tasks in DB.
# For graceful cancel: python3 -m pipeline.orchestrator.main abort --dag-run-id <id>

set -euo pipefail

for session in $(tmux ls 2>/dev/null | awk -F: '/^airmentor-pipe/ {print $1}'); do
  echo "killing tmux session: $session"
  tmux kill-session -t "$session" || true
done
echo "done."
