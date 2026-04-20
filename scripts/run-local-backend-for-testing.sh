#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found in PATH." >&2
  exit 1
fi

export AIRMENTOR_API_PORT="${AIRMENTOR_API_PORT:-4000}"
export HOST="${HOST:-127.0.0.1}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173}"

mode="${AIRMENTOR_LOCAL_BACKEND_MODE:-seeded}"

cd "$repo_root"

if [[ "$mode" == "railway-db" ]]; then
  export PORT="$AIRMENTOR_API_PORT"
  npm --workspace air-mentor-api run db:migrate
  exec npm --workspace air-mentor-api run dev
fi

exec npm --workspace air-mentor-api run dev:seeded
