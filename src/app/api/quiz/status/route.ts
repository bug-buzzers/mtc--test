import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { getExamConfigByClass, getStudentAttempts, getStudentById, countQuestions } from '@/lib/db';
import { listClassmateNames } from '@/lib/db/security-store';

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const student = await getStudentById(auth.sub);
    if (!student?.is_active) return NextResponse.json({ error: 'Account unavailable.' }, { status: 403 });
    const [config, attempts, questionCount, classmates] = await Promise.all([
      getExamConfigByClass(student.class), getStudentAttempts(student.id), countQuestions(student.class), listClassmateNames(student),
    ]);
    const active = attempts.find((a) => a.status === 'in_progress') || null;
    const blocked = attempts.find((a) => a.status === 'blocked') || null;
    const completed = attempts.filter((a) => a.status === 'submitted' || a.status === 'graded');
    const max = config.max_attempts + (student.extra_attempts || 0);
    const ready = questionCount >= config.total_questions && config.passing_score <= config.total_questions;
    const history = attempts.map((a) => {
      const isCompleted = a.status === 'submitted' || a.status === 'graded';
      const base = { id: a.id, class: a.class, started_at: a.started_at, submitted_at: a.submitted_at, total_questions: a.total_questions,
        status: a.status === 'blocked' ? 'blocked' : a.status === 'retired' ? 'retired' : isCompleted ? 'submitted' : 'in_progress' };
      return config.show_results_to_students && isCompleted ? { ...base, can_view_result: true, correct_count: a.correct_count, score_percentage: a.score_percentage, passed: a.passed } : base;
    });
    return NextResponse.json({ student: { id: student.id, full_name: student.full_name, roll_number: student.roll_number, class: student.class, section: student.section }, classmates,
      exam: { is_open: config.is_open && ready, total_questions: config.total_questions, questions_in_bank: questionCount, time_limit_minutes: config.time_limit_minutes,
        show_results_to_students: Boolean(config.show_results_to_students), has_active_attempt: Boolean(active), active_attempt_id: active?.id || null,
        has_blocked_attempt: Boolean(blocked), blocked_reason: blocked?.blocked_reason || null,
        can_start_new_attempt: config.is_open && ready && !active && !blocked && completed.length < max, completed_attempts_count: completed.length, max_attempts: max }, history });
  } catch (error) { console.error('Unable to load quiz status', error); return NextResponse.json({ error: 'Unable to load your dashboard.' }, { status: 500 }); }
}
