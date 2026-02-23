// Node Agent - Main HTTP Server

import { RalphService } from "./services/ralph";
import { GitService } from "./services/git";
import { ConsoleLoggerService } from "./services/console-logger";
import {
  initializeStateService,
  getState,
  saveState,
  syncRalphLoops,
  runHealthChecks,
  getHealthStatus,
  getStateManager as getSMInstance,
} from "./services/state-service";
import type {
  NodeStatus,
  CreateWorktreeRequest,
  CreateRalphLoopRequest,
  Worktree,
  RalphLoop,
  ApiError,
  PortInfo,
  PmCommand,
  MonitorEvent,
} from "./types/index";

// PM Daemon imports (conditionally loaded)
import { TelegramService } from "./services/daemon/telegram";
import { PmCommandsService } from "./services/daemon/pm-commands";
import { PmMonitorService } from "./services/daemon/pm-monitor";
import { DaemonLayerAgentService } from "./services/daemon/daemon-layer-agent";
import { ChannelRouter, type RoutedMessage } from "./services/channels";

// Configuration
const PORT = parseInt(process.env.NODE_AGENT_PORT || "8911", 10);
const HOST = process.env.NODE_AGENT_HOST || "0.0.0.0";
const CONSOLE_LOGGING_ENABLED = process.env.CONSOLE_LOGGING_ENABLED !== "false"; // Enabled by default

// Services
const gitService = new GitService();
const ralphService = new RalphService();
const consoleLogger = new ConsoleLoggerService();

// ============================================================================
// State Service Initialization
// ============================================================================

async function initializeStateSystem(): Promise<void> {
  try {
    console.log("[Seed State Service] Initializing...");
    await initializeStateService();
    console.log("[Seed State Service] ✓ Initialized");

    const healthStatus = getHealthStatus();
    console.log(`[Seed State Service] Health status: ${healthStatus.status}`);

    if (healthStatus.issues.length > 0) {
      console.log("[Seed State Service] Issues:", healthStatus.issues);
    }

  } catch (error) {
    console.error("[Seed State Service] Initialization failed:", error);
    // Continue anyway - state is optional
  }
}

// Initialize state service on startup
initializeStateSystem().catch(err => {
  console.error("[Seed State Service] Fatal initialization error:", err);
});

// ============================================================================
// Utility Functions
// ============================================================================

function jsonResponse<T>(data: T, options: { status?: number; headers?: HeadersInit } = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status: options.status || 200,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

function errorResponse(code: string, message: string, details?: Record<string, unknown>): Response {
  const error: ApiError = {
    error: {
      code,
      message,
      details,
    },
  };
  return jsonResponse(error, { status: 400 });
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// ============================================================================
// Routes
// ============================================================================

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  // Add CORS headers
  const headers = corsHeaders();

  // Handle OPTIONS preflight
  if (method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    // ========================================================================
    // GET /api/state - Get complete Seed state
    // ========================================================================
    if (url.pathname === "/api/state" && method === "GET") {
      const sm = getSMInstance();
      const state = getState();
      if (!state) {
        return errorResponse("STATE_NOT_INITIALIZED", "State service not initialized");
      }

      // Refresh machine context, network info, and health checks
      await sm.updateMachineContext();
      await sm.updateNetworkInfo();
      await sm.runHealthChecks();

      // Sync Ralph loops from disk
      await sm.syncRalphLoopsFromDisk();

      // Save updated state
      await sm.saveState();

      return jsonResponse({ state }, { headers });
    }

    // ========================================================================
    // POST /api/state/sync - Sync Ralph loops from disk
    // ========================================================================
    if (url.pathname === "/api/state/sync" && method === "POST") {
      await syncRalphLoops();
      await saveState();

      const state = getState();
      return jsonResponse({
        success: true,
        ralph_loops_count: Object.keys(state?.ralphLoops || {}).length,
      }, { headers });
    }

    // ========================================================================
    // POST /api/state/health - Run health checks
    // ========================================================================
    if (url.pathname === "/api/state/health" && method === "POST") {
      await runHealthChecks();
      await saveState();

      const state = getState();
      const healthStatus = getHealthStatus();

      return jsonResponse({
        status: healthStatus.status,
        issues: healthStatus.issues,
        checks: state?.health?.checks,
      }, { headers });
    }

    // ========================================================================
    // GET /api/state/history - Get action history
    // ========================================================================
    if (url.pathname === "/api/state/history" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "100", 10);
      const state = getState();

      if (!state) {
        return errorResponse("STATE_NOT_INITIALIZED", "State service not initialized");
      }

      const actions = state.history.actions.slice(-limit);

      return jsonResponse({
        actions,
        total_count: state.history.actions.length,
        total_actions: state.history.totalActions,
      }, { headers });
    }

    // ========================================================================
    // GET /api/state/tokens - Get token usage statistics
    // ========================================================================
    if (url.pathname === "/api/state/tokens" && method === "GET") {
      const state = getState();

      if (!state) {
        return errorResponse("STATE_NOT_INITIALIZED", "State service not initialized");
      }

      return jsonResponse({
        total_input: state.tokenUsage?.totalInput || 0,
        total_output: state.tokenUsage?.totalOutput || 0,
        by_session: state.tokenUsage?.bySession || {},
        by_loop: state.tokenUsage?.byLoop || {},
      }, { headers });
    }

    // ========================================================================
    // GET /api/state/work-memory - Get work memory
    // ========================================================================
    if (url.pathname === "/api/state/work-memory" && method === "GET") {
      const state = getState();

      if (!state) {
        return errorResponse("STATE_NOT_INITIALIZED", "State service not initialized");
      }

      return jsonResponse({
        completed_files: state.workMemory?.completedFiles || [],
        file_count: state.workMemory?.completedFiles.length || 0,
        checksums_count: Object.keys(state.workMemory?.fileChecksums || {}).length,
      }, { headers });
    }

    // ========================================================================
    // POST /api/state/save - Manually save state
    // ========================================================================
    if (url.pathname === "/api/state/save" && method === "POST") {
      await saveState();

      return jsonResponse({
        success: true,
        last_updated: getState()?.lastUpdated,
      }, { headers });
    }

    // ========================================================================
    // GET /api/status
    // ========================================================================
    if (url.pathname === "/api/status" && method === "GET") {
      const worktrees = await gitService.listBranches();
      const ralphLoops = await ralphService.listRalphLoops();

      // Update console logger with latest Ralph loops
      consoleLogger.updateRalphLoops(ralphLoops);

      const hostname = await getHostname();
      const capacity = await getCapacity();
      const { processes: claudeProcesses, totalCpuPercent: claudeCpuTotal } = await getActiveClaudeProcesses();

      const status: NodeStatus = {
        node_id: hostname,
        hostname,
        tailscale_ip: getTailscaleIP(),
        capacity: {
          ...capacity,
          claude_cpu_total: Math.round(claudeCpuTotal * 10) / 10,
          claude_process_count: claudeProcesses.length,
        },
        sessions: await getSessions(),
        ports: await getActivePorts(),
        worktrees,
        ralph_loops: ralphLoops,
        console_logs: consoleLogger.getRecentLogs(20),
        active_claude_processes: claudeProcesses,
      };

      return jsonResponse(status, { headers });
    }

    // ========================================================================
    // GET /api/worktrees (now returns branches for backward compatibility)
    // ========================================================================
    if (url.pathname === "/api/worktrees" && method === "GET") {
      const branches = await gitService.listBranches();
      return jsonResponse({ worktrees: branches }, { headers });
    }

    // ========================================================================
    // POST /api/worktrees (now creates a branch for backward compatibility)
    // ========================================================================
    if (url.pathname === "/api/worktrees" && method === "POST") {
      const body = (await req.json()) as CreateWorktreeRequest;

      if (!body.id || !body.branch) {
        return errorResponse("INVALID_REQUEST", "Missing required fields: id, branch");
      }

      const branch = await gitService.createBranch(body);
      return jsonResponse({ worktree: branch }, { headers });
    }

    // ========================================================================
    // DELETE /api/worktrees/:id (now deletes a branch for backward compatibility)
    // ========================================================================
    if (url.pathname.startsWith("/api/worktrees/") && method === "DELETE") {
      const worktreeId = url.pathname.split("/").pop();
      if (!worktreeId) {
        return errorResponse("INVALID_REQUEST", "Missing worktree ID");
      }

      await ralphService.stopRalphLoop(worktreeId, true).catch(() => {
        // Ignore if no loop was running
      });

      await gitService.deleteBranch(worktreeId);

      return jsonResponse({ success: true }, { headers });
    }

    // ========================================================================
    // POST /api/worktrees/:id/pr - Create a Pull Request to dev
    // ========================================================================
    if (url.pathname.startsWith("/api/worktrees/") && url.pathname.endsWith("/pr") && method === "POST") {
      const worktreeId = url.pathname.split("/")[3]; // /api/worktrees/{id}/pr
      if (!worktreeId) {
        return errorResponse("INVALID_REQUEST", "Missing worktree ID");
      }

      const body = await req.json();
      const result = await gitService.createPrToDev({
        branchId: worktreeId,
        title: body.title,
        body: body.body,
      });

      if (!result) {
        return errorResponse("PR_EXISTS", "A PR already exists for this branch");
      }

      return jsonResponse({ pr: result }, { headers });
    }

    // ========================================================================
    // GET /api/ralph-loops
    // ========================================================================
    if (url.pathname === "/api/ralph-loops" && method === "GET") {
      const loops = await ralphService.listRalphLoops();
      return jsonResponse({ loops }, { headers });
    }

    // ========================================================================
    // POST /api/ralph-loops
    // ========================================================================
    if (url.pathname === "/api/ralph-loops" && method === "POST") {
      const body = (await req.json()) as CreateRalphLoopRequest;

      if (!body.worktree_id || !body.prompt) {
        return errorResponse("INVALID_REQUEST", "Missing required fields: worktree_id, prompt");
      }

      const loop = await ralphService.startRalphLoop(body);
      return jsonResponse({ loop }, { headers });
    }

    // ========================================================================
    // GET /api/ralph-loops/:id
    // ========================================================================
    if (url.pathname.startsWith("/api/ralph-loops/") && method === "GET") {
      const loopId = url.pathname.split("/").pop();
      if (!loopId) {
        return errorResponse("INVALID_REQUEST", "Missing loop ID");
      }

      const loop = await ralphService.getRalphLoop(loopId);
      if (!loop) {
        return errorResponse("RALPH_LOOP_NOT_FOUND", "Ralph loop not found");
      }

      return jsonResponse({ loop }, { headers });
    }

    // ========================================================================
    // DELETE /api/ralph-loops/:id
    // Query params: cleanup_branch=true to delete the branch
    // ========================================================================
    if (url.pathname.startsWith("/api/ralph-loops/") && method === "DELETE") {
      const loopId = url.pathname.split("/").pop();
      if (!loopId) {
        return errorResponse("INVALID_REQUEST", "Missing loop ID");
      }

      const cleanupBranch = url.searchParams.get("cleanup_branch") === "true";
      await ralphService.stopRalphLoop(loopId, cleanupBranch);
      return jsonResponse({ success: true }, { headers });
    }

    // ========================================================================
    // GET /api/ralph-loops/:id/logs
    // ========================================================================
    if (url.pathname.match(/\/api\/ralph-loops\/[^/]+\/logs$/) && method === "GET") {
      const loopId = url.pathname.split("/")[3];
      if (!loopId) {
        return errorResponse("INVALID_REQUEST", "Missing loop ID");
      }

      const logPath = `${process.env.HOME}/.node-agent/logs/${loopId}.log`;
      try {
        const { readFile } = await import("fs/promises");
        const logs = await readFile(logPath, "utf-8");
        return jsonResponse({ logs }, { headers });
      } catch {
        return jsonResponse({ logs: "" }, { headers });
      }
    }

    // ========================================================================
    // 404 Not Found
    // ========================================================================
    return jsonResponse(
      {
        error: {
          code: "NOT_FOUND",
          message: "Endpoint not found",
        },
      },
      { status: 404, headers }
    );
  } catch (error) {
    console.error("Request error:", error);

    // Handle known errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("WORKTREE_NOT_FOUND")) {
      return errorResponse("WORKTREE_NOT_FOUND", "Worktree not found");
    }
    // ========================================================================
    // Claude Code Bridge & Distributed Queue API
    // ========================================================================

    // GET /api/capabilities - List seed's capabilities
    if (url.pathname === "/api/capabilities" && method === "GET") {
      const capabilities = {
        localCapabilities: [
          "autonomous-loops",
          "persistent-memory",
          "ralph-execution",
          "git-hygiene",
          "system-monitoring",
          "distributed-queue"
        ],
        delegatableCapabilities: {
          github: {
            description: "GitHub operations (repos, PRs, issues)",
            requires: "Claude Code with GitHub MCP"
          },
          hetzner: {
            description: "Hetzner cloud provisioning",
            requires: "Claude Code with Hetzner MCP"
          },
          tailscale: {
            description: "Tailscale network management",
            requires: "Claude Code with Tailscale MCP"
          },
          nmap: {
            description: "Network scanning",
            requires: "Claude Code with Nmap MCP"
          },
          npm: {
            description: "npm package management",
            requires: "Claude Code with npm MCP"
          },
          telegram: {
            description: "Telegram notifications",
            requires: "Claude Code with Telegram MCP"
          }
        }
      };
      return jsonResponse(capabilities, { headers });
    }

    // GET /api/queue - Get distributed queue status
    if (url.pathname === "/api/queue" && method === "GET") {
      const fs = await import("fs");
      const path = await import("path");
      const queueFile = path.join(process.cwd(), "../../state/distributed-queue.json");

      try {
        if (fs.existsSync(queueFile)) {
          const data = fs.readFileSync(queueFile, "utf-8");
          const queue = JSON.parse(data);
          return jsonResponse(queue, { headers });
        }

        return jsonResponse(
          {
            pending: [],
            inProgress: [],
            completed: [],
            failed: [],
            stats: { totalTasks: 0, completedTasks: 0, failedTasks: 0 }
          },
          { headers }
        );
      } catch (error) {
        return errorResponse("QUEUE_READ_ERROR", "Failed to read queue");
      }
    }

    // POST /api/queue - Add a task to the queue
    if (url.pathname === "/api/queue" && method === "POST") {
      const fs = await import("fs");
      const path = await import("path");
      const queueFile = path.join(process.cwd(), "../../state/distributed-queue.json");
      const stateDir = path.dirname(queueFile);

      try {
        const body = (await req.json()) as Record<string, unknown>;

        // Ensure state directory exists
        if (!fs.existsSync(stateDir)) {
          fs.mkdirSync(stateDir, { recursive: true });
        }

        // Load existing queue
        let queue = { pending: [], inProgress: [], completed: [], failed: [], stats: {} };
        if (fs.existsSync(queueFile)) {
          const data = fs.readFileSync(queueFile, "utf-8");
          queue = JSON.parse(data);
        }

        // Create new task
        const newTask = {
          id: Date.now(),
          task: body.task || body,
          priority: (body.priority as string) || "normal",
          requiredCapability: (body.requiredCapability as string) || null,
          assignedTo: null,
          status: "pending",
          createdAt: new Date().toISOString()
        };

        // Insert based on priority
        if (newTask.priority === "critical") {
          queue.pending.unshift(newTask);
        } else {
          queue.pending.push(newTask);
        }

        // Update stats
        queue.stats = {
          totalTasks: queue.pending.length + queue.inProgress.length + queue.completed.length + queue.failed.length,
          completedTasks: queue.completed.length,
          failedTasks: queue.failed.length
        };

        // Save queue
        fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));

        return jsonResponse({ success: true, taskId: newTask.id, task: newTask }, { headers });
      } catch (error) {
        return errorResponse("QUEUE_WRITE_ERROR", "Failed to add task to queue");
      }
    }

    // GET /api/queue/next - Claim next pending task
    if (url.pathname === "/api/queue/next" && method === "GET") {
      const fs = await import("fs");
      const path = await import("path");
      const queueFile = path.join(process.cwd(), "../../state/distributed-queue.json");
      const nodeId = url.searchParams.get("nodeId") || "unknown";

      try {
        if (!fs.existsSync(queueFile)) {
          return errorResponse("QUEUE_NOT_FOUND", "No queue found");
        }

        const data = fs.readFileSync(queueFile, "utf-8");
        const queue = JSON.parse(data);

        if (queue.pending.length === 0) {
          return jsonResponse({ success: false, message: "No pending tasks" }, { headers });
        }

        // Get first task
        const [task] = queue.pending.splice(0, 1);
        task.assignedTo = nodeId;
        task.status = "in-progress";
        task.claimedAt = new Date().toISOString();
        queue.inProgress.push(task);

        // Update stats
        queue.stats = {
          totalTasks: queue.pending.length + queue.inProgress.length + queue.completed.length + queue.failed.length,
          completedTasks: queue.completed.length,
          failedTasks: queue.failed.length
        };

        fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));

        return jsonResponse({ success: true, task }, { headers });
      } catch (error) {
        return errorResponse("QUEUE_ERROR", "Failed to claim task");
      }
    }

    // POST /api/queue/:taskId/complete - Complete a task
    if (url.pathname.startsWith("/api/queue/") && url.pathname.endsWith("/complete") && method === "POST") {
      const fs = await import("fs");
      const path = await import("path");
      const queueFile = path.join(process.cwd(), "../../state/distributed-queue.json");
      const taskId = parseInt(url.pathname.split("/")[3]);

      try {
        if (!fs.existsSync(queueFile)) {
          return errorResponse("QUEUE_NOT_FOUND", "No queue found");
        }

        const data = fs.readFileSync(queueFile, "utf-8");
        const queue = JSON.parse(data);

        const taskIndex = queue.inProgress.findIndex((t: { id: number }) => t.id === taskId);
        if (taskIndex === -1) {
          return errorResponse("TASK_NOT_FOUND", "Task not found in progress");
        }

        const body = (await req.json()) as { result?: unknown };
        const [task] = queue.inProgress.splice(taskIndex, 1);
        task.status = "completed";
        task.result = body.result || null;
        task.completedAt = new Date().toISOString();
        task.duration = new Date(task.completedAt).getTime() - new Date(task.claimedAt).getTime();
        queue.completed.push(task);

        // Update stats
        queue.stats = {
          totalTasks: queue.pending.length + queue.inProgress.length + queue.completed.length + queue.failed.length,
          completedTasks: queue.completed.length,
          failedTasks: queue.failed.length
        };

        fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));

        return jsonResponse({ success: true, task, stats: queue.stats }, { headers });
      } catch (error) {
        return errorResponse("QUEUE_ERROR", "Failed to complete task");
      }
    }

    // POST /api/seed/register - Register a Claude Code instance
    if (url.pathname === "/api/seed/register" && method === "POST") {
      const fs = await import("fs");
      const path = await import("path");
      const bridgeFile = path.join(process.cwd(), "../../state/claude-code-bridge.json");
      const stateDir = path.dirname(bridgeFile);

      try {
        // Ensure state directory exists
        if (!fs.existsSync(stateDir)) {
          fs.mkdirSync(stateDir, { recursive: true });
        }

        const body = (await req.json()) as Record<string, unknown>;

        // Load existing bridge state
        let bridge = { registeredNodes: [], sentMessages: [], receivedMessages: [] };
        if (fs.existsSync(bridgeFile)) {
          const data = fs.readFileSync(bridgeFile, "utf-8");
          bridge = JSON.parse(data);
        }

        // Register node
        const existingNode = bridge.registeredNodes.find(
          (n: { nodeId?: string }) => n.nodeId === body.nodeId
        );
        if (existingNode) {
          existingNode.lastSeen = new Date().toISOString();
        } else {
          bridge.registeredNodes.push({
            ...body,
            registeredAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
          });
        }

        fs.writeFileSync(bridgeFile, JSON.stringify(bridge, null, 2));

        return jsonResponse({ success: true, message: "Registered successfully" }, { headers });
      } catch (error) {
        return errorResponse("REGISTER_ERROR", "Failed to register node");
      }
    }

    // POST /api/seed/message - Receive a message from Claude Code
    if (url.pathname === "/api/seed/message" && method === "POST") {
      const fs = await import("fs");
      const path = await import("path");
      const bridgeFile = path.join(process.cwd(), "../../state/claude-code-bridge.json");
      const stateDir = path.dirname(bridgeFile);

      try {
        // Ensure state directory exists
        if (!fs.existsSync(stateDir)) {
          fs.mkdirSync(stateDir, { recursive: true });
        }

        const body = (await req.json()) as Record<string, unknown>;

        // Load existing bridge state
        let bridge = { registeredNodes: [], sentMessages: [], receivedMessages: [] };
        if (fs.existsSync(bridgeFile)) {
          const data = fs.readFileSync(bridgeFile, "utf-8");
          bridge = JSON.parse(data);
        }

        // Store message
        bridge.receivedMessages.push({
          ...body,
          receivedAt: new Date().toISOString()
        });

        fs.writeFileSync(bridgeFile, JSON.stringify(bridge, null, 2));

        return jsonResponse({ success: true, message: "Message received" }, { headers });
      } catch (error) {
        return errorResponse("MESSAGE_ERROR", "Failed to store message");
      }
    }

    // POST /api/seed/delegate - Delegate a task to Claude Code (for MCP tools)
    if (url.pathname === "/api/seed/delegate" && method === "POST") {
      const body = (await req.json()) as Record<string, unknown>;
      return jsonResponse(
        {
          success: true,
          message: "Task delegation received",
          taskId: body.id,
          task: body.task
        },
        { headers }
      );
    }

    // ========================================================================
    // Error Handling
    // ========================================================================
    if (errorMessage.includes("WORKTREE_ALREADY_EXISTS")) {
      return errorResponse("WORKTREE_ALREADY_EXISTS", "Worktree already exists");
    }
    if (errorMessage.includes("RALPH_LOOP_ALREADY_RUNNING")) {
      return errorResponse("RALPH_LOOP_ALREADY_RUNNING", "Ralph loop already running in this worktree");
    }
    if (errorMessage.includes("RALPH_LOOP_NOT_FOUND")) {
      return errorResponse("RALPH_LOOP_NOT_FOUND", "Ralph loop not found");
    }
    if (errorMessage.includes("PROCESS_START_FAILED")) {
      return errorResponse("PROCESS_START_FAILED", "Failed to start Claude Code process");
    }
    if (errorMessage.includes("GIT_OPERATION_FAILED")) {
      return errorResponse("GIT_OPERATION_FAILED", "Git operation failed");
    }

    return errorResponse("INTERNAL_ERROR", "An internal error occurred", {
      error: errorMessage,
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

async function getHostname(): Promise<string> {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    const { stdout } = await execAsync("hostname");
    return stdout.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

async function getCapacity() {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    // Get CPU usage (Linux)
    const { stdout: cpuTop } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'");
    const cpuUsage = parseFloat(cpuTop) || 0;

    // Get memory usage
    const { stdout: memInfo } = await execAsync("free | grep Mem | awk '{print ($3/$2) * 100}'");
    const memUsage = parseFloat(memInfo) || 0;

    // Get disk usage
    const { stdout: diskInfo } = await execAsync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'");
    const diskUsage = parseInt(diskInfo) || 0;

    // Get process count
    const { stdout: procCount } = await execAsync("ps -e | wc -l");
    const processes = parseInt(procCount.trim()) || 0;

    // Get load average (works on both Linux and macOS)
    let loadAverage: number[] = [0, 0, 0];
    try {
      const { stdout: loadAvg } = await execAsync("uptime | awk -F'load averages?:' '{print $2}'");
      const loadStr = loadAvg.trim();
      // Parse load averages like "0.50, 0.80, 0.70" or "0.50 0.80 0.70"
      const loads = loadStr.replace(/,/g, ' ').split(/\s+/).filter((v: string) => v.length > 0);
      loadAverage = loads.slice(0, 3).map((v: string) => parseFloat(v) || 0);
      // Fill missing values if fewer than 3
      while (loadAverage.length < 3) {
        loadAverage.push(loadAverage[loadAverage.length - 1] || 0);
      }
    } catch {
      loadAverage = [0, 0, 0];
    }

    return {
      cpu_percent: Math.round(cpuUsage),
      memory_percent: Math.round(memUsage),
      disk_percent: diskUsage,
      processes,
      load_average: loadAverage,
    };
  } catch {
    return {
      cpu_percent: 0,
      memory_percent: 0,
      disk_percent: 0,
      processes: 0,
      load_average: [0, 0, 0],
    };
  }
}

function getTailscaleIP(): string {
  try {
    const { execSync } = require("child_process");
    const ip = execSync("tailscale status --json | jq -r '.Self.TailscaleIPs[0]'", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return ip || "unknown";
  } catch {
    return "unknown";
  }
}

async function getActiveClaudeProcesses(): Promise<{
  processes: Array<{
    pid: number;
    worktreeId?: string;
    loopId?: string;
    startTime: Date;
    command: string;
    cpuPercent: number;
    memoryPercent: number;
  }>;
  totalCpuPercent: number;
}> {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    // Get all Claude/doppler processes with CPU and memory using ps
    // ps output format: PID, %CPU, %MEM, COMMAND
    const { stdout: psOutput } = await execAsync(
      'ps aux | grep -E "[c]laude|[d]oppler.*claude" | awk \'{print $2, $3, $4, $11, $12, $13, $14, $15}\''
    );

    const lines = psOutput.trim().split('\n').filter(l => l.trim());
    const processes: Array<{
      pid: number;
      worktreeId?: string;
      loopId?: string;
      startTime: Date;
      command: string;
      cpuPercent: number;
      memoryPercent: number;
    }> = [];
    let totalCpuPercent = 0;

    // Get PID files to map PIDs to loop IDs
    const pidDir = '/root/.node-agent/pids';
    let pidToLoopId: Record<number, string> = {};
    try {
      const { readdirSync, readFileSync } = await import('fs');
      const files = readdirSync(pidDir).filter((f: string) => f.endsWith('.pid'));
      for (const file of files) {
        const loopId = file.replace('.pid', '');
        try {
          const pid = parseInt(readFileSync(`${pidDir}/${file}`, 'utf-8').trim());
          if (!isNaN(pid)) {
            pidToLoopId[pid] = loopId;
          }
        } catch {
          // Ignore individual file read errors
        }
      }
    } catch {
      // No PID files directory or inaccessible
    }

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;

      const [pidStr, cpuStr, memStr, ...cmdParts] = parts;
      const pid = parseInt(pidStr);
      const cpuPercent = parseFloat(cpuStr) || 0;
      const memoryPercent = parseFloat(memStr) || 0;
      const command = cmdParts.join(' ').substring(0, 200); // Limit command length

      if (!isNaN(pid)) {
        processes.push({
          pid,
          loopId: pidToLoopId[pid],
          startTime: new Date(), // We could fetch actual start time from ps if needed
          command,
          cpuPercent,
          memoryPercent,
        });
        totalCpuPercent += cpuPercent;
      }
    }

    return { processes, totalCpuPercent };
  } catch {
    return { processes: [], totalCpuPercent: 0 };
  }
}

async function getSessions() {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    // Count SSH sessions (logged in users)
    let ssh = 0;
    try {
      const { stdout: sshOutput } = await execAsync("who 2>/dev/null | wc -l");
      ssh = parseInt(sshOutput.trim()) || 0;
    } catch {
      ssh = 0;
    }

    // Count tmux sessions
    let tmux = 0;
    try {
      const { stdout: tmuxOutput } = await execAsync("tmux list-sessions 2>/dev/null | wc -l");
      tmux = parseInt(tmuxOutput.trim()) || 0;
    } catch {
      tmux = 0;
    }

    // Count Claude Code processes
    let claudeCode = 0;
    try {
      const { stdout: claudeOutput } = await execAsync("ps aux | grep -c '[c]laude' || echo 0");
      claudeCode = parseInt(claudeOutput.trim()) || 0;
    } catch {
      claudeCode = 0;
    }

    return {
      ssh,
      tmux,
      claude_code: claudeCode,
      total: ssh + tmux + claudeCode,
    };
  } catch {
    return {
      ssh: 0,
      tmux: 0,
      claude_code: 0,
      total: 0,
    };
  }
}

async function getActivePorts() {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    // Get listening TCP ports on Linux and macOS
    // Linux: ss -tlnp | grep LISTEN
    // macOS: lsof -i -P -n | grep LISTEN
    let ports: PortInfo[] = [];

    try {
      const isMac = process.platform === "darwin";
      let command = "";

      if (isMac) {
        // macOS: use lsof (format: PROCESS_NAME PID USER ... TCP ADDRESS:PORT)
        // awk extracts: PORT ($9), PROCESS_NAME ($1), PID ($2)
        command = "lsof -i -P -n 2>/dev/null | grep LISTEN | awk '{print $9, $1, $2}'";
      } else {
        // Linux: use ss (faster than netstat)
        command = "ss -tlnp 2>/dev/null | grep LISTEN | awk '{print $4, $5, $7}'";
      }

      const { stdout: portOutput } = await execAsync(command);
      const lines = portOutput.trim().split("\n").filter((l: string) => l.length > 0);

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);

        if (isMac) {
          // lsof format: PORT PROCESS PID
          // e.g., "*:8911" "bun" "12345" or "[::1]:5432" "postgres" "1324"
          // Match port after ] for IPv6, or at end for IPv4
          const portMatch = parts[0]?.match(/]:(\d+)|:(\d+)$/);
          if (portMatch) {
            const port = parseInt(portMatch[1] || portMatch[2]);
            const process = parts[1] || "unknown";
            const pidMatch = parts[2]?.match(/^(\d+)/);
            const pid = pidMatch ? parseInt(pidMatch[1]) : undefined;

            ports.push({
              port,
              protocol: "tcp",
              state: "listening",
              process,
              pid
            });
          }
        } else {
          // ss format: ADDR PROCESS INFO
          // e.g., "*:8911" "bun" "pid=12345" or "[::]:5432" "postgres" "pid=1324"
          const portMatch = parts[0]?.match(/]:(\d+)|:(\d+)$/);
          if (portMatch) {
            const port = parseInt(portMatch[1] || portMatch[2]);
            const process = parts[1] || "unknown";
            const pidMatch = parts[2]?.match(/pid=(\d+)/);
            const pid = pidMatch ? parseInt(pidMatch[1]) : undefined;

            ports.push({
              port,
              protocol: "tcp",
              state: "listening",
              process,
              pid
            });
          }
        }
      }
    } catch {
      // Fall back to netstat if ss/lsof fails
      try {
        const { stdout: netOutput } = await execAsync("netstat -an 2>/dev/null | grep LISTEN | grep -E ':(80|443|8000|8080|8443|8911|9000|3000|5000|4000|7000)'");
        const lines = netOutput.trim().split("\n").filter((l: string) => l.length > 0);

        for (const line of lines) {
          // netstat format varies, but typically: proto addr state
          const parts = line.trim().split(/\s+/);
          const addr = parts[3] || "";
          const portMatch = addr.match(/\.(\d+)\./);

          if (portMatch) {
            const port = parseInt(portMatch[1]);
            if (port > 0 && !ports.find(p => p.port === port)) {
              ports.push({
                port,
                protocol: addr.includes(".") ? "tcp" : "udp",
                state: "listening"
              });
            }
          }
        }
      } catch {
        // If all else fails, return empty array
        ports = [];
      }
    }

    // Sort by port number
    ports.sort((a, b) => a.port - b.port);

    return ports;
  } catch {
    return [];
  }
}

// ============================================================================
// Server
// ============================================================================

console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ███╗   ██╗███████╗██╗    ██╗    ██████╗ ███████╗██╗   ██╗         ║
║   ████╗  ██║██╔════╝██║    ██║    ██╔══██╗██╔════╝██║   ██║         ║
║   ██╔██╗ ██║█████╗  ██║ █╗ ██║    ██║  ██║█████╗ ██║   ██║         ║
║   ██║╚██╗██║██╔══╝  ██║███╗██║    ██║  ██║██╔══╝ ╚██╗ ██╔╝         ║
║   ██║ ╚████║███████╗╚███╔███╔╝    ██████╔╝███████╗ ╚████╔╝          ║
║   ╚═╝  ╚═══╝╚══════╝ ╚══╝╚══╝     ╚═════╝ ╚══════╝  ╚═══╝           ║
║                                                                   ║
║              Node Agent v0.1.0 - Ralph Loop Orchestration            ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`);

// Type for WebSocket data
type WebSocketData = {
  loopId: string;
};

// Track active WebSocket connections and their pipe cleanup
const wsConnections = new Map<string, { cleanup: () => void }>();

const server = Bun.serve<{
  data: WebSocketData;
}>({
  port: PORT,
  hostname: HOST,
  fetch(req, server) {
    const url = new URL(req.url);
    const method = req.method;

    // ========================================================================
    // WebSocket Upgrade: /api/ralph-loops/:id/ws
    // ========================================================================
    if (url.pathname.startsWith("/api/ralph-loops/") && url.pathname.endsWith("/ws")) {
      const parts = url.pathname.split("/");
      const loopId = parts[3]; // /api/ralph-loops/:id/ws

      if (!loopId) {
        return new Response("Missing loop ID", { status: 400 });
      }

      // Check if loop exists and has active process
      const proc = ralphService.getProcess(loopId);
      if (!proc) {
        return new Response("Loop not found or not running", { status: 404 });
      }

      // Upgrade to WebSocket
      const upgraded = server.upgrade(req, {
        data: { loopId },
      });

      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      // Return undefined to signal successful upgrade
      return undefined;
    }

    // ========================================================================
    // Regular HTTP requests
    // ========================================================================
    return handleRequest(req);
  },

  websocket: {
    data: {} as WebSocketData,

    open(ws) {
      const { loopId } = ws.data;
      console.log(`[WebSocket] Connection opened for loop: ${loopId}`);

      const proc = ralphService.getProcess(loopId);
      if (!proc) {
        ws.close(1008, "Loop process not found");
        return;
      }

      // Pipe Claude stdout → WebSocket
      const stdoutHandler = (data: Buffer) => {
        try {
          ws.send(data.toString());
        } catch (err) {
          console.error(`[WebSocket] Error sending to client:`, err);
        }
      };

      proc.stdout.on("data", stdoutHandler);

      // Store cleanup function
      wsConnections.set(ws.remoteAddress + ":" + loopId, {
        cleanup: () => {
          proc.stdout.off("data", stdoutHandler);
        },
      });

      // Send welcome message
      ws.send(`[WebSocket] Connected to Ralph loop: ${loopId}\n`);
      ws.send(`[WebSocket] Messages sent will be relayed to Claude stdin\n`);
      ws.send(`[WebSocket] ---\n`);
    },

    message(ws, message) {
      const { loopId } = ws.data;
      const proc = ralphService.getProcess(loopId);

      if (!proc || !proc.stdin) {
        ws.send("[WebSocket] Error: Loop process not available\n");
        return;
      }

      // Relay message to Claude stdin
      try {
        proc.stdin.write(message.toString() + "\n");
        console.log(`[WebSocket] Relayed to ${loopId}: ${message.toString().substring(0, 100)}`);
      } catch (err) {
        ws.send(`[WebSocket] Error writing to stdin: ${err}\n`);
      }
    },

    close(ws, code, reason) {
      const { loopId } = ws.data;
      console.log(`[WebSocket] Connection closed for loop: ${loopId} (code: ${code}, reason: ${reason})`);

      // Cleanup pipes
      const connection = wsConnections.get(ws.remoteAddress + ":" + loopId);
      if (connection) {
        connection.cleanup();
        wsConnections.delete(ws.remoteAddress + ":" + loopId);
      }
    },

    drain(ws) {
      // WebSocket is ready to receive more data
      // Could implement backpressure handling here if needed
    },

    error(ws, error) {
      console.error(`[WebSocket] Error for loop ${ws.data.loopId}:`, error);
    },
  },
});

console.log(`🚀 Node Agent listening on http://${HOST}:${PORT}`);
console.log(`📡 API Endpoints:`);
console.log(`   GET    /api/status`);
console.log(`   GET    /api/worktrees`);
console.log(`   POST   /api/worktrees`);
console.log(`   DELETE /api/worktrees/:id`);
console.log(`   POST   /api/worktrees/:id/pr  (NEW - Create PR to dev)`);
console.log(`   GET    /api/ralph-loops`);
console.log(`   POST   /api/ralph-loops`);
console.log(`   GET    /api/ralph-loops/:id`);
console.log(`   DELETE /api/ralph-loops/:id`);
console.log(`   GET    /api/ralph-loops/:id/logs`);
console.log(`   WS     /api/ralph-loops/:id/ws  (NEW - WebSocket oversight)`);
console.log();

// Start enhanced console logging if enabled
if (CONSOLE_LOGGING_ENABLED) {
  consoleLogger.startLogging();
} else {
  console.log("📊 Console logging disabled (set CONSOLE_LOGGING_ENABLED=true to enable)");
  console.log();
}

// ============================================================================
// PM Daemon Startup (Conditional)
// ============================================================================

const PM_DAEMON_ENABLED = process.env.PM_DAEMON_ENABLED === "true";

if (PM_DAEMON_ENABLED) {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ██████╗ ██████╗ ███████╗ █████╗ ███╗   ███╗███████╗            ║
║   ██╔══██╗██╔══██╗██╔════╝██╔══██╗████╗ ████║██╔════╝            ║
║   ██║  ██║██████╔╝█████╗  ███████║██╔████╔██║█████╗              ║
║   ██║  ██║██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║██╔══╝              ║
║   ██████╔╝██║  ██║███████╗██║  ██║██║ ╚═╝ ██║███████╗            ║
║   ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝            ║
║                                                                   ║
║              PM Daemon - Telegram-Connected Orchestrator          ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`);

  // Check for required environment variables
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("❌ PM_DAEMON_ENABLED is true, but TELEGRAM_BOT_TOKEN is not set");
    console.error("   Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Doppler or .env");
    process.exit(1);
  }

  if (!process.env.TELEGRAM_CHAT_ID) {
    console.error("❌ PM_DAEMON_ENABLED is true, but TELEGRAM_CHAT_ID is not set");
    console.error("   Please set TELEGRAM_CHAT_ID in Doppler or .env");
    process.exit(1);
  }

  // Initialize PM Daemon services
  startPmDaemon();
}

/**
 * Start the PM Daemon services
 */
async function startPmDaemon(): Promise<void> {
  try {
    // Get hostname for announcements
    const localHostname = await getHostname();

    // Initialize channel router with announcement config
    const router = new ChannelRouter({
      announcement: {
        serverName: localHostname,
        hostname: localHostname,
        packageName: "seed-node-agent",
        version: "0.6.1",
        dependencies: [
          { name: "@ebowwa/ai", version: "0.3.2" },
          { name: "@ebowwa/channel-core", version: "1.2.0" },
          { name: "@ebowwa/channel-telegram", version: "1.14.2" },
          { name: "@ebowwa/glm-daemon", version: "0.4.5" },
          { name: "@ebowwa/rolling-keys", version: "0.1.1" },
        ],
      },
    });

    // Initialize services
    const telegramService = new TelegramService();
    const pmCommands = new PmCommandsService();
    const daemonLayerAgent = new DaemonLayerAgentService({ telegram: telegramService });
    const pmMonitor = new PmMonitorService({
      intervalMs: parseInt(process.env.PM_MONITOR_INTERVAL_MS || "30000", 10),
      stallThresholdMinutes: parseInt(process.env.PM_STALL_THRESHOLD_MINUTES || "10", 10),
    });

    // Test Telegram connection
    console.log("[Seed] Testing Telegram connection...");
    const testResult = await telegramService.testConnection();
    if (!testResult.ok) {
      console.error(`[Seed] Failed to connect to Telegram: ${testResult.error}`);
      throw new Error(`Telegram connection failed: ${testResult.error}`);
    }
    console.log(`[Seed] ✓ Connected to Telegram bot: @${testResult.bot?.username}`);

    // Get user info for announcements
    const chatInfo = await telegramService.getChatInfo();
    let userDisplay = "Unknown";
    if (chatInfo) {
      if (chatInfo.username) {
        userDisplay = `@${chatInfo.username}`;
      } else if (chatInfo.firstName) {
        userDisplay = chatInfo.lastName
          ? `${chatInfo.firstName} ${chatInfo.lastName}`
          : chatInfo.firstName;
      } else if (chatInfo.title) {
        userDisplay = chatInfo.title;
      }
    }

    // Start Daemon Layer Agent session (persistent conversation memory)
    console.log("[Seed] Starting Seed brain session...");
    await daemonLayerAgent.start();
    console.log(`[Seed] ✓ Seed brain running`);

    // Recent events for context (circular buffer)
    const recentEvents: MonitorEvent[] = [];
    const MAX_RECENT_EVENTS = 10;

    // Register Telegram channel with router
    console.log("[Seed] Registering Telegram channel with router...");
    router.register(telegramService);
    console.log("[Seed] ✓ Telegram channel registered");

    // Set up router message handler
    router.setHandler(async (routed: RoutedMessage) => {
      const command = telegramService.parseCommand(routed.message);
      if (!command) {
        return;
      }

      console.log(`[Seed] Received command via router: /${command.command} from ${routed.channelLabel}`);

      // Handle slash commands
      if (command.command !== "chat") {
        const response = await pmCommands.executeCommand(command);
        await telegramService.sendText(response.text, {
          parse_mode: response.parse_mode,
          reply_to_message_id: response.reply_to_message_id,
        });
        return;
      }

      // Chat messages go to Seed brain
      telegramService.startTyping();

      try {
        const agentResponse = await daemonLayerAgent.processMessage(command.raw_text, {
          events: recentEvents.slice(-5),
          messageId: command.message_id,
          channelType: command.channelType,
        });

        await telegramService.sendText(agentResponse.text);
      } finally {
        telegramService.stopTyping();
      }
    });

    // Start the router (starts all registered channels)
    console.log("[Seed] Starting channel router...");
    await router.start();
    console.log("[Seed] ✓ Channel router started");

    // Announce online to all channels
    await router.announceOnline([
      { label: "Telegram", userInfo: userDisplay },
    ]);

    // Start monitor loop
    console.log("[Seed] Starting monitor loop...");
    const monitorAbortController = new AbortController();

    pmMonitor.startMonitoring({
      signal: monitorAbortController.signal,
      onEvent: async (event) => {
        recentEvents.push(event);
        if (recentEvents.length > MAX_RECENT_EVENTS) {
          recentEvents.shift();
        }

        // For high-priority events, notify immediately
        if (event.priority === "high" || event.priority === "critical") {
          let message = "";

          switch (event.type) {
            case "ralph_stalled":
              message = `⚠️ *Ralph Stalled*

\`${event.data.loop_id}\` on ${event.node_id}
Stuck at iteration ${event.data.iteration} for ${event.data.stall_duration_minutes} minutes

Last activity: ${event.data.last_activity}
`;
              break;

            case "ralph_errored":
              message = `❌ *Ralph Error*

\`${event.data.loop_id}\` on ${event.node_id}
Iteration: ${event.data.iteration}

Error: ${event.data.error_message}
`;
              break;

            case "ralph_completed":
              message = `✅ *Ralph Completed*

\`${event.data.loop_id}\` on ${event.node_id}
Iterations: ${event.data.total_iterations}
Commits: ${event.data.total_commits}
Duration: ${Math.floor(event.data.duration_seconds / 60)}m
`;
              break;

            case "node_high_resources":
              const warnings = event.data.warnings as string[];
              message = `📊 *High Resource Usage*

${event.node_id}: ${warnings.join(", ")}
`;
              break;

            default:
              return;
          }

          await telegramService.sendText(message);
        }
      },
    });

    console.log("[Seed] ✓ All Seed services started");
    console.log("[Seed] 📱 Send /help to the bot for available commands");

    // Graceful shutdown
    const shutdown = async () => {
      console.log("[Seed] Shutting down...");

      // Announce offline before stopping
      await router.announceOffline("Graceful shutdown");

      monitorAbortController.abort();
      pmMonitor.stopMonitoring();

      // Stop router (stops all channels)
      await router.stop();

      // Stop Daemon Layer Agent session
      console.log("[Seed] Stopping Seed brain session...");
      await daemonLayerAgent.stop();

      // Allow time for cleanup
      await new Promise((resolve) => setTimeout(resolve, 2000));
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

  } catch (error) {
    console.error("[Seed] Failed to start:", error);
    process.exit(1);
  }
}
