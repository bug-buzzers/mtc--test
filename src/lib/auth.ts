import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from './constants';
import { AuthTokenPayload } from './types';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 bytes.');
  }
  return new TextEncoder().encode(secret);
}

export async function signAuthToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({ ...payload }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('8h').sign(getJwtSecret());
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ['HS256'] });
    if (!payload.sub || typeof payload.sid !== 'string' || !payload.sid || (payload.role !== 'student' && payload.role !== 'admin')) return null;
    return { sub: String(payload.sub), sid: payload.sid, role: payload.role, name: String(payload.name || ''),
      class: payload.class === undefined ? undefined : Number(payload.class),
      section: payload.section === undefined ? undefined : String(payload.section),
      roll_number: payload.roll_number === undefined ? undefined : String(payload.roll_number),
      username: payload.username === undefined ? undefined : String(payload.username) };
  } catch { return null; }
}

export async function getCookieAuth(req: NextRequest): Promise<AuthTokenPayload | null> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  return token ? verifyAuthToken(token) : null;
}

function secureRequest(req: NextRequest): boolean {
  return req.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https' || req.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production';
}

export function attachAuthCookie(res: NextResponse, token: string, req: NextRequest): void {
  const secure = secureRequest(req);
  res.cookies.set(AUTH_COOKIE_NAME, token, { httpOnly: true, path: '/', maxAge: 8 * 60 * 60, sameSite: secure ? 'none' : 'lax', secure, ...(secure ? { partitioned: true } : {}) });
}

export function clearAuthCookie(res: NextResponse, req: NextRequest): void {
  const secure = secureRequest(req);
  res.cookies.set(AUTH_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0, sameSite: secure ? 'none' : 'lax', secure, ...(secure ? { partitioned: true } : {}) });
}
