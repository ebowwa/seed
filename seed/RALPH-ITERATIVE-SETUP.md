# Ralph Iterative Plugin Setup

**"Mr. Meeseeks Mode"** - Autonomous AI agent that relentlessly iterates until task completion.

---

## Quick Start

```bash
cd ~/seed
./setup-ralph-iterative.sh
```

Then run:

```bash
doppler run --project seed --config prd -- claude '/go "Your task here" --completion-promise DONE' -p
```

---

## What is Ralph Iterative?

Ralph Iterative is a Claude Code plugin that:
- **Loops indefinitely** until a completion signal is received
- **Tracks state** in `.claude/.ralph-iterative.local.json`
- **Monitored by Node Agent** on port 8911
- **Uses subagents** for planning, execution, review, fixing

---

## Setup Steps

### 1. Verify Plugin Directory

```bash
# Check settings.json has plugin-dir configured
cat ~/.claude/settings.json | grep plugin-dir
```

Should show:
```json
"plugin-dir": ["/root/repos/ralph/.claude-plugin"]
```

### 2. Create Symlinks

```bash
# Create directories
mkdir -p /root/repos/ralph/.claude-plugin/commands
mkdir -p /root/repos/ralph/.claude-plugin/skills

# Symlink ALL commands
for f in /root/repos/ralph/plugins/ralph-iterative/commands/*.md; do
  ln -sf "$f" /root/repos/ralph/.claude-plugin/commands/
done

# Symlink ALL skills
for d in /root/repos/ralph/plugins/ralph-iterative/skills/*; do
  ln -sf "$d" /root/repos/ralph/.claude-plugin/skills/
done
```

### 3. Verify Installation

```bash
ls /root/repos/ralph/.claude-plugin/commands/
ls /root/repos/ralph/.claude-plugin/skills/
```

Should show:
- `go.md`, `quit.md`, `ralph-iterative-status.md`, etc.
- `ralph-planner`, `ralph-executor`, `ralph-paranoid`, etc.

---

## Available Commands

| Command | Description |
|---------|-------------|
| `/go` | Start Ralph Iterative loop |
| `/quit` | Stop the active loop |
| `/ralph-iterative-status` | Show session status |
| `/ralph-iterative-history` | Show session history |
| `/ralph-iterative-resume` | Resume a session |
| `/ralph-iterative-archives` | List archived sessions |
| `/ralph-iterative-clean` | Clean up old state files |

---

## Usage Examples

### Basic Loop

```bash
doppler run --project seed --config prd -- claude '/go "Fix the authentication bug" --completion-promise BUG_FIXED' -p
```

### With Git Integration

```bash
doppler run --project seed --config prd -- claude '/go "Add user authentication with JWT" --completion-promise AUTH_DONE --enable-subagents --auto-commit' -p
```

### With Pull Request

```bash
doppler run --project seed --config prd -- claude '/go "Build dashboard" --completion-promise DASHBOARD_DONE --enable-subagents --auto-pr --use-lane' -p
```

---

## Completion Promise

**IMPORTANT:** Always provide a `--completion-promise`. This is the signal that tells Ralph when the task is complete.

```bash
# Good - specific completion signal
'/go "Add tests" --completion-promise TESTS_PASSING'

# Bad - no completion signal (will loop forever or hit max iterations)
'/go "Add tests"'
```

Ralph looks for: `<promise>YOUR_PROMISE_TEXT</promise>` in the output.

---

## State File

Location: `.claude/.ralph-iterative.local.json`

```json
{
  "prompt": "Your task",
  "promise": "DONE",
  "iteration": 3,
  "startTime": "2026-01-31T00:00:00.000Z",
  "tokens": { "totalInput": 0, "totalOutput": 0 },
  "filesChanged": [],
  "machine": { "cpu": { "count": 8 }, ... }
}
```

---

## Node Agent Integration

Ralph loops are **automatically tracked** by Node Agent:

```bash
# Check Node Agent status
curl http://localhost:8911/api/status

# View Ralph loops
curl http://localhost:8911/api/ralph-loops
```

The GUI dashboard at `http://localhost:3000` also shows:
- Active Ralph loops
- Iteration counts
- Completion status
- Resource usage

---

## Troubleshooting

### "Unknown skill: ralph-iterative:go"

**Wrong:** `/ralph-iterative:go "task"`
**Right:** `/go "task"`

The command name comes from the **filename** (`go.md`), not the frontmatter `name` field.

### Ralph not looping

1. Check state file exists: `cat .claude/.ralph-iterative.local.json`
2. Verify completion promise wasn't already met
3. Check for errors in output

### Symlinks not working

```bash
# Verify symlinks point to valid files
ls -la /root/repos/ralph/.claude-plugin/commands/go.md
ls -la /root/repos/ralph/.claude-plugin/skills/ralph-iterative
```

### Commands not found

1. Check `~/.claude/settings.json` has `plugin-dir` set correctly
2. Verify `enableSlashCommands: true`
3. Restart Claude Code session

---

## SLAM Mode (Advanced)

With `--enable-subagents`, Ralph uses specialized subagents:

| Subagent | Purpose |
|----------|---------|
| `ralph-planner` | Break down tasks into sub-tasks |
| `ralph-executor` | Execute a single sub-task |
| `ralph-paranoid` | Quality gate - checks for bugs, feature creep |
| `ralph-reviewer` | Review code changes |
| `ralph-fixer` | Fix issues found in review |
| `ralph-git` | Handle git operations |
| `ralph-healer` | Recover from stuck states |
| `ralph-manager` | Orchestrate the SLAM phases |

---

## Best Practices

1. **Always use completion promises** - otherwise Ralph loops forever
2. **Run in monitored directories** - `~/seed`, `~/seed/node-agent` for Node Agent tracking
3. **Use worktrees for isolation** - `--use-lane` or `--use-worktree`
4. **Enable subagents for complex tasks** - `--enable-subagents`
5. **Check status periodically** - `/ralph-iterative-status`

---

## Resources

- [Ralph Iterative Source](https://github.com/ebowwa/ralph)
- [Node Agent Docs](../node-agent/docs/)
- [SLAM Pattern](../docs/SLAM_PATTERN.md)
