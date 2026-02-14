/**
 * Telegram Channel Adapter for Node Agent
 *
 * Implements ChannelConnector from @ebowwa/channel-types.
 * Adds specialized features: offset persistence, exponential backoff.
 */

import type {
  TelegramUpdate,
  TelegramMessage,
  TelegramSendMessageParams,
  PmCommand,
} from "@ebowwa/codespaces-types/compile";
import {
  type ChannelConnector,
  type ChannelId,
  type ChannelMessage,
  type ChannelResponse,
  type ChannelCapabilities,
  type MessageHandler,
  type MessageSender,
  type MessageContext,
  createChannelId,
} from "@ebowwa/channel-types";

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = parseInt(process.env.TELEGRAM_CHAT_ID || "", 10);
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const OFFSET_FILE_PATH = `${process.env.HOME || ""}/.node-agent/telegram-offset`;

// Polling configuration
const POLL_TIMEOUT = 30; // seconds - long poll timeout
const MAX_BACKOFF_MS = 30000; // 30 seconds max backoff
const INITIAL_BACKOFF_MS = 2000; // 2 seconds initial backoff
const BACKOFF_MULTIPLIER = 1.8;
const JITTER_PERCENT = 0.25; // 25% jitter

export interface TelegramPollOptions {
  onUpdate: (update: TelegramUpdate) => Promise<void>;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

/**
 * TelegramChannel - Implements ChannelConnector for Node Agent
 *
 * Features:
 * - Long polling with exponential backoff
 * - Offset persistence for crash recovery
 * - Normalized ChannelMessage format
 */
export class TelegramChannel implements ChannelConnector {
  readonly id: ChannelId;
  readonly label = "Telegram (Node Agent)";
  readonly capabilities: ChannelCapabilities = {
    supports: {
      text: true,
      media: true,
      replies: true,
      threads: false,
      reactions: false,
      editing: true,
      streaming: false,
    },
    media: {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      supportedMimeTypes: ["image/*", "video/*", "audio/*", "application/pdf"],
    },
    rateLimits: {
      messagesPerMinute: 30,
      charactersPerMessage: 4096,
    },
  };

  private token: string;
  private allowedChatId: number;
  private apiUrl: string;
  private offset: number = 0;
  private isPolling: boolean = false;
  private currentBackoff: number = INITIAL_BACKOFF_MS;
  private connected: boolean = false;
  private messageHandler?: MessageHandler;

  constructor() {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is required");
    }
    if (!TELEGRAM_CHAT_ID) {
      throw new Error("TELEGRAM_CHAT_ID is required");
    }

    this.token = TELEGRAM_BOT_TOKEN;
    this.allowedChatId = TELEGRAM_CHAT_ID;
    this.apiUrl = TELEGRAM_API_URL;
    this.id = createChannelId("telegram", TELEGRAM_CHAT_ID.toString());

    // Load offset from file if exists
    this.loadOffset();
  }

  // ============================================================
  // ChannelConnector Interface Implementation
  // ============================================================

  /**
   * Start the channel (begin polling)
   */
  async start(): Promise<void> {
    await this.startPolling({
      onUpdate: async (update: TelegramUpdate) => {
        if (update.message && this.messageHandler) {
          const channelMessage = this.createChannelMessage(update.message);
          await this.messageHandler(channelMessage);
        }
      },
      onError: (error: Error) => {
        console.error("[TelegramChannel] Polling error:", error);
      },
    });
    this.connected = true;
  }

  /**
   * Stop the channel
   */
  async stop(): Promise<void> {
    this.stopPolling();
    this.connected = false;
  }

  /**
   * Register message handler
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Send response to Telegram
   */
  async send(response: ChannelResponse): Promise<void> {
    const chatId = parseInt(response.replyTo.channelId.accountId, 10);
    if (isNaN(chatId)) {
      console.error("[TelegramChannel] Invalid chat ID in response");
      return;
    }

    await this.sendText(response.content.text, {
      reply_to_message_id: response.content.replyToOriginal
        ? parseInt(response.replyTo.messageId, 10)
        : undefined,
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  // ============================================================
  // Telegram-Specific Implementation
  // ============================================================

  /**
   * Load the last processed update_id from disk
   */
  private async loadOffset(): Promise<void> {
    try {
      const { promises: fsp } = await import("fs");
      const offsetData = await fsp.readFile(OFFSET_FILE_PATH, "utf-8");
      this.offset = parseInt(offsetData.trim(), 10);
      console.log(`[TelegramChannel] Loaded offset: ${this.offset}`);
    } catch {
      // File doesn't exist or is invalid, start from 0
      this.offset = 0;
    }
  }

  /**
   * Save the current offset to disk
   */
  private async saveOffset(): Promise<void> {
    try {
      const { promises: fsp } = await import("fs");
      const homeDir = process.env.HOME || "";
      await fsp.mkdir(`${homeDir}/.node-agent`, { recursive: true });
      await fsp.writeFile(OFFSET_FILE_PATH, this.offset.toString(), "utf-8");
    } catch (error) {
      console.error("[TelegramChannel] Failed to save offset:", error);
    }
  }

  /**
   * Calculate backoff with jitter
   */
  private calculateBackoff(currentAttempt: number): number {
    const baseBackoff = Math.min(
      INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, currentAttempt),
      MAX_BACKOFF_MS
    );
    const jitter = baseBackoff * JITTER_PERCENT * (Math.random() * 2 - 1);
    return Math.max(INITIAL_BACKOFF_MS, baseBackoff + jitter);
  }

  /**
   * Sleep for a specified duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make a request to the Telegram Bot API
   */
  private async apiRequest<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const url = `${this.apiUrl}/${method}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as { ok: boolean; result: T; description?: string };

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description || "Unknown error"}`);
    }

    return data.result;
  }

  /**
   * Get updates from Telegram (long polling)
   */
  private async getUpdates(timeout: number = POLL_TIMEOUT): Promise<TelegramUpdate[]> {
    try {
      const params: Record<string, unknown> = {
        timeout,
        offset: this.offset > 0 ? this.offset + 1 : undefined,
      };

      const result = await this.apiRequest<{ result: TelegramUpdate[] }>("getUpdates", params);
      return result as unknown as TelegramUpdate[];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get updates: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Send a message to Telegram
   */
  async sendMessage(params: TelegramSendMessageParams): Promise<TelegramMessage> {
    // Validate chat_id is allowed
    if (params.chat_id !== this.allowedChatId) {
      throw new Error(`Chat ID ${params.chat_id} is not in the allowlist`);
    }

    const result = await this.apiRequest<{ message: TelegramMessage }>("sendMessage", {
      chat_id: params.chat_id,
      text: params.text,
      parse_mode: params.parse_mode,
      disable_web_page_preview: params.disable_web_page_preview,
      reply_to_message_id: params.reply_to_message_id,
    });

    return result as unknown as TelegramMessage;
  }

  /**
   * Send a text message to the allowed chat
   */
  async sendText(
    text: string,
    options?: Partial<TelegramSendMessageParams>
  ): Promise<TelegramMessage> {
    return this.sendMessage({
      chat_id: this.allowedChatId,
      text,
      parse_mode: options?.parse_mode || "Markdown",
      disable_web_page_preview: options?.disable_web_page_preview ?? true,
      reply_to_message_id: options?.reply_to_message_id,
    });
  }

  /**
   * Parse a command from a Telegram message
   */
  parseCommand(message: TelegramMessage): PmCommand | null {
    // Only process messages from allowed chat
    if (message.chat.id !== this.allowedChatId) {
      return null;
    }

    const text = message.text || "";
    const parts = text.trim().split(/\s+/);
    const command = parts[0];

    // Check if it's a command (starts with /)
    if (!command.startsWith("/")) {
      return {
        command: "chat",
        args: parts,
        raw_text: text,
        chat_id: message.chat.id,
        message_id: message.message_id,
        user_id: message.from.id,
      };
    }

    // Extract command name (remove /)
    const commandName = command.slice(1);
    const args = parts.slice(1);

    return {
      command: commandName,
      args,
      raw_text: text,
      chat_id: message.chat.id,
      message_id: message.message_id,
      user_id: message.from.id,
    };
  }

  /**
   * Start polling for updates (long polling)
   */
  async startPolling(options: TelegramPollOptions): Promise<void> {
    if (this.isPolling) {
      throw new Error("Polling is already active");
    }

    this.isPolling = true;
    let errorCount = 0;

    console.log("[TelegramChannel] Starting long-polling loop");

    while (this.isPolling) {
      // Check for abort signal
      if (options.signal?.aborted) {
        console.log("[TelegramChannel] Polling aborted");
        break;
      }

      try {
        const updates = await this.getUpdates(POLL_TIMEOUT);

        // Reset backoff on success
        errorCount = 0;
        this.currentBackoff = INITIAL_BACKOFF_MS;

        for (const update of updates) {
          // Update offset
          this.offset = update.update_id;
          await this.saveOffset();

          // Process update
          await options.onUpdate(update);
        }
      } catch (error) {
        errorCount++;

        if (options.onError) {
          options.onError(error instanceof Error ? error : new Error(String(error)));
        }

        // Exponential backoff with jitter
        const backoff = this.calculateBackoff(errorCount);
        console.error(
          `[TelegramChannel] Error polling (attempt ${errorCount}), retrying in ${Math.round(backoff / 1000)}s:`,
          error
        );

        await this.sleep(backoff);
      }
    }

    this.isPolling = false;
    console.log("[TelegramChannel] Polling stopped");
  }

  /**
   * Stop polling for updates
   */
  stopPolling(): void {
    this.isPolling = false;
    console.log("[TelegramChannel] Polling stop requested");
  }

  /**
   * Get the current polling state
   */
  getPollingState(): { isPolling: boolean; offset: number } {
    return {
      isPolling: this.isPolling,
      offset: this.offset,
    };
  }

  /**
   * Test the Telegram bot connection
   */
  async testConnection(): Promise<{
    ok: boolean;
    bot: { id: number; name: string; username: string } | null;
    error?: string;
  }> {
    try {
      const result = await this.apiRequest<{ id: number; first_name: string; username: string }>(
        "getMe"
      );
      return {
        ok: true,
        bot: {
          id: result.id,
          name: result.first_name,
          username: result.username,
        },
      };
    } catch (error) {
      return {
        ok: false,
        bot: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ============================================================
  // Message Normalization
  // ============================================================

  /**
   * Create normalized ChannelMessage from Telegram message
   */
  private createChannelMessage(msg: TelegramMessage): ChannelMessage {
    const sender: MessageSender = {
      id: msg.from?.id?.toString() || msg.chat.id.toString(),
      username: msg.from?.username,
      displayName: msg.from?.first_name || msg.from?.username,
      isBot: msg.from?.is_bot || false,
    };

    const context: MessageContext = {
      isDM: msg.chat.type === "private",
      groupName: msg.chat.type !== "private" ? msg.chat.title : undefined,
    };

    return {
      messageId: msg.message_id.toString(),
      channelId: this.id,
      timestamp: new Date(msg.date * 1000),
      sender,
      text: msg.text || "",
      context,
      replyTo: msg.reply_to_message
        ? {
            messageId: msg.reply_to_message.message_id.toString(),
            channelId: this.id,
          }
        : undefined,
    };
  }
}

// Legacy export for backwards compatibility
export { TelegramChannel as TelegramService };

/**
 * Create Telegram channel config from environment
 */
export function createTelegramConfigFromEnv() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  return {
    platform: "telegram" as const,
    accountId: process.env.TELEGRAM_CHAT_ID || "default",
    botToken: token,
    allowedChatId: parseInt(process.env.TELEGRAM_CHAT_ID || "", 10),
  };
}
