import crypto from 'crypto';
import { getSupabase, isSupabaseConfigured } from './connection';
import { readLocalDb, writeLocalDb } from './local-store';
import { Admin, AuthSession, Student } from '../types';

function unwrap<T>(data: T | T[] | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  const value = Array.isArray(data) ? data[0] : data;
  if (!value) throw new Error('Database operation returned no result');
  return value as T;
}

export async function createSession(userId: string, role: 'admin' | 'student'): Promise<AuthSession> {
  const now = Date.now();
  const session: AuthSession = { id: crypto.randomUUID(), user_id: userId, role, created_at: new Date(now).toISOString(), expires_at: new Date(now + 8 * 60 * 60 * 1000).toISOString(), revoked_at: null };
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase().from('auth_sessions').insert(session);
    if (error) throw new Error(error.message);
  } else {
    const db = readLocalDb();
    db.auth_sessions.push(session);
    writeLocalDb(db);
  }
  return session;
}

/** Lock the account and ensure the verified hash is still current before creating
 * a session. This closes the race between sign-in and password rotation. */
export async function createAdminSession(userId: string, expectedHash: string): Promise<AuthSession | null> {
  const now = Date.now();
  const session: AuthSession = { id: crypto.randomUUID(), user_id: userId, role: 'admin', created_at: new Date(now).toISOString(), expires_at: new Date(now + 8 * 60 * 60 * 1000).toISOString(), revoked_at: null };
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().rpc('mtc_create_admin_session', {
      p_admin_id: userId, p_session_id: session.id, p_expected_hash: expectedHash, p_expires_at: session.expires_at,
    });
    if (error) throw new Error(error.message);
    return data === true ? session : null;
  }
  const db = readLocalDb();
  const admin = db.admins.find((a) => a.id === userId && a.is_active && a.password_hash === expectedHash);
  if (!admin) return null;
  db.auth_sessions.push(session); writeLocalDb(db);
  return session;
}

/** Change the hash only for the still-current admin/session and revoke all admin
 * sessions atomically. Password comparison happens in the authenticated API. */
export async function changeAdminPassword(userId: string, sessionId: string, expectedHash: string, newHash: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().rpc('mtc_change_admin_password', {
      p_admin_id: userId, p_session_id: sessionId, p_expected_hash: expectedHash, p_new_hash: newHash,
    });
    if (error) throw new Error(error.message);
    return data === true;
  }
  const db = readLocalDb();
  const admin = db.admins.find((a) => a.id === userId && a.is_active && a.password_hash === expectedHash);
  const session = db.auth_sessions.find((s) => s.id === sessionId && s.user_id === userId && s.role === 'admin' && !s.revoked_at && new Date(s.expires_at).getTime() > Date.now());
  if (!admin || !session || !newHash || newHash === expectedHash) return false;
  admin.password_hash = newHash;
  const now = new Date().toISOString();
  for (const s of db.auth_sessions) if (s.user_id === userId && s.role === 'admin' && !s.revoked_at) s.revoked_at = now;
  writeLocalDb(db);
  return true;
}

export async function getSession(id: string): Promise<AuthSession | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().from('auth_sessions').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as AuthSession | null;
  }
  return readLocalDb().auth_sessions.find((s) => s.id === id) || null;
}

export async function revokeSession(id: string): Promise<void> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase().from('auth_sessions').update({ revoked_at: now }).eq('id', id).is('revoked_at', null);
    if (error) throw new Error(error.message);
  } else {
    const db = readLocalDb();
    const session = db.auth_sessions.find((s) => s.id === id);
    if (session) session.revoked_at = now;
    writeLocalDb(db);
  }
}

export async function revokeUserSessions(userId: string, role: 'student' | 'admin'): Promise<void> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase().from('auth_sessions').update({ revoked_at: now }).eq('user_id', userId).eq('role', role).is('revoked_at', null);
    if (error) throw new Error(error.message);
  } else {
    const db = readLocalDb();
    for (const s of db.auth_sessions) if (s.user_id === userId && s.role === role && !s.revoked_at) s.revoked_at = now;
    writeLocalDb(db);
  }
}

export async function getAdminById(id: string): Promise<Admin | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().from('admins').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Admin | null;
  }
  return readLocalDb().admins.find((a) => a.id === id) || null;
}

/** Distributed in Supabase mode. Keys contain only a one-way hash of identifier/IP. */
export async function consumeRateLimit(scope: string, identifier: string, ip: string, limit = 10, windowSeconds = 900): Promise<boolean> {
  const key = crypto.createHash('sha256').update(`${scope}\0${identifier.toLowerCase()}\0${ip}`).digest('hex');
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().rpc('mtc_rate_limit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) throw new Error(error.message);
    return data === true;
  }
  const db = readLocalDb();
  const now = Date.now();
  let entry = db.login_limits.find((l) => l.key === key);
  if (!entry) {
    entry = { key, count: 0, window_started_at: new Date(now).toISOString() };
    db.login_limits.push(entry);
  }
  if (new Date(entry.window_started_at).getTime() + windowSeconds * 1000 <= now) {
    entry.count = 0; entry.window_started_at = new Date(now).toISOString();
  }
  entry.count++;
  writeLocalDb(db);
  return entry.count <= limit;
}

export class StudentAlreadyRegisteredError extends Error {
  constructor() { super('An account with these details is already registered.'); this.name = 'StudentAlreadyRegisteredError'; }
}

/** Create a student without a registration code. In Supabase the RPC
 * serializes registrations for the same roll/class/section. */
export async function registerStudent(input: { roll_number: string; full_name: string; class: number; section: string; password_hash: string }): Promise<Student> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().rpc('mtc_register_student', { p_full_name: input.full_name, p_roll: input.roll_number, p_class: input.class, p_section: input.section, p_password_hash: input.password_hash });
    if (error?.code === '23505') throw new StudentAlreadyRegisteredError();
    return unwrap<Student>(data, error);
  }
  const db = readLocalDb();
  if (db.students.some((s) => s.class === input.class && s.section === input.section && s.roll_number.trim().toLowerCase() === input.roll_number.trim().toLowerCase())) throw new StudentAlreadyRegisteredError();
  const now = new Date().toISOString();
  const student: Student = { id: crypto.randomUUID(), roll_number: input.roll_number.trim(), full_name: input.full_name.trim(), class: input.class,
    section: input.section, password_hash: input.password_hash, is_active: true, password_reset_required: false, extra_attempts: 0, created_at: now, updated_at: now };
  db.students.push(student); writeLocalDb(db);
  return student;
}

/** Names only, limited to the authenticated student's own class and section. */
export async function listClassmateNames(student: Student): Promise<string[]> {
  if (isSupabaseConfigured()) {
    const names: string[] = [];
    for (let offset = 0; ; ) {
      const { data, error, count } = await getSupabase().from('students').select('id,full_name', { count: 'exact' }).eq('class', student.class).eq('section', student.section).eq('is_active', true).neq('id', student.id).order('full_name').order('id').range(offset, offset + 999);
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      names.push(...data.map((s: { full_name: string }) => s.full_name));
      offset += data.length;
      if (count !== null && offset >= count) break;
    }
    return names;
  }
  return readLocalDb().students.filter((s) => s.id !== student.id && s.is_active && s.class === student.class && s.section === student.section).map((s) => s.full_name).sort((a, b) => a.localeCompare(b));
}
