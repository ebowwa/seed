#!/bin/bash
# Claude Wrapper with Rolling API Keys
#
# This script selects an available API key from ANTHROPIC_API_KEYS
# and sets ANTHROPIC_API_KEY before spawning Claude Code.
#
# Usage: doppler run --project seed --config prd -- ./claude-wrapper.sh [claude args...]

set -e

# Get the ANTHROPIC_API_KEYS from environment (JSON array format)
# Example: ["key1","key2","key3"]
if [[ -n "$ANTHROPIC_API_KEYS" ]]; then
  # Parse JSON array and select first available key
  # This is a simple bash JSON parser - for production, use jq or node
  KEY_STRING="$ANTHROPIC_API_KEYS"

  # Extract keys using regex (removes brackets and quotes, splits by comma)
  KEYS=$(echo "$KEY_STRING" | sed 's/^\[//;s/\]$//' | sed 's/","/\n/g' | sed 's/"//g')

  # Select first key
  SELECTED_KEY=$(echo "$KEYS" | head -n 1)

  # Set ANTHROPIC_API_KEY to the selected key
  export ANTHROPIC_API_KEY="$SELECTED_KEY"

  echo "[Rolling Keys] Using key: ${SELECTED_KEY:0:20}..." >&2
fi

# Fall back to ANTHROPIC_AUTH_TOKEN if ANTHROPIC_API_KEY is not set
if [[ -z "$ANTHROPIC_API_KEY" && -n "$ANTHROPIC_AUTH_TOKEN" ]]; then
  export ANTHROPIC_API_KEY="$ANTHROPIC_AUTH_TOKEN"
fi

# Execute Claude Code with all arguments
exec claude "$@"
