// Console Logging Service - Simple status logging

import { exec } from "child_process";
import { promisify } from "util";
import { promises as fsp } from "fs";
import path from "path";
import type {
  ClaudeCodeProcess,
  PluginStatus,
  RalphLoop,
  ConsoleLogState,
} from "../types/index";

const execAsync = promisify(exec);

// Configuration
const LOG_INTERVAL_MS = 30000; // Log every 30 seconds

export interface ConsoleLogEntry {
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export class ConsoleLoggerService {
  private ralphLoops: RalphLoop[] = [];
  private claudeProcesses: ClaudeCodeProcess[] = [];
  private plugins: PluginStatus[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private knownPids: Set<number> = new Set();
  private logBuffer: ConsoleLogEntry[] = [];
  private readonly MAX_LOG_ENTRIES = 100;
  private originalConsoleLog: typeof console.log = console.log.bind(console);
  private originalConsoleError: typeof console.error = console.error.bind(console);
  private loggingActive = false;

  constructor() {}

  /**
   * Get recent log entries
   */
  getRecentLogs(limit: number = 20): ConsoleLogEntry[] {
    return this.logBuffer.slice(-limit);
  }

  /**
   * Add an entry to the log buffer
   */
  private addLog(level: ConsoleLogEntry["level"], message: string): void {
    this.logBuffer.push({
      timestamp: new Date().toISOString(),
      level,
      message,
    });
    if (this.logBuffer.length > this.MAX_LOG_ENTRIES) {
      this.logBuffer.shift();
    }
  }

  /**
   * Start periodic console logging
   */
  startLogging(): void {
    if (this.intervalId) {
      return;
    }

    // Override console.log to capture all output
    if (!this.loggingActive) {
      console.log = (...args: unknown[]) => {
        const message = args.map(String).join(" ");
        this.addLog("info", message);
        this.originalConsoleLog(...args);
      };
      console.error = (...args: unknown[]) => {
        const message = args.map(String).join(" ");
        this.addLog("error", message);
        this.originalConsoleError(...args);
      };
      this.loggingActive = true;
    }

    this.originalConsoleLog("[NodeAgent] Console logging started (every 30s)");

    // Initial log
    this.logStatus();

    // Set up periodic logging
    this.intervalId = setInterval(() => {
      this.logStatus();
    }, LOG_INTERVAL_MS);
  }

  /**
   * Stop periodic console logging
   */
  stopLogging(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.loggingActive) {
      console.log = this.originalConsoleLog;
      console.error = this.originalConsoleError;
      this.loggingActive = false;
    }

    this.originalConsoleLog("[NodeAgent] Console logging stopped");
  }

  /**
   * Update Ralph loops state
   */
  updateRalphLoops(loops: RalphLoop[]): void {
    this.ralphLoops = loops;
  }

  /**
   * Log when a new Claude Code process starts
   */
  logProcessStart(pid: number, worktreeId?: string, loopId?: string): void {
    if (this.knownPids.has(pid)) {
      return;
    }

    this.knownPids.add(pid);

    const parts = ["Claude Code process started", `PID:${pid}`];
    if (worktreeId) parts.push(`worktree:${worktreeId}`);
    if (loopId) parts.push(`loop:${loopId}`);

    this.originalConsoleLog(`[NodeAgent] ${parts.join(" ")}`);
  }

  /**
   * Log when a Claude Code process stops
   */
  logProcessStop(pid: number): void {
    this.knownPids.delete(pid);
    this.claudeProcesses = this.claudeProcesses.filter((p) => p.pid !== pid);
    this.originalConsoleLog(`[NodeAgent] Claude Code process stopped: PID ${pid}`);
  }

  /**
   * Log Ralph loop state
   */
  private async logRalphLoopState(): Promise<void> {
    if (this.ralphLoops.length === 0) {
      return;
    }

    for (const loop of this.ralphLoops) {
      const parts = [
        `Ralph loop ${loop.id}`,
        loop.status,
        `iter:${loop.iteration}`,
      ];
      if (loop.phase) parts.push(`phase:${loop.phase}`);
      if (loop.process_id) parts.push(`PID:${loop.process_id}`);
      if (loop.git_info?.branch) parts.push(`branch:${loop.git_info.branch}`);

      this.originalConsoleLog(`[NodeAgent] ${parts.join(" ")}`);
    }
  }

  /**
   * Log active Claude Code PIDs
   */
  private async logActivePids(): Promise<void> {
    try {
      const { stdout } = await execAsync(
        'ps aux | grep -E "[c]laude|[d]oppler.*claude" | awk \'{print $2}\''
      );
      const lines = stdout.trim().split("\n").filter((l) => l.length > 0);

      const activePids = new Set<number>();
      for (const line of lines) {
        const pid = parseInt(line.trim(), 10);
        if (!isNaN(pid)) {
          activePids.add(pid);
          if (!this.knownPids.has(pid)) {
            this.logProcessStart(pid);
          }
        }
      }

      // Check for stopped PIDs
      for (const knownPid of this.knownPids) {
        if (!activePids.has(knownPid)) {
          this.logProcessStop(knownPid);
        }
      }

      if (lines.length > 0) {
        this.originalConsoleLog(`[NodeAgent] Active Claude Code processes: ${lines.length}`);
      }
    } catch {
      // Error detecting processes, skip
    }
  }

  /**
   * Detect and log active plugins
   */
  private async logActivePlugins(): Promise<void> {
    const plugins: PluginStatus[] = [];

    // Check for MCP servers
    try {
      const mcpConfigPaths = [
        path.join(process.env.HOME || "", ".mcp.json"),
        path.join(process.env.HOME || "", "seed", ".mcp.json"),
      ];

      for (const mcpPath of mcpConfigPaths) {
        try {
          const content = await fsp.readFile(mcpPath, "utf-8");
          const config = JSON.parse(content);

          if (config.mcpServers) {
            for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
              const sc = serverConfig as { type?: string };
              plugins.push({
                name,
                type: "mcp",
                status: "active",
                details: sc.type || "stdio",
              });
            }
          }
        } catch {
          // File doesn't exist or invalid JSON, skip
        }
      }
    } catch {
      // Error scanning MCP configs, skip
    }

    // Check for Claude plugins
    try {
      const pluginsDir = path.join(process.env.HOME || "", ".claude", "plugins");
      const entries = await fsp.readdir(pluginsDir, { withFileTypes: true }).catch(() => []);

      for (const entry of entries) {
        if (entry.isDirectory()) {
          plugins.push({
            name: entry.name,
            type: "skill",
            status: "active",
          });
        }
      }
    } catch {
      // No plugins directory
    }

    this.plugins = plugins;

    if (plugins.length > 0) {
      const byType = plugins.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const parts = Object.entries(byType).map(([type, count]) => `${count} ${type}`);
      this.originalConsoleLog(`[NodeAgent] Active plugins: ${parts.join(", ")}`);
    }
  }

  /**
   * Main status logging function
   */
  private async logStatus(): Promise<void> {
    await this.logRalphLoopState();
    await this.logActivePids();
    await this.logActivePlugins();
  }

  /**
   * Get current state snapshot
   */
  getState(): ConsoleLogState {
    return {
      claudeProcesses: this.claudeProcesses,
      ralphLoops: this.ralphLoops,
      plugins: this.plugins,
      lastUpdate: new Date(),
    };
  }
}
