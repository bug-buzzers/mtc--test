import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { attachAuthCookie, signAuthToken } from '@/lib/auth';
import { isValidClass, isValidClassSection } from '@/lib/constants';
import { findStudentByCredentials } from '@/lib/db';
import { consumeRateLimit, createSession } from '@/lib/db/security-store';
import { AuthTokenPayload } from '@/lib/types';

const dummyHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roll = String(body.roll_number || '').trim().slice(0, 100);
    const cls = Number(body.class), section = String(body.section || '').trim(), password = String(body.password || '');
    if (!roll || !password || Buffer.byteLength(password) > 72 || !isValidClass(cls) || !isValidClassSection(cls, section)) return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    if (!(await consumeRateLimit('student-login', `${cls}:${section}:${roll}`, ip, 8)) || !(await consumeRateLimit('student-login-ip', '*', ip, 80))) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    const student = await findStudentByCredentials(roll, cls, section);
    const valid = await bcrypt.compare(password, student?.password_hash || dummyHash);
    if (!student || !student.is_active || student.password_reset_required || !valid) return NextResponse.json({ error: 'Invalid credentials or account unavailable.' }, { status: 401 });
    const session = await createSession(student.id, 'student');
    const payload: AuthTokenPayload = { sub: student.id, sid: session.id, role: 'student', name: student.full_name, class: student.class, section: student.section, roll_number: student.roll_number };
    const token = await signAuthToken(payload);
    const res = NextResponse.json({ message: 'Signed in.', user: { role: 'student', name: student.full_name } });
    attachAuthCookie(res, token, req);
    return res;
  } catch (error) {
    console.error('Student login unavailable', error);
    return NextResponse.json({ error: 'Sign-in is temporarily unavailable. Contact your teacher.' }, { status: 503 });
  }
}
