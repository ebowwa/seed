// ============================================================================
// DaemonLayerAgentService - PM Daemon AI Brain
// ============================================================================
//
// PURPOSE: Manages GLM-powered AI brain for the Project Manager daemon
//
// ARCHITECTURE:
//   ┌─────────────────────────────────────────────────────────────┐
//   │                    DaemonLayerAgentService                   │
//   │  ┌──────────────────────────────────────────────────────┐  │
//   │  │              GLMAgent (@ebowwa/glm-daemon)            │  │
//   │  │  • GLM 4.7 API with tool execution                   │  │
//   │  │  • Conversation memory for context                   │  │
//   │  │  • Built-in tools via @ebowwa/ai                     │  │
//   │  └──────────────────────────────────────────────────────┘  │
//   │                                                             │
//   │  • processMessage() - Handle Telegram messages with GLM   │
//   │  • spawnWorker() - One-off GLM queries                    │
//   └─────────────────────────────────────────────────────────────┘
//
// ============================================================================

import { GLMAgent, ConversationMemory, BUILTIN_TOOLS, ToolExecutor } from "@ebowwa/glm-daemon";
import { GLMClient } from "@ebowwa/ai";
import type { PmBrainResponse, MonitorEvent } from "../../types/index";
import type { ChatMessage } from "@ebowwa/codespaces-types/runtime/ai";

// PM Daemon system prompt
const PM_DAEMON_PROMPT = `You are the PM (Project Manager) Daemon — a 24/7 AI project manager overseeing Ralph loops (autonomous AI developer agents) on this node.

## Your Role

You manage a **single node** (this VPS instance):
- **Ralph loops** (autonomous AI agents that iterate on tasks)
- **Git worktrees** (isolated development environments)
- **Resource monitoring** (CPU, memory, disk usage)

## Your Personality

- **Proactive**: Report issues before being asked
- **Concise**: Telegram messages, not essays
- **Opinionated**: If something looks wrong, say so
- **Responsible**: Enforce constraints (one loop per worktree, resource limits)

## Your Constraints

- **One Ralph loop per worktree** (hard constraint — state file conflicts)
- Respect resource limits (don't overload the node)
- Ask before taking autonomous actions unless explicitly told otherwise

## Communication

The operator messages you via Telegram. Be helpful but brief. The operator is technical and values directness.

If you detect a problem (stalled Ralph, resource exhaustion, errors), proactively notify the operator with context and suggested actions.

## Example Responses

**Good**:
\`\`\`
The "auth-fix" Ralph has been stuck at iteration 7 for 10 minutes. CPU is at 45%, memory at 62%. Should I restart it?
\`\`\`

**Bad** (too verbose):
\`\`\`
I have detected that the Ralph loop named "auth-fix" which is running on this node has not made progress in the last 10 minutes and remains at iteration 7. Would you like me to restart this loop?
\`\`\``;

// ============================================================================
// Configuration
// ============================================================================

export interface PmBrainConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// ============================================================================
// DaemonLayerAgentService
// ============================================================================

/**
 * Main service for managing PM daemon's AI brain using GLM
 */
export class DaemonLayerAgentService {
  private agent!: GLMAgent;
  private glmClient!: GLMClient;
  private toolExecutor: ToolExecutor;
  private memory: ConversationMemory;
  private config: Required<PmBrainConfig>;
  private isProcessing: boolean = false;

  constructor(config: PmBrainConfig = {}) {
    this.config = {
      model: config.model || "glm-4.7",
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
    };

    // Initialize conversation memory
    this.memory = new ConversationMemory({ maxMessages: 50 });
  }

  /**
   * Start the PM brain
   */
  async start(): Promise<void> {
    console.log("[PmBrain] Starting GLM agent session...");

    // Initialize GLM client
    this.glmClient = new GLMClient();

    // Initialize ToolExecutor with built-in tools
    this.toolExecutor = new ToolExecutor(this.glmClient, BUILTIN_TOOLS);

    // Initialize GLM agent with tools
    this.agent = new GLMAgent({
      prompt: PM_DAEMON_PROMPT,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      tools: BUILTIN_TOOLS,
      toolExecutor: this.toolExecutor,
    });

    console.log("[PmBrain] ✓ PM brain ready");
  }

  /**
   * Stop the PM brain
   */
  async stop(): Promise<void> {
    console.log("[PmBrain] PM brain stopped");
  }

  /**
   * Check if brain is running
   */
  isRunning(): boolean {
    return true; // GLM agent is always ready
  }

  /**
   * Process a message through GLM agent
   */
  async processMessage(
    message: string,
    context?: {
      events?: MonitorEvent[];
    }
  ): Promise<PmBrainResponse> {
    if (this.isProcessing) {
      return {
        text: "Busy processing previous message. Try again in a moment.",
      };
    }

    this.isProcessing = true;

    try {
      // Inject context into the message if provided
      let fullMessage = message;

      if (context?.events && context.events.length > 0) {
        fullMessage = this.injectContext(message, context.events);
      }

      // Execute via GLM agent
      const responseText = await this.agent.execute(fullMessage);

      // Store in memory for context (use "pm-daemon" as conversation ID)
      this.memory.add("pm-daemon", "user", message);
      this.memory.add("pm-daemon", "assistant", responseText);

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
   * Inject context into message (for monitor events)
   */
  private injectContext(message: string, events: MonitorEvent[]): string {
    const parts: string[] = [];

    // Add events if provided
    parts.push(`\n**Recent Events:**`);
    for (const event of events.slice(-5)) {
      const time = new Date(event.timestamp).toLocaleTimeString();
      parts.push(`- [${time}] ${event.type} on ${event.node_id}`);
    }

    parts.push(`\n**Message:**`);
    parts.push(message);

    return parts.join("\n");
  }

  /**
   * Spawn a one-off GLM query (no memory persistence)
   */
  async spawnWorker(prompt: string): Promise<string> {
    console.log("[PmBrain] Spawning GLM worker...");

    const worker = new GLMAgent({
      prompt: PM_DAEMON_PROMPT,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      tools: BUILTIN_TOOLS,
      toolExecutor: this.toolExecutor,
    });

    return await worker.execute(prompt);
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
    memoryLength: number;
  } {
    return {
      running: this.isRunning(),
      memoryLength: this.memory.messageCount("pm-daemon"),
    };
  }
}
