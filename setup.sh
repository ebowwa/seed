#!/bin/bash

# ============================================================================
# Seed Setup v2 - Bun-powered Bootstrap
# ============================================================================
# This script installs Bun (if needed) and delegates to the TypeScript setup
# Purpose: Fast, reliable environment setup with compiled binary support
# ============================================================================

# Exit on error, but allow unset variables (HOME might not be set in some envs)
set -e

# Ensure HOME is set (some environments don't set it)
export HOME="${HOME:-/root}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V2_DIR="${SCRIPT_DIR}/v2"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

# ============================================================================
# Bun Installation
# ============================================================================

install_bun() {
    print_info "Installing Bun..."

    # Install unzip (required by bun install script) on Linux
    if [ "$(uname -s)" = "Linux" ]; then
        if ! command -v unzip >/dev/null 2>&1; then
            print_info "Installing unzip (required for Bun)..."
            apt-get update -qq && apt-get install -y -qq unzip
        fi
    fi

    # Detect OS and architecture
    local os
    local arch

    case "$(uname -s)" in
        Linux*)     os=linux;;
        Darwin*)    os=darwin;;
        *)          print_error "Unsupported OS: $(uname -s)"; return 1;;
    esac

    case "$(uname -m)" in
        x86_64|amd64)  arch=x64;;
        aarch64|arm64) arch=aarch64;;
        *)              print_error "Unsupported architecture: $(uname -m)"; return 1;;
    esac

    # Download and install Bun
    # FIX: Original URL was https://bun.sh/install/install.sh (404 error)
    # Correct URL is https://bun.sh/install
    local bun_url="https://bun.sh/install"

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "${bun_url}" | bash
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "${bun_url}" | bash
    else
        print_error "Neither curl nor wget available"
        return 1
    fi

    # Source bun environment
    if [ -f "$HOME/.bun/bin/bun" ]; then
        export PATH="$HOME/.bun/bin:$PATH"
        print_success "Bun installed successfully"
    else
        print_error "Bun installation failed"
        return 1
    fi
}

# ============================================================================
# System-wide PATH Configuration (fallback for manual installation)
# ============================================================================
# Add bun to system-wide PATH for future sessions
if [ -w /etc/environment ] && ! grep -q "$HOME/.bun/bin" /etc/environment 2>/dev/null; then
    print_info "Adding bun to /etc/environment..."
    echo "PATH=\"$HOME/.bun/bin:\$PATH\"" >> /etc/environment
    print_success "System PATH configured for future sessions"
fi

# ============================================================================
# Check for Bun or install it
# ============================================================================

if ! command -v bun >/dev/null 2>&1; then
    print_warning "Bun not found, installing..."
    install_bun || exit 1
else
    print_success "Bun found: $(bun --version)"
fi

# ============================================================================
# Run the TypeScript setup
# ============================================================================

print_info "Starting Seed Setup v2..."

# Check if v2/src/index.ts exists
if [ ! -f "${V2_DIR}/src/index.ts" ]; then
    print_error "Setup not found at ${V2_DIR}/src/index.ts"
    exit 1
fi

# Change to v2 directory and run
cd "${V2_DIR}"

# Run the setup
bun run src/index.ts "$@"
SETUP_EXIT_CODE=$?

# If setup failed, exit
if [ $SETUP_EXIT_CODE -ne 0 ]; then
    exit $SETUP_EXIT_CODE
fi

# ============================================================================
# Node Agent Systemd Service Setup
# ============================================================================

print_info "Checking node-agent service..."

NODE_AGENT_PATH="${SCRIPT_DIR}/node-agent"
SERVICE_FILE="${NODE_AGENT_PATH}/systemd/node-agent.service"

# Check if systemd is available (not in containers)
if ! command -v systemctl &> /dev/null || ! systemctl --version &> /dev/null; then
    # No systemd - check if node-agent is already running
    if pgrep -f "node-agent" > /dev/null; then
        print_success "node-agent service is running (managed directly)"
    else
        print_warning "systemd not available (container environment), starting node-agent directly..."
        cd "${NODE_AGENT_PATH}" && bun run src/index.ts &
        sleep 2
        if pgrep -f "node-agent" > /dev/null; then
            print_success "node-agent started successfully (listening on port 8911)"
        else
            print_error "node-agent failed to start"
        fi
    fi
# Check if node-agent exists and has service file
elif [ -d "${NODE_AGENT_PATH}" ] && [ -f "${SERVICE_FILE}" ]; then
    print_info "Setting up node-agent systemd service..."

    # Detect user
    CURRENT_USER="${USER:-root}"
    SERVICE_USER="${SUDO_USER:-$CURRENT_USER}"

    # Systemd directory
    SYSTEMD_DIR="/etc/systemd/system"

    # Copy and configure service file
    print_info "Installing systemd service file..."
    sudo cp "${SERVICE_FILE}" "${SYSTEMD_DIR}/node-agent.service"

    # Update user in service file
    sudo sed -i "s/User=ubuntu/User=${SERVICE_USER}/g" "${SYSTEMD_DIR}/node-agent.service"
    sudo sed -i "s|/home/ubuntu/|/home/${SERVICE_USER}/|g" "${SYSTEMD_DIR}/node-agent.service"

    # Create required directories
    BASE_PATH="${HOME:-/root}"
    sudo mkdir -p "${BASE_PATH}/repos"
    sudo mkdir -p "${BASE_PATH}/.node-agent/pids"
    sudo mkdir -p "${BASE_PATH}/.node-agent/logs"

    # Set ownership (if not root)
    if [ "$(id -u)" -ne 0 ]; then
        sudo chown -R "${SERVICE_USER}:${SERVICE_USER}" "${BASE_PATH}"
    fi

    # Reload and start service
    print_info "Reloading systemd and starting service..."
    sudo systemctl daemon-reload
    sudo systemctl enable node-agent.service
    sudo systemctl start node-agent.service

    # Check service status
    sleep 2
    if sudo systemctl is-active --quiet node-agent.service; then
        print_success "node-agent service is running"
    else
        print_error "node-agent service failed to start"
        sudo systemctl status node-agent.service --no-pager || true
    fi
else
    print_warning "node-agent or service file not found, skipping systemd setup"
fi
