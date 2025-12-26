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
  <img src="https://img.shields.io/badge/SUBSCRIBE_NOW-GET_STARTED-red?style=for-the-badge&logoColor=white&labelColor=dc143c&color=ff0000&animation=pulse" alt="Subscribe Now">
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

### Using Claude Code with Z.ai

```bash
# Load Z.ai config from Doppler
eval $(doppler secrets download --config dev --format env --no-file)

# Start Claude Code
claude
```

### Claude Settings

```bash
# Install Z.ai-optimized settings
./install-claude-settings.sh
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

# Claude Code status (Z.ai)
claude /status
```

## Files

- `setup.sh` - Main installation script
- `situations.yaml` - Environment/tool configs
- `.env.example` - API key template
- `.claude/settings.template.json` - Claude settings template
- `.claude/settings.local.json` - Local Claude settings

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
