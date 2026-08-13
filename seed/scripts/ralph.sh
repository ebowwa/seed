#!/bin/bash
# ============================================================================
# Ralph Bash - Ralph Loop Implementation
# Standalone bash implementation of Ralph Loop technique
# ============================================================================

set -e

# ============================================================================
# Configuration
# ============================================================================

RALPH_DIR="${HOME}/.ralph"
STATE_FILE="${RALPH_DIR}/current-loop.txt"
LOG_DIR="${RALPH_DIR}/logs"
HISTORY_DIR="${RALPH_DIR}/history"
CURRENT_LOG="${LOG_DIR}/current.log"

DEFAULT_MAX_ITERATIONS=50

# ============================================================================
# Subagent Instructions (injected into each Claude invocation)
# ============================================================================

SUBAGENT_INSTRUCTIONS="
# IMPORTANT: Use Specialized Subagents

You have access to specialized subagents. Use them PROACTIVELY when tasks match their expertise:

## When to Launch Subagents:

**Explore subagent** → Understanding codebases, finding files, exploring architecture
**frontend-developer** → UI components, React, Next.js, TailwindCSS
**backend-typescript-architect** → API work, TypeScript backend, Bun runtime
**test-suite-generator** → Creating comprehensive test suites
**code-reviewer** → Reviewing code for quality, security, best practices
**security-architect** → Auth, security design, threat modeling
**database-schema-designer** → Database structure, migrations, optimization
**api-designer** → REST/GraphQL API endpoint design

## Subagent Workflow Pattern:

Instead of doing everything yourself:
1. Launch Explore subagent to understand the current system
2. Launch appropriate specialist subagents for implementation
3. Launch test-suite-generator after implementation
4. Launch code-reviewer before completing
5. Synthesize results and provide summary

## Example:
❌ \"I will read all files, understand the system, design the fix, implement it, write tests, and review everything myself\"
✅ \"Launch Explore subagent to understand the authentication system\"
✅ \"Launch security-architect to design the fix\"
✅ \"Launch backend-typescript-architect to implement the fix\"
✅ \"Launch test-suite-generator to create tests\"
✅ \"Launch code-reviewer to review the implementation\"
"

# ============================================================================
# Utilities
# ============================================================================

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$CURRENT_LOG"
}

ensure_dirs() {
  mkdir -p "$RALPH_DIR" "$LOG_DIR" "$HISTORY_DIR"
}

# ============================================================================
# State Management
# ============================================================================

create_state() {
  local prompt="$1"
  local max_iterations="$2"
  local completion="$3"
  local worktree="$4"

  cat > "$STATE_FILE" << EOF
RALPH_LOOP_STATE=1
PROMPT="$prompt"
MAX_ITERATIONS=$max_iterations
COMPLETION="$completion"
WORKTREE=$worktree
STARTED=$(date '+%Y-%m-%d %H:%M:%S')
ITERATION=1
EOF
}

read_state() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "ERROR: No active loop found"
    exit 1
  fi

  source "$STATE_FILE"
}

update_iteration() {
  sed -i.bak "s/^ITERATION=.*/ITERATION=$1/" "$STATE_FILE"
  rm -f "${STATE_FILE}.bak"
}

archive_loop() {
  local status="$1"
  local timestamp=$(date '+%Y%m%d-%H%M%S')
  local archive_file="${HISTORY_DIR}/loop-${timestamp}-${status}.txt"

  cp "$STATE_FILE" "$archive_file"
  cp "$CURRENT_LOG" "${LOG_DIR}/loop-${timestamp}-${status}.log"

  rm -f "$STATE_FILE"
  rm -f "$CURRENT_LOG"
}

# ============================================================================
# Commands
# ============================================================================

cmd_status() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "=== Ralph Loop Status ==="
    echo ""
    echo "No active loop found."
    echo ""
    echo "Start a new loop:"
    echo "  ./ralph.sh \"Your task here\""
    exit 0
  fi

  source "$STATE_FILE"

  echo "=== Ralph Loop Status ==="
  echo ""
  echo "Iteration:     ${ITERATION} / ${MAX_ITERATIONS}"
  echo "Started:       ${STARTED}"
  [[ -n "$WORKTREE" ]] && echo "Worktree:      ${WORKTREE}"
  echo ""
  echo "Prompt:"
  echo "  $PROMPT"
  echo ""
  if [[ -f "$CURRENT_LOG" ]]; then
    echo "=== Recent Activity ==="
    tail -n 20 "$CURRENT_LOG"
  fi
}

cmd_cancel() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "No active loop to cancel."
    exit 0
  fi

  source "$STATE_FILE"

  echo "Cancelling Ralph loop (iteration ${ITERATION})..."
  archive_loop "cancelled"
  echo "Loop cancelled. State archived to ${HISTORY_DIR}/"
}

cmd_continue() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "No active loop to continue."
    exit 0
  fi

  read_state

  if [[ $ITERATION -gt $MAX_ITERATIONS ]]; then
    echo "Maximum iterations reached ($MAX_ITERATIONS)"
    archive_loop "complete"
    exit 0
  fi

  echo "=== Ralph Loop: Continuing ==="
  echo "Iteration: $ITERATION / $MAX_ITERATIONS"
  echo ""

  run_iteration
}

# ============================================================================
# Core Loop
# ============================================================================

check_completion() {
  local output="$1"

  if [[ -n "$COMPLETION" ]]; then
    if echo "$output" | grep -q "<promise>${COMPLETION}</promise>"; then
      return 0
    fi
  fi

  return 1
}

run_iteration() {
  local work_dir="${WORKTREE:-$(pwd)}"

  log "=== Iteration ${ITERATION} ==="
  log "Working directory: ${work_dir}"

  # Build the prompt with subagent instructions
  local full_prompt="${SUBAGENT_INSTRUCTIONS}
---

# Task (Iteration ${ITERATION}/${MAX_ITERATIONS})

${PROMPT}

## Completion Condition

When you have completed this task, output: <promise>${COMPLETION:-DONE}</promise>

## Current Context

You are running in a Ralph Loop. Each iteration resets the conversation context.
Focus on the task at hand. Use the filesystem state as your memory.
"

  # Run Claude Code
  local output
  local exit_code

  log "Starting Claude Code..."
  output=$(cd "$work_dir" && claude --continue <<< "$full_prompt" 2>&1)
  exit_code=$?

  log "Claude Code exit code: $exit_code"
  log "$output"

  # Check for completion
  if check_completion "$output"; then
    echo ""
    echo "✓ Completion promise detected: ${COMPLETION:-DONE}"
    log "Completion detected: ${COMPLETION:-DONE}"
    archive_loop "complete"
    echo "Loop completed successfully!"
    exit 0
  fi

  # Increment iteration
  update_iteration $((ITERATION + 1))
  source "$STATE_FILE"

  # Check max iterations
  if [[ $ITERATION -gt $MAX_ITERATIONS ]]; then
    echo ""
    echo "Maximum iterations reached ($MAX_ITERATIONS)"
    log "Maximum iterations reached"
    archive_loop "max-iterations"
    exit 0
  fi

  # Pause before next iteration
  echo ""
  echo "Iteration ${ITERATION}/${MAX_ITERATIONS} complete. Pausing before next iteration..."
  sleep 2
}

# ============================================================================
# Main Entry Point
# ============================================================================

main() {
  ensure_dirs

  # Parse arguments
  local prompt=""
  local max_iterations="$DEFAULT_MAX_ITERATIONS"
  local completion=""
  local worktree=""

  while [[ $# -gt 0 ]]; do
    case $1 in
      --status)
        cmd_status
        exit 0
        ;;
      --cancel)
        cmd_cancel
        exit 0
        ;;
      --continue)
        cmd_continue
        exit 0
        ;;
      --max-iterations)
        max_iterations="$2"
        shift 2
        ;;
      --completion)
        completion="$2"
        shift 2
        ;;
      --worktree)
        worktree="$2"
        shift 2
        ;;
      -*)
        echo "ERROR: Unknown option: $1"
        echo "Run './ralph.sh --help' for usage"
        exit 1
        ;;
      *)
        prompt="$*"
        shift $#
        ;;
    esac
  done

  # Handle commands
  if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    echo "Ralph Bash - Ralph Loop Implementation"
    echo ""
    echo "USAGE:"
    echo "  ./ralph.sh \"Your task prompt\" [OPTIONS]"
    echo ""
    echo "COMMANDS:"
    echo "  --status          Show current loop status"
    echo "  --continue        Resume previous loop"
    echo "  --cancel          Cancel active loop"
    echo "  --help            Show this help"
    echo ""
    echo "OPTIONS:"
    echo "  --max-iterations N  Maximum iterations (default: 50)"
    echo "  --completion TEXT   Completion promise phrase"
    echo "  --worktree PATH     Run in specific directory"
    echo ""
    echo "EXAMPLES:"
    echo "  ./ralph.sh \"Fix the authentication bug\""
    echo "  ./ralph.sh \"Refactor cache\" --completion \"CACHE REFACTOR DONE\""
    echo "  ./ralph.sh \"Add tests\" --max-iterations 20 --worktree ~/repos/myapp-lane-001"
    exit 0
  fi

  # Check for existing loop
  if [[ -f "$STATE_FILE" ]]; then
    echo "A Ralph loop is already running!"
    echo ""
    echo "Options:"
    echo "  ./ralph.sh --status    # See what's running"
    echo "  ./ralph.sh --continue  # Resume the loop"
    echo "  ./ralph.sh --cancel    # Cancel it first"
    exit 1
  fi

  # Validate prompt
  if [[ -z "$prompt" ]]; then
    echo "ERROR: No prompt provided"
    echo "Usage: ./ralph.sh \"Your task here\""
    exit 1
  fi

  # Create new loop
  echo "=== Starting Ralph Loop ==="
  echo "Prompt: $prompt"
  echo "Max iterations: $max_iterations"
  [[ -n "$completion" ]] && echo "Completion promise: $completion"
  [[ -n "$worktree" ]] && echo "Worktree: $worktree"
  echo ""

  create_state "$prompt" "$max_iterations" "$completion" "$worktree"

  # Run first iteration
  run_iteration
}

main "$@"
