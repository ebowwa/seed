// Node Agent - Main HTTP Server

import { RalphService } from "./services/ralph.js";
import { GitService } from "./services/git.js";
import type {
  NodeStatus,
  CreateWorktreeRequest,
  CreateRalphLoopRequest,
  Worktree,
  RalphLoop,
  ApiError,
} from "./types/index.js";

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

      const status: NodeStatus = {
        node_id: process.env.HOSTNAME || "unknown",
        hostname: process.env.HOSTNAME || "unknown",
        tailscale_ip: getTailscaleIP(),
        capacity: await getCapacity(),
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

    return {
      cpu_percent: Math.round(cpuUsage),
      memory_percent: Math.round(memUsage),
      disk_percent: diskUsage,
    };
  } catch {
    return {
      cpu_percent: 0,
      memory_percent: 0,
      disk_percent: 0,
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
