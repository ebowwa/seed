#!/bin/bash
CHAT_LOG="/tmp/c.txt"
PROMPT="$*"

if [ -f "$CHAT_LOG" ] && [ -s "$CHAT_LOG" ]; then
    FULL_PROMPT="Conversation history:\n$(cat "$CHAT_LOG")\n\n---\n\nNew message: $PROMPT"
else
    FULL_PROMPT="$PROMPT"
    echo "Starting new conversation." > "$CHAT_LOG"
fi

doppler run --project seed --config prd -- claude "$FULL_PROMPT" 2>&1 | tee /tmp/c_response.txt

# Append to conversation log
echo "User: $PROMPT" >> "$CHAT_LOG"
echo "Assistant: $(cat /tmp/c_response.txt)" >> "$CHAT_LOG"
echo >> "$CHAT_LOG"
