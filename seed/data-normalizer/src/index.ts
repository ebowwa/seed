/**
 * @seed/data-normalizer
 *
 * Data normalization hook for worldmonitor feeds.
 * Transforms real-world data for prediction market pricing analysis.
 *
 * Usage:
 * ```typescript
 * import { getDataHook, normalizePrediction, buildPricingContext } from '@seed/data-normalizer';
 *
 * // Start the data hook
 * const hook = getDataHook({ worldmonitorBaseUrl: 'http://localhost:5173' });
 * await hook.start();
 *
 * // Listen for signals
 * hook.onSignal((signals) => {
 *   console.log('Detected signals:', signals);
 * });
 *
 * // Get context for a prediction
 * const context = await hook.getContextForPrediction('some-market-id');
 * ```
 */

// Re-export types
export * from './types.js';

// Re-export history management
export {
  PredictionHistoryManager,
  InMemoryHistoryStorage,
  getHistoryManager,
  resetHistoryManager,
  type HistoryStorage,
} from './history.js';

// Re-export normalizer functions
export {
  generateId,
  categorizeText,
  getSourceTier,
  getSourceType,
  normalizeNews,
  normalizeMarket,
  normalizePrediction,
  normalizeEconomic,
  normalizeConflict,
  detectSignals,
  buildPricingContext,
} from './normalizer.js';

// Re-export data hook
export {
  DataHook,
  getDataHook,
  resetDataHook,
  DEFAULT_CONFIG,
} from './hooks.js';

// ============================================================================
// CONVENIENCE API
// ============================================================================

import { getDataHook, type DataHook } from './hooks.js';
import { getHistoryManager, type PredictionHistoryManager } from './history.js';
import {
  normalizePrediction,
  detectSignals,
  buildPricingContext,
} from './normalizer.js';
import type {
  NormalizedPrediction,
  NormalizedNews,
  NormalizedMarket,
  CorrelationSignal,
  PricingContext,
} from './types.js';

/**
 * Quick setup for prediction market analysis
 *
 * Creates a fully configured data hook with history tracking.
 */
export function createPredictionAnalyzer(config?: {
  worldmonitorBaseUrl?: string;
  kalshiBaseUrl?: string;
  polymarketBaseUrl?: string;
}): {
  hook: DataHook;
  history: PredictionHistoryManager;
  onSignal: (callback: (signals: CorrelationSignal[]) => void | Promise<void>) => () => void;
  onContext: (callback: (context: PricingContext) => void | Promise<void>) => () => void;
  analyzePrediction: (predictionId: string) => Promise<PricingContext | null>;
  start: () => Promise<void>;
  stop: () => void;
} {
  const hook = getDataHook({
    worldmonitorBaseUrl: config?.worldmonitorBaseUrl ?? 'http://localhost:5173',
    predictionMarketsBaseUrl: {
      kalshi: config?.kalshiBaseUrl ?? 'http://localhost:3000',
      polymarket: config?.polymarketBaseUrl ?? 'http://localhost:3001',
    },
  });

  const history = getHistoryManager();

  return {
    hook,
    history,

    onSignal: (callback) => hook.onSignal(callback),

    onContext: (callback) => hook.onContext(callback),

    analyzePrediction: async (predictionId: string) => {
      return hook.getContextForPrediction(predictionId);
    },

    start: async () => {
      await hook.start();
    },

    stop: () => {
      hook.stop();
    },
  };
}

/**
 * Utility to compare prediction odds with calculated probability
 *
 * Returns the pricing mismatch as a percentage.
 * Positive = prediction overvalues YES
 * Negative = prediction undervalues YES
 */
export function calculateMismatch(
  predictionYesPrice: number,
  calculatedProbability: number
): {
  mismatchPercent: number;
  direction: 'overvalued' | 'undervalued' | 'fair';
  recommendation: 'buy_yes' | 'buy_no' | 'hold' | 'none';
} {
  const mismatchPercent = predictionYesPrice - (calculatedProbability * 100);
  const absMismatch = Math.abs(mismatchPercent);

  let direction: 'overvalued' | 'undervalued' | 'fair';
  let recommendation: 'buy_yes' | 'buy_no' | 'hold' | 'none';

  if (absMismatch < 5) {
    direction = 'fair';
    recommendation = 'hold';
  } else if (mismatchPercent > 0) {
    direction = 'overvalued';
    recommendation = absMismatch > 15 ? 'buy_no' : 'hold';
  } else {
    direction = 'undervalued';
    recommendation = absMismatch > 15 ? 'buy_yes' : 'hold';
  }

  return {
    mismatchPercent,
    direction,
    recommendation,
  };
}
