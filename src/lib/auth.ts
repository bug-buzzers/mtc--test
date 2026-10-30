import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from './constants';
import { AuthTokenPayload } from './types';

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    'mtc-maples-academy-khatauli-default-jwt-secret-2026';
  return new TextEncoder().encode(secret);
}

export async function signAuthToken(payload: AuthTokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getJwtSecret());
}

export async function verifyAuthToken(
  token: string
): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || (payload.role !== 'student' && payload.role !== 'admin')) {
      return null;
    }
    return {
      sub: String(payload.sub),
      role: payload.role as 'student' | 'admin',
      name: String(payload.name || ''),
      class: payload.class !== undefined ? Number(payload.class) : undefined,
      section: payload.section !== undefined ? String(payload.section) : undefined,
      roll_number:
        payload.roll_number !== undefined ? String(payload.roll_number) : undefined,
      username: payload.username !== undefined ? String(payload.username) : undefined,
    };
  } catch {
    return null;
  }
}

export async function getRequestAuth(
  req: NextRequest
): Promise<AuthTokenPayload | null> {
  // 1. Check Authorization Bearer header (ensures reliable auth inside cross-origin preview iframes)
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) {
      const verified = await verifyAuthToken(bearerToken);
      if (verified) return verified;
    }
  }

  // 2. Check httpOnly Cookie (primary production mechanism on Vercel)
  const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookieToken) {
    return await verifyAuthToken(cookieToken);
  }

  return null;
}

export function attachAuthCookie(
  res: NextResponse,
  token: string,
  req: NextRequest
): void {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const isHttps =
    forwardedProto === 'https' ||
    req.nextUrl.protocol === 'https:' ||
    process.env.NODE_ENV === 'production';

  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 12, // 12 hours
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
}

export function clearAuthCookie(res: NextResponse, req: NextRequest): void {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const isHttps =
    forwardedProto === 'https' ||
    req.nextUrl.protocol === 'https:' ||
    process.env.NODE_ENV === 'production';

  res.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
}
