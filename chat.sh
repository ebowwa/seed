#!/bin/bash
# Persistent chat with Claude Code via Doppler
# Usage: ./chat.sh "your prompt" [--project PROJECT] [--config CONFIG]
#
# Can also set via environment:
#   DOPPLER_PROJECT=myproj DOPPLER_CONFIG=dev ./chat.sh "hello"

CHAT_LOG="/tmp/c.txt"
DOPPLER_PROJECT="${DOPPLER_PROJECT:-seed}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-prd}"

# Parse args
PROMPT=""
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
        *)
            PROMPT="$PROMPT $1"
            shift
            ;;
    esac
done

# Trim leading space
PROMPT="${PROMPT# }"

if [ -z "$PROMPT" ]; then
    echo "Usage: $0 \"your prompt\" [--project PROJECT] [--config CONFIG]"
    echo "  Or set DOPPLER_PROJECT and DOPPLER_CONFIG env vars"
    exit 1
fi

if [ -f "$CHAT_LOG" ] && [ -s "$CHAT_LOG" ]; then
    FULL_PROMPT="Conversation history:\n$(cat "$CHAT_LOG")\n\n---\n\nNew message: $PROMPT"
else
    FULL_PROMPT="$PROMPT"
    echo "Starting new conversation." > "$CHAT_LOG"
fi

doppler run --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" -- claude "$FULL_PROMPT" 2>&1 | tee /tmp/c_response.txt

# Append to conversation log
echo "User: $PROMPT" >> "$CHAT_LOG"
echo "Assistant: $(cat /tmp/c_response.txt)" >> "$CHAT_LOG"
echo >> "$CHAT_LOG"
