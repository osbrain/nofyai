import { NextRequest, NextResponse } from 'next/server';
import { getTraderManager } from '@/lib/trader-manager';

/**
 * GET /api/decisions
 * Returns all decision records for a specific trader
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const traderId = searchParams.get('trader_id');

    if (!traderId) {
      return NextResponse.json(
        { error: 'trader_id parameter is required' },
        { status: 400 }
      );
    }

    const manager = await getTraderManager();
    const trader = manager.getTrader(traderId);

    if (!trader) {
      return NextResponse.json(
        { error: `Trader ${traderId} not found` },
        { status: 404 }
      );
    }

    // Get all decisions (use a large limit to get all)
    const allDecisions = await trader.getLatestDecisions(1000);

    // Fix old records that don't have success field
    const decisionsWithSuccess = allDecisions.map(decision => ({
      ...decision,
      success: decision.success ?? true
    }));

    return NextResponse.json(decisionsWithSuccess);
  } catch (error) {
    console.error('Failed to fetch decisions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch decisions' },
      { status: 500 }
    );
  }
}
