/**
 * Key Manager - Rolling API Key Integration for Seed
 *
 * Provides centralized API key management with automatic rotation and fallback.
 * Uses @codespaces/rolling-keys for round-robin key rotation with exponential backoff.
 */

import { RollingKeyManager } from "@codespaces/rolling-keys";

/**
 * Singleton instance of the RollingKeyManager configured for Anthropic API keys
 */
let anthropicKeyManager: RollingKeyManager | null = null;

/**
 * Initialize the Anthropic API key manager
 *
 * Reads from ANTHROPIC_API_KEYS environment variable (JSON array format)
 * Falls back to ANTHROPIC_API_KEY for backward compatibility
 *
 * @example
 * ```bash
 * # Multiple keys (rolling)
 * export ANTHROPIC_API_KEYS='["key1","key2","key3"]'
 *
 * # Single key (backward compatible)
 * export ANTHROPIC_API_KEY='sk-ant-...'
 * ```
 */
export function initializeAnthropicKeyManager(): RollingKeyManager {
  if (anthropicKeyManager) {
    return anthropicKeyManager;
  }

  anthropicKeyManager = new RollingKeyManager({
    keysEnvVar: "ANTHROPIC_API_KEYS",
    singleKeyEnvVar: "ANTHROPIC_API_KEY",
    baseBackoffMs: 60000, // 1 minute
    maxBackoffMs: 3600000, // 1 hour
    backoffMultiplier: 2,
    autoRetry: true,
  });

  return anthropicKeyManager;
}

/**
 * Get the current available Anthropic API key
 * Automatically skips failed/rate-limited keys
 */
export function getAnthropicApiKey(): string {
  const manager = initializeAnthropicKeyManager();
  return manager.getAvailableKey();
}

/**
 * Get the current Anthropic API key without rotating
 */
export function getCurrentAnthropicKey(): string {
  const manager = initializeAnthropicKeyManager();
  return manager.getCurrentKey();
}

/**
 * Rotate to the next available Anthropic API key
 */
export function rotateAnthropicKey(): string {
  const manager = initializeAnthropicKeyManager();
  return manager.getNextKey();
}

/**
 * Mark the current Anthropic API key as failed
 * Triggers rotation to the next available key
 *
 * @param error - The error that caused the failure (optional)
 */
export function markAnthropicKeyFailed(error?: unknown): void {
  const manager = initializeAnthropicKeyManager();
  const currentIndex = manager.getCurrentIndex();
  manager.markKeyFailed(currentIndex, error);
}

/**
 * Check if an error indicates a failed API key
 * Handles rate limits (429), unauthorized (401), forbidden (403)
 */
export function isApiKeyError(error: unknown): boolean {
  if (!error) return false;

  const errorStr = String(error);

  // HTTP status codes
  if (errorStr.includes("401") || errorStr.includes("403") || errorStr.includes("429")) {
    return true;
  }

  // Error message patterns
  const rateLimitPatterns = [
    "rate limit",
    "rate_limit",
    "too many requests",
    "quota exceeded",
    "unauthorized",
    "forbidden",
    "invalid api key",
    "authentication failed",
  ];

  return rateLimitPatterns.some((pattern) =>
    errorStr.toLowerCase().includes(pattern)
  );
}

/**
 * Handle an API error and mark the key as failed if appropriate
 * Returns true if the error was handled (key marked failed)
 */
export function handleAnthropicApiError(error: unknown): boolean {
  if (isApiKeyError(error)) {
    markAnthropicKeyFailed(error);
    return true;
  }
  return false;
}

/**
 * Get statistics about the Anthropic API key rotation
 */
export function getAnthropicKeyStats() {
  const manager = initializeAnthropicKeyManager();
  return manager.getStats();
}

/**
 * Reset all failed Anthropic API keys to healthy status
 */
export function recoverAnthropicKeys(): void {
  const manager = initializeAnthropicKeyManager();
  const keyCount = manager.getKeyCount();

  for (let i = 0; i < keyCount; i++) {
    manager.recoverKey(i);
  }
}

// Export the manager instance for advanced use cases
export { getAnthropicKeyManager as getManager } from "./key-manager";

function getAnthropicKeyManager(): RollingKeyManager {
  return initializeAnthropicKeyManager();
}
