#!/bin/bash
# Session Manager for Multi-Session Claude Orchestration
# JSON-RPC 2.0 server over stdin/stdout for desktop conductor communication
#
# Usage:
#   echo '{"jsonrpc":"2.0","method":"create_session","params":{"name":"test"},"id":1}' | ./session-manager.sh
#   ssh server "cd ~/seed && ./session-manager.sh" < request.json

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSIONS_DIR="${HOME}/.claude/sessions"
DOPPLER_PROJECT="${DOPPLER_PROJECT:-seed}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-prd}"
LOCK_TIMEOUT="${LOCK_TIMEOUT:-30}"

# ============================================================================
# Logging and Output
# ============================================================================

log_debug() {
    if [ "${DEBUG:-false}" = "true" ]; then
        echo "[DEBUG] $*" >&2
    fi
}

log_error() {
    echo "[ERROR] $*" >&2
}

# ============================================================================
# JSON-RPC Response Builders
# ============================================================================

json_rpc_success() {
    local id="$1"
    local result="$2"
    cat <<EOF
{"jsonrpc":"2.0","result":$result,"id":$id}
EOF
}

json_rpc_error() {
    local id="$1"
    local code="$2"
    local message="$3"
    local data="${4:-null}"
    cat <<EOF
{"jsonrpc":"2.0","error":{"code":$code,"message":"$message","data":$data},"id":$id}
EOF
}

# ============================================================================
# Session Management Functions
# ============================================================================

# Validate session name (alphanumeric, dash, underscore only)
validate_session_name() {
    local name="$1"
    if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        return 1
    fi
    return 0
}

# Get session directory path
get_session_dir() {
    local name="$1"
    echo "${SESSIONS_DIR}/${name}"
}

# Get metadata file path
get_metadata_file() {
    local session_dir="$1"
    echo "${session_dir}/metadata.json"
}

# Get context file path
get_context_file() {
    local session_dir="$1"
    echo "${session_dir}/context.txt"
}

# Get lock file path
get_lock_file() {
    local session_dir="$1"
    echo "${session_dir}/.lock"
}

# Ensure sessions directory exists
ensure_sessions_dir() {
    if [ ! -d "$SESSIONS_DIR" ]; then
        mkdir -p "$SESSIONS_DIR"
    fi
}

# Check if session exists
session_exists() {
    local name="$1"
    local session_dir
    session_dir="$(get_session_dir "$name")"
    [ -d "$session_dir" ]
}

# Acquire session lock with timeout
acquire_lock() {
    local session_name="$1"
    local session_dir
    session_dir="$(get_session_dir "$session_name")"
    local lock_file
    lock_file="$(get_lock_file "$session_dir")"
    local timeout="${LOCK_TIMEOUT}"
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        if mkdir "$lock_file" 2>/dev/null; then
            # Lock acquired, store PID
            echo $$ > "${lock_file}/pid"
            return 0
        fi

        # Check if lock is stale (process no longer running)
        if [ -f "${lock_file}/pid" ]; then
            local lock_pid
            lock_pid=$(cat "${lock_file}/pid" 2>/dev/null || echo "0")
            if [ -n "$lock_pid" ] && [ "$lock_pid" != "0" ]; then
                if ! kill -0 "$lock_pid" 2>/dev/null; then
                    # Process is dead, remove stale lock
                    rm -rf "$lock_file"
                    log_debug "Removed stale lock for session $session_name (PID $lock_pid)"
                    continue
                fi
            fi
        fi

        sleep 0.1
        elapsed=$((elapsed + 1))
    done

    return 1
}

# Release session lock
release_lock() {
    local session_name="$1"
    local session_dir
    session_dir="$(get_session_dir "$session_name")"
    local lock_file
    lock_file="$(get_lock_file "$session_dir")"

    if [ -d "$lock_file" ]; then
        rm -rf "$lock_file"
    fi
}

# Get current timestamp in ISO 8601 format
get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# ============================================================================
# Method Implementations
# ============================================================================

# create_session: Create a new agent session
method_create_session() {
    local params="$1"
    local name role system_prompt project config metadata_json
    local session_dir metadata_file timestamp

    # Extract parameters
    name=$(echo "$params" | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
    role=$(echo "$params" | grep -o '"role"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
    system_prompt=$(echo "$params" | grep -o '"system_prompt"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")

    # Extract config
    local config_block
    config_block=$(echo "$params" | grep -o '"config"[[:space:]]*:[[:space:]]*{[^}]*}' || echo "")
    if [ -n "$config_block" ]; then
        project=$(echo "$config_block" | grep -o '"project"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
        config=$(echo "$config_block" | grep -o '"config"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
    fi
    project="${project:-$DOPPLER_PROJECT}"
    config="${config:-$DOPPLER_CONFIG}"

    # Validate
    if [ -z "$name" ]; then
        json_rpc_error "$id" -32602 "Missing required parameter: name"
        return
    fi

    if ! validate_session_name "$name"; then
        json_rpc_error "$id" -32003 "Invalid session name: must contain only alphanumeric characters, dashes, and underscores"
        return
    fi

    ensure_sessions_dir

    if session_exists "$name"; then
        json_rpc_error "$id" -32001 "Session already exists: $name"
        return
    fi

    # Create session directory
    session_dir="$(get_session_dir "$name")"
    mkdir -p "$session_dir"

    # Create empty context file
    touch "$(get_context_file "$session_dir")"

    # Create metadata
    timestamp=$(get_timestamp)
    metadata_file="$(get_metadata_file "$session_dir")"

    # Extract additional metadata if present
    local tags workspace
    tags=$(echo "$params" | grep -o '"tags"[[:space:]]*:[[:space:]]*\[[^]]*\]' || echo "[]")
    workspace=$(echo "$params" | grep -o '"workspace"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")

    cat > "$metadata_file" <<EOF
{
  "name": "$name",
  "role": ${role:-null},
  "system_prompt": ${system_prompt:-null},
  "created_at": "$timestamp",
  "last_active": "$timestamp",
  "message_count": 0,
  "config": {
    "project": "$project",
    "config": "$config"
  },
  "metadata": {
    "tags": $tags,
    "workspace": ${workspace:-null}
  }
}
EOF

    # Build result
    json_rpc_success "$id" "$(cat <<EOF
{
  "session": {
    "name": "$name",
    "created_at": "$timestamp",
    "role": ${role:-null},
    "message_count": 0,
    "config": {
      "project": "$project",
      "config": "$config"
    },
    "metadata": {
      "tags": $tags,
      "workspace": ${workspace:-null}
    }
  }
}
EOF
)"
}

# delete_session: Delete a session
method_delete_session() {
    local params="$1"
    local name session_dir

    name=$(echo "$params" | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

    if [ -z "$name" ]; then
        json_rpc_error "$id" -32602 "Missing required parameter: name"
        return
    fi

    if ! session_exists "$name"; then
        json_rpc_error "$id" -32000 "Session not found: $name"
        return
    fi

    session_dir="$(get_session_dir "$name")"
    rm -rf "$session_dir"

    json_rpc_success "$id" '{"deleted":true,"name":"'"$name"'"}'
}

# list_sessions: List all sessions
method_list_sessions() {
    local params="$1"
    local filter_tag min_messages

    # Extract filter parameters
    filter_tag=$(echo "$params" | grep -o '"tag"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
    min_messages=$(echo "$params" | grep -o '"min_messages"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$' || echo "")

    ensure_sessions_dir

    if [ -z "$(ls -A "$SESSIONS_DIR" 2>/dev/null)" ]; then
        json_rpc_success "$id" '{"sessions":[],"total":0}'
        return
    fi

    local sessions_json="["
    local first=true

    for session_dir in "$SESSIONS_DIR"/*; do
        if [ -d "$session_dir" ]; then
            local name metadata_file
            name=$(basename "$session_dir")
            metadata_file="$(get_metadata_file "$session_dir")"

            if [ -f "$metadata_file" ]; then
                # Apply filters if specified
                if [ -n "$filter_tag" ]; then
                    if ! grep -q "\"$filter_tag\"" "$metadata_file" 2>/dev/null; then
                        continue
                    fi
                fi

                if [ -n "$min_messages" ]; then
                    local msg_count
                    msg_count=$(grep -o '"message_count"[[:space:]]*:[[:space:]]*[0-9]*' "$metadata_file" | grep -o '[0-9]*$' || echo "0")
                    if [ "$msg_count" -lt "$min_messages" ]; then
                        continue
                    fi
                fi

                # Build session JSON (read file and format)
                local session_data
                session_data=$(cat "$metadata_file")

                if [ "$first" = true ]; then
                    first=false
                else
                    sessions_json="${sessions_json},"
                fi

                # Extract fields for cleaner output
                local created_at last_active msg_count project config
                created_at=$(echo "$session_data" | grep -o '"created_at"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
                last_active=$(echo "$session_data" | grep -o '"last_active"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
                msg_count=$(echo "$session_data" | grep -o '"message_count"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$' || echo "0")
                project=$(echo "$session_data" | grep -o '"project"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "$DOPPLER_PROJECT")
                config=$(echo "$session_data" | grep -o '"config"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "$DOPPLER_CONFIG")
                local role tags workspace
                role=$(echo "$session_data" | grep -o '"role"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "null")
                tags=$(echo "$session_data" | grep -o '"tags"[[:space:]]*:[[:space:]]*\[[^]]*\]' || echo "[]")
                workspace=$(echo "$session_data" | grep -o '"workspace"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "null")

                sessions_json="${sessions_json}{
  \"name\": \"$name\",
  \"role\": $role,
  \"created_at\": \"$created_at\",
  \"last_active\": \"$last_active\",
  \"message_count\": ${msg_count:-0},
  \"config\": {
    \"project\": \"$project\",
    \"config\": \"$config\"
  },
  \"metadata\": {
    \"tags\": $tags,
    \"workspace\": $workspace
  }
}"
            fi
        fi
    done

    local total
    total=$(echo "$sessions_json" | grep -o '"name"' | wc -l)

    sessions_json="${sessions_json}]"

    json_rpc_success "$id" '{"sessions":'"$sessions_json"',"total":'"$total"'}'
}

# get_status: Get detailed status of a session
method_get_status() {
    local params="$1"
    local name session_dir metadata_file context_file include_context

    name=$(echo "$params" | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    include_context=$(echo "$params" | grep -o '"include_context"[[:space:]]*:[[:space:]]*true' || echo "")

    if [ -z "$name" ]; then
        json_rpc_error "$id" -32602 "Missing required parameter: name"
        return
    fi

    if ! session_exists "$name"; then
        json_rpc_error "$id" -32000 "Session not found: $name"
        return
    fi

    session_dir="$(get_session_dir "$name")"
    metadata_file="$(get_metadata_file "$session_dir")"
    context_file="$(get_context_file "$session_dir")"

    # Check if locked
    local locked="false"
    local lock_file
    lock_file="$(get_lock_file "$session_dir")"
    if [ -d "$lock_file" ]; then
        locked="true"
    fi

    # Get context preview
    local context_preview="null"
    if [ -f "$context_file" ] && [ -s "$context_file" ]; then
        context_preview=$(head -c 500 "$context_file" | sed 's/"/\\"/g' | tr '\n' '\\n')
        context_preview="\"${context_preview}\""
    fi

    # Read metadata
    local metadata_json
    metadata_json=$(cat "$metadata_file")

    # Build response
    json_rpc_success "$id" "$(cat <<EOF
{
  "session": $metadata_json,
  "locked": $locked,
  "context_preview": $context_preview
}
EOF
)"
}

# send_message: Send a message to a session
method_send_message() {
    local params="$1"
    local session_name message timeout stream
    local session_dir context_file metadata_file
    local response timestamp

    session_name=$(echo "$params" | grep -o '"session"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    message=$(echo "$params" | grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    timeout=$(echo "$params" | grep -o '"timeout"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$' || echo "120")
    stream=$(echo "$params" | grep -o '"stream"[[:space:]]*:[[:space:]]*true' || echo "")

    if [ -z "$session_name" ] || [ -z "$message" ]; then
        json_rpc_error "$id" -32602 "Missing required parameters: session, message"
        return
    fi

    if ! session_exists "$session_name"; then
        json_rpc_error "$id" -32000 "Session not found: $session_name"
        return
    fi

    session_dir="$(get_session_dir "$session_name")"
    context_file="$(get_context_file "$session_dir")"
    metadata_file="$(get_metadata_file "$session_dir")"

    # Get config from metadata
    local project config
    project=$(grep -o '"project"[[:space:]]*:[[:space:]]*"[^"]*"' "$metadata_file" | cut -d'"' -f4 || echo "$DOPPLER_PROJECT")
    config=$(grep -o '"config"[[:space:]]*:[[:space:]]*"[^"]*"' "$metadata_file" | cut -d'"' -f4 || echo "$DOPPLER_CONFIG")

    # Acquire lock
    if ! acquire_lock "$session_name"; then
        json_rpc_error "$id" -32002 "Lock timeout: failed to acquire lock for session $session_name"
        return
    fi

    # Build full prompt with context
    local full_prompt response_file
    response_file="/tmp/claude_response_${session_name}_$$.txt"

    if [ -f "$context_file" ] && [ -s "$context_file" ]; then
        full_prompt="Conversation history:\n$(cat "$context_file")\n\n---\n\nNew message: $message"
    else
        full_prompt="$message"
        echo "Starting new conversation." > "$context_file"
    fi

    # Execute Claude via Doppler
    local response exit_code
    response=$(timeout "$timeout" doppler run --project "$project" --config "$config" -- claude "$full_prompt" 2>&1 | tee "$response_file")
    exit_code=$?

    # Append to context
    echo "User: $message" >> "$context_file"
    echo "Assistant: $response" >> "$context_file"
    echo >> "$context_file"

    # Update metadata
    timestamp=$(get_timestamp)
    local msg_count tmp_file
    msg_count=$(grep -o '"message_count"[[:space:]]*:[[:space:]]*[0-9]*' "$metadata_file" | grep -o '[0-9]*$' || echo "0")
    msg_count=$((msg_count + 1))
    tmp_file="${metadata_file}.tmp"

    if command -v jq >/dev/null 2>&1; then
        jq --arg ts "$timestamp" --arg mc "$msg_count" '
            .last_active = $ts |
            .message_count = ($mc | tonumber)
        ' "$metadata_file" > "$tmp_file" && mv "$tmp_file" "$metadata_file"
    else
        # Fallback: simple sed replacement
        sed -i.tmp \
            -e "s/\"last_active\":[[:space:]]*\"[^\"]*\"/\"last_active\": \"$timestamp\"/" \
            -e "s/\"message_count\":[[:space:]]*[0-9]*/\"message_count\": $msg_count/" \
            "$metadata_file"
        rm -f "${metadata_file}.tmp"
    fi

    # Clean up response file
    rm -f "$response_file"

    # Release lock
    release_lock "$session_name"

    # Check for execution errors
    if [ $exit_code -eq 124 ]; then
        json_rpc_error "$id" -32004 "Execution timeout after ${timeout}s"
        return
    elif [ $exit_code -ne 0 ]; then
        json_rpc_error "$id" -32004 "Claude execution failed with exit code $exit_code"
        return
    fi

    # Build response (escape newlines and quotes)
    local escaped_response
    escaped_response=$(echo "$response" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' '\\n')

    json_rpc_success "$id" "$(cat <<EOF
{
  "session": "$session_name",
  "response": "$escaped_response",
  "timestamp": "$timestamp",
  "message_index": $msg_count
}
EOF
)"
}

# reset_session: Clear conversation context
method_reset_session() {
    local params="$1"
    local name session_dir context_file metadata_file timestamp

    name=$(echo "$params" | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

    if [ -z "$name" ]; then
        json_rpc_error "$id" -32602 "Missing required parameter: name"
        return
    fi

    if ! session_exists "$name"; then
        json_rpc_error "$id" -32000 "Session not found: $name"
        return
    fi

    session_dir="$(get_session_dir "$name")"
    context_file="$(get_context_file "$session_dir")"
    metadata_file="$(get_metadata_file "$session_dir")"

    # Clear context
    > "$context_file"

    # Reset message count in metadata
    timestamp=$(get_timestamp)
    local tmp_file="${metadata_file}.tmp"

    if command -v jq >/dev/null 2>&1; then
        jq --arg ts "$timestamp" '
            .last_active = $ts |
            .message_count = 0
        ' "$metadata_file" > "$tmp_file" && mv "$tmp_file" "$metadata_file"
    else
        sed -i.tmp \
            -e "s/\"last_active\":[[:space:]]*\"[^\"]*\"/\"last_active\": \"$timestamp\"/" \
            -e "s/\"message_count\":[[:space:]]*[0-9]*/\"message_count\": 0/" \
            "$metadata_file"
        rm -f "${metadata_file}.tmp"
    fi

    json_rpc_success "$id" '{"reset":true,"name":"'"$name"'","message_count":0}'
}

# broadcast_message: Send message to multiple sessions
method_broadcast_message() {
    local params="$1"
    local sessions_json message timeout
    local results_json="["
    local first=true successful=0 failed=0

    # Extract parameters
    sessions_json=$(echo "$params" | grep -o '"sessions"[[:space:]]*:[[:space:]]*\[[^]]*\]' | sed 's/"sessions"[[:space:]]*:[[:space:]]*//' || echo "[]")
    message=$(echo "$params" | grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    timeout=$(echo "$params" | grep -o '"timeout"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$' || echo "120")

    if [ -z "$sessions_json" ] || [ "$sessions_json" = "[]" ] || [ -z "$message" ]; then
        json_rpc_error "$id" -32602 "Missing required parameters: sessions, message"
        return
    fi

    # Extract session names from JSON array
    local session_names=()
    while IFS= read -r line; do
        if [[ "$line" =~ \"([^\"]+)\" ]]; then
            session_names+=("${BASH_REMATCH[1]}")
        fi
    done < <(echo "$sessions_json" | tr ',' '\n')

    # Send to each session in parallel
    local pids=()
    local temp_files=()

    for session_name in "${session_names[@]}"; do
        if ! session_exists "$session_name"; then
            # Session doesn't exist, add error result
            if [ "$first" = true ]; then
                first=false
            else
                results_json="${results_json},"
            fi
            failed=$((failed + 1))
            results_json="${results_json}{
  \"session\": \"$session_name\",
  \"success\": false,
  \"error\": \"Session not found\"
}"
            continue
        fi

        # Create temp file for this session's result
        local temp_file="/tmp/broadcast_${session_name}_$$.json"
        temp_files+=("$temp_file")

        # Build JSON-RPC request for send_message
        local request="{\"jsonrpc\":\"2.0\",\"method\":\"send_message\",\"params\":{\"session\":\"$session_name\",\"message\":\"$message\",\"timeout\":$timeout},\"id\":0}"

        # Execute in background
        (
            response=$(echo "$request" | "$0" 2>/dev/null)
            echo "$response" > "$temp_file"
        ) &
        pids+=($!)
    done

    # Wait for all background jobs and collect results
    for i in "${!pids[@]}"; do
        wait "${pids[$i]}" 2>/dev/null || true
        local temp_file="${temp_files[$i]}"
        local session_name="${session_names[$i]}"

        if [ -f "$temp_file" ]; then
            local response
            response=$(cat "$temp_file")

            if [ "$first" = true ]; then
                first=false
            else
                results_json="${results_json},"
            fi

            # Check if response contains error
            if echo "$response" | grep -q '"error"'; then
                failed=$((failed + 1))
                local error_msg
                error_msg=$(echo "$response" | grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
                results_json="${results_json}{
  \"session\": \"$session_name\",
  \"success\": false,
  \"error\": \"$error_msg\"
}"
            else
                successful=$((successful + 1))
                local resp_text resp_timestamp
                resp_text=$(echo "$response" | grep -o '"response"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4- | sed 's/^"//;s/"$//' | sed 's/\\"/"/g' | sed 's/\\n/\n/g')
                resp_timestamp=$(echo "$response" | grep -o '"timestamp"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
                results_json="${results_json}{
  \"session\": \"$session_name\",
  \"success\": true,
  \"response\": \"${resp_text}\",
  \"timestamp\": \"${resp_timestamp}\"
}"
            fi

            rm -f "$temp_file"
        fi
    done

    results_json="${results_json}]"

    json_rpc_success "$id" "$(cat <<EOF
{
  "results": $results_json,
  "summary": {
    "total": $((successful + failed)),
    "successful": $successful,
    "failed": $failed
  }
}
EOF
)"
}

# get_system_status: Get overall system status
method_get_system_status() {
    local hostname load uptime mem_percent disk_percent
    local claude_version backend api_reachable
    local timestamp total_sessions active_sessions idle_sessions

    hostname=$(hostname 2>/dev/null || echo "unknown")
    load=$(cat /proc/loadavg 2>/dev/null | awk '{print "["$1", "$2", "$3"]"}' || echo "[0, 0, 0]")
    uptime=$(cat /proc/uptime 2>/dev/null | awk '{print $1}' || echo "0")

    # Memory usage
    if [ -f /proc/meminfo ]; then
        local mem_total mem_available
        mem_total=$(grep '^MemTotal:' /proc/meminfo | awk '{print $2}')
        mem_available=$(grep '^MemAvailable:' /proc/meminfo | awk '{print $2}')
        if [ -n "$mem_total" ] && [ -n "$mem_available" ]; then
            mem_percent=$(( (mem_total - mem_available) * 100 / mem_total ))
        else
            mem_percent=0
        fi
    else
        mem_percent=0
    fi

    # Disk usage
    if command -v df >/dev/null 2>&1; then
        disk_percent=$(df "$HOME" 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%' || echo "0")
    else
        disk_percent=0
    fi

    # Claude info
    if command -v claude >/dev/null 2>&1; then
        claude_version=$(claude --version 2>/dev/null | head -n1 || echo "installed")
    else
        claude_version="not installed"
    fi

    backend="${AI_ASSISTANT:-${DEFAULT_AI_ASSISTANT:-claude}}"

    # API reachability
    if command -v curl >/dev/null 2>&1; then
        local api_url="${ANTHROPIC_BASE_URL:-https://api.z.ai/api/anthropic}"
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" "$api_url" 2>/dev/null || echo "000")
        if [ "$http_code" = "200" ] || [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
            api_reachable="true"
        else
            api_reachable="false"
        fi
    else
        api_reachable="null"
    fi

    # Session counts
    ensure_sessions_dir
    total_sessions=0
    active_sessions=0
    idle_sessions=0

    if [ -d "$SESSIONS_DIR" ]; then
        total_sessions=$(find "$SESSIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
        # Count active (with lock) vs idle
        for session_dir in "$SESSIONS_DIR"/*; do
            if [ -d "$session_dir" ]; then
                local lock_file
                lock_file="$(get_lock_file "$session_dir")"
                if [ -d "$lock_file" ]; then
                    active_sessions=$((active_sessions + 1))
                else
                    idle_sessions=$((idle_sessions + 1))
                fi
            fi
        done
    fi

    timestamp=$(get_timestamp)

    json_rpc_success "$id" "$(cat <<EOF
{
  "system": {
    "hostname": "$hostname",
    "load_average": $load,
    "uptime": $uptime,
    "timestamp": "$timestamp"
  },
  "sessions": {
    "total": $total_sessions,
    "active": $active_sessions,
    "idle": $idle_sessions
  },
  "resources": {
    "memory_percent": $mem_percent,
    "disk_percent": $disk_percent
  },
  "claude": {
    "version": "$claude_version",
    "backend": "$backend",
    "api_reachable": $api_reachable
  }
}
EOF
)"
}

# ============================================================================
# Main Request Handler
# ============================================================================

handle_request() {
    local request="$1"
    local method params id jsonrpc

    # Parse JSON-RPC request using jq if available, fallback to regex
    if command -v jq >/dev/null 2>&1; then
        jsonrpc=$(echo "$request" | jq -r '.jsonrpc // "2.0"')
        method=$(echo "$request" | jq -r '.method // empty')
        id=$(echo "$request" | jq -r '.id // empty')
        params=$(echo "$request" | jq -c '.params // {}')
    else
        jsonrpc=$(echo "$request" | grep -o '"jsonrpc"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
        method=$(echo "$request" | grep -o '"method"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
        id=$(echo "$request" | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$')
        # Extract params by removing everything except params object
        params=$(echo "$request" | sed -n 's/.*"params":[[:space:]]*\({.*}\)[[:space:]]*,*[[:space:]]*"id".*/\1/p' || echo "{}")
    fi

    # Validate JSON-RPC version
    if [ "$jsonrpc" != "2.0" ]; then
        json_rpc_error "$id" -32600 "Invalid JSON-RPC version"
        return
    fi

    # Validate method
    if [ -z "$method" ]; then
        json_rpc_error "$id" -32600 "Missing method"
        return
    fi

    # Route to appropriate method handler
    case "$method" in
        create_session)
            method_create_session "$params"
            ;;
        delete_session)
            method_delete_session "$params"
            ;;
        list_sessions)
            method_list_sessions "$params"
            ;;
        get_status)
            method_get_status "$params"
            ;;
        send_message)
            method_send_message "$params"
            ;;
        reset_session)
            method_reset_session "$params"
            ;;
        broadcast_message)
            method_broadcast_message "$params"
            ;;
        get_system_status)
            method_get_system_status
            ;;
        *)
            json_rpc_error "$id" -32601 "Method not found: $method"
            ;;
    esac
}

# ============================================================================
# Main Entry Point
# ============================================================================

main() {
    # Read request from stdin
    local request
    request=$(cat)

    # Validate JSON
    if ! echo "$request" | jq -e '.' >/dev/null 2>&1; then
        # jq not available or invalid JSON, do basic validation
        if [[ ! "$request" =~ \{.*\} ]]; then
            json_rpc_error "null" -32700 "Parse error: Invalid JSON"
            return 1
        fi
    fi

    # Handle the request
    handle_request "$request"
}

# Run main if script is executed (not sourced)
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
