import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from './lib/constants';
import { verifyAuthToken } from './lib/auth';

/** Same-origin enforcement protects cookie-authenticated mutations from CSRF. */
export function hasSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0].trim();
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();
    return parsed.host.toLowerCase() === host.toLowerCase() && (!forwardedProto || parsed.protocol === `${forwardedProto}:`);
  } catch { return false; }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !hasSameOrigin(req)) {
    return NextResponse.json({ error: 'A same-origin request is required.' }, { status: 403 });
  }
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/student')) return NextResponse.next();
  if (pathname === '/admin/login' || pathname === '/student/login' || pathname === '/student/register') return NextResponse.next();
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) return NextResponse.redirect(new URL(pathname.startsWith('/admin') ? '/admin/login' : '/student/login', req.url));
  if (pathname.startsWith('/admin') && payload.role !== 'admin') return NextResponse.redirect(new URL('/student/dashboard', req.url));
  if (pathname.startsWith('/student') && payload.role !== 'student') return NextResponse.redirect(new URL('/admin/dashboard', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/api/:path*', '/admin/:path*', '/student/:path*'] };
