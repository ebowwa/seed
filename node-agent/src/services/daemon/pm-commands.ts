// PM Commands Service
// Slash command fallback router - bypasses LLM for fast, deterministic responses
// Commands: /status, /loops, /start, /stop, /logs, /lanes, /health

import type {
  PmCommand,
  PmCommandResponse,
  PmCommandHandler,
  NodeStatus,
  RalphLoop,
  Worktree,
} from "../../types/index";

// API response types matching node-agent HTTP endpoints
interface NodeApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

const LOCALHOST = "127.0.0.1";
const API_PORT = parseInt(process.env.NODE_AGENT_PORT || "8911", 10);
const API_TIMEOUT_MS = 10000; // 10 seconds

// TODO: Add /menu command for persistent quick actions panel
// TODO: Add /manage command for interactive loop management
export class PmCommandsService {
  private handlers: Map<string, PmCommandHandler> = new Map();

  constructor() {
    this.registerHandlers();
  }

  /**
   * Register all command handlers
   */
  private registerHandlers(): void {
    this.handlers.set("status", {
      command: "status",
      description: "Show node status",
      handler: this.handleStatus.bind(this),
    });

    this.handlers.set("loops", {
      command: "loops",
      description: "List all Ralph loops",
      handler: this.handleLoops.bind(this),
    });

    this.handlers.set("start", {
      command: "start",
      description: "Start a Ralph loop",
      handler: this.handleStart.bind(this),
    });

    this.handlers.set("stop", {
      command: "stop",
      description: "Stop a Ralph loop",
      handler: this.handleStop.bind(this),
    });

    this.handlers.set("logs", {
      command: "logs",
      description: "Get recent logs for a Ralph loop",
      handler: this.handleLogs.bind(this),
    });

    this.handlers.set("lanes", {
      command: "lanes",
      description: "List worktrees",
      handler: this.handleLanes.bind(this),
    });

    this.handlers.set("health", {
      command: "health",
      description: "Show PM daemon health status",
      handler: this.handleHealth.bind(this),
    });

    this.handlers.set("help", {
      command: "help",
      description: "Show available commands",
      handler: this.handleHelp.bind(this),
    });

    this.handlers.set("chat", {
      command: "chat",
      description: "Non-command messages (forward to PM brain)",
      handler: this.handleChat.bind(this),
    });
  }

  /**
   * Execute a command
   */
  async executeCommand(command: PmCommand): Promise<PmCommandResponse> {
    const handler = this.handlers.get(command.command);

    if (!handler) {
      return {
        text: `Unknown command: /${command.command}\n\nType /help for available commands.`,
      };
    }

    try {
      return await handler.handler(command);
    } catch (error) {
      console.error(`[PmCommands] Error executing /${command.command}:`, error);
      return {
        text: `Error executing /${command.command}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get all registered commands
   */
  getCommands(): PmCommandHandler[] {
    return Array.from(this.handlers.values());
  }

  // ========================================================================
  // Command Handlers
  // ========================================================================

  // TODO: Enrich status with multi-node awareness when node registry exists
  // TODO: Add inline keyboard buttons for quick actions (restart, logs, etc.)
  /**
   * /status - Show node status
   */
  private async handleStatus(_command: PmCommand): Promise<PmCommandResponse> {
    const status = await this.fetchLocalStatus();
    if (!status) {
      return { text: "Failed to fetch node status" };
    }

    const lines: string[] = [
      `*${status.node_id}*`,
      "",
      `Host: ${status.hostname}`,
      `Tailscale IP: ${status.tailscale_ip}`,
      "",
      "*Capacity:*",
      `  CPU: ${status.capacity.cpu_percent}%`,
      `  Memory: ${status.capacity.memory_percent}%`,
      `  Disk: ${status.capacity.disk_percent}%`,
      "",
      "*Sessions:*",
      `  SSH: ${status.sessions.ssh} | tmux: ${status.sessions.tmux} | Claude: ${status.sessions.claude_code}`,
      "",
      `*Worktrees:* ${status.worktrees.length}`,
      `*Ralph Loops:* ${status.ralph_loops.length}`,
    ];

    if (status.ralph_loops.length > 0) {
      lines.push("");
      for (const loop of status.ralph_loops) {
        lines.push(`  ${this.formatLoopLine(loop)}`);
      }
    }

    return { text: lines.join("\n") };
  }

  // TODO: Add interactive buttons per loop (restart, stop, logs, watch)
  // TODO: Filter/sort options (by status, branch, age)
  /**
   * /loops - List all Ralph loops
   */
  private async handleLoops(_command: PmCommand): Promise<PmCommandResponse> {
    const status = await this.fetchLocalStatus();
    if (!status) {
      return { text: "Failed to fetch node status" };
    }

    const lines: string[] = [`*Ralph Loops*`, ""];
    const loops = status.ralph_loops || [];

    if (loops.length === 0) {
      lines.push("No Ralph loops running");
    } else {
      for (const loop of loops) {
        lines.push(this.formatLoopLine(loop));
      }
      const runningCount = loops.filter(l => l.status === "running").length;
      lines.push("");
      lines.push(`Total: ${loops.length} loops (${runningCount} running)`);
    }

    return { text: lines.join("\n") };
  }

  /**
   * /start - Start a Ralph loop
   * Usage: /start <worktree_id> <prompt>
   */
  private async handleStart(command: PmCommand): Promise<PmCommandResponse> {
    if (command.args.length < 2) {
      return {
        text: "Usage: /start <worktree_id> <prompt>\n\nExample: /start auth-fix Fix authentication bug in auth.ts",
      };
    }

    const [worktreeId, ...promptParts] = command.args;
    const prompt = promptParts.join(" ");

    try {
      const response = await fetch(`http://${LOCALHOST}:${API_PORT}/api/ralph-loops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
        body: JSON.stringify({
          worktree_id: worktreeId,
          prompt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          text: `Failed to start Ralph loop: ${JSON.stringify(error)}`,
        };
      }

      const data = (await response.json()) as NodeApiResponse<{ loop: RalphLoop }>;

      return {
        text: `Ralph loop started:\n${this.formatLoopLine(data.data!.loop)}`,
      };
    } catch (error) {
      return {
        text: `Failed to start Ralph loop: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * /stop - Stop a Ralph loop
   * Usage: /stop <loop_id>
   */
  private async handleStop(command: PmCommand): Promise<PmCommandResponse> {
    if (command.args.length < 1) {
      return {
        text: "Usage: /stop <loop_id>\n\nExample: /stop auth-fix",
      };
    }

    const loopId = command.args[0];

    try {
      const response = await fetch(`http://${LOCALHOST}:${API_PORT}/api/ralph-loops/${loopId}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      if (!response.ok) {
        return {
          text: `Failed to stop Ralph loop: HTTP ${response.status}`,
        };
      }

      return {
        text: `Ralph loop stopped: ${loopId}`,
      };
    } catch (error) {
      return {
        text: `Failed to stop Ralph loop: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * /logs - Get recent logs for a Ralph loop
   * Usage: /logs <loop_id>
   */
  private async handleLogs(command: PmCommand): Promise<PmCommandResponse> {
    if (command.args.length < 1) {
      return {
        text: "Usage: /logs <loop_id>\n\nExample: /logs auth-fix",
      };
    }

    const loopId = command.args[0];

    try {
      const response = await fetch(`http://${LOCALHOST}:${API_PORT}/api/ralph-loops/${loopId}/logs`, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      if (!response.ok) {
        return {
          text: `Failed to fetch logs: HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as NodeApiResponse<{ logs: string }>;
      const logs = data.data!.logs;

      // Return last 50 lines
      const lines = logs.split("\n").slice(-50);
      return {
        text: `Logs for ${loopId}:\n\`\`\`\n${lines.join("\n")}\n\`\`\``,
        parse_mode: "Markdown",
      };
    } catch (error) {
      return {
        text: `Failed to fetch logs: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * /lanes - List worktrees
   */
  private async handleLanes(_command: PmCommand): Promise<PmCommandResponse> {
    const status = await this.fetchLocalStatus();
    if (!status) {
      return { text: "Failed to fetch node status" };
    }

    const lines: string[] = [`*Worktrees*`, ""];

    if (status.worktrees.length === 0) {
      lines.push("No worktrees found");
    } else {
      for (const wt of status.worktrees) {
        lines.push(`\`${wt.id}\` - ${wt.branch}`);
        const ralphLoop = status.ralph_loops.find((loop) => loop.worktree_id === wt.id);
        if (ralphLoop) {
          lines.push(`  Ralph: ${ralphLoop.status} (${ralphLoop.iteration} iterations)`);
        }
      }
    }

    return { text: lines.join("\n") };
  }

  /**
   * /health - Show PM daemon health status
   */
  private async handleHealth(_command: PmCommand): Promise<PmCommandResponse> {
    const status = await this.fetchLocalStatus();

    const lines: string[] = [
      "*PM Daemon Health*",
      "",
      "Mode: Single-node (local)",
      `Node: ${status?.node_id || "unknown"}`,
    ];

    if (status) {
      lines.push("");
      lines.push("*Capacity:*");
      lines.push(`  CPU: ${status.capacity.cpu_percent}%`);
      lines.push(`  Memory: ${status.capacity.memory_percent}%`);
      lines.push(`  Disk: ${status.capacity.disk_percent}%`);
      lines.push("");
      lines.push(`*Ralph Loops:* ${status.ralph_loops.length}`);
      lines.push(`*Worktrees:* ${status.worktrees.length}`);
    }

    return { text: lines.join("\n") };
  }

  /**
   * /help - Show available commands
   */
  private async handleHelp(_command: PmCommand): Promise<PmCommandResponse> {
    const lines: string[] = [
      "*Available Commands*",
      "",
    ];

    for (const handler of this.handlers.values()) {
      if (handler.command === "chat") {
        continue; // Skip chat command
      }
      lines.push(`/${handler.command} - ${handler.description}`);
    }

    return { text: lines.join("\n") };
  }

  /**
   * chat - Non-command messages (forward to PM brain)
   */
  private async handleChat(_command: PmCommand): Promise<PmCommandResponse> {
    // Return empty text to signal "forward to brain"
    return {
      text: "",
    };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Fetch local node status
   */
  private async fetchLocalStatus(): Promise<NodeStatus | null> {
    try {
      const response = await fetch(`http://${LOCALHOST}:${API_PORT}/api/status`, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as NodeApiResponse<NodeStatus>;
      return data.data || null;
    } catch {
      return null;
    }
  }

  /**
   * Format loop line
   */
  private formatLoopLine(loop: RalphLoop): string {
    const statusEmoji = loop.status === "running" ? "🔄" : loop.status === "complete" ? "✅" : loop.status === "error" ? "❌" : "⏸️";
    return `${statusEmoji} \`${loop.id}\` - ${loop.status} (iter ${loop.iteration})`;
  }
}
