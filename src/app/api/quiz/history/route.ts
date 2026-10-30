import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth';
import { getExamConfigByClass, getStudentAttempts } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const attempts = await getStudentAttempts(auth.sub);
  const configMap = new Map<number, boolean>();

  for (const a of attempts) {
    if (!configMap.has(a.class)) {
      const cfg = await getExamConfigByClass(a.class);
      configMap.set(a.class, Boolean(cfg.show_results_to_students));
    }
  }

  const history = attempts.map((a) => {
    const allow = Boolean(configMap.get(a.class));
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

    if (allow && a.status !== 'in_progress') {
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

  return NextResponse.json({ history });
}
