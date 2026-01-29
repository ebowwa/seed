// PM Brain Service
// The AI brain of the PM daemon - a persistent Claude Code session
//
// DESIGN: Simple stdin/stdout pipe to Claude Code.
// Claude handles memory, context, everything. We just deliver messages.

import { spawn } from "child_process";
import type {
  PmBrainResponse,
  MonitorEvent,
  RegisteredNode,
} from "../types/index";

const SPAWN_TIMEOUT_MS = 120000; // 2 minutes for spawned sessions

export interface PmBrainConfig {
  dopplerProject?: string;
  dopplerConfig?: string;
  cwd?: string;
}

/**
 * Manages a single persistent Claude Code process with stdin/stdout communication
 */
class PersistentClaudeSession {
  private process: ReturnType<typeof spawn> | null = null;
  private config: { dopplerProject: string; dopplerConfig: string; cwd: string };
  private stdoutBuffer: string = "";
  private isReady: boolean = false;
  private isShutdown: boolean = false;
  private pendingResolver: ((value: string) => void) | null = null;

  constructor(config: { dopplerProject: string; dopplerConfig: string; cwd: string }) {
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
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Handle stdout - collect output until we have a complete response
    this.process.stdout?.on("data", (data) => {
      this.stdoutBuffer += data.toString();

      // Check if we have a complete response (heuristic: empty line + output)
      if (this.pendingResolver && this.isResponseComplete(this.stdoutBuffer)) {
        const response = this.extractResponse(this.stdoutBuffer);
        this.pendingResolver(response);
        this.pendingResolver = null;
        this.stdoutBuffer = "";
      }
    });

    // Handle stderr (log it but don't crash)
    this.process.stderr?.on("data", (data) => {
      console.error("[Claude]", data.toString());
    });

    // Handle process exit - auto-restart if it crashes
    this.process.on("close", (code) => {
      console.log(`[PmBrain] Claude Code exited (code: ${code})`);

      if (!this.isShutdown) {
        console.log("[PmBrain] Restarting in 5 seconds...");
        setTimeout(() => this.start(), 5000);
      }

      this.process = null;
      this.isReady = false;
    });

    // Handle process error
    this.process.on("error", (error) => {
      console.error("[PmBrain] Claude Code error:", error);
    });

    // Wait for process to be ready (2 second timeout or first stdout)
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

    console.log("[PmBrain] ✓ Claude Code session running");
  }

  /**
   * Check if response appears complete
   * Heuristic: empty line + substantial output
   */
  private isResponseComplete(output: string): boolean {
    return output.includes("\n\n") && output.length > 50;
  }

  /**
   * Extract Claude's response from buffer
   */
  private extractResponse(buffer: string): string {
    // Remove ANSI escape codes
    const ansiRegex = /\x1b\[[0-9;]*m/g;
    let cleaned = buffer.replace(ansiRegex, "");
    return cleaned.trim();
  }

  /**
   * Send a message to Claude and wait for response
   */
  async sendMessage(message: string): Promise<string> {
    if (!this.process || !this.isReady) {
      throw new Error("Claude Code not ready");
    }

    console.log(`[PmBrain] → ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Timeout - return whatever we have
        const response = this.extractResponse(this.stdoutBuffer);
        this.pendingResolver = null;
        this.stdoutBuffer = "";
        resolve(response || "No response (timeout)");
      }, 60000); // 60 second timeout

      this.pendingResolver = (response: string) => {
        clearTimeout(timeout);
        console.log(`[PmBrain] ← ${response.substring(0, 100)}${response.length > 100 ? "..." : ""}`);
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
      console.log("[PmBrain] Shutting down Claude Code...");
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
  private isProcessing: boolean = false;

  constructor(config: PmBrainConfig = {}) {
    this.config = {
      dopplerProject: config.dopplerProject || process.env.DOPPLER_PROJECT || "seed",
      dopplerConfig: config.dopplerConfig || process.env.DOPPLER_CONFIG || "prd",
      cwd: config.cwd || process.cwd(),
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

    this.persistentSession = new PersistentClaudeSession({
      dopplerProject: this.config.dopplerProject,
      dopplerConfig: this.config.dopplerConfig,
      cwd: this.config.cwd,
    });

    await this.persistentSession.start();
    console.log("[PmBrain] ✓ PM brain ready");
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
    console.log("[PmBrain] PM brain stopped");
  }

  /**
   * Check if brain is running
   */
  isRunning(): boolean {
    return this.persistentSession?.isRunning() ?? false;
  }

  /**
   * Process a message through the persistent session
   * Claude Code handles all memory and context
   */
  async processMessage(
    message: string,
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
        text: "Busy processing previous message. Try again in a moment.",
      };
    }

    this.isProcessing = true;

    try {
      // Inject context into the message if provided
      let fullMessage = message;

      if (context?.nodes || context?.events) {
        fullMessage = this.injectContext(message, context);
      }

      // Send to persistent Claude process
      const responseText = await this.persistentSession.sendMessage(fullMessage);

      return {
        text: responseText,
      };
    } catch (error) {
      console.error("[PmBrain] Error:", error);
      return {
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Inject context into message (for monitor events, node status)
   */
  private injectContext(message: string, context: { nodes?: RegisteredNode[]; events?: MonitorEvent[] }): string {
    const parts: string[] = [];

    // Add node status if provided
    if (context.nodes) {
      const onlineNodes = context.nodes.filter((n) => n.status === "online");
      parts.push(`\n**Current Node Status:**`);
      parts.push(`Total: ${context.nodes.length} (${onlineNodes.length} online)`);

      if (onlineNodes.length > 0) {
        parts.push("\nOnline:");
        for (const node of onlineNodes) {
          if (node.node_status) {
            const loops = node.node_status.ralph_loops?.length || 0;
            const cpu = node.node_status.capacity.cpu_percent;
            const mem = node.node_status.capacity.memory_percent;
            parts.push(`- ${node.id}: ${loops} loops, CPU ${cpu}%, Mem ${mem}%`);
          }
        }
      }
    }

    // Add events if provided
    if (context.events && context.events.length > 0) {
      parts.push(`\n**Recent Events:**`);
      for (const event of context.events.slice(-5)) {
        const time = new Date(event.timestamp).toLocaleTimeString();
        parts.push(`- [${time}] ${event.type} on ${event.node_id}`);
      }
    }

    parts.push(`\n**Message:**`);
    parts.push(message);

    return parts.join("\n");
  }

  /**
   * Spawn a fresh Claude Code session for a one-off task
   * Returns response without affecting persistent session
   */
  async spawnWorker(prompt: string): Promise<string> {
    console.log("[PmBrain] Spawning worker Claude...");

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
   * Get session stats
   */
  getSessionStats(): {
    running: boolean;
  } {
    return {
      running: this.isRunning(),
    };
  }
}
