import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getRequestAuth } from '@/lib/auth-server';
import { getStudentById, updateStudent } from '@/lib/db';
import { revokeUserSessions } from '@/lib/db/security-store';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
      password_reset_required?: boolean;
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
      if (body.new_password.trim().length < 10 || Buffer.byteLength(body.new_password.trim()) > 72) {
        return NextResponse.json(
          { error: 'New password must be at least 10 characters and at most 72 bytes.' },
          { status: 400 }
        );
      }
      updates.password_hash = await bcrypt.hash(body.new_password.trim(), 12);
      updates.password_reset_required = false;
    }

    if (updates.is_active === true && !updates.password_hash) {
      const current = await getStudentById((await params).id);
      if (current?.password_reset_required) return NextResponse.json({ error: 'Reset this student’s exposed password before reactivating the account.' }, { status: 400 });
    }

    const updated = await updateStudent((await params).id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    if (updates.is_active === false || updates.password_hash) await revokeUserSessions((await params).id, 'student');
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
