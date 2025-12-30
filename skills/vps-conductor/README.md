# VPS Conductor Skill

## What is this?

The VPS Conductor skill enables your desktop Claude Code to orchestrate multiple specialized AI agents running on a remote VPS. Think of it as having a team of AI assistants, each specializing in different areas, all coordinated by your desktop Claude.

## Quick Start

### 1. Configure Environment

```bash
export VPS_CONDUCTOR_HOST="ebowwa-deptwar"
export VPS_CONDUCTOR_USER="root"
export VPS_CONDUCTOR_SEED_DIR="/root/seed"
```

### 2. Source the Commands

```bash
source ~/.claude/skills/vps-conductor/commands.sh
```

### 3. Use in Claude Code

```
You: List the agents on the VPS
Claude: [calls vps_list_agents]
You: Create a code reviewer agent called "reviewer-1"
Claude: [calls vps_create_agent code-reviewer reviewer-1]
You: Ask reviewer-1 to review setup.sh
Claude: [calls vps_send reviewer-1 "Please review setup.sh"]
```

## Architecture

```
Desktop (Conductor)          VPS (Workers)
┌─────────────────┐          ┌──────────────────────────┐
│ Claude Code     │◄────────►│ session-manager.sh       │
│                 │ SSH+RPC  │                          │
│ - Reads code    │          │ ┌────┐ ┌────┐ ┌────┐   │
│ - Delegates     │          │ │Rev.│ │Test│ │Docs│   │
│ - Reviews       │          │ └────┘ └────┘ └────┘   │
│ - Approves      │          │                          │
└─────────────────┘          └──────────────────────────┘
```

## Available Commands

| Command | Description |
|---------|-------------|
| `vps_list_agents` | List all agent sessions |
| `vps_create_agent <type> <name>` | Create new agent |
| `vps_send <agent> <message>` | Send message to agent |
| `vps_delegate <file>` | Delegate file review |
| `vps_status` | Get VPS system status |

## Agent Types

- `code-reviewer` - Code quality and best practices
- `test-writer` - Test coverage and edge cases
- `doc-generator` - Documentation
- `refactor-agent` - Code restructuring
- `debugger` - Bug diagnosis and fixes
- `security-auditor` - Security vulnerabilities

## Decision Model

The conductor reviews all agent proposals before execution:

1. **Security** - No vulnerabilities
2. **Testing** - Changes are tested
3. **Code Quality** - Follows conventions
4. **Scope** - Matches the task

Decisions: APPROVE, MODIFY, or REJECT

## Example Workflow

```bash
# Create specialized agents
vps_create_agent code-reviewer reviewer-1
vps_create_agent test-writer tester-1
vps_create_agent security-auditor auditor-1

# Delegate work
vps_delegate src/main.py          # Goes to code-reviewer
vps_delegate tests/test_api.py    # Goes to test-writer
vps_delegate auth.py              # Goes to security-auditor

# Review proposals and apply changes
git add .
git commit -m "Apply agent-reviewed changes"
```

## Files

- `SKILL.md` - Main skill definition
- `commands.sh` - Helper bash commands
- `decision-model.md` - Decision criteria
- `README.md` - This file
