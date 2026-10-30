import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { getAttemptById } from '@/lib/db';
import { submitAttempt } from '@/lib/db/exam-store';

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json(), id = String(body.attempt_id || '');
    if (!id || !Array.isArray(body.responses) || body.responses.length > 100) return NextResponse.json({ error: 'Invalid submission.' }, { status: 400 });
    const existing = await getAttemptById(id);
    if (!existing || existing.student_id !== auth.sub) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });
    if (existing.status === 'blocked') return NextResponse.json({ error: 'Attempt locked. Contact your teacher.', blocked: true }, { status: 423 });
    if (existing.status === 'graded' || existing.status === 'submitted') return NextResponse.json({ status: 'submitted', message: 'Your submission is already recorded.' });
    const attempt = await submitAttempt(id, auth.sub, body.responses);
    if (attempt.status === 'blocked') return NextResponse.json({ error: 'Attempt locked. Contact your teacher.', blocked: true }, { status: 423 });
    if (attempt.status !== 'graded' && attempt.status !== 'submitted') throw new Error('Attempt was not submitted');
    return NextResponse.json({ status: 'submitted', message: 'Your submission is recorded. Results will be announced by your school.' });
  } catch (error) {
    console.error('Unable to submit exam', error);
    return NextResponse.json({ error: 'Submission failed. Your exam is not confirmed; please retry or contact your teacher.' }, { status: 500 });
  }
}
