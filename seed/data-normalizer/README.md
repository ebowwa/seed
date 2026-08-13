# @seed/data-normalizer

Data normalization hook for worldmonitor feeds. Transforms real-world data for prediction market pricing mismatch analysis.

## Purpose

This package acts as a data pipeline between worldmonitor's intelligence feeds and prediction market analysis tools. It:

1. **Hooks into worldmonitor** - Polls API endpoints for news, markets, predictions, and events
2. **Normalizes data** - Converts raw data into standardized formats
3. **Detects signals** - Identifies pricing mismatches and correlation signals
4. **Tracks history** - Maintains records of predictions vs actual outcomes

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  WorldMonitor   │────▶│  Data Normalizer │────▶│  Prediction       │
│  (data feeds)   │     │  (this package)  │     │  Market Analysis  │
└─────────────────┘     └──────────────────┘     └───────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   History    │
                        │   Storage    │
                        └──────────────┘
```

## Usage

### Basic Setup

```typescript
import { createPredictionAnalyzer } from '@seed/data-normalizer';

const analyzer = createPredictionAnalyzer({
  worldmonitorBaseUrl: 'http://localhost:5173',
  kalshiBaseUrl: 'http://localhost:3000',
  polymarketBaseUrl: 'http://localhost:3001',
});

// Listen for signals
analyzer.onSignal((signals) => {
  for (const signal of signals) {
    console.log(`[${signal.type}] ${signal.title}`);
    console.log(`  Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
  }
});

// Start polling
await analyzer.start();
```

### Manual Data Ingestion

```typescript
import {
  normalizePrediction,
  normalizeNews,
  detectSignals,
  buildPricingContext,
} from '@seed/data-normalizer';

// Normalize a prediction from Kalshi
const prediction = normalizePrediction({
  platform: 'kalshi',
  marketId: 'INFLATION-MONTHLY',
  title: 'Will CPI be above 3% in March?',
  yesPrice: 65, // 65 cents
  volume: 15000,
  category: 'economics',
});

// Normalize related news
const news = normalizeNews({
  source: 'Reuters',
  title: 'Fed signals potential rate cuts as inflation cools',
  pubDate: new Date(),
  isAlert: false,
});

// Detect signals
const signals = detectSignals([prediction], [news], [], undefined);

// Build full context for analysis
const context = await buildPricingContext(
  prediction,
  [news],
  [],
  [],
  [],
  signals
);
```

### Calculating Mismatches

```typescript
import { calculateMismatch } from '@seed/data-normalizer';

// Prediction says 65% YES
// Your analysis says 45% probability
const result = calculateMismatch(65, 0.45);

console.log(result);
// {
//   mismatchPercent: 20,
//   direction: 'overvalued',
//   recommendation: 'buy_no'
// }
```

### History Tracking

```typescript
import { getHistoryManager } from '@seed/data-normalizer';

const history = getHistoryManager();

// Get accuracy by category
const accuracy = await history.getAccuracyByCategory();
for (const [category, stats] of accuracy) {
  console.log(`${category}: ${(stats.averageAccuracy * 100).toFixed(1)}% accuracy`);
}

// Get similar predictions for context
const similar = await history.getSimilarContext('economics', ['cpi', 'inflation']);
console.log(`Found ${similar.similarPredictions.length} similar predictions`);
console.log(`Average accuracy: ${(similar.averageAccuracy * 100).toFixed(1)}%`);
```

## Data Types

### NormalizedPrediction
```typescript
interface NormalizedPrediction {
  id: string;
  timestamp: Date;
  platform: 'kalshi' | 'polymarket';
  marketId: string;
  title: string;
  yesPrice: number;  // 0-100
  noPrice: number;   // 0-100
  volume?: number;
  category: TopicCategory;
  // ...
}
```

### CorrelationSignal
```typescript
interface CorrelationSignal {
  id: string;
  type: SignalType;
  timestamp: Date;
  title: string;
  description: string;
  confidence: number;  // 0-1
  data: {
    predictionId?: string;
    predictionPrice?: number;
    newsVelocity?: number;
    // ...
  };
}
```

### Signal Types
- `prediction_leads_news` - Prediction moved before news coverage
- `news_leads_markets` - News broke before market moved
- `silent_divergence` - Market moved without corresponding news
- `velocity_spike` - Unusual news velocity detected
- `convergence` - Multiple source types agreeing
- `triangulation` - Wire + Gov + Intel alignment

## Configuration

```typescript
interface NormalizerConfig {
  worldmonitorBaseUrl: string;
  predictionMarketsBaseUrl: {
    kalshi: string;
    polymarket: string;
  };
  feeds: DataFeedConfig[];
  historyRetentionDays: number;
  signalThresholds: {
    predictionShiftThreshold: number;  // % change to trigger
    newsVelocityThreshold: number;     // sources/hour
    marketMoveThreshold: number;       // % market change
  };
}
```

## Integration with prediction-markets MCP

This package is designed to work with the `@seed/prediction-markets` MCP server:

```typescript
// In your MCP server or agent
import { getDataHook } from '@seed/data-normalizer';

const hook = getDataHook();

hook.onSignal(async (signals) => {
  for (const signal of signals) {
    if (signal.type === 'pricing_mismatch') {
      // Alert via MCP or take action
      await notifyAgent(signal);
    }
  }
});
```

## Development

```bash
# Build
bun run build

# Type check
bun run typecheck

# Test
bun test
```

## License

MIT
