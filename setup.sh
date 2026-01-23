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
exec bun run src/index.ts "$@"
