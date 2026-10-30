import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { isValidClass, isValidClassSection } from '@/lib/constants';
import { consumeRateLimit, registerStudent, StudentAlreadyRegisteredError } from '@/lib/db/security-store';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
    body = parsed;
  } catch { return NextResponse.json({ error: 'Complete your registration details.' }, { status: 400 }); }
  const fullName = String(body.full_name || '').trim(), roll = String(body.roll_number || '').trim();
  const cls = Number(body.class), section = String(body.section || '').trim(), password = String(body.password || '');
  if (fullName.length < 2 || fullName.length > 120 || !roll || roll.length > 100 || !isValidClass(cls) || !isValidClassSection(cls, section)) return NextResponse.json({ error: 'Enter a valid name, roll number, class and section or stream.' }, { status: 400 });
  if (password.length < 10 || Buffer.byteLength(password) > 72) return NextResponse.json({ error: 'Password must be at least 10 characters and at most 72 bytes.' }, { status: 400 });
  try {
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    if (!(await consumeRateLimit('registration', `${cls}:${section}:${roll}`, ip, 8)) || !(await consumeRateLimit('registration-ip', '*', ip, 80))) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    const passwordHash = await bcrypt.hash(password, 12);
    const student = await registerStudent({ roll_number: roll, full_name: fullName, class: cls, section, password_hash: passwordHash });
    return NextResponse.json({ message: 'Registration successful. You can now sign in.', student: { id: student.id, full_name: student.full_name, roll_number: student.roll_number, class: student.class, section: student.section } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof StudentAlreadyRegisteredError) return NextResponse.json({ error: 'An account with these details is already registered. Sign in or ask your teacher for help.' }, { status: 409 });
    console.error('Student registration unavailable', error);
    return NextResponse.json({ error: 'Registration is temporarily unavailable. Please try again or ask your teacher.' }, { status: 503 });
  }
}
