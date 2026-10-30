import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { attachAuthCookie, signAuthToken } from '@/lib/auth';
import { findAdminByUsername } from '@/lib/db';
import { consumeRateLimit, createSession } from '@/lib/db/security-store';
import { AuthTokenPayload } from '@/lib/types';

const dummyHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username || '').trim().slice(0, 100);
    const password = String(body.password || '');
    if (!username || !password || Buffer.byteLength(password) > 72) return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    if (!(await consumeRateLimit('admin-login', username, ip, 8)) || !(await consumeRateLimit('admin-login-ip', '*', ip, 40))) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    const admin = await findAdminByUsername(username);
    const valid = await bcrypt.compare(password, admin?.password_hash || dummyHash);
    if (!admin || !admin.is_active || !valid) return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    const session = await createSession(admin.id, 'admin');
    const payload: AuthTokenPayload = { sub: admin.id, sid: session.id, role: 'admin', name: admin.full_name, username: admin.username };
    const token = await signAuthToken(payload);
    const res = NextResponse.json({ message: 'Signed in.', user: { role: 'admin', name: admin.full_name } });
    attachAuthCookie(res, token, req);
    return res;
  } catch (error) {
    console.error('Admin login unavailable', error);
    return NextResponse.json({ error: 'Sign-in is temporarily unavailable. Contact your coordinator.' }, { status: 503 });
  }
}
