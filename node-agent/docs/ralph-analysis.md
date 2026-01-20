# Node Agent - First Principles Analysis

**Analyzed by:** Ralph Loop
**Date:** 2026-01-20
**Version:** 0.1.0

---

## Executive Summary

The **node-agent** is a distributed compute orchestration system for running autonomous AI coding agents (Claude Code with "Ralph Loop") across git worktrees on remote VPS nodes. It transforms a single VPS into a multi-agent compute fabric where each agent works in isolation on its own git branch/worktree.

---

## From First Principles: What Problem Does This Solve?

### The Problem
1. **Single-threaded AI development** - Claude Code can only work on one task at a time in one repository
2. **Resource underutilization** - VPSes have capacity to run multiple concurrent agents
3. **Branch isolation** - Parallel work needs isolated git contexts to avoid conflicts
4. **Remote orchestration** - Need to manage distributed agents from a central controller

### The Solution
A **HTTP API server** that:
1. Manages **git worktrees** (isolated working directories linked to a repo)
2. Spawns **Claude Code processes** with "Ralph Loop" in each worktree
3. Monitors **system resources** (CPU, memory, disk, ports, sessions)
4. Provides **REST endpoints** for remote control

---

## Architecture Breakdown

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Node Agent (Bun)                        │
│                      Port 8911                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │   HTTP API    │  │  Git Service  │  │ Ralph Service │   │
│  │   Router      │  │               │  │               │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│         │                   │                   │            │
│         ▼                   ▼                   ▼            │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │   CORS        │  │  worktree add │  │  spawn claude │   │
│  │   JSON        │  │  worktree rm  │  │  kill claude  │   │
│  │   errors      │  │  worktree ls  │  │  track PIDs   │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │  curl   │        │   git   │        │ doppler │
    │ client │        │ worktree│        │  spawn  │
    └─────────┘        └─────────┘        └─────────┘
```

### Data Flow

1. **Worktree Creation**
   ```
   POST /api/worktrees
   → GitService.createWorktree()
   → git worktree add /root/repos/main-repo-worktree-{id}
   → Creates .claude/ directory
   → Returns worktree metadata
   ```

2. **Ralph Loop Start**
   ```
   POST /api/ralph-loops
   → RalphService.startRalphLoop()
   → Creates .claude/ralph-loop.local.md (state file)
   → Creates .claude/settings.local.json (permissions)
   → spawn(doppler run --project seed --config prd -- claude)
   → Saves PID to ~/.node-agent/pids/{id}.pid
   ```

3. **Status Monitoring**
   ```
   GET /api/status
   → GitService.listWorktrees() (git worktree list)
   → RalphService.listRalphLoops() (parse state files, check PIDs)
   → getCapacity() (top, free, df, uptime)
   → getSessions() (who, tmux, ps aux)
   → getActivePorts() (ss/lsof parsing)
   → Returns aggregated node status
   ```

---

## API Contract

### Worktree Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/worktrees` | GET | List all git worktrees |
| `/api/worktrees` | POST | Create new worktree from branch |
| `/api/worktrees/:id` | DELETE | Remove worktree (stops any loop) |

### Ralph Loop Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ralph-loops` | GET | List all loops with status |
| `/api/ralph-loops` | POST | Start loop in worktree |
| `/api/ralph-loops/:id` | GET | Get specific loop status |
| `/api/ralph-loops/:id` | DELETE | Stop loop |
| `/api/ralph-loops/:id/logs` | GET | Get loop logs |

### Node Status
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/status` | GET | Full node health + capacity |

---

## State Management

### Files Created

**Per Worktree:**
- `.claude/ralph-loop.local.md` - YAML frontmatter + prompt
- `.claude/settings.local.json` - Permission whitelist

**Per Node:**
- `~/.node-agent/pids/{id}.pid` - Process tracking
- `~/.node-agent/logs/{id}.log` - Log aggregation

### State File Format (YAML Frontmatter)
```yaml
---
active: true
iteration: 0
max_iterations: 0
completion_promise: null
started_at: 2026-01-20T05:26:03.758Z
---

User prompt here...
```

### Loop Status Detection Logic
```
1. List all worktrees
2. For each, check if .claude/ralph-loop.local.md exists
3. Check if PID file exists and process is running
4. If PID alive → "running"
5. If state file exists but no PID → "stopped" or "complete"
```

---

## Resource Monitoring

### What It Tracks
- **CPU**: Parses `top -bn1` output for %CPU
- **Memory**: Parses `free` for % used
- **Disk**: Parses `df -h /` for % used
- **Load Average**: Parses `uptime` for 1/5/15 min
- **Processes**: Counts `ps -e` lines
- **Sessions**: Counts SSH (who), tmux sessions, Claude processes
- **Ports**: Parses `ss -tlnp` (Linux) or `lsof` (macOS)

### Cross-Platform Handling
- **Linux**: Uses `ss`, `top`, `free`
- **macOS**: Falls back to `lsof`, different memory parsing

---

## Security Model

### Tailscale-Only Trust
- No authentication in the API itself
- Relies on Tailscale network for access control
- Service binds to `0.0.0.0:8911` (all interfaces)

### Permission Whitelist
When starting a Ralph loop, it creates:
```json
{
  "permissions": {
    "allow": [
      "Skill(ralph-loop:ralph-loop)",
      "Bash(git:*)",
      "Bash(bun:*)",
      "Bash(npm:*)",
      "Bash(curl:*)",
      "Bash(node:*)",
      "Bash(python:*)",
      "Bash(python3:*)"
    ]
  }
}
```

### Process Isolation
- Each loop runs in separate git worktree
- Spawned via `doppler run` for secret injection
- Detached process (no stdio attached)

---

## Integration Points

### Doppler (Secrets)
```bash
doppler run --project seed --config prd -- claude
```
- Injects environment variables (API keys, tokens)
- Project/config configurable via env vars

### Git Worktrees
```bash
git worktree add /root/repos/main-repo-worktree-{id} {branch}
```
- Creates isolated working directory
- Shares `.git` objects with main repo
- Enables parallel branch work

### Ralph Loop (Claude Code Skill)
- The "stop hook" mechanism detects deleted state file
- When state file is removed, loop can exit gracefully
- Self-referential: same prompt fed back on each iteration

---

## Known Limitations

1. **No authentication** - Tailscale-only security
2. **No rate limiting** - API is unthrottled
3. **Basic PID tracking** - Could have orphaned processes
4. **Full log fetch** - No streaming or pagination
5. **YAML parsing** - Manual regex-based, not proper parser
6. **Single repository** - Hardcoded to "main-repo"
7. **No retry logic** - Git operations fail immediately

---

## Potential Use Cases

1. **Parallel CI/CD agents** - Multiple Claude agents testing different branches
2. **Distributed refactoring** - Large codebase split across agents
3. **A/B testing** - Run different approaches simultaneously
4. **Nightly builds** - Automated background processing
5. **Edge computing** - Deploy agents to multiple VPSes

---

## Summary

**Node Agent = Git Worktree Manager + Claude Code Process Spawner + System Monitor**

It's a simple but effective orchestration layer that turns a single VPS into a multi-agent AI development platform. The use of git worktrees for isolation and Bun for the HTTP server keeps it lightweight and fast.

The "Ralph Loop" concept is essentially Claude Code running in a self-referential loop where each iteration sees the previous work in git history, allowing for iterative refinement on the same task.

---

**Files Analyzed:**
- `/root/seed/node-agent/src/index.ts` - Main HTTP server (527 lines)
- `/root/seed/node-agent/src/types/index.ts` - TypeScript definitions (134 lines)
- `/root/seed/node-agent/src/services/git.ts` - Git worktree operations (179 lines)
- `/root/seed/node-agent/src/services/ralph.ts` - Ralph loop lifecycle (334 lines)
