#!/usr/bin/env bun
/**
 * Rolling Keys Supervisor - Monitors Claude and handles key rotation on failures
 *
 * This supervisor:
 * - Manages rolling key state (file-based)
 * - Spawns Claude with selected key
 * - Monitors for rate limit errors
 * - Auto-switches keys and retries on failure
 */

import { spawn, ChildProcess } from "child_process";
import { promises as fsp } from "fs";
import path from "path";

const STATE_DIR = process.env.HOME + "/.node-agent";
const STATE_FILE = path.join(STATE_DIR, "rolling-keys-state.json");

interface RollingKeysState {
  currentIndex: number;
  keyStatus: Array<{
    index: number;
    lastUsed: number;
    failureCount: number;
    lastFailure?: number;
    backoffUntil?: number;
    healthy: boolean;
  }>;
}

interface SupervisorConfig {
  maxRetries: number;
  retryDelayMs: number;
}

/**
 * Load rolling keys state from file
 */
async function loadState(): Promise<RollingKeysState> {
  try {
    const content = await fsp.readFile(STATE_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    // Initialize with default state
    const keysArray = process.env.ANTHROPIC_API_KEYS;
    if (!keysArray) {
      throw new Error("ANTHROPIC_API_KEYS not set");
    }
    const keys = JSON.parse(keysArray);
    return {
      currentIndex: 0,
      keyStatus: keys.map((_: string, i: number) => ({
        index: i,
        lastUsed: 0,
        failureCount: 0,
        healthy: true,
      })),
    };
  }
}

/**
 * Save rolling keys state to file
 */
async function saveState(state: RollingKeysState): Promise<void> {
  await fsp.mkdir(STATE_DIR, { recursive: true });
  await fsp.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Get the next available key (round-robin with healthy skip)
 */
async function getNextAvailableKey(state: RollingKeysState): Promise<{ key: string; index: number } | null> {
  const keysArray = process.env.ANTHROPIC_API_KEYS;
  if (!keysArray) return null;

  const keys = JSON.parse(keysArray) as string[];
  const now = Date.now();
  const startIndex = state.currentIndex;

  // Try each key starting from current index
  for (let i = 0; i < keys.length; i++) {
    const index = (startIndex + i) % keys.length;
    const keyStatus = state.keyStatus[index];

    // Skip if in backoff period
    if (keyStatus.backoffUntil && keyStatus.backoffUntil > now) {
      console.error(`[Rolling Keys] Key ${index} in backoff until ${new Date(keyStatus.backoffUntil).toISOString()}`);
      continue;
    }

    // Key is available
    state.currentIndex = (index + 1) % keys.length;
    keyStatus.lastUsed = now;
    await saveState(state);

    return { key: keys[index], index };
  }

  // All keys in backoff
  return null;
}

/**
 * Mark a key as failed with exponential backoff
 */
async function markKeyFailed(state: RollingKeysState, keyIndex: number): Promise<void> {
  const keyStatus = state.keyStatus[keyIndex];
  keyStatus.failureCount++;
  keyStatus.lastFailure = Date.now();
  keyStatus.healthy = false;

  // Exponential backoff: 1m, 2m, 4m, 8m, max 1h
  const backoffMs = Math.min(60000 * Math.pow(2, keyStatus.failureCount - 1), 3600000);
  keyStatus.backoffUntil = Date.now() + backoffMs;

  console.error(`[Rolling Keys] Marked key ${keyIndex} as failed (failure #${keyStatus.failureCount}), backoff: ${backoffMs / 1000}s`);

  await saveState(state);
}

/**
 * Recover a key (mark as healthy)
 */
async function recoverKey(state: RollingKeysState, keyIndex: number): Promise<void> {
  const keyStatus = state.keyStatus[keyIndex];
  keyStatus.healthy = true;
  keyStatus.failureCount = 0;
  keyStatus.backoffUntil = undefined;
  await saveState(state);
}

/**
 * Detect if an error is a rate limit / auth error
 */
function isKeyError(error: string): boolean {
  const errorLower = error.toLowerCase();
  return (
    errorLower.includes("429") ||
    errorLower.includes("rate limit") ||
    errorLower.includes("401") ||
    errorLower.includes("unauthorized") ||
    errorLower.includes("403") ||
    errorLower.includes("forbidden")
  );
}

/**
 * Pipe data between streams
 */
function pipeStream(src: NodeJS.ReadableStream, dest: NodeJS.WritableStream) {
  src.on('data', (chunk) => dest.write(chunk));
  src.on('end', () => dest.end && dest.end());
  src.on('error', (err) => console.error('[Pipe Error]', err));
}

/**
 * Spawn Claude with rolling keys and auto-retry on failure
 */
async function spawnClaudeWithRetry(args: string[], config: SupervisorConfig): Promise<number> {
  await fsp.mkdir(STATE_DIR, { recursive: true });

  let state = await loadState();
  let retries = 0;

  while (retries < config.maxRetries) {
    // Get next available key
    const result = await getNextAvailableKey(state);
    if (!result) {
      console.error("[Rolling Keys] All keys failed or in backoff");
      throw new Error("All API keys failed or in backoff");
    }

    const { key, index } = result;
    console.error(`[Rolling Keys] Using key ${index}: ${key.substring(0, 20)}...`);

    // Spawn Claude with the selected key - use pipe mode for proper I/O forwarding
    const child = spawn("claude", args, {
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: key,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Pipe stdin/stdout/stderr between parent and child
    // This allows RalphService to communicate with Claude
    // Note: setRawMode only works on TTY, check before calling
    process.stdin.resume();
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }

    process.stdin.pipe(child.stdin!);
    child.stdout!.pipe(process.stdout);
    child.stderr!.pipe(process.stderr);

    // Handle terminal resize
    process.stdout.on('resize', () => {
      if (child.stdout && 'columns' in process.stdout) {
        // Signal resize to child
      }
    });

    // Monitor for errors and handle failures
    return new Promise<number>((resolve, reject) => {
      let hasResolved = false;

      child.on("exit", (code) => {
        if (!hasResolved) {
          hasResolved = true;
          // Restore terminal (only if TTY)
          try {
            if (process.stdin.isTTY && process.stdin.setRawMode) {
              process.stdin.setRawMode(false);
            }
            process.stdin.pause();
          } catch {}
          resolve(code ?? 0);
        }
      });

      child.on("error", async (error) => {
        if (!hasResolved) {
          hasResolved = true;

          // Check if it's a key-related error
          const errorMsg = String(error);
          if (isKeyError(errorMsg)) {
            console.error(`[Rolling Keys] Key ${index} failed, switching to next key...`);

            // Mark key as failed
            await markKeyFailed(state, index);

            // Retry with next key
            if (retries < config.maxRetries - 1) {
              retries++;
              console.error(`[Rolling Keys] Retry ${retries}/${config.maxRetries - 1}...`);

              // Wait a bit before retry
              await new Promise((r) => setTimeout(r, config.retryDelayMs));

              // Try again with new state
              spawnClaudeWithRetry(args, config)
                .then(resolve)
                .catch(reject);
              return;
            } else {
              reject(new Error("All retries exhausted"));
              return;
            }
          }

          reject(error);
        }
      });
    });
  }

  throw new Error("Should not reach here");
}

// Main entry point
const args = process.argv.slice(2);

console.error("[Rolling Keys Supervisor] Starting Claude with automatic key rotation...");

spawnClaudeWithRetry(args, {
  maxRetries: 10,
  retryDelayMs: 1000,
})
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error("[Rolling Keys Supervisor] Error:", error);
    process.exit(1);
  });
