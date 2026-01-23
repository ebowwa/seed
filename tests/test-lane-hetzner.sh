#!/bin/bash

# Lane Installation Test on Hetzner VPS
# This script tests the lane tool installation on a real Hetzner VPS

set -e

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

# Configuration
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${TEST_DIR}/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="${RESULTS_DIR}/lane-test-${TIMESTAMP}.log"

# Hetzner config (can be overridden via env)
HETZNER_API_TOKEN="${HETZNER_API_TOKEN:-}"
SERVER_TYPE="${SERVER_TYPE:-cax11}" # €3.09/month
SERVER_LOCATION="${SERVER_LOCATION:-fsn1}" # Falkenstein
SERVER_NAME="${SERVER_NAME:-lane-test-${TIMESTAMP}}"
SEED_REPO="${SEED_REPO:-https://github.com/ebowwa/seed.git}"

# Create results directory
mkdir -p "$RESULTS_DIR"

# Log function
log() {
    echo "$1" | tee -a "$RESULT_FILE"
}

log ""
log "╔══════════════════════════════════════════════════════════════╗"
log "║         Lane Installation Test - Hetzner VPS                ║"
log "╚══════════════════════════════════════════════════════════════╝"
log "Timestamp: $TIMESTAMP"
log "Results: $RESULT_FILE"
log ""

# Check prerequisites
print_info "Checking prerequisites..."

if [ -z "$HETZNER_API_TOKEN" ]; then
    print_error "HETZNER_API_TOKEN not set"
    print_info "Export it with: export HETZNER_API_TOKEN=your_token"
    exit 1
fi
print_success "Hetzner API token found"

if ! command -v curl &> /dev/null; then
    print_error "curl not found"
    exit 1
fi
print_success "curl found"

if ! command -v jq &> /dev/null; then
    print_error "jq not found (install with: brew install jq or apt install jq)"
    exit 1
fi
print_success "jq found"
log ""

# Function to make Hetzner API calls
hetzner() {
    curl -s -H "Authorization: Bearer $HETZNER_API_TOKEN" \
         -H "Content-Type: application/json" \
         "https://api.hetzner.cloud/v1$1"
}

# Step 1: Create SSH key (if needed)
print_info "Step 1: Setting up SSH key..."
log "--- SSH Key Setup ---"

SSH_KEY_NAME="lane-test-${TIMESTAMP}"
SSH_KEY_FILE="${TEST_DIR}/lane_test_key"

# Generate SSH key pair
if [ ! -f "$SSH_KEY_FILE" ]; then
    log "Generating SSH key pair..."
    ssh-keygen -t ed25519 -f "$SSH_KEY_FILE" -N "" -C "lane-test-${TIMESTAMP}" >> "$RESULT_FILE" 2>&1
    SSH_PUBLIC_KEY=$(cat "${SSH_KEY_FILE}.pub")

    # Upload SSH key to Hetzner
    SSH_KEY_RESPONSE=$(hetzner "/ssh_keys" -X POST -d "{
        \"name\": \"${SSH_KEY_NAME}\",
        \"public_key\": \"${SSH_PUBLIC_KEY}\"
    }")

    SSH_KEY_ID=$(echo "$SSH_KEY_RESPONSE" | jq -r '.ssh_key.id')
    log "SSH key uploaded: ID=$SSH_KEY_ID"
    print_success "SSH key created and uploaded"
else
    log "Using existing SSH key"
    print_success "SSH key found"
fi
log ""

# Step 2: Create Hetzner VPS
print_info "Step 2: Creating Hetzner VPS..."
log "--- Server Creation ---"
log "Server Type: $SERVER_TYPE"
log "Location: $SERVER_LOCATION"
log "Name: $SERVER_NAME"

CREATE_RESPONSE=$(hetzner "/servers" -X POST -d "{
    \"name\": \"${SERVER_NAME}\",
    \"server_type\": \"${SERVER_TYPE}\",
    \"location\": \"${SERVER_LOCATION}\",
    \"image\": \"ubuntu-24.04\",
    \"ssh_keys\": [\"${SSH_KEY_NAME}\"],
    \"start_after_create\": true
}")

SERVER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.server.id')
SERVER_STATUS=$(echo "$CREATE_RESPONSE" | jq -r '.server.status')

log "Server ID: $SERVER_ID"
log "Initial Status: $SERVER_STATUS"

if [ "$SERVER_ID" = "null" ] || [ -z "$SERVER_ID" ]; then
    print_error "Failed to create server"
    log "Response: $CREATE_RESPONSE"
    exit 1
fi

print_success "Server created: $SERVER_ID"
log ""

# Step 3: Wait for server to be ready
print_info "Step 3: Waiting for server to be ready..."
log "--- Server Boot ---"

READY=false
MAX_WAIT=120
WAIT_COUNT=0

while [ "$READY" = false ] && [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    STATUS_RESPONSE=$(hetzner "/servers/$SERVER_ID")
    SERVER_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.server.status')

    if [ "$SERVER_STATUS" = "running" ]; then
        READY=true
        print_success "Server is running"
    else
        echo -n "."
        sleep 2
        WAIT_COUNT=$((WAIT_COUNT + 1))
    fi
done

if [ "$READY" = false ]; then
    print_error "Server failed to start"
    hetzner "/servers/$SERVER_ID" -X DELETE >> "$RESULT_FILE" 2>&1
    exit 1
fi

# Get server IP
SERVER_IPV4=$(echo "$STATUS_RESPONSE" | jq -r '.server.public_net.ipv4.ip')
log "Server IP: $SERVER_IPV4"
log ""

# Wait for SSH to be available
print_info "Waiting for SSH to be available..."
SSH_READY=false
SSH_WAIT=0
while [ "$SSH_READY" = false ] && [ $SSH_WAIT -lt 60 ]; do
    if ssh -i "$SSH_KEY_FILE" -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@"$SERVER_IPV4" "echo ready" 2>/dev/null | grep -q ready; then
        SSH_READY=true
        print_success "SSH is ready"
    else
        echo -n "."
        sleep 2
        SSH_WAIT=$((SSH_WAIT + 1))
    fi
done
log ""

# Step 4: Run seed setup with lane
print_info "Step 4: Running seed setup on VPS..."
log "--- Seed Setup ---"

SSH_CMD="ssh -i '$SSH_KEY_FILE' -o StrictHostKeyChecking=no root@'$SERVER_IPV4'"

# Clone seed
log "Cloning seed repo..."
$SSH_CMD "git clone $SEED_REPO ~/seed" >> "$RESULT_FILE" 2>&1
print_success "Seed cloned"

# Run setup (lane only)
log "Running seed setup (lane only)..."
$SSH_CMD "cd ~/seed && yes | bash setup.sh --only lane" >> "$RESULT_FILE" 2>&1
print_success "Seed setup completed"
log ""

# Step 5: Test lane installation
print_info "Step 5: Testing lane installation..."
log "--- Lane Tests ---"

# Test 1: Check if lane command exists
log "Test 1: Checking lane command..."
if $SSH_CMD "command -v lane" >> "$RESULT_FILE" 2>&1; then
    print_success "lane command found"
    LANE_VERSION=$($SSH_CMD "lane --version 2>&1 || echo 'unknown'")
    log "Version: $LANE_VERSION"
else
    print_error "lane command not found"
fi

# Test 2: Check lane clone directory
log "Test 2: Checking lane clone directory..."
if $SSH_CMD "test -d ~/lane" >> "$RESULT_FILE" 2>&1; then
    print_success "lane clone directory exists"
    LANE_BRANCH=$($SSH_CMD "cd ~/lane && git branch --show-current" 2>/dev/null || echo "unknown")
    log "Branch: $LANE_BRANCH"
else
    print_error "lane clone directory not found"
fi

# Test 3: Check if lane is installed globally
log "Test 3: Checking global installation..."
if $SSH_CMD "which lane" >> "$RESULT_FILE" 2>&1; then
    LANE_PATH=$($SSH_CMD "which lane" 2>/dev/null)
    print_success "lane installed globally"
    log "Path: $LANE_PATH"
else
    print_error "lane not in PATH"
fi

# Test 4: Run lane list
log "Test 4: Testing lane list command..."
if $SSH_CMD "cd ~ && lane list 2>&1" | head -5 >> "$RESULT_FILE" 2>&1; then
    print_success "lane list works"
else
    print_warning "lane list had issues (may be no lanes yet)"
fi

# Test 5: Create a test lane
log "Test 5: Creating test lane..."
TEST_REPO="https://github.com/ebowwa/seed.git"
if $SSH_CMD "cd ~ && git clone $TEST_REPO test-repo 2>&1" >> "$RESULT_FILE" 2>&1; then
    print_success "Test repo cloned"

    if $SSH_CMD "cd ~/test-repo && lane new test-lane-001 2>&1" >> "$RESULT_FILE" 2>&1; then
        print_success "Test lane created"
        $SSH_CMD "lane list" >> "$RESULT_FILE" 2>&1

        # Cleanup test lane
        $SSH_CMD "cd ~/test-repo && lane remove test-lane-001 2>&1" >> "$RESULT_FILE" 2>&1
        log "Test lane cleaned up"
    else
        print_error "Failed to create test lane"
    fi
else
    print_warning "Could not clone test repo, skipping lane creation test"
fi

log ""

# Step 6: Gather system info
print_info "Step 6: Gathering system information..."
log "--- System Info ---"

$SSH_CMD "uname -a" >> "$RESULT_FILE" 2>&1
$SSH_CMD "free -h" >> "$RESULT_FILE" 2>&1
$SSH_CMD "df -h" >> "$RESULT_FILE" 2>&1
$SSH_CMD "which bun && bun --version" >> "$RESULT_FILE" 2>&1
$SSH_CMD "ls -la ~/lane/" >> "$RESULT_FILE" 2>&1

print_success "System info collected"
log ""

# Step 7: Cleanup
print_info "Step 7: Cleaning up..."
log "--- Cleanup ---"

# Ask user if they want to keep the server
echo ""
read -p "Keep server for debugging? [y/N] " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "Deleting server $SERVER_ID..."
    hetzner "/servers/$SERVER_ID" -X DELETE >> "$RESULT_FILE" 2>&1
    print_success "Server deleted"

    # Also delete SSH key
    log "Deleting SSH key $SSH_KEY_ID..."
    hetzner "/ssh_keys/$SSH_KEY_ID" -X DELETE >> "$RESULT_FILE" 2>&1
    print_success "SSH key deleted"
else
    print_warning "Server kept running"
    log "Server IP: $SERVER_IPV4"
    log "SSH: ssh -i $SSH_KEY_FILE root@$SERVER_IPV4"
    log "To delete later:"
    log "  curl -X DELETE -H 'Authorization: Bearer $HETZNER_API_TOKEN' https://api.hetzner.cloud/v1/servers/$SERVER_ID"
fi

log ""

# Summary
log "╔══════════════════════════════════════════════════════════════╗"
log "║                    Test Summary                              ║"
log "╚══════════════════════════════════════════════════════════════╝"
log "Server: $SERVER_NAME ($SERVER_ID)"
log "IP: $SERVER_IPV4"
log "Results saved to: $RESULT_FILE"
log ""
log "To view results: less $RESULT_FILE"
log "╔══════════════════════════════════════════════════════════════╗"
log ""

print_success "Test complete! Results saved to $RESULT_FILE"
