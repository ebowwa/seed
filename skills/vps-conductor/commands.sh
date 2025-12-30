#!/bin/bash
# VPS Conductor Commands
# Helper commands for interacting with the VPS session manager

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

VPS_CONDUCTOR_HOST="${VPS_CONDUCTOR_HOST:-ebowwa-deptwar}"
VPS_CONDUCTOR_USER="${VPS_CONDUCTOR_USER:-root}"
VPS_CONDUCTOR_SEED_DIR="${VPS_CONDUCTOR_SEED_DIR:-/root/seed}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# Helper Functions
# ============================================================================

# Execute JSON-RPC request on VPS
vps_rpc() {
    local method="$1"
    local params="$2"
    local request_id="${3:-1}"

    # Remove newlines from params for inline JSON
    params=$(echo "$params" | tr -d '\n' | tr -s ' ')

    local request
    request=$(cat <<EOF
{"jsonrpc":"2.0","method":"$method","params":$params,"id":$request_id}
EOF
)

    echo "$request" | ssh "${VPS_CONDUCTOR_USER}@${VPS_CONDUCTOR_HOST}" "cd ${VPS_CONDUCTOR_SEED_DIR} && ./session-manager.sh"
}

# Check if response contains error
check_error() {
    local response="$1"

    if echo "$response" | grep -q '"error"'; then
        local error_msg
        error_msg=$(echo "$response" | grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
        echo -e "${RED}Error:${NC} $error_msg" >&2
        return 1
    fi

    return 0
}

# Pretty print JSON response
pretty_print_response() {
    local response="$1"

    if command -v jq >/dev/null 2>&1; then
        echo "$response" | jq '.'
    else
        echo "$response"
    fi
}

# ============================================================================
# Agent Lifecycle Commands
# ============================================================================

# List all agents
vps_list_agents() {
    echo -e "${BLUE}Listing agents on VPS...${NC}"

    local response
    response=$(vps_rpc "list_sessions" "{}")

    if check_error "$response"; then
        pretty_print_response "$response"

        # Parse and display in table format
        if command -v jq >/dev/null 2>&1; then
            echo ""
            echo -e "${BLUE}Active Sessions:${NC}"
            echo "$response" | jq -r '.result.sessions[] | "\(.name) | \(.role // "N/A") | \(.message_count) messages"'
        fi
    fi
}

# Create a new agent
vps_create_agent() {
    local agent_type="$1"
    local agent_name="$2"
    local system_prompt="${3:-}"

    if [ -z "$agent_type" ] || [ -z "$agent_name" ]; then
        echo -e "${RED}Usage: vps_create_agent <type> <name> [system_prompt]${NC}"
        return 1
    fi

    echo -e "${BLUE}Creating agent '$agent_name' of type '$agent_type'...${NC}"

    # Get system prompt from agent type
    if [ -z "$system_prompt" ]; then
        case "$agent_type" in
            code-reviewer)
                system_prompt="You are a code reviewer. Focus on readability, maintainability, and adherence to best practices."
                ;;
            test-writer)
                system_prompt="You are a test writer. Focus on coverage, edge cases, and clear test descriptions."
                ;;
            doc-generator)
                system_prompt="You are a documentation writer. Focus on clarity, completeness, and examples."
                ;;
            refactor-agent)
                system_prompt="You are a code refactoring specialist. Focus on improving structure while preserving behavior."
                ;;
            debugger)
                system_prompt="You are a debugging specialist. Focus on root cause analysis and minimal fixes."
                ;;
            security-auditor)
                system_prompt="You are a security auditor. Focus on OWASP Top 10, input validation, and secure coding practices."
                ;;
            *)
                system_prompt="You are a specialized AI assistant working on the seed project."
                ;;
        esac
    fi

    local params
    params=$(cat <<EOF
{
  "name": "$agent_name",
  "role": "$agent_type",
  "system_prompt": "$system_prompt",
  "metadata": {
    "tags": ["$agent_type"],
    "workspace": "$VPS_CONDUCTOR_SEED_DIR"
  }
}
EOF
)

    local response
    response=$(vps_rpc "create_session" "$params")

    if check_error "$response"; then
        echo -e "${GREEN}✓ Agent '$agent_name' created successfully${NC}"
        pretty_print_response "$response"
    fi
}

# Delete an agent
vps_delete_agent() {
    local agent_name="$1"

    if [ -z "$agent_name" ]; then
        echo -e "${RED}Usage: vps_delete_agent <name>${NC}"
        return 1
    fi

    echo -e "${YELLOW}Deleting agent '$agent_name'...${NC}"

    local params
    params="{\"name\": \"$agent_name\"}"

    local response
    response=$(vps_rpc "delete_session" "$params")

    if check_error "$response"; then
        echo -e "${GREEN}✓ Agent '$agent_name' deleted${NC}"
    fi
}

# Reset agent context
vps_reset_agent() {
    local agent_name="$1"

    if [ -z "$agent_name" ]; then
        echo -e "${RED}Usage: vps_reset_agent <name>${NC}"
        return 1
    fi

    echo -e "${YELLOW}Resetting context for agent '$agent_name'...${NC}"

    local params
    params="{\"name\": \"$agent_name\"}"

    local response
    response=$(vps_rpc "reset_session" "$params")

    if check_error "$response"; then
        echo -e "${GREEN}✓ Agent '$agent_name' context reset${NC}"
    fi
}

# Get agent status
vps_agent_status() {
    local agent_name="$1"

    if [ -z "$agent_name" ]; then
        echo -e "${RED}Usage: vps_agent_status <name>${NC}"
        return 1
    fi

    echo -e "${BLUE}Status for agent '$agent_name':${NC}"

    local params
    params="{\"name\": \"$agent_name\", \"include_context\": false}"

    local response
    response=$(vps_rpc "get_status" "$params")

    if check_error "$response"; then
        pretty_print_response "$response"
    fi
}

# ============================================================================
# Task Delegation Commands
# ============================================================================

# Send message to agent
vps_send() {
    local agent_name="$1"
    local message="$2"

    if [ -z "$agent_name" ] || [ -z "$message" ]; then
        echo -e "${RED}Usage: vps_send <agent> <message>${NC}"
        return 1
    fi

    echo -e "${BLUE}Sending message to '$agent_name'...${NC}"

    local params
    params="{\"session\": \"$agent_name\", \"message\": \"$message\", \"timeout\": 120}"

    local response
    response=$(vps_rpc "send_message" "$params")

    if check_error "$response"; then
        if command -v jq >/dev/null 2>&1; then
            echo "$response" | jq -r '.result.response'
        else
            echo "$response"
        fi
    fi
}

# Delegate file to appropriate agent
vps_delegate() {
    local file_path="$1"
    local agent_name="${2:-}"

    if [ -z "$file_path" ]; then
        echo -e "${RED}Usage: vps_delegate <file> [agent]${NC}"
        return 1
    fi

    # Determine agent type from file if not specified
    if [ -z "$agent_name" ]; then
        case "$file_path" in
            *.test.*|*test*.sh|tests/*)
                agent_name="test-writer"
                ;;
            *.md|docs/*)
                agent_name="doc-generator"
                ;;
            *setup*.sh|*security*|*auth*)
                agent_name="security-auditor"
                ;;
            *)
                agent_name="code-reviewer"
                ;;
        esac
    fi

    echo -e "${BLUE}Delegating '$file_path' to '$agent_name'...${NC}"

    # Read file content
    if [ ! -f "$file_path" ]; then
        echo -e "${RED}File not found: $file_path${NC}"
        return 1
    fi

    local file_content
    file_content=$(cat "$file_path")

    local message
    message="Please review this file: $file_path\n\nContent:\n$file_content"

    vps_send "$agent_name" "$message"
}

# ============================================================================
# System Commands
# ============================================================================

# Get VPS system status
vps_status() {
    echo -e "${BLUE}VPS System Status:${NC}"

    local response
    response=$(vps_rpc "get_system_status" "{}")

    if check_error "$response"; then
        if command -v jq >/dev/null 2>&1; then
            echo ""
            echo -e "${BLUE}System:${NC}"
            echo "$response" | jq -r '.result.system'
            echo ""
            echo -e "${BLUE}Sessions:${NC}"
            echo "$response" | jq -r '.result.sessions'
            echo ""
            echo -e "${BLUE}Resources:${NC}"
            echo "$response" | jq -r '.result.resources'
        else
            pretty_print_response "$response"
        fi
    fi
}

# Health check
vps_health() {
    echo -e "${BLUE}Running VPS health check...${NC}"

    local response
    response=$(vps_rpc "get_system_status" "{}")

    if check_error "$response"; then
        if command -v jq >/dev/null 2>&1; then
            local api_reachable
            api_reachable=$(echo "$response" | jq -r '.result.claude.api_reachable')

            if [ "$api_reachable" = "true" ]; then
                echo -e "${GREEN}✓${NC} API reachable"
            else
                echo -e "${RED}✗${NC} API not reachable"
            fi

            local total_sessions active_sessions
            total_sessions=$(echo "$response" | jq -r '.result.sessions.total')
            active_sessions=$(echo "$response" | jq -r '.result.sessions.active')
            echo -e "${GREEN}✓${NC} Sessions: $total_sessions total, $active_sessions active"

            local mem_percent
            mem_percent=$(echo "$response" | jq -r '.result.resources.memory_percent')
            echo "  Memory: ${mem_percent}%"
        fi
    fi
}
