import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getRequestAuth } from '@/lib/auth';
import { updateStudent } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const updates: {
      full_name?: string;
      is_active?: boolean;
      password_hash?: string;
      extra_attempts?: number;
    } = {};

    if (typeof body.full_name === 'string' && body.full_name.trim()) {
      updates.full_name = body.full_name.trim();
    }
    if (typeof body.is_active === 'boolean') {
      updates.is_active = body.is_active;
    }
    if (typeof body.extra_attempts === 'number' && body.extra_attempts >= 0) {
      updates.extra_attempts = Math.floor(body.extra_attempts);
    }
    if (typeof body.new_password === 'string' && body.new_password.trim()) {
      if (body.new_password.trim().length < 4) {
        return NextResponse.json(
          { error: 'New password must be at least 4 characters.' },
          { status: 400 }
        );
      }
      updates.password_hash = await bcrypt.hash(body.new_password.trim(), 10);
    }

    const updated = await updateStudent(params.id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    const { password_hash: _pw, ...safeStudent } = updated;
    return NextResponse.json({
      message: 'Student updated successfully.',
      student: safeStudent,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update student.' },
      { status: 500 }
    );
  }
}
