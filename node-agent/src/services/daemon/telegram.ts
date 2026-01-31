// Telegram Bot API Client Service
// Implements long-polling for inbound messages, sendMessage for outbound
// Based on clawdbot's exponential backoff approach for error handling

import type {
  TelegramUpdate,
  TelegramMessage,
  TelegramSendMessageParams,
  PmCommand,
} from "../types/index";

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

// TODO: Add command history (/!, /!n to recall previous commands)
// TODO: Add conversation modes (verbose/brief/monitor)
export class TelegramService {
  private token: string;
  private allowedChatId: number;
  private apiUrl: string;
  private offset: number = 0;
  private isPolling: boolean = false;
  private currentBackoff: number = INITIAL_BACKOFF_MS;

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

    // Load offset from file if exists
    this.loadOffset();
  }

  /**
   * Load the last processed update_id from disk
   */
  private async loadOffset(): Promise<void> {
    try {
      const { promises: fsp } = await import("fs");
      const offsetData = await fsp.readFile(OFFSET_FILE_PATH, "utf-8");
      this.offset = parseInt(offsetData.trim(), 10);
      console.log(`[TelegramService] Loaded offset: ${this.offset}`);
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
      console.error("[TelegramService] Failed to save offset:", error);
    }
  }

  /**
   * Calculate backoff with jitter (mirrors clawdbot's approach)
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

    const data = await response.json() as { ok: boolean; result: T; description?: string };

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

  // TODO: Add inline keyboard support for interactive buttons
  // TODO: Add editMessageText() for updating existing messages
  // TODO: Add answerCallbackQuery() for button click handling
  /**
   * Send a message to Telegram
   */
  async sendMessage(params: TelegramSendMessageParams): Promise<TelegramMessage> {
    // Validate chat_id is allowed
    if (params.chat_id !== this.allowedChatId) {
      throw new Error(`Chat ID ${params.chat_id} is not in the allowlist`);
    }

    const result = await this.apiRequest<{ message: TelegramMessage }>(
      "sendMessage",
      {
        chat_id: params.chat_id,
        text: params.text,
        parse_mode: params.parse_mode,
        disable_web_page_preview: params.disable_web_page_preview,
        reply_to_message_id: params.reply_to_message_id,
      }
    );

    return result as unknown as TelegramMessage;
  }

  /**
   * Send a text message to the allowed chat
   */
  async sendText(text: string, options?: Partial<TelegramSendMessageParams>): Promise<TelegramMessage> {
    return this.sendMessage({
      chat_id: this.allowedChatId,
      text,
      parse_mode: options?.parse_mode || "Markdown",
      disable_web_page_preview: options?.disable_web_page_preview ?? true,
      reply_to_message_id: options?.reply_to_message_id,
    });
  }

  // TODO: Handle callback_query for inline keyboard interactions
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

  // TODO: Support streaming responses for long-running operations
  /**
   * Start polling for updates (long polling)
   */
  async startPolling(options: TelegramPollOptions): Promise<void> {
    if (this.isPolling) {
      throw new Error("Polling is already active");
    }

    this.isPolling = true;
    let errorCount = 0;

    console.log("[TelegramService] Starting long-polling loop");

    while (this.isPolling) {
      // Check for abort signal
      if (options.signal?.aborted) {
        console.log("[TelegramService] Polling aborted");
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
          `[TelegramService] Error polling (attempt ${errorCount}), retrying in ${Math.round(backoff / 1000)}s:`,
          error
        );

        await this.sleep(backoff);
      }
    }

    this.isPolling = false;
    console.log("[TelegramService] Polling stopped");
  }

  /**
   * Stop polling for updates
   */
  stopPolling(): void {
    this.isPolling = false;
    console.log("[TelegramService] Polling stop requested");
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
  async testConnection(): Promise<{ ok: boolean; bot: { id: number; name: string; username: string } | null; error?: string }> {
    try {
      const result = await this.apiRequest<{ id: number; first_name: string; username: string }>("getMe");
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
}
