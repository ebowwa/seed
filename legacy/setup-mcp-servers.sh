#!/bin/bash

# MCP Server Automated Setup Script with Doppler Integration
# This script completes the MCP server setup that setup.sh starts but doesn't finish

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Utility functions
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

# Default Doppler configuration
DOPPLER_PROJECT="${DOPPLER_PROJECT:-seed}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-dev}"

# Show help
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

This script automates the MCP server setup that complements setup.sh.

Options:
  -p, --project PROJECT    Doppler project name (default: seed)
  -c, --config CONFIG     Doppler config name (default: dev)
  -h, --help              Show this help message

Environment Variables:
  DOPPLER_PROJECT         Doppler project name
  DOPPLER_CONFIG          Doppler config name

Examples:
  $0                                      # Use default settings
  $0 --project seed --config prd          # Use production config
  $0 -p myproject -c staging              # Use custom project/config

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project)
            DOPPLER_PROJECT="$2"
            shift 2
            ;;
        -c|--config)
            DOPPLER_CONFIG="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

print_info "Setting up MCP servers with Doppler project: $DOPPLER_PROJECT, config: $DOPPLER_CONFIG"
echo ""

# Command exists function
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Doppler is available and configured
if ! command_exists doppler; then
    print_error "Doppler CLI not found. Please install it first."
    echo "Run: brew install dopplerhq/tap/doppler (macOS) or see docs for other OS"
    exit 1
fi

# Check if user is logged in to Doppler
if ! doppler whoami >/dev/null 2>&1; then
    print_error "Not logged in to Doppler. Please authenticate first:"
    echo "  doppler login"
    exit 1
fi

# Check if Claude Code is available
if ! command_exists claude; then
    print_error "Claude Code CLI not found. Please install it first:"
    echo "  Run setup.sh or install manually"
    exit 1
fi

# Check access to the specified Doppler project
print_info "Checking access to Doppler project '$DOPPLER_PROJECT'..."
if ! doppler run --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" -- echo "✓ Doppler access confirmed" >/dev/null 2>&1; then
    print_error "Cannot access Doppler project '$DOPPLER_PROJECT' with config '$DOPPLER_CONFIG'"
    print_info "Available projects:"
    doppler projects list 2>/dev/null || print_warning "Cannot list projects - check permissions"
    exit 1
fi
print_success "Doppler access confirmed for project: $DOPPLER_PROJECT"

# Extract Z.AI API key from Doppler
print_info "Retrieving Z.AI API key from Doppler..."
Z_AI_API_KEY=$(doppler run --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" -- printenv Z_AI_API_KEY 2>/dev/null || echo "")

if [ -z "$Z_AI_API_KEY" ]; then
    print_error "Z_AI_API_KEY not found in Doppler project '$DOPPLER_PROJECT' config '$DOPPLER_CONFIG'"
    print_info "Please ensure Z_AI_API_KEY is set in your Doppler project"
    exit 1
fi
print_success "Z.AI API key retrieved successfully"

# Function to check if MCP server is already installed
is_mcp_server_installed() {
    local server_name="$1"
    claude mcp list 2>/dev/null | grep -q "$server_name" || claude mcp list 2>/dev/null | grep -i "$server_name"
}

# Install Vision MCP Server
print_info "Setting up Vision MCP Server..."
if is_mcp_server_installed "zai-mcp-server"; then
    print_info "Vision MCP Server already installed, checking for updates..."

    # Remove existing server to update
    print_info "Removing existing Vision MCP Server..."
    doppler run --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" -- \
        claude mcp remove zai-mcp-server 2>/dev/null || true
fi

print_info "Installing Vision MCP Server..."
doppler run --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" -- \
    claude mcp add -s user zai-mcp-server --env Z_AI_API_KEY="$Z_AI_API_KEY" Z_AI_MODE=ZAI -- npx -y "@z_ai/mcp-server"

if [ $? -eq 0 ]; then
    print_success "Vision MCP Server installed successfully"
else
    print_error "Failed to install Vision MCP Server"
    exit 1
fi

# Install Web Search MCP Server
print_info "Setting up Web Search MCP Server..."
if is_mcp_server_installed "web-search-prime"; then
    print_info "Web Search MCP Server already installed, checking for updates..."

    # Remove existing server to update
    print_info "Removing existing Web Search MCP Server..."
    doppler run --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" -- \
        claude mcp remove web-search-prime 2>/dev/null || true
fi

print_info "Installing Web Search MCP Server..."
doppler run --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" -- \
    claude mcp add -s user -t http web-search-prime https://api.z.ai/api/mcp/web_search_prime/mcp --header "Authorization: Bearer $Z_AI_API_KEY"

if [ $? -eq 0 ]; then
    print_success "Web Search MCP Server installed successfully"
else
    print_error "Failed to install Web Search MCP Server"
    exit 1
fi

# Verify installation
print_info "Verifying MCP server installation..."
echo ""
doppler run --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" -- \
    claude mcp list

# Test basic functionality
print_info "Testing MCP server connectivity..."
if doppler run --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" -- \
    npx -y @z_ai/mcp-server --version >/dev/null 2>&1; then
    print_success "Vision MCP Server connectivity verified"
else
    print_warning "Vision MCP Server connectivity test failed (but may still work)"
fi

# Show next steps
echo ""
print_success "🎉 MCP Server setup complete!"
echo ""
print_info "Next steps:"
echo "  1. Start a new Claude Code session to access MCP tools"
echo "  2. Use Vision MCP: 'Analyze image.jpg' or 'Analyze video.mp4'"
echo "  3. Use Web Search: 'Search for latest AI developments'"
echo ""
print_info "Doppler wrapper usage examples:"
echo "  • With default config: doppler run --project seed -- claude"
echo "  • With specific config: doppler run --project seed --config prd -- claude"
echo ""
print_info "MCP servers are now configured and ready to use!"