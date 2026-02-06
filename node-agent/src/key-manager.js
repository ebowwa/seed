"use strict";
/**
 * Key Manager Integration
 *
 * Singleton instance and helper functions for managing Anthropic API keys
 * with automatic rotation and fallback using RollingKeyManager.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKeyManager = getKeyManager;
exports.getCurrentKey = getCurrentKey;
exports.getNextKey = getNextKey;
exports.getAvailableKey = getAvailableKey;
exports.markFailed = markFailed;
exports.markFailedByValue = markFailedByValue;
exports.handleKeyError = handleKeyError;
exports.getKeyStats = getKeyStats;
exports.getKeysInfo = getKeysInfo;
exports.recoverKey = recoverKey;
exports.recoverAllKeys = recoverAllKeys;
exports.isKeyFailureError = isKeyFailureError;
exports.destroyKeyManager = destroyKeyManager;
exports.resetKeyManager = resetKeyManager;
var rolling_keys_1 = require("@codespaces/rolling-keys");
/**
 * Singleton instance of the RollingKeyManager configured for Anthropic API keys
 */
var keyManagerInstance = null;
/**
 * Get or create the singleton key manager instance
 *
 * Initializes from environment variables:
 * - ANTHROPIC_API_KEYS: JSON array of API keys (preferred)
 * - ANTHROPIC_API_KEY: Single API key (fallback)
 *
 * @returns The RollingKeyManager instance
 */
function getKeyManager() {
    if (!keyManagerInstance) {
        keyManagerInstance = (0, rolling_keys_1.createRollingKeyManager)("ANTHROPIC_API_KEYS", "ANTHROPIC_API_KEY");
    }
    return keyManagerInstance;
}
/**
 * Get the current API key
 *
 * Returns the key at the current rotation index without rotating.
 *
 * @returns Object containing the key string and its index, or null if unavailable
 *
 * @example
 * ```ts
 * const { key, index, allFailed } = getCurrentKey();
 * if (key) {
 *   console.log(`Using key ${index}: ${key.slice(0, 10)}...`);
 * }
 * ```
 */
function getCurrentKey() {
    return getKeyManager().getCurrentKey();
}
/**
 * Get the next available API key
 *
 * Rotates through keys, skipping any that are failed or rate limited.
 * Automatically advances the current index.
 *
 * @returns Object containing the key string, index, and skip info
 *
 * @example
 * ```ts
 * const { key, index, skippedFailed, skippedCount } = getNextKey();
 * if (skippedFailed) {
 *   console.log(`Skipped ${skippedCount} failed keys`);
 * }
 * ```
 */
function getNextKey() {
    return getKeyManager().getNextKey();
}
/**
 * Get an available key (current if healthy, or next if needed)
 *
 * Convenience method that checks if current key is healthy and
 * returns it, otherwise gets the next healthy key.
 *
 * @returns Object containing an available key with metadata
 */
function getAvailableKey() {
    return getKeyManager().getAvailableKey();
}
/**
 * Mark a key as failed
 *
 * Sets the key's health to failed and schedules recovery after backoff.
 *
 * @param keyIndex - Index of the key to mark as failed
 * @param error - Optional error that caused the failure
 *
 * @example
 * ```ts
 * try {
 *   await anthropic.messages.create({...});
 * } catch (error) {
 *   markFailed(currentKeyIndex, error);
 * }
 * ```
 */
function markFailed(keyIndex, error) {
    getKeyManager().markKeyFailed(keyIndex, error);
}
/**
 * Mark a key as failed by its value
 *
 * Convenience method to find and mark a key as failed by its value.
 *
 * @param keyValue - The API key string to mark as failed
 * @param error - Optional error that caused the failure
 */
function markFailedByValue(keyValue, error) {
    getKeyManager().markKeyFailedByValue(keyValue, error);
}
/**
 * Handle an API error and mark key as failed if needed
 *
 * Checks if error is a key failure (401, 403, 429) and marks
 * the current key as failed if so.
 *
 * @param error - Error to handle
 * @returns Whether the key was marked as failed
 *
 * @example
 * ```ts
 * try {
 *   await apiCall(getCurrentKey().key);
 * } catch (error) {
 *   if (handleKeyError(error)) {
 *     // Key was marked as failed, get next one
 *     const next = getNextKey();
 *   }
 * }
 * ```
 */
function handleKeyError(error) {
    return getKeyManager().handleError(error);
}
/**
 * Get key manager statistics
 *
 * @returns Current statistics snapshot
 */
function getKeyStats() {
    return getKeyManager().getStats();
}
/**
 * Get detailed information about all keys
 *
 * @returns Array of all keys with their metadata (without exposing actual key values)
 */
function getKeysInfo() {
    return getKeyManager().getKeysInfo();
}
/**
 * Recover a failed key
 *
 * Resets the key's health to healthy and clears failure metadata.
 *
 * @param keyIndex - Index of the key to recover
 */
function recoverKey(keyIndex) {
    getKeyManager().recoverKey(keyIndex);
}
/**
 * Recover all failed keys
 *
 * Resets all keys to healthy state regardless of backoff status.
 */
function recoverAllKeys() {
    getKeyManager().recoverAllKeys();
}
/**
 * Check if an error should trigger key failure
 *
 * Uses the configured error detector to check if the error
 * indicates a key failure (401, 403, 429, etc.).
 *
 * @param error - Error to check
 * @returns Whether the error indicates key failure
 */
function isKeyFailureError(error) {
    return getKeyManager().isKeyFailureError(error);
}
/**
 * Clean up key manager resources
 *
 * Cancels retry timers to prevent memory leaks.
 * Call this when shutting down the service.
 */
function destroyKeyManager() {
    if (keyManagerInstance) {
        keyManagerInstance.destroy();
        keyManagerInstance = null;
    }
}
/**
 * Reset the key manager singleton
 *
 * Forces re-initialization on next call to getKeyManager().
 * Useful for testing or when environment variables change.
 */
function resetKeyManager() {
    destroyKeyManager();
}
