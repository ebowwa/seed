#!/bin/bash
# Node Health Check Script
# Run this to verify system health

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_service() {
    local service=$1
    if systemctl is-active --quiet $service; then
        echo -e "${GREEN}✓${NC} $service"
        return 0
    else
        echo -e "${RED}✗${NC} $service"
        return 1
    fi
}

check_port() {
    local port=$1
    if ss -tlnp 2>/dev/null | grep -q ":$port "; then
        echo -e "${GREEN}✓${NC} Port $port listening"
        return 0
    else
        echo -e "${RED}✗${NC} Port $port not listening"
        return 1
    fi
}

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                    NODE HEALTH CHECK                               ║"
echo "║              $(date)            ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# System Resources
echo "=== System Resources ==="
echo "Uptime: $(uptime -p)"
echo "Load: $(cat /proc/loadavg | cut -d' ' -f1-3)"
echo "Memory: $(free -h | grep Mem | awk '{print $3 "/" $2 " (" int($3/$2*100) "%)"}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')"
echo ""

# Services
echo "=== Services ==="
FAILED=0
check_service node-agent.service || FAILED=1
check_service telegram-bot.service || FAILED=1
check_service tailscaled.service || FAILED=1
echo ""

# Network Ports
echo "=== Network Ports ==="
check_port 8911 || FAILED=1  # Node Agent API
echo ""

# Tailscale
echo "=== Tailscale ==="
TAILSCALE_IP=$(tailscale ip -4 2>/dev/null)
if [ -n "$TAILSCALE_IP" ]; then
    echo -e "${GREEN}✓${NC} Connected (IP: $TAILSCALE_IP)"
else
    echo -e "${RED}✗${NC} Not connected"
    FAILED=1
fi
echo ""

# Node Agent Status
echo "=== Node Agent Status ==="
if command -v curl &> /dev/null; then
    STATUS=$(curl -s http://localhost:8911/api/status 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} API responding"
        echo "  CPU: $(echo $STATUS | jq -r '.capacity.cpu_percent' 2>/dev/null || echo 'N/A')%"
        echo "  Memory: $(echo $STATUS | jq -r '.capacity.memory_percent' 2>/dev/null || echo 'N/A')%"
        echo "  Ralph Loops: $(echo $STATUS | jq '.ralph_loops | length' 2>/dev/null || echo 'N/A')"
        echo "  Worktrees: $(echo $STATUS | jq '.worktrees | length' 2>/dev/null || echo 'N/A')"
    else
        echo -e "${RED}✗${NC} API not responding"
        FAILED=1
    fi
else
    echo -e "${YELLOW}⚠${NC} curl not available, skipping API check"
fi
echo ""

# Git Status
echo "=== Git Status ==="
cd /root/repos/main-repo 2>/dev/null
if [ $? -eq 0 ]; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    STATUS=$(git status --porcelain 2>/dev/null)
    if [ -n "$BRANCH" ]; then
        echo -e "${GREEN}✓${NC} Repository on branch: $BRANCH"
        if [ -z "$STATUS" ]; then
            echo -e "${GREEN}✓${NC} Working tree clean"
        else
            echo -e "${YELLOW}⚠${NC} Uncommitted changes:"
            echo "$STATUS"
        fi
    else
        echo -e "${YELLOW}⚠${NC} No branch found"
    fi
else
    echo -e "${RED}✗${NC} Repository not found"
    FAILED=1
fi
echo ""

# Recent Errors
echo "=== Recent Errors (last hour) ==="
ERRORS=$(journalctl --since "1 hour ago" -p err -q 2>/dev/null | wc -l)
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No errors"
else
    echo -e "${YELLOW}⚠${NC} $ERRORS errors in last hour (check logs for details)"
fi
echo ""

# Summary
echo "╔═══════════════════════════════════════════════════════════════════╗"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}║                    ALL CHECKS PASSED ✓                         ║${NC}"
else
    echo -e "${RED}║                    SOME CHECKS FAILED ✗                        ║${NC}"
fi
echo "╚═══════════════════════════════════════════════════════════════════╝"

exit $FAILED
