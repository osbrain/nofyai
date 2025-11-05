import { NextRequest, NextResponse } from 'next/server';
import { mockTraders } from '@/lib/mockData';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(mockTraders);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch traders' },
      { status: 500 }
    );
  }
}
