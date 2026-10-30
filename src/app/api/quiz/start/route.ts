import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { getExamConfigByClass, getResponsesByAttemptId, getStudentAnsweredQuestionIds, getStudentAttempts, getStudentById, listQuestions } from '@/lib/db';
import { startAttempt, SUBMISSION_GRACE_SECONDS } from '@/lib/db/exam-store';
import { selectQuizQuestions } from '@/lib/quiz-engine';
import { QuizAttempt, QuizResponse, StudentFacingQuestion } from '@/lib/types';

function responseForStudent(attempt: QuizAttempt, responses: QuizResponse[], resumed: boolean) {
  const questions: StudentFacingQuestion[] = responses.map((r) => {
    const q = r.question_snapshot;
    if (!q) throw new Error('Question snapshot is unavailable');
    return { response_id: r.id, question_number: r.question_order, subject_tag: q.subject_tag, question_text: q.question_text,
      option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, selected_option: r.selected_option };
  });
  if (questions.length !== attempt.total_questions) throw new Error('Attempt is incomplete');
  return { resumed, attempt_id: attempt.id, class: attempt.class, started_at: attempt.started_at,
    deadline_at: attempt.deadline_at, time_limit_minutes: attempt.time_limit_minutes_snapshot,
    remaining_seconds: Math.max(0, Math.ceil((new Date(attempt.deadline_at).getTime() - Date.now()) / 1000)),
    grace_seconds: SUBMISSION_GRACE_SECONDS, tab_switch_warnings: attempt.tab_switch_warnings, questions };
}

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (body.acknowledged !== true || body.fullscreen !== true) return NextResponse.json({ error: 'Read the rules and enter full screen before starting.' }, { status: 400 });
    const student = await getStudentById(auth.sub);
    if (!student?.is_active) return NextResponse.json({ error: 'Your account is unavailable.' }, { status: 403 });
    const [config, attempts] = await Promise.all([getExamConfigByClass(student.class), getStudentAttempts(student.id)]);
    const ongoing = attempts.find((a) => a.status === 'in_progress' || a.status === 'blocked');
    if (ongoing?.status === 'blocked') return NextResponse.json({ error: 'Your attempt is locked. Ask your teacher to review and unlock it.', blocked: true }, { status: 423 });
    if (ongoing) return NextResponse.json(responseForStudent(ongoing, await getResponsesByAttemptId(ongoing.id), true));
    if (!config.is_open) return NextResponse.json({ error: 'The exam window is currently closed.' }, { status: 403 });
    const completed = attempts.filter((a) => a.status === 'submitted' || a.status === 'graded').length;
    if (completed >= config.max_attempts + (student.extra_attempts || 0)) return NextResponse.json({ error: 'No attempts remain. Contact your teacher.' }, { status: 403 });
    const classQuestions = await listQuestions({ class: student.class });
    if (classQuestions.length < config.total_questions || config.passing_score > config.total_questions) return NextResponse.json({ error: 'The private question bank is not ready for this exam. Contact your teacher.' }, { status: 400 });
    const selected = selectQuizQuestions(classQuestions, await getStudentAnsweredQuestionIds(student.id), config.total_questions);
    const { attempt, responses } = await startAttempt(student.id, selected);
    if (attempt.status === 'blocked') return NextResponse.json({ error: 'Your attempt is locked. Ask your teacher to review and unlock it.', blocked: true }, { status: 423 });
    return NextResponse.json(responseForStudent(attempt, responses, false));
  } catch (error) {
    console.error('Unable to start exam', error);
    return NextResponse.json({ error: 'Unable to start the exam. Contact your teacher and try again.' }, { status: 500 });
  }
}
