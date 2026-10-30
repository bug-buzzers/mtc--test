import { NextRequest } from 'next/server';
import { getCookieAuth } from './auth';
import { getStudentById } from './db';
import { getAdminById, getSession } from './db/security-store';
import { AuthTokenPayload } from './types';

/** A signed token alone is not sufficient: check the revocable session and account on every request. */
export async function getRequestAuth(req: NextRequest): Promise<AuthTokenPayload | null> {
  const token = await getCookieAuth(req);
  if (!token) return null;
  try {
    const session = await getSession(token.sid);
    if (!session || session.revoked_at || session.user_id !== token.sub || session.role !== token.role || new Date(session.expires_at).getTime() <= Date.now()) return null;
    if (token.role === 'student') {
      const student = await getStudentById(token.sub);
      if (!student?.is_active || student.password_reset_required) return null;
      return { ...token, name: student.full_name, class: student.class, section: student.section, roll_number: student.roll_number };
    }
    const admin = await getAdminById(token.sub);
    if (!admin?.is_active) return null;
    return { ...token, name: admin.full_name, username: admin.username };
  } catch (error) {
    console.error('Unable to verify session', error);
    return null;
  }
}
