/**
 * Telegram Channel Adapter for Node Agent
 *
 * Wraps @ebowwa/channel-telegram with PM daemon-specific functionality.
 * - Chat allowlist security (TELEGRAM_CHAT_ID)
 * - PM command parsing for Ralph loop management
 * - Integration with DaemonLayerAgent for AI responses
 */

import {
  TelegramChannel as BaseTelegramChannel,
  type TelegramConfig,
  createTelegramConfigFromEnv as baseCreateConfig,
} from "@ebowwa/channel-telegram";

import {
  type ChannelConnector,
  type ChannelId,
  type ChannelMessage,
  type ChannelResponse,
  type ChannelCapabilities,
  type MessageHandler,
} from "@ebowwa/channel-types";

import type { PmCommand } from "../../types/index";

// Configuration from environment
const TELEGRAM_CHAT_ID = parseInt(process.env.TELEGRAM_CHAT_ID || "", 10);

/**
 * Extended Telegram config for PM daemon
 */
export interface PmTelegramConfig extends TelegramConfig {
  allowedChatId: number;
}

/**
 * Create PM Telegram config from environment
 */
export function createPmTelegramConfigFromEnv(): PmTelegramConfig | null {
  const baseConfig = baseCreateConfig();
  if (!baseConfig?.botToken) return null;

  const allowedChatId = TELEGRAM_CHAT_ID;
  if (!allowedChatId) {
    console.warn("[PmTelegram] TELEGRAM_CHAT_ID not set - no allowlist enforcement");
  }

  return {
    ...baseConfig,
    allowedChats: allowedChatId ? [allowedChatId] : undefined,
    allowedChatId,
  };
}

/**
 * PmTelegramChannel - Telegram channel with PM daemon extensions
 *
 * Wraps @ebowwa/channel-telegram with:
 * - Chat allowlist enforcement
 * - PM command parsing (/status, /loops, /start, /stop, /logs, /lanes, /health)
 * - Easy integration with DaemonLayerAgent
 */
export class PmTelegramChannel implements ChannelConnector {
  readonly id: ChannelId;
  readonly label = "Telegram (PM Daemon)";
  readonly capabilities: ChannelCapabilities = {
    supports: {
      text: true,
      media: true,
      replies: true,
      threads: false,
      reactions: true,
      editing: true,
      streaming: false,
    },
    media: {
      maxFileSize: 50 * 1024 * 1024,
      supportedMimeTypes: ["image/*", "video/*", "audio/*", "application/pdf"],
    },
    rateLimits: {
      messagesPerMinute: 30,
      charactersPerMessage: 4096,
    },
  };

  private baseChannel: BaseTelegramChannel;
  private config: PmTelegramConfig;
  private connected = false;
  private messageHandler?: MessageHandler;

  constructor(config: PmTelegramConfig) {
    this.config = config;
    this.baseChannel = new BaseTelegramChannel(config);
    this.id = this.baseChannel.id;
  }

  // ============================================================
  // ChannelConnector Interface
  // ============================================================

  async start(): Promise<void> {
    // Set up message routing through our handler
    this.baseChannel.onMessage(async (message) => {
      // Enforce chat allowlist
      if (!this.isAllowed(message)) {
        console.log(`[PmTelegram] Ignoring message from non-allowed chat/user`);
        return null;
      }

      // Route to our handler
      if (this.messageHandler) {
        return await this.messageHandler(message);
      }
      return null;
    });

    await this.baseChannel.start();
    this.connected = true;
  }

  async stop(): Promise<void> {
    await this.baseChannel.stop();
    this.connected = false;
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async send(response: ChannelResponse): Promise<void> {
    await this.baseChannel.send(response);
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ============================================================
  // PM Daemon Extensions
  // ============================================================

  /**
   * Get the underlying TelegramBot instance for advanced operations
   */
  getBot() {
    return this.baseChannel.getBot();
  }

  /**
   * Get conversation memory
   */
  getMemory() {
    return this.baseChannel.getMemory();
  }

  /**
   * Send text message to the allowed chat
   */
  async sendText(
    text: string,
    options?: {
      parse_mode?: "Markdown" | "HTML";
      reply_to_message_id?: number;
    }
  ): Promise<void> {
    const chatId = this.config.allowedChatId;
    if (!chatId) {
      throw new Error("No allowed chat ID configured");
    }

    await this.baseChannel.sendMessage(chatId, text, {
      parse_mode: options?.parse_mode,
      reply_to_message_id: options?.reply_to_message_id,
    });
  }

  /**
   * Parse a command from a ChannelMessage
   * Returns PmCommand for PM-specific handling
   */
  parseCommand(message: ChannelMessage): PmCommand | null {
    const text = message.text || "";
    const parts = text.trim().split(/\s+/);
    const command = parts[0];

    // Check if it's a command (starts with /)
    if (!command.startsWith("/")) {
      return {
        command: "chat",
        args: parts,
        raw_text: text,
        chat_id: parseInt(message.channelId.accountId, 10),
        message_id: parseInt(message.messageId, 10),
        user_id: parseInt(message.sender.id, 10),
      };
    }

    // Extract command name (remove /)
    const commandName = command.slice(1);
    const args = parts.slice(1);

    return {
      command: commandName,
      args,
      raw_text: text,
      chat_id: parseInt(message.channelId.accountId, 10),
      message_id: parseInt(message.messageId, 10),
      user_id: parseInt(message.sender.id, 10),
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
      const bot = this.getBot();
      const me = await bot.getMe();
      return {
        ok: true,
        bot: {
          id: me.id,
          name: me.first_name,
          username: me.username || "unknown",
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

  /**
   * Check if message is from allowed chat/user
   */
  private isAllowed(message: ChannelMessage): boolean {
    // If no allowlist configured, allow all
    if (!this.config.allowedChatId) {
      return true;
    }

    const chatId = parseInt(message.channelId.accountId, 10);
    const userId = parseInt(message.sender.id, 10);

    return this.baseChannel.isAllowed(userId, chatId);
  }
}

// Legacy export for backwards compatibility
export { PmTelegramChannel as TelegramService };

/**
 * Create Telegram channel config from environment (legacy)
 */
export function createTelegramConfigFromEnv() {
  return createPmTelegramConfigFromEnv();
}
