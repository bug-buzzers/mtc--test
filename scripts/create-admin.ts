import { loadEnvConfig } from '@next/env';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getSupabase, isSupabaseConfigured } from '../src/lib/db/connection';
import { readLocalDb, writeLocalDb } from '../src/lib/db/local-store';
import { isValidAdminPassword } from '../src/lib/password-policy';

loadEnvConfig(process.cwd());
async function main() {
  const username = (process.env.MTC_ADMIN_USERNAME || '').trim();
  const password = process.env.MTC_ADMIN_PASSWORD || '';
  const fullName = (process.env.MTC_ADMIN_FULL_NAME || 'School coordinator').trim();
  if (!username || username.length > 100 || !fullName || fullName.length > 120 || !isValidAdminPassword(password)) {
    throw new Error('Provide a username, a name and a unique password of at least 12 characters (maximum 72 UTF-8 bytes).');
  }
  const hash = await bcrypt.hash(password, 12);
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().rpc('mtc_bootstrap_admin', { p_username: username, p_password_hash: hash, p_full_name: fullName });
    if (error || !data) throw new Error('Unable to create or rotate the administrator. Apply the current schema and check the server configuration.');
  } else {
    const db = readLocalDb();
    const matches = db.admins.filter((a) => a.username.toLowerCase() === username.toLowerCase());
    if (matches.length > 1) throw new Error('Duplicate administrator usernames require review.');
    let admin = matches[0];
    if (!admin) { admin = { id: crypto.randomUUID(), username, password_hash: hash, full_name: fullName, is_active: true, created_at: new Date().toISOString() }; db.admins.push(admin); }
    else { admin.password_hash = hash; admin.full_name = fullName; admin.is_active = true; }
    const now = new Date().toISOString();
    for (const session of db.auth_sessions) if (session.user_id === admin.id && session.role === 'admin' && !session.revoked_at) session.revoked_at = now;
    writeLocalDb(db);
  }
  console.log('Administrator created or rotated. Existing sessions were revoked.');
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Unable to create administrator'); process.exitCode = 1; });
