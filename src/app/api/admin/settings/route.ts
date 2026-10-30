import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth';
import { listExamConfigs, listQuestions } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [configs, questions] = await Promise.all([
    listExamConfigs(),
    listQuestions(),
  ]);

  const enriched = configs.map((cfg) => ({
    ...cfg,
    questions_in_bank: questions.filter((q) => q.class === cfg.class).length,
  }));

  return NextResponse.json({ settings: enriched });
}
