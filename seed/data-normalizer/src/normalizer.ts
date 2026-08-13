/**
 * Data Normalizer
 *
 * Transforms raw worldmonitor data feeds into standardized NormalizedData formats.
 * Acts as a hook to receive and process data for prediction market analysis.
 */

import type {
  NormalizedData,
  NormalizedNews,
  NormalizedMarket,
  NormalizedPrediction,
  NormalizedEconomic,
  NormalizedConflict,
  TopicCategory,
  CorrelationSignal,
  PricingContext,
  SignalType,
} from './types.js';
import { getHistoryManager } from './history.js';

// ============================================================================
// ID GENERATION
// ============================================================================

export function generateId(prefix: string, ...parts: (string | number)[]): string {
  const hash = parts.join('-').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  return `${prefix}-${hash.slice(0, 50)}`;
}

// ============================================================================
// CATEGORY MAPPING
// ============================================================================

const TOPIC_KEYWORDS: Record<TopicCategory, string[]> = {
  geopolitics: ['war', 'military', 'invasion', 'nato', 'sanctions', 'diplomacy', 'treaty', 'summit', 'elections', 'coup'],
  economics: ['gdp', 'inflation', 'cpi', 'unemployment', 'fed', 'central bank', 'interest rate', 'recession'],
  finance: ['stock', 'market', 's&p', 'nasdaq', 'dow', 'bond', 'yield', 'ipo', 'merger', 'acquisition'],
  defense: ['military', 'defense', 'weapons', 'missile', 'navy', 'army', 'air force', 'pentagon', 'nuclear'],
  technology: ['ai', 'tech', 'software', 'chip', 'semiconductor', 'startup', 'funding', 'openai', 'google', 'microsoft'],
  energy: ['oil', 'gas', 'pipeline', 'opec', 'lng', 'nuclear', 'renewable', 'solar', 'wind', 'uranium'],
  climate: ['climate', 'carbon', 'emission', 'weather', 'temperature', 'flood', 'drought', 'wildfire', 'hurricane'],
  health: ['health', 'disease', 'pandemic', 'who', 'fda', 'vaccine', 'outbreak', 'hospital'],
  elections: ['election', 'vote', 'poll', 'ballot', 'candidate', 'president', 'congress', 'senate', 'primary'],
  regulation: ['regulation', 'law', 'bill', 'court', 'ruling', 'policy', 'legislation', 'ban', 'fine', 'antitrust'],
  crypto: ['bitcoin', 'crypto', 'ethereum', 'blockchain', 'defi', 'nft', 'exchange', 'wallet', 'token'],
  commodities: ['gold', 'silver', 'copper', 'wheat', 'corn', 'soy', 'coffee', 'cotton', 'metal', 'mining'],
};

export function categorizeText(text: string): TopicCategory {
  const lower = text.toLowerCase();

  for (const [category, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category as TopicCategory;
    }
  }

  return 'geopolitics'; // Default category
}

// ============================================================================
// SOURCE TIER MAPPING
// ============================================================================

const SOURCE_TIERS: Record<string, 1 | 2 | 3 | 4> = {
  // Tier 1 - Wire Services
  'Reuters': 1, 'AP': 1, 'AFP': 1, 'Bloomberg': 1,
  // Tier 2 - Major Outlets
  'BBC': 2, 'Guardian': 2, 'NPR': 2, 'CNN': 2, 'CNBC': 2, 'Financial Times': 2,
  // Tier 3 - Specialty
  'Defense One': 3, 'Foreign Policy': 3, 'MIT Tech Review': 3,
  // Tier 4 - Aggregators
  'Hacker News': 4, 'Reddit': 4,
};

const SOURCE_TYPES: Record<string, 'wire' | 'gov' | 'intel' | 'mainstream' | 'market' | 'tech' | 'other'> = {
  'Reuters': 'wire', 'AP': 'wire', 'AFP': 'wire', 'Bloomberg': 'wire',
  'White House': 'gov', 'State Dept': 'gov', 'Pentagon': 'gov', 'UN': 'gov',
  'Defense One': 'intel', 'CSIS': 'intel', 'RAND': 'intel', 'Bellingcat': 'intel',
  'BBC': 'mainstream', 'CNN': 'mainstream', 'Guardian': 'mainstream',
  'CNBC': 'market', 'MarketWatch': 'market', 'Yahoo Finance': 'market',
  'Hacker News': 'tech', 'TechCrunch': 'tech', 'The Verge': 'tech',
};

export function getSourceTier(source: string): 1 | 2 | 3 | 4 {
  for (const [name, tier] of Object.entries(SOURCE_TIERS)) {
    if (source.toLowerCase().includes(name.toLowerCase())) {
      return tier;
    }
  }
  return 4;
}

export function getSourceType(source: string): 'wire' | 'gov' | 'intel' | 'mainstream' | 'market' | 'tech' | 'other' {
  for (const [name, type] of Object.entries(SOURCE_TYPES)) {
    if (source.toLowerCase().includes(name.toLowerCase())) {
      return type;
    }
  }
  return 'other';
}

// ============================================================================
// NORMALIZER FUNCTIONS
// ============================================================================

/**
 * Normalize news item from worldmonitor format
 */
export function normalizeNews(raw: {
  source: string;
  title: string;
  link?: string;
  pubDate?: string | Date;
  isAlert?: boolean;
  velocity?: number;
  clusterId?: string;
}): NormalizedNews {
  const title = raw.title;
  const source = raw.source;
  const pubDate = raw.pubDate ? new Date(raw.pubDate) : new Date();

  return {
    id: generateId('news', pubDate.getTime(), title.slice(0, 20)),
    type: 'news',
    timestamp: pubDate,
    source,
    category: categorizeText(title),
    confidence: getSourceTier(source) <= 2 ? 0.9 : 0.7,
    title,
    entities: extractEntities(title),
    topics: extractTopics(title),
    sourceTier: getSourceTier(source),
    sourceType: getSourceType(source),
    velocity: raw.velocity,
    isAlert: raw.isAlert ?? false,
  };
}

/**
 * Normalize market data from worldmonitor format
 */
export function normalizeMarket(raw: {
  symbol: string;
  name?: string;
  price?: number | null;
  change?: number | null;
  volume?: number;
  marketCap?: number;
}): NormalizedMarket {
  const price = raw.price ?? 0;
  const change = raw.change ?? 0;

  return {
    id: generateId('mkt', raw.symbol),
    type: 'market',
    timestamp: new Date(),
    source: 'market-feed',
    category: categorizeText(raw.name ?? raw.symbol),
    confidence: 0.95,
    symbol: raw.symbol,
    name: raw.name ?? raw.symbol,
    price,
    change,
    changeAbs: price * (change / 100),
    volume: raw.volume,
    marketCap: raw.marketCap,
  };
}

/**
 * Normalize prediction market data from Kalshi or Polymarket
 */
export function normalizePrediction(raw: {
  platform: 'kalshi' | 'polymarket';
  marketId: string;
  title: string;
  description?: string;
  yesPrice: number;
  noPrice?: number;
  volume?: number;
  liquidity?: number;
  endDate?: string | Date;
  category?: string;
  tags?: string[];
}): NormalizedPrediction {
  const yesPrice = raw.yesPrice;
  const noPrice = raw.noPrice ?? (100 - yesPrice);

  return {
    id: generateId('pred', raw.platform, raw.marketId),
    type: 'prediction',
    timestamp: new Date(),
    source: raw.platform,
    category: raw.category ? categorizeText(raw.category) : categorizeText(raw.title),
    confidence: 0.9,
    platform: raw.platform,
    marketId: raw.marketId,
    title: raw.title,
    description: raw.description,
    yesPrice,
    noPrice,
    volume: raw.volume,
    liquidity: raw.liquidity,
    endDate: raw.endDate ? new Date(raw.endDate) : undefined,
    tags: raw.tags,
  };
}

/**
 * Normalize economic indicator data
 */
export function normalizeEconomic(raw: {
  indicator: string;
  country: string;
  value: number;
  previousValue?: number;
  expectedValue?: number;
  unit?: string;
  period: string;
}): NormalizedEconomic {
  return {
    id: generateId('econ', raw.indicator, raw.country, raw.period),
    type: 'economic',
    timestamp: new Date(),
    source: 'economic-feed',
    category: 'economics',
    confidence: 0.95,
    indicator: raw.indicator,
    country: raw.country,
    value: raw.value,
    previousValue: raw.previousValue,
    expectedValue: raw.expectedValue,
    unit: raw.unit ?? '',
    period: raw.period,
  };
}

/**
 * Normalize conflict/crisis event data
 */
export function normalizeConflict(raw: {
  country: string;
  region?: string;
  eventType: 'armed_conflict' | 'protest' | 'terror' | 'disaster' | 'humanitarian';
  severity: 1 | 2 | 3 | 4 | 5;
  casualties?: number;
  actors?: string[];
  description: string;
  lat?: number;
  lon?: number;
  timestamp?: string | Date;
}): NormalizedConflict {
  return {
    id: generateId('conflict', raw.country, raw.eventType, Date.now()),
    type: 'conflict',
    timestamp: raw.timestamp ? new Date(raw.timestamp) : new Date(),
    source: 'conflict-feed',
    category: 'geopolitics',
    confidence: 0.8,
    location: {
      country: raw.country,
      region: raw.region,
      lat: raw.lat,
      lon: raw.lon,
    },
    eventType: raw.eventType,
    severity: raw.severity,
    casualties: raw.casualties,
    actors: raw.actors,
    description: raw.description,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractEntities(text: string): string[] {
  // Simple entity extraction - capitalize words that might be entities
  const words = text.split(/\s+/);
  const entities: string[] = [];

  for (const word of words) {
    if (/^[A-Z][a-z]+$/.test(word) && word.length > 2) {
      entities.push(word);
    }
  }

  return [...new Set(entities)].slice(0, 10);
}

function extractTopics(text: string): string[] {
  const lower = text.toLowerCase();
  const topics: string[] = [];

  for (const [category, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw) && !topics.includes(kw)) {
        topics.push(kw);
      }
    }
  }

  return topics.slice(0, 5);
}

// ============================================================================
// SIGNAL DETECTION
// ============================================================================

const PREDICTION_SHIFT_THRESHOLD = 5; // 5% price change
const NEWS_VELOCITY_THRESHOLD = 3; // 3 sources per hour
const MARKET_MOVE_THRESHOLD = 2; // 2% market move

export function detectSignals(
  predictions: NormalizedPrediction[],
  news: NormalizedNews[],
  markets: NormalizedMarket[],
  previousState?: {
    predictions: Map<string, number>;
    newsVelocity: Map<string, number>;
    marketChanges: Map<string, number>;
  }
): CorrelationSignal[] {
  const signals: CorrelationSignal[] = [];
  const now = new Date();

  // Detect prediction shifts without news
  for (const pred of predictions) {
    const prevPrice = previousState?.predictions.get(pred.marketId);
    if (prevPrice !== undefined) {
      const shift = Math.abs(pred.yesPrice - prevPrice);
      if (shift >= PREDICTION_SHIFT_THRESHOLD) {
        // Check for related news
        const relatedNews = news.filter(n =>
          n.topics.some(t => pred.title.toLowerCase().includes(t.toLowerCase())) ||
          pred.tags?.some(t => n.title.toLowerCase().includes(t.toLowerCase()))
        );

        if (relatedNews.length === 0) {
          signals.push({
            id: generateId('sig', 'pred-shift', pred.marketId, now.getTime()),
            type: 'prediction_leads_news',
            timestamp: now,
            title: `Prediction Shift: ${pred.title.slice(0, 50)}`,
            description: `${pred.title.slice(0, 80)} moved ${shift.toFixed(1)}% with no recent news`,
            confidence: Math.min(0.9, 0.5 + shift / 20),
            data: {
              predictionId: pred.marketId,
              predictionTitle: pred.title,
              predictionPrice: pred.yesPrice,
              newsVelocity: 0,
            },
          });
        }
      }
    }
  }

  // Detect market moves without news
  for (const market of markets) {
    if (Math.abs(market.change) >= MARKET_MOVE_THRESHOLD) {
      const relatedNews = news.filter(n =>
        n.title.toLowerCase().includes(market.symbol.toLowerCase()) ||
        n.title.toLowerCase().includes(market.name.toLowerCase())
      );

      if (relatedNews.length === 0) {
        signals.push({
          id: generateId('sig', 'silent-div', market.symbol, now.getTime()),
          type: 'silent_divergence',
          timestamp: now,
          title: `Silent Divergence: ${market.symbol}`,
          description: `${market.name} moved ${market.change > 0 ? '+' : ''}${market.change.toFixed(2)}% without news`,
          confidence: Math.min(0.85, 0.4 + Math.abs(market.change) / 10),
          data: {
            marketSymbol: market.symbol,
            marketChange: market.change,
            newsVelocity: 0,
          },
        });
      }
    }
  }

  // Detect news velocity spikes
  for (const item of news) {
    if ((item.velocity ?? 0) >= NEWS_VELOCITY_THRESHOLD) {
      signals.push({
        id: generateId('sig', 'vel-spike', item.id, now.getTime()),
        type: 'velocity_spike',
        timestamp: now,
        title: `News Velocity: ${item.title.slice(0, 40)}`,
        description: `"${item.title.slice(0, 60)}" trending at ${item.velocity} sources/hour`,
        confidence: Math.min(0.9, 0.5 + (item.velocity ?? 0) / 10),
        data: {
          newsIds: [item.id],
          newsVelocity: item.velocity,
          relatedTopics: item.topics,
        },
      });
    }
  }

  return signals;
}

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

export async function buildPricingContext(
  prediction: NormalizedPrediction,
  allNews: NormalizedNews[],
  allMarkets: NormalizedMarket[],
  allEconomic: NormalizedEconomic[],
  allConflicts: NormalizedConflict[],
  signals: CorrelationSignal[]
): Promise<PricingContext> {
  // Find related items
  const predKeywords = [
    ...prediction.title.toLowerCase().split(/\s+/),
    ...(prediction.tags ?? []),
  ].filter(w => w.length > 3);

  const relatedNews = allNews.filter(n =>
    predKeywords.some(kw =>
      n.title.toLowerCase().includes(kw) ||
      n.topics.some(t => t.includes(kw))
    )
  ).slice(0, 10);

  const relatedMarkets = allMarkets.filter(m =>
    predKeywords.some(kw =>
      m.name.toLowerCase().includes(kw) ||
      m.symbol.toLowerCase().includes(kw)
    )
  ).slice(0, 5);

  const relatedEconomic = allEconomic.filter(e =>
    predKeywords.some(kw =>
      e.indicator.toLowerCase().includes(kw) ||
      e.country.toLowerCase().includes(kw)
    )
  ).slice(0, 3);

  const relatedConflicts = allConflicts.filter(c =>
    predKeywords.some(kw =>
      c.location.country.toLowerCase().includes(kw) ||
      c.actors?.some(a => a.toLowerCase().includes(kw))
    )
  ).slice(0, 3);

  // Get historical context
  const historyManager = getHistoryManager();
  const historicalContext = await historyManager.getSimilarContext(
    prediction.category,
    predKeywords
  );

  // Filter relevant signals
  const activeSignals = signals.filter(s =>
    s.data.predictionId === prediction.marketId ||
    s.data.relatedTopics?.some(t => predKeywords.includes(t.toLowerCase()))
  );

  return {
    timestamp: new Date(),
    prediction,
    relatedNews,
    relatedMarkets,
    relatedEconomic,
    relatedConflicts,
    activeSignals,
    historicalContext,
  };
}
