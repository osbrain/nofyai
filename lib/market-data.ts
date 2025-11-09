// ========================================
// Binance Market Data Integration
// ========================================

import { fetchWithProxy } from './http-client';
import type { MarketData } from './ai';
import { getOICache } from './oi-cache';

export interface KlineData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;        // Base asset volume (e.g., BTC)
  closeTime: number;
  quoteVolume: number;   // Quote asset volume (e.g., USDT) - 用于成交量计算
}

const BINANCE_BASE_URL = 'https://fapi.binance.com';

// ========================================
// Binance API Functions
// ========================================

async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number,
  retries: number = 3
): Promise<KlineData[]> {
  const url = `${BINANCE_BASE_URL}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[fetchKlines] Attempt ${attempt}/${retries}: ${url}`);
      const response = await fetchWithProxy(url);
      console.log(`[fetchKlines] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fetchKlines] Error response: ${errorText}`);

        // If not last attempt, wait and retry
        if (attempt < retries) {
          const delay = attempt * 1000; // 1s, 2s, 3s
          console.log(`[fetchKlines] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw new Error(`Failed to fetch klines for ${symbol}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[fetchKlines] ✅ Received ${data.length} candles for ${symbol} ${interval}`);

      return data.map((k: any) => ({
        openTime: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),       // Base asset volume (BTC)
        closeTime: k[6],
        quoteVolume: parseFloat(k[7]),  // Quote asset volume (USDT) - 重要！
      }));
    } catch (error) {
      console.error(`[fetchKlines] ❌ Attempt ${attempt}/${retries} failed:`, error);

      // If not last attempt, wait and retry
      if (attempt < retries) {
        const delay = attempt * 1000;
        console.log(`[fetchKlines] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Last attempt failed, throw error
        throw error;
      }
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error(`Failed to fetch klines after ${retries} attempts`);
}

async function fetchOpenInterest(symbol: string): Promise<{ current: number; change_pct: number }> {
  try {
    const url = `${BINANCE_BASE_URL}/fapi/v1/openInterest?symbol=${symbol}`;
    const response = await fetchWithProxy(url);
    if (!response.ok) return { current: 0, change_pct: 0 };

    const data = await response.json();
    const oiQuantity = parseFloat(data.openInterest);

    // Get current price to calculate OI value
    const ticker = await fetchTicker(symbol);
    const oiValue = (oiQuantity * ticker.lastPrice) / 1_000_000; // Convert to millions

    // 使用OI缓存计算变化率（对比4小时前）
    const oiCache = getOICache();
    const oiChangePct = oiCache.calculateChange(symbol, oiValue, 4);

    // 保存当前OI到缓存
    oiCache.addRecord(symbol, oiValue, oiQuantity);

    const recordCount = oiCache.getRecordCount(symbol);
    if (recordCount > 1) {
      console.log(
        `[OI] ${symbol}: ${oiValue.toFixed(2)}M USD, 4h change: ${oiChangePct >= 0 ? '+' : ''}${oiChangePct.toFixed(2)}% (${recordCount} cached)`
      );
    }

    return {
      current: oiValue,
      change_pct: oiChangePct,
    };
  } catch (error) {
    console.warn(`Failed to fetch OI for ${symbol}:`, error);
    return { current: 0, change_pct: 0 };
  }
}

async function fetchTicker(symbol: string): Promise<{ lastPrice: number; volume: number; buySellRatio: number }> {
  const url = `${BINANCE_BASE_URL}/fapi/v1/ticker/24hr?symbol=${symbol}`;
  const response = await fetchWithProxy(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ticker for ${symbol}: ${response.statusText}`);
  }

  const data = await response.json();

  // Calculate Buy/Sell Ratio
  // BuySellRatio = 主动买入量 / 总成交量
  // 范围 0-1: >0.5 买方强, <0.5 卖方强
  const totalVolume = parseFloat(data.quoteVolume) || 1; // 防止除以0
  const buyVolume = parseFloat(data.takerBuyQuoteAssetVolume) || 0;
  const buySellRatio = totalVolume > 0 ? buyVolume / totalVolume : 0.5;

  return {
    lastPrice: parseFloat(data.lastPrice),
    volume: totalVolume,
    buySellRatio: buySellRatio,
  };
}

async function fetchFundingRate(symbol: string): Promise<number> {
  try {
    const url = `${BINANCE_BASE_URL}/fapi/v1/premiumIndex?symbol=${symbol}`;
    const response = await fetchWithProxy(url);
    if (!response.ok) return 0;

    const data = await response.json();
    return parseFloat(data.lastFundingRate || '0');
  } catch (error) {
    console.warn(`Failed to fetch funding rate for ${symbol}:`, error);
    return 0;
  }
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

function calculateMACD(klines: KlineData[]): number {
  const closes = klines.map(k => k.close);

  console.log(`[calculateMACD] Data length: ${closes.length}`);

  if (closes.length < 26) {
    console.warn(`[calculateMACD] Insufficient data: need 26, got ${closes.length} - returning 0`);
    return 0;
  }

  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12 - ema26;

  console.log(`[calculateMACD] EMA12=${ema12.toFixed(4)}, EMA26=${ema26.toFixed(4)}, MACD=${macd.toFixed(4)}`);

  return macd;
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

function calculateATR(klines: KlineData[], period: number = 14): number {
  if (klines.length < period + 1) return 0;

  const trueRanges: number[] = [];

  for (let i = 1; i < klines.length; i++) {
    const high = klines[i].high;
    const low = klines[i].low;
    const prevClose = klines[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    trueRanges.push(tr);
  }

  // Calculate average of last 'period' true ranges
  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((sum, tr) => sum + tr, 0) / period;
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

    // Fetch K-line data for multiple timeframes
    console.log(`[getMarketData] 🔄 Fetching K-line data for ${normalizedSymbol}...`);

    // 🎯 Split into batches to reduce concurrent load on proxy
    // Batch 1: K-lines (most important)
    const [klines15m, klines1h, klines4h, klines1d] = await Promise.all([
      fetchKlines(normalizedSymbol, '15m', 100), // 15-minute candles
      fetchKlines(normalizedSymbol, '1h', 100),  // 1-hour candles
      fetchKlines(normalizedSymbol, '4h', 60),   // 4-hour candles
      fetchKlines(normalizedSymbol, '1d', 100),  // 1-day candles
    ]);

    // Delay between batches to reduce proxy load
    await new Promise(resolve => setTimeout(resolve, 500));

    // Batch 2: Ticker and funding rate
    const [ticker, fundingRate] = await Promise.all([
      fetchTicker(normalizedSymbol),
      fetchFundingRate(normalizedSymbol),
    ]);

    // 🎯 Log fetched data lengths for debugging
    console.log(`[getMarketData] 📊 K-line data received:`, {
      symbol: normalizedSymbol,
      '15m': klines15m.length,
      '1h': klines1h.length,
      '4h': klines4h.length,
      '1d': klines1d.length
    });

    if (klines1h.length < 26) {
      console.warn(`[getMarketData] ⚠️ WARNING: 1h K-line data insufficient (${klines1h.length} < 26) - MACD will be 0`);
    }
    if (klines4h.length < 26) {
      console.warn(`[getMarketData] ⚠️ WARNING: 4h K-line data insufficient (${klines4h.length} < 26) - MACD will be 0`);
    }
    if (klines1d.length < 26) {
      console.warn(`[getMarketData] ⚠️ WARNING: 1d K-line data insufficient (${klines1d.length} < 26) - MACD will be 0`);
    }

    // Get Open Interest
    const oi = await fetchOpenInterest(normalizedSymbol);

    // Current price and OHLC (from 15m, most recent candle)
    const latestCandle = klines15m[klines15m.length - 1];
    const currentPrice = latestCandle.close;

    // Calculate multi-timeframe MACD
    const macd15m = calculateMACD(klines15m);
    const macd1h = calculateMACD(klines1h);
    const macd4h = calculateMACD(klines4h);
    const macd1d = calculateMACD(klines1d);

    // Calculate multi-timeframe RSI
    const rsi15m = calculateRSI(klines15m, 14);
    const rsi1h = calculateRSI(klines1h, 14);
    const rsi4h = calculateRSI(klines4h, 14);
    const rsi1d = calculateRSI(klines1d, 14);

    // Calculate EMA20 (based on 15m)
    const ema20 = calculateEMA(klines15m.map(k => k.close), 20);

    // Calculate ATR (based on 15m)
    const atr = calculateATR(klines15m, 14);

    // Calculate price changes
    // NOTE: currentPrice = klines15m[length-1].close (latest candle)
    // Compare to previous candle's close to get true time-period change
    let priceChange15m = 0;
    if (klines15m.length >= 2) {
      const price15mAgo = klines15m[klines15m.length - 2].close;
      priceChange15m = ((currentPrice - price15mAgo) / price15mAgo) * 100;
      console.log(`[getMarketData] ${normalizedSymbol} 15m change: ${currentPrice} vs ${price15mAgo} = ${priceChange15m.toFixed(4)}%`);
    }

    let priceChange1h = 0;
    if (klines1h.length >= 2) {
      const price1hAgo = klines1h[klines1h.length - 2].close;
      priceChange1h = ((currentPrice - price1hAgo) / price1hAgo) * 100;
      console.log(`[getMarketData] ${normalizedSymbol} 1h change: ${currentPrice} vs ${price1hAgo} = ${priceChange1h.toFixed(4)}%`);
    }

    let priceChange4h = 0;
    if (klines4h.length >= 2) {
      const price4hAgo = klines4h[klines4h.length - 2].close;
      priceChange4h = ((currentPrice - price4hAgo) / price4hAgo) * 100;
      console.log(`[getMarketData] ${normalizedSymbol} 4h change: ${currentPrice} vs ${price4hAgo} = ${priceChange4h.toFixed(4)}%`);
    }

    // Calculate volume average (需要更长时间窗口的移动平均)
    // 方案：使用最近7天的数据计算平均24h成交量
    // 7天 = 168小时 = 672 x 15分钟K线，但我们只取了100根
    // 简化：使用1h K线（100根 = 约4天）来估算历史平均成交量

    // 计算每小时成交量（使用quoteVolume字段 = USDT金额），然后估算24h平均
    if (klines1h.length >= 24) {
      // 取最近96小时（4天）的1h K线数据
      const recentHours = Math.min(96, klines1h.length);
      const quoteVolumes1h = klines1h.slice(-recentHours).map(k => k.quoteVolume);

      // 计算每小时平均成交量（USDT）
      const volumePerHour = quoteVolumes1h.reduce((sum, v) => sum + v, 0) / quoteVolumes1h.length;

      // 估算历史平均24h成交量（过去4天的平均值）
      const historicalAvg24h = volumePerHour * 24;

      console.log(`[getMarketData] ${normalizedSymbol} volume: current 24h=${(ticker.volume / 1e6).toFixed(2)}M, historical avg=${(historicalAvg24h / 1e6).toFixed(2)}M, ratio=${(ticker.volume / historicalAvg24h).toFixed(2)}x`);

      return {
        symbol: normalizedSymbol,
        current_price: currentPrice,

        // Price changes
        price_change_15m: priceChange15m,
        price_change_1h: priceChange1h,
        price_change_4h: priceChange4h,

        // Multi-timeframe MACD
        macd_15m: macd15m,
        macd_1h: macd1h,
        macd_4h: macd4h,
        macd_1d: macd1d,

        // Multi-timeframe RSI
        rsi_15m: rsi15m,
        rsi_1h: rsi1h,
        rsi_4h: rsi4h,
        rsi_1d: rsi1d,

        // EMA
        ema20: ema20,

        // Volume (使用历史平均值)
        volume_24h: ticker.volume,
        volume_avg_24h: historicalAvg24h,

        // Open Interest
        oi_value: oi.current,
        oi_change_pct: oi.change_pct,

        // Market sentiment
        buy_sell_ratio: ticker.buySellRatio,
        funding_rate: fundingRate,

        // OHLC (latest candle)
        open: latestCandle.open,
        high: latestCandle.high,
        low: latestCandle.low,
        close: latestCandle.close,

        // Volatility
        atr: atr,

        // Legacy fields (for compatibility)
        current_macd: macd15m,
        current_rsi7: rsi15m,
        current_rsi14: rsi1h,
      };
    } else {
      // Fallback: 如果1h数据不足，使用15m数据（旧逻辑）
      const quoteVolumes15m = klines15m.slice(-96).map(k => k.quoteVolume);
      const volumeAvg = quoteVolumes15m.reduce((sum, v) => sum + v, 0) / quoteVolumes15m.length;
      const volumeAvg24h = volumeAvg * 96;

      console.log(`[getMarketData] ${normalizedSymbol} volume (fallback): using 15m data, ratio=${(ticker.volume / volumeAvg24h).toFixed(2)}x`);

      return {
        symbol: normalizedSymbol,
        current_price: currentPrice,

        // Price changes
        price_change_15m: priceChange15m,
        price_change_1h: priceChange1h,
        price_change_4h: priceChange4h,

        // Multi-timeframe MACD
        macd_15m: macd15m,
        macd_1h: macd1h,
        macd_4h: macd4h,
        macd_1d: macd1d,

        // Multi-timeframe RSI
        rsi_15m: rsi15m,
        rsi_1h: rsi1h,
        rsi_4h: rsi4h,
        rsi_1d: rsi1d,

        // EMA
        ema20: ema20,

        // Volume (fallback to 15m-based calculation)
        volume_24h: ticker.volume,
        volume_avg_24h: volumeAvg24h,

        // Open Interest
        oi_value: oi.current,
        oi_change_pct: oi.change_pct,

        // Market sentiment
        buy_sell_ratio: ticker.buySellRatio,
        funding_rate: fundingRate,

        // OHLC (latest candle)
        open: latestCandle.open,
        high: latestCandle.high,
        low: latestCandle.low,
        close: latestCandle.close,

        // Volatility
        atr: atr,

        // Legacy fields (for compatibility)
        current_macd: macd15m,
        current_rsi7: rsi15m,
        current_rsi14: rsi1h,
      };
    }
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

  // Fetch in parallel but with delay to avoid overwhelming the proxy
  const promises = symbols.map(async (symbol, index) => {
    // Add delay between symbols to avoid rate limiting and proxy overload
    await new Promise(resolve => setTimeout(resolve, index * 500));

    try {
      const data = await getMarketData(symbol);
      results[symbol] = data;
      console.log(`  ✓ ${symbol}: $${data.current_price.toFixed(2)} | MACD(15m/1h/4h): ${data.macd_15m.toFixed(2)}/${data.macd_1h.toFixed(2)}/${data.macd_4h.toFixed(2)}`);
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
