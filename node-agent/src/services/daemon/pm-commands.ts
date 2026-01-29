// PM Commands Service
// Slash command fallback router - bypasses LLM for fast, deterministic responses
// Commands: /status, /status <node>, /loops, /start, /stop, /logs, /nodes, /lanes, /health

import type {
  PmCommand,
  PmCommandResponse,
  PmCommandHandler,
  RegisteredNode,
  NodeStatus,
  RalphLoop,
  Worktree,
} from "../types/index";

// API response types matching node-agent HTTP endpoints
interface NodeApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

const API_TIMEOUT_MS = 10000; // 10 seconds

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
      description: "Show status of all nodes or a specific node",
      handler: this.handleStatus.bind(this),
    });

    this.handlers.set("loops", {
      command: "loops",
      description: "List all Ralph loops across all nodes",
      handler: this.handleLoops.bind(this),
    });

    this.handlers.set("start", {
      command: "start",
      description: "Start a Ralph loop on a node",
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

    this.handlers.set("nodes", {
      command: "nodes",
      description: "List all registered nodes",
      handler: this.handleNodes.bind(this),
    });

    this.handlers.set("lanes", {
      command: "lanes",
      description: "List worktrees on a node",
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
  async executeCommand(command: PmCommand, nodes: RegisteredNode[]): Promise<PmCommandResponse> {
    const handler = this.handlers.get(command.command);

    if (!handler) {
      return {
        text: `Unknown command: /${command.command}\n\nType /help for available commands.`,
      };
    }

    try {
      return await handler.handler(command, nodes);
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

  /**
   * /status - Show status of all nodes or a specific node
   * Usage: /status [node_id]
   */
  private async handleStatus(command: PmCommand, nodes: RegisteredNode[]): Promise<PmCommandResponse> {
    // If node_id specified, show that node's status
    if (command.args.length > 0) {
      const nodeId = command.args[0];
      const node = nodes.find((n) => n.id === nodeId);

      if (!node) {
        return {
          text: `Node not found: ${nodeId}\n\nAvailable nodes:\n${this.formatNodeList(nodes)}`,
        };
      }

      return await this.fetchAndFormatNodeStatus(node);
    }

    // Show status of all nodes
    const lines: string[] = [`*Node Status*`, ""];

    for (const node of nodes) {
      const statusLine = await this.formatNodeStatusLine(node);
      lines.push(statusLine);
    }

    lines.push("");
    lines.push(`Total: ${nodes.length} nodes`);

    return { text: lines.join("\n") };
  }

  /**
   * /loops - List all Ralph loops across all nodes
   */
  private async handleLoops(_command: PmCommand, nodes: RegisteredNode[]): Promise<PmCommandResponse> {
    const lines: string[] = [`*Ralph Loops*`, ""];

    let totalLoops = 0;
    let runningLoops = 0;

    for (const node of nodes) {
      if (node.status !== "online") {
        continue;
      }

      const loops = await this.fetchNodeLoops(node);
      if (loops.length > 0) {
        lines.push(`_${node.id}:_`);
        for (const loop of loops) {
          const loopLine = this.formatLoopLine(loop);
          lines.push(`  ${loopLine}`);
          totalLoops++;
          if (loop.status === "running") {
            runningLoops++;
          }
        }
        lines.push("");
      }
    }

    if (totalLoops === 0) {
      lines.push("No Ralph loops running");
    } else {
      lines.push(`Total: ${totalLoops} loops (${runningLoops} running)`);
    }

    return { text: lines.join("\n") };
  }

  /**
   * /start - Start a Ralph loop on a node
   * Usage: /start <node_id> <worktree_id> <prompt>
   */
  private async handleStart(command: PmCommand, nodes: RegisteredNode[]): Promise<PmCommandResponse> {
    if (command.args.length < 3) {
      return {
        text: "Usage: /start <node_id> <worktree_id> <prompt>\n\nExample: /start worker-1 auth-fix Fix authentication bug in auth.ts",
      };
    }

    const [nodeId, worktreeId, ...promptParts] = command.args;
    const prompt = promptParts.join(" ");

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      return {
        text: `Node not found: ${nodeId}\n\nAvailable nodes:\n${this.formatNodeList(nodes)}`,
      };
    }

    if (node.status !== "online") {
      return {
        text: `Node is not online: ${nodeId}`,
      };
    }

    try {
      const url = `http://${node.host}:${node.port}/api/ralph-loops`;
      const response = await fetch(url, {
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
  private async handleStop(command: PmCommand, nodes: RegisteredNode[]): Promise<PmCommandResponse> {
    if (command.args.length < 1) {
      return {
        text: "Usage: /stop <loop_id>\n\nExample: /stop auth-fix",
      };
    }

    const loopId = command.args[0];

    // Try to find the node running this loop
    for (const node of nodes) {
      if (node.status !== "online") {
        continue;
      }

      const loops = await this.fetchNodeLoops(node);
      if (loops.find((l) => l.id === loopId)) {
        try {
          const url = `http://${node.host}:${node.port}/api/ralph-loops/${loopId}`;
          const response = await fetch(url, {
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
    }

    return {
      text: `Ralph loop not found: ${loopId}`,
    };
  }

  /**
   * /logs - Get recent logs for a Ralph loop
   * Usage: /logs <loop_id>
   */
  private async handleLogs(command: PmCommand, nodes: RegisteredNode[]): Promise<PmCommandResponse> {
    if (command.args.length < 1) {
      return {
        text: "Usage: /logs <loop_id>\n\nExample: /logs auth-fix",
      };
    }

    const loopId = command.args[0];

    // Try to find the node running this loop
    for (const node of nodes) {
      if (node.status !== "online") {
        continue;
      }

      const loops = await this.fetchNodeLoops(node);
      if (loops.find((l) => l.id === loopId)) {
        try {
          const url = `http://${node.host}:${node.port}/api/ralph-loops/${loopId}/logs`;
          const response = await fetch(url, {
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
    }

    return {
      text: `Ralph loop not found: ${loopId}`,
    };
  }

  /**
   * /nodes - List all registered nodes
   */
  private async handleNodes(_command: PmCommand, nodes: RegisteredNode[]): Promise<PmCommandResponse> {
    const lines: string[] = [`*Registered Nodes*`, "", this.formatNodeList(nodes)];

    const stats = {
      online: nodes.filter((n) => n.status === "online").length,
      offline: nodes.filter((n) => n.status === "offline").length,
      degraded: nodes.filter((n) => n.status === "degraded").length,
    };

    lines.push("");
    lines.push(`Online: ${stats.online} | Offline: ${stats.offline} | Degraded: ${stats.degraded}`);

    return { text: lines.join("\n") };
  }

  /**
   * /lanes - List worktrees on a node
   * Usage: /lanes [node_id]
   */
  private async handleLanes(command: PmCommand, nodes: RegisteredNode[]): Promise<PmCommandResponse> {
    const nodeId = command.args[0];

    if (!nodeId) {
      // Show worktrees on all nodes
      const lines: string[] = [`*Worktrees*`, ""];

      for (const node of nodes) {
        if (node.status !== "online") {
          continue;
        }

        const worktrees = await this.fetchNodeWorktrees(node);
        if (worktrees.length > 0) {
          lines.push(`_${node.id}:_`);
          for (const wt of worktrees) {
            lines.push(`  \`${wt.id}\` - ${wt.branch}`);
          }
          lines.push("");
        }
      }

      if (lines.length === 2) {
        lines.push("No worktrees found");
      }

      return { text: lines.join("\n") };
    }

    // Show worktrees on specific node
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      return {
        text: `Node not found: ${nodeId}`,
      };
    }

    if (node.status !== "online") {
      return {
        text: `Node is not online: ${nodeId}`,
      };
    }

    const worktrees = await this.fetchNodeWorktrees(node);
    const lines: string[] = [`*Worktrees on ${nodeId}*`, ""];

    if (worktrees.length === 0) {
      lines.push("No worktrees found");
    } else {
      for (const wt of worktrees) {
        lines.push(`\`${wt.id}\` - ${wt.branch}`);
        if (wt.ralphLoop) {
          lines.push(`  Ralph: ${wt.ralphLoop.status} (${wt.ralphLoop.iteration} iterations)`);
        }
      }
    }

    return { text: lines.join("\n") };
  }

  /**
   * /health - Show PM daemon health status
   */
  private async handleHealth(_command: PmCommand, nodes: RegisteredNode[]): Promise<PmCommandResponse> {
    const stats = {
      online: nodes.filter((n) => n.status === "online").length,
      offline: nodes.filter((n) => n.status === "offline").length,
      degraded: nodes.filter((n) => n.status === "degraded").length,
    };

    const lines: string[] = [
      "*PM Daemon Health*",
      "",
      `Nodes: ${stats.online}/${nodes.length} online`,
      `Offline: ${stats.offline} | Degraded: ${stats.degraded}`,
      "",
      "*Registered Nodes:*",
    ];

    for (const node of nodes) {
      const statusEmoji = node.status === "online" ? "🟢" : node.status === "degraded" ? "🟡" : "🔴";
      lines.push(`  ${statusEmoji} ${node.id} - ${node.label}`);
    }

    return { text: lines.join("\n") };
  }

  /**
   * /help - Show available commands
   */
  private async handleHelp(_command: PmCommand, _nodes: RegisteredNode[]): Promise<PmCommandResponse> {
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
  private async handleChat(command: PmCommand, _nodes: RegisteredNode[]): Promise<PmCommandResponse> {
    // Return null to indicate this should be handled by the PM brain
    return {
      text: "", // Empty response signals "forward to brain"
    };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Format node list
   */
  private formatNodeList(nodes: RegisteredNode[]): string {
    return nodes
      .map((n) => {
        const statusEmoji = n.status === "online" ? "🟢" : n.status === "degraded" ? "🟡" : "🔴";
        return `${statusEmoji} \`${n.id}\` - ${n.label}`;
      })
      .join("\n");
  }

  /**
   * Format node status line
   */
  private async formatNodeStatusLine(node: RegisteredNode): Promise<string> {
    const statusEmoji = node.status === "online" ? "🟢" : node.status === "degraded" ? "🟡" : "🔴";

    if (node.status === "online" && node.node_status) {
      const capacity = node.node_status.capacity;
      const loops = node.node_status.ralph_loops?.length || 0;
      return `${statusEmoji} \`${node.id}\` - CPU ${capacity.cpu_percent}% | Mem ${capacity.memory_percent}% | ${loops} loops`;
    }

    return `${statusEmoji} \`${node.id}\` - ${node.label} (${node.status})`;
  }

  /**
   * Fetch and format node status
   */
  private async fetchAndFormatNodeStatus(node: RegisteredNode): Promise<PmCommandResponse> {
    if (node.status !== "online") {
      return {
        text: `Node is not online: ${node.id}`,
      };
    }

    try {
      const url = `http://${node.host}:${node.port}/api/status`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      if (!response.ok) {
        return {
          text: `Failed to fetch status: HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as NodeApiResponse<NodeStatus>;
      const status = data.data!;

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
    } catch (error) {
      return {
        text: `Failed to fetch status: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Format loop line
   */
  private formatLoopLine(loop: RalphLoop): string {
    const statusEmoji = loop.status === "running" ? "🔄" : loop.status === "complete" ? "✅" : loop.status === "error" ? "❌" : "⏸️";
    return `${statusEmoji} \`${loop.id}\` - ${loop.status} (iter ${loop.iteration})`;
  }

  /**
   * Fetch node loops
   */
  private async fetchNodeLoops(node: RegisteredNode): Promise<RalphLoop[]> {
    try {
      const url = `http://${node.host}:${node.port}/api/ralph-loops`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as NodeApiResponse<{ loops: RalphLoop[] }>;
      return data.data?.loops || [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch node worktrees
   */
  private async fetchNodeWorktrees(node: RegisteredNode): Promise<Array<Worktree & { ralphLoop?: RalphLoop }>> {
    try {
      const url = `http://${node.host}:${node.port}/api/status`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as NodeApiResponse<NodeStatus>;
      const status = data.data!;

      // Map worktrees with their Ralph loops
      return status.worktrees.map((wt) => ({
        ...wt,
        ralphLoop: status.ralph_loops.find((loop) => loop.worktree_id === wt.id),
      }));
    } catch {
      return [];
    }
  }
}
