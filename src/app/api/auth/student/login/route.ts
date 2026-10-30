import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { attachAuthCookie, signAuthToken } from '@/lib/auth';
import { isValidClass, isValidClassSection } from '@/lib/constants';
import { findStudentByCredentials } from '@/lib/db';
import { AuthTokenPayload } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rollNumber = String(body.roll_number || '').trim();
    const cls = Number(body.class);
    const section = String(body.section || '').trim();
    const password = String(body.password || '');

    if (!rollNumber || !password || !isValidClass(cls) || !isValidClassSection(cls, section)) {
      return NextResponse.json(
        { error: 'Please fill in Roll Number, Class, Section/Stream, and Password.' },
        { status: 400 }
      );
    }

    const student = await findStudentByCredentials(rollNumber, cls, section);
    if (!student) {
      return NextResponse.json(
        {
          error:
            'No student found with these credentials. Please check your Roll Number, Class, and Section, or Register first.',
        },
        { status: 401 }
      );
    }

    const validPassword = await bcrypt.compare(password, student.password_hash);
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Incorrect password. Please try again or ask your teacher to reset it.' },
        { status: 401 }
      );
    }

    if (!student.is_active) {
      return NextResponse.json(
        { error: 'Your account is deactivated. Contact your teacher.' },
        { status: 403 }
      );
    }

    const tokenPayload: AuthTokenPayload = {
      sub: student.id,
      role: 'student',
      name: student.full_name,
      class: student.class,
      section: student.section,
      roll_number: student.roll_number,
    };

    const token = await signAuthToken(tokenPayload);
    const res = NextResponse.json({
      message: 'Login successful',
      token,
      user: tokenPayload,
    });
    attachAuthCookie(res, token, req);
    return res;
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong while logging in.' },
      { status: 500 }
    );
  }
}
