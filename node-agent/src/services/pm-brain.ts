// PM Brain Service
// Claude Code session manager - the AI brain of the PM daemon
//
// DESIGN: Two types of Claude Code sessions:
// 1. Persistent session: Long-running "brain" with stdin/stdout pipes
// 2. Spawned sessions: Fresh instances for one-off tasks
//
// The persistent session maintains conversation context and runs forever.
// Spawned sessions are for isolated tasks or parallel operations.

import { spawn } from "child_process";
import { EventEmitter } from "events";
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

const SPAWN_TIMEOUT_MS = 120000; // 2 minutes for spawned sessions
const MAX_SESSION_MESSAGES = 100; // Keep last 100 messages for context

export interface PmBrainConfig {
  dopplerProject?: string;
  dopplerConfig?: string;
  cwd?: string;
  maxMessages?: number;
}

/**
 * Manages a single persistent Claude Code process with stdin/stdout communication
 */
class PersistentClaudeSession extends EventEmitter {
  private process: ReturnType<typeof spawn> | null = null;
  private config: { dopplerProject: string; dopplerConfig: string; cwd: string };
  private stdoutBuffer: string = "";
  private stderrBuffer: string = "";
  private isReady: boolean = false;
  private isShutdown: boolean = false;
  private responseResolver: ((value: string) => void) | null = null;

  constructor(config: { dopplerProject: string; dopplerConfig: string; cwd: string }) {
    super();
    this.config = config;
  }

  /**
   * Start the persistent Claude Code process
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error("Persistent session already running");
    }

    console.log("[PmBrain] Starting persistent Claude Code session...");

    const args = [
      "run",
      "--project",
      this.config.dopplerProject,
      "--config",
      this.config.dopplerConfig,
      "--",
      "claude",
    ];

    this.process = spawn("doppler", args, {
      cwd: this.config.cwd,
      env: {
        ...process.env,
        CLAUDE_INTERACTIVE: "1", // Enable interactive mode
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Handle stdout
    this.process.stdout?.on("data", (data) => {
      const output = data.toString();
      this.stdoutBuffer += output;

      // Try to detect end of response (look for prompt-like patterns)
      if (this.responseResolver && this.isResponseComplete(output)) {
        const response = this.extractResponse(this.stdoutBuffer);
        this.responseResolver(response);
        this.responseResolver = null;
        this.stdoutBuffer = "";
      }

      this.emit("stdout", output);
    });

    // Handle stderr
    this.process.stderr?.on("data", (data) => {
      const output = data.toString();
      this.stderrBuffer += output;
      this.emit("stderr", output);
    });

    // Handle process exit
    this.process.on("close", (code) => {
      console.log(`[PmBrain] Claude Code process exited with code ${code}`);

      if (!this.isShutdown && code !== 0) {
        console.error("[PmBrain] Claude Code crashed, restarting...");
        setTimeout(() => this.start(), 5000);
      }

      this.process = null;
      this.isReady = false;
      this.emit("close", code);
    });

    // Handle process error
    this.process.on("error", (error) => {
      console.error("[PmBrain] Claude Code process error:", error);
      this.emit("error", error);
    });

    // Wait for process to be ready
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.isReady = true;
        resolve();
      }, 2000);

      this.process?.stdout?.once("data", () => {
        clearTimeout(timeout);
        this.isReady = true;
        resolve();
      });
    });

    console.log("[PmBrain] ✓ Persistent Claude Code session started");
  }

  /**
   * Check if the response appears complete
   * This is heuristic - Claude Code doesn't have clear end markers
   */
  private isResponseComplete(output: string): boolean {
    // Look for patterns that suggest Claude is done:
    // - Empty line followed by content
    // - No new data for a moment (handled by timeout)
    // For now, we'll use a timeout-based approach in sendMessage

    // If we see what looks like a complete response (no streaming indicator)
    // we consider it done. This is imperfect but functional.
    return output.includes("\n\n") || output.length > 100;
  }

  /**
   * Extract just Claude's response from the buffer
   */
  private extractResponse(buffer: string): string {
    // Remove ANSI codes
    const ansiRegex = /\x1b\[[0-9;]*m/g;
    let cleaned = buffer.replace(ansiRegex, "");

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Send a message to Claude and wait for response
   */
  async sendMessage(message: string): Promise<string> {
    if (!this.process || !this.isReady) {
      throw new Error("Claude Code process not ready");
    }

    console.log(`[PmBrain] Sending message to Claude (${message.length} chars)`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Timeout - return whatever we have
        const response = this.extractResponse(this.stdoutBuffer);
        this.responseResolver = null;
        this.stdoutBuffer = "";
        resolve(response || "No response (timeout)");
      }, 60000); // 60 second timeout

      this.responseResolver = (response: string) => {
        clearTimeout(timeout);
        resolve(response);
      };

      // Write to stdin
      this.process?.stdin.write(message + "\n");
    });
  }

  /**
   * Shutdown the persistent session
   */
  async shutdown(): Promise<void> {
    this.isShutdown = true;

    if (this.process) {
      console.log("[PmBrain] Shutting down Claude Code process...");
      this.process.kill("SIGTERM");

      // Wait up to 5 seconds for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          this.process?.kill("SIGKILL");
          resolve();
        }, 5000);

        this.process?.once("close", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }

  /**
   * Check if process is running
   */
  isRunning(): boolean {
    return this.process !== null && this.isReady;
  }
}

export class PmBrainService {
  private config: Required<PmBrainConfig>;
  private persistentSession: PersistentClaudeSession | null = null;
  private conversationHistory: PmBrainMessage[] = [];
  private isProcessing: boolean = false;
  private sessionStartId: string | null = null;
  private sessionStartTime: string | null = null;

  constructor(config: PmBrainConfig = {}) {
    this.config = {
      dopplerProject: config.dopplerProject || process.env.DOPPLER_PROJECT || "seed",
      dopplerConfig: config.dopplerConfig || process.env.DOPPLER_CONFIG || "prd",
      cwd: config.cwd || process.cwd(),
      maxMessages: config.maxMessages || MAX_SESSION_MESSAGES,
    };
  }

  /**
   * Start the PM brain with persistent Claude Code session
   */
  async start(): Promise<void> {
    if (this.persistentSession) {
      console.warn("[PmBrain] Already started");
      return;
    }

    this.sessionStartId = `pm-${Date.now()}`;
    this.sessionStartTime = new Date().toISOString();
    this.conversationHistory = [];

    // Add system prompt as first message
    this.conversationHistory.push({
      role: "system",
      content: PM_SYSTEM_PROMPT,
      timestamp: this.sessionStartTime,
    });

    // Start the persistent session
    this.persistentSession = new PersistentClaudeSession({
      dopplerProject: this.config.dopplerProject,
      dopplerConfig: this.config.dopplerConfig,
      cwd: this.config.cwd,
    });

    await this.persistentSession.start();

    console.log(`[PmBrain] ✓ PM brain session started: ${this.sessionStartId}`);
  }

  /**
   * Stop the PM brain
   */
  async stop(): Promise<void> {
    if (!this.persistentSession) {
      return;
    }

    await this.persistentSession.shutdown();
    this.persistentSession = null;
    this.sessionStartId = null;
    this.sessionStartTime = null;
    this.conversationHistory = [];

    console.log("[PmBrain] PM brain session ended");
  }

  /**
   * Check if brain is running
   */
  isRunning(): boolean {
    return this.persistentSession?.isRunning() ?? false;
  }

  /**
   * Process a message through the persistent session
   * Maintains conversation context
   */
  async processMessage(
    userMessage: string,
    context?: {
      nodes?: RegisteredNode[];
      events?: MonitorEvent[];
    }
  ): Promise<PmBrainResponse> {
    if (!this.persistentSession) {
      throw new Error("PM brain not started. Call start() first.");
    }

    if (this.isProcessing) {
      return {
        text: "Busy processing previous message.",
      };
    }

    this.isProcessing = true;

    try {
      // Build full prompt with context
      const fullPrompt = this.buildPromptWithContext(userMessage, context);

      // Add user message to history
      this.conversationHistory.push({
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      });

      console.log("[PmBrain] Processing message via persistent session...");

      // Send to persistent Claude process
      const responseText = await this.persistentSession.sendMessage(fullPrompt);

      // Add assistant response to history
      this.conversationHistory.push({
        role: "assistant",
        content: responseText,
        timestamp: new Date().toISOString(),
      });

      // Trim history
      this.trimHistory();

      return {
        text: responseText,
        context: {
          sessionId: this.sessionStartId || undefined,
          messageCount: this.conversationHistory.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("[PmBrain] Error processing message:", error);

      // Remove the user message since it failed
      this.conversationHistory.pop();

      return {
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Spawn a fresh Claude Code session for a one-off task
   * Returns response without affecting persistent session history
   */
  async spawnWorker(prompt: string): Promise<string> {
    console.log("[PmBrain] Spawning worker Claude for one-off task...");

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
          // Clean output
          const ansiRegex = /\x1b\[[0-9;]*m/g;
          const cleaned = stdout.replace(ansiRegex, "").trim();
          resolve(cleaned);
        } else {
          reject(new Error(`Worker exited with code ${code}: ${stderr}`));
        }
      });

      claude.on("error", (error) => {
        reject(new Error(`Failed to spawn worker: ${error.message}`));
      });

      setTimeout(() => {
        claude.kill("SIGTERM");
        reject(new Error("Worker timed out"));
      }, SPAWN_TIMEOUT_MS);
    });
  }

  /**
   * Spawn multiple workers in parallel
   */
  async spawnWorkers(prompts: string[]): Promise<string[]> {
    console.log(`[PmBrain] Spawning ${prompts.length} parallel workers...`);
    return Promise.all(prompts.map((p) => this.spawnWorker(p)));
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

    // Add recent conversation history (last 20 messages)
    const recentHistory = this.conversationHistory.slice(-20);

    if (recentHistory.length > 0) {
      parts.push("## Conversation History");
      for (const msg of recentHistory) {
        if (msg.role === "system") {
          parts.push(`[System instructions: See initial prompt]`);
        } else if (msg.role === "user") {
          parts.push(`[User: ${msg.content}]`);
        } else if (msg.role === "assistant") {
          // Truncate very long responses
          const content = msg.content.length > 200
            ? msg.content.substring(0, 200) + "..."
            : msg.content;
          parts.push(`[You: ${content}]`);
        }
      }
      parts.push("");
    }

    // Add current context
    parts.push("## Current Situation");

    if (context?.nodes) {
      const onlineNodes = context.nodes.filter((n) => n.status === "online");
      parts.push(`\n**Node Status**`);
      parts.push(`Total: ${context.nodes.length} (${onlineNodes.length} online)`);

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
    }

    if (context?.events && context.events.length > 0) {
      parts.push(`\n**Recent Events**`);
      for (const event of context.events.slice(-5)) {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const dataStr = JSON.stringify(event.data).substring(0, 60);
        parts.push(`  [${time}] ${event.type} on ${event.node_id}: ${dataStr}...`);
      }
    }

    // Current message
    parts.push(`\n## Current Message`);
    parts.push(userMessage);

    return parts.join("\n");
  }

  /**
   * Trim conversation history to max messages (preserve system prompt)
   */
  private trimHistory(): void {
    if (this.conversationHistory.length <= this.config.maxMessages) {
      return;
    }

    // Always keep first message (system prompt)
    const systemPrompt = this.conversationHistory[0];
    this.conversationHistory = [
      systemPrompt,
      ...this.conversationHistory.slice(-this.config.maxMessages + 1),
    ];
  }

  /**
   * Get session info
   */
  getSession(): PmBrainSession | null {
    if (!this.sessionStartId) {
      return null;
    }

    return {
      session_id: this.sessionStartId,
      started_at: this.sessionStartTime || new Date().toISOString(),
      messages: this.conversationHistory,
      last_activity: new Date().toISOString(),
    };
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    running: boolean;
    sessionId?: string;
    messageCount: number;
    uptime?: string;
  } {
    if (!this.sessionStartId) {
      return { running: false, messageCount: 0 };
    }

    const uptime = this.sessionStartTime
      ? Date.now() - new Date(this.sessionStartTime).getTime()
      : 0;
    const uptimeMinutes = Math.floor(uptime / 60000);

    return {
      running: this.isRunning(),
      sessionId: this.sessionStartId,
      messageCount: this.conversationHistory.length,
      uptime: `${uptimeMinutes}m`,
    };
  }

  /**
   * Clear conversation history (keep system prompt)
   */
  clearHistory(): void {
    const systemPrompt = this.conversationHistory[0];
    this.conversationHistory = systemPrompt ? [systemPrompt] : [];
    console.log("[PmBrain] Conversation history cleared");
  }

  /**
   * Load custom system prompt
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

        // Update in history
        if (this.conversationHistory[0]?.role === "system") {
          this.conversationHistory[0].content = content;
        }

        return content;
      } catch {
        // File doesn't exist
      }
    }

    return PM_SYSTEM_PROMPT;
  }
}
