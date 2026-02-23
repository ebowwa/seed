/**
 * Channel Adapters & Core Primitives
 *
 * Re-exports from npm packages for clean imports.
 * Each channel implements ChannelConnector from @ebowwa/channel-types.
 *
 * Core primitives from @ebowwa/channel-core:
 * - ChannelRouter: Route N channels → 1 LLM brain
 * - ChannelStateMachine: Connection lifecycle management
 * - ConversationTracker: Track conversations by channel+user
 * - ChannelFactory: Auto-detect and instantiate channels
 * - ResponseQueue: Priority queue with rate limiting
 *
 * Usage:
 *   import { TelegramChannel, ChannelRouter, ConversationTracker } from "./services/channels";
 */

// Types
export * from "@ebowwa/channel-types";

// Core primitives (router, state, context, queue, factory)
export * from "@ebowwa/channel-core";

// Telegram channel
export * from "@ebowwa/channel-telegram";

// SSH channel
export * from "@ebowwa/channel-ssh";
