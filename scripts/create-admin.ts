import { loadEnvConfig } from '@next/env';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getSupabase, isSupabaseConfigured } from '../src/lib/db/connection';
import { readLocalDb, writeLocalDb } from '../src/lib/db/local-store';
import { revokeUserSessions } from '../src/lib/db/security-store';

loadEnvConfig(process.cwd());
async function main() {
  const username = (process.env.MTC_ADMIN_USERNAME || '').trim();
  const password = process.env.MTC_ADMIN_PASSWORD || '';
  const fullName = (process.env.MTC_ADMIN_FULL_NAME || 'School coordinator').trim();
  if (!username || username.length > 100 || password.length < 12 || Buffer.byteLength(password) > 72) {
    throw new Error('Provide MTC_ADMIN_USERNAME and a unique MTC_ADMIN_PASSWORD of at least 12 characters (maximum 72 bytes).');
  }
  const hash = await bcrypt.hash(password, 12);
  let id: string;
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().from('admins').upsert({ username, password_hash: hash, full_name: fullName, is_active: true }, { onConflict: 'username' }).select('id').single();
    if (error || !data) throw new Error(error?.message || 'Unable to create administrator');
    id = data.id;
  } else {
    const db = readLocalDb();
    let admin = db.admins.find((a) => a.username.toLowerCase() === username.toLowerCase());
    if (!admin) { admin = { id: crypto.randomUUID(), username, password_hash: hash, full_name: fullName, is_active: true, created_at: new Date().toISOString() }; db.admins.push(admin); }
    else { admin.password_hash = hash; admin.full_name = fullName; admin.is_active = true; }
    id = admin.id; writeLocalDb(db);
  }
  await revokeUserSessions(id, 'admin');
  console.log('Administrator created or rotated. Existing sessions were revoked.');
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Unable to create administrator'); process.exitCode = 1; });
