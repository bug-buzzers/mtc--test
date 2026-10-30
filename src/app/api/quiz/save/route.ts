import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth';
import {
  getAttemptById,
  getExamConfigByClass,
  saveDraftResponses,
} from '@/lib/db';

export async function PATCH(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const attemptId = String(body.attempt_id || '');
    const responses = Array.isArray(body.responses) ? body.responses : [];

    const attempt = await getAttemptById(attemptId);
    if (!attempt || attempt.student_id !== auth.sub) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }
    if (attempt.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'This exam has already been submitted.' },
        { status: 409 }
      );
    }

    const config = await getExamConfigByClass(attempt.class);
    const deadlineMs =
      new Date(attempt.started_at).getTime() +
      config.time_limit_minutes * 60 * 1000 +
      60000;
    if (Date.now() > deadlineMs) {
      return NextResponse.json(
        { error: 'Exam time has expired.' },
        { status: 400 }
      );
    }

    await saveDraftResponses(attemptId, responses);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 });
  }
}
