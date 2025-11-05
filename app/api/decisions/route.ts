import { NextRequest, NextResponse } from 'next/server';
import { getTraderData } from '@/lib/mockData';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const traderId = searchParams.get('trader_id') || 'deepseek_trader';

    const data = getTraderData(traderId);
    return NextResponse.json(data.decisions);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch decisions' },
      { status: 500 }
    );
  }
}
