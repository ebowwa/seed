/**
 * State Service - Wrapper for Seed State Manager
 *
 * Provides a clean interface for the main server to interact with state management.
 */

import { getStateManager as getSM, type SeedState } from "./seed-state-manager";

let initialized: boolean = false;

/**
 * Initialize the state service
 */
export async function initializeStateService(): Promise<void> {
  if (initialized) {
    return;
  }

  const stateManager = getSM();
  await stateManager.initialize();
  await stateManager.updateMachineContext();
  await stateManager.updateNetworkInfo();
  await stateManager.runHealthChecks();

  initialized = true;
}

/**
 * Get the current state
 */
export function getState(): SeedState | null {
  return getSM().getState();
}

/**
 * Get the state manager instance
 */
export function getStateManager() {
  return getSM();
}

/**
 * Save the current state
 */
export async function saveState(): Promise<void> {
  await getSM().saveState();
}

/**
 * Sync Ralph loops from disk
 */
export async function syncRalphLoops(): Promise<void> {
  await getSM().syncRalphLoopsFromDisk();
}

/**
 * Run health checks
 */
export async function runHealthChecks(): Promise<void> {
  await getSM().runHealthChecks();
}

/**
 * Get health status
 */
export function getHealthStatus() {
  return getSM().getHealthStatus();
}

/**
 * Check if state service is initialized
 */
export function isInitialized(): boolean {
  return initialized;
}
