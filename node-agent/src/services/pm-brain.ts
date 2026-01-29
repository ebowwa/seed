// PM Brain Service
// Claude Code session manager - the AI brain of the PM daemon
//
// DESIGN NOTE: This implementation uses the doppler subprocess approach
// (spawn `doppler run -- claude`) rather than the ClaudeAgentClient SDK.
//
// Rationale:
// - The ClaudeAgentClient lives in com.hetzner.codespaces (a separate project)
// - Setting up workspace dependencies would require monorepo restructuring
// - The doppler subprocess approach is simple, works, and inherits all secrets
// - Performance is acceptable for PM daemon use case (low message volume)
//
// Future enhancement: If message volume increases, consider:
// - Extracting ClaudeAgentClient to a shared npm package
// - Setting up workspace dependencies with bun
// - Using persistent Claude Code sessions instead of per-message spawns

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
`;

const SESSION_TIMEOUT_MS = 300000; // 5 minutes
const MAX_SESSION_MESSAGES = 50;

export interface PmBrainConfig {
  dopplerProject?: string;
  dopplerConfig?: string;
  cwd?: string;
  sessionTimeout?: number;
  maxMessages?: number;
}

export class PmBrainService {
  private config: Required<PmBrainConfig>;
  private currentSession: PmBrainSession | null = null;
  private sessionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: PmBrainConfig = {}) {
    this.config = {
      dopplerProject: config.dopplerProject || process.env.DOPPLER_PROJECT || "seed",
      dopplerConfig: config.dopplerConfig || process.env.DOPPLER_CONFIG || "prd",
      cwd: config.cwd || process.cwd(),
      sessionTimeout: config.sessionTimeout || SESSION_TIMEOUT_MS,
      maxMessages: config.maxMessages || MAX_SESSION_MESSAGES,
    };
  }

  /**
   * Process a message through the PM brain
   * For MVP: Spawn a new Claude Code session per message via doppler run
   */
  async processMessage(
    message: string,
    context?: {
      nodes?: RegisteredNode[];
      events?: MonitorEvent[];
    }
  ): Promise<PmBrainResponse> {
    // Build the full prompt with context
    const fullPrompt = this.buildPrompt(message, context);

    console.log("[PmBrain] Processing message via Claude Code...");

    try {
      // Spawn Claude Code via doppler run
      const response = await this.spawnClaudeCode(fullPrompt);

      return {
        text: response,
        actions: [], // Could parse for actions in the future
        context: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("[PmBrain] Error processing message:", error);
      return {
        text: `Error processing message: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Build the full prompt with system prompt and context
   */
  private buildPrompt(
    userMessage: string,
    context?: {
      nodes?: RegisteredNode[];
      events?: MonitorEvent[];
    }
  ): string {
    const parts: string[] = [PM_SYSTEM_PROMPT];

    // Add node context
    if (context?.nodes) {
      const onlineNodes = context.nodes.filter((n) => n.status === "online");
      const offlineNodes = context.nodes.filter((n) => n.status !== "online");

      parts.push("\n## Current Node Status");
      parts.push(`Total nodes: ${context.nodes.length} (${onlineNodes.length} online)`);

      if (onlineNodes.length > 0) {
        parts.push("\nOnline nodes:");
        for (const node of onlineNodes) {
          if (node.node_status) {
            const loops = node.node_status.ralph_loops?.length || 0;
            const cpu = node.node_status.capacity.cpu_percent;
            const mem = node.node_status.capacity.memory_percent;
            parts.push(`- ${node.id}: ${loops} loops, CPU ${cpu}%, Mem ${mem}%`);
          }
        }
      }

      if (offlineNodes.length > 0) {
        parts.push("\nOffline nodes:");
        for (const node of offlineNodes) {
          parts.push(`- ${node.id}: ${node.status}`);
        }
      }
    }

    // Add recent events context
    if (context?.events && context.events.length > 0) {
      parts.push("\n## Recent Events");
      for (const event of context.events.slice(-5)) {
        const time = new Date(event.timestamp).toLocaleTimeString();
        parts.push(`- [${time}] ${event.type} on ${event.node_id}: ${JSON.stringify(event.data).substring(0, 100)}`);
      }
    }

    parts.push("\n## User Message");
    parts.push(userMessage);

    return parts.join("\n\n");
  }

  /**
   * Spawn Claude Code via doppler run and get response
   * This is the MVP approach - simple, stateless per-message
   */
  private async spawnClaudeCode(prompt: string): Promise<string> {
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

      console.log("[PmBrain] Spawning: doppler", args.join(" "));

      const claude = spawn("doppler", args, {
        cwd: this.config.cwd,
        env: {
          ...process.env,
          // Ensure Claude Code knows it's running non-interactively
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
          // Extract just the Claude response (strip ANSI codes, etc.)
          const response = this.cleanOutput(stdout);
          resolve(response);
        } else {
          reject(new Error(`Claude Code exited with code ${code}: ${stderr}`));
        }
      });

      claude.on("error", (error) => {
        reject(new Error(`Failed to spawn Claude Code: ${error.message}`));
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        claude.kill("SIGTERM");
        reject(new Error("Claude Code timed out after 2 minutes"));
      }, 120000);
    });
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
   * Start a persistent PM brain session (future feature)
   * This would maintain conversation context across messages
   */
  async startSession(): Promise<void> {
    if (this.currentSession) {
      console.warn("[PmBrain] Session already active");
      return;
    }

    const sessionId = `pm-${Date.now()}`;
    this.currentSession = {
      session_id: sessionId,
      started_at: new Date().toISOString(),
      messages: [],
      last_activity: new Date().toISOString(),
    };

    console.log(`[PmBrain] Started session: ${sessionId}`);

    // Reset session timeout
    this.resetSessionTimer();
  }

  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }

    if (this.currentSession) {
      console.log(`[PmBrain] Ended session: ${this.currentSession.session_id}`);
      this.currentSession = null;
    }
  }

  /**
   * Reset the session timeout timer
   */
  private resetSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    this.sessionTimer = setTimeout(() => {
      console.log("[PmBrain] Session timed out, ending session");
      this.endSession();
    }, this.config.sessionTimeout);
  }

  /**
   * Add a message to the session history
   */
  private addMessageToSession(role: "user" | "assistant" | "system", content: string): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // Trim old messages if over limit
    if (this.currentSession.messages.length > this.config.maxMessages) {
      this.currentSession.messages = this.currentSession.messages.slice(-this.config.maxMessages);
    }

    this.currentSession.last_activity = new Date().toISOString();
    this.resetSessionTimer();
  }

  /**
   * Get the current session info
   */
  getSession(): PmBrainSession | null {
    return this.currentSession;
  }

  /**
   * Load a custom system prompt from a file
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
        return content;
      } catch {
        // File doesn't exist, try next
      }
    }

    // Return default prompt
    return PM_SYSTEM_PROMPT;
  }
}
