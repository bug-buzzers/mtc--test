import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { listExamConfigs, countQuestions } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const configs = await listExamConfigs();
  const enriched = await Promise.all(configs.map(async (cfg) => ({
    ...cfg,
    questions_in_bank: await countQuestions(cfg.class),
  })));

  return NextResponse.json({ settings: enriched });
}
