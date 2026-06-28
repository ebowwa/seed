#!/bin/bash
# ============================================================================
# Mac mini — Always-On Node Setup
# ============================================================================
# Turns a macOS box (e.g. a headless Mac mini) into an always-on dev/CI node:
#   1. Power policy: never idle-sleep, restart after a power cut, wake-on-LAN
#   2. Self-hosted GitHub Actions runner -> boot-time LaunchDaemon
#      (starts at boot, runs as the current user, no login required)
#   3. (optional) Xcode via xcodes, for iOS/macOS builds
#
# macOS only. Privileged steps call sudo internally. Safe for public use --
# pass your repo URL + a fresh runner token via env vars; nothing is hardcoded.
# ============================================================================
set -e
export HOME="${HOME:-/root}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- colors / helpers (seed style) ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error()   { echo -e "${RED}✗${NC} $1"; }
print_info()    { echo -e "${BLUE}ℹ${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

# --- gate ---
if [ "$(uname -s)" != "Darwin" ]; then
  print_error "This script is macOS-only."
  exit 1
fi

RUNNER_DIR="${RUNNER_DIR:-$HOME/actions-runner}"
RUNNER_NAME="${RUNNER_NAME:-$(scutil --get ComputerName 2>/dev/null || echo mac-node)}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,macOS,ARM64,ios}"

# ============================================================================
power_policy() {
  print_info "Applying always-on power policy (sudo)..."
  sudo pmset -a sleep 0 displaysleep 0 autorestart 1 womp 1 standby 0
  print_info "Disabling all sleep, incl. maintenance/DarkWake naps (sudo)..."
  sudo pmset -a disablesleep 1
  print_success "Power policy applied."
  pmset -g | grep -E "sleep|displaysleep|autorestart|womp|standby|disablesleep" || true
}

# ============================================================================
setup_runner() {
  if [ -z "${RUNNER_URL:-}" ] || [ -z "${RUNNER_TOKEN:-}" ]; then
    print_warning "RUNNER_URL / RUNNER_TOKEN not set -- skipping runner setup."
    print_info "  Get them: <repo> -> Settings -> Actions -> Runners -> New self-hosted runner (macOS, ARM64)."
    print_info "  Then re-run: RUNNER_URL=https://github.com/<owner>/<repo> RUNNER_TOKEN=... $0"
    return 0
  fi

  mkdir -p "$RUNNER_DIR"
  if [ ! -x "$RUNNER_DIR/runsvc.sh" ]; then
    print_info "Fetching latest runner (osx-arm64)..."
    latest=$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
             | grep -oE '"tag_name": *"v[^"]+"' | head -1 | sed -E 's/.*"v([^"]+)".*/\1/')
    curl -fsSL -o "$RUNNER_DIR/runner.tar.gz" \
      "https://github.com/actions/runner/releases/download/v${latest}/actions-runner-osx-arm64-${latest}.tar.gz"
    tar xzf "$RUNNER_DIR/runner.tar.gz" -C "$RUNNER_DIR" && rm "$RUNNER_DIR/runner.tar.gz"
    print_success "Runner v${latest} staged in $RUNNER_DIR."
  else
    print_info "Runner already staged in $RUNNER_DIR."
  fi

  print_info "Registering with $RUNNER_URL (token is single-use, ~1h)..."
  ( cd "$RUNNER_DIR" && ./config.sh --url "$RUNNER_URL" --token "$RUNNER_TOKEN" \
       --unattended --labels "$RUNNER_LABELS" --name "$RUNNER_NAME" )

  print_info "Installing as user agent, then converting to a boot-time daemon..."
  ( cd "$RUNNER_DIR" && ./svc.sh install )
  sudo bash "$SCRIPT_DIR/convert-runner-to-daemon.sh"
  print_success "Runner installed as a boot-time daemon."
  print_info "Verify on GitHub (Idle dot) and locally: sudo launchctl list | grep actions.runner"
}

# ============================================================================
setup_xcode() {
  command -v brew >/dev/null 2>&1 || { print_error "Homebrew required for xcodes."; return 1; }
  command -v xcodes >/dev/null 2>&1 || brew install xcodes
  print_info "Installing Xcode ${XCODE_VERSION:-26.6} (prompts for Apple ID + 2FA)..."
  xcodes install "${XCODE_VERSION:-26.6}"
  print_info "Post-install (sudo)..."
  sudo xcodebuild -runFirstLaunch
  sudo xcodebuild -license accept
  sudo xcode-select -s /Applications/Xcode.app
  print_success "Xcode ready."
}

# ============================================================================
print_info "Mac mini always-on node setup"
power_policy
setup_runner
# setup_xcode   # uncomment to install Xcode (large; interactive Apple ID)

print_success "Done. See MAC-MINI-NODE-GUIDE.md."
