import { NextRequest, NextResponse } from 'next/server';
import { searchDocs } from '@/lib/docs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';

  const results = searchDocs(query);

  return NextResponse.json({ results });
}
