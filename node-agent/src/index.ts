// Node Agent - Main HTTP Server

import { RalphService } from "./services/ralph";
import { GitService } from "./services/git";
import type {
  NodeStatus,
  CreateWorktreeRequest,
  CreateRalphLoopRequest,
  Worktree,
  RalphLoop,
  ApiError,
} from "./types/index";

// Configuration
const PORT = parseInt(process.env.NODE_AGENT_PORT || "8911", 10);
const HOST = process.env.NODE_AGENT_HOST || "0.0.0.0";

// Services
const gitService = new GitService();
const ralphService = new RalphService();

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
    // GET /api/status
    // ========================================================================
    if (url.pathname === "/api/status" && method === "GET") {
      const worktrees = await gitService.listWorktrees();
      const ralphLoops = await ralphService.listRalphLoops();

      const hostname = await getHostname();

      const status: NodeStatus = {
        node_id: hostname,
        hostname,
        tailscale_ip: getTailscaleIP(),
        capacity: await getCapacity(),
        sessions: await getSessions(),
        ports: await getActivePorts(),
        worktrees,
        ralph_loops: ralphLoops,
      };

      return jsonResponse(status, { headers });
    }

    // ========================================================================
    // GET /api/worktrees
    // ========================================================================
    if (url.pathname === "/api/worktrees" && method === "GET") {
      const worktrees = await gitService.listWorktrees();
      return jsonResponse({ worktrees }, { headers });
    }

    // ========================================================================
    // POST /api/worktrees
    // ========================================================================
    if (url.pathname === "/api/worktrees" && method === "POST") {
      const body = (await req.json()) as CreateWorktreeRequest;

      if (!body.id || !body.branch) {
        return errorResponse("INVALID_REQUEST", "Missing required fields: id, branch");
      }

      const worktree = await gitService.createWorktree(body);
      return jsonResponse({ worktree }, { headers });
    }

    // ========================================================================
    // DELETE /api/worktrees/:id
    // ========================================================================
    if (url.pathname.startsWith("/api/worktrees/") && method === "DELETE") {
      const worktreeId = url.pathname.split("/").pop();
      if (!worktreeId) {
        return errorResponse("INVALID_REQUEST", "Missing worktree ID");
      }

      await ralphService.stopRalphLoop(worktreeId).catch(() => {
        // Ignore if no loop was running
      });
      await gitService.removeWorktree(worktreeId);

      return jsonResponse({ success: true }, { headers });
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
    // ========================================================================
    if (url.pathname.startsWith("/api/ralph-loops/") && method === "DELETE") {
      const loopId = url.pathname.split("/").pop();
      if (!loopId) {
        return errorResponse("INVALID_REQUEST", "Missing loop ID");
      }

      await ralphService.stopRalphLoop(loopId);
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

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch: handleRequest,
});

console.log(`🚀 Node Agent listening on http://${HOST}:${PORT}`);
console.log(`📡 API Endpoints:`);
console.log(`   GET    /api/status`);
console.log(`   GET    /api/worktrees`);
console.log(`   POST   /api/worktrees`);
console.log(`   DELETE /api/worktrees/:id`);
console.log(`   GET    /api/ralph-loops`);
console.log(`   POST   /api/ralph-loops`);
console.log(`   GET    /api/ralph-loops/:id`);
console.log(`   DELETE /api/ralph-loops/:id`);
console.log(`   GET    /api/ralph-loops/:id/logs`);
console.log();
