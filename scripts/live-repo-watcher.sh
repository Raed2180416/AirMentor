#!/bin/bash
# AirMentor Live Repo Watcher — Auto-starting, self-healing, deterministic mapper
# Usage: systemctl --user enable --now airmentor-live-watcher
# Or manually: ./scripts/live-repo-watcher.sh &

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIT_DIR="$REPO_ROOT/.audit"
LOG_FILE="$AUDIT_DIR/live-watcher.log"
STATUS_FILE="$AUDIT_DIR/watcher-status.json"
DEBOUNCE_SECONDS=3
MAX_MAP_GEN_TIME=180

mkdir -p "$AUDIT_DIR"

log() {
  echo "[$(date -Iseconds)] $1" >> "$LOG_FILE"
}

update_status() {
  cat > "$STATUS_FILE" <<EOF
{"status":"$1","last_event":"$(date -Iseconds)","pid":$$,"repo":"$REPO_ROOT"}
EOF
}

log "=== AirMentor Live Watcher starting (PID: $$) ==="
update_status "starting"

# Dependency check
if ! command -v inotifywait >/dev/null 2>&1; then
  log "FATAL: inotifywait not found. Install inotify-tools (pacman -S inotify-tools)."
  update_status "fatal_no_inotify"
  exit 1
fi

# Prevent multiple instances
PIDFILE="$AUDIT_DIR/watcher.pid"
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE" 2>/dev/null)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    log "Another watcher already running (PID: $OLD_PID). Exiting."
    update_status "already_running"
    exit 0
  fi
fi
echo $$ > "$PIDFILE"

LAST_RUN=0
PENDING=false
IN_PROGRESS=false

trigger_regen() {
  local now=$(date +%s)
  if (( now - LAST_RUN < DEBOUNCE_SECONDS )); then
    PENDING=true
    update_status "debouncing"
    return
  fi
  if [ "$IN_PROGRESS" = true ]; then
    PENDING=true
    update_status "queued"
    return
  fi

  LAST_RUN=$now
  PENDING=false
  IN_PROGRESS=true
  update_status "regenerating"

  log "Change detected. Regenerating deterministic maps..."
  cd "$REPO_ROOT"

  # 1. Agent repo map (regex-based, fast)
  if timeout $MAX_MAP_GEN_TIME node scripts/generate-agent-repo-map.mjs >> "$LOG_FILE" 2>&1; then
    log "Agent map regenerated OK"
  else
    log "Agent map generation failed or timed out"
  fi

  # 2. Deterministic codebase index (AST-based, slower)
  if [ -f scripts/deterministic-codebase-indexer.mjs ]; then
    if timeout $MAX_MAP_GEN_TIME node scripts/deterministic-codebase-indexer.mjs >> "$LOG_FILE" 2>&1; then
      log "Deterministic index regenerated OK"
    else
      log "Deterministic index failed or timed out"
    fi
  fi

  # 3. LogicStamp refresh (if available)
  if command -v stamp >/dev/null 2>&1; then
    if timeout 90 stamp context >> "$LOG_FILE" 2>&1; then
      log "LogicStamp refreshed OK"
    else
      log "LogicStamp refresh failed or timed out"
    fi
  fi

  # 4. Update timestamp
  date -Iseconds > "$AUDIT_DIR/.last-regen"
  IN_PROGRESS=false
  update_status "idle"
  log "Regeneration complete."

  # Process any pending trigger that arrived during regeneration
  if [ "$PENDING" = true ]; then
    log "Processing pending trigger..."
    trigger_regen
  fi
}

# Cleanup on exit
cleanup() {
  rm -f "$PIDFILE"
  update_status "stopped"
  log "Watcher stopped."
  exit 0
}
trap cleanup INT TERM EXIT

update_status "watching"
log "Watching: $REPO_ROOT (debounce: ${DEBOUNCE_SECONDS}s, max_gen: ${MAX_MAP_GEN_TIME}s)"

# Main watch loop — use inotifywait -m for continuous monitoring
inotifywait -m \
  -r "$REPO_ROOT" \
  --exclude '(\.git|node_modules|\.logicstamp|\.ctxo|\.worktrees|dist|output|catboost_info|test-results|tmp|\.audit|\.venv|docs/agent-map)' \
  -e close_write -e move -e create -e delete \
  --format '%w%f %e' |
while read -r filepath event; do
  # Only react to relevant file types
  case "$filepath" in
    *.ts|*.tsx|*.js|*.jsx|*.py|*.mjs|*.json|*.md|*.sql)
      trigger_regen
      ;;
  esac
done
