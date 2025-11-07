import { NextRequest, NextResponse } from 'next/server';
import { getTraderManager } from '@/lib/trader-manager';

/**
 * POST /api/positions/close
 * Manually close a position for a specific trader
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trader_id, symbol, side } = body;

    if (!trader_id || !symbol || !side) {
      return NextResponse.json(
        { error: 'Missing required parameters: trader_id, symbol, side' },
        { status: 400 }
      );
    }

    const traderManager = await getTraderManager();
    const trader = traderManager.getTrader(trader_id);

    if (!trader) {
      return NextResponse.json(
        { error: `Trader not found: ${trader_id}` },
        { status: 404 }
      );
    }

    // Close the position
    await trader.closePosition(symbol, side);

    return NextResponse.json({
      success: true,
      message: `Position closed: ${side} ${symbol}`,
    });
  } catch (error) {
    console.error('Error closing position:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
