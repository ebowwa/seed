#!/bin/bash
# Convert the GitHub Actions runner from a user LaunchAgent (loads at login)
# to a system LaunchDaemon (starts at boot, runs as your user, no login).
# Run AFTER `./config.sh` has registered the runner in ~/actions-runner.
# Idempotent. Requires sudo. Captured from the 2026-06-27 setup session.
set -uo pipefail

LABEL="actions.runner.ebowwa-secondsee.mac-mini"
USER_HOME="/Users/macos-ebowwa"
SRC="$USER_HOME/Library/LaunchAgents/$LABEL.plist"
DST="/Library/LaunchDaemons/$LABEL.plist"

echo "== 1. Locate plist =="
if [ -f "$SRC" ]; then
  mv "$SRC" "$DST"
  echo "Moved: $SRC -> $DST"
elif [ -f "$DST" ]; then
  echo "Already in place: $DST"
else
  echo "ERROR: plist not found in either location" >&2
  exit 1
fi

echo "== 2. Set ownership root:wheel and mode 644 =="
chown root:wheel "$DST"
chmod 644 "$DST"
ls -l "$DST"

echo "== 3. (Re)load into system domain =="
launchctl bootout "system/$LABEL" 2>/dev/null || true
launchctl bootstrap system "$DST"
echo "Bootstrapped."

echo "== 4. Verify =="
sleep 3
echo "--- launchctl list (system domain; expect a PID) ---"
launchctl list | grep "$LABEL" || echo "(not listed yet)"
echo "--- runner stdout (last lines) ---"
tail -n 10 "$USER_HOME/Library/Logs/$LABEL/stdout.log" 2>/dev/null || true
