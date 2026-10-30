import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { getStudentById } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  if (auth.role === 'student') {
    const stu = await getStudentById(auth.sub);
    if (!stu || !stu.is_active) {
      return NextResponse.json(
        { user: null, error: 'Account inactive or not found' },
        { status: 401 }
      );
    }
    return NextResponse.json({
      user: {
        sub: stu.id,
        role: 'student',
        name: stu.full_name,
        class: stu.class,
        section: stu.section,
        roll_number: stu.roll_number,
      },
    });
  }

  return NextResponse.json({ user: auth });
}
