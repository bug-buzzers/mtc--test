import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { getAttemptById } from '@/lib/db';
import { maintainAttempt } from '@/lib/db/exam-store';

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json(), id = String(body.attempt_id || '');
    const existing = await getAttemptById(id);
    if (!existing || existing.student_id !== auth.sub) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    const a = await maintainAttempt(id, auth.sub, true);
    return NextResponse.json({ status: a.status, remaining_seconds: Math.max(0, Math.ceil((new Date(a.deadline_at).getTime() - Date.now()) / 1000)), tab_switch_warnings: a.tab_switch_warnings });
  } catch (error) { console.error('Heartbeat failed', error); return NextResponse.json({ error: 'Connection check failed.' }, { status: 500 }); }
}
