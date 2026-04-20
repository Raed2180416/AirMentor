#!/usr/bin/env bash
set -euo pipefail

service_name="airmentor-local-backend.service"
service_path="$HOME/.config/systemd/user/$service_name"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl is not available on this machine." >&2
  exit 1
fi

if ! systemctl --user show-environment >/dev/null 2>&1; then
  echo "systemd user session is not available in this shell." >&2
  echo "Open a normal desktop session terminal and run this script again." >&2
  exit 1
fi

systemctl --user disable --now "$service_name" >/dev/null 2>&1 || true
rm -f "$service_path"
systemctl --user daemon-reload

echo "Disabled $service_name"
