import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie, getCookieAuth } from '@/lib/auth';
import { revokeSession } from '@/lib/db/security-store';

export async function POST(req: NextRequest) {
  const auth = await getCookieAuth(req);
  try {
    if (auth) await revokeSession(auth.sid);
    const res = NextResponse.json({ message: 'Signed out.' });
    clearAuthCookie(res, req);
    return res;
  } catch {
    const res = NextResponse.json({ error: 'Could not revoke the session. Please try again.' }, { status: 503 });
    clearAuthCookie(res, req);
    return res;
  }
}
