import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth';
import { isValidClass } from '@/lib/constants';
import { updateExamConfig } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: { class: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cls = Number(params.class);
  if (!isValidClass(cls)) {
    return NextResponse.json({ error: 'Invalid class number.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const updates: {
      is_open?: boolean;
      total_questions?: number;
      time_limit_minutes?: number;
      passing_score?: number;
      max_attempts?: number;
      show_results_to_students?: boolean;
    } = {};

    if (typeof body.is_open === 'boolean') {
      updates.is_open = body.is_open;
    }
    if (typeof body.show_results_to_students === 'boolean') {
      updates.show_results_to_students = body.show_results_to_students;
    }
    if (body.total_questions !== undefined) {
      const tq = Number(body.total_questions);
      if (!Number.isInteger(tq) || tq < 1 || tq > 100) {
        return NextResponse.json(
          { error: 'Questions per exam must be between 1 and 100.' },
          { status: 400 }
        );
      }
      updates.total_questions = tq;
    }
    if (body.time_limit_minutes !== undefined) {
      const tl = Number(body.time_limit_minutes);
      if (!Number.isInteger(tl) || tl < 5 || tl > 180) {
        return NextResponse.json(
          { error: 'Time limit must be between 5 and 180 minutes.' },
          { status: 400 }
        );
      }
      updates.time_limit_minutes = tl;
    }
    if (body.passing_score !== undefined) {
      const ps = Number(body.passing_score);
      const maxQ = updates.total_questions ?? 100;
      if (!Number.isInteger(ps) || ps < 1 || ps > maxQ) {
        return NextResponse.json(
          { error: 'Passing score must be between 1 and Total Questions.' },
          { status: 400 }
        );
      }
      updates.passing_score = ps;
    }
    if (body.max_attempts !== undefined) {
      const ma = Number(body.max_attempts);
      if (!Number.isInteger(ma) || ma < 1 || ma > 10) {
        return NextResponse.json(
          { error: 'Max attempts must be between 1 and 10.' },
          { status: 400 }
        );
      }
      updates.max_attempts = ma;
    }

    const updated = await updateExamConfig(cls, updates);
    if (!updated) {
      return NextResponse.json(
        { error: 'Class configuration not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: `Class ${cls} exam settings saved!`,
      config: updated,
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to update exam settings.' },
      { status: 500 }
    );
  }
}
