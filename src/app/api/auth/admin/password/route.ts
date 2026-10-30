import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';
import { getRequestAuth } from '@/lib/auth-server';
import { changeAdminPassword, consumeRateLimit, getAdminById } from '@/lib/db/security-store';
import { isValidAdminPassword } from '@/lib/password-policy';

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 403 });

  try {
    const body = await req.json().catch(() => null) as { current_password?: unknown; new_password?: unknown } | null;
    const current = body?.current_password;
    const next = body?.new_password;
    if (typeof current !== 'string' || !current || Buffer.byteLength(current) > 72 || typeof next !== 'string' || !isValidAdminPassword(next)) {
      return NextResponse.json({ error: 'Enter the current password and a new password of at least 12 characters, up to 72 UTF-8 bytes.' }, { status: 400 });
    }
    if (current === next) return NextResponse.json({ error: 'Choose a password different from the current one.' }, { status: 400 });
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    if (!(await consumeRateLimit('admin-password-account', auth.sub, '*', 5)) || !(await consumeRateLimit('admin-password-ip', '*', ip, 30))) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }
    const admin = await getAdminById(auth.sub);
    if (!admin?.is_active || !(await bcrypt.compare(current, admin.password_hash))) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
    }
    const newHash = await bcrypt.hash(next, 12);
    if (!(await changeAdminPassword(auth.sub, auth.sid, admin.password_hash, newHash))) {
      const res = NextResponse.json({ error: 'Your session or password changed. Sign in again.' }, { status: 401 });
      clearAuthCookie(res, req);
      return res;
    }
    const res = NextResponse.json({ message: 'Password changed. Sign in again on all devices.' });
    clearAuthCookie(res, req);
    return res;
  } catch {
    return NextResponse.json({ error: 'Password change is temporarily unavailable. Please try again.' }, { status: 503 });
  }
}
