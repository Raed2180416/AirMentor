#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
api_dir="$repo_root/air-mentor-api"
service_name="airmentor-local-backend.service"
env_dir="$HOME/.config/airmentor"
env_path="$env_dir/local-backend.env"
railway_service="${RAILWAY_API_SERVICE:-api}"
railway_environment="${RAILWAY_ENVIRONMENT:-production}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required but was not found in PATH." >&2
  exit 1
fi

upsert_env_var() {
  local file_path="$1"
  local key="$2"
  local value="$3"
  local tmp
  tmp="$(mktemp)"

  if [[ -f "$file_path" ]]; then
    awk -v key="$key" -v value="$value" '
      BEGIN { replaced = 0 }
      $0 ~ ("^" key "=") {
        print key "=" value
        replaced = 1
        next
      }
      { print }
      END {
        if (!replaced) print key "=" value
      }
    ' "$file_path" > "$tmp"
  else
    printf '%s=%s\n' "$key" "$value" > "$tmp"
  fi

  mv "$tmp" "$file_path"
}

echo "Resolving Railway DATABASE_URL from service '$railway_service' in environment '$railway_environment'..."
database_kv_output="$(cd "$api_dir" && npx -y @railway/cli@latest variable list --kv --service "$railway_service" --environment "$railway_environment" || true)"
database_url="$(printf '%s\n' "$database_kv_output" | sed -n 's/^DATABASE_URL=//p' | head -n 1)"

if [[ -z "$database_url" ]]; then
  echo "Could not resolve DATABASE_URL from Railway service '$railway_service'." >&2
  exit 1
fi

mkdir -p "$env_dir"

upsert_env_var "$env_path" "AIRMENTOR_LOCAL_BACKEND_MODE" "railway-db"
upsert_env_var "$env_path" "DATABASE_URL" "$database_url"
upsert_env_var "$env_path" "AIRMENTOR_API_PORT" "${AIRMENTOR_API_PORT:-4000}"
upsert_env_var "$env_path" "HOST" "${HOST:-127.0.0.1}"

if ! grep -q '^CORS_ALLOWED_ORIGINS=' "$env_path"; then
  upsert_env_var "$env_path" "CORS_ALLOWED_ORIGINS" "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173"
fi

echo "Updated $env_path"

echo "Restarting local backend service if available..."
if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
  systemctl --user daemon-reload
  if systemctl --user is-enabled "$service_name" >/dev/null 2>&1; then
    systemctl --user restart "$service_name"
    systemctl --user --no-pager --full status "$service_name" || true
  else
    echo "Service '$service_name' is not enabled. Run npm run backend:autostart:setup first." >&2
  fi
else
  echo "systemd user session is not available in this shell. Restart '$service_name' manually later." >&2
fi

echo
echo "Local backend is now configured to use Railway DATABASE_URL via AIRMENTOR_LOCAL_BACKEND_MODE=railway-db."
echo "Warning: this mode points local writes at the same database target as Railway API."
