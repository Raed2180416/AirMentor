#!/bin/bash
# Setup AirMentor Live Repo Watcher
set -euo pipefail

echo "=== AirMentor Live Watcher Setup ==="
echo ""

# Check dependencies
echo "Checking dependencies..."
if ! command -v inotifywait >/dev/null 2>&1; then
  echo "Installing inotify-tools..."
  sudo pacman -S --noconfirm inotify-tools 2>/dev/null || sudo apt-get install -y inotify-tools 2>/dev/null || echo "Please install inotify-tools manually"
fi

echo "Creating directories..."
mkdir -p .audit

echo "Installing systemd user service..."
mkdir -p ~/.config/systemd/user
cp scripts/live-repo-watcher.service ~/.config/systemd/user/airmentor-live-watcher.service
sed -i "s|/home/raed/Projects/air-mentor-ui|$(pwd)|g" ~/.config/systemd/user/airmentor-live-watcher.service
systemctl --user daemon-reload

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the live watcher:"
echo "  systemctl --user start airmentor-live-watcher"
echo ""
echo "To enable on boot:"
echo "  systemctl --user enable airmentor-live-watcher"
echo ""
echo "To check status:"
echo "  systemctl --user status airmentor-live-watcher"
echo ""
echo "To view logs:"
echo "  tail -f .audit/live-watcher.log"
echo ""
echo "To run manually (foreground):"
echo "  ./scripts/live-repo-watcher.sh"
