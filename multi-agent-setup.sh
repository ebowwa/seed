#!/bin/bash
# ============================================================================
# Multi-Agent Ralph Orchestration Setup
# Sets up PM Ralph + 3 Worker Ralphs with git branch isolation
# ============================================================================

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Multi-Agent Ralph Orchestration Setup                    ║"
echo "║  PM Ralph + 3 Worker Ralphs with Git Isolation            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)"
   exit 1
fi

# ============================================================================
# Configuration
# ============================================================================

REPO_URL="https://github.com/ebowwa/codespaces.git"
# Or use your private: REPO_URL="git@github.com:ebowwa/codespaces.git"

SEED_DIR="/root/seed"
PM_RALPH_DIR="${SEED_DIR}/pm"
WORKER_BASE_DIR="${SEED_DIR}/workers"

# Git configuration
GIT_AUTHOR_NAME="PM Ralph"
GIT_AUTHOR_EMAIL="pm-ralph@auto.ai"

echo ":: Configuration ::"
echo "  Repo:        ${REPO_URL}"
echo "  Seed Dir:    ${SEED_DIR}"
echo "  PM Ralph:    ${PM_RALPH_DIR}"
echo "  Workers:     ${WORKER_BASE_DIR}"
echo ""

# ============================================================================
# Step 1: Install System Dependencies
# ============================================================================

echo ":: Step 1: Installing System Dependencies ::"

apt-get update -qq
apt-get install -y -qq curl git unzip build-essential

echo "✓ System dependencies installed"
echo ""

# ============================================================================
# Step 2: Install Bun
# ============================================================================

echo ":: Step 2: Installing Bun Runtime ::"

if ! command -v bun &> /dev/null; then
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
    echo "✓ Bun installed: $(bun --version)"
else
    echo "✓ Bun already installed: $(bun --version)"
fi
echo ""

# ============================================================================
# Step 3: Clone codespaces Repository
# ============================================================================

echo ":: Step 3: Cloning codespaces Repository ::"

if [[ -d "$SEED_DIR" ]]; then
    echo "  → Removing existing seed directory"
    rm -rf "$SEED_DIR"
fi

mkdir -p "$(dirname "$SEED_DIR")"
cd "$(dirname "$SEED_DIR")"

# For public repo
git clone "$REPO_URL" "$SEED_DIR"

# For private repo, uncomment and use:
# GIT_SSH_COMMAND="ssh -i /path/to/key" git clone "$REPO_URL" "$SEED_DIR"

cd "$SEED_DIR"
echo "✓ Repository cloned to ${SEED_DIR}"
echo ""

# ============================================================================
# Step 4: Install Claude Code
# ============================================================================

echo ":: Step 4: Installing Claude Code CLI ::"

if ! command -v claude &> /dev/null; then
    bun install -g claude-code
    echo "✓ Claude Code installed"
else
    echo "✓ Claude Code already installed"
fi
echo ""

# ============================================================================
# Step 5: Install lane CLI (git worktrees)
# ============================================================================

echo ":: Step 5: Installing lane CLI ::"

cd "$SEED_DIR"

# Install lane from the repository
cd lane && bun install && bun run build && cd ..

# Create symlink for lane
ln -sf "$SEED_DIR/lane/dist/cli.js" /usr/local/bin/lane
chmod +x /usr/local/bin/lane

echo "✓ Lane CLI installed"
echo ""

# ============================================================================
# Step 6: Create PM Ralph Workspace
# ============================================================================

echo ":: Step 6: Creating PM Ralph Workspace ::"

mkdir -p "$PM_RALPH_DIR"

# PM Ralph prompt - focuses on orchestration and task distribution
cat > "${PM_RALPH_DIR}/PROMPT.md" << 'EOF'
# PM Ralph - Project Manager Agent

You are the **PM Ralph** - the project manager agent that orchestrates worker agents.

## Your Responsibilities

1. **Task Analysis & Distribution**
   - Analyze incoming tasks/feature requests
   - Break down complex tasks into sub-tasks
   - Assign sub-tasks to worker agents (Worker-1, Worker-2, Worker-3)

2. **Worker Coordination**
   - Monitor worker agent status via their worktrees
   - Ensure workers are not blocked
   - Rebalance tasks if a worker is stuck

3. **Code Review & Integration**
   - Review worker PRs when marked as ready
   - Merge approved changes to main
   - Create integration branches when workers need to collaborate

4. **Quality Control**
   - Ensure all tests pass before merging
   - Verify that changes follow project standards
   - Track metrics: worker iteration counts, success rates

## Worker Assignment Strategy

```
Worker-1 (Backend/API) → API endpoints, server logic, database
Worker-2 (Frontend/UI)  → UI components, styling, UX
Worker-3 (Tests/Docs)    → Unit tests, integration tests, documentation
```

## Your Workflow

1. **Receive Task** → Read specifications from `/specs/` or incoming requests
2. **Break Down** → Create sub-tasks for each worker
3. **Dispatch** → Start worker Ralph loops with their prompts
4. **Monitor** → Check worker status every iteration
5. **Review** → When workers complete, review their changes
6. **Integrate** → Merge worker branches into main
7. **Report** → Update project status

## Completion Promise

When the overall project is complete and all worker tasks are integrated, output:
`<promise>PROJECT COMPLETE</promise>`

## Current Context

- **Project Root:** /root/seed/
- **Workers Base:** /root/seed/workers/
- **Main Branch:** main
- **Integration Branch:** pm-integration
EOF

# PM Ralph spec file
cat > "${PM_RALPH_DIR}/SPEC.md" << 'EOF'
# PM Ralph Specification

## Loop Configuration
- **Max Iterations:** 100
- **Completion Promise:** PROJECT COMPLETE
- **Worktree:** /root/seed/pm-worktree

## Worker Agents

| Worker | Worktree | Focus | Branch Prefix |
|--------|----------|-------|---------------|
| Worker-1 | workers/worker-1 | Backend/API | worker-1/ |
| Worker-2 | workers/worker-2 | Frontend/UI | worker-2/ |
| Worker-3 | workers/worker-3 | Tests/Docs | worker-3/ |

## Git Workflow

```
main (protected)
  ↑
  ├─ worker-1/feature-xxx (Worker-1 branch)
  ├─ worker-2/feature-xxx (Worker-2 branch)
  └─ worker-3/feature-xxx (Worker-3 branch)
       ↓
    PM Ralph reviews & merges
```

## Commands Available

- `lane new <name>` - Create new worktree
- `lane switch <name>` - Switch to worktree
- `ralph.sh "prompt"` - Start Ralph loop
- `git status` - Check current state
EOF

echo "✓ PM Ralph workspace created at ${PM_RALPH_DIR}"
echo ""

# ============================================================================
# Step 7: Create Worker Workspaces
# ============================================================================

echo ":: Step 7: Creating Worker Workspaces ::"

for WORKER_ID in 1 2 3; do
    WORKER_DIR="${WORKER_BASE_DIR}/worker-${WORKER_ID}"
    mkdir -p "$WORKER_DIR"

    # Determine worker focus
    case $WORKER_ID in
        1)
            WORKER_NAME="Worker-1 (Backend/API)"
            WORKER_FOCUS="backend and API development - endpoints, server logic, database operations, authentication"
            ;;
        2)
            WORKER_NAME="Worker-2 (Frontend/UI)"
            WORKER_FOCUS="frontend and UI development - React components, styling, user experience, accessibility"
            ;;
        3)
            WORKER_NAME="Worker-3 (Tests/Docs)"
            WORKER_FOCUS="testing and documentation - unit tests, integration tests, API docs, README files"
            ;;
    esac

    # Worker prompt
    cat > "${WORKER_DIR}/PROMPT.md" << EOF
# ${WORKER_NAME} - Autonomous Development Agent

You are **${WORKER_NAME}** - a specialized AI agent focused on ${WORKER_FOCUS}.

## Your Responsibilities

1. **Task Execution**
   - Receive tasks from PM Ralph
   - Implement changes in your worktree
   - Write tests for your changes
   - Document your code

2. **Code Quality**
   - Follow project coding standards
   - Ensure all tests pass
   - Write clean, maintainable code
   - Add appropriate error handling

3. **Collaboration**
   - Commit your changes to your branch
   - Create pull requests when tasks are complete
   - Review other workers' changes when relevant
   - Coordinate with PM Ralph for integration

## Your Workflow

1. **Receive Task** → Read task from PM Ralph or SPEC file
2. **Create Branch** → Create feature branch: worker-${WORKER_ID}/feature-name
3. **Implement** → Write code to complete the task
4. **Test** → Run tests and verify functionality
5. **Commit** → Commit changes with descriptive messages
6. **PR** → Create pull request to main
7. **Notify** → Update PM Ralph that task is complete

## Git Workflow

\`\`\`
cd /root/seed/
lane new worker-${WORKER_ID}-<feature>
# Do work
git add .
git commit -m "worker-${WORKER_ID}: descriptive message"
git push origin worker-${WORKER_ID}-<feature>
\`\`\`

## Completion Promise

When your assigned task is complete and tested, output:
\`<promise>WORKER-${WORKER_ID} COMPLETE</promise>\`

## Current Context

- **Worker ID:** ${WORKER_ID}
- **Worktree:** workers/worker-${WORKER_ID}
- **Branch Prefix:** worker-${WORKER_ID}/
- **Focus:** ${WORKER_FOCUS}
EOF

    # Worker spec
    cat > "${WORKER_DIR}/SPEC.md" << EOF
# ${WORKER_NAME} Specification

## Loop Configuration
- **Max Iterations:** 50
- **Completion Promise:** WORKER-${WORKER_ID} COMPLETE
- **Worktree:** /root/seed/workers/worker-${WORKER_ID}

## Skills & Tools

- **Language:** TypeScript, Bash
- **Runtime:** Bun
- **Framework:** React (for Worker-2), Hono (for Worker-1)
- **Testing:** bun test
- **Git:** lane CLI for worktrees

## PM Ralph Communication

- **Task Requests:** Read from /root/seed/pm/TASKS.md
- **Status Updates:** Write to /root/seed/workers/worker-${WORKER_ID}/STATUS.md
- **Completion:** Signal PM Ralph via completion promise

## Code Standards

- Use TypeScript strict mode
- Write descriptive commit messages
- Add JSDoc comments for functions
- Include error handling
- Write tests for new features
EOF

    echo "✓ Created ${WORKER_DIR}/"
done

echo ""

# ============================================================================
# Step 8: Create Ralph Orchestration Script
# ============================================================================

echo ":: Step 8: Creating Ralph Orchestration Scripts ::"

# Make ralph.sh executable
chmod +x "${SEED_DIR}/ralph.sh"

# Create start-all script
cat > "${SEED_DIR}/start-all-ralphs.sh" << 'EOFSCRIPT'
#!/bin/bash
# Start all Ralph agents (PM + 3 Workers)

SEED_DIR="/root/seed"
LOG_DIR="${SEED_DIR}/logs"

mkdir -p "$LOG_DIR"

echo "Starting Multi-Agent Ralph System..."
echo ""

# Start PM Ralph in background
echo "→ Starting PM Ralph..."
cd "$SEED_DIR"
nohup ./ralph.sh \
    "$(cat pm/PROMPT.md)" \
    --completion "PROJECT COMPLETE" \
    --max-iterations 100 \
    > "$LOG_DIR/pm-ralph.log" 2>&1 &
PM_PID=$!
echo "  PM Ralph started (PID: $PM_PID)"

# Start Workers
for WORKER_ID in 1 2 3; do
    echo "→ Starting Worker-${WORKER_ID}..."
    nohup ./ralph.sh \
        "$(cat workers/worker-${WORKER_ID}/PROMPT.md)" \
        --completion "WORKER-${WORKER_ID} COMPLETE" \
        --max-iterations 50 \
        --worktree "$SEED_DIR/workers/worker-${WORKER_ID}" \
        > "$LOG_DIR/worker-${WORKER_ID}.log" 2>&1 &
    WORKER_PID=$!
    echo "  Worker-${WORKER_ID} started (PID: $WORKER_PID)"
done

echo ""
echo "✓ All Ralph agents started!"
echo ""
echo "Monitor logs:"
echo "  tail -f $LOG_DIR/pm-ralph.log"
echo "  tail -f $LOG_DIR/worker-1.log"
echo "  tail -f $LOG_DIR/worker-2.log"
echo "  tail -f $LOG_DIR/worker-3.log"
echo ""
echo "Check status:"
echo "  ./ralph.sh --status"
EOFSCRIPT

chmod +x "${SEED_DIR}/start-all-ralphs.sh"

# Create status check script
cat > "${SEED_DIR}/check-all-ralphs.sh" << 'EOFSCRIPT'
#!/bin/bash
# Check status of all Ralph agents

SEED_DIR="/root/seed"
RALPH_DIR="$HOME/.ralph"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Multi-Agent Ralph Status                                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check PM Ralph
if [[ -f "$RALPH_DIR/current-loop.txt" ]]; then
    echo ":: PM Ralph Status ::"
    grep "ITERATION=" "$RALPH_DIR/current-loop.txt" || echo "  Not running"
    echo ""
else
    echo ":: PM Ralph :: Not running"
    echo ""
fi

# Check Workers
for WORKER_ID in 1 2 3; do
    WORKER_STATE="${SEED_DIR}/workers/worker-${WORKER_ID}/.ralph/current-loop.txt"
    if [[ -f "$WORKER_STATE" ]]; then
        echo ":: Worker-${WORKER_ID} Status ::"
        grep "ITERATION=" "$WORKER_STATE" || echo "  Not running"
    else
        echo ":: Worker-${WORKER_ID} :: Not running"
    fi
    echo ""
done

# Show recent git activity
echo ":: Recent Git Activity ::"
cd "$SEED_DIR"
git branch -a | head -20
echo ""

# Show recent commits
echo ":: Recent Commits ::"
git log --oneline --graph --all -10
EOFSCRIPT

chmod +x "${SEED_DIR}/check-all-ralphs.sh"

# Create stop-all script
cat > "${SEED_DIR}/stop-all-ralphs.sh" << 'EOFSCRIPT'
#!/bin/bash
# Stop all Ralph agents

echo "Stopping all Ralph agents..."

# Stop PM Ralph
cd /root/seed
./ralph.sh --cancel 2>/dev/null || true

# Stop Workers
for WORKER_ID in 1 2 3; do
    cd "/root/seed/workers/worker-${WORKER_ID}"
    /root/seed/ralph.sh --cancel 2>/dev/null || true
done

echo "✓ All Ralph agents stopped"
EOFSCRIPT

chmod +x "${SEED_DIR}/stop-all-ralphs.sh"

echo "✓ Orchestration scripts created"
echo ""

# ============================================================================
# Step 9: Create Git Structure
# ============================================================================

echo ":: Step 9: Setting Up Git Structure ::"

cd "$SEED_DIR"

# Configure git
git config --global user.name "$GIT_AUTHOR_NAME"
git config --global user.email "$GIT_AUTHOR_EMAIL"

# Create main branch if not exists
git checkout -b main 2>/dev/null || git checkout main

# Create PM worktree
lane new pm-main 2>/dev/null || echo "  PM worktree exists"

# Create worker worktrees
for WORKER_ID in 1 2 3; do
    lane new "worker-${WORKER_ID}-main" 2>/dev/null || echo "  Worker-${WORKER_ID} worktree exists"
done

echo "✓ Git structure created"
echo ""

# ============================================================================
# Step 10: Create Initial Task for PM Ralph
# ============================================================================

echo ":: Step 10: Creating Initial Task ::"

mkdir -p "${SEED_DIR}/tasks"

cat > "${SEED_DIR}/tasks/INITIAL_TASK.md" << 'EOFTASK'
# Initial Task: Multi-Agent Ralph System Setup

## Overview
Set up and verify the multi-agent Ralph system with PM Ralph + 3 Worker Ralphs.

## Sub-Tasks

### Worker-1 (Backend/API)
- [ ] Create a simple Hono server in `/api/src/server.ts`
- [ ] Add health check endpoint at `/api/health`
- [ ] Add endpoint to list worker status at `/api/workers`
- [ ] Write tests for API endpoints
- [ ] Create PR: `worker-1/api-server`

### Worker-2 (Frontend/UI)
- [ ] Create dashboard UI showing all Ralph agent status
- [ ] Display iteration counts for each agent
- [ ] Show recent git commits
- [ ] Add controls to start/stop agents
- [ ] Create PR: `worker-2/dashboard-ui`

### Worker-3 (Tests/Docs)
- [ ] Write integration tests for the multi-agent system
- [ ] Create API documentation
- [ ] Write README for the project
- [ ] Add deployment documentation
- [ ] Create PR: `worker-3/tests-docs`

## Success Criteria

1. All 3 workers have completed their tasks
2. All tests pass
3. Dashboard shows live agent status
4. Documentation is complete
5. All PRs merged to main

## Completion Signal

When all sub-tasks are complete and merged, output:
`<promise>PROJECT COMPLETE</promise>`
EOFTASK

echo "✓ Initial task created at ${SEED_DIR}/tasks/INITIAL_TASK.md"
echo ""

# ============================================================================
# Complete
# ============================================================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Setup Complete!                                           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next Steps:"
echo ""
echo "1. Start all Ralph agents:"
echo "   cd /root/seed && ./start-all-ralphs.sh"
echo ""
echo "2. Monitor status:"
echo "   cd /root/seed && ./check-all-ralphs.sh"
echo ""
echo "3. View logs:"
echo "   tail -f /root/seed/logs/pm-ralph.log"
echo "   tail -f /root/seed/logs/worker-1.log"
echo "   tail -f /root/seed/logs/worker-2.log"
echo "   tail -f /root/seed/logs/worker-3.log"
echo ""
echo "4. Stop all agents:"
echo "   cd /root/seed && ./stop-all-ralphs.sh"
echo ""
echo "Files created:"
echo "  PM Ralph:       ${PM_RALPH_DIR}/"
echo "  Workers:        ${WORKER_BASE_DIR}/"
echo "  Tasks:          ${SEED_DIR}/tasks/"
echo "  Scripts:        ${SEED_DIR}/*-ralphs.sh"
echo ""
