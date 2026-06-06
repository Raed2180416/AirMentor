#!/bin/bash
# AirMentor Live Repo Watcher
# Auto-regenerates agent maps and audits on file changes
# Usage: ./scripts/live-repo-watcher.sh &
# Or: nohup ./scripts/live-repo-watcher.sh > .audit/live-watcher.log 2>&1 &

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIT_DIR="$REPO_ROOT/.audit"
LOG_FILE="$AUDIT_DIR/live-watcher.log"
DEBOUNCE_SECONDS=3
MAX_MAP_GEN_TIME=120

mkdir -p "$AUDIT_DIR"

echo "[$(date -Iseconds)] AirMentor Live Repo Watcher starting..." >> "$LOG_FILE"
echo "[$(date -Iseconds)] Watching: $REPO_ROOT" >> "$LOG_FILE"

# Check dependencies
if ! command -v inotifywait >/dev/null 2>&1; then
  echo "[$(date -Iseconds)] ERROR: inotifywait not found. Install inotify-tools." >> "$LOG_FILE"
  exit 1
fi

LAST_RUN=0
PENDING=false

trigger_regen() {
  local now=$(date +%s)
  if (( now - LAST_RUN < DEBOUNCE_SECONDS )); then
    PENDING=true
    return
  fi
  
  LAST_RUN=$now
  PENDING=false
  
  echo "[$(date -Iseconds)] Change detected. Regenerating maps..." >> "$LOG_FILE"
  
  # 1. Regenerate agent map
  cd "$REPO_ROOT"
  if timeout $MAX_MAP_GEN_TIME npm run agent:map >> "$LOG_FILE" 2>&1; then
    echo "[$(date -Iseconds)] Agent map regenerated OK" >> "$LOG_FILE"
  else
    echo "[$(date -Iseconds)] Agent map generation failed or timed out" >> "$LOG_FILE"
  fi
  
  # 2. Refresh LogicStamp context
  if command -v stamp >/dev/null 2>&1; then
    if timeout 60 stamp context >> "$LOG_FILE" 2>&1; then
      echo "[$(date -Iseconds)] LogicStamp refreshed OK" >> "$LOG_FILE"
    else
      echo "[$(date -Iseconds)] LogicStamp refresh failed or timed out" >> "$LOG_FILE"
    fi
  fi
  
  # 3. Update timestamp
  date -Iseconds > "$AUDIT_DIR/.last-regen"
  
  echo "[$(date -Iseconds)] Regeneration complete." >> "$LOG_FILE"
}

# Main watch loop
inotifywait -m \
  -r "$REPO_ROOT" \
  --exclude '(\.git|node_modules|\.logicstamp|\.ctxo|\.worktrees|dist|output|catboost_info|test-results|tmp|\.audit)' \
  -e close_write -e move -e create -e delete \
  --format '%w%f %e' |
while read -r filepath event; do
  # Filter to relevant file types
  case "$filepath" in
    *.ts|*.tsx|*.js|*.jsx|*.py|*.mjs|*.json|*.md|*.sql)
      trigger_regen
      ;;
  esac
done
