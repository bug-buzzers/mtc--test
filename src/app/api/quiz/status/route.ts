import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth';
import {
  getExamConfigByClass,
  getStudentAttempts,
  getStudentById,
  listQuestions,
} from '@/lib/db';

export async function GET(req: NextRequest) {
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

  const [config, attempts, classQuestions] = await Promise.all([
    getExamConfigByClass(student.class),
    getStudentAttempts(student.id),
    listQuestions({ class: student.class }),
  ]);

  const activeAttempt =
    attempts.find((a) => a.status === 'in_progress') || null;
  const completedAttempts = attempts.filter((a) => a.status !== 'in_progress');
  const effectiveMaxAttempts =
    config.max_attempts + (student.extra_attempts || 0);

  const hasEnoughQuestions = classQuestions.length > 0;
  const canStartNew =
    config.is_open &&
    hasEnoughQuestions &&
    !activeAttempt &&
    completedAttempts.length < effectiveMaxAttempts;

  const allowResults = Boolean(config.show_results_to_students);

  // Only reveal score/pass fields when the admin explicitly enabled `show_results_to_students` for this class
  const safeHistory = attempts.map((a) => {
    const base = {
      id: a.id,
      class: a.class,
      started_at: a.started_at,
      submitted_at: a.submitted_at,
      total_questions: a.total_questions,
      status: (a.status === 'in_progress' ? 'in_progress' : 'submitted') as
        | 'in_progress'
        | 'submitted',
    };

    if (allowResults && a.status !== 'in_progress') {
      return {
        ...base,
        can_view_result: true,
        correct_count: a.correct_count,
        score_percentage: a.score_percentage,
        passed: a.passed,
      };
    }

    return base;
  });

  return NextResponse.json({
    student: {
      id: student.id,
      full_name: student.full_name,
      roll_number: student.roll_number,
      class: student.class,
      section: student.section,
    },
    exam: {
      is_open: config.is_open && hasEnoughQuestions,
      total_questions: Math.min(config.total_questions, classQuestions.length),
      questions_in_bank: classQuestions.length,
      time_limit_minutes: config.time_limit_minutes,
      show_results_to_students: allowResults,
      has_active_attempt: Boolean(activeAttempt),
      active_attempt_id: activeAttempt?.id || null,
      can_start_new_attempt: canStartNew,
      completed_attempts_count: completedAttempts.length,
      max_attempts: effectiveMaxAttempts,
    },
    history: safeHistory,
  });
}
