/**
 * Seed State Management
 *
 * Comprehensive state tracking for Seed Node Agent, inspired by Ralph Iterative's
 * state system. Provides crash recovery, work memory, token tracking, and
 * operational history.
 */

export interface SeedState {
  // ============== System Identity ==============
  version: string;              // Seed version
  nodeId: string;               // Unique node identifier (hostname)
  initializedAt: string;        // ISO timestamp of first initialization
  lastUpdated: string;          // ISO timestamp of last state update

  // ============== Machine Context ==============
  machine?: {
    cpu: {
      count: number;            // Number of CPU cores
      model: string;            // CPU model name
      tier: string;             // Capacity tier (low/medium/high)
    };
    memory: {
      total: number;            // Total memory in bytes
      available: number;        // Available memory in bytes
      tier: string;             // Capacity tier
    };
    disk: {
      total: number;            // Total disk space in bytes
      available: number;        // Available disk space in bytes
      tier: string;             // Capacity tier
    };
    platform: {
      os: string;               // OS type (linux/darwin)
      arch: string;             // Architecture (x64/arm64)
      isContainer: boolean;     // Running in container
    };
    capacity?: string;          // Overall capacity rating
    score?: number;             // Overall capacity score (0-100)
  };

  // ============== Network ==============
  network?: {
    tailscaleIP?: string;       // Tailscale IP address
    tailscaleHostname?: string; // Tailscale hostname
    publicIP?: string;          // Public IP address
    uptime?: number;            // System uptime in seconds
  };

  // ============== Worktrees ==============
  worktrees: Record<string, WorktreeState>;

  // ============== Ralph Loops ==============
  ralphLoops: Record<string, RalphLoopState>;

  // ============== Self-Improvement ==============
  selfImprovement: {
    skills: Record<string, SkillState>;
    lastCheck?: string;         // Last time skills were checked
    lastUpdate?: string;        // Last time skills were updated
  };

  // ============== Token Economics ==============
  tokenUsage?: {
    totalInput: number;
    totalOutput: number;
    bySession: Record<string, { input: number; output: number }>;
    byLoop: Record<string, { input: number; output: number }>;
  };

  // ============== Work Memory ==============
  workMemory?: {
    completedFiles: string[];   // Files that have been processed
    fileChecksums: Record<string, string>;  // path → SHA256
  };

  // ============== History & Patterns ==============
  history: {
    actions: Action[];          // Recent actions (max 1000)
    totalActions: number;       // Total actions performed
    patterns: Record<string, number>;       // Pattern → count
    failures: Record<string, number>;       // Failure pattern → count
  };

  // ============== Health & Diagnostics ==============
  health: {
    lastCheck: string;
    checks: Record<string, HealthCheckStatus>;
    issues: string[];           // Current issues
  };
}

export interface WorktreeState {
  id: string;                   // Unique worktree ID
  branch: string;               // Git branch name
  path: string;                 // Filesystem path
  repositoryUrl?: string;       // Git repository URL
  createdAt: string;            // ISO timestamp
  lastActive?: string;          // ISO timestamp of last activity
  status: WorktreeStatus;

  // Ralph loop running in this worktree
  ralphLoopId?: string;         // Reference to ralphLoop

  // Git state
  git?: {
    remote: string | null;
    branch: string | null;
    commit?: string;
    dirty?: boolean;
  };

  // Work memory for this worktree
  workMemory?: {
    filesChanged: string[];
    completedFiles: string[];
  };
}

export type WorktreeStatus = "ready" | "active" | "error" | "cleaned_up";

export interface RalphLoopState {
  id: string;                   // Unique loop ID
  worktreeId: string;           // Worktree containing this loop
  prompt: string;               // Task prompt
  promise?: string;             // Promise/commitment for this loop
  iteration: number;            // Current iteration
  startTime: string;            // ISO timestamp
  lastUpdate: string;           // ISO timestamp
  phase?: RalphPhase;
  status: RalphStatus;

  // SLAM subtasks
  subtasks?: RalphSubtask[];

  // File tracking
  filesChanged?: string[];

  // Token usage for this loop
  tokens?: {
    totalInput: number;
    totalOutput: number;
  };

  // State file path
  stateFilePath?: string;       // Path to .claude/.ralph-iterative.*.json
}

export type RalphPhase = "planning" | "executing" | "review" | "complete";
export type RalphStatus = "starting" | "running" | "complete" | "error" | "stopped" | "orphaned";

export interface RalphSubtask {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed";
  priority?: "high" | "medium" | "low";
}

export interface SkillState {
  id: string;                   // Skill ID
  status: SkillStatus;
  lastTest?: string;            // ISO timestamp of last test
  attempts?: number;            // Number of test attempts
  lastError?: string;           // Last error message if failed
}

export type SkillStatus = "pending" | "testing" | "passed" | "failed";

export interface Action {
  timestamp: string;            // ISO timestamp
  type: ActionType;             // Action type
  target: string;               // What was acted upon
  result: ActionResult;         // Result of action
  duration?: number;            // Duration in ms
  metadata?: Record<string, unknown>;  // Additional context
}

export type ActionType =
  | "worktree_created"
  | "worktree_deleted"
  | "worktree_cleaned_up"
  | "ralph_loop_started"
  | "ralph_loop_stopped"
  | "ralph_loop_completed"
  | "ralph_loop_failed"
  | "skill_tested"
  | "skill_passed"
  | "skill_failed"
  | "file_processed"
  | "error_occurred"
  | "recovery_attempted"
  | "state_loaded"
  | "state_saved";

export type ActionResult = "success" | "failure" | "partial";

export type HealthCheckStatus = "ok" | "warning" | "error" | "unknown";

export interface HealthCheck {
  name: string;                 // Check name
  status: HealthCheckStatus;
  message?: string;             // Status message
  timestamp?: string;           // Last check time
  metadata?: Record<string, unknown>;
}
