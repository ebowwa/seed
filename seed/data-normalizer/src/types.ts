/**
 * Data Normalizer Types
 *
 * Standardized types for normalized worldmonitor data feeds.
 * These types are designed for use in calculating pricing mismatches
 * between real-world data and prediction market odds.
 */

// ============================================================================
// TOPIC CATEGORIES
// ============================================================================

export type TopicCategory =
  | 'geopolitics'
  | 'economics'
  | 'finance'
  | 'defense'
  | 'technology'
  | 'energy'
  | 'climate'
  | 'health'
  | 'elections'
  | 'regulation'
  | 'crypto'
  | 'commodities';

// ============================================================================
// NORMALIZED DATA TYPES
// ============================================================================

/**
 * Base structure for all normalized data points
 */
export interface NormalizedDataPoint {
  id: string;
  timestamp: Date;
  source: string;
  category: TopicCategory;
  confidence: number; // 0-1 confidence in data quality
  raw?: unknown; // Original raw data for debugging
}

/**
 * Normalized news/event data
 */
export interface NormalizedNews extends NormalizedDataPoint {
  type: 'news';
  title: string;
  summary?: string;
  entities: string[]; // Countries, companies, people mentioned
  topics: string[]; // Topic keywords
  sentiment?: 'positive' | 'negative' | 'neutral';
  impactScore?: number; // 0-10 scale of potential market impact
  sourceTier: 1 | 2 | 3 | 4;
  sourceType: 'wire' | 'gov' | 'intel' | 'mainstream' | 'market' | 'tech' | 'other';
  velocity?: number; // Sources per hour (if clustered)
  isAlert: boolean;
}

/**
 * Normalized market data (stocks, commodities, crypto)
 */
export interface NormalizedMarket extends NormalizedDataPoint {
  type: 'market';
  symbol: string;
  name: string;
  price: number;
  change: number; // Percent change
  changeAbs: number; // Absolute change
  volume?: number;
  marketCap?: number;
  sector?: string;
  exchange?: string;
}

/**
 * Normalized prediction market data
 */
export interface NormalizedPrediction extends NormalizedDataPoint {
  type: 'prediction';
  platform: 'kalshi' | 'polymarket';
  marketId: string;
  title: string;
  description?: string;
  yesPrice: number; // 0-100 (cents or percentage)
  noPrice: number; // 0-100
  volume?: number;
  liquidity?: number;
  endDate?: Date;
  resolvedOutcome?: 'yes' | 'no' | null;
  category: TopicCategory;
  tags?: string[];
}

/**
 * Normalized economic indicator data
 */
export interface NormalizedEconomic extends NormalizedDataPoint {
  type: 'economic';
  indicator: string; // e.g., 'CPI', 'GDP', 'Unemployment'
  country: string;
  value: number;
  previousValue?: number;
  expectedValue?: number;
  unit: string;
  period: string; // e.g., '2024-Q1', '2024-01'
}

/**
 * Normalized conflict/crisis event
 */
export interface NormalizedConflict extends NormalizedDataPoint {
  type: 'conflict';
  location: {
    country: string;
    region?: string;
    lat?: number;
    lon?: number;
  };
  eventType: 'armed_conflict' | 'protest' | 'terror' | 'disaster' | 'humanitarian';
  severity: 1 | 2 | 3 | 4 | 5;
  casualties?: number;
  actors?: string[];
  description: string;
}

// ============================================================================
// CORRELATION & SIGNAL TYPES
// ============================================================================

export type SignalType =
  | 'prediction_leads_news' // Prediction moved before news
  | 'news_leads_markets' // News broke before market moved
  | 'silent_divergence' // Market moved without news
  | 'velocity_spike' // News velocity spike detected
  | 'convergence' // Multiple source types converging
  | 'triangulation' // Wire + Gov + Intel agreement
  | 'pricing_mismatch'; // Detected pricing anomaly

/**
 * Correlation signal for market analysis
 */
export interface CorrelationSignal {
  id: string;
  type: SignalType;
  timestamp: Date;
  title: string;
  description: string;
  confidence: number;
  data: {
    predictionId?: string;
    predictionTitle?: string;
    predictionPrice?: number;
    newsIds?: string[];
    newsVelocity?: number;
    marketSymbol?: string;
    marketChange?: number;
    relatedTopics?: string[];
    explanation?: string;
  };
}

// ============================================================================
// HISTORY & OUTCOME TRACKING
// ============================================================================

export type OutcomeStatus = 'pending' | 'resolved_yes' | 'resolved_no' | 'cancelled';

/**
 * Historical record for tracking predictions vs outcomes
 */
export interface PredictionHistoryRecord {
  id: string;
  predictionId: string;
  platform: 'kalshi' | 'polymarket';
  title: string;
  category: TopicCategory;

  // Pricing history snapshots
  snapshots: Array<{
    timestamp: Date;
    yesPrice: number;
    noPrice: number;
    volume?: number;
    newsVelocity?: number;
    signals?: SignalType[];
  }>;

  // Outcome
  endDate: Date;
  status: OutcomeStatus;
  resolvedOutcome?: 'yes' | 'no';
  resolvedAt?: Date;

  // Analysis metrics
  finalYesPrice?: number;
  priceAccuracy?: number; // How close final price was to outcome
  signalsTriggered?: SignalType[];

  // Related real-world data at resolution time
  relatedNews?: string[];
  relatedMarketData?: Array<{
    symbol: string;
    change: number;
  }>;
}

/**
 * Context bundle for pricing analysis
 */
export interface PricingContext {
  timestamp: Date;
  prediction: NormalizedPrediction;
  relatedNews: NormalizedNews[];
  relatedMarkets: NormalizedMarket[];
  relatedEconomic?: NormalizedEconomic[];
  relatedConflicts?: NormalizedConflict[];
  activeSignals: CorrelationSignal[];
  historicalContext?: {
    similarPredictions: PredictionHistoryRecord[];
    averageAccuracy: number;
  };
}

// ============================================================================
// DATA FEED CONFIGURATION
// ============================================================================

export interface DataFeedConfig {
  name: string;
  url: string;
  category: TopicCategory;
  pollIntervalMs: number;
  enabled: boolean;
  transform?: string; // Name of transform function to apply
}

export interface NormalizerConfig {
  worldmonitorBaseUrl: string;
  predictionMarketsBaseUrl: {
    kalshi: string;
    polymarket: string;
  };
  feeds: DataFeedConfig[];
  historyRetentionDays: number;
  signalThresholds: {
    predictionShiftThreshold: number; // % change to trigger signal
    newsVelocityThreshold: number;
    marketMoveThreshold: number;
  };
}

// ============================================================================
// UNION TYPES
// ============================================================================

export type NormalizedData =
  | NormalizedNews
  | NormalizedMarket
  | NormalizedPrediction
  | NormalizedEconomic
  | NormalizedConflict;

export const isNormalizedNews = (d: NormalizedData): d is NormalizedNews => d.type === 'news';
export const isNormalizedMarket = (d: NormalizedData): d is NormalizedMarket => d.type === 'market';
export const isNormalizedPrediction = (d: NormalizedData): d is NormalizedPrediction => d.type === 'prediction';
export const isNormalizedEconomic = (d: NormalizedData): d is NormalizedEconomic => d.type === 'economic';
export const isNormalizedConflict = (d: NormalizedData): d is NormalizedConflict => d.type === 'conflict';
