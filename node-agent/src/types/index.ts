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
  project_path?: string; // Relative path like ~/seed or ~/seed/worktrees/feature-x
  git_info?: {
    remote: string | null; // e.g., "origin" or "ebowwa/seed"
    branch: string | null; // e.g., "Bun-port" or "main"
  };
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
  // Ralph Iterative options
  enable_subagents?: boolean;
  auto_commit?: boolean;
  auto_pr?: boolean;
  base_branch?: string;
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
  connection_info?: ConnectionInfo;
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
// Connection Info Types
//
// These types describe the internet connection quality metrics returned by
// getConnectionInfo(). Used in /api/status endpoint to monitor node connectivity.
//
// Status Determination:
//   - "online":    Can reach internet, acceptable quality
//   - "offline":   Cannot reach internet at all
//   - "degraded":  Online but poor quality (>500ms latency or >5% packet loss)
// ============================================================================

export interface ConnectionInfo {
  /** Overall connection status: online, offline, or degraded */
  status: "online" | "offline" | "degraded";
  /** Information about the internet connection source (ISP, location, etc.) */
  source: ConnectionSource;
  /** Quality metrics: latency, jitter, packet loss, optional speed test */
  quality: ConnectionQuality;
  /** ISO timestamp of when these metrics were gathered */
  tested_at: string;
}

export interface ConnectionSource {
  /** Public IPv4 address (from ipify.org) */
  public_ip: string;
  /** Internet Service Provider name (from ip-api.com) */
  isp?: string;
  /** Organization name (often same as ISP, sometimes more specific) */
  org?: string;
  /** Two-letter country code (e.g., "US", "DE", "NL") */
  country?: string;
  /** City name (when available from IP geolocation) */
  city?: string;
  /** True if connection appears to be via VPN/VPS (detected via AS patterns) */
  is_vpn: boolean;
  /** True if connection is via Tor network (not currently implemented) */
  is_tor: boolean;
  /** True if IP is flagged as a proxy (from ip-api.com) */
  is_proxy: boolean;
}

export interface ConnectionQuality {
  /** Latency measurements to various endpoints (lower is better) */
  latency_ms: {
    /** Ping time to 1.1.1.1 (Cloudflare DNS) */
    google: number | null;
    /** Ping time to 8.8.8.8 (Google DNS) */
    cloudflare: number | null;
    /** Ping time to hetzner.com (VPS provider) */
    hetzner: number | null;
    /** Average latency across all successful pings */
    average: number | null;
  };
  /**
   * Jitter (latency variance) in milliseconds
   * Lower = more stable connection
   *   < 10ms: Excellent
   *   10-30ms: Good
   *   > 30ms: Poor (noticeable lag in real-time apps)
   */
  jitter_ms: number | null;
  /**
   * Packet loss percentage (0-100)
   *   0%: Excellent
   *   1-2%: Acceptable (normal for WiFi/cellular)
   *   >5%: Problematic (buffering, disconnects)
   */
  packet_loss_percent: number | null;
  /**
   * Download speed in Mbps (optional, requires INCLUDE_SPEED_TEST=true)
   * Not populated by default due to ~10s test duration
   */
  download_mbps?: number | null;
  /**
   * Upload speed in Mbps (optional, not yet implemented)
   * Would require upload test to speedtest server
   */
  upload_mbps?: number | null;
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

// ============================================================================
// PM Daemon Types
// ============================================================================

// Telegram Bot API Types
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: TelegramMessageEntity[];
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  first_name?: string;
  last_name?: string;
  username?: string;
  title?: string;
}

export interface TelegramMessageEntity {
  type: "mention" | "hashtag" | "bot_command" | "url" | "email" | "bold" | "italic";
  offset: number;
  length: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramSendMessageParams {
  chat_id: number;
  text: string;
  parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
  disable_web_page_preview?: boolean;
  reply_to_message_id?: number;
}

// ============================================================================
// Node Registry Types (DEFERRED - See docs/NODE-REGISTRY-DESIGN.md)
// ============================================================================

// Multi-node types deferred until proper multi-node architecture is implemented.
// Current setup: Each node runs its own PM daemon managing local Ralph loops only.
// See docs/NODE-REGISTRY-DESIGN.md for complete multi-node design.

/*
export interface NodeRegistryConfig {
  nodes: NodeConfig[];
}

export interface NodeConfig {
  id: string;
  host: string; // Tailscale IP or hostname
  port: number;
  label: string;
  location?: string; // e.g., "nbg1", "fsn1", "hel1"
  server_type?: string; // e.g., "cax21", "cpx21"
}

export interface RegisteredNode extends NodeConfig {
  status: "online" | "offline" | "degraded";
  last_seen?: string;
  node_status?: NodeStatus; // Cached node status
}
*/

// PM Daemon State Types
export interface PmDaemonState {
  enabled: boolean;
  started_at: string;
  telegram_connected: boolean;
  monitor_running: boolean;
  nodes_online: number;
  nodes_total: number;
  active_loops: number;
}

export interface PmDaemonConfig {
  telegram_bot_token: string;
  telegram_chat_id: number;
  monitor_interval_ms: number;
  stall_threshold_minutes: number;
  enable_proactive_actions: boolean;
  nodes_config_path: string;
}

// Monitor Event Types
export type MonitorEventType =
  | "ralph_started"
  | "ralph_completed"
  | "ralph_errored"
  | "ralph_stalled"
  | "ralph_milestone"
  | "node_online"
  | "node_offline"
  | "node_degraded"
  | "node_high_resources"
  | "pm_started";

export interface MonitorEvent {
  type: MonitorEventType;
  timestamp: string;
  node_id: string;
  data: Record<string, unknown>;
  priority: "low" | "medium" | "high" | "critical";
}

export interface RalphStallEvent extends MonitorEvent {
  type: "ralph_stalled";
  data: {
    loop_id: string;
    worktree_id: string;
    iteration: number;
    last_activity: string;
    stall_duration_minutes: number;
  };
}

export interface RalphCompletionEvent extends MonitorEvent {
  type: "ralph_completed";
  data: {
    loop_id: string;
    worktree_id: string;
    total_iterations: number;
    total_commits: number;
    duration_seconds: number;
  };
}

export interface RalphErrorEvent extends MonitorEvent {
  type: "ralph_errored";
  data: {
    loop_id: string;
    worktree_id: string;
    iteration: number;
    error_message: string;
  };
}

// Command Types
export interface PmCommand {
  command: string;
  args: string[];
  raw_text: string;
  chat_id: number;
  message_id: number;
  user_id: number;
}

export interface PmCommandResponse {
  text: string;
  parse_mode?: "Markdown" | "HTML";
  reply_to_message_id?: number;
}

export interface PmCommandHandler {
  command: string;
  description: string;
  handler: (cmd: PmCommand) => Promise<PmCommandResponse>;
}

// PM Brain Types
export interface PmBrainMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface PmBrainResponse {
  text: string;
  actions?: PmBrainAction[];
  context?: Record<string, unknown>;
}

export type PmBrainAction =
  | { type: "start_ralph"; node_id: string; worktree_id: string; prompt: string }
  | { type: "stop_ralph"; loop_id: string; node_id: string }
  | { type: "create_worktree"; node_id: string; branch: string }
  | { type: "delete_worktree"; node_id: string; worktree_id: string }
  | { type: "send_notification"; text: string; priority: "low" | "medium" | "high" };

export interface PmBrainSession {
  session_id: string;
  started_at: string;
  messages: PmBrainMessage[];
  last_activity: string;
}
