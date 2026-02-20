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
//   │  │              GLMClient (@ebowwa/ai)                   │  │
//   │  │  • GLM 4.7 API                                       │  │
//   │  │  • Tool calling with builtin tools                   │  │
//   │  │  • Conversation memory for context                   │  │
//   │  └──────────────────────────────────────────────────────┘  │
//   │                                                             │
//   │  • processMessage() - Handle Telegram messages with GLM   │
//   │  • spawnWorker() - One-off GLM queries                    │
//   │  • Tool output sent to Telegram (unless quiet mode)       │
//   └─────────────────────────────────────────────────────────────┘
//
// ============================================================================

import { GLMClient } from "@ebowwa/ai";
import {
  ToolExecutor,
  BUILTIN_TOOLS,
  type ToolDefinition,
} from "@ebowwa/ai/tools";
import type { ChatMessage } from "@ebowwa/codespaces-types/runtime/ai";
import type { PmBrainResponse, MonitorEvent } from "../../types/index";
import type { PmTelegramChannel } from "./telegram";
import { MCPManager, type MCPTool } from "../../lib/mcp-client.js";

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

## Tools Available

You have access to these tools - USE THEM when appropriate:
- **read_file** - Read file contents
- **write_file** - Write/create files
- **edit_file** - Edit files by replacing text
- **list_dir** - List directory contents
- **run_command** - Execute shell commands (git, system info, etc.)
- **git_status** - Check git repository status
- **system_info** - Get CPU, memory, disk, uptime
- **MCP Tools** - Additional tools from MCP servers (git-mcp, etc.)

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
  mcpConfigPath?: string; // Path to MCP config file (default: /root/.mcp.json)
}

// ============================================================================
// DaemonLayerAgentService
// ============================================================================

/**
 * Main service for managing Seed's AI brain using GLM with tool support
 */
export class DaemonLayerAgentService {
  private client: GLMClient;
  private executor: ToolExecutor;
  private config: Required<Omit<PmBrainConfig, "telegram" | "mcpConfigPath">> & {
    telegram?: PmTelegramChannel;
    mcpConfigPath?: string;
  };
  private isProcessing: boolean = false;
  private lastUserMessageId: number | null = null;
  private conversationHistory: ChatMessage[] = [];
  private mcpManager: MCPManager | null = null;
  private mcpTools: ToolDefinition[] = [];

  constructor(config: PmBrainConfig = {}) {
    this.config = {
      model: config.model || "glm-4.7",
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
      telegram: config.telegram,
      mcpConfigPath: config.mcpConfigPath || "/root/.mcp.json",
    };

    this.client = new GLMClient();
    // Executor will be initialized with all tools (builtin + MCP) in start()
    this.executor = new ToolExecutor(this.client, [...BUILTIN_TOOLS]);
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

    // Start MCP servers if configured
    const mcpConfigPath = this.config.mcpConfigPath;
    if (mcpConfigPath) {
      try {
        await this.loadMCPServers(mcpConfigPath);
      } catch (error) {
        console.error("[Seed] Failed to load MCP servers:", error);
        console.log("[Seed] Continuing with builtin tools only...");
      }
    }

    const allTools = [...BUILTIN_TOOLS, ...this.mcpTools];
    console.log("[Seed] ✓ Seed brain ready with tools:", allTools.map((t) => t.name).join(", "));
  }

  /**
   * Stop the Seed brain
   */
  async stop(): Promise<void> {
    console.log("[Seed] Seed brain stopped");

    // Stop MCP servers
    if (this.mcpManager) {
      await this.mcpManager.stopAll();
      this.mcpManager = null;
    }
  }

  /**
   * Check if brain is running
   */
  isRunning(): boolean {
    return true; // GLM client is always ready
  }

  /**
   * Process a message through GLM agent with tool support
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

      // Build messages with conversation history
      const messages: ChatMessage[] = [
        ...this.conversationHistory.slice(-10),
        { role: "user", content: fullMessage },
      ];

      // Execute with tools using ToolExecutor
      const result = await this.executor.executeWithTools(messages, {
        systemPrompt: SEED_PROMPT,
        maxIterations: 5,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        logger: (msg: string) => {
          console.log(`[Seed] ${msg}`);
          // Also send to Telegram unless quiet
          void this.sendToolOutput(msg);
        },
      });

      // Send tool outputs to Telegram if not quiet
      if (result.toolCalls.length > 0) {
        for (const toolCall of result.toolCalls) {
          const toolName = toolCall.function.name;
          const results = result.toolResults.get(toolName) || [];
          const lastResult = results[results.length - 1];
          if (lastResult) {
            await this.sendToolOutput(
              `📤 ${lastResult.slice(0, 500)}${lastResult.length > 500 ? "..." : ""}`
            );
          }
        }
      }

      // Update conversation history
      this.conversationHistory.push({ role: "user", content: fullMessage });
      this.conversationHistory.push({ role: "assistant", content: result.content });

      // Keep history bounded
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      return {
        text: result.content,
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
   * Send tool output to Telegram (respects quiet mode)
   */
  private async sendToolOutput(text: string): Promise<void> {
    if (!this.config.telegram) return;

    // Check quiet mode
    const { isQuiet } = await import("@ebowwa/channel-telegram");
    if (isQuiet()) return;

    try {
      await this.config.telegram.sendText(text);
    } catch (error) {
      console.error("[Seed] Failed to send tool output:", error);
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
   * Spawn a one-off GLM query (no memory persistence, no tools)
   */
  async spawnWorker(prompt: string): Promise<string> {
    console.log("[Seed] Spawning GLM worker...");

    const response = await this.client.chatCompletion(
      [
        { role: "system", content: SEED_PROMPT },
        { role: "user", content: prompt },
      ],
      {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      }
    );

    return response.choices[0]?.message?.content || "";
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
      memoryLength: this.conversationHistory.length,
    };
  }

  /**
   * Load MCP servers from config file
   */
  private async loadMCPServers(configPath: string): Promise<void> {
    console.log("[Seed] Loading MCP servers from:", configPath);

    // Check if config file exists
    const fs = await import("fs/promises");
    try {
      await fs.access(configPath);
    } catch (error) {
      console.log("[Seed] MCP config file not found, skipping MCP loading");
      return;
    }

    // Create MCP manager from config
    this.mcpManager = await MCPManager.fromConfig(configPath);

    // Start all MCP servers
    await this.mcpManager.startAll();

    // Discover tools from all servers
    await this.mcpManager.discoverTools();

    // Convert MCP tools to ToolDefinition format
    this.mcpTools = this.convertMCPTools(this.mcpManager.getAllTools());

    // Update executor with all tools
    this.executor = new ToolExecutor(this.client, [
      ...BUILTIN_TOOLS,
      ...this.mcpTools,
    ]);

    console.log(`[Seed] Loaded ${this.mcpTools.length} MCP tools`);
  }

  /**
   * Convert MCP tools to ToolDefinition format
   */
  private convertMCPTools(mcpTools: MCPTool[]): ToolDefinition[] {
    return mcpTools.map((mcpTool) => ({
      name: mcpTool.name,
      description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
      parameters: mcpTool.inputSchema as ToolDefinition["parameters"],
      handler: async (args: Record<string, unknown>) => {
        if (!this.mcpManager) {
          throw new Error("MCP manager not initialized");
        }

        const result = await this.mcpManager.callTool(mcpTool.name, args);

        // Handle different result formats
        if (typeof result === "string") {
          return result;
        }

        if (result && typeof result === "object") {
          // Handle content array format from MCP spec
          if ("content" in result && Array.isArray(result.content)) {
            return result.content
              .map((item: unknown) => {
                if (typeof item === "string") return item;
                if (typeof item === "object" && item !== null) {
                  if ("text" in item) return (item as { text: string }).text;
                  return JSON.stringify(item);
                }
                return String(item);
              })
              .join("\n");
          }

          return JSON.stringify(result, null, 2);
        }

        return String(result ?? "");
      },
    }));
  }
}
