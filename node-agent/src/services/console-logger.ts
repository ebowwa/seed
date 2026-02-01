// Console Logging Service - Enhanced Status Display

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
const NODE_AGENT_DIR = path.join(process.env.HOME || "", ".node-agent");

// Box-drawing characters for nice formatting
const BOX_CHARS = {
  topLeft: "╔",
  topRight: "╗",
  bottomLeft: "╚",
  bottomRight: "╝",
  horizontal: "═",
  vertical: "║",
  leftT: "╠",
  rightT: "╣",
  topT: "╦",
  bottomT: "╩",
  cross: "╬",
};

export class ConsoleLoggerService {
  private ralphLoops: RalphLoop[] = [];
  private claudeProcesses: ClaudeCodeProcess[] = [];
  private plugins: PluginStatus[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private knownPids: Set<number> = new Set();

  constructor() {}

  /**
   * Start periodic console logging
   */
  startLogging(): void {
    if (this.intervalId) {
      return; // Already logging
    }

    console.log(`
${BOX_CHARS.topLeft}${BOX_CHARS.horizontal.repeat(75)}${BOX_CHARS.topRight}
${BOX_CHARS.vertical} ${" ".repeat(73)} ${BOX_CHARS.vertical}
${BOX_CHARS.vertical}   📊 Enhanced Console Logging Started                            ${BOX_CHARS.vertical}
${BOX_CHARS.vertical}   Refreshing every ${LOG_INTERVAL_MS / 1000}s                                          ${BOX_CHARS.vertical}
${BOX_CHARS.vertical} ${" ".repeat(73)} ${BOX_CHARS.vertical}
${BOX_CHARS.bottomLeft}${BOX_CHARS.horizontal.repeat(75)}${BOX_CHARS.bottomRight}
`);

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
      console.log("\n📊 Enhanced Console Logging Stopped\n");
    }
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
      return; // Already logged this PID
    }

    this.knownPids.add(pid);

    const timestamp = new Date().toISOString();
    const worktreeInfo = worktreeId ? ` (worktree: ${worktreeId})` : "";
    const loopInfo = loopId ? ` (loop: ${loopId})` : "";

    console.log(`
${BOX_CHARS.topLeft}${BOX_CHARS.horizontal.repeat(75)}${BOX_CHARS.topRight}
${BOX_CHARS.vertical} ${" ".repeat(73)} ${BOX_CHARS.vertical}
${BOX_CHARS.vertical}   🚀 New Claude Code Process Started                             ${BOX_CHARS.vertical}
${BOX_CHARS.vertical} ${" ".repeat(73)} ${BOX_CHARS.vertical}
${BOX_CHARS.vertical}   PID:         ${pid}${" ".repeat(68 - pid.toString().length)}${BOX_CHARS.vertical}
${BOX_CHARS.vertical}   Timestamp:   ${timestamp}${" ".repeat(68 - timestamp.length)}${BOX_CHARS.vertical}
${BOX_CHARS.vertical}   Worktree:    ${worktreeId || "N/A"}${worktreeInfo ? " ".repeat(68 - worktreeInfo.length - 3) : " ".repeat(65)}${BOX_CHARS.vertical}
${BOX_CHARS.vertical}   Loop:        ${loopId || "N/A"}${loopInfo ? " ".repeat(68 - loopInfo.length - 3) : " ".repeat(65)}${BOX_CHARS.vertical}
${BOX_CHARS.vertical} ${" ".repeat(73)} ${BOX_CHARS.vertical}
${BOX_CHARS.bottomLeft}${BOX_CHARS.horizontal.repeat(75)}${BOX_CHARS.bottomRight}
`);

    // Add to tracked processes
    this.claudeProcesses.push({
      pid,
      worktreeId,
      loopId,
      startTime: new Date(),
      command: "claude",
    });
  }

  /**
   * Log when a Claude Code process stops
   */
  logProcessStop(pid: number): void {
    this.knownPids.delete(pid);
    this.claudeProcesses = this.claudeProcesses.filter((p) => p.pid !== pid);

    console.log(`
${BOX_CHARS.topLeft}${BOX_CHARS.horizontal.repeat(75)}${BOX_CHARS.topRight}
${BOX_CHARS.vertical} ${" ".repeat(73)} ${BOX_CHARS.vertical}
${BOX_CHARS.vertical}   🛑 Claude Code Process Stopped                               ${BOX_CHARS.vertical}
${BOX_CHARS.vertical} ${" ".repeat(73)} ${BOX_CHARS.vertical}
${BOX_CHARS.vertical}   PID:         ${pid}${" ".repeat(68 - pid.toString().length)}${BOX_CHARS.vertical}
${BOX_CHARS.vertical}   Timestamp:   ${new Date().toISOString()}                                ${BOX_CHARS.vertical}
${BOX_CHARS.vertical} ${" ".repeat(73)} ${BOX_CHARS.vertical}
${BOX_CHARS.bottomLeft}${BOX_CHARS.horizontal.repeat(75)}${BOX_CHARS.bottomRight}
`);
  }

  /**
   * Log full Ralph loop state
   */
  private async logRalphLoopState(): Promise<void> {
    if (this.ralphLoops.length === 0) {
      console.log(`${BOX_CHARS.vertical}   📭 No active Ralph loops                                      ${BOX_CHARS.vertical}`);
      return;
    }

    console.log(`${BOX_CHARS.vertical}`);
    console.log(`${BOX_CHARS.vertical}   🔄 Ralph Loop State (${this.ralphLoops.length} active)`);
    console.log(`${BOX_CHARS.vertical}`);

    for (const loop of this.ralphLoops) {
      const statusEmoji = this.getStatusEmoji(loop.status);
      const completionPercent =
        loop.total_subtasks && loop.total_subtasks > 0
          ? Math.round(((loop.completed_subtasks || 0) / loop.total_subtasks) * 100)
          : 0;

      const progressBar = this.createProgressBar(completionPercent);
      const gitInfo = loop.git_info
        ? `${loop.git_info.remote || "?"}/${loop.git_info.branch || "?"}`
        : "no-git";

      console.log(`${BOX_CHARS.vertical}   ┌─────────────────────────────────────────────────────────`);
      console.log(
        `${BOX_CHARS.vertical}   │ ${statusEmoji} ${loop.id} ${loop.status.padEnd(10)} ${progressBar} ${completionPercent}%`
      );
      console.log(`${BOX_CHARS.vertical}   │    Phase: ${loop.phase || "unknown"}`);
      console.log(`${BOX_CHARS.vertical}   │    Task:  ${this.truncate(loop.current_task || "No task", 58)}`);
      console.log(
        `${BOX_CHARS.vertical}   │    Subtasks: ${loop.completed_subtasks || 0}/${loop.total_subtasks || 0} complete`
      );
      console.log(`${BOX_CHARS.vertical}   │    Git:    ${gitInfo}`);
      console.log(`${BOX_CHARS.vertical}   │    Path:   ${loop.project_path || "unknown"}`);
      if (loop.process_id) {
        console.log(`${BOX_CHARS.vertical}   │    PID:    ${loop.process_id}`);
      }
      console.log(`${BOX_CHARS.vertical}   └─────────────────────────────────────────────────────────`);
    }
  }

  /**
   * Log active Claude Code PIDs
   */
  private async logActivePids(): Promise<void> {
    try {
      // Get all Claude Code processes
      const { stdout } = await execAsync(
        'ps aux | grep -E "[c]laude|[d]oppler.*claude" | awk \'{print $2, $11, $12, $13, $14, $15}\''
      );
      const lines = stdout.trim().split("\n").filter((l) => l.length > 0);

      if (lines.length === 0) {
        console.log(`${BOX_CHARS.vertical}   🤖 No active Claude Code processes                             ${BOX_CHARS.vertical}`);

        // Check for stopped processes
        const activePids = new Set<number>();
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[0], 10);
          activePids.add(pid);
        }

        // Log stopped PIDs
        for (const knownPid of this.knownPids) {
          if (!activePids.has(knownPid)) {
            this.logProcessStop(knownPid);
          }
        }

        return;
      }

      // Track active PIDs from this scan
      const activePids = new Set<number>();

      console.log(`${BOX_CHARS.vertical}`);
      console.log(`${BOX_CHARS.vertical}   🤖 Active Claude Code Processes (${lines.length} running)`);
      console.log(`${BOX_CHARS.vertical}`);

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[0], 10);
        const command = parts.slice(1).join(" ");

        // Track this PID as active
        activePids.add(pid);

        // Check if this is a new PID
        if (!this.knownPids.has(pid)) {
          this.logProcessStart(pid);
        }

        const cmdDisplay = this.truncate(command, 60);
        console.log(`${BOX_CHARS.vertical}   • PID ${pid.toString().padEnd(8)} ${cmdDisplay}`);
      }

      // Check for stopped PIDs
      for (const knownPid of this.knownPids) {
        if (!activePids.has(knownPid)) {
          this.logProcessStop(knownPid);
        }
      }
    } catch (error) {
      console.log(`${BOX_CHARS.vertical}   ⚠️  Error detecting Claude processes: ${(error as Error).message}  ${BOX_CHARS.vertical}`);
    }
  }

  /**
   * Detect and log active MCP servers and plugins
   */
  private async logActivePlugins(): Promise<void> {
    const plugins: PluginStatus[] = [];

    // Check for MCP servers
    try {
      const mcpConfigPaths = [
        path.join(process.env.HOME || "", ".mcp.json"),
        path.join(process.env.HOME || "", "seed", ".mcp.json"),
        path.join(process.env.HOME || "", "Desktop", "codespaces", ".mcp.json"),
      ];

      for (const mcpPath of mcpConfigPaths) {
        try {
          const content = await fsp.readFile(mcpPath, "utf-8");
          const config = JSON.parse(content);

          if (config.mcpServers) {
            for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
              const config = serverConfig as { type?: string; command?: string; args?: string[] };
              plugins.push({
                name,
                type: "mcp",
                status: "active",
                details: config.type || "stdio",
              });
            }
          }
        } catch {
          // File doesn't exist or invalid JSON, skip
        }
      }
    } catch (error) {
      // Error scanning MCP configs, skip
    }

    // Check for Claude plugins in .claude/plugins
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
      // No plugins directory or error reading
    }

    this.plugins = plugins;

    if (plugins.length === 0) {
      console.log(`${BOX_CHARS.vertical}   🔌 No active plugins detected                                  ${BOX_CHARS.vertical}`);
      return;
    }

    console.log(`${BOX_CHARS.vertical}`);
    console.log(`${BOX_CHARS.vertical}   🔌 Active Plugins (${plugins.length} total)`);
    console.log(`${BOX_CHARS.vertical}`);

    // Group by type
    const byType = plugins.reduce((acc, plugin) => {
      if (!acc[plugin.type]) {
        acc[plugin.type] = [];
      }
      acc[plugin.type].push(plugin);
      return acc;
    }, {} as Record<string, PluginStatus[]>);

    for (const [type, typePlugins] of Object.entries(byType)) {
      const typeLabel = type === "mcp" ? "MCP Servers" : type === "skill" ? "Skills" : "Hooks";
      console.log(`${BOX_CHARS.vertical}   ${typeLabel}:`);
      for (const plugin of typePlugins) {
        const details = plugin.details ? ` (${plugin.details})` : "";
        console.log(`${BOX_CHARS.vertical}      • ${plugin.name}${details}`);
      }
    }
  }

  /**
   * Main status logging function
   */
  private async logStatus(): Promise<void> {
    const timestamp = new Date().toISOString();
    const timeStr = timestamp.split("T")[1].split(".")[0];

    console.log(``);
    console.log(`${BOX_CHARS.topLeft}${BOX_CHARS.horizontal.repeat(75)}${BOX_CHARS.topRight}`);
    console.log(`${BOX_CHARS.vertical} ${" ".repeat(73)} ${BOX_CHARS.vertical}`);
    console.log(
      `${BOX_CHARS.vertical}   📊 Node Agent Status Update     ${timeStr}                    ${BOX_CHARS.vertical}`
    );
    console.log(`${BOX_CHARS.vertical} ${" ".repeat(73)} ${BOX_CHARS.vertical}`);
    console.log(`${BOX_CHARS.leftT}${BOX_CHARS.horizontal.repeat(73)}${BOX_CHARS.rightT}`);

    // Log Ralph loops
    await this.logRalphLoopState();

    console.log(`${BOX_CHARS.leftT}${BOX_CHARS.horizontal.repeat(73)}${BOX_CHARS.rightT}`);

    // Log active PIDs
    await this.logActivePids();

    console.log(`${BOX_CHARS.leftT}${BOX_CHARS.horizontal.repeat(73)}${BOX_CHARS.rightT}`);

    // Log plugins
    await this.logActivePlugins();

    console.log(`${BOX_CHARS.bottomLeft}${BOX_CHARS.horizontal.repeat(75)}${BOX_CHARS.bottomRight}`);
    console.log(``);
  }

  /**
   * Get status emoji for Ralph loop state
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case "running":
        return "🟢";
      case "starting":
        return "🟡";
      case "complete":
        return "✅";
      case "error":
        return "❌";
      case "stopped":
        return "⏸️ ";
      default:
        return "⚪";
    }
  }

  /**
   * Create a progress bar
   */
  private createProgressBar(percent: number, width: number = 20): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
  }

  /**
   * Truncate text to fit width
   */
  private truncate(text: string, maxWidth: number): string {
    if (text.length <= maxWidth) {
      return text.padEnd(maxWidth);
    }
    return text.substring(0, maxWidth - 3) + "...";
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
