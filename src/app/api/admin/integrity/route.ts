import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { listBlockedAttempts } from '@/lib/db/exam-store';
export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try { return NextResponse.json({ attempts: await listBlockedAttempts() }); }
  catch { return NextResponse.json({ error: 'Unable to load integrity review.' }, { status: 500 }); }
}
