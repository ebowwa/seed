// Node Agent Type Definitions

// ============================================================================
// Worktree Types
// ============================================================================

export interface Worktree {
  id: string;
  branch: string;
  commit?: string;
  path: string;
  repository_url?: string;
  created_at: string;
  status: "ready" | "error";
}

export interface CreateWorktreeRequest {
  id: string;
  branch: string;
  commit?: string;
  repository_url?: string;
}

// ============================================================================
// Ralph Loop Types
// ============================================================================

export interface RalphLoop {
  id: string;
  worktree_id: string;
  status: "starting" | "running" | "complete" | "error" | "stopped";
  prompt: string;
  iteration: number;
  max_iterations: number;
  completion_promise: string | null;
  started_at: string;
  process_id?: number;
  last_activity?: string;
  recent_commits?: RalphLoopCommit[];
  error_message?: string;
  // Ralph Iterative specific fields
  phase?: "planning" | "executing" | "review" | "complete";
  current_task?: string | null;
  total_subtasks?: number;
  completed_subtasks?: number;
  subtasks?: Array<{
    id: string;
    title: string;
    status: "pending" | "in_progress" | "completed";
  }>;
}

export interface RalphLoopCommit {
  hash: string;
  message: string;
  timestamp: string;
}

export interface CreateRalphLoopRequest {
  worktree_id: string;
  prompt: string;
  max_iterations?: number;
  completion_promise?: string;
}

// ============================================================================
// Node Status Types
// ============================================================================

export interface NodeStatus {
  node_id: string;
  hostname: string;
  tailscale_ip: string;
  capacity: Capacity;
  sessions: Sessions;
  ports: PortInfo[];
  worktrees: Worktree[];
  ralph_loops: RalphLoop[];
}

export interface Capacity {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  processes: number;
  load_average: number[];
}

export interface Sessions {
  ssh: number;
  tmux: number;
  claude_code: number;
  total: number;
}

export interface PortInfo {
  port: number;
  protocol: "tcp" | "udp";
  state: "listening" | "established";
  process?: string;
  pid?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

// ============================================================================
// Ralph Loop State File Types
// ============================================================================

export interface RalphLoopStateFile {
  active: boolean;
  iteration: number;
  max_iterations: number;
  completion_promise: string | null;
  started_at: string;
  prompt: string;
}

// Ralph Iterative JSON state file (.claude/.ralph-iterative.*.json)
export interface RalphIterativeStateFile {
  prompt: string;
  promise?: string;
  iteration: number;
  startTime: string;
  lastUpdate: string;
  tokens?: {
    totalInput: number;
    totalOutput: number;
    byIteration?: Array<{ input: number; output: number }>;
  };
  filesChanged?: string[];
  workMemory?: {
    completedFiles: string[];
    fileChecksums: Record<string, string>;
  };
  machine?: {
    cpu: { count: number; model: string; tier: string };
    memory: { total: number; free: number; tier: string };
    disk: { total: number; available: number; tier: string };
    platform: { os: string; arch: string; isContainer: boolean };
    capacity: string;
    score: number;
  };
  git?: {
    enabled: boolean;
    autoCommit: boolean;
    baseBranch?: string;
    branchName?: string;
    currentCommit?: string;
  };
  slam?: {
    enabled: boolean;
    phase?: "planning" | "executing" | "review" | "complete";
    state?: {
      currentTask?: string;
      beliefs?: Record<string, unknown>;
      goals?: string[];
    };
    subtasks?: Array<{
      id: string;
      title: string;
      description: string;
      status: "pending" | "in_progress" | "completed";
      priority: "high" | "medium" | "low";
      estimatedComplexity: "simple" | "medium" | "complex";
      dependencies: string[];
      files: string[];
    }>;
    currentSubtask?: string | null;
    completedSubtasks?: string[];
  };
  subagents?: {
    enabled: boolean;
    available: string[];
    active: string[];
  };
}

// ============================================================================
// Process Types
// ============================================================================

export interface ProcessInfo {
  pid: number;
  worktree_id: string;
  loop_id: string;
  started_at: string;
}
