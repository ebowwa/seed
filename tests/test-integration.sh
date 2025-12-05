#!/bin/bash

# Test script for Claude Code + GLM-4.5 + Doppler integration
# This script demonstrates how the complete setup works together

echo "🚀 Testing Claude Code + GLM-4.5 + Doppler Integration"
echo "=================================================="

# Test 1: Check Doppler configuration
echo ""
echo "📋 Test 1: Doppler Configuration"
echo "----------------------------------"
if doppler whoami > /dev/null 2>&1; then
    echo "✅ Doppler: Authenticated"
    echo "   Project: $DOPPLER_PROJECT"
    echo "   Config: $DOPPLER_CONFIG"
else
    echo "❌ Doppler: Not authenticated"
    exit 1
fi

# Test 2: Load environment variables
echo ""
echo "📋 Test 2: Environment Variables"
echo "---------------------------------"
export AI_ASSISTANT=$(doppler secrets get AI_ASSISTANT --config dev --plain 2>/dev/null || echo "zai")
export ANTHROPIC_MODEL=$(doppler secrets get ANTHROPIC_MODEL --config dev --plain 2>/dev/null || echo "glm-4.5")
export ANTHROPIC_BASE_URL=$(doppler secrets get ANTHROPIC_BASE_URL --config dev --plain 2>/dev/null || echo "https://api.z.ai/api/anthropic")

echo "✅ AI Assistant: $AI_ASSISTANT"
echo "✅ Model: $ANTHROPIC_MODEL"
echo "✅ Base URL: $ANTHROPIC_BASE_URL"

# Test 3: Check Claude Code configuration
echo ""
echo "📋 Test 3: Claude Code Configuration"
echo "------------------------------------"
if command -v claude &> /dev/null; then
    echo "✅ Claude Code: Installed"
    
    # Check if settings file exists and has Z.ai configuration
    if [ -f ~/.claude/settings.json ]; then
        if grep -q "api.z.ai" ~/.claude/settings.json; then
            echo "✅ Claude Code: Configured for Z.ai"
        else
            echo "⚠️  Claude Code: Not configured for Z.ai"
        fi
    else
        echo "⚠️  Claude Code: Settings file not found"
    fi
else
    echo "❌ Claude Code: Not installed"
fi

# Test 4: Test Doppler run functionality
echo ""
echo "📋 Test 4: Doppler Run Test"
echo "----------------------------"
if doppler run --config dev -- echo "✅ Doppler run: Working" > /dev/null 2>&1; then
    echo "✅ Doppler run: Functional"
else
    echo "❌ Doppler run: Not working"
fi

# Test 5: Environment variable test
echo ""
echo "📋 Test 5: Environment Variables Test"
echo "---------------------------------------"
if doppler run --config dev -- env | grep -q "AI_ASSISTANT=zai"; then
    echo "✅ Environment variables: Loading correctly"
else
    echo "❌ Environment variables: Not loading"
fi

echo ""
echo "🎉 Integration Test Complete!"
echo "============================"
echo ""
echo "📖 Usage:"
echo "   claude                                  # Start Claude Code normally"
echo "   doppler run --config dev -- claude      # Start with Doppler environment"
echo "   eval \$(doppler secrets download --config dev --format env --no-file)  # Load env manually"
echo ""
echo "🔧 Configuration:"
echo "   Project: node-starter"
echo "   Environment: dev"
echo "   AI Assistant: zai"
echo "   Model: GLM-4.5"
echo ""