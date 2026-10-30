import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth';
import { getDetailedAttemptReview } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { attemptId: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const review = await getDetailedAttemptReview(params.attemptId);
  if (!review) {
    return NextResponse.json(
      { error: 'Exam attempt not found.' },
      { status: 404 }
    );
  }

  return NextResponse.json(review);
}
