import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { attachAuthCookie, signAuthToken } from '@/lib/auth';
import { findAdminByUsername } from '@/lib/db';
import { AuthTokenPayload } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Please enter both Admin Username and Password.' },
        { status: 400 }
      );
    }

    const admin = await findAdminByUsername(username);
    if (!admin) {
      return NextResponse.json(
        { error: 'Invalid admin credentials.' },
        { status: 401 }
      );
    }

    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Invalid admin credentials.' },
        { status: 401 }
      );
    }

    const tokenPayload: AuthTokenPayload = {
      sub: admin.id,
      role: 'admin',
      name: admin.full_name,
      username: admin.username,
    };

    const token = await signAuthToken(tokenPayload);
    const res = NextResponse.json({
      message: 'Admin login successful',
      token,
      user: tokenPayload,
    });
    attachAuthCookie(res, token, req);
    return res;
  } catch {
    return NextResponse.json(
      { error: 'Admin login failed. Please try again.' },
      { status: 500 }
    );
  }
}
