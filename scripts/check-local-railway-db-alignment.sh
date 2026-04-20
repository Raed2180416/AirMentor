#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
api_dir="$repo_root/air-mentor-api"
env_path="$HOME/.config/airmentor/local-backend.env"
railway_service="${RAILWAY_API_SERVICE:-api}"
railway_environment="${RAILWAY_ENVIRONMENT:-production}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required but was not found in PATH." >&2
  exit 1
fi

if [[ ! -f "$env_path" ]]; then
  echo "Local backend env file not found: $env_path" >&2
  exit 1
fi

railway_kv_output="$(cd "$api_dir" && npx -y @railway/cli@latest variable list --kv --service "$railway_service" --environment "$railway_environment" || true)"
railway_db_url="$(printf '%s\n' "$railway_kv_output" | sed -n 's/^DATABASE_URL=//p' | head -n 1)"

if [[ -z "$railway_db_url" ]]; then
  echo "Could not resolve Railway DATABASE_URL from service '$railway_service'." >&2
  exit 1
fi

local_db_url="$(sed -n 's/^DATABASE_URL=//p' "$env_path" | head -n 1)"
local_mode="$(sed -n 's/^AIRMENTOR_LOCAL_BACKEND_MODE=//p' "$env_path" | head -n 1)"

if [[ -z "$local_db_url" ]]; then
  echo "DATABASE_URL is missing from $env_path" >&2
  exit 1
fi

if [[ "$local_db_url" != "$railway_db_url" ]]; then
  echo "DB URL mismatch: local backend is not pinned to Railway API DATABASE_URL." >&2
  exit 1
fi

latest_repo_migration="$(cd "$api_dir" && ls src/db/migrations/*.sql | xargs -n1 basename | sort | tail -n 1)"
if [[ -z "$latest_repo_migration" ]]; then
  echo "No SQL migrations were found under air-mentor-api/src/db/migrations." >&2
  exit 1
fi

db_migration_summary="$(cd "$api_dir" && DATABASE_URL="$local_db_url" node <<'NODE'
const { Client } = require('pg')
const connectionString = process.env.DATABASE_URL || ''
const useRailwaySsl = /railway\./i.test(connectionString) && !/sslmode=disable/i.test(connectionString)
const client = new Client({
  connectionString,
  ssl: useRailwaySsl ? { rejectUnauthorized: false } : undefined,
})
;(async () => {
  try {
    await client.connect()
    const countResult = await client.query('select count(*)::int as count from schema_migrations')
    const latestResult = await client.query('select filename from schema_migrations order by filename desc limit 1')
    const count = countResult.rows?.[0]?.count ?? 0
    const latest = latestResult.rows?.[0]?.filename ?? ''
    console.log(`COUNT=${count}`)
    console.log(`LATEST=${latest}`)
  } catch (error) {
    console.log(`ERROR=${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  } finally {
    await client.end().catch(() => undefined)
  }
})()
NODE
)"

if printf '%s\n' "$db_migration_summary" | grep -q '^ERROR='; then
  printf '%s\n' "$db_migration_summary" >&2
  exit 1
fi

db_latest_migration="$(printf '%s\n' "$db_migration_summary" | sed -n 's/^LATEST=//p' | head -n 1)"
db_migration_count="$(printf '%s\n' "$db_migration_summary" | sed -n 's/^COUNT=//p' | head -n 1)"

if [[ "$db_latest_migration" != "$latest_repo_migration" ]]; then
  echo "Migration drift detected: database latest=$db_latest_migration, repo latest=$latest_repo_migration" >&2
  exit 1
fi

echo "DB alignment check passed."
echo "Mode: ${local_mode:-unset}"
echo "Local and Railway DATABASE_URL values are identical."
echo "Applied migrations: ${db_migration_count:-unknown}, latest: $db_latest_migration"
