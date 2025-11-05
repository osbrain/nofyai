import { NextResponse } from 'next/server';
import { getMarketData } from '@/lib/market-data';

export async function GET() {
  try {
    console.log('🧪 [Test Market Data] Starting market data test...');

    // Test fetching market data for BTC
    const symbol = 'BTCUSDT';
    console.log(`🧪 [Test Market Data] Fetching data for ${symbol}...`);

    const marketData = await getMarketData(symbol);

    console.log(`✅ [Test Market Data] Successfully fetched data for ${symbol}`);
    console.log(`   Current Price: $${marketData.current_price.toFixed(2)}`);
    console.log(`   RSI(7): ${marketData.current_rsi7.toFixed(2)}`);
    console.log(`   MACD: ${marketData.current_macd.toFixed(4)}`);
    console.log(`   EMA20: $${marketData.current_ema20.toFixed(2)}`);
    console.log(`   Intraday prices: ${marketData.intraday_series.mid_prices.length} points`);
    console.log(`   4H MACD values: ${marketData.longer_term_context.macd_values.length} points`);

    return NextResponse.json({
      success: true,
      symbol: symbol,
      data: {
        current_price: marketData.current_price,
        price_change_1h: marketData.price_change_1h.toFixed(2) + '%',
        price_change_4h: marketData.price_change_4h.toFixed(2) + '%',
        current_rsi7: marketData.current_rsi7.toFixed(2),
        current_macd: marketData.current_macd.toFixed(4),
        current_ema20: marketData.current_ema20.toFixed(2),
        volume_24h: marketData.volume_24h,
        oi_value: marketData.oi_value + 'M',
        intraday_data_points: marketData.intraday_series.mid_prices.length,
        longer_term_data_points: marketData.longer_term_context.macd_values.length,
      },
      summary: '✅ Market data fetched successfully!',
    });
  } catch (error) {
    console.error('❌ [Test Market Data] Test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
