/**
 * Claude Spawn Helper - Rolling Keys Integration
 *
 * This module provides a function to spawn Claude Code with rolling API keys.
 * It selects a key from ANTHROPIC_API_KEYS and sets ANTHROPIC_API_KEY before spawning.
 */

import { spawn } from "child_process";

/**
 * Get a selected API key from ANTHROPIC_API_KEYS
 * Falls back to ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY
 */
function getSelectedApiKey(): string {
  // Try ANTHROPIC_API_KEYS (JSON array)
  const keysArray = process.env.ANTHROPIC_API_KEYS;
  if (keysArray) {
    try {
      const keys = JSON.parse(keysArray);
      if (Array.isArray(keys) && keys.length > 0) {
        // Simple round-robin: use first key for now
        // TODO: Implement proper round-robin with persistence
        const selectedKey = keys[0];
        console.log(`[Rolling Keys] Using key: ${selectedKey.substring(0, 20)}... (${keys.length} total)`);
        return selectedKey;
      }
    } catch (e) {
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
export function spawnClaudeWithRollingKeys(
  args: string[],
  options: { cwd: string; stdio: readonly ["pipe", "pipe", "pipe"] }
) {
  // Get the selected API key
  const apiKey = getSelectedApiKey();

  // Set ANTHROPIC_API_KEY for the Claude Code process
  const env = {
    ...process.env,
    ANTHROPIC_API_KEY: apiKey,
  };

  // Spawn Claude Code with the modified environment
  const child = spawn("claude", args, {
    ...options,
    env,
  });

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
export function spawnDopplerClaudeWithRollingKeys(
  dopplerProject: string,
  dopplerConfig: string,
  claudeArgs: string[],
  options: { cwd: string; stdio: readonly ["pipe", "pipe", "pipe"] }
) {
  // Get the selected API key BEFORE doppler run
  const apiKey = getSelectedApiKey();

  // Build doppler run command
  const args = [
    "run",
    "--project",
    dopplerProject,
    "--config",
    dopplerConfig,
    "--",
    "claude",
    ...claudeArgs,
  ];

  // Spawn with ANTHROPIC_API_KEY set (doppler will preserve it)
  const env = {
    ...process.env,
    ANTHROPIC_API_KEY: apiKey,
  };

  const child = spawn("doppler", args, {
    ...options,
    env,
  });

  return child;
}
