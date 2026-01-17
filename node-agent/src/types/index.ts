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

// ============================================================================
// Process Types
// ============================================================================

export interface ProcessInfo {
  pid: number;
  worktree_id: string;
  loop_id: string;
  started_at: string;
}
