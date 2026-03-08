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
| **OrbStack** | Fast Docker & Linux VMs (macOS) |
| **Vision MCP** | Image/video analysis (Z.ai) |
| **Web Search MCP** | Real-time web search (Z.ai) |
| **GitHub MCP** | Repository intelligence |
| **chat.sh** | Persistent Claude conversations |
| **Ralph Iterative** | "Mr. Meeseeks Mode" - Autonomous AI loops |
| **Node Agent** | Multi-node Ralph orchestration (port 8911) |

## Ralph Iterative - "Mr. Meeseeks Mode"

Ralph Iterative is a Claude Code plugin that relentlessly iterates on tasks until completion.

**Quick Start:**

```bash
# Install Ralph Iterative (runs automatically during setup)
./setup-ralph-iterative.sh

# Run a Ralph loop
doppler run --project seed --config prd -- claude '/go "Fix the authentication bug" --completion-promise BUG_FIXED' -p

# Check status
doppler run --project seed --config prd -- claude '/ralph-iterative-status' -p

# Stop a loop
doppler run --project seed --config prd -- claude '/quit' -p
```

**Key Commands:**

| Command | Description |
|---------|-------------|
| `/go` | Start Ralph loop |
| `/quit` | Stop active loop |
| `/ralph-iterative-status` | Show session status |
| `/ralph-iterative-history` | Show session history |
| `/ralph-iterative-resume` | Resume a session |

**Features:**
- ✅ Loops indefinitely until completion signal
- ✅ Tracks state in `.claude/.ralph-iterative.local.json`
- ✅ Monitored by Node Agent (GUI dashboard)
- ✅ SLAM subagents (planner, executor, paranoid, reviewer)
- ✅ Git integration (auto-commit, PRs)

📖 **Full Documentation:** [RALPH-ITERATIVE-SETUP.md](./RALPH-ITERATIVE-SETUP.md)

## Multi-Node Setup

### Node Architecture

```
Coordinator Node (seed-node-prod)
├── PM Daemon: Orchestrates work across nodes
└── Node Agent API: :8911

Worker Nodes (seed-node-1, seed-node-2, ...)
├── Node Agent: Executes assigned tasks
└── Ralph Iterative: Runs autonomous loops
```

### Quick Setup for New Nodes

```bash
# 1. Bootstrap script (coming soon)
curl -fsSL https://raw.githubusercontent.com/ebowwa/seed/main/bootstrap-node.sh | bash

# 2. Manual setup
git clone https://github.com/ebowwa/seed.git
cd seed
./setup.sh

# 3. Register with coordinator
curl -X POST http://100.71.68.25:8911/api/nodes/register \
  -H "Content-Type: application/json" \
  -d '{"node_name": "seed-node-1", "role": "worker"}'
```

### Node Management

```bash
# Check node health
curl http://localhost:8911/api/health

# List all nodes
curl http://localhost:8911/api/nodes

# Submit work to node
curl -X POST http://localhost:8911/api/ralph/start \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Fix the authentication bug", "target_node": "seed-node-1"}'
```

📖 **Full Documentation:** [NODE-SETUP-GUIDE.md](./NODE-SETUP-GUIDE.md)

## Configuration

### Secrets Management (Doppler)

All secrets are managed via [Doppler](https://doppler.com) - no hardcoded tokens in `.env` files.

```bash
# Install and login
brew install doppler-cli  # macOS
# or
curl -sL https://cli.doppler.com/install.sh | sh  # Linux
doppler login

# Setup project
doppler setup  # Creates seed project with dev/prd configs

# Run any command with secrets injected
doppler run --project seed --config prd -- <your-command>

# View secrets
doppler secrets download --no-mask --project seed --config prd
```

**Required Secrets in Doppler:**

| Secret | Description | Example |
|--------|-------------|---------|
| `AI_ASSISTANT` | Claude provider | `zai` |
| `ZAI_API_KEY` | Z.ai API key | `zai_xxx` |
| `GITHUB_TOKEN` | GitHub Personal Access Token | `ghp_xxx` |
| `DOPPLER_TOKEN` | Doppler service token | `dp.st.xxx` |
| `TAILSCALE_AUTH_KEY` | Tailscale auth key | `tskey-xxx` |

### Git Credential Helper

Git is configured to fetch tokens from Doppler automatically:

```bash
# Credential helper is installed by setup.sh
# Uses Doppler GITHUB_TOKEN for all GitHub operations
git config --global credential.helper /root/.git-credentials-doppler

# No need to set credentials manually
git clone https://github.com/ebowwa/seed.git  # Just works
```

## Environments

| Environment | Tools |
|------------|-------|
| **VPS/Production** | All tools |
| **Codespaces** | Claude, GitHub CLI, Doppler |
| **Local Dev** | All tools |

## Post-Installation

### Doppler Setup

```bash
# Login to Doppler (one-time)
doppler login

# Configure project (already set up for seed)
doppler setup --project seed --config prd

# Verify secrets are accessible
doppler run --project seed --config prd -- env | grep -E "(ZAI|GITHUB|DOPPLER|TAILSCALE)"
```

### GitHub Credentials

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

- [Ralph Iterative Setup](./RALPH-ITERATIVE-SETUP.md)
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
