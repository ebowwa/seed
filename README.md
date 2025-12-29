# Dynamic Development Environment Setup

Environment-aware setup system that automatically detects your context (VPS, Codespaces, local dev) and installs only the tools you need.

---

<div align="center">

<a href="https://z.ai/subscribe?ic=DVARAUG0U8">
  <img src="https://img.shields.io/badge/GLM_CODING_PLAN-$3/MONTH-orange?style=for-the-badge&logo=golang&logoColor=white&labelColor=ff6b00&color=ff4500" alt="GLM Coding Plan">
</a>

### Claude Code + Cline + 10+ Coding Tools

**Referral Code:** `DVARAUG0U8`

<a href="https://z.ai/subscribe?ic=DVARAUG0U8">
  <img src="https://img.shashes.io/badge/SUBSCRIBE_NOW-GET_STARTED-red?style=for-the-badge&logoColor=white&labelColor=dc143c&color=ff0000&animation=pulse" alt="Subscribe Now">
</a>

</div>

---

## Quick Start

```bash
git clone https://github.com/ebowwa/seed.git
cd seed
./setup.sh
```

## What's Included

| Tool | Purpose |
|------|---------|
| **Claude Code** | AI coding assistant |
| **GitHub CLI** | GitHub from terminal |
| **Doppler** | Secrets management |
| **Tailscale** | Zero-config VPN |
| **Vision MCP** | Image/video analysis (Z.ai) |
| **Web Search MCP** | Real-time web search (Z.ai) |
| **GitHub MCP** | Repository intelligence |
| **chat.sh** | Persistent Claude conversations |

## Configuration

### Environment Variables

```bash
# .env file
AI_ASSISTANT=zai
ZAI_API_KEY=your-key
GITHUB_TOKEN=ghp_xxx
DOPPLER_TOKEN=dp.st.xxx
TAILSCALE_AUTH_KEY=tskey-xxx
```

## Environments

| Environment | Tools |
|------------|-------|
| **VPS/Production** | All tools |
| **Codespaces** | Claude, GitHub CLI, Doppler |
| **Local Dev** | All tools |

## Post-Installation

```bash
# GitHub CLI
gh auth login

# Tailscale
sudo tailscale up  # Linux
tailscale up       # macOS

# Doppler
doppler login
```

### Using Claude Code with Z.ai

```bash
# Run Claude Code with Z.ai config from Doppler
doppler run --project seed --config prd -- claude
```

### Chat Script (Persistent Conversations)

The `chat.sh` wrapper enables persistent conversations with Claude across sessions.

```bash
# Basic usage
./chat.sh "your prompt here"

# Custom project/config
./chat.sh "prompt" --project myproj --config dev

# Via environment variables
DOPPLER_PROJECT=other DOPPLER_CONFIG=staging ./chat.sh "prompt"
```

**How it works:**
- Maintains conversation history in `/tmp/c.txt`
- Each prompt includes full conversation context
- Loads secrets from Doppler (configurable)
- Resets when `/tmp/c.txt` is deleted

### Distributed Claude

Communicate with a remote Claude instance on a VPS for distributed AI workflows.

```bash
# Example: Chat with remote Claude on Hetzner server
ssh ebowwa-deptwar "cd ~/seed && ./chat.sh 'your prompt'"
```

**Use cases:**
- Different backends (Z.ai GLM vs Anthropic)
- Independent context/persistence
- Multi-Claude collaboration
- Test prompts across models without local config changes

## Files

- `setup.sh` - Main installation script
- `situations.yaml` - Environment/tool configs
- `chat.sh` - Persistent conversation wrapper
- `.env.example` - API key template
- `.claude/settings.template.json` - Claude settings template
- `.claude/settings.local.json` - Local Claude settings
- `.claude/commands/` - Claude Code skills (see `distributed-claude.md`)

## Docs

- [Claude Code Skills](./docs/Claude_Code_Skills.md)
- [GLM Models Comparison](./docs/GLM_Models_Comparison.md)
- [GitHub MCP Integration](./docs/GitHub_MCP_Integration.md)
- [Z.ai Vision MCP](./docs/ZAI-Vision_MCP.md)
- [Z.ai Web Search MCP](./docs/ZAI_Web_MCP.md)

## Security

- Never commit `.env` files
- Rotate credentials regularly
- Use environment-specific tokens

## License

MIT
