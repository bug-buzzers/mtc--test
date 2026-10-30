import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { getAttemptById } from '@/lib/db';
import { recordIntegrityEvent } from '@/lib/db/exam-store';

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json(), id = String(body.attempt_id || ''), event = String(body.event || '');
    if (event !== 'tab_hidden' && event !== 'fullscreen_exit' && event !== 'quit') return NextResponse.json({ error: 'Invalid event.' }, { status: 400 });
    const existing = await getAttemptById(id);
    if (!existing || existing.student_id !== auth.sub) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    const a = await recordIntegrityEvent(id, auth.sub, event);
    return NextResponse.json({ status: a.status, tab_switch_warnings: a.tab_switch_warnings, blocked_reason: a.blocked_reason });
  } catch (error) { console.error('Unable to record exam event', error); return NextResponse.json({ error: 'Could not record exam event.' }, { status: 500 }); }
}
