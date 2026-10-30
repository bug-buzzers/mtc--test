import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { unlockAttempt } from '@/lib/db/exam-store';
export async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try { const { attemptId } = await params; await unlockAttempt(attemptId, auth.sub); return NextResponse.json({ message: 'Attempt unlocked. Ask the student to resume promptly.' }); }
  catch { return NextResponse.json({ error: 'Unable to unlock this attempt.' }, { status: 409 }); }
}
