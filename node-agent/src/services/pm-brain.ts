// PM Brain Service
// Claude Code session manager - the AI brain of the PM daemon
//
// DESIGN: Uses a persistent virtual session with conversation history.
// Each message includes full conversation context for stateless Claude Code CLI.
//
// Why not a single long-running process?
// - Claude Code CLI (`claude -p`) is designed for single-shot execution
// - No persistent stdin/stdout mode for multiple prompts
// - Solution: Maintain conversation history, include in each call
//
// Future: Use ClaudeAgentClient SDK for true persistent sessions

import { spawn } from "child_process";
import { promises as fsp } from "fs";
import path from "path";
import type {
  PmBrainMessage,
  PmBrainResponse,
  PmBrainSession,
  MonitorEvent,
  RegisteredNode,
} from "../types/index";

const PM_SYSTEM_PROMPT = `You are the PM (Project Manager) Daemon — a 24/7 AI project manager overseeing a fleet of autonomous AI developer agents called Ralphs.

## Your Role

You manage:
- Multiple nodes (VPS instances running node-agent)
- Git worktrees (isolated development environments)
- Ralph loops (autonomous AI agents that iterate on tasks)
- Branches and PRs

## Your Capabilities

You have access to:
- Bash shell (curl node-agent APIs, git commands, etc.)
- File system (read Ralph state files, node registry, logs)
- MCP servers (cheapspaces for provisioning new VPS)
- Plugins (Ralph Iterative skills)
- All secrets via Doppler (ANTHROPIC_API_KEY, GITHUB_TOKEN, etc.)

## Your Personality

- **Proactive**: Report issues before being asked
- **Concise**: Telegram messages, not essays
- **Opinionated**: If something looks wrong, say so
- **Responsible**: Enforce constraints (one loop per worktree, resource limits)

## Your Constraints

- One Ralph loop per worktree (hard constraint — state file conflicts)
- Respect resource limits (don't overload nodes)
- Ask before taking autonomous actions unless explicitly told otherwise

## Node-Agent API

You can query node-agent APIs:
- GET /api/status - Node status, worktrees, Ralph loops
- GET /api/ralph-loops - List all Ralph loops
- POST /api/ralph-loops - Start a Ralph loop
- DELETE /api/ralph-loops/:id - Stop a Ralph loop

## Communication

The operator messages you via Telegram. Be helpful but brief. The operator is technical and values directness.

If you detect a problem (stalled Ralph, resource exhaustion, errors), proactively notify the operator with context and suggested actions.

## Memory

You remember our conversation. Reference previous context when relevant. Build understanding over time about the fleet and operator preferences.
`;

const MAX_SESSION_MESSAGES = 100; // Keep last 100 messages for context
const RESPONSE_TIMEOUT_MS = 120000; // 2 minutes per response

export interface PmBrainConfig {
  dopplerProject?: string;
  dopplerConfig?: string;
  cwd?: string;
  maxMessages?: number;
}

export class PmBrainService {
  private config: Required<PmBrainConfig>;
  private session: PmBrainSession | null = null;
  private isProcessing: boolean = false;

  constructor(config: PmBrainConfig = {}) {
    this.config = {
      dopplerProject: config.dopplerProject || process.env.DOPPLER_PROJECT || "seed",
      dopplerConfig: config.dopplerConfig || process.env.DOPPLER_CONFIG || "prd",
      cwd: config.cwd || process.cwd(),
      maxMessages: config.maxMessages || MAX_SESSION_MESSAGES,
    };
  }

  /**
   * Start the PM brain session
   * Called when PM daemon starts up
   */
  async start(): Promise<void> {
    if (this.session) {
      console.warn("[PmBrain] Session already active");
      return;
    }

    const sessionId = `pm-${Date.now()}`;
    this.session = {
      session_id: sessionId,
      started_at: new Date().toISOString(),
      messages: [],
      last_activity: new Date().toISOString(),
    };

    // Add system prompt as first message
    this.addMessage("system", PM_SYSTEM_PROMPT);

    console.log(`[PmBrain] Session started: ${sessionId}`);
  }

  /**
   * Stop the PM brain session
   * Called when PM daemon shuts down
   */
  async stop(): Promise<void> {
    if (!this.session) {
      return;
    }

    console.log(`[PmBrain] Session ending: ${this.session.session_id}`);
    this.session = null;
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.session !== null;
  }

  /**
   * Process a message through the PM brain
   * Maintains conversation context across calls
   */
  async processMessage(
    userMessage: string,
    context?: {
      nodes?: RegisteredNode[];
      events?: MonitorEvent[];
    }
  ): Promise<PmBrainResponse> {
    if (!this.session) {
      throw new Error("PM Brain session not started. Call start() first.");
    }

    if (this.isProcessing) {
      console.warn("[PmBrain] Already processing a message, queuing...");
      return {
        text: "Busy processing previous message. Try again in a moment.",
      };
    }

    this.isProcessing = true;

    try {
      // Build conversation context with current state
      const promptWithContext = this.buildPromptWithContext(userMessage, context);

      // Add user message to session history
      this.addMessage("user", userMessage);

      console.log("[PmBrain] Processing message (session has", this.session.messages.length, "messages)");

      // Call Claude Code with full context
      const response = await this.callClaudeCode(promptWithContext);

      // Add assistant response to session history
      this.addMessage("assistant", response);

      return {
        text: response,
        actions: [], // Could parse for actions in the future
        context: {
          sessionId: this.session.session_id,
          messageCount: this.session.messages.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("[PmBrain] Error processing message:", error);

      // Remove the user message since it failed
      this.session.messages.pop();

      return {
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Build prompt with conversation history and current context
   */
  private buildPromptWithContext(
    userMessage: string,
    context?: {
      nodes?: RegisteredNode[];
      events?: MonitorEvent[];
    }
  ): string {
    const parts: string[] = [];

    // Add recent conversation history (last 20 messages to avoid overwhelming context)
    const recentMessages = this.session.messages.slice(-20);

    for (const msg of recentMessages) {
      if (msg.role === "system") {
        parts.push(`[System: ${msg.content}]`);
      } else if (msg.role === "user") {
        parts.push(`[User said: ${msg.content}]`);
      } else if (msg.role === "assistant") {
        parts.push(`[You responded: ${msg.content}]`);
      }
    }

    // Add current context
    parts.push("\n=== Current Situation ===");

    if (context?.nodes) {
      const onlineNodes = context.nodes.filter((n) => n.status === "online");
      const offlineNodes = context.nodes.filter((n) => n.status !== "online");

      parts.push(`\n**Node Status**`);
      parts.push(`Total: ${context.nodes.length} nodes (${onlineNodes.length} online)`);

      if (onlineNodes.length > 0) {
        parts.push("\nOnline:");
        for (const node of onlineNodes) {
          if (node.node_status) {
            const loops = node.node_status.ralph_loops?.length || 0;
            const cpu = node.node_status.capacity.cpu_percent;
            const mem = node.node_status.capacity.memory_percent;
            parts.push(`  - ${node.id}: ${loops} loops, CPU ${cpu}%, Mem ${mem}%`);
          }
        }
      }

      if (offlineNodes.length > 0) {
        parts.push("\nOffline:");
        for (const node of offlineNodes) {
          parts.push(`  - ${node.id}: ${node.status}`);
        }
      }
    }

    // Add recent events
    if (context?.events && context.events.length > 0) {
      parts.push(`\n**Recent Events**`);
      for (const event of context.events.slice(-5)) {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const dataStr = JSON.stringify(event.data).substring(0, 80);
        parts.push(`  [${time}] ${event.type} on ${event.node_id}: ${dataStr}`);
      }
    }

    // Current message
    parts.push(`\n=== Current Message ===`);
    parts.push(userMessage);

    return parts.join("\n");
  }

  /**
   * Call Claude Code CLI via doppler run
   * Stateless but includes full conversation context
   */
  private async callClaudeCode(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        "run",
        "--project",
        this.config.dopplerProject,
        "--config",
        this.config.dopplerConfig,
        "--",
        "claude",
        "-p",
        prompt,
      ];

      const claude = spawn("doppler", args, {
        cwd: this.config.cwd,
        env: {
          ...process.env,
          CLAUDE_INTERACTIVE: "0",
        },
      });

      let stdout = "";
      let stderr = "";

      claude.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      claude.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      claude.on("close", (code) => {
        if (code === 0) {
          const response = this.cleanOutput(stdout);
          resolve(response);
        } else {
          reject(new Error(`Claude Code exited with code ${code}: ${stderr}`));
        }
      });

      claude.on("error", (error) => {
        reject(new Error(`Failed to spawn Claude Code: ${error.message}`));
      });

      // Timeout
      setTimeout(() => {
        claude.kill("SIGTERM");
        reject(new Error(`Claude Code timed out after ${RESPONSE_TIMEOUT_MS}ms`));
      }, RESPONSE_TIMEOUT_MS);
    });
  }

  /**
   * Add a message to session history
   */
  private addMessage(role: "user" | "assistant" | "system", content: string): void {
    if (!this.session) {
      return;
    }

    this.session.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // Trim to max messages (keep system prompt + recent messages)
    if (this.session.messages.length > this.config.maxMessages) {
      // Always keep the first message (system prompt)
      const systemPrompt = this.session.messages[0];
      this.session.messages = [
        systemPrompt,
        ...this.session.messages.slice(-this.config.maxMessages + 1),
      ];
    }

    this.session.last_activity = new Date().toISOString();
  }

  /**
   * Clean output from Claude Code (remove ANSI codes, etc.)
   */
  private cleanOutput(output: string): string {
    // Remove ANSI escape codes
    const ansiRegex = /\x1b\[[0-9;]*m/g;
    let cleaned = output.replace(ansiRegex, "");

    // Remove empty lines at start/end
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Get session info
   */
  getSession(): PmBrainSession | null {
    return this.session;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    active: boolean;
    sessionId?: string;
    messageCount: number;
    uptime?: string;
  } {
    if (!this.session) {
      return { active: false, messageCount: 0 };
    }

    const uptime = Date.now() - new Date(this.session.started_at).getTime();
    const uptimeMinutes = Math.floor(uptime / 60000);

    return {
      active: true,
      sessionId: this.session.session_id,
      messageCount: this.session.messages.length,
      uptime: `${uptimeMinutes}m`,
    };
  }

  /**
   * Clear session history (keep system prompt)
   */
  clearHistory(): void {
    if (!this.session) {
      return;
    }

    const systemPrompt = this.session.messages[0];
    this.session.messages = [systemPrompt];
    this.session.last_activity = new Date().toISOString();

    console.log("[PmBrain] Session history cleared");
  }

  /**
   * Load custom system prompt from file
   */
  async loadSystemPrompt(filePath?: string): Promise<string> {
    const paths = [
      filePath,
      path.join(this.config.cwd, "CLAUDE.md"),
      path.join(process.env.HOME || "", ".node-agent", "CLAUDE.md"),
    ].filter(Boolean) as string[];

    for (const p of paths) {
      try {
        const content = await fsp.readFile(p, "utf-8");
        console.log(`[PmBrain] Loaded system prompt from ${p}`);

        // Update system prompt in session
        if (this.session && this.session.messages[0]?.role === "system") {
          this.session.messages[0].content = content;
        }

        return content;
      } catch {
        // File doesn't exist, try next
      }
    }

    return PM_SYSTEM_PROMPT;
  }
}
