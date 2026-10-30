import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { isValidClass, isValidClassSection } from '@/lib/constants';
import { createStudent } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fullName = String(body.full_name || '').trim();
    const rollNumber = String(body.roll_number || '').trim();
    const cls = Number(body.class);
    const section = String(body.section || '').trim();
    const password = String(body.password || '');

    if (!fullName || fullName.length < 2) {
      return NextResponse.json(
        { error: 'Please enter your full name.' },
        { status: 400 }
      );
    }
    if (!rollNumber) {
      return NextResponse.json(
        { error: 'Please enter your school Roll Number.' },
        { status: 400 }
      );
    }
    if (!isValidClass(cls)) {
      return NextResponse.json(
        { error: 'Please select a valid Class (6 to 12).' },
        { status: 400 }
      );
    }
    if (!isValidClassSection(cls, section)) {
      return NextResponse.json(
        {
          error:
            cls >= 11
              ? 'Classes 11 & 12 must choose Maths, Bio, Commerce, or Humanities.'
              : 'Classes 6 to 10 must choose Section A or Section B.',
        },
        { status: 400 }
      );
    }
    if (!password || password.length < 4) {
      return NextResponse.json(
        { error: 'Password must be at least 4 characters long.' },
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
        { error: error || 'Registration failed.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        message: 'Registration successful! You can now log in.',
        student: {
          id: student.id,
          full_name: student.full_name,
          roll_number: student.roll_number,
          class: student.class,
          section: student.section,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Unable to complete registration. Please try again.' },
      { status: 500 }
    );
  }
}
