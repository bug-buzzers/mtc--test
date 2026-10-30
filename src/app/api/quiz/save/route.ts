import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { getAttemptById } from '@/lib/db';
import { saveResponses } from '@/lib/db/exam-store';

export async function PATCH(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json(), id = String(body.attempt_id || '');
    if (!Array.isArray(body.responses) || body.responses.length > 100) return NextResponse.json({ error: 'Invalid answers.' }, { status: 400 });
    const existing = await getAttemptById(id);
    if (!existing || existing.student_id !== auth.sub) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    const attempt = await saveResponses(id, auth.sub, body.responses);
    if (attempt.status === 'blocked') return NextResponse.json({ error: 'Attempt locked. Contact your teacher.', blocked: true }, { status: 423 });
    if (attempt.status !== 'in_progress') return NextResponse.json({ error: 'This exam has already been submitted.' }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unable to save exam', error);
    return NextResponse.json({ error: 'Progress could not be saved. Check your connection and retry.' }, { status: 500 });
  }
}
