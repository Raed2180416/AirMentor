#!/usr/bin/env bash
# Start the pipeline detached in tmux.
# - Loads DAG (init) if --dag given
# - Launches orchestrator run loop in session `airmentor-pipe-orchestrator`
# - Launches TUI session `airmentor-pipe-tui` (attach via scripts/attach-tui.sh)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PIPE_ROOT/.." && pwd)"

DAG=""
DAG_RUN_ID=""
PARALLEL="${AIRMENTOR_PIPELINE_PARALLEL:-4}"

usage() {
  cat >&2 <<'EOF'
Usage: pipeline/scripts/start.sh [--dag <file>] [--dag-run-id <id>] [--parallel N]

If --dag is given, materialises the DAG first and captures dag_run_id.
If --dag-run-id is given, resumes that run.
If neither, reads latest run from DB.
EOF
  exit 64
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dag)         DAG="${2:?}";         shift 2 ;;
    --dag-run-id)  DAG_RUN_ID="${2:?}";  shift 2 ;;
    --parallel)    PARALLEL="${2:?}";    shift 2 ;;
    -h|--help)     usage ;;
    *) echo "unknown flag: $1" >&2; usage ;;
  esac
done

cd "$REPO_ROOT"

VENV_DIR="$PIPE_ROOT/.venv"
if [ -d "$VENV_DIR" ]; then
  # shellcheck disable=SC1091
  source "$VENV_DIR/bin/activate"
fi

PY="$(command -v python3)"

if [ -n "$DAG" ]; then
  out="$("$PY" -m pipeline.orchestrator.main init --dag "$DAG")"
  echo "$out"
  DAG_RUN_ID="$(echo "$out" | sed -n 's/.*"dag_run_id": "\(.*\)",.*/\1/p' | head -n1)"
fi

if [ -z "$DAG_RUN_ID" ]; then
  DAG_RUN_ID="$("$PY" - <<'EOF'
from pipeline.orchestrator import db
db.migrate()
row = db.get_conn().execute(
    "SELECT dag_run_id FROM pipeline_runs ORDER BY started_at DESC LIMIT 1"
).fetchone()
print(row["dag_run_id"] if row else "")
EOF
)"
fi

if [ -z "$DAG_RUN_ID" ]; then
  echo "no dag_run_id — pass --dag or --dag-run-id" >&2
  exit 2
fi

ORCH_SESSION="airmentor-pipe-orchestrator"
TUI_SESSION="airmentor-pipe-tui"

if tmux has-session -t "$ORCH_SESSION" 2>/dev/null; then
  echo "orchestrator already running in $ORCH_SESSION" >&2
else
  tmux new-session -d -s "$ORCH_SESSION" \
    "cd $REPO_ROOT && [ -f $VENV_DIR/bin/activate ] && source $VENV_DIR/bin/activate; $PY -m pipeline.orchestrator.main run --dag-run-id $DAG_RUN_ID --parallel $PARALLEL 2>&1 | tee -a $HOME/.local/state/airmentor/orchestrator.log"
  echo "started orchestrator in tmux session: $ORCH_SESSION"
fi

if tmux has-session -t "$TUI_SESSION" 2>/dev/null; then
  echo "tui already running in $TUI_SESSION" >&2
else
  tmux new-session -d -s "$TUI_SESSION" \
    "cd $REPO_ROOT && [ -f $VENV_DIR/bin/activate ] && source $VENV_DIR/bin/activate; $PY -m pipeline.tui.dashboard --dag-run-id $DAG_RUN_ID"
  echo "started tui in tmux session: $TUI_SESSION"
fi

echo
echo "Attach to TUI:          bash pipeline/scripts/attach-tui.sh"
echo "Attach to orchestrator: tmux attach -t $ORCH_SESSION"
echo "List all pipe sessions: tmux ls | grep airmentor-pipe"
echo "Stop everything:        bash pipeline/scripts/stop.sh"
