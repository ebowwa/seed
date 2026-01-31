// Node Agent - Main HTTP Server

import { RalphService } from "./services/ralph";
import { GitService } from "./services/git";
import { TailscaleService } from "@codespaces/tailscale";
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
  ConnectionInfo,
} from "./types/index";

// PM Daemon imports (conditionally loaded)
import { TelegramService } from "./services/daemon/telegram";
import { PmCommandsService } from "./services/daemon/pm-commands";
import { PmMonitorService } from "./services/daemon/pm-monitor";
import { DaemonLayerAgentService } from "./services/daemon/daemon-layer-agent";

// Configuration
const PORT = parseInt(process.env.NODE_AGENT_PORT || "8911", 10);
const HOST = process.env.NODE_AGENT_HOST || "0.0.0.0";

// Services
const gitService = new GitService();
const ralphService = new RalphService();
const tailscaleService = new TailscaleService();

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
        connection_info: await getConnectionInfo(),
      };

      return jsonResponse(status, { headers });
    }

    // ========================================================================
    // GET /api/worktrees
    //
    // NOTE: Worktree CRUD endpoints implemented but require integration testing:
    // - GitService wraps `git worktree` commands (list, add, remove)
    // - Needs real git repository at REPOS_BASE_PATH (~/repos by default)
    // - Test scenario: clone repo, create worktree, spawn Ralph, verify isolation
    //
    // Test setup:
    //   cd ~/repos && git clone <repo> main-repo
    //   curl -X POST http://localhost:8911/api/worktrees -d '{"id":"test","branch":"main"}'
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
    // GET /api/tailscale/status
    // ========================================================================
    if (url.pathname === "/api/tailscale/status" && method === "GET") {
      try {
        const status = await tailscaleService.getStatus();
        return jsonResponse({ success: true, status }, { headers });
      } catch (error) {
        return errorResponse("TAILSCALE_ERROR", error instanceof Error ? error.message : "Failed to get Tailscale status");
      }
    }

    // ========================================================================
    // GET /api/tailscale/ips
    // ========================================================================
    if (url.pathname === "/api/tailscale/ips" && method === "GET") {
      try {
        const ips = await tailscaleService.getIPs();
        return jsonResponse({ success: true, ips }, { headers });
      } catch (error) {
        return errorResponse("TAILSCALE_ERROR", error instanceof Error ? error.message : "Failed to get Tailscale IPs");
      }
    }

    // ========================================================================
    // GET /api/tailscale/peers
    // ========================================================================
    if (url.pathname === "/api/tailscale/peers" && method === "GET") {
      try {
        const peers = await tailscaleService.getPeers();
        return jsonResponse({ success: true, peers }, { headers });
      } catch (error) {
        return errorResponse("TAILSCALE_ERROR", error instanceof Error ? error.message : "Failed to get Tailscale peers");
      }
    }

    // ========================================================================
    // GET /api/tailscale/peers/online
    // ========================================================================
    if (url.pathname === "/api/tailscale/peers/online" && method === "GET") {
      try {
        const peers = await tailscaleService.getOnlinePeers();
        return jsonResponse({ success: true, peers }, { headers });
      } catch (error) {
        return errorResponse("TAILSCALE_ERROR", error instanceof Error ? error.message : "Failed to get online peers");
      }
    }

    // ========================================================================
    // POST /api/tailscale/ping
    // ========================================================================
    if (url.pathname === "/api/tailscale/ping" && method === "POST") {
      try {
        const body = await req.json();
        if (!body.target) {
          return errorResponse("INVALID_REQUEST", "Missing required field: target");
        }

        const count = body.count || 5;
        const result = await tailscaleService.ping(body.target, count);
        return jsonResponse({ success: true, result }, { headers });
      } catch (error) {
        return errorResponse("TAILSCALE_ERROR", error instanceof Error ? error.message : "Failed to ping peer");
      }
    }

    // ========================================================================
    // GET /api/tailscale/info
    // ========================================================================
    if (url.pathname === "/api/tailscale/info" && method === "GET") {
      try {
        const info = await tailscaleService.getTailnetInfo();
        return jsonResponse({ success: true, info }, { headers });
      } catch (error) {
        return errorResponse("TAILSCALE_ERROR", error instanceof Error ? error.message : "Failed to get tailnet info");
      }
    }

    // ========================================================================
    // GET /api/tailscale/whois/:ip
    // ========================================================================
    if (url.pathname.startsWith("/api/tailscale/whois/") && method === "GET") {
      try {
        const ip = url.pathname.split("/").pop();
        if (!ip) {
          return errorResponse("INVALID_REQUEST", "Missing IP address");
        }

        const info = await tailscaleService.whois(ip);
        return jsonResponse({ success: true, info }, { headers });
      } catch (error) {
        return errorResponse("TAILSCALE_ERROR", error instanceof Error ? error.message : "Failed to lookup IP");
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
// Connection Info
//
// Gathers comprehensive internet connection quality metrics for the node:
//
// 1. Connectivity Status: online | offline | degraded
//    - Determined by HTTP reachability tests
//    - Degraded: high latency (>500ms) or packet loss (>5%)
//
// 2. Connection Source:
//    - Public IP address via ipify.org
//    - ISP/org/location via ip-api.com (free, no auth)
//    - VPN/Proxy/Tor detection via AS name patterns
//
// 3. Connection Quality:
//    - Latency to Google DNS, Cloudflare DNS, Hetzner
//    - Jitter (latency variance - network stability indicator)
//    - Packet loss percentage (10-ping sample)
//    - Optional speed test (set INCLUDE_SPEED_TEST=true)
//
// Environment Variables:
//   - INCLUDE_SPEED_TEST=true  Enable download speed test (~10s slower)
//
// Returns: ConnectionInfo object with all metrics
// ============================================================================

async function getConnectionInfo() {
  const result = {
    status: "online" as "online" | "offline" | "degraded",
    source: {
      public_ip: "" as string,
      isp: undefined as string | undefined,
      org: undefined as string | undefined,
      country: undefined as string | undefined,
      city: undefined as string | undefined,
      is_vpn: false,
      is_tor: false,
      is_proxy: false,
    },
    quality: {
      latency_ms: {
        google: null as number | null,
        cloudflare: null as number | null,
        hetzner: null as number | null,
        average: null as number | null,
      },
      jitter_ms: null as number | null,
      packet_loss_percent: null as number | null,
      download_mbps: undefined as number | undefined,
      upload_mbps: undefined as number | undefined,
    },
    tested_at: new Date().toISOString(),
  };

  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    // ========================================================================
    // 1. Check if online (connectivity test)
    //
    // Tests connectivity by attempting HTTPS connection to reliable DNS servers.
    // Falls back to secondary endpoint if primary fails. Returns early with
    // "offline" status if both fail, skipping remaining tests.
    // ========================================================================
    let isOnline = false;
    try {
      // Quick DNS check + HTTP test to Cloudflare (fast)
      // Tries 1.1.1.1 (Cloudflare) first, falls back to 8.8.8.8 (Google)
      await execAsync("curl -s -o /dev/null -w '%{http_code}' --max-time 3 https://1.1.1.1 2>/dev/null || curl -s -o /dev/null -w '%{http_code}' --max-time 3 https://8.8.8.8 2>/dev/null");
      isOnline = true;
    } catch {
      result.status = "offline";
      return result;
    }

    // ========================================================================
    // 2. Get public IP and ISP info
    //
    // Two-step process:
    // a) ipify.org - Fast, reliable public IP lookup
    // b) ip-api.com - Detailed geolocation and ISP info (free tier, rate limited)
    //
    // VPN Detection: Analyzes AS (Autonomous System) name for hosting patterns
    //    e.g., "DIGITALOCEAN-ASN", "Hetzner Online GmbH", "Amazon AWS"
    // ========================================================================
    try {
      // Try ipify first for IP only (fast, reliable, no rate limit issues)
      const ipCheck = await execAsync("curl -s --max-time 3 https://api.ipify.org 2>/dev/null");
      result.source.public_ip = ipCheck.stdout.trim() || "";

      // Get detailed info from ip-api.com (free, no key needed, rate limited to 45/min)
      // Fields requested: status, country, city, isp, org, as (ASN), hosting, proxy, mobile
      if (result.source.public_ip) {
        const ipInfo = await execAsync(`curl -s --max-time 5 "http://ip-api.com/json/${result.source.public_ip}?fields=status,message,country,city,isp,org,as,hosting,proxy,mobile" 2>/dev/null`);
        const info = JSON.parse(ipInfo.stdout);

        if (info.status === "success") {
          result.source.isp = info.isp || undefined;
          result.source.org = info.org || undefined;
          result.source.country = info.country || undefined;
          result.source.city = info.city || undefined;
          result.source.is_proxy = info.proxy || false;

          // Detect VPN: look for common VPN hosting patterns in AS name
          // VPN providers typically use datacenter IPs, not residential
          const asName = (info.as || "").toLowerCase();
          const hostingPatterns = ["hosting", "vpn", "vps", "cloud", "dedicated", "datacenter"];
          result.source.is_vpn = hostingPatterns.some(p => asName.includes(p)) || info.hosting || false;
        }
      }
    } catch {
      // If detailed lookup fails, we still have the IP from ipify
      // Continue without geolocation data
    }

    // ========================================================================
    // 3. Measure latency to multiple endpoints
    //
    // Pings three well-connected endpoints to measure network latency:
    // - 1.1.1.1 (Cloudflare DNS) - Typically fastest, global anycast
    // - 8.8.8.8 (Google DNS) - Reliable fallback
    // - hetzner.com - Popular VPS provider, relevant for our infrastructure
    //
    // Jitter: Standard deviation of ping times (lower = more stable)
    //   - < 10ms: Excellent (gaming/real-time ready)
    //   - 10-30ms: Good (video calls acceptable)
    //   - > 30ms: Poor (noticeable lag, jittery voice)
    // ========================================================================
    const latencyTests = [
      { name: "google", host: "1.1.1.1" },     // Cloudflare DNS (more reliable than Google for ping)
      { name: "cloudflare", host: "8.8.8.8" },  // Google DNS
      { name: "hetzner", host: "hetzner.com" }, // Hetzner
    ];

    const latencies: number[] = [];

    for (const test of latencyTests) {
      try {
        // Ping 3 times and get average
        // macOS: tail -1 | awk '{print $4}' | cut -d'/' -f2  extracts avg from "round-trip min/avg/max/stddev"
        // Linux: tail -1 | awk -F'/' '{print $5}'                extracts avg from same format
        const pingCmd = process.platform === "darwin"
          ? `ping -c 3 -t 2 ${test.host} 2>/dev/null | tail -1 | awk '{print $4}' | cut -d'/' -f2`
          : `ping -c 3 -W 2 ${test.host} 2>/dev/null | tail -1 | awk -F'/' '{print $5}'`;

        const { stdout } = await execAsync(pingCmd);
        const latency = parseFloat(stdout.trim());
        if (!isNaN(latency)) {
          result.quality.latency_ms[test.name as keyof typeof result.quality.latency_ms] = Math.round(latency);
          latencies.push(latency);
        }
      } catch {
        // Ping failed, skip this endpoint
      }
    }

    // Calculate average latency across all successful pings
    if (latencies.length > 0) {
      result.quality.latency_ms.average = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

      // Calculate jitter (standard deviation - measures network stability)
      // High jitter = inconsistent latency = poor experience for real-time apps
      const avg = result.quality.latency_ms.average;
      const variance = latencies.reduce((sum, lat) => sum + Math.pow(lat - avg, 2), 0) / latencies.length;
      result.quality.jitter_ms = Math.round(Math.sqrt(variance));
    }

    // ========================================================================
    // 4. Packet loss detection
    //
    // Sends 10 pings to Google DNS and measures how many were lost.
    // Packet loss indicates network congestion, faulty equipment, or bad routing.
    //
    // Interpretation:
    //   - 0%: Excellent (normal for wired connections)
    //   - 1-2%: Acceptable (normal for WiFi/cellular)
    //   - >5%: Problematic (noticeable issues: buffering, disconnects)
    // ========================================================================
    try {
      const packetLossCmd = process.platform === "darwin"
        ? `ping -c 10 -t 2 8.8.8.8 2>/dev/null | grep 'packet loss' | awk '{print $6}' | sed 's/%//'`
        : `ping -c 10 -W 2 8.8.8.8 2>/dev/null | grep 'packet loss' | awk -F'%' '{print $1}' | awk '{print $NF}'`;

      const { stdout } = await execAsync(packetLossCmd);
      const packetLoss = parseFloat(stdout.trim());
      if (!isNaN(packetLoss)) {
        result.quality.packet_loss_percent = Math.round(packetLoss);
      }
    } catch {
      // Packet loss test failed
    }

    // ========================================================================
    // 5. Optional speed test (slow - only if explicitly requested)
    //
    // Downloads a 10MB test file from Tele2's speedtest server.
    // This adds ~10 seconds to the status request, so it's opt-in only.
    //
    // Enable by setting: INCLUDE_SPEED_TEST=true
    //
    // Note: This is a single-threaded download test. Real-world speeds may vary
    // due to multi-connection optimizations used by browsers/download managers.
    // ========================================================================
    if (process.env.INCLUDE_SPEED_TEST === "true") {
      try {
        // Download test using curl to a fast CDN
        const downloadStart = Date.now();
        await execAsync("curl -s -o /dev/null --max-time 10 http://speedtest.tele2.net/10MB.zip 2>/dev/null");
        const downloadTime = (Date.now() - downloadStart) / 1000; // seconds
        const downloadMbps = (10 * 8) / downloadTime; // 10MB * 8 bits / seconds
        result.quality.download_mbps = Math.round(downloadMbps);
      } catch {
        // Speed test failed
      }
    }

    // ========================================================================
    // 6. Determine overall connection status
    //
    // "online":    All tests passed, acceptable latency/packet loss
    // "offline":   Cannot reach internet (caught in step 1)
    // "degraded":  Online but poor quality (high latency or packet loss)
    // ========================================================================
    if (result.quality.latency_ms.average !== null) {
      // Thresholds: >500ms latency OR >5% packet loss = degraded
      // These thresholds are conservative - may need adjustment based on use case
      if (result.quality.latency_ms.average > 500 || (result.quality.packet_loss_percent !== null && result.quality.packet_loss_percent > 5)) {
        result.status = "degraded";
      }
    }

  } catch (error) {
    // If anything unexpected fails, mark as degraded rather than crashing
    console.error("[ConnectionInfo] Error gathering connection info:", error);
    result.status = "degraded";
  }

  return result;
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
    //
    // Provides real-time bidirectional communication with running Ralph loops:
    // - Client → WebSocket → Claude stdin (send prompts/commands)
    // - Claude stdout → WebSocket → Client (stream responses)
    //
    // Usage: ws://localhost:8911/api/ralph-loops/<loopId>/ws
    //
    // Connection lifecycle:
    // 1. Verifies loop exists and has active process
    // 2. Pipes proc.stdout → ws.send()
    // 3. Relays ws messages → proc.stdin
    // 4. Cleans up pipes on connection close
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
console.log(`   GET    /api/ralph-loops`);
console.log(`   POST   /api/ralph-loops`);
console.log(`   GET    /api/ralph-loops/:id`);
console.log(`   DELETE /api/ralph-loops/:id`);
console.log(`   GET    /api/ralph-loops/:id/logs`);
console.log(`   WS     /api/ralph-loops/:id/ws  (WebSocket: bidirectional stdio relay to active Ralph process)`);
console.log(`   GET    /api/tailscale/status`);
console.log(`   GET    /api/tailscale/ips`);
console.log(`   GET    /api/tailscale/peers`);
console.log(`   GET    /api/tailscale/peers/online`);
console.log(`   POST   /api/tailscale/ping`);
console.log(`   GET    /api/tailscale/info`);
console.log(`   GET    /api/tailscale/whois/:ip`);
console.log();

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
    // Initialize services
    const telegramService = new TelegramService();
    const pmCommands = new PmCommandsService();
    const daemonLayerAgent = new DaemonLayerAgentService();
    const pmMonitor = new PmMonitorService({
      intervalMs: parseInt(process.env.PM_MONITOR_INTERVAL_MS || "30000", 10),
      stallThresholdMinutes: parseInt(process.env.PM_STALL_THRESHOLD_MINUTES || "10", 10),
    });

    // Test Telegram connection
    console.log("[PM Daemon] Testing Telegram connection...");
    const testResult = await telegramService.testConnection();
    if (!testResult.ok) {
      console.error(`[PM Daemon] Failed to connect to Telegram: ${testResult.error}`);
      throw new Error(`Telegram connection failed: ${testResult.error}`);
    }
    console.log(`[PM Daemon] ✓ Connected to Telegram bot: @${testResult.bot?.username}`);

    // Start Daemon Layer Agent session (persistent conversation memory)
    console.log("[PM Daemon] Starting Daemon Layer Agent session...");
    await daemonLayerAgent.start();
    console.log(`[PM Daemon] ✓ Daemon Layer Agent session running`);

    // Get local hostname for startup message
    const localHostname = await getHostname();

    // Send startup notification
    await telegramService.sendText(`🟢 *PM Daemon Online*

Node: ${localHostname}
Mode: Single-node (local)
Time: ${new Date().toISOString()}
`);

    // Recent events for context (circular buffer)
    const recentEvents: MonitorEvent[] = [];
    const MAX_RECENT_EVENTS = 10;

    // Start Telegram polling loop
    console.log("[PM Daemon] Starting Telegram polling loop...");
    const telegramAbortController = new AbortController();

    telegramService.startPolling({
      signal: telegramAbortController.signal,
      onUpdate: async (update) => {
        if (!update.message) {
          return;
        }

        const command = telegramService.parseCommand(update.message);
        if (!command) {
          return;
        }

        console.log(`[PM Daemon] Received command: /${command.command}`);

        // Handle slash commands
        if (command.command !== "chat") {
          const response = await pmCommands.executeCommand(command);
          await telegramService.sendText(response.text, {
            parse_mode: response.parse_mode,
            reply_to_message_id: response.reply_to_message_id,
          });
          return;
        }

        // Chat messages go to Daemon Layer Agent
        const agentResponse = await daemonLayerAgent.processMessage(command.raw_text, {
          events: recentEvents.slice(-5),
        });

        await telegramService.sendText(agentResponse.text);
      },
      onError: (error) => {
        console.error("[PM Daemon] Telegram polling error:", error);
      },
    });

    // Start monitor loop
    console.log("[PM Daemon] Starting monitor loop...");
    const monitorAbortController = new AbortController();

    pmMonitor.startMonitoring({
      signal: monitorAbortController.signal,
      onEvent: async (event) => {
        // Add to recent events
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
              // For other events, let the PM brain decide whether to notify
              return;
          }

          await telegramService.sendText(message);
        }
      },
    });

    console.log("[PM Daemon] ✓ All PM Daemon services started");
    console.log("[PM Daemon] 📱 Send /help to the bot for available commands");

    // Graceful shutdown
    const shutdown = async () => {
      console.log("[PM Daemon] Shutting down...");
      telegramAbortController.abort();
      monitorAbortController.abort();
      telegramService.stopPolling();
      pmMonitor.stopMonitoring();

      // Stop Daemon Layer Agent session
      console.log("[PM Daemon] Stopping Daemon Layer Agent session...");
      await daemonLayerAgent.stop();

      await telegramService.sendText("🔴 PM Daemon shutting down");

      // Allow time for message to send
      await new Promise((resolve) => setTimeout(resolve, 2000));
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

  } catch (error) {
    console.error("[PM Daemon] Failed to start:", error);
    process.exit(1);
  }
}
