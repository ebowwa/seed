# 24/7 Worker Automation with Claude Code

**Last Updated:** 2026-01-20
**Status:** Architecture Complete, Integration In Progress

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Component Deep Dive](#component-deep-dive)
4. [Data Flow](#data-flow)
5. [Deployment Guide](#deployment-guide)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)
8. [Development Roadmap](#development-roadmap)

---

## Overview

This system implements **24/7 automated workers** using Hetzner VPS instances, Claude Code, and the Ralph Loop technique. It provides a cost-effective alternative to GitHub Codespaces (~20x cheaper) with persistent AI-powered development environments.

### Key Benefits

| Feature | Benefit |
|---------|---------|
| **Economy** | Hetzner VPS €3-6/month vs Codespaces ~$0.50/hour |
| **Persistence** | Workers run 24/7, maintaining conversation context |
| **Scalability** | Spin up/down workers on demand via API |
| **Distributed** | Run tasks across multiple VPS nodes in parallel |
| **AI-Powered** | Claude Code with GLM-4.7 via Z.ai backend |
| **Self-Replicating** | Each VPS auto-installs the seed infrastructure |

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    cheapspaces (Control Plane)                   │
│                    localhost:3000                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Tailscale VPN + SSH
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Hetzner VPS Cluster                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  VPS Node 1 │  │  VPS Node 2 │  │  VPS Node N │              │
│  │  ~/seed/    │  │  ~/seed/    │  │  ~/seed/    │              │
│  │  node-agent │  │  node-agent │  │  node-agent │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTROL PLANE                                │
│                     (cheapspaces app)                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  React Dashboard                                             │   │
│  │  - Server management UI                                      │   │
│  │  - Terminal emulation (xterm.js)                             │   │
│  │  - Metrics visualization                                     │   │
│  │  - AI insights (GLM-4.7)                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Hono API (Bun.serve)                                       │   │
│  │  - Hetzner API integration                                  │   │
│  │  - SSH pool management                                      │   │
│  │  - Terminal WebSocket server                                │   │
│  │  - Seed installer orchestration                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Secure Tunnel (Tailscale + SSH)
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         WORKER NODE (VPS)                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Seed Infrastructure (~/seed/)                               │   │
│  │  ├── setup.sh (environment-aware installation)              │   │
│  │  ├── chat.sh (persistent Claude conversations)              │   │
│  │  ├── situations.yaml (declarative config)                   │   │
│  │  ├── skills/ (distributed Claude capabilities)              │   │
│  │  │   ├── distributed-claude-sender/                         │   │
│  │  │   └── distributed-claude-receiver/                       │   │
│  │  └── node-agent/ (worker orchestration)                     │   │
│  │      ├── src/index.ts (HTTP server, port 8911)              │   │
│  │      ├── src/services/ralph.ts (loop monitoring)            │   │
│  │      └── systemd/node-agent.service (persistent)            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  lane CLI (installed via setup.sh)                          │   │
│  │  - Manages git worktrees for worker isolation               │   │
│  │  - Used by node-agent to create task environments           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Worker Processes (via lane worktrees)                      │   │
│  │  ├── ~/seed-lane-task-001/  (lane new task-001)             │   │
│  │  │   └── .claude/.ralph-loop.local.md (active loop state)   │   │
│  │  ├── ~/seed-lane-task-002/  (lane new task-002)             │   │
│  │  └── ~/seed-lane-task-003/  (lane new task-003)             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Control Plane** | | |
| Frontend | React 19, TailwindCSS | Dashboard UI |
| Backend | Bun, Hono | API server |
| Terminal | xterm.js, xterm-addon-fit | SSH terminal emulation |
| Database | SQLite (bun:sqlite) | Metadata, metrics |
| AI | GLM-4.7 (Z.ai) | Resource analysis |
| **Worker Node** | | |
| Runtime | Bun | Fast TypeScript runtime |
| Process Manager | systemd | Persistent service |
| VPN | Tailscale | Secure mesh networking |
| Secrets | Doppler | Environment variable management |
| Git | git worktrees (via lane CLI) | Parallel task isolation |
| **Communication** | | |
| SSH | node-ssh | Remote command execution |
| Terminal | tmux | Persistent session management |
| HTTP | fetch | Node Agent API communication |

---

## Component Deep Dive

### 1. cheapspaces (Control Plane)

**Location:** `/Users/ebowwa/apps/com.hetzner.codespaces`

**Purpose:** Hetzner VPS management dashboard with AI-powered insights

#### Key Files

| File | Purpose |
|------|---------|
| `index.ts` | Unified Bun server with WebSocket terminal |
| `app/backend/shared/lib/hetzner/` | Hetzner API client |
| `app/backend/shared/lib/terminal/manager.ts` | Multi-node tmux session manager |
| `app/backend/shared/lib/ssh/pool.ts` | SSH connection pooling |
| `app/backend/shared/lib/seed/install.ts` | Automated seed installation |
| `app/backend/shared/lib/metadata.ts` | Environment metadata storage |
| `app/backend/shared/lib/metrics.ts` | Time-series metrics collection |

#### API Endpoints

```
# Environments
GET    /api/environments              # List all servers
POST   /api/environments              # Create new server
DELETE /api/environments/:id          # Delete server
POST   /api/environments/:id/start    # Power on server
POST   /api/environments/:id/stop     # Power off server
GET    /api/environments/:id/resources  # Get resource usage

# Metrics
GET    /api/environments/:id/metrics     # Get metrics history
GET    /api/environments/:id/metrics/summary  # Get stats + trends

# AI Features (requires Z_AI_API_KEY)
POST   /api/ai/generate                 # General text generation
POST   /api/ai/suggest/name             # Generate server names
POST   /api/ai/analyze/resources       # Analyze current resources
POST   /api/ai/analyze/historical      # Analyze with trends

# Terminal
WS     /api/terminal/ws                # WebSocket for terminal sessions
POST   /api/ssh                        # Open SSH connection
POST   /api/scp/upload                 # Upload file via SCP
POST   /api/scp/download               # Download file via SCP

# System
GET    /api/health                     # Health check
```

#### Terminal Session Management

The terminal system supports **persistent, re-attachable sessions** across multiple nodes:

```typescript
// Session can survive WebSocket disconnections
// Multiple clients can connect to same session
// Sessions persist in tmux on remote server
```

---

### 2. lane (Git Worktree Alternative)

**Location:** `/Users/ebowwa/lane`

**Purpose:** Simple alternative to git worktrees for parallel branch development

#### Key Features

- **Full copy mode**: Complete repo copy with isolated `.env` files
- **Worktree mode**: Lightweight, shares `.git` objects
- **Dependency symlink**: Symlinks `node_modules` to save 500MB-2GB per lane
- **Smart checkout**: Auto-finds or creates lane for branch
- **Interactive picker**: Terminal UI with Ink

#### Usage

```bash
lane                  # Interactive picker
lane new feature-xyz  # Create new lane
lane switch feature-xyz  # Switch to existing lane
lane checkout some-branch  # Smart: find or create
lane sync feature-xyz  # Copy .env from main repo
lane remove feature-xyz  # Delete lane
```

#### Lane Structure

```
~/my-app/               # Main repo
~/my-app-lane-a/        # Lane "a" (on feature/login)
~/my-app-lane-b/        # Lane "b" (on fix/bug-123)
```

---

### 3. seed (Worker Infrastructure)

**Location:** `/Users/ebowwa/seed`

**Purpose:** Dynamic environment setup + distributed Claude infrastructure

#### Directory Structure

```
seed/
├── setup.sh                 # Environment-aware installation
├── situations.yaml          # Declarative environment + tool config
├── chat.sh                  # Persistent Claude conversations
├── .claude/
│   ├── settings.node.json   # Z.ai GLM backend configuration
│   └── skills/
│       ├── distributed-claude-sender/   # Send prompts to remote Claude
│       └── distributed-claude-receiver/ # Receive and execute proposals
├── node-agent/              # Worker orchestration service
│   ├── src/
│   │   ├── index.ts         # HTTP server (port 8911)
│   │   └── services/
│   │       └── ralph.ts     # Ralph loop lifecycle
│   └── systemd/
│       └── node-agent.service  # Persistent service config
└── docs/
    ├── Claude_Code_Skills.md
    ├── GitHub_MCP_Integration.md
    └── GLM_Models_Comparison.md
```

#### setup.sh

Environment-aware tool installation that detects context and installs only what's needed:

**Supported Environments:**
- `vps` - Production VPS nodes
- `codespaces` - GitHub Codespaces
- `local_dev` - Local development workstation
- `ci_cd` - CI/CD pipelines
- `container` - Docker containers

**Tools Installed:**
- Claude Code (with Z.ai backend)
- GitHub CLI
- Doppler (secrets management)
- Tailscale (VPN)
- Vision MCP (Z.ai)
- Web Search MCP (Z.ai)
- **lane** (git worktree management for worker isolation)
- **Node Agent** (worker orchestration)

#### chat.sh

Persistent conversation wrapper for Claude Code:

```bash
# Maintains conversation history in /tmp/c.txt
# Each prompt includes full conversation context
# Loads secrets from Doppler
./chat.sh "your prompt here"
```

---

### 4. node-agent (Worker Orchestration)

**Location:** `/Users/ebowwa/seed/node-agent/`

**Purpose:** HTTP service that manages workers and Ralph loops on each VPS using lane for worktree isolation

#### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Node Agent                            │
│              (HTTP: localhost:8911)                     │
├─────────────────────────────────────────────────────────┤
│  HTTP API Layer (Bun.serve)                            │
│  ├── /api/status         # Health, capacity, active loops│
│  └── /api/ralph-loops    # Ralph loop management       │
├─────────────────────────────────────────────────────────┤
│  Services                                            │
│  ├── RalphService       # Loop lifecycle               │
│  ├── LaneService        # Lane CLI wrapper             │
│  └── MonitorService     # Resource tracking            │
├─────────────────────────────────────────────────────────┤
│  Process Management                                  │
│  ├── Spawn Claude Code processes                     │
│  ├── Use lane CLI to create worktrees                 │
│  ├── Track PIDs and resources                        │
│  └── Cleanup on completion                           │
└─────────────────────────────────────────────────────────┘
```

#### API Reference

##### GET /api/status

Get node health and capacity information.

```bash
curl http://localhost:8911/api/status
```

**Response:**
```json
{
  "status": "healthy",
  "uptime_seconds": 3600,
  "resources": {
    "cpu_percent": 15.5,
    "memory_mb": 2048,
    "disk_used_gb": 45.2,
    "disk_total_gb": 80.0
  },
  "capacity": {
    "max_workers": 10,
    "active_workers": 3,
    "available_workers": 7
  },
  "active_loops": [
    {
      "id": "loop-abc123",
      "task_id": "task-001",
      "lane_path": "/root/seed-lane-task-001",
      "pid": 12345,
      "iterations": 5,
      "started_at": "2026-01-20T10:30:00Z"
    }
  ]
}
```

##### POST /api/ralph-loops

Start a Ralph Loop. Node Agent uses `lane` CLI to create a worktree, then spawns Claude Code with the Ralph Loop plugin.

```bash
curl -X POST http://localhost:8911/api/ralph-loops \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task-001",
    "branch": "feat/node-agent",
    "prompt": "Refactor the auth module. Output <promise>DONE</promise> when complete.",
    "max_iterations": 50
  }'
```

**What happens internally:**
1. Node Agent executes: `lane new task-001 --branch feat/node-agent`
2. Creates: `~/seed-lane-task-001/`
3. Spawns Claude Code in that directory with Ralph Loop prompt
4. Returns loop ID for monitoring

**Response:**
```json
{
  "success": true,
  "loop": {
    "id": "loop-abc123",
    "task_id": "task-001",
    "lane_path": "/root/seed-lane-task-001",
    "pid": 12345,
    "status": "running",
    "started_at": "2026-01-20T10:30:00Z"
  }
}
```

##### GET /api/ralph-loops/:id

Get status of a specific Ralph Loop.

```bash
curl http://localhost:8911/api/ralph-loops/loop-abc123
```

**Response:**
```json
{
  "id": "loop-abc123",
  "task_id": "task-001",
  "status": "running",
  "pid": 12345,
  "iterations": 15,
  "started_at": "2026-01-20T10:30:00Z",
  "last_activity": "2026-01-20T10:45:00Z",
  "resources": {
    "cpu_percent": 25.3,
    "memory_mb": 512
  }
}
```

##### DELETE /api/ralph-loops/:id

Stop a Ralph Loop.

```bash
curl -X DELETE http://localhost:8911/api/ralph-loops/loop-abc123
```

**Response:**
```json
{
  "success": true,
  "message": "Loop loop-abc123 stopped",
  "final_stats": {
    "iterations": 23,
    "duration_seconds": 900,
    "completion_promise_found": true
  }
}
```

#### systemd Service

Node Agent runs as a persistent systemd service:

```ini
[Unit]
Description=Node Agent - Worker Orchestration
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/seed/node-agent
ExecStart=/usr/bin/bun run start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8911

[Install]
WantedBy=multi-user.target
```

**Management:**
```bash
systemctl status node-agent
systemctl start node-agent
systemctl stop node-agent
systemctl restart node-agent
journalctl -u node-agent -f  # View logs
```

---

### 5. Ralph Loop (Claude Code Plugin)

**Purpose:** Iterative AI development technique using Claude Code's stop hook mechanism

#### How It Works

```
┌─────────────────────────────────────────────────────────┐
│  Ralph Loop Plugin (runs inside Claude Code session)    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. User invokes: /ralph-loop "Fix the bug"            │
│                                                          │
│  2. Plugin creates: .claude/.ralph-loop.local.md       │
│     Contains: prompt, iteration count, max iterations  │
│                                                          │
│  3. Claude works on task...                             │
│                                                          │
│  4. Claude tries to exit                                │
│                                                          │
│  5. Stop hook intercepts: "Not done yet!"              │
│     Checks: iteration count < max?                     │
│             completion promise found?                  │
│                                                          │
│  6. If not done: Re-feed same prompt                   │
│     Claude sees its previous work in files             │
│                                                          │
│  7. Repeat from step 3 until:                          │
│     - <promise>TASK COMPLETE</promise> detected        │
│     - Max iterations reached                           │
│     - User cancels with /cancel-ralph                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### Commands

| Command | Purpose |
|---------|---------|
| `/ralph-loop "<PROMPT>" --max-iterations N` | Start loop with limit |
| `/ralph-loop "<PROMPT>" --completion-promise "TEXT"` | Exit when promise found |
| `/cancel-ralph` | Cancel active loop |

#### Completion Promises

Signal completion by including a promise tag in output:

```
<promise>TASK COMPLETE</promise>
```

Ralph Loop plugin scans Claude's output for this pattern to stop iteration.

#### Key Concept

**Ralph Loop ≠ Claude talking to itself**

The "loop" is:
- Same prompt fed repeatedly
- Claude sees previous work in files/git history
- Each iteration builds on the last
- Self-correction through seeing past attempts

---

## Data Flow

### Worker Spawn Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User creates server in cheapspaces dashboard                │
│    POST /api/environments                                       │
│    - Server name, type, location                               │
│    - Auto-includes seed installation flag                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Hetzner provisions VPS                                       │
│    - Returns server ID, IPv4, root password                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Seed installer runs via SSH                                  │
│    - Clones https://github.com/ebowwa/seed                     │
│    - Branch: feat/node-agent                                   │
│    - Runs: cd ~/seed && yes | bash setup.sh                    │
│    - Creates marker: .seed-setup-complete                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. setup.sh installs tools                                      │
│    - Detects environment: VPS                                   │
│    - Installs:                                                  │
│      ✓ Bun runtime                                             │
│      ✓ Node Agent (systemd service)                            │
│      ✓ Claude Code (with Z.ai backend)                         │
│      ✓ Tailscale (VPN)                                         │
│      ✓ GitHub CLI                                              │
│      ✓ Doppler (secrets)                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Node Agent starts (systemd)                                  │
│    - HTTP server on port 8911                                  │
│    - Returns 200 GET /api/status                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. VPS ready for worker tasks                                   │
│    - Tailscale IP assigned                                     │
│    - Node Agent accessible via VPN                             │
│    - lane CLI installed and ready                              │
│    - Awaiting Ralph Loop requests                              │
└─────────────────────────────────────────────────────────────────┘
```

### Task Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. cheapspaces dispatches task                                  │
│    POST http://node-agent:8911/api/ralph-loops                  │
│    {                                                            │
│      "task_id": "task-001",                                │
│      "prompt": "Implement feature X",                          │
│      "max_iterations": 50                                      │
│    }                                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Node Agent uses lane to create isolated environment           │
│    lane new task-001 --branch feat/node-agent                   │
│    Creates: ~/seed-lane-task-001/                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Node Agent spawns Claude Code process                       │
│    cd ~/seed-lane-task-001                                       │
│    CLAUDE_CONFIG=~/.claude/settings.node.json \                 │
│    doppler run --project seed --config prd -- \                 │
│      claude --continue "$PROMPT"                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Inside Claude Code session                                   │
│    - Ralph Loop plugin active                                   │
│    - Stop hook intercepts exit                                 │
│    - Iterations continue until:                                │
│      ✓ <promise>COMPLETION</promise> found                     │
│      ✓ Max iterations reached                                  │
│      ✓ Manual cancellation                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Completion detected                                          │
│    - Claude Code process exits                                 │
│    - Ralph Loop state file removed                              │
│    - Node Agent updates status                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Results available                                            │
│    GET /api/ralph-loops/:id/logs                                │
│    - Full iteration log                                        │
│    - Git diff of changes                                       │
│    - Resource usage stats                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deployment Guide

### Prerequisites

| Item | Requirement |
|------|-------------|
| **Local** | Bun installed, Claude Code CLI |
| **Hetzner** | API token with full permissions |
| **Doppler** | Account with secrets configured |
| **Tailscale** | Account + auth key |
| **GitHub** | PAT for repository operations |

### Step 1: Deploy cheapspaces (Control Plane)

```bash
# Clone repo
git clone https://github.com/ebowwa/cheapspaces.git
cd cheapspaces

# Install dependencies
bun install

# Configure environment
cat > .env << EOF
HETZNER_API_TOKEN=your_token_here
Z_AI_API_KEY=your_zai_key_here
EOF

# Start server
bun run dev
```

Access at: http://localhost:3000

### Step 2: Provision VPS via cheapspaces

1. Open cheapspaces dashboard
2. Click "Create Server"
3. Configure:
   - Name: `worker-001`
   - Type: `cax11` (€3.09/month) or `cx22` (€4.96/month)
   - Location: Your preferred region
   - SSH Key: Upload your public key
4. Enable "Auto-install seed"
5. Click "Create"

### Step 3: Configure VPS (First Time)

SSH into new VPS:

```bash
# Initial SSH (root password from Hetzner)
ssh root@<vps-ip>

# Tailscale setup (one-time)
sudo tailscale up
# Visit the URL shown to authenticate

# GitHub CLI setup
gh auth login
# Follow browser authentication flow

# Doppler setup
doppler login
# Copy the auth code from browser

# Configure Doppler project
doppler configure set project seed --scope /
```

### Step 4: Verify Node Agent

```bash
# Check Node Agent status
systemctl status node-agent

# Check API health
curl http://localhost:8911/api/status

# View logs
journalctl -u node-agent -f
```

Expected status output:
```json
{
  "status": "healthy",
  "capacity": {
    "max_workers": 10,
    "active_workers": 0,
    "available_workers": 10
  }
}
```

### Step 5: Connect via Tailscale

```bash
# Get Tailscale IP from VPS
ssh root@<vps-ip> 'tailscale ip -4'

# Test connectivity from local machine
curl http://<tailscale-ip>:8911/api/status
```

---

## API Reference

### Node Agent API

Base URL: `http://<tailscale-ip>:8911`

#### Status Endpoints

##### GET /api/status

Get node health and capacity.

**Response:**
```json
{
  "status": "healthy",
  "uptime_seconds": 3600,
  "resources": {
    "cpu_percent": 15.5,
    "memory_mb": 2048,
    "disk_used_gb": 45.2,
    "disk_total_gb": 80.0
  },
  "capacity": {
    "max_workers": 10,
    "active_workers": 3,
    "available_workers": 7
  },
  "active_loops": [...]
}
```

#### Ralph Loop Endpoints

##### GET /api/ralph-loops

List all active loops.

**Response:**
```json
{
  "loops": [
    {
      "id": "loop-abc123",
      "task_id": "task-001",
      "pid": 12345,
      "status": "running",
      "iterations": 15,
      "started_at": "2026-01-20T10:30:00Z"
    }
  ]
}
```

##### POST /api/ralph-loops

Start a Ralph Loop.

**Request:**
```json
{
  "task_id": "task-001",
  "prompt": "Refactor auth module. Output <promise>DONE</promise> when complete.",
  "max_iterations": 50,
  "completion_promise": "DONE"
}
```

**Response:**
```json
{
  "success": true,
  "loop": {
    "id": "loop-abc123",
    "task_id": "task-001",
    "pid": 12345,
    "status": "running",
    "started_at": "2026-01-20T10:30:00Z"
  }
}
```

##### GET /api/ralph-loops/:id

Get loop status.

**Response:**
```json
{
  "id": "loop-abc123",
  "task_id": "task-001",
  "status": "running",
  "pid": 12345,
  "iterations": 15,
  "started_at": "2026-01-20T10:30:00Z",
  "last_activity": "2026-01-20T10:45:00Z",
  "resources": {
    "cpu_percent": 25.3,
    "memory_mb": 512
  }
}
```

##### DELETE /api/ralph-loops/:id

Stop a Ralph Loop.

**Response:**
```json
{
  "success": true,
  "message": "Loop loop-abc123 stopped",
  "final_stats": {
    "iterations": 23,
    "duration_seconds": 900,
    "completion_promise_found": true
  }
}
```

##### GET /api/ralph-loops/:id/logs

Get loop logs.

**Response:**
```json
{
  "loop_id": "loop-abc123",
  "logs": [
    {
      "timestamp": "2026-01-20T10:30:00Z",
      "level": "info",
      "message": "Loop started"
    },
    {
      "timestamp": "2026-01-20T10:35:00Z",
      "level": "info",
      "message": "Iteration 5 completed"
    }
  ]
}
```

---

## Troubleshooting

### Node Agent Not Starting

**Symptom:** `systemctl status node-agent` shows "failed"

**Solutions:**

1. Check if port 8911 is already in use:
   ```bash
   lsof -i :8911
   ```

2. Check Node Agent logs:
   ```bash
   journalctl -u node-agent -n 50
   ```

3. Verify Bun is installed:
   ```bash
   which bun
   bun --version
   ```

4. Manual start for debugging:
   ```bash
   cd /root/seed/node-agent
   bun run dev
   ```

### Ralph Loop Not Starting

**Symptom:** `POST /api/ralph-loops` returns error

**Solutions:**

1. Verify lane is installed:
   ```bash
   which lane
   lane list
   ```

2. Check Doppler configuration:
   ```bash
   doppler configure get project --scope /
   doppler configure get config --scope /
   ```

3. Test lane manually:
   ```bash
   cd ~/seed
   lane new test-task --branch main
   cd ~/seed-lane-test-task
   ```

4. Test Claude Code manually in a lane:
   ```bash
   cd ~/seed-lane-test-task
   doppler run --project seed --config prd -- claude "hello"
   ```

### Tailscale Connection Issues

**Symptom:** Cannot reach Node Agent via Tailscale IP

**Solutions:**

1. Verify Tailscale is running:
   ```bash
   sudo tailscale status
   ```

2. Check firewall rules:
   ```bash
   sudo ufw status
   sudo ufw allow 8911/tcp
   ```

3. Restart Tailscale:
   ```bash
   sudo systemctl restart tailscaled
   ```

### High Memory Usage

**Symptom:** VPS running out of memory with multiple workers

**Solutions:**

1. Check active loops:
   ```bash
   curl http://localhost:8911/api/status
   ```

2. Kill specific loops:
   ```bash
   curl -X DELETE http://localhost:8911/api/ralph-loops/{loop-id}
   ```

3. Reduce max workers in Node Agent config:
   ```bash
   # Edit /root/seed/node-agent/.env
   MAX_WORKERS=5
   systemctl restart node-agent
   ```

---

## Development Roadmap

### Current Status (January 2026)

| Component | Status | Notes |
|-----------|--------|-------|
| cheapspaces dashboard | ✅ Working | localhost:3000 |
| Hetzner integration | ✅ Working | Full CRUD + actions |
| Terminal sessions | ✅ Working | WebSocket + tmux |
| Seed installer | ✅ Working | Auto-installs on VPS spawn |
| Node Agent | ⚠️ Untested | Built, not deployed to VPS |
| Ralph loops | ⏳ Pending | Requires Node Agent deployment |
| Orchestration layer | ⏳ TODO | cheapspaces → Node Agent integration |

### Near-Term Tasks

1. **Test Node Agent on real VPS**
   - Deploy to test Hetzner server
   - Verify systemd service stability
   - Test lane CLI integration for worker isolation
   - Test Ralph loop lifecycle

2. **Build orchestration layer**
   - Integrate Node Agent API into cheapspaces
   - Add "Start Worker" button in dashboard
   - Display worker status in UI
   - Stream worker logs to dashboard

3. **Implement worker pool management**
   - Auto-scale workers based on queue
   - Load balancing across nodes
   - Worker health monitoring
   - Auto-restart failed workers

4. **Add result collection**
   - Git diff collection on completion
   - Artifact retrieval (logs, outputs)
   - Success/failure reporting
   - Metrics dashboard

### Future Enhancements

- [ ] Multi-node support (worker clusters)
- [ ] Worker templates (pre-configured environments)
- [ ] Scheduled tasks (cron-like execution)
- [ ] Result caching and replay
- [ ] Cost optimization (auto-shutdown idle nodes)
- [ ] Webhook notifications (on completion)
- [ ] ACL/permissions for multi-tenant
- [ ] Persistent storage for worker outputs

---

## Contributing

See `/Users/ebowwa/seed/CONTRIBUTING.md` for:
- Branch strategy (main/dev/feature-*)
- Contributor workflow
- Development guidelines
- Testing requirements

---

## License

MIT License - See individual project repositories for details.

---

## Related Documentation

- [Claude Code Skills](/Users/ebowwa/seed/docs/Claude_Code_Skills.md)
- [GitHub MCP Integration](/Users/ebowwa/seed/docs/GitHub_MCP_Integration.md)
- [GLM Models Comparison](/Users/ebowwa/seed/docs/GLM_Models_Comparison.md)
- [Ralph Loop Technique](https://ghuntley.com/ralph/)
- [cheapspaces README](/Users/ebowwa/apps/com.hetzner.codespaces/README.md)
- [lane README](/Users/ebowwa/lane/README.md)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-20
**Maintained By:** ebowwa
