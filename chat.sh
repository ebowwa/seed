#!/bin/bash
# Persistent chat with Claude Code via Doppler with session isolation
# Usage: ./chat.sh "your prompt" [--project PROJECT] [--config CONFIG] [--agent SESSION_NAME]
#
# Can also set via environment:
#   DOPPLER_PROJECT=myproj DOPPLER_CONFIG=dev ./chat.sh "hello"
#
# Session Management:
#   --agent NAME           Use named session (default: default)
#   --list-sessions        List all sessions with metadata
#   --create-session NAME  Create a new session
#   --delete-session NAME  Delete a session
#   --reset-session NAME  Clear context, keep metadata

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

DOPPLER_PROJECT="${DOPPLER_PROJECT:-seed}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-prd}"
SESSION_NAME="${SESSION_NAME:-default}"
SESSIONS_DIR="${HOME}/.claude/sessions"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================================
# Session Management Functions
# ============================================================================

# Get session directory path
get_session_dir() {
    local name="$1"
    echo "${SESSIONS_DIR}/${name}"
}

# Get context file path for a session
get_context_file() {
    local session_dir="$1"
    echo "${session_dir}/context.txt"
}

# Get metadata file path for a session
get_metadata_file() {
    local session_dir="$1"
    echo "${session_dir}/metadata.json"
}

# Ensure sessions directory exists
ensure_sessions_dir() {
    if [ ! -d "$SESSIONS_DIR" ]; then
        mkdir -p "$SESSIONS_DIR"
    fi
}

# Initialize a new session
init_session() {
    local name="$1"
    local session_dir
    session_dir="$(get_session_dir "$name")"
    
    ensure_sessions_dir
    
    if [ -d "$session_dir" ]; then
        echo "Error: Session '$name' already exists" >&2
        return 1
    fi
    
    mkdir -p "$session_dir"
    
    # Create empty context file
    touch "$(get_context_file "$session_dir")"
    
    # Create metadata
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    cat > "$(get_metadata_file "$session_dir")" <<EOF
{
  "name": "$name",
  "created_at": "$timestamp",
  "last_active": "$timestamp",
  "message_count": 0,
  "project": "$DOPPLER_PROJECT",
  "config": "$DOPPLER_CONFIG"
}
EOF
    
    echo -e "${GREEN}✓${NC} Created session '$name'"
    return 0
}

# Check if a session exists
session_exists() {
    local name="$1"
    local session_dir
    session_dir="$(get_session_dir "$name")"
    [ -d "$session_dir" ]
}

# Get session metadata as JSON string
get_session_metadata() {
    local name="$1"
    local session_dir
    session_dir="$(get_session_dir "$name")"
    local metadata_file
    metadata_file="$(get_metadata_file "$session_dir")"
    
    if [ -f "$metadata_file" ]; then
        cat "$metadata_file"
    else
        echo "{}"
    fi
}

# Update session metadata
update_session_metadata() {
    local name="$1"
    local session_dir
    session_dir="$(get_session_dir "$name")"
    local metadata_file
    metadata_file="$(get_metadata_file "$session_dir")"
    
    if [ ! -f "$metadata_file" ]; then
        return 1
    fi
    
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Use Python for reliable JSON update
    python3 << PYTHON_EOF
import json
from datetime import datetime

metadata_file = "$metadata_file"
timestamp = "$timestamp"

with open(metadata_file, "r") as f:
    data = json.load(f)

data["last_active"] = timestamp
data["message_count"] = data.get("message_count", 0) + 1

with open(metadata_file, "w") as f:
    json.dump(data, f, indent=2)
PYTHON_EOF
}

# List all sessions
list_sessions() {
    ensure_sessions_dir
    
    if [ -z "$(ls -A "$SESSIONS_DIR" 2>/dev/null)" ]; then
        echo -e "${YELLOW}No sessions found${NC}"
        return 0
    fi
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Sessions${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    for session_dir in "$SESSIONS_DIR"/*; do
        if [ -d "$session_dir" ]; then
            local name
            name=$(basename "$session_dir")
            local metadata_file
            metadata_file="$(get_metadata_file "$session_dir")"
            
            if [ -f "$metadata_file" ]; then
                local created_at last_active msg_count project config
                created_at=$(grep -o '"created_at"[[:space:]]*:[[:space:]]*"[^"]*"' "$metadata_file" | cut -d'"' -f4)
                last_active=$(grep -o '"last_active"[[:space:]]*:[[:space:]]*"[^"]*"' "$metadata_file" | cut -d'"' -f4)
                msg_count=$(grep -o '"message_count"[[:space:]]*:[[:space:]]*[0-9]*' "$metadata_file" | grep -o '[0-9]*$')
                project=$(grep -o '"project"[[:space:]]*:[[:space:]]*"[^"]*"' "$metadata_file" | cut -d'"' -f4)
                config=$(grep -o '"config"[[:space:]]*:[[:space:]]*"[^"]*"' "$metadata_file" | cut -d'"' -f4)
                
                echo -e "${CYAN}Session:${NC} $name"
                echo "  Created: ${created_at:-unknown}"
                echo "  Last Active: ${last_active:-unknown}"
                echo "  Messages: ${msg_count:-0}"
                echo "  Project: ${project:-$DOPPLER_PROJECT}"
                echo "  Config: ${config:-$DOPPLER_CONFIG}"
                echo ""
            else
                echo -e "${CYAN}Session:${NC} $name"
                echo -e "  ${YELLOW}⚠${NC} Metadata file missing"
                echo ""
            fi
        fi
    done
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Delete a session
delete_session() {
    local name="$1"
    
    if ! session_exists "$name"; then
        echo -e "${RED}Error:${NC} Session '$name' does not exist" >&2
        return 1
    fi
    
    local session_dir
    session_dir="$(get_session_dir "$name")"
    
    # Safety check for default session
    if [ "$name" = "default" ]; then
        read -p "Are you sure you want to delete the default session? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Cancelled"
            return 0
        fi
    fi
    
    rm -rf "$session_dir"
    echo -e "${GREEN}✓${NC} Deleted session '$name'"
    return 0
}

# Reset session context (clear conversation, keep metadata)
reset_session() {
    local name="$1"
    
    if ! session_exists "$name"; then
        echo -e "${RED}Error:${NC} Session '$name' does not exist" >&2
        return 1
    fi
    
    local session_dir
    session_dir="$(get_session_dir "$name")"
    local context_file
    context_file="$(get_context_file "$session_dir")"
    
    # Clear context file
    > "$context_file"
    
    # Reset message count in metadata
    local metadata_file
    metadata_file="$(get_metadata_file "$session_dir")"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    if command -v jq >/dev/null 2>&1; then
        local tmp_file="${metadata_file}.tmp"
        jq --arg ts "$timestamp" '
            .last_active = $ts |
            .message_count = 0
        ' "$metadata_file" > "$tmp_file" && mv "$tmp_file" "$metadata_file"
    else
        sed -i.tmp \
            -e "s/\"last_active\": \”[^”]*\”/\"last_active\": \"$timestamp\"/" \
            -e 's/"message_count": \([0-9]*\)/"message_count": 0/' \
            "$metadata_file"
        rm -f "${metadata_file}.tmp"
    fi
    
    echo -e "${GREEN}✓${NC} Reset session '$name' (context cleared, metadata preserved)"
    return 0
}

# Ensure default session exists
ensure_default_session() {
    if ! session_exists "default"; then
        init_session "default"
    fi
}

# ============================================================================
# Argument Parsing
# ============================================================================

PROMPT=""
LIST_SESSIONS=false
CREATE_SESSION=""
DELETE_SESSION=""
RESET_SESSION=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --project)
            DOPPLER_PROJECT="$2"
            shift 2
            ;;
        --config)
            DOPPLER_CONFIG="$2"
            shift 2
            ;;
        --agent)
            SESSION_NAME="$2"
            shift 2
            ;;
        --list-sessions)
            LIST_SESSIONS=true
            shift
            ;;
        --create-session)
            CREATE_SESSION="$2"
            shift 2
            ;;
        --delete-session)
            DELETE_SESSION="$2"
            shift 2
            ;;
        --reset-session)
            RESET_SESSION="$2"
            shift 2
            ;;
        *)
            PROMPT="$PROMPT $1"
            shift
            ;;
    esac
done

# Trim leading space
PROMPT="${PROMPT# }"

# ============================================================================
# Command Handlers
# ============================================================================

# Handle --list-sessions
if [ "$LIST_SESSIONS" = true ]; then
    list_sessions
    exit $?
fi

# Handle --create-session
if [ -n "$CREATE_SESSION" ]; then
    init_session "$CREATE_SESSION"
    exit $?
fi

# Handle --delete-session
if [ -n "$DELETE_SESSION" ]; then
    delete_session "$DELETE_SESSION"
    exit $?
fi

# Handle --reset-session
if [ -n "$RESET_SESSION" ]; then
    reset_session "$RESET_SESSION"
    exit $?
fi

# ============================================================================
# Main Chat Logic
# ============================================================================

# Validate prompt
if [ -z "$PROMPT" ]; then
    echo "Usage: $0 \"your prompt\" [--project PROJECT] [--config CONFIG] [--agent SESSION_NAME]"
    echo ""
    echo "Session Management:"
    echo "  --agent NAME           Use named session (default: default)"
    echo "  --list-sessions        List all sessions with metadata"
    echo "  --create-session NAME  Create a new session"
    echo "  --delete-session NAME  Delete a session"
    echo "  --reset-session NAME  Clear context, keep metadata"
    echo ""
    echo "Environment:"
    echo "  DOPPLER_PROJECT        Doppler project name (default: seed)"
    echo "  DOPPLER_CONFIG         Doppler config name (default: prd)"
    echo "  SESSION_NAME           Session name (default: default)"
    exit 1
fi

# Ensure session exists
ensure_sessions_dir
if ! session_exists "$SESSION_NAME"; then
    echo -e "${YELLOW}Session '$SESSION_NAME' does not exist. Creating...${NC}"
    init_session "$SESSION_NAME"
fi

# Get session paths
SESSION_DIR="$(get_session_dir "$SESSION_NAME")"
CHAT_LOG="$(get_context_file "$SESSION_DIR")"
RESPONSE_FILE="/tmp/c_response_${SESSION_NAME}.txt"

# Build full prompt with context
if [ -f "$CHAT_LOG" ] && [ -s "$CHAT_LOG" ]; then
    FULL_PROMPT="Conversation history:\n$(cat "$CHAT_LOG")\n\n---\n\nNew message: $PROMPT"
else
    FULL_PROMPT="$PROMPT"
    echo "Starting new conversation in session '$SESSION_NAME'." > "$CHAT_LOG"
fi

# Execute Claude via Doppler
doppler run --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" -- claude "$FULL_PROMPT" 2>&1 | tee "$RESPONSE_FILE"

# Append to conversation log
echo "User: $PROMPT" >> "$CHAT_LOG"
echo "Assistant: $(cat "$RESPONSE_FILE")" >> "$CHAT_LOG"
echo >> "$CHAT_LOG"

# Update session metadata
update_session_metadata "$SESSION_NAME"

exit 0
