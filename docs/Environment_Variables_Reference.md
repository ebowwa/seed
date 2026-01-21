# Environment Variables Reference (Doppler-Centric)

**Last Updated:** 2026-01-20
**Doppler Project:** `seed`
**Status:** Production-Ready

---

## Table of Contents

1. [Doppler Architecture](#doppler-architecture)
2. [Quick Start](#quick-start)
3. [All Environment Variables](#all-environment-variables)
4. [Component Access Patterns](#component-access-patterns)
5. [Environment-Specific Configs](#environment-specific-configs)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Doppler Architecture

### How Secrets Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Doppler Cloud                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Project: seed                                              │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │ │
│  │  │   dev      │  │    prd     │  │    stg     │  (configs) │ │
│  │  └────────────┘  └────────────┘  └────────────┘            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ doppler run --project seed --config prd
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Component (runtime)                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Environment Variables Loaded                              │ │
│  │  - AI credentials                                          │ │
│  │  - API tokens                                              │ │
│  │  - Service URLs                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principle

**All secrets live in Doppler.** The `.env.example` files are templates showing what secrets exist, but actual values are never committed to git.

---

## Quick Start

### 1. Doppler Setup (First Time)

```bash
# Install Doppler CLI (included in seed/setup.sh)
brew install dopplerhq/cli/doppler  # macOS
# OR use setup.sh on any platform

# Authenticate
doppler login

# Configure project scope
cd ~/seed
doppler configure set project seed --scope /

# Verify configuration
doppler configure get project --scope /
doppler configure get config --scope /
```

### 2. Load Secrets in Any Shell

```bash
# Method 1: Interactive (recommended for development)
doppler run --project seed --config prd -- bash

# Method 2: One-off command
doppler run --project seed --config prd -- your-command

# Method 3: Export to current shell (not recommended - secrets in memory)
eval $(doppler secrets download --project seed --config prd --format env --no-file)
```

### 3. Use in Scripts

```bash
#!/bin/bash
# chat.sh - wraps Claude Code with Doppler secrets
doppler run --project seed --config prd -- claude "$@"
```

---

## All Environment Variables

### AI & LLM Configuration

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `AI_ASSISTANT` | Which AI backend to use | No | `claude` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | Conditional* | - |
| `ANTHROPIC_AUTH_TOKEN` | Z.ai authentication token | Conditional** | - |
| `Z_AI_API_KEY` | Z.ai API key (GLM models) | Yes | - |
| `ANTHROPIC_BASE_URL` | API endpoint URL | No | `https://api.z.ai/api/anthropic` |
| `ANTHROPIC_MODEL` | Primary model | No | `glm-4.7` |
| `ANTHROPIC_SMALL_FAST_MODEL` | Fast model | No | `glm-4.6` |

\* *Required if using Anthropic Claude directly*
\** *Required if using Z.ai GLM backend*

### Git & GitHub

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `GITHUB_TOKEN` | GitHub CLI authentication | Yes | - |
| `GITHUB_PAT` | GitHub Personal Access Token (MCP) | Conditional | - |
| `GITHUB_USERNAME` | GitHub username (MCP) | Conditional | - |
| `GITHUB_ORG` | GitHub organization (MCP) | No | - |

### Infrastructure

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `HETZNER_API_TOKEN` | Hetzner Cloud API | Yes (cheapspaces) | - |
| `TAILSCALE_AUTH_KEY` | Tailscale headless auth | No | - |
| `TAILSCALE_STATUS` | Tailscale connection status | Read-only | - |

### Secrets Management

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `DOPPLER_PROJECT` | Doppler project name | Yes | `seed` |
| `DOPPLER_CONFIG` | Doppler environment config | Yes | `prd` |
| `DOPPLER_TOKEN` | Doppler service token | Conditional | - |

### Database (Supabase MCP)

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `SUPABASE_PAT` | Supabase Personal Access Token | Conditional | - |
| `SUPABASE_URL` | Supabase project URL | Conditional | - |
| `SUPABASE_PROJECT_REF` | Supabase project reference | Conditional | - |

### Node Agent

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `NODE_AGENT_PORT` | HTTP server port | No | `8911` |
| `NODE_AGENT_HOST` | Bind address | No | `0.0.0.0` |
| `MAX_CONCURRENT_LOOPS` | Max Ralph loops per node | No | `4` |
| `REPOS_BASE_PATH` | Base path for worktrees | No | `/root/seed-worktrees` |

### Cheapspaces (Control Plane)

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `PORT` | Web server port | No | `3000` |
| `HETZNER_API_TOKEN` | Hetzner API key | Yes | - |
| `Z_AI_API_KEY` | AI features | No | - |

---

## Component Access Patterns

### By Component

```
┌─────────────────────────────────────────────────────────────────┐
│  cheapspaces (Control Plane)                                    │
│  Needs: HETZNER_API_TOKEN, Z_AI_API_KEY, PORT                 │
│  Loads via: doppler run --project seed --config prd -- bun run dev│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  seed (Base Infrastructure)                                      │
│  Needs: ALL secrets                                             │
│  Loads via: doppler run --project seed --config prd -- ./chat.sh│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  node-agent (Worker Orchestration)                               │
│  Needs: DOPPLER_PROJECT, DOPPLER_CONFIG, Z_AI_API_KEY          │
│  Loads via: systemd environment with doppler run              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  lane (Git Worktree Tool)                                        │
│  Needs: None (local CLI tool)                                   │
│  Loads via: Direct execution                                    │
└─────────────────────────────────────────────────────────────────┘
```

### By Access Frequency

| Frequency | Variables | Access Method |
|-----------|-----------|---------------|
| **Every command** | `Z_AI_API_KEY`, `ANTHROPIC_*` | `doppler run` wrapper |
| **Every session** | `GITHUB_TOKEN`, `DOPPLER_*` | Shell session init |
| **Server start** | `HETZNER_API_TOKEN`, `NODE_AGENT_PORT` | Server startup |
| **One-time setup** | `TAILSCALE_AUTH_KEY`, `DOPPLER_TOKEN` | Initial provisioning |

---

## Environment-Specific Configs

### Doppler Config Structure

```
Project: seed
│
├── dev   # Local development
│   ├── Z_AI_API_KEY=dev_key
│   ├── ANTHROPIC_MODEL=glm-4.6  # Faster for dev
│   └── HETZNER_API_TOKEN (mock mode)
│
├── stg   # Staging environment
│   ├── Z_AI_API_KEY=staging_key
│   ├── ANTHROPIC_MODEL=glm-4.7
│   └── HETZNER_API_TOKEN=staging_token
│
└── prd   # Production VPS nodes
    ├── Z_AI_API_KEY=production_key
    ├── ANTHROPIC_MODEL=glm-4.7
    └── HETZNER_API_TOKEN=production_token
```

### Switching Environments

```bash
# Development (local)
doppler run --project seed --config dev -- claude

# Staging (test VPS)
doppler run --project seed --config stg -- bun run dev

# Production (worker nodes)
doppler run --project seed --config prd -- ./chat.sh "hello"
```

### Default Configs by Component

| Component | Default Config | Override Via |
|-----------|---------------|--------------|
| `chat.sh` | `prd` | `--config` flag or `DOPPLER_CONFIG` env var |
| `cheapspaces` | `prd` | `.env` file or Doppler |
| `node-agent` | `prd` | systemd environment |
| `setup.sh` | Auto-detect | Environment detection logic |

---

## Security Best Practices

### ✅ DO

1. **Store ALL secrets in Doppler**
   ```bash
   doppler secrets set Z_AI_API_KEY "your-key"
   ```

2. **Use service tokens for automation**
   ```bash
   # Generate service token in Doppler dashboard
   # Use for CI/CD or unattended scripts
   doppler secrets set DOPPLER_TOKEN "svc-token..."
   ```

3. **Rotate credentials regularly**
   ```bash
   # Update secret in Doppler
   doppler secrets set Z_AI_API_KEY "new-key"

   # All components pick up new value on next run
   ```

4. **Use environment-scoped configs**
   ```bash
   # Different tokens for dev/stg/prd
   doppler secrets set Z_AI_API_KEY "dev-key" --config dev
   doppler secrets set Z_AI_API_KEY "prod-key" --config prd
   ```

5. **Audit access regularly**
   ```bash
   # Check who has access to Doppler project
   # (Via Doppler dashboard)
   ```

### ❌ DON'T

1. **Never commit actual secrets to git**
   ```bash
   # .env.example is OK (templates only)
   # .env with real values is NOT OK
   ```

2. **Never share service tokens**
   ```bash
   # Service tokens should be encrypted at rest
   # Rotate immediately if leaked
   ```

3. **Never use production tokens in dev**
   ```bash
   # Always use separate configs
   doppler run --config dev  # NOT prd
   ```

4. **Never log secrets in plain text**
   ```bash
   # Doppler automatically masks secrets in logs
   # Don't disable this feature
   ```

---

## Troubleshooting

### "Secret not found" Error

**Symptom:** Component fails with missing secret error

**Diagnosis:**
```bash
# Check Doppler configuration
doppler configure get project --scope /
doppler configure get config --scope /

# List all secrets for current config
doppler secrets list --config prd
```

**Solution:**
```bash
# Add missing secret
doppler secrets set MISSING_SECRET "value"
```

### Wrong Environment Loaded

**Symptom:** Component using wrong API keys/URLs

**Diagnosis:**
```bash
# Check which config is active
echo $DOPPLER_CONFIG

# List all configs
doppler configs list
```

**Solution:**
```bash
# Explicitly specify config
doppler run --project seed --config prd -- your-command

# OR set default
doppler configure set config prd --scope /
```

### Doppler Connection Issues

**Symptom:** "Failed to fetch secrets" error

**Diagnosis:**
```bash
# Test Doppler connectivity
doppler api get /v3/projects

# Check authentication
doppler me
```

**Solution:**
```bash
# Re-authenticate
doppler login

# OR use service token for unattended access
export DOPPLER_TOKEN="your-service-token"
```

### Secrets Not Updating

**Symptom:** Changed secret in Doppler but component using old value

**Cause:** Component caching environment variables

**Solution:**
```bash
# Restart component to pick up new secrets
systemctl restart node-agent  # For systemd services

# OR for long-running processes
kill -HUP <pid>  # Send sighup to reload
```

---

## Quick Reference Commands

```bash
# === Doppler CLI ===

# Login/setup
doppler login
doppler configure set project seed --scope /

# View secrets (safe - masks values)
doppler secrets list

# Get single secret (echoes value - be careful!)
doppler secrets get Z_AI_API_KEY --plain

# Set secret
doppler secrets set Z_AI_API_KEY "new-value"

# Run command with secrets
doppler run --project seed --config prd -- your-command

# Export secrets to file (NOT recommended - secrets in memory)
doppler secrets download --project seed --config prd --format env --no-file > .env

# === Component Usage ===

# Claude Code with Doppler
doppler run --project seed --config prd -- claude "your prompt"

# Cheapspaces server
doppler run --project seed --config prd -- bun run dev

# Node Agent (via systemd)
# Secrets loaded via EnvironmentFile in service config
systemctl start node-agent

# Persistent chat wrapper
./chat.sh "your prompt"  # Uses doppler run internally
```

---

## File Structure

```
seed/
├── .env.example              # Template (not secrets)
├── .claude/
│   └── settings.node.json   # Claude Code config (uses Z_AI_API_KEY)
├── docs/
│   └── Environment_Variables_Reference.md  # This file
└── [components use doppler run to load secrets]
```

**Note:** The `.env.example` file shows what secrets exist but contains no actual values. Real values are only in Doppler.

---

## Related Documentation

- [Doppler CLI Reference](https://cli.doppler.com/)
- [CLAUDE_ZAI_INTEGRATION.md](./CLAUDE_ZAI_INTEGRATION.md)
- [24-7_Worker_Architecture.md](./24-7_Worker_Architecture.md)
- [seed/.env.example](../.env.example)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-20
**Maintained By:** ebowwa
