# Ralph Bash Command - Quick Reference

**Location:** `/Users/ebowwa/seed/ralph.sh`
**Purpose:** Standalone bash implementation of Ralph Loop technique with subagent support

---

## Quick Start

```bash
cd ~/seed
chmod +x ralph.sh

# Start a simple loop
./ralph.sh "Fix the authentication bug in auth.ts"

# With completion promise
./ralph.sh "Refactor the cache layer" --completion "CACHE REFACTOR COMPLETE"

# With max iterations
./ralph.sh "Add comprehensive tests" --max-iterations 20

# In a specific worktree
./ralph.sh "Implement new feature" --worktree ~/repos/seed-worktree-001
```

---

## Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--max-iterations N` | Maximum iterations before stop | 50 |
| `--completion TEXT` | Promise phrase to detect completion | (none) |
| `--worktree PATH` | Run in specific directory | (current) |
| `--continue` | Resume previous loop | - |
| `--status` | Show current loop status | - |
| `--cancel` | Cancel active loop | - |

---

## Subagent Integration

The script automatically includes instructions for Claude to use specialized subagents. When Claude runs, it will be encouraged to:

### Launch Parallel Subagents For:

```
1. Explore subagent       → Understand codebases, find files
2. frontend-developer      → UI components
3. backend-typescript-architect → API work
4. test-suite-generator    → Create tests
5. code-reviewer           → Review code
6. security-architect      → Auth/security design
7. database-schema-designer → Database structure
8. api-designer            → API endpoints
```

### Example Subagent Usage Pattern:

Instead of:
```
❌ "I will read all files, understand the system, design the fix,
    implement it, write tests, and review everything myself"
```

Claude is prompted to:
```
✅ "Launch Explore subagent to understand the current system"
✅ "Launch security-architect to design the fix"
✅ "Launch backend-typescript-architect to implement"
✅ "Launch test-suite-generator for tests"
✅ "Launch code-reviewer to review"
✅ "Synthesize results and provide summary"
```

---

## Completion Promises

To automatically stop the loop, include a completion promise:

```bash
./ralph.sh "Add user authentication" \
  --completion "AUTHENTICATION COMPLETE"
```

Claude must output:
```
<promise>AUTHENTICATION COMPLETE</promise>
```

When detected, the loop stops immediately.

---

## Worktree Integration

Run Ralph in a specific worktree (useful for node-agent workers):

```bash
# Create worktree first
lane new feature-auth

# Run Ralph in that worktree
./ralph.sh "Implement OAuth login" \
  --worktree ~/my-app-lane-feature-auth
```

---

## State Management

Ralph stores state in `~/.ralph/`:

```
~/.ralph/
├── current-loop.txt          # Active loop state
├── history/                  # Completed/cancelled loops
│   ├── loop-20250120-143000-complete.txt
│   └── loop-20250120-150000-cancelled.txt
└── logs/                     # Iteration logs
    ├── ralph.log             # Main log
    ├── current.log           # Current loop output
    └── loop-*.log            # Archived logs
```

---

## Commands

### Check Status

```bash
./ralph.sh --status
```

Output:
```
=== Ralph Loop Status ===

Iteration:     5 / 50
Started:       2025-01-20 14:30:00
Worktree:      ~/repos/seed-worktree-001

Prompt:
  Fix the authentication bug

=== Recent Activity ===
[Shows last 20 lines of current loop]
```

### Continue Previous Loop

```bash
./ralph.sh --continue
```

Resumes from last iteration, increments counter, continues until:
- Completion promise found
- Max iterations reached
- Manually cancelled

### Cancel Running Loop

```bash
./ralph.sh --cancel
```

Stops the current loop and archives state/logs.

---

## Examples

### Simple Bug Fix

```bash
./ralph.sh "Fix the token refresh bug in src/auth.ts"
```

Runs up to 50 iterations, Claude improves code each time based on seeing previous work.

### Feature Implementation

```bash
./ralph.sh \
  "Add OAuth2 login with GitHub provider" \
  --completion "OAUTH GITHUB COMPLETE" \
  --max-iterations 30
```

Stops when Claude outputs `<promise>OAUTH GITHUB COMPLETE</promise>` or after 30 iterations.

### Test Generation

```bash
./ralph.sh \
  "Add comprehensive unit tests for the user service" \
  --completion "TESTS COMPLETE" \
  --max-iterations 20 \
  --worktree ~/repos/cheapspaces-worktree-001
```

### Code Refactoring

```bash
./ralph.sh \
  "Refactor the cache layer to use Redis instead of in-memory" \
  --completion "REDIS CACHE REFACTOR COMPLETE"
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  1. ./ralph.sh "Your task"                                   │
│     - Creates ~/.ralph/current-loop.txt with state          │
│     - Includes subagent instructions in prompt              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Iteration 1                                              │
│     - Runs: claude --continue                                │
│     - Prompt includes subagent instructions                 │
│     - Claude works, tries to exit                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Between Iterations                                       │
│     - Check for <promise>COMPLETION</promise>               │
│     - Check max iterations                                   │
│     - Update iteration counter in state file                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Iteration 2+                                             │
│     - Same prompt repeated                                   │
│     - Claude sees previous work in files/git                 │
│     - Continues where it left off                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Completion                                                │
│     - <promise> detected OR max iterations reached           │
│     - State archived to ~/.ralph/history/                    │
│     - Logs archived to ~/.ralph/logs/                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration with node-agent

The node-agent can use `ralph.sh` to run loops:

```bash
# Node Agent would do something like:
cd ~/repos/seed-worktree-task-001
~/seed/ralph.sh "Implement feature X" --completion "DONE"
```

This provides:
- Loop state management via files
- Log capture per iteration
- Completion detection via promises
- Subagent delegation built into the prompt

---

## Troubleshooting

### "A Ralph loop is already running!"

You have an active loop. Options:
```bash
./ralph.sh --status    # See what's running
./ralph.sh --cancel    # Cancel it
./ralph.sh --continue  # Resume it
```

### Loop not stopping

Check if completion promise matches exactly:
```bash
grep promise ~/.ralph/logs/current.log
```

### Claude not using subagents

Check that the prompt includes subagent instructions:
```bash
head -n 50 ~/.ralph/logs/current.log
```

Should see the "# IMPORTANT: Use Specialized Subagents" section.

---

## Comparison: Ralph Bash vs Ralph Loop Skill

| Aspect | Ralph Bash | Ralph Loop Skill |
|--------|------------|------------------|
| **Invocation** | `./ralph.sh "prompt"` | `/ralph-loop "prompt"` |
| **State Storage** | `~/.ralph/current-loop.txt` | `.claude/.ralph-loop.local.md` |
| **Runs** | Independent of Claude | Inside Claude session |
| **Use Case** | Scripts, automation | Interactive sessions |
| **Subagent Support** | ✅ Built-in prompt | ⚠️ Depends on your prompt |
| **Completion Detection** | ✅ Built-in | ✅ Via stop hook |

---

## Advanced: Custom Subagent Prompts

Edit `ralph.sh` to customize the `SUBAGENT_INSTRUCTIONS` variable:

```bash
SUBAGENT_INSTRUCTIONS="
# Custom Subagent Strategy

When working, prioritize:
1. Launch Explore subagent FIRST to understand context
2. Launch appropriate specialist subagents
3. Use test-suite-generator LAST (after implementation)
4. Always use code-reviewer before completing

Additional guidelines:
- Prefer backend-typescript-architect over generic backend work
- Use security-architect for any auth/token changes
- Use database-schema-designer for database migrations
..."
```

---

**Related Documentation:**
- [24-7_Worker_Architecture.md](./24-7_Worker_Architecture.md)
- [Environment_Variables_Reference.md](./Environment_Variables_Reference.md)
- Ralph Loop technique: https://ghuntley.com/ralph/

---

**Version:** 1.0.0
**Last Updated:** 2025-01-20
**Maintained By:** ebowwa
