import { NextRequest, NextResponse } from 'next/server';
import { mockConfig } from '@/lib/mockData';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(mockConfig);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    );
  }
}
