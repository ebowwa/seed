"use strict";
/**
 * Claude Spawn Helper - Rolling Keys Integration
 *
 * This module provides a function to spawn Claude Code with rolling API keys.
 * It selects a key from ANTHROPIC_API_KEYS and sets ANTHROPIC_API_KEY before spawning.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnClaudeWithRollingKeys = spawnClaudeWithRollingKeys;
exports.spawnDopplerClaudeWithRollingKeys = spawnDopplerClaudeWithRollingKeys;
var child_process_1 = require("child_process");
/**
 * Get a selected API key from ANTHROPIC_API_KEYS
 * Falls back to ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY
 */
function getSelectedApiKey() {
    // Try ANTHROPIC_API_KEYS (JSON array)
    var keysArray = process.env.ANTHROPIC_API_KEYS;
    if (keysArray) {
        try {
            var keys = JSON.parse(keysArray);
            if (Array.isArray(keys) && keys.length > 0) {
                // Simple round-robin: use first key for now
                // TODO: Implement proper round-robin with persistence
                var selectedKey = keys[0];
                console.log("[Rolling Keys] Using key: ".concat(selectedKey.substring(0, 20), "... (").concat(keys.length, " total)"));
                return selectedKey;
            }
        }
        catch (e) {
            console.warn("[Rolling Keys] Failed to parse ANTHROPIC_API_KEYS:", e);
        }
    }
    // Fallback to ANTHROPIC_AUTH_TOKEN
    if (process.env.ANTHROPIC_AUTH_TOKEN) {
        return process.env.ANTHROPIC_AUTH_TOKEN;
    }
    // Fallback to ANTHROPIC_API_KEY
    if (process.env.ANTHROPIC_API_KEY) {
        return process.env.ANTHROPIC_API_KEY;
    }
    throw new Error("No API key found in ANTHROPIC_API_KEYS, ANTHROPIC_AUTH_TOKEN, or ANTHROPIC_API_KEY");
}
/**
 * Spawn Claude Code with rolling API keys
 *
 * @param args - Arguments to pass to Claude Code
 * @param options - Spawn options
 * @returns Spawned child process
 */
function spawnClaudeWithRollingKeys(args, options) {
    // Get the selected API key
    var apiKey = getSelectedApiKey();
    // Set ANTHROPIC_API_KEY for the Claude Code process
    var env = __assign(__assign({}, process.env), { ANTHROPIC_API_KEY: apiKey });
    // Spawn Claude Code with the modified environment
    var child = (0, child_process_1.spawn)("claude", args, __assign(__assign({}, options), { env: env }));
    return child;
}
/**
 * Spawn Doppler run with Claude Code, injecting rolling keys
 *
 * @param dopplerProject - Doppler project name
 * @param dopplerConfig - Doppler config name
 * @param claudeArgs - Arguments to pass to Claude Code
 * @param options - Spawn options
 * @returns Spawned child process
 */
function spawnDopplerClaudeWithRollingKeys(dopplerProject, dopplerConfig, claudeArgs, options) {
    // Get the selected API key BEFORE doppler run
    var apiKey = getSelectedApiKey();
    // Build doppler run command
    var args = __spreadArray([
        "run",
        "--project",
        dopplerProject,
        "--config",
        dopplerConfig,
        "--",
        "claude"
    ], claudeArgs, true);
    // Spawn with ANTHROPIC_API_KEY set (doppler will preserve it)
    var env = __assign(__assign({}, process.env), { ANTHROPIC_API_KEY: apiKey });
    var child = (0, child_process_1.spawn)("doppler", args, __assign(__assign({}, options), { env: env }));
    return child;
}
