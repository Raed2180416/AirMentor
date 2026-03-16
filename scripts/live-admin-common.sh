#!/usr/bin/env bash

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd "$script_dir/.." && pwd)
default_api_dir="$repo_root/../air-mentor-api"
api_repo_dir="${AIRMENTOR_API_DIR:-$default_api_dir}"

runtime_dir=""
backend_pid=""
backend_log=""
backend_ready_file=""
api_base_url=""

resolve_api_repo_dir() {
  if [[ ! -d "$api_repo_dir" ]]; then
    echo "Live admin backend repo not found at $api_repo_dir" >&2
    echo "Set AIRMENTOR_API_DIR to your air-mentor-api checkout." >&2
    exit 1
  fi

  if [[ ! -f "$api_repo_dir/package.json" ]]; then
    echo "Live admin backend repo at $api_repo_dir does not look like a Node project." >&2
    exit 1
  fi
}

wait_for_file() {
  local file="$1"
  local attempts="${2:-90}"

  for _ in $(seq 1 "$attempts"); do
    if [[ -s "$file" ]]; then
      return 0
    fi
    sleep 1
  done

  return 1
}

wait_for_http_ok() {
  local url="$1"
  local attempts="${2:-45}"

  for _ in $(seq 1 "$attempts"); do
    if node -e "fetch(process.argv[1]).then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))" "$url"; then
      return 0
    fi
    sleep 1
  done

  return 1
}

read_ready_value() {
  local file="$1"
  local field="$2"
  node -e "const fs = require('node:fs'); const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(String(data[process.argv[2]] ?? ''))" "$file" "$field"
}

start_seeded_api() {
  local cors_allowed_origins="$1"
  local output_dir="$2"

  resolve_api_repo_dir

  runtime_dir=$(mktemp -d "${TMPDIR:-/tmp}/airmentor-live-XXXXXX")
  backend_ready_file="$runtime_dir/backend-ready.json"
  backend_log="$output_dir/system-admin-live-backend.log"
  mkdir -p "$output_dir"

  (
    cd "$api_repo_dir"
    CORS_ALLOWED_ORIGINS="$cors_allowed_origins" \
    AIRMENTOR_API_PORT="${AIRMENTOR_API_PORT:-0}" \
    AIRMENTOR_READY_FILE="$backend_ready_file" \
    npm run dev:seeded
  ) >"$backend_log" 2>&1 &
  backend_pid=$!

  if ! wait_for_file "$backend_ready_file" 90; then
    echo "Seeded backend did not become ready. Log: $backend_log" >&2
    if [[ -f "$backend_log" ]]; then
      cat "$backend_log" >&2
    fi
    exit 1
  fi

  api_base_url=$(read_ready_value "$backend_ready_file" "apiBaseUrl")
  if [[ -z "$api_base_url" ]]; then
    echo "Seeded backend readiness payload did not include apiBaseUrl. Log: $backend_log" >&2
    cat "$backend_log" >&2
    exit 1
  fi
}

cleanup_live_admin_processes() {
  if [[ -n "$backend_pid" ]]; then
    kill "$backend_pid" >/dev/null 2>&1 || true
    wait "$backend_pid" >/dev/null 2>&1 || true
  fi

  if [[ -n "$runtime_dir" ]]; then
    rm -rf "$runtime_dir"
  fi
}
