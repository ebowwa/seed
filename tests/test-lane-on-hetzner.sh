#!/bin/bash

# Lane Installation Test on Hetzner VPS using hcloud CLI

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SERVER_NAME="lane-test-${TIMESTAMP}"
RESULTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/results"
mkdir -p "$RESULTS_DIR"

log "Lane Installation Test on Hetzner VPS"
log "======================================="
log "Server: $SERVER_NAME"
log "Results: $RESULTS_DIR"
echo ""

# Check hcloud is available
if ! command -v hcloud &> /dev/null; then
    error "hcloud CLI not found"
    log "Install: brew install hcloud"
    exit 1
fi

# Check hcloud context
if ! hcloud context active &> /dev/null; then
    error "No active hcloud context"
    log "Run: hcloud context create <name>"
    exit 1
fi

success "hcloud CLI ready"
echo ""

# Step 1: Create SSH key
log "Creating SSH key..."
SSH_KEY_NAME="lane-test-key-${TIMESTAMP}"
ssh-keygen -t ed25519 -f "${RESULTS_DIR}/test_key" -N "" -C "lane-test" 2>/dev/null

hcloud ssh-key create --name "$SSH_KEY_NAME" --public-key-from-file "${RESULTS_DIR}/test_key.pub" > /dev/null
success "SSH key created: $SSH_KEY_NAME"
echo ""

# Step 2: Create Hetzner server
log "Creating Hetzner server (cax11 - €3.09/month)..."
hcloud server create \
    --name "$SERVER_NAME" \
    --type cax11 \
    --image ubuntu-24.04 \
    --location fsn1 \
    --ssh-key "$SSH_KEY_NAME" \
    > "${RESULTS_DIR}/create-${TIMESTAMP}.json" 2>&1

SERVER_ID=$(grep -oP 'id:\s*\K\d+' "${RESULTS_DIR}/create-${TIMESTAMP}.json" | head -1)
success "Server created: ID $SERVER_ID"

# Get server IP
log "Waiting for server to start..."
sleep 5
SERVER_IP=$(hcloud server describe "$SERVER_NAME" -o json | jq -r '.server.public_net.ipv4.ip')
success "Server IP: $SERVER_IP"
echo ""

# Step 3: Wait for SSH
log "Waiting for SSH to be ready..."
for i in {1..30}; do
    if ssh -i "${RESULTS_DIR}/test_key" -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@"$SERVER_IP" "echo ready" 2>/dev/null | grep -q ready; then
        success "SSH is ready"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

# Step 4: Copy and run test on VPS
log "Copying test file to VPS..."
scp -i "${RESULTS_DIR}/test_key" -o StrictHostKeyChecking=no \
    "$(dirname "${BASH_SOURCE[0]}")/lane.test.ts" \
    "root@${SERVER_IP}:/tmp/lane.test.ts"

success "Test file copied"
echo ""

log "Running lane test on VPS..."
ssh -i "${RESULTS_DIR}/test_key" -o StrictHostKeyChecking=no "root@${SERVER_IP}" << 'ENDSSH'
set -e

# Install bun
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# Create test directory
mkdir -p /tmp/seed-test
cd /tmp/seed-test

# Copy test file
mv /tmp/lane.test.ts .

# Create mock v2 directory structure for imports
mkdir -p v2/src/tools v2/src/env

# Copy the actual tool files from the host (we'll need to clone seed)
echo "Cloning seed..."
git clone https://github.com/ebowwa/seed.git /tmp/seed > /dev/null 2>&1
cd /tmp/seed

# Run the test
echo "Running lane test..."
bun test tests/lane.test.ts

ENDSSH

echo ""

# Step 5: Collect results
log "Collecting results..."
scp -i "${RESULTS_DIR}/test_key" -o StrictHostKeyChecking=no \
    "root@${SERVER_IP}:/tmp/seed/test-results.log" \
    "${RESULTS_DIR}/vps-test-${TIMESTAMP}.log" 2>/dev/null || true

success "Results collected"
echo ""

# Step 6: Cleanup
log "Cleanup..."
read -p "Delete server '$SERVER_NAME'? [y/N] " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    hcloud server delete "$SERVER_NAME" -o json > "${RESULTS_DIR}/delete-${TIMESTAMP}.json"
    hcloud ssh-key delete "$SSH_KEY_NAME" > /dev/null
    success "Server and SSH key deleted"
else
    log "Server kept: $SERVER_NAME ($SERVER_IP)"
    log "SSH: ssh -i ${RESULTS_DIR}/test_key root@$SERVER_IP"
fi

echo ""
success "Test complete! Check ${RESULTS_DIR}/ for logs"
