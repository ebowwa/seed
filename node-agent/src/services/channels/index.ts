/**
 * Channel Adapters
 *
 * Re-exports from npm packages for clean imports.
 * Each channel implements ChannelConnector from @ebowwa/channel-types.
 *
 * Usage:
 *   import { TelegramChannel, SshChannel, type ChannelMessage } from "./services/channels";
 */

// Types
export * from "@ebowwa/channel-types";

// Telegram channel
export * from "@ebowwa/channel-telegram";

// SSH channel
export * from "@ebowwa/channel-ssh";
