// ========================================
// Binance Market Data Fetcher
// ========================================
// Functions to fetch data from Binance API

import { fetchWithProxy } from '../http-client';
import { getOICache } from '../oi-cache';
import type { KlineData } from './types';

const BINANCE_BASE_URL = 'https://fapi.binance.com';

/**
 * Fetch kline (candlestick) data from Binance
 * @param symbol - Trading symbol (e.g., BTCUSDT)
 * @param interval - Kline interval (e.g., 15m, 1h, 4h, 1d)
 * @param limit - Number of candles to fetch
 * @param retries - Number of retry attempts (default 3)
 * @returns Array of kline data
 */
export async function fetchKlines(
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

/**
 * Fetch open interest data from Binance
 * Uses OI cache to calculate change percentage
 * @param symbol - Trading symbol
 * @returns Object with current OI value and change percentage
 */
export async function fetchOpenInterest(symbol: string): Promise<{ current: number; change_pct: number }> {
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

/**
 * Fetch 24hr ticker data from Binance
 * @param symbol - Trading symbol
 * @returns Object with last price, volume, and buy/sell ratio
 */
export async function fetchTicker(symbol: string): Promise<{ lastPrice: number; volume: number; buySellRatio: number }> {
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

/**
 * Fetch funding rate from Binance
 * @param symbol - Trading symbol
 * @returns Funding rate (decimal, e.g., 0.0001 = 0.01%)
 */
export async function fetchFundingRate(symbol: string): Promise<number> {
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
