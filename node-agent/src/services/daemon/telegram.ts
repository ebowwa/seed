/**
 * PM Telegram Channel Adapter
 *
 * Wraps @ebowwa/channel-telegram with PM daemon-specific functionality.
 * Delegates to base channel for core operations, adds:
 * - PM command parsing for Ralph loop management
 * - Convenience methods for single-chat operation
 * - Connection testing and chat info
 */

import {
  TelegramChannel as BaseTelegramChannel,
  type TelegramConfig,
  createTelegramConfigFromEnv as baseCreateConfig,
  type ChannelConnector,
  type ChannelId,
  type ChannelMessage,
  type ChannelResponse,
  type ChannelCapabilities,
  type MessageHandler,
} from "../channels";

import type { PmCommand, ChannelType } from "../../types/index";

// Configuration from environment
const TELEGRAM_CHAT_ID = parseInt(process.env.TELEGRAM_CHAT_ID || "", 10);

/**
 * Extended Telegram config for PM daemon (single chat focus)
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
    // Base channel handles allowlist enforcement
    allowedChats: allowedChatId ? [allowedChatId] : undefined,
    allowedChatId,
  };
}

/**
 * PmTelegramChannel - Telegram channel with PM daemon extensions
 *
 * Wraps base TelegramChannel, delegating core operations.
 * Adds PM-specific convenience methods.
 */
export class PmTelegramChannel implements ChannelConnector {
  private base: BaseTelegramChannel;
  private allowedChatId: number | undefined;

  constructor(config?: PmTelegramConfig) {
    if (!config) {
      config = createPmTelegramConfigFromEnv() ?? undefined;
      if (!config) {
        throw new Error("TELEGRAM_BOT_TOKEN is required");
      }
    }
    this.allowedChatId = config.allowedChatId;
    this.base = new BaseTelegramChannel(config);
  }

  // ============================================================
  // ChannelConnector Interface - delegate to base
  // ============================================================

  get id(): ChannelId {
    return this.base.id;
  }

  get label(): string {
    return this.base.label;
  }

  get capabilities(): ChannelCapabilities {
    return this.base.capabilities;
  }

  async start(): Promise<void> {
    await this.base.start();
  }

  async stop(): Promise<void> {
    await this.base.stop();
  }

  onMessage(handler: MessageHandler): void {
    this.base.onMessage(handler);
  }

  async send(response: ChannelResponse): Promise<void> {
    await this.base.send(response);
  }

  isConnected(): boolean {
    return this.base.isConnected();
  }

  // ============================================================
  // Base Channel Access - for advanced operations
  // ============================================================

  getBot() {
    return this.base.getBot();
  }

  getMemory() {
    return this.base.getMemory();
  }

  // ============================================================
  // PM Daemon Extensions
  // ============================================================

  /**
   * Start typing indicator on allowed chat
   */
  startTyping(): void {
    if (this.allowedChatId) {
      this.base.startTypingIndicator(this.allowedChatId);
    }
  }

  /**
   * Stop typing indicator on allowed chat
   */
  stopTyping(): void {
    if (this.allowedChatId) {
      this.base.stopTypingIndicator(this.allowedChatId);
    }
  }

  /**
   * Send text message to allowed chat (convenience method)
   */
  async sendText(
    text: string,
    options?: {
      parse_mode?: "Markdown" | "HTML";
      reply_to_message_id?: number;
    }
  ): Promise<void> {
    if (!this.allowedChatId) {
      throw new Error("No allowed chat ID configured");
    }
    await this.base.sendMessage(this.allowedChatId, text, {
      parse_mode: options?.parse_mode,
      reply_to_message_id: options?.reply_to_message_id,
    });
  }

  /**
   * Parse a command from a ChannelMessage
   */
  parseCommand(message: ChannelMessage): PmCommand | null {
    const text = message.text || "";
    const parts = text.trim().split(/\s+/);
    const command = parts[0];

    if (!command.startsWith("/")) {
      return {
        command: "chat",
        args: parts,
        raw_text: text,
        chat_id: parseInt(message.channelId.accountId, 10),
        message_id: parseInt(message.messageId, 10),
        user_id: parseInt(message.sender.id, 10),
        channelType: "telegram" as ChannelType,
      };
    }

    return {
      command: command.slice(1),
      args: parts.slice(1),
      raw_text: text,
      chat_id: parseInt(message.channelId.accountId, 10),
      message_id: parseInt(message.messageId, 10),
      user_id: parseInt(message.sender.id, 10),
      channelType: "telegram" as ChannelType,
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
      const me = await this.getBot().getMe();
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
   * Get info about the allowed chat/user
   */
  async getChatInfo(): Promise<{
    id: number;
    type: string;
    title?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  } | null> {
    if (!this.allowedChatId) return null;

    try {
      const chat = await this.getBot().getChat(this.allowedChatId);
      return {
        id: chat.id,
        type: chat.type,
        title: chat.title,
        username: chat.username,
        firstName: chat.first_name,
        lastName: chat.last_name,
      };
    } catch (error) {
      console.error("[PmTelegram] Failed to get chat info:", error);
      return null;
    }
  }
}

// Legacy export
export { PmTelegramChannel as TelegramService };

/**
 * Create Telegram channel config from environment (legacy)
 */
export function createTelegramConfigFromEnv() {
  return createPmTelegramConfigFromEnv();
}
