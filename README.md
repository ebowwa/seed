# Dynamic Development Environment Setup

Environment-aware setup system that automatically detects your context (VPS, Codespaces, local dev) and installs only the tools you need.

---

<div align="center">

# 🔥 LIMITED TIME DEAL 🔥

### GLM CODING PLAN — **$3/MONTH**

**Claude Code + Cline + 10+ Coding Tools** — All in one place!

**Referral Code:** `DVARAUG0U8`

[![Subscribe Now](https://img.shields.io/badge/SUBSCRIBE-NOW-red?style=for-the-badge&logo=golang&logoColor=white&labelColor=orange&color=red)](https://z.ai/subscribe?ic=DVARAUG0U8)

**Don't miss out!** ⏰ [Get the deal →](https://z.ai/subscribe?ic=DVARAUG0U8)

</div>

---

## 🎯 Smart Environment Detection

The setup script automatically detects your environment and configures it appropriately:

| Environment | Auto-Detection | Tools Installed | Tools Skipped |
|------------|---------------|-----------------|---------------|
| **VPS/Production** | Hostname pattern, env vars | Tailscale, GitHub CLI, Doppler, AI assistant | None |
| **GitHub Codespaces** | CODESPACES env var | GitHub CLI, AI assistant, Doppler | Tailscale |
| **Local Development** | macOS + VS Code | All tools | None |
| **CI/CD Pipeline** | CI env vars | GitHub CLI | Others |
| **Container/Docker** | /.dockerenv file | GitHub CLI | Others |

## 🛠️ Tools Included

- **AI assistant** (Codex CLI or Claude Code) - choose the agent that matches your subscription
- **GitHub CLI** (`gh`) - GitHub from the command line
- **Tailscale** - Zero-config VPN for secure networking
- **Doppler** - SecretOps platform for environment variables
- **Vision MCP Server** - Z.AI Vision capabilities for image and video analysis (when using Z.ai)
- **Web Search MCP Server** - Z.AI Search capabilities for real-time web search and information retrieval (when using Z.ai)
- **Supabase MCP Server** - Official Supabase integration for database management and queries (requires Supabase project)
- **GitHub MCP Server** - Official GitHub integration for repository intelligence and workflow automation (requires GitHub PAT)

## 🚀 Quick Start

### For Z.ai Integration (feature branch)

```bash
# Clone the Z.ai integration branch
git clone -b feature/zai-integration https://github.com/ebowwa/seed.git
cd node-starter

# Quick setup (handles Doppler auth automatically)
./quick-setup.sh
```

### For Standard Setup

```bash
# Clone and run - it auto-detects your environment!
git clone https://github.com/ebowwa/seed.git
cd node-starter
./setup.sh
```

## 📋 Prerequisites

- **macOS**: Command Line Tools (auto-prompts if missing)
- **Linux**: `curl` and `sudo` access
- **All platforms**: Internet connection

## ⚙️ Configuration

### For Z.ai Integration
```bash
# The quick-setup.sh script handles everything automatically:
# 1. Installs Doppler CLI if needed
# 2. Prompts for Doppler authentication
# 3. Configures the project
# 4. Sets up Claude Code with Z.ai backend

./quick-setup.sh
```

### Using Claude Code with Z.ai
After setup, you have two options to use Claude Code:

**Option 1: Load environment per session**
```bash
# Load Z.ai configuration from Doppler
eval $(doppler secrets download --config dev --format env --no-file)

# Start Claude Code with Z.ai backend
claude
```

**Option 2: Use Doppler run wrapper**
```bash
# Start Claude with Doppler environment
doppler run --project seed --config dev -- claude
```

### Claude Settings Management
The project includes Claude settings templates for easy configuration:

```bash
# Install Z.ai-optimized Claude settings
./install-claude-settings.sh

# View settings files
ls .claude/
# .claude/settings.template.json  # Settings template
# .claude/settings.local.json     # Local project settings
```

The setup script automatically installs Claude settings based on your AI assistant preference:
- `--use-zai` installs Z.ai configuration (GLM-4.5 models)
- `--use-claude` installs standard Anthropic configuration
- The `install-claude-settings.sh` script is now dynamic and generates appropriate settings

### Basic Setup (Standard)
```bash
# Optional: Add your API keys for automated config
cp .env.example .env
nano .env  # Add your tokens

# Run setup - auto-detects environment
./setup.sh
```

### Force Specific Environment
```bash
# VPS/Production nodes
./setup.sh --env vps

# GitHub Codespaces
./setup.sh --env codespaces

# Local development
./setup.sh --env local_dev

# List all environments
./setup.sh --list-envs
```

### Choose Your AI Assistant

Pick the agent that matches your subscription:

- `claude` (default): Claude Code with Anthropic’s API
- `zai`: Claude Code routed through the Z.ai Model API (GLM-4.5)
- `codex`: OpenAI Codex CLI

```bash
# Use Codex CLI instead of Claude Code
./setup.sh --assistant codex

# Route Claude Code through Z.ai’s endpoint
./setup.sh --assistant zai

# Shortcut flags
./setup.sh --use-codex
./setup.sh --use-claude
./setup.sh --use-zai

# Persist the preference via environment variable
echo "AI_ASSISTANT=zai" >> .env
```
The script defaults to Claude Code when no preference is set. At any time you can skip installing the selected assistant with `--skip-assistant` (aliases: `--skip-claude`, `--skip-zai`).

### Skip Specific Tools
```bash
./setup.sh --skip-assistant   # Aliases: --skip-claude, --skip-zai
./setup.sh --skip-github
./setup.sh --skip-tailscale
./setup.sh --skip-doppler
./setup.sh --skip-vision      # Skip Vision MCP Server
./setup.sh --skip-search      # Skip Web Search MCP Server

# Combine options
./setup.sh --env vps --skip-doppler
```

## 🔑 Environment Variables

Create a `.env` file with your tokens for automated configuration:

```bash
# GitHub Personal Access Token
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# AI assistant preference (codex, claude, or zai)
AI_ASSISTANT=zai

# Z.ai API Key (required when AI_ASSISTANT=zai and for Vision/Web Search MCP Servers)
ZAI_API_KEY=zai-xxxxxxxxxxxx

# Anthropic API Key (optional when using Anthropic directly)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# Tailscale Auth Key (for headless setup)
TAILSCALE_AUTH_KEY=tskey-auth-xxxxxxxxxxxx

# Doppler Service Token
DOPPLER_TOKEN=dp.st.xxxxxxxxxxxx
```

## 🎨 Customization

### Add Custom Environment

Edit `situations.yaml`:

```yaml
environments:
  my_custom_env:
    description: "My special environment"
    detect:
      - env: "MY_ENV=true"
      - hostname_pattern: "custom-*"
    tools:
      - github-cli
      - doppler
    skip:
      - claude-code
      - tailscale
```

### Add New Tools

Edit `situations.yaml`:

```yaml
tools:
  my_tool:
    name: "My Tool"
    check_command: "mytool"
    install_methods:
      macos: "brew install mytool"
      debian: "apt-get install mytool"
    config_env: "MY_TOOL_TOKEN"
```

## 📚 Use Cases

### VPS/Production Nodes
```bash
MACHINE_TYPE=vps ./setup.sh
```
- ✅ Tailscale for secure networking
- ✅ GitHub CLI for deployments
- ✅ Doppler for secrets management
- ✅ Preferred AI assistant (Codex, Claude, or Z.ai) for AI help

### GitHub Codespaces
Automatically detected and configured:
- ✅ Preferred AI assistant (Codex, Claude, or Z.ai) for AI assistance
- ✅ GitHub CLI (essential)
- ✅ Doppler for dev secrets
- ❌ Tailscale (not needed)

### Local Development
Full setup for your workstation:
- ✅ All tools installed
- ✅ Complete configuration

## 🔧 Post-Installation

### Claude Code (if selected)
```bash
# Anthropic users
claude auth login

# Z.ai users
claude /status  # Confirms the GLM-4.5 endpoint is active
```

When `AI_ASSISTANT=zai`, the setup script writes your credentials to `~/.claude/settings.json` (creating the file if needed) so future shells automatically target `https://api.z.ai/api/anthropic`.

### Vision MCP Server (included with Z.ai)
When using Z.ai backend, the setup automatically configures Vision MCP Server for image and video analysis:

```bash
# Vision capabilities are available through Claude Code
# Place an image in your directory and ask Claude to analyze it:
claude
> What does this image show? (attach or reference image file)

# Vision MCP Server tools included:
# - image_analysis: Analyze images and provide detailed descriptions
# - video_analysis: Analyze videos and provide detailed descriptions
```

### Web Search MCP Server (included with Z.ai)
When using Z.ai backend, the setup automatically configures Web Search MCP Server for real-time search capabilities:

```bash
# Search capabilities are available through Claude Code
# Ask Claude to search for current information:
claude
> Search for the latest AI technology developments

# Web Search MCP Server tools included:
# - webSearchPrime: Search web information with real-time results
#   * Page titles, URLs, and summaries
#   * Real-time news and information
#   * Stock prices, weather, and more
```

### Supabase MCP Server (Manual Setup)
For users with Supabase projects, the official Supabase MCP server provides database management capabilities:

```bash
# Configure Supabase MCP server (manual setup required)
# See docs/Supabase_MCP_Integration.md for detailed instructions

# Requirements:
# - Supabase Personal Access Token (PAT)
# - Supabase project reference
# - Claude Code with MCP support

# Example usage after setup:
claude
> How many tables do we have in the database?
> Show me the structure of the apps table
> Insert a new record into the app_info table
```

**Supabase MCP capabilities:**
- Database schema exploration
- Natural language SQL queries
- Table and data management
- Direct database operations through Claude Code

### GitHub MCP Server (Manual Setup)
For advanced GitHub operations, the official GitHub MCP server provides repository intelligence and workflow automation:

```bash
# Configure GitHub MCP server (manual setup required)
# See docs/GitHub_MCP_Integration.md for detailed instructions

# Requirements:
# - GitHub Personal Access Token (PAT)
# - Claude Code with MCP support

# Example usage after setup:
claude
> Find all TypeScript repositories in my organization
> Search for TODO comments across all my repositories
> Create issues for bugs found in the codebase
> Analyze commit patterns across my projects
```

**GitHub MCP capabilities:**
- Cross-repository code search
- Semantic code understanding
- Workflow automation (issues, PRs, projects)
- Organization-level analytics
- Natural language GitHub operations

**Note:** The seed project includes GitHub CLI for direct command operations. Use GitHub MCP for conversational tasks and CLI for precise control.

### Codex CLI (if selected)
```bash
codex login
```

### GitHub CLI
```bash
gh auth login
```

### Tailscale
```bash
sudo tailscale up  # Linux/VPS
tailscale up       # macOS
```

### Doppler
```bash
doppler login
# Or with service token:
doppler configure set token $DOPPLER_TOKEN --scope /
```

## 🐛 Troubleshooting

- **Environment not detected?** Use `--env` flag to force
- **Tool already installed?** Script checks and skips
- **Permission errors?** Ensure sudo access on Linux
- **API keys not working?** Check `.env` file formatting

## 📝 Files

- `setup.sh` - Main installation script
- `quick-setup.sh` - Streamlined Z.ai setup
- `situations.yaml` - Environment and tool configurations
- `.env.example` - Template for API keys
- `.env` - Your API keys (git-ignored)
- `.claude/settings.template.json` - Claude settings template for Z.ai
- `.claude/settings.local.json` - Local Claude settings
- `install-claude-settings.sh` - Claude settings installation script
- `docs/Supabase_MCP_Integration.md` - Complete Supabase MCP server setup guide
- `docs/GitHub_MCP_Integration.md` - Comprehensive GitHub MCP server documentation

## 🔒 Security

- Never commit `.env` files
- Use environment-specific tokens
- Rotate credentials regularly
- Review `situations.yaml` before running

## 📄 License

MIT - Use freely for your own setups!

## 🤝 Contributing

PRs welcome! Please test on target platforms.
