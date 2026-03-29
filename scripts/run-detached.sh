#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: bash scripts/run-detached.sh <job-name> <command> [args...]" >&2
  exit 64
fi

job_name="$1"
shift

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${DETACHED_RUN_OUTPUT_DIR:-$repo_root/output/detached}"
mkdir -p "$output_dir"

slug="$(printf '%s' "$job_name" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
session_name="airmentor-${slug}-${timestamp}"
log_path="$output_dir/${session_name}.log"
wrapper_path="$output_dir/${session_name}.sh"
pid_path="$output_dir/${session_name}.pid"

cat >"$wrapper_path" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
log_path="$2"
shift 2

cd "$repo_root"

{
  printf '[%s] cwd=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$repo_root"
  printf '[%s] command=' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '%q ' "$@"
  printf '\n'
  "$@"
  status=$?
  printf '[%s] exit=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$status"
  exit "$status"
} >>"$log_path" 2>&1
EOF

chmod +x "$wrapper_path"

if command -v tmux >/dev/null 2>&1; then
  tmux new-session -d -s "$session_name" "$wrapper_path" "$repo_root" "$log_path" "$@"
  tmux display-message -p -t "$session_name" '#{pid}' >"$pid_path" 2>/dev/null || true
  printf 'mode=tmux\nsession=%s\nlog=%s\nwrapper=%s\n' "$session_name" "$log_path" "$wrapper_path"
else
  nohup "$wrapper_path" "$repo_root" "$log_path" "$@" >/dev/null 2>&1 &
  printf '%s\n' "$!" >"$pid_path"
  printf 'mode=nohup\npid=%s\nlog=%s\nwrapper=%s\n' "$!" "$log_path" "$wrapper_path"
fi
