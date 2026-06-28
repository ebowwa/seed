#!/bin/bash
# ============================================================================
# Convert a configured GitHub Actions runner from a user LaunchAgent
# (loads at login) to a system LaunchDaemon (starts at boot, runs as the
# same user, no login required). macOS only. Run AFTER ./svc.sh install.
# Requires sudo. Generic -- derives the runner label from the plist svc.sh made.
# ============================================================================
set -uo pipefail

# Resolve the real user's home even when invoked via sudo.
TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME="$(dscl . -read "/Users/$TARGET_USER" NFSHomeDirectory 2>/dev/null | awk '{print $2}')"
[ -z "$TARGET_HOME" ] && TARGET_HOME="$HOME"

PLIST="$(ls -1 "$TARGET_HOME/Library/LaunchAgents/"actions.runner.*.plist 2>/dev/null | head -1)"
if [ -z "$PLIST" ]; then
  echo "No actions.runner.*.plist in $TARGET_HOME/Library/LaunchAgents." >&2
  echo "Run ./svc.sh install in your runner directory first." >&2
  exit 1
fi

LABEL="$(basename "$PLIST" .plist)"
DST="/Library/LaunchDaemons/$(basename "$PLIST")"

echo "Converting $LABEL -> system LaunchDaemon..."
mv "$PLIST" "$DST"
chown root:wheel "$DST"
chmod 644 "$DST"
launchctl bootout "system/$LABEL" 2>/dev/null || true
launchctl bootstrap system "$DST"
sleep 2
if launchctl list | grep -q "$LABEL"; then
  echo "✓ Running in system domain:"
  launchctl list | grep "$LABEL"
else
  echo "⚠ Not listed yet -- check: sudo launchctl print system/$LABEL"
fi
