/**
 * Prediction History Manager
 *
 * Tracks prediction market odds history and compares against actual outcomes.
 * Used for calculating pricing mismatches and accuracy metrics.
 */

import type {
  PredictionHistoryRecord,
  NormalizedPrediction,
  NormalizedNews,
  NormalizedMarket,
  CorrelationSignal,
  SignalType,
  OutcomeStatus,
  TopicCategory,
} from './types.js';

// ============================================================================
// STORAGE INTERFACE
// ============================================================================

export interface HistoryStorage {
  save(record: PredictionHistoryRecord): Promise<void>;
  get(id: string): Promise<PredictionHistoryRecord | null>;
  getByPredictionId(predictionId: string): Promise<PredictionHistoryRecord | null>;
  getByCategory(category: TopicCategory, limit?: number): Promise<PredictionHistoryRecord[]>;
  getRecent(limit?: number): Promise<PredictionHistoryRecord[]>;
  getResolved(limit?: number): Promise<PredictionHistoryRecord[]>;
  update(id: string, updates: Partial<PredictionHistoryRecord>): Promise<void>;
  delete(id: string): Promise<void>;
}

// ============================================================================
// IN-MEMORY STORAGE (Default)
// ============================================================================

export class InMemoryHistoryStorage implements HistoryStorage {
  private records: Map<string, PredictionHistoryRecord> = new Map();
  private byPredictionId: Map<string, string> = new Map(); // predictionId -> recordId

  async save(record: PredictionHistoryRecord): Promise<void> {
    this.records.set(record.id, record);
    this.byPredictionId.set(record.predictionId, record.id);
  }

  async get(id: string): Promise<PredictionHistoryRecord | null> {
    return this.records.get(id) ?? null;
  }

  async getByPredictionId(predictionId: string): Promise<PredictionHistoryRecord | null> {
    const recordId = this.byPredictionId.get(predictionId);
    if (!recordId) return null;
    return this.records.get(recordId) ?? null;
  }

  async getByCategory(category: TopicCategory, limit = 100): Promise<PredictionHistoryRecord[]> {
    const results = Array.from(this.records.values())
      .filter(r => r.category === category)
      .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())
      .slice(0, limit);
    return results;
  }

  async getRecent(limit = 100): Promise<PredictionHistoryRecord[]> {
    const results = Array.from(this.records.values())
      .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())
      .slice(0, limit);
    return results;
  }

  async getResolved(limit = 100): Promise<PredictionHistoryRecord[]> {
    const results = Array.from(this.records.values())
      .filter(r => r.status !== 'pending')
      .sort((a, b) => (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0))
      .slice(0, limit);
    return results;
  }

  async update(id: string, updates: Partial<PredictionHistoryRecord>): Promise<void> {
    const existing = this.records.get(id);
    if (!existing) return;
    this.records.set(id, { ...existing, ...updates });
  }

  async delete(id: string): Promise<void> {
    const record = this.records.get(id);
    if (record) {
      this.byPredictionId.delete(record.predictionId);
    }
    this.records.delete(id);
  }
}

// ============================================================================
// HISTORY MANAGER
// ============================================================================

export class PredictionHistoryManager {
  private storage: HistoryStorage;
  private snapshotIntervalMs: number;

  constructor(storage?: HistoryStorage, snapshotIntervalMs = 60000) {
    this.storage = storage ?? new InMemoryHistoryStorage();
    this.snapshotIntervalMs = snapshotIntervalMs;
  }

  /**
   * Create a new history record for a prediction
   */
  async createRecord(prediction: NormalizedPrediction): Promise<PredictionHistoryRecord> {
    const record: PredictionHistoryRecord = {
      id: `hist-${prediction.platform}-${prediction.marketId}`,
      predictionId: prediction.marketId,
      platform: prediction.platform,
      title: prediction.title,
      category: prediction.category,
      snapshots: [{
        timestamp: prediction.timestamp,
        yesPrice: prediction.yesPrice,
        noPrice: prediction.noPrice,
        volume: prediction.volume,
      }],
      endDate: prediction.endDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
      status: 'pending',
      signalsTriggered: [],
    };

    await this.storage.save(record);
    return record;
  }

  /**
   * Add a price snapshot to an existing record
   */
  async addSnapshot(
    predictionId: string,
    prediction: NormalizedPrediction,
    signals?: SignalType[]
  ): Promise<void> {
    const record = await this.storage.getByPredictionId(predictionId);
    if (!record) {
      await this.createRecord(prediction);
      return;
    }

    const lastSnapshot = record.snapshots[record.snapshots.length - 1];
    const now = new Date();

    // Only add snapshot if enough time has passed
    if (lastSnapshot && now.getTime() - lastSnapshot.timestamp.getTime() < this.snapshotIntervalMs) {
      return;
    }

    record.snapshots.push({
      timestamp: now,
      yesPrice: prediction.yesPrice,
      noPrice: prediction.noPrice,
      volume: prediction.volume,
      signals,
    });

    await this.storage.update(record.id, { snapshots: record.snapshots });
  }

  /**
   * Record a resolved outcome
   */
  async recordOutcome(
    predictionId: string,
    outcome: 'yes' | 'no',
    relatedNews?: NormalizedNews[],
    relatedMarketData?: NormalizedMarket[]
  ): Promise<void> {
    const record = await this.storage.getByPredictionId(predictionId);
    if (!record) return;

    const finalSnapshot = record.snapshots[record.snapshots.length - 1];
    const finalYesPrice = finalSnapshot?.yesPrice ?? 0;

    // Calculate accuracy: how close was the price to the outcome?
    // If outcome is YES, perfect accuracy is 100 (yesPrice)
    // If outcome is NO, perfect accuracy is 0 (yesPrice)
    const priceAccuracy = outcome === 'yes'
      ? finalYesPrice / 100
      : (100 - finalYesPrice) / 100;

    await this.storage.update(record.id, {
      status: outcome === 'yes' ? 'resolved_yes' : 'resolved_no' as OutcomeStatus,
      resolvedOutcome: outcome,
      resolvedAt: new Date(),
      finalYesPrice,
      priceAccuracy,
      relatedNews: relatedNews?.map(n => n.id),
      relatedMarketData: relatedMarketData?.map(m => ({
        symbol: m.symbol,
        change: m.change,
      })),
    });
  }

  /**
   * Get similar predictions for context
   */
  async getSimilarContext(
    category: TopicCategory,
    keywords?: string[],
    limit = 5
  ): Promise<{
    similarPredictions: PredictionHistoryRecord[];
    averageAccuracy: number;
  }> {
    const records = await this.storage.getByCategory(category, 50);

    // Filter by keyword matching if provided
    let filtered = records;
    if (keywords && keywords.length > 0) {
      filtered = records.filter(r =>
        keywords.some(kw =>
          r.title.toLowerCase().includes(kw.toLowerCase())
        )
      );
    }

    const similarPredictions = filtered.slice(0, limit);

    // Calculate average accuracy of resolved predictions
    const resolved = similarPredictions.filter(r => r.priceAccuracy !== undefined);
    const averageAccuracy = resolved.length > 0
      ? resolved.reduce((sum, r) => sum + (r.priceAccuracy ?? 0), 0) / resolved.length
      : 0;

    return { similarPredictions, averageAccuracy };
  }

  /**
   * Get accuracy metrics by category
   */
  async getAccuracyByCategory(): Promise<Map<TopicCategory, {
    total: number;
    correct: number;
    averageAccuracy: number;
  }>> {
    const resolved = await this.storage.getResolved(1000);
    const byCategory = new Map<TopicCategory, {
      total: number;
      correct: number;
      accuracies: number[];
    }>();

    for (const record of resolved) {
      const existing = byCategory.get(record.category) ?? {
        total: 0,
        correct: 0,
        accuracies: [],
      };

      existing.total++;
      if (record.priceAccuracy !== undefined) {
        existing.accuracies.push(record.priceAccuracy);
        // "Correct" if prediction was > 50% for YES outcome or < 50% for NO outcome
        if (
          (record.resolvedOutcome === 'yes' && record.finalYesPrice && record.finalYesPrice > 50) ||
          (record.resolvedOutcome === 'no' && record.finalYesPrice && record.finalYesPrice < 50)
        ) {
          existing.correct++;
        }
      }

      byCategory.set(record.category, existing);
    }

    const result = new Map<TopicCategory, {
      total: number;
      correct: number;
      averageAccuracy: number;
    }>();

    for (const [category, data] of byCategory) {
      result.set(category, {
        total: data.total,
        correct: data.correct,
        averageAccuracy: data.accuracies.length > 0
          ? data.accuracies.reduce((a, b) => a + b, 0) / data.accuracies.length
          : 0,
      });
    }

    return result;
  }

  /**
   * Get pending predictions that need monitoring
   */
  async getPendingMonitoring(limit = 50): Promise<PredictionHistoryRecord[]> {
    const recent = await this.storage.getRecent(200);
    return recent
      .filter(r => r.status === 'pending')
      .filter(r => r.endDate.getTime() > Date.now()) // Not yet expired
      .slice(0, limit);
  }

  /**
   * Check for predictions that should be resolved
   */
  async getExpiredPending(): Promise<PredictionHistoryRecord[]> {
    const recent = await this.storage.getRecent(200);
    const now = Date.now();
    return recent.filter(r =>
      r.status === 'pending' &&
      r.endDate.getTime() <= now
    );
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let defaultManager: PredictionHistoryManager | null = null;

export function getHistoryManager(storage?: HistoryStorage): PredictionHistoryManager {
  if (!defaultManager) {
    defaultManager = new PredictionHistoryManager(storage);
  }
  return defaultManager;
}

export function resetHistoryManager(): void {
  defaultManager = null;
}
