import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getRequestAuth } from '@/lib/auth';
import { isValidClass, isValidClassSection } from '@/lib/constants';
import { createStudent, listStudents } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clsParam = searchParams.get('class');
  const sectionParam = searchParams.get('section');
  const searchParam = searchParams.get('search') || undefined;

  const students = await listStudents({
    class: clsParam && clsParam !== 'all' ? Number(clsParam) : undefined,
    section:
      sectionParam && sectionParam !== 'all' ? sectionParam : undefined,
    search: searchParam,
  });

  return NextResponse.json({ students });
}

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const fullName = String(body.full_name || '').trim();
    const rollNumber = String(body.roll_number || '').trim();
    const cls = Number(body.class);
    const section = String(body.section || '').trim();
    const password = String(body.password || '').trim();

    if (!fullName || !rollNumber || !isValidClass(cls) || !isValidClassSection(cls, section)) {
      return NextResponse.json(
        { error: 'Valid Full Name, Roll Number, Class (6–12), and Section/Stream are required.' },
        { status: 400 }
      );
    }
    if (password.length < 4) {
      return NextResponse.json(
        { error: 'Password must be at least 4 characters.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { student, error } = await createStudent({
      roll_number: rollNumber,
      full_name: fullName,
      class: cls,
      section,
      password_hash: passwordHash,
    });

    if (error || !student) {
      return NextResponse.json(
        { error: error || 'Unable to register student.' },
        { status: 409 }
      );
    }

    const { password_hash: _pw, ...safeStudent } = student;
    return NextResponse.json(
      { message: 'Student registered successfully.', student: safeStudent },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Unable to create student account.' },
      { status: 500 }
    );
  }
}
