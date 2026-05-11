#!/usr/bin/env bash
# Attach to the tmux session of a specific running task.
# Usage: attach-task.sh <task_id>
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PIPE_ROOT/.." && pwd)"
task_id="${1:-}"
[ -n "$task_id" ] || { echo "Usage: $0 <task_id>" >&2; exit 64; }
cd "$REPO_ROOT"
VENV_DIR="$PIPE_ROOT/.venv"
[ -f "$VENV_DIR/bin/activate" ] && source "$VENV_DIR/bin/activate"
session="$(python3 - <<EOF
from pipeline.orchestrator import db
db.migrate()
r = db.get_task($task_id)
print((r["tmux_session"] or "") if r else "")
EOF
)"
[ -n "$session" ] || { echo "no tmux session recorded for task $task_id" >&2; exit 1; }
tmux has-session -t "$session" 2>/dev/null || { echo "session $session is gone" >&2; exit 1; }
exec tmux attach -t "$session"
