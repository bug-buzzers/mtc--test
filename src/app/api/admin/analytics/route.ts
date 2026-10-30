import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { getAnalyticsSummary } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const summary = await getAnalyticsSummary();
  return NextResponse.json(summary);
}
