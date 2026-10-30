import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth';
import {
  getAttemptById,
  getExamConfigByClass,
  gradeAndSubmitAttempt,
} from '@/lib/db';

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const attemptId = String(body.attempt_id || '');
    const submittedResponses = Array.isArray(body.responses)
      ? body.responses
      : [];

    if (!attemptId) {
      return NextResponse.json(
        { error: 'Missing attempt_id' },
        { status: 400 }
      );
    }

    const attempt = await getAttemptById(attemptId);
    if (!attempt || attempt.student_id !== auth.sub) {
      return NextResponse.json(
        { error: 'Exam attempt not found.' },
        { status: 404 }
      );
    }

    if (attempt.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Your exam has already been submitted.' },
        { status: 409 }
      );
    }

    const config = await getExamConfigByClass(attempt.class);

    // Server-side timer validation: allow 90s network buffer for auto-submit at 00:00.
    // If submitted well past the buffer, grade only previously saved in-window answers.
    const elapsedSeconds =
      (Date.now() - new Date(attempt.started_at).getTime()) / 1000;
    const maxSecondsWithBuffer = config.time_limit_minutes * 60 + 90;

    const responsesToGrade =
      elapsedSeconds <= maxSecondsWithBuffer ? submittedResponses : undefined;

    await gradeAndSubmitAttempt(
      attempt.id,
      config.passing_score,
      responsesToGrade
    );

    // CRITICAL REQUIREMENT: Return ONLY confirmation — NEVER score, correct_count, or pass/fail
    return NextResponse.json({
      status: 'submitted',
      message:
        'Your exam has been submitted successfully! Results will be announced by your school.',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to submit exam. Please try again.' },
      { status: 500 }
    );
  }
}
