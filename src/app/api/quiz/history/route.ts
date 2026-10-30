import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { getExamConfigByClass, getStudentAttempts } from '@/lib/db';
export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const attempts = await getStudentAttempts(auth.sub);
    const visibility = new Map<number, boolean>();
    for (const a of attempts) if (!visibility.has(a.class)) visibility.set(a.class, Boolean((await getExamConfigByClass(a.class)).show_results_to_students));
    return NextResponse.json({ history: attempts.map((a) => {
      const done = a.status === 'submitted' || a.status === 'graded';
      const base = { id: a.id, class: a.class, started_at: a.started_at, submitted_at: a.submitted_at, total_questions: a.total_questions, status: a.status === 'blocked' ? 'blocked' : a.status === 'retired' ? 'retired' : done ? 'submitted' : 'in_progress' };
      return done && visibility.get(a.class) ? { ...base, can_view_result: true, correct_count: a.correct_count, score_percentage: a.score_percentage, passed: a.passed } : base;
    }) });
  } catch { return NextResponse.json({ error: 'Unable to load history.' }, { status: 500 }); }
}
