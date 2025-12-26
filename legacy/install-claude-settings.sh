#!/bin/bash

# Dynamic Claude Settings Installation Script for node-starter
# This script generates Claude Code settings based on user preference

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETTINGS_TEMPLATE="${SCRIPT_DIR}/.claude/settings.template.json"
SETTINGS_LOCAL="${SCRIPT_DIR}/.claude/settings.local.json"
CLAUDE_SETTINGS_DIR="$HOME/.claude"
CLAUDE_SETTINGS_FILE="$CLAUDE_SETTINGS_DIR/settings.json"

# Load environment variables from .env if present
if [ -f "${SCRIPT_DIR}/.env" ]; then
    export $(cat "${SCRIPT_DIR}/.env" | grep -v '^#' | xargs)
fi

# Determine Claude configuration based on environment
AI_ASSISTANT="${AI_ASSISTANT:-claude}"

echo "🔧 Installing Claude Code settings for: $AI_ASSISTANT"

# Check if we're in the right directory
if [ ! -f "$SETTINGS_TEMPLATE" ]; then
    echo "❌ Error: Claude settings template not found. Please run this from the node-starter directory."
    exit 1
fi

# Create Claude settings directory if it doesn't exist
mkdir -p "$CLAUDE_SETTINGS_DIR"

# Backup existing settings if they exist
if [ -f "$CLAUDE_SETTINGS_FILE" ]; then
    echo "💾 Backing up existing Claude settings..."
    cp "$CLAUDE_SETTINGS_FILE" "$CLAUDE_SETTINGS_DIR/settings.json.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Generate settings based on AI assistant preference
case "$AI_ASSISTANT" in
    zai)
        echo "📋 Configuring Claude Code for Z.ai backend..."
        # Read values from environment, with fallbacks
        BASE_URL="${ANTHROPIC_BASE_URL:-https://api.z.ai/api/anthropic}"
        MODEL="${ANTHROPIC_MODEL:-glm-4.7}"
        FAST_MODEL="${ANTHROPIC_SMALL_FAST_MODEL:-glm-4.6}"

        cat > "$CLAUDE_SETTINGS_FILE" << EOF
{
  "\$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "ANTHROPIC_BASE_URL": "$BASE_URL",
    "ANTHROPIC_MODEL": "$MODEL",
    "ANTHROPIC_SMALL_FAST_MODEL": "$FAST_MODEL"
  },
  "mcpServers": {
    "zai-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@z_ai/mcp-server"
      ],
      "env": {
        "Z_AI_API_KEY": "\${Z_AI_API_KEY}",
        "Z_AI_MODE": "\${Z_AI_MODE:-ZAI}"
      }
    },
    "web-search-prime": {
      "type": "http",
      "url": "https://api.z.ai/api/mcp/web_search_prime/mcp",
      "headers": {
        "Authorization": "Bearer \${Z_AI_API_KEY}"
      }
    }
  },
  "bashAliases": {
    "python": "uv run python",
    "python3": "uv run python",
    "pip": "uv pip",
    "pip3": "uv pip",
    "pip install": "uv pip install",
    "pip3 install": "uv pip install"
  }
}
EOF
        echo "✅ Z.ai configuration applied!"
        echo ""
        echo "🎯 Settings configured for:"
        echo "   • Base URL: $BASE_URL"
        echo "   • Primary Model: $MODEL"
        echo "   • Fast Model: $FAST_MODEL"
        echo "   • Vision MCP Server: @z_ai/mcp-server"
        echo "   • Web Search MCP Server: Z.AI web search capabilities"
        echo "   • UV integration for Python"
        ;;
    *)
        echo "📋 Configuring Claude Code for Anthropic backend..."
        cat > "$CLAUDE_SETTINGS_FILE" << 'EOF'
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "bashAliases": {
    "python": "uv run python",
    "python3": "uv run python",
    "pip": "uv pip",
    "pip3": "uv pip",
    "pip install": "uv pip install",
    "pip3 install": "uv pip install"
  }
}
EOF
        echo "✅ Anthropic configuration applied!"
        echo ""
        echo "🎯 Settings configured for:"
        echo "   • Base URL: Default Anthropic endpoint"
        echo "   • Models: Default Anthropic models"
        echo "   • UV integration for Python"
        ;;
esac

# Also create local settings for project-specific overrides
if [ -f "$SETTINGS_LOCAL" ]; then
    echo "📋 Local settings file already exists"
else
    echo "📋 Creating local settings file..."
    # Copy the generated settings to local
    cp "$CLAUDE_SETTINGS_FILE" "$SETTINGS_LOCAL"
fi

# Set proper permissions
chmod 600 "$CLAUDE_SETTINGS_FILE" 2>/dev/null || true
chmod 600 "$SETTINGS_LOCAL" 2>/dev/null || true

echo ""
echo "💡 Usage:"
echo "   • For Z.ai: Make sure ZAI_API_KEY is set in your environment"
echo "   • For Anthropic: Make sure ANTHROPIC_API_KEY is set"
echo ""
echo "📝 Settings files:"
echo "   • Global: $CLAUDE_SETTINGS_FILE"
echo "   • Local: $SETTINGS_LOCAL"
echo ""
echo "🚀 Start Claude Code with:"
echo "   claude"