import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from './lib/constants';
import { verifyAuthToken } from './lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!cookieToken) {
    // Allow client guard + API Bearer auth to verify session when running inside
    // cross-origin preview iframes where browsers may restrict third-party cookies.
    return NextResponse.next();
  }

  const payload = await verifyAuthToken(cookieToken);
  if (!payload) {
    return NextResponse.next();
  }

  // Prevent students from accessing any protected /admin/* page
  if (
    pathname.startsWith('/admin') &&
    pathname !== '/admin/login' &&
    payload.role !== 'admin'
  ) {
    return NextResponse.redirect(new URL('/student/dashboard', req.url));
  }

  // Prevent admins from accessing student exam pages
  if (
    (pathname.startsWith('/student/dashboard') ||
      pathname.startsWith('/student/quiz') ||
      pathname.startsWith('/student/submitted') ||
      pathname.startsWith('/student/result')) &&
    payload.role !== 'student'
  ) {
    return NextResponse.redirect(new URL('/admin/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/student/:path*'],
};
