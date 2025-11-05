// ========================================
// Binance Market Data Integration
// ========================================

import { fetchWithProxy } from './http-client';

export interface KlineData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface MarketData {
  symbol: string;
  current_price: number;
  price_change_1h: number;
  price_change_4h: number;
  current_ema20: number;
  current_macd: number;
  current_rsi7: number;
  current_rsi14: number;
  volume_24h: number;
  oi_value: number;

  // 日内数据（3分钟）
  intraday_series: {
    mid_prices: number[];
    ema20_values: number[];
    macd_values: number[];
    rsi7_values: number[];
    rsi14_values: number[];
  };

  // 长期数据（4小时）
  longer_term_context: {
    ema20: number;
    ema50: number;
    current_volume: number;
    average_volume: number;
    macd_values: number[];
    rsi14_values: number[];
  };
}

const BINANCE_BASE_URL = 'https://fapi.binance.com';

// ========================================
// Binance API Functions
// ========================================

async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number
): Promise<KlineData[]> {
  const url = `${BINANCE_BASE_URL}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  try {
    console.log(`[fetchKlines] Calling: ${url}`);
    const response = await fetchWithProxy(url);
    console.log(`[fetchKlines] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[fetchKlines] Error response: ${errorText}`);
      throw new Error(`Failed to fetch klines for ${symbol}: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[fetchKlines] Received ${data.length} candles for ${symbol}`);

    return data.map((k: any) => ({
      openTime: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
    }));
  } catch (error) {
    console.error(`[fetchKlines] Exception:`, error);
    throw error;
  }
}

async function fetchOpenInterest(symbol: string): Promise<number> {
  try {
    const url = `${BINANCE_BASE_URL}/fapi/v1/openInterest?symbol=${symbol}`;
    const response = await fetchWithProxy(url);
    if (!response.ok) return 0;

    const data = await response.json();
    const oi = parseFloat(data.openInterest);

    // Get current price to calculate OI value
    const ticker = await fetchTicker(symbol);
    const oiValue = oi * ticker.lastPrice;

    return oiValue / 1_000_000; // Convert to millions
  } catch (error) {
    console.warn(`Failed to fetch OI for ${symbol}:`, error);
    return 0;
  }
}

async function fetchTicker(symbol: string): Promise<{ lastPrice: number; volume: number }> {
  const url = `${BINANCE_BASE_URL}/fapi/v1/ticker/24hr?symbol=${symbol}`;
  const response = await fetchWithProxy(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ticker for ${symbol}: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    lastPrice: parseFloat(data.lastPrice),
    volume: parseFloat(data.quoteVolume),
  };
}

// ========================================
// Technical Indicators
// ========================================

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;

  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

function calculateEMASeries(prices: number[], period: number): number[] {
  if (prices.length < period) return [];

  const multiplier = 2 / (period + 1);
  const result: number[] = [];

  // Initial SMA
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;
  result.push(ema);

  // Calculate EMA for remaining prices
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
    result.push(ema);
  }

  return result;
}

function calculateMACD(klines: KlineData[]): number {
  const closes = klines.map(k => k.close);
  if (closes.length < 26) return 0;

  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  return ema12 - ema26;
}

function calculateMACDSeries(klines: KlineData[]): number[] {
  const closes = klines.map(k => k.close);
  if (closes.length < 26) return [];

  const ema12Series = calculateEMASeries(closes, 12);
  const ema26Series = calculateEMASeries(closes, 26);

  const macdSeries: number[] = [];
  const minLength = Math.min(ema12Series.length, ema26Series.length);

  for (let i = 0; i < minLength; i++) {
    macdSeries.push(ema12Series[i] - ema26Series[i]);
  }

  return macdSeries;
}

function calculateRSI(klines: KlineData[], period: number): number {
  if (klines.length < period + 1) return 50;

  const closes = klines.map(k => k.close);
  const changes: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // Calculate subsequent averages
  for (let i = period; i < changes.length; i++) {
    if (changes[i] > 0) {
      avgGain = (avgGain * (period - 1) + changes[i]) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateRSISeries(klines: KlineData[], period: number): number[] {
  if (klines.length < period + 1) return [];

  const closes = klines.map(k => k.close);
  const changes: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  const rsiSeries: number[] = [];

  // Need at least 'period' changes to calculate first RSI
  for (let startIdx = period; startIdx <= changes.length; startIdx++) {
    let avgGain = 0;
    let avgLoss = 0;

    // Initial average for this window
    for (let i = startIdx - period; i < startIdx; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }

    avgGain /= period;
    avgLoss /= period;

    if (avgLoss === 0) {
      rsiSeries.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsiSeries.push(100 - (100 / (1 + rs)));
    }
  }

  return rsiSeries;
}

// ========================================
// Main Market Data Function
// ========================================

export async function getMarketData(symbol: string): Promise<MarketData> {
  try {
    // Normalize symbol (ensure USDT suffix)
    const normalizedSymbol = symbol.toUpperCase().includes('USDT')
      ? symbol.toUpperCase()
      : `${symbol.toUpperCase()}USDT`;

    console.log(`[getMarketData] Starting fetch for ${normalizedSymbol}...`);

  // Fetch K-line data
  const [klines3m, klines4h, ticker] = await Promise.all([
    fetchKlines(normalizedSymbol, '3m', 100), // 3-minute candles, last 100
    fetchKlines(normalizedSymbol, '4h', 60),  // 4-hour candles, last 60
    fetchTicker(normalizedSymbol),
  ]);

  // Get Open Interest
  const oiValue = await fetchOpenInterest(normalizedSymbol);

  // Calculate current indicators (based on 3m data)
  const currentPrice = klines3m[klines3m.length - 1].close;
  const currentEMA20 = calculateEMA(klines3m.map(k => k.close), 20);
  const currentMACD = calculateMACD(klines3m);
  const currentRSI7 = calculateRSI(klines3m, 7);
  const currentRSI14 = calculateRSI(klines3m, 14);

  // Calculate price changes
  let priceChange1h = 0;
  if (klines3m.length >= 21) {
    const price1hAgo = klines3m[klines3m.length - 21].close;
    priceChange1h = ((currentPrice - price1hAgo) / price1hAgo) * 100;
  }

  let priceChange4h = 0;
  if (klines4h.length >= 2) {
    const price4hAgo = klines4h[klines4h.length - 2].close;
    priceChange4h = ((currentPrice - price4hAgo) / price4hAgo) * 100;
  }

  // Calculate series data for 3m
  const midPrices = klines3m.map(k => k.close);
  const ema20Values = calculateEMASeries(midPrices, 20);
  const macdValues = calculateMACDSeries(klines3m);
  const rsi7Values = calculateRSISeries(klines3m, 7);
  const rsi14Values = calculateRSISeries(klines3m, 14);

  // Calculate 4h indicators
  const closes4h = klines4h.map(k => k.close);
  const ema20_4h = calculateEMA(closes4h, 20);
  const ema50_4h = calculateEMA(closes4h, 50);
  const macdValues4h = calculateMACDSeries(klines4h);
  const rsi14Values4h = calculateRSISeries(klines4h, 14);

  const volumes4h = klines4h.map(k => k.volume);
  const currentVolume = volumes4h[volumes4h.length - 1] || 0;
  const averageVolume = volumes4h.reduce((sum, v) => sum + v, 0) / volumes4h.length;

  return {
    symbol: normalizedSymbol,
    current_price: currentPrice,
    price_change_1h: priceChange1h,
    price_change_4h: priceChange4h,
    current_ema20: currentEMA20,
    current_macd: currentMACD,
    current_rsi7: currentRSI7,
    current_rsi14: currentRSI14,
    volume_24h: ticker.volume,
    oi_value: oiValue,

    intraday_series: {
      mid_prices: midPrices,
      ema20_values: ema20Values,
      macd_values: macdValues,
      rsi7_values: rsi7Values,
      rsi14_values: rsi14Values,
    },

    longer_term_context: {
      ema20: ema20_4h,
      ema50: ema50_4h,
      current_volume: currentVolume,
      average_volume: averageVolume,
      macd_values: macdValues4h,
      rsi14_values: rsi14Values4h,
    },
  };
  } catch (error) {
    console.error(`[getMarketData] Failed to fetch data for ${symbol}:`, error);
    throw error;
  }
}

// ========================================
// Batch Fetch for Multiple Symbols
// ========================================

export async function getMarketDataBatch(symbols: string[]): Promise<Record<string, MarketData>> {
  console.log(`📊 Fetching market data for ${symbols.length} symbols...`);

  const results: Record<string, MarketData> = {};

  // Fetch in parallel but with some delay to avoid rate limits
  const promises = symbols.map(async (symbol, index) => {
    // Add small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, index * 100));

    try {
      const data = await getMarketData(symbol);
      results[symbol] = data;
      console.log(`  ✓ ${symbol}: $${data.current_price.toFixed(2)}`);
    } catch (error) {
      console.error(`  ✗ ${symbol}: ${error instanceof Error ? error.message : error}`);
    }
  });

  await Promise.all(promises);

  console.log(`✓ Fetched ${Object.keys(results).length}/${symbols.length} symbols`);

  return results;
}

// ========================================
// Helper: Get Default Trading Symbols
// ========================================

export const DEFAULT_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
];

export async function getDefaultMarketData(): Promise<Record<string, MarketData>> {
  return await getMarketDataBatch(DEFAULT_SYMBOLS);
}
