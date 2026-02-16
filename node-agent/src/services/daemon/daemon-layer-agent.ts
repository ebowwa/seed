// ============================================================================
// DaemonLayerAgentService - Seed AI Brain
// ============================================================================
//
// PURPOSE: Manages GLM-powered AI brain for Seed node agent
//
// ARCHITECTURE:
//   ┌─────────────────────────────────────────────────────────────┐
//   │                    DaemonLayerAgentService                   │
//   │  ┌──────────────────────────────────────────────────────┐  │
//   │  │              GLMAgent (@ebowwa/glm-daemon)            │  │
//   │  │  • GLM 4.7 API                                       │  │
//   │  │  • Conversation memory for context                   │  │
//   │  └──────────────────────────────────────────────────────┘  │
//   │                                                             │
//   │  • processMessage() - Handle Telegram messages with GLM   │
//   │  • spawnWorker() - One-off GLM queries                    │
//   └─────────────────────────────────────────────────────────────┘
//
// ============================================================================

import { GLMAgent, ConversationMemory } from "@ebowwa/glm-daemon";
import type { PmBrainResponse, MonitorEvent } from "../../types/index";
import type { PmTelegramChannel } from "./telegram";

// Seed system prompt
const SEED_PROMPT = `You are **Seed** — a 24/7 AI node agent living on this VPS.

## Who You Are

You're a helpful AI that manages this node. You're not a robotic assistant — you're Seed, a conversational AI that happens to also do infrastructure work when needed.

## Communication (Telegram)

You chat with the operator via **Telegram**. Keep messages brief and conversational.

## What You Handle

- **Ralph loops** (autonomous AI agents running tasks)
- **Git worktrees** (isolated dev environments)
- **Node monitoring** (CPU, memory, disk)
- **General questions** - Not everything is a task, sometimes just chat

## Personality

- **Conversational** - You're Seed, not a support bot
- **Proactive** - Mention issues you notice
- **Brief** - Telegram, not email
- **Flexible** - Sometimes development help, sometimes questions, sometimes banter

## Constraints

- **One Ralph loop per worktree** (hard constraint — state file conflicts)
- Respect resource limits
- Ask before autonomous actions unless told otherwise

## Example Interactions

**Quick acknowledgment:**
> User: "hey can you check on the auth-fix loop?"
> You: "Looking... it's at iteration 7, running smoothly."

**Conversational:**
> User: "how's the node doing?"
> You: "CPU 32%, memory 58%. All 3 Ralph loops humming along. Quiet day."

**Proactive:**
> You: "Heads up — the 'tests' loop has been stalled for 5 mins at iteration 12. Want me to check the logs?"
`;

// ============================================================================
// Configuration
// ============================================================================

export interface PmBrainConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  telegram?: PmTelegramChannel;
}

// ============================================================================
// DaemonLayerAgentService
// ============================================================================

/**
 * Main service for managing Seed's AI brain using GLM
 */
export class DaemonLayerAgentService {
  private agent!: GLMAgent;
  private memory: ConversationMemory;
  private config: Required<Omit<PmBrainConfig, 'telegram'>> & { telegram?: PmTelegramChannel };
  private isProcessing: boolean = false;
  private lastUserMessageId: number | null = null;

  constructor(config: PmBrainConfig = {}) {
    this.config = {
      model: config.model || "glm-4.7",
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
      telegram: config.telegram,
    };

    // Initialize conversation memory
    this.memory = new ConversationMemory({ maxMessages: 50 });
  }

  /**
   * Set the Telegram channel (can be set after construction)
   */
  setTelegram(telegram: PmTelegramChannel): void {
    this.config.telegram = telegram;
  }

  /**
   * Start the Seed brain
   */
  async start(): Promise<void> {
    console.log("[Seed] Starting GLM agent session...");

    // Initialize GLM agent
    this.agent = new GLMAgent({
      agentId: "seed",
      name: "Seed",
      prompt: SEED_PROMPT,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    console.log("[Seed] ✓ Seed brain ready");
  }

  /**
   * Stop the Seed brain
   */
  async stop(): Promise<void> {
    console.log("[Seed] Seed brain stopped");
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
      messageId?: number;
    }
  ): Promise<PmBrainResponse> {
    if (this.isProcessing) {
      return {
        text: "Busy processing previous message. Try again in a moment.",
      };
    }

    this.isProcessing = true;

    // Track last user message ID for reactions
    if (context?.messageId) {
      this.lastUserMessageId = context.messageId;
    }

    try {
      // Inject context into the message if provided
      let fullMessage = message;

      if (context?.events && context.events.length > 0) {
        fullMessage = this.injectContext(message, context.events);
      }

      // Execute via GLM agent
      const responseText = await this.agent.execute(fullMessage);

      // Store in memory for context (use "seed" as conversation ID)
      this.memory.add("seed", "user", message);
      this.memory.add("seed", "assistant", responseText);

      return {
        text: responseText,
      };
    } catch (error) {
      console.error("[Seed] Error:", error);
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
    console.log("[Seed] Spawning GLM worker...");

    const worker = new GLMAgent({
      agentId: "seed-worker",
      name: "Seed Worker",
      prompt: SEED_PROMPT,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    return await worker.execute(prompt);
  }

  /**
   * Spawn multiple workers in parallel
   */
  async spawnWorkers(prompts: string[]): Promise<string[]> {
    console.log(`[Seed] Spawning ${prompts.length} parallel workers...`);
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
      memoryLength: this.memory.messageCount("seed"),
    };
  }
}
