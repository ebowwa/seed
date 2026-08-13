#!/bin/bash
# One-time dev tooling install for the Mac mini server.
# Reconstructed from the 2026-06-27 setup session. Idempotent-ish.
set -euo pipefail

# --- Homebrew (installs Xcode Command Line Tools too) ---
if ! command -v brew >/dev/null 2>&1; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv zsh)"
else
  eval "$(/opt/homebrew/bin/brew shellenv zsh)"
fi

# --- CLI tools ---
brew install uv
brew install xcodes
brew install oven-sh/bun/bun          # JS runtime + global bin dir ~/.bun/bin
brew install dopplerhq/cli/doppler    # secrets manager

# --- GUI / cask ---
brew install --cask tailscale-app     # mesh VPN for remote access

# --- Claude Code (native, self-updating) ---
curl -fsSL https://claude.ai/install.sh | bash   # → ~/.local/bin/claude

echo
echo "Done. Then:"
echo "  - doppler login"
echo "  - xcodes install 26.6   (Apple ID + 2FA)"
echo "  - run scripts/convert-runner-daemon.sh after registering the runner"
