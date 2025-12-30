# VPS Conductor Skill

## Overview

The VPS Conductor skill enables Claude Code (desktop) to orchestrate multiple specialized Claude agent sessions running on a remote VPS. The desktop Claude acts as a **conductor/gatekeeper** that:
- Reviews codebase context locally
- Delegates tasks to specialized remote agents
- Reviews proposals before execution
- Makes approve/modify/reject decisions
- Maintains project integrity and safety

## Configuration

Set these environment variables:

```bash
export VPS_CONDUCTOR_HOST="ebowwa-deptwar"
export VPS_CONDUCTOR_USER="root"
export VPS_CONDUCTOR_SEED_DIR="/root/seed"
```

## Available Commands

### Agent Lifecycle
- `/vps-list-agents` - List all agent sessions on VPS
- `/vps-create-agent <type> <name>` - Create a new agent session
- `/vps-delete-agent <name>` - Delete an agent session
- `/vps-reset-agent <name>` - Reset agent conversation context
- `/vps-agent-status <name>` - Get detailed status of an agent

### Task Delegation
- `/vps-send <agent> <message>` - Send message to specific agent
- `/vps-broadcast <message>` - Send message to all agents
- `/vps-delegate <file>` - Delegate file review to appropriate agent

### System Commands
- `/vps-status` - Get VPS system status
- `/vps-health` - Run health check on VPS

## Agent Types

| Type | Role |
|------|------|
| `code-reviewer` | Reviews code for quality, style, and best practices |
| `test-writer` | Writes comprehensive tests for code |
| `doc-generator` | Generates documentation for code |
| `refactor-agent` | Refactors code for improved structure |
| `debugger` | Diagnoses and fixes bugs |
| `security-auditor` | Audits code for security vulnerabilities |

## Workflow Example

```bash
# 1. List available agents
/vps-list-agents

# 2. Create a code reviewer agent
/vps-create-agent code-reviewer reviewer-1

# 3. Delegate a file for review
/vps-delegate setup.sh

# 4. Agent returns proposal with suggested changes

# 5. Conductor reviews proposal against decision model:
#    - Security checklist
#    - Testing requirements
#    - Code quality standards
#    - Scope validation

# 6. Decision: APPROVE, MODIFY, or REJECT
#    - APPROVE: Apply changes via git
#    - MODIFY: Request revisions from agent
#    - REJECT: Discard proposal with explanation
```

## Decision Model

When an agent proposes a change, review using:

1. **Security Checklist** - No vulnerabilities, proper input validation
2. **Testing Checklist** - Tests cover changes, edge cases handled
3. **Code Quality** - Follows project conventions, readable
4. **Documentation** - Changes are documented
5. **Scope** - Changes match the task, no unrelated modifications

Decision categories:
- **APPROVE** - Safe to apply
- **MODIFY** - Good but needs adjustments
- **REJECT** - Unsafe or not aligned

## Best Practices

1. Always read code locally before delegating
2. Review all proposals before applying changes
3. Use parallel delegation for independent tasks
4. Reset agents between unrelated tasks
5. Maintain audit trail via git commits
6. Never expose secrets from VPS to desktop

## Integration with Claude Code

This skill integrates with Claude Code's permission system:
- File writes require permission prompts
- Git operations use built-in permission flow
- Conductor has final approval authority
