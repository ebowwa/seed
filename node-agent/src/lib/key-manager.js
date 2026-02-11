"use strict";
/**
 * Key Manager - Rolling API Key Integration for Seed
 *
 * Provides centralized API key management with automatic rotation and fallback.
 * Uses @ebowwa/rolling-keys for round-robin key rotation with exponential backoff.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getManager = void 0;
exports.initializeAnthropicKeyManager = initializeAnthropicKeyManager;
exports.getAnthropicApiKey = getAnthropicApiKey;
exports.getCurrentAnthropicKey = getCurrentAnthropicKey;
exports.rotateAnthropicKey = rotateAnthropicKey;
exports.markAnthropicKeyFailed = markAnthropicKeyFailed;
exports.isApiKeyError = isApiKeyError;
exports.handleAnthropicApiError = handleAnthropicApiError;
exports.getAnthropicKeyStats = getAnthropicKeyStats;
exports.recoverAnthropicKeys = recoverAnthropicKeys;
var rolling_keys_1 = require("@ebowwa/rolling-keys");
/**
 * Singleton instance of the RollingKeyManager configured for Anthropic API keys
 */
var anthropicKeyManager = null;
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
function initializeAnthropicKeyManager() {
    if (anthropicKeyManager) {
        return anthropicKeyManager;
    }
    anthropicKeyManager = new rolling_keys_1.RollingKeyManager({
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
function getAnthropicApiKey() {
    var manager = initializeAnthropicKeyManager();
    return manager.getAvailableKey();
}
/**
 * Get the current Anthropic API key without rotating
 */
function getCurrentAnthropicKey() {
    var manager = initializeAnthropicKeyManager();
    return manager.getCurrentKey();
}
/**
 * Rotate to the next available Anthropic API key
 */
function rotateAnthropicKey() {
    var manager = initializeAnthropicKeyManager();
    return manager.getNextKey();
}
/**
 * Mark the current Anthropic API key as failed
 * Triggers rotation to the next available key
 *
 * @param error - The error that caused the failure (optional)
 */
function markAnthropicKeyFailed(error) {
    var manager = initializeAnthropicKeyManager();
    var currentIndex = manager.getCurrentIndex();
    manager.markKeyFailed(currentIndex, error);
}
/**
 * Check if an error indicates a failed API key
 * Handles rate limits (429), unauthorized (401), forbidden (403)
 */
function isApiKeyError(error) {
    if (!error)
        return false;
    var errorStr = String(error);
    // HTTP status codes
    if (errorStr.includes("401") || errorStr.includes("403") || errorStr.includes("429")) {
        return true;
    }
    // Error message patterns
    var rateLimitPatterns = [
        "rate limit",
        "rate_limit",
        "too many requests",
        "quota exceeded",
        "unauthorized",
        "forbidden",
        "invalid api key",
        "authentication failed",
    ];
    return rateLimitPatterns.some(function (pattern) {
        return errorStr.toLowerCase().includes(pattern);
    });
}
/**
 * Handle an API error and mark the key as failed if appropriate
 * Returns true if the error was handled (key marked failed)
 */
function handleAnthropicApiError(error) {
    if (isApiKeyError(error)) {
        markAnthropicKeyFailed(error);
        return true;
    }
    return false;
}
/**
 * Get statistics about the Anthropic API key rotation
 */
function getAnthropicKeyStats() {
    var manager = initializeAnthropicKeyManager();
    return manager.getStats();
}
/**
 * Reset all failed Anthropic API keys to healthy status
 */
function recoverAnthropicKeys() {
    var manager = initializeAnthropicKeyManager();
    var keyCount = manager.getKeyCount();
    for (var i = 0; i < keyCount; i++) {
        manager.recoverKey(i);
    }
}
// Export the manager instance for advanced use cases
var key_manager_1 = require("./key-manager");
Object.defineProperty(exports, "getManager", { enumerable: true, get: function () { return key_manager_1.getAnthropicKeyManager; } });
function getAnthropicKeyManager() {
    return initializeAnthropicKeyManager();
}
