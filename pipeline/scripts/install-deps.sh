#!/usr/bin/env bash
# Idempotent dep install for the v2 pipeline.
# Safe to run repeatedly. Prefers system package manager, falls back to pip --user.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PIPE_ROOT/.." && pwd)"

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }

require_bin() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    log "ok: $name present"
    return 0
  fi
  log "MISSING: $name"
  return 1
}

# --------- core system deps (hard) ---------
missing_sys=()
for b in python3 tmux git; do
  require_bin "$b" || missing_sys+=("$b")
done
if [ "${#missing_sys[@]}" -gt 0 ]; then
  log "hard system deps missing: ${missing_sys[*]}"
  log "install via your package manager (nix/apt/dnf) and rerun"
  exit 69
fi

# --------- optional (informational) ---------
for b in sqlite3 jq curl; do
  require_bin "$b" || log "optional $b missing (non-fatal)"
done

# --------- python deps ---------
PY=python3
PIP_ARGS=(--quiet --disable-pip-version-check)

# Try venv location first for reproducibility
VENV_DIR="$PIPE_ROOT/.venv"
if [ ! -d "$VENV_DIR" ]; then
  log "creating venv at $VENV_DIR"
  "$PY" -m venv "$VENV_DIR"
fi
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

"$PY" -m pip install "${PIP_ARGS[@]}" --upgrade pip
"$PY" -m pip install "${PIP_ARGS[@]}" \
  "textual>=0.80,<2" \
  "rich>=13,<14" \
  "pyyaml>=6,<7" \
  "httpx>=0.27,<1"

log "python deps installed into $VENV_DIR"

# --------- optional provider CLIs (probe only; do not auto-install) ---------
log "provider CLI probe (optional; install only what you use):"
for cli in codex claude windsurf ollama gh ccs; do
  if command -v "$cli" >/dev/null 2>&1; then
    log "  present: $cli"
  else
    log "  absent : $cli  (skipping)"
  fi
done

# --------- db bootstrap ---------
mkdir -p "$HOME/.local/state/airmentor"
"$PY" -c "from pipeline.orchestrator import db; db.migrate()"
log "sqlite schema migrated: $("$PY" -c 'from pipeline.orchestrator import db; print(db.db_path())')"

log "install-deps done. activate venv:  source $VENV_DIR/bin/activate"
