import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth';
import {
  createQuizAttemptWithResponses,
  getExamConfigByClass,
  getQuestionById,
  getResponsesByAttemptId,
  getStudentAnsweredQuestionIds,
  getStudentAttempts,
  getStudentById,
  listQuestions,
} from '@/lib/db';
import { selectQuizQuestions } from '@/lib/quiz-engine';
import { Question, StudentFacingQuestion } from '@/lib/types';

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const student = await getStudentById(auth.sub);
  if (!student || !student.is_active) {
    return NextResponse.json(
      { error: 'Your account is deactivated. Contact your teacher.' },
      { status: 403 }
    );
  }

  const config = await getExamConfigByClass(student.class);
  const attempts = await getStudentAttempts(student.id);

  // 1. If student already has an unexpired in_progress attempt, resume it cleanly
  const ongoing = attempts.find((a) => a.status === 'in_progress');
  if (ongoing) {
    const responses = await getResponsesByAttemptId(ongoing.id);
    const allClassQuestions = await listQuestions({
      class: ongoing.class,
      include_inactive: true,
    });
    const qMap = new Map<string, Question>(
      allClassQuestions.map((q) => [q.id, q])
    );

    const safeQuestions: StudentFacingQuestion[] = [];
    for (let i = 0; i < responses.length; i++) {
      const r = responses[i];
      const q = qMap.get(r.question_id) || (await getQuestionById(r.question_id));
      if (!q) continue;
      // NEVER expose correct_option to student
      safeQuestions.push({
        response_id: r.id,
        question_number: i + 1,
        subject_tag: q.subject_tag,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        selected_option: r.selected_option,
      });
    }

    const elapsedSec = Math.floor(
      (Date.now() - new Date(ongoing.started_at).getTime()) / 1000
    );
    const totalSec = config.time_limit_minutes * 60;
    const remainingSec = Math.max(0, totalSec - elapsedSec);

    return NextResponse.json({
      resumed: true,
      attempt_id: ongoing.id,
      class: ongoing.class,
      started_at: ongoing.started_at,
      time_limit_minutes: config.time_limit_minutes,
      remaining_seconds: remainingSec,
      questions: safeQuestions,
    });
  }

  // 2. Check if exam window is open and attempts remain
  if (!config.is_open) {
    return NextResponse.json(
      { error: 'The entrance exam window for your class is currently closed.' },
      { status: 403 }
    );
  }

  const completedCount = attempts.filter((a) => a.status !== 'in_progress').length;
  const maxAllowed = config.max_attempts + (student.extra_attempts || 0);
  if (completedCount >= maxAllowed) {
    return NextResponse.json(
      {
        error:
          'You have already completed your entrance exam. Contact your teacher if you need assistance.',
      },
      { status: 403 }
    );
  }

  // 3. Build repeat-aware, difficulty-balanced quiz for student's class
  const classQuestions = await listQuestions({ class: student.class });
  if (classQuestions.length === 0) {
    return NextResponse.json(
      { error: 'No active questions are configured for your class yet.' },
      { status: 400 }
    );
  }

  const answeredIds = await getStudentAnsweredQuestionIds(student.id);
  const selectedQuestions = selectQuizQuestions(
    classQuestions,
    answeredIds,
    config.total_questions
  );

  const { attempt, responses } = await createQuizAttemptWithResponses(
    student.id,
    student.class,
    selectedQuestions
  );

  const qById = new Map(selectedQuestions.map((q) => [q.id, q]));
  const safeQuestions: StudentFacingQuestion[] = responses.map((r, idx) => {
    const q = qById.get(r.question_id)!;
    // CRITICAL SECURITY: correct_option is NEVER sent to the client
    return {
      response_id: r.id,
      question_number: idx + 1,
      subject_tag: q.subject_tag,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      selected_option: null,
    };
  });

  return NextResponse.json({
    resumed: false,
    attempt_id: attempt.id,
    class: attempt.class,
    started_at: attempt.started_at,
    time_limit_minutes: config.time_limit_minutes,
    remaining_seconds: config.time_limit_minutes * 60,
    questions: safeQuestions,
  });
}
