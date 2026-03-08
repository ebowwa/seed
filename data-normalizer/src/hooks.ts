/**
 * Data Hook
 *
 * Webhook/listener for receiving data from worldmonitor feeds.
 * Polls worldmonitor API endpoints and normalizes incoming data.
 */

import type {
  NormalizedData,
  NormalizedNews,
  NormalizedMarket,
  NormalizedPrediction,
  NormalizedEconomic,
  NormalizedConflict,
  NormalizerConfig,
  CorrelationSignal,
  PricingContext,
  TopicCategory,
} from './types.js';
import {
  normalizeNews,
  normalizeMarket,
  normalizePrediction,
  normalizeEconomic,
  normalizeConflict,
  detectSignals,
  buildPricingContext,
} from './normalizer.js';
import { getHistoryManager } from './history.js';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_CONFIG: NormalizerConfig = {
  worldmonitorBaseUrl: 'http://localhost:5173', // worldmonitor dev server
  predictionMarketsBaseUrl: {
    kalshi: 'http://localhost:3000',
    polymarket: 'http://localhost:3001',
  },
  feeds: [
    { name: 'polymarket', url: '/api/polymarket', category: 'geopolitics', pollIntervalMs: 60000, enabled: true },
    { name: 'stock-index', url: '/api/stock-index', category: 'finance', pollIntervalMs: 30000, enabled: true },
    { name: 'macro-signals', url: '/api/macro-signals', category: 'economics', pollIntervalMs: 60000, enabled: true },
    { name: 'ucdp-events', url: '/api/ucdp-events', category: 'geopolitics', pollIntervalMs: 300000, enabled: true },
  ],
  historyRetentionDays: 90,
  signalThresholds: {
    predictionShiftThreshold: 5,
    newsVelocityThreshold: 3,
    marketMoveThreshold: 2,
  },
};

// ============================================================================
// DATA HOOK CLASS
// ============================================================================

type DataCallback = (data: NormalizedData[]) => void | Promise<void>;
type SignalCallback = (signals: CorrelationSignal[]) => void | Promise<void>;
type ContextCallback = (context: PricingContext) => void | Promise<void>;

export class DataHook {
  private config: NormalizerConfig;
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private dataCallbacks: DataCallback[] = [];
  private signalCallbacks: SignalCallback[] = [];
  private contextCallbacks: ContextCallback[] = [];

  // State tracking
  private latestNews: NormalizedNews[] = [];
  private latestMarkets: NormalizedMarket[] = [];
  private latestPredictions: NormalizedPrediction[] = [];
  private latestEconomic: NormalizedEconomic[] = [];
  private latestConflicts: NormalizedConflict[] = [];
  private previousPredictionPrices: Map<string, number> = new Map();
  private lastSignals: CorrelationSignal[] = [];

  constructor(config?: Partial<NormalizerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // CALLBACK REGISTRATION
  // ============================================================================

  onData(callback: DataCallback): () => void {
    this.dataCallbacks.push(callback);
    return () => {
      const idx = this.dataCallbacks.indexOf(callback);
      if (idx >= 0) this.dataCallbacks.splice(idx, 1);
    };
  }

  onSignal(callback: SignalCallback): () => void {
    this.signalCallbacks.push(callback);
    return () => {
      const idx = this.signalCallbacks.indexOf(callback);
      if (idx >= 0) this.signalCallbacks.splice(idx, 1);
    };
  }

  onContext(callback: ContextCallback): () => void {
    this.contextCallbacks.push(callback);
    return () => {
      const idx = this.contextCallbacks.indexOf(callback);
      if (idx >= 0) this.contextCallbacks.splice(idx, 1);
    };
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Start polling feeds
   */
  async start(): Promise<void> {
    console.log('[DataHook] Starting...');

    for (const feed of this.config.feeds) {
      if (!feed.enabled) continue;

      // Initial fetch
      await this.pollFeed(feed.name);

      // Set up interval
      const interval = setInterval(
        () => this.pollFeed(feed.name),
        feed.pollIntervalMs
      );
      this.intervals.set(feed.name, interval);
    }

    // Also start signal detection loop
    const signalInterval = setInterval(
      () => this.runSignalDetection(),
      30000 // Every 30 seconds
    );
    this.intervals.set('__signals__', signalInterval);

    console.log('[DataHook] Started with', this.intervals.size, 'intervals');
  }

  /**
   * Stop all polling
   */
  stop(): void {
    console.log('[DataHook] Stopping...');
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
  }

  // ============================================================================
  // POLLING
  // ============================================================================

  private async pollFeed(feedName: string): Promise<void> {
    const feed = this.config.feeds.find(f => f.name === feedName);
    if (!feed) return;

    try {
      const url = `${this.config.worldmonitorBaseUrl}${feed.url}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.warn(`[DataHook] ${feedName} returned ${response.status}`);
        return;
      }

      const data = await response.json();
      const normalized = this.processRawData(feedName, data);

      if (normalized.length > 0) {
        await this.emitData(normalized);
      }
    } catch (error) {
      console.error(`[DataHook] Error polling ${feedName}:`, error);
    }
  }

  private processRawData(feedName: string, raw: unknown): NormalizedData[] {
    const results: NormalizedData[] = [];

    // Handle different feed types
    switch (feedName) {
      case 'polymarket':
        if (Array.isArray(raw)) {
          for (const item of raw) {
            const i = item as Record<string, unknown>;
            const pred = normalizePrediction({
              platform: 'polymarket',
              marketId: (i.condition_id ?? i.id) as string,
              title: (i.question ?? i.title) as string,
              description: i.description as string | undefined,
              yesPrice: ((i.outcome_prices as number[] | undefined)?.[0] ?? i.yes_price ?? 50) as number * 100,
              volume: i.volume as number | undefined,
              liquidity: i.liquidity as number | undefined,
              endDate: i.end_date_iso as string | undefined,
              tags: i.tags as string[] | undefined,
            });
            results.push(pred);
            this.latestPredictions.push(pred);
            this.previousPredictionPrices.set(pred.marketId, pred.yesPrice);
          }
        }
        break;

      case 'stock-index':
        if (Array.isArray(raw)) {
          for (const item of raw) {
            const i = item as Record<string, unknown>;
            const market = normalizeMarket({
              symbol: i.symbol as string,
              name: i.name as string | undefined,
              price: i.price as number | null | undefined,
              change: i.change as number | null | undefined,
              volume: i.volume as number | undefined,
            });
            results.push(market);
            this.latestMarkets.push(market);
          }
        }
        break;

      case 'macro-signals':
        if (raw && typeof raw === 'object' && 'indicators' in raw) {
          const indicators = (raw as { indicators: unknown[] }).indicators;
          if (Array.isArray(indicators)) {
            for (const item of indicators) {
              const i = item as Record<string, unknown>;
              const econ = normalizeEconomic({
                indicator: (i.name ?? i.indicator) as string,
                country: (i.country as string) ?? 'US',
                value: i.value as number,
                previousValue: i.previous as number | undefined,
                expectedValue: i.expected as number | undefined,
                unit: (i.unit as string) ?? '',
                period: (i.period as string) ?? '',
              });
              results.push(econ);
              this.latestEconomic.push(econ);
            }
          }
        }
        break;

      case 'ucdp-events':
        if (Array.isArray(raw)) {
          for (const item of raw) {
            const i = item as Record<string, unknown>;
            const conflict = normalizeConflict({
              country: (i.country ?? i.country_name) as string,
              region: i.region as string | undefined,
              eventType: 'armed_conflict',
              severity: Math.min(5, Math.max(1, Math.ceil(((i.fatalities as number) ?? 0) / 100))) as 1 | 2 | 3 | 4 | 5,
              casualties: (i.fatalities ?? i.deaths) as number | undefined,
              actors: [i.side_a, i.side_b].filter(Boolean) as string[],
              description: ((i.notes ?? i.description) as string) ?? '',
              lat: i.latitude as number | undefined,
              lon: i.longitude as number | undefined,
              timestamp: i.date_start as string | Date | undefined,
            });
            results.push(conflict);
            this.latestConflicts.push(conflict);
          }
        }
        break;

      default:
        // Generic news processing
        if (Array.isArray(raw)) {
          for (const item of raw) {
            const i = item as Record<string, unknown>;
            if (i.title) {
              const news = normalizeNews({
                source: (i.source as string) ?? feedName,
                title: i.title as string,
                link: (i.link ?? i.url) as string | undefined,
                pubDate: (i.pubDate ?? i.published) as string | Date | undefined,
                isAlert: (i.isAlert ?? i.alert) as boolean | undefined,
              });
              results.push(news);
              this.latestNews.push(news);
            }
          }
        }
    }

    // Trim stored data to prevent memory bloat
    if (this.latestNews.length > 1000) this.latestNews = this.latestNews.slice(-500);
    if (this.latestMarkets.length > 200) this.latestMarkets = this.latestMarkets.slice(-100);
    if (this.latestPredictions.length > 500) this.latestPredictions = this.latestPredictions.slice(-250);

    return results;
  }

  // ============================================================================
  // SIGNAL DETECTION
  // ============================================================================

  private async runSignalDetection(): Promise<void> {
    const signals = detectSignals(
      this.latestPredictions,
      this.latestNews,
      this.latestMarkets,
      {
        predictions: this.previousPredictionPrices,
        newsVelocity: new Map(), // TODO: track this
        marketChanges: new Map(), // TODO: track this
      }
    );

    if (signals.length > 0) {
      this.lastSignals = signals;
      await this.emitSignals(signals);

      // Update prediction history
      const historyManager = getHistoryManager();
      for (const pred of this.latestPredictions) {
        const relatedSignals = signals
          .filter(s => s.data.predictionId === pred.marketId)
          .map(s => s.type);
        await historyManager.addSnapshot(pred.marketId, pred, relatedSignals);
      }
    }
  }

  // ============================================================================
  // EMITTERS
  // ============================================================================

  private async emitData(data: NormalizedData[]): Promise<void> {
    for (const callback of this.dataCallbacks) {
      try {
        await callback(data);
      } catch (error) {
        console.error('[DataHook] Error in data callback:', error);
      }
    }
  }

  private async emitSignals(signals: CorrelationSignal[]): Promise<void> {
    for (const callback of this.signalCallbacks) {
      try {
        await callback(signals);
      } catch (error) {
        console.error('[DataHook] Error in signal callback:', error);
      }
    }
  }

  private async emitContext(context: PricingContext): Promise<void> {
    for (const callback of this.contextCallbacks) {
      try {
        await callback(context);
      } catch (error) {
        console.error('[DataHook] Error in context callback:', error);
      }
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get latest normalized data
   */
  getLatestData(): {
    news: NormalizedNews[];
    markets: NormalizedMarket[];
    predictions: NormalizedPrediction[];
    economic: NormalizedEconomic[];
    conflicts: NormalizedConflict[];
  } {
    return {
      news: this.latestNews,
      markets: this.latestMarkets,
      predictions: this.latestPredictions,
      economic: this.latestEconomic,
      conflicts: this.latestConflicts,
    };
  }

  /**
   * Get latest signals
   */
  getLatestSignals(): CorrelationSignal[] {
    return this.lastSignals;
  }

  /**
   * Build pricing context for a specific prediction
   */
  async getContextForPrediction(predictionId: string): Promise<PricingContext | null> {
    const prediction = this.latestPredictions.find(p => p.marketId === predictionId);
    if (!prediction) return null;

    return buildPricingContext(
      prediction,
      this.latestNews,
      this.latestMarkets,
      this.latestEconomic,
      this.latestConflicts,
      this.lastSignals
    );
  }

  /**
   * Manually push data into the hook (for testing or manual ingestion)
   */
  async pushData(feedName: string, raw: unknown): Promise<NormalizedData[]> {
    return this.processRawData(feedName, raw);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultHook: DataHook | null = null;

export function getDataHook(config?: Partial<NormalizerConfig>): DataHook {
  if (!defaultHook) {
    defaultHook = new DataHook(config);
  }
  return defaultHook;
}

export function resetDataHook(): void {
  if (defaultHook) {
    defaultHook.stop();
    defaultHook = null;
  }
}
