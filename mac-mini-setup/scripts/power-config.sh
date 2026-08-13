#!/bin/bash
# Always-on power policy for a Mac mini used as a headless server.
# Idempotent. Requires sudo. Verify with `pmset -g` before/after.
set -euo pipefail

echo "== Never idle-sleep / display-sleep; restart after power cut; wake-on-LAN; no hibernation =="
sudo pmset -a sleep 0 displaysleep 0 autorestart 1 womp 1 standby 0

echo "== Disable ALL sleep incl. brief maintenance/DarkWake naps (true always-on) =="
echo "   (Costs a few extra watts. Was NOT applied on this machine as of 2026-06-27.)"
sudo pmset -a disablesleep 1

echo "== Result =="
pmset -g
