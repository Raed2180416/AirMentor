#!/bin/bash
# Setup daily auditor systemd timer

set -e
REPO_ROOT="/home/raed/Projects/air-mentor-ui"

mkdir -p ~/.config/systemd/user

cp "$REPO_ROOT/scripts/airmentor-daily-auditor.service" ~/.config/systemd/user/
cp "$REPO_ROOT/scripts/airmentor-daily-auditor.timer" ~/.config/systemd/user/

systemctl --user daemon-reload
systemctl --user enable airmentor-daily-auditor.timer
systemctl --user start airmentor-daily-auditor.timer

echo "Daily auditor timer installed and started."
echo "Status:"
systemctl --user status airmentor-daily-auditor.timer --no-pager
