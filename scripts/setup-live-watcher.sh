#!/bin/bash
# AirMentor Live Watcher Setup — One-command auto-start
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== AirMentor Live Watcher Setup ==="
echo "Repo: $REPO_ROOT"

# Check dependencies
echo "Checking dependencies..."
if ! command -v inotifywait >/dev/null 2>&1; then
  echo "Installing inotify-tools..."
  if command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --noconfirm inotify-tools
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y inotify-tools
  else
    echo "ERROR: Please install inotify-tools manually"
    exit 1
  fi
fi

echo "Creating directories..."
mkdir -p "$REPO_ROOT/.audit"

echo "Installing systemd user service..."
mkdir -p ~/.config/systemd/user
cp "$REPO_ROOT/scripts/live-repo-watcher.service" ~/.config/systemd/user/airmentor-live-watcher.service
sed -i "s|/home/raed/Projects/air-mentor-ui|$REPO_ROOT|g" ~/.config/systemd/user/airmentor-live-watcher.service
systemctl --user daemon-reload

echo "Starting and enabling live watcher..."
systemctl --user start airmentor-live-watcher || true
systemctl --user enable airmentor-live-watcher || true

echo "Installing git pre-commit hook..."
bash "$REPO_ROOT/scripts/setup-git-hooks.sh" 2>/dev/null || true

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Service:      systemctl --user status airmentor-live-watcher"
echo "Logs:         tail -f $REPO_ROOT/.audit/live-watcher.log"
echo "Git hook:     .githooks/pre-commit (runs npm run agent:map before each commit)"
echo "Map output:   $REPO_ROOT/docs/agent-map/"
echo ""
echo "The watcher auto-regenerates the repo map on every file change, and the pre-commit hook regenerates it on commit."
