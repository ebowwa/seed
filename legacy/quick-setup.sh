#!/bin/bash

# Quick setup script for node-starter with Z.ai integration
# This handles the common case where you just want to get started quickly

set -e

echo "🚀 Setting up node-starter with Z.ai integration..."

# Check if we're in the right directory
if [ ! -f "setup.sh" ]; then
    echo "❌ Error: setup.sh not found. Please run this from the node-starter directory."
    exit 1
fi

# Step 1: Check if Doppler is installed and logged in
echo ""
echo "📋 Step 1: Checking Doppler setup..."

if ! command -v doppler >/dev/null 2>&1; then
    echo "📦 Installing Doppler CLI..."
    curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" | sudo tee /etc/apt/sources.list.d/doppler-cli.list
    sudo apt-get update
    sudo apt-get install -y doppler
fi

# Check if logged in to Doppler
if ! doppler whoami >/dev/null 2>&1; then
    echo ""
    echo "🔑 Please authenticate with Doppler:"
    echo "   doppler login"
    echo ""
    read -p "Press Enter after you've logged in to Doppler..."
    
    # Check again
    if ! doppler whoami >/dev/null 2>&1; then
        echo "❌ Still not logged in. Please run 'doppler login' and try again."
        exit 1
    fi
fi

# Step 2: Run the main setup script
echo ""
echo "⚙️  Step 2: Running main setup script..."
./setup.sh --use-zai

# Step 3: Load environment and test Claude
echo ""
echo "🧪 Step 3: Testing Claude Code configuration..."

# Load environment from Doppler
eval $(doppler secrets download --config dev --format env --no-file)

# Check if Claude is configured
if [ -n "$ANTHROPIC_AUTH_TOKEN" ]; then
    echo "✅ Z.ai configuration loaded successfully!"
    echo ""
    echo "🎯 You're all set! Run 'claude' to start using Claude Code with Z.ai"
    echo ""
    echo "💡 For future sessions in this directory, use:"
    echo "   eval \$(doppler secrets download --config dev --format env --no-file)"
    echo "   claude"
else
    echo "❌ Failed to load Z.ai configuration"
    echo "Please check your Doppler setup and try again"
    exit 1
fi