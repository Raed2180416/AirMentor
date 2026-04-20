#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

service_name="airmentor-local-backend.service"
service_dir="$HOME/.config/systemd/user"
service_path="$service_dir/$service_name"
env_dir="$HOME/.config/airmentor"
env_path="$env_dir/local-backend.env"
log_dir="$HOME/.local/state/airmentor"
runner_path="$repo_root/scripts/run-local-backend-for-testing.sh"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl is not available on this machine." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found in PATH." >&2
  exit 1
fi

if [[ ! -x "$runner_path" ]]; then
  echo "Runner script is missing or not executable: $runner_path" >&2
  exit 1
fi

if ! systemctl --user show-environment >/dev/null 2>&1; then
  echo "systemd user session is not available in this shell." >&2
  echo "Open a normal desktop session terminal and run this script again." >&2
  exit 1
fi

mkdir -p "$service_dir" "$env_dir" "$log_dir"

if [[ ! -f "$env_path" ]]; then
  cat >"$env_path" <<'EOF'
# Local backend defaults for testing.
AIRMENTOR_LOCAL_BACKEND_MODE=seeded
AIRMENTOR_API_PORT=4000
HOST=127.0.0.1
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173
EOF
fi

cat >"$service_path" <<EOF
[Unit]
Description=AirMentor Local Backend (testing)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$repo_root
EnvironmentFile=%h/.config/airmentor/local-backend.env
ExecStart=$runner_path
Restart=always
RestartSec=5
TimeoutStopSec=20
StandardOutput=append:%h/.local/state/airmentor/local-backend.log
StandardError=append:%h/.local/state/airmentor/local-backend.log

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$service_name"

echo "Enabled $service_name"
echo "Service file: $service_path"
echo "Env file: $env_path"
echo "Log file: $log_dir/local-backend.log"
echo
systemctl --user --no-pager --full status "$service_name" || true

if command -v loginctl >/dev/null 2>&1; then
  linger_state="$(loginctl show-user "$USER" -p Linger 2>/dev/null | cut -d= -f2 || true)"
  if [[ "$linger_state" != "yes" ]]; then
    echo
    echo "Tip: to start this service even without logging into the desktop session, enable linger:"
    echo "  sudo loginctl enable-linger $USER"
  fi
fi
