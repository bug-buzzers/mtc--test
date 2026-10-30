import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const schema = readFileSync('supabase/schema.sql', 'utf8');
const migration = readFileSync('supabase/admin-password-migration.sql', 'utf8');

test('legacy owner-privileged view is removed and admin security RPCs are service-only', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE VIEW public.student_attempt_summaries AS SELECT 1 AS id;');
    await db.exec(schema);
    assert.equal((await db.query<{ removed: boolean }>("SELECT to_regclass('public.student_attempt_summaries') IS NULL AS removed")).rows[0].removed, true);
    await db.exec(migration); await db.exec(migration);
    const permissions = (await db.query<{ anon: boolean; authenticated: boolean; service: boolean }>(`SELECT
      has_function_privilege('anon','public.mtc_change_admin_password(uuid,uuid,text,text)','EXECUTE') AS anon,
      has_function_privilege('authenticated','public.mtc_bootstrap_admin(text,text,text)','EXECUTE') AS authenticated,
      has_function_privilege('service_role','public.mtc_create_admin_session(uuid,uuid,text,timestamptz)','EXECUTE')
        AND has_function_privilege('service_role','public.mtc_change_admin_password(uuid,uuid,text,text)','EXECUTE')
        AND has_function_privilege('service_role','public.mtc_bootstrap_admin(text,text,text)','EXECUTE') AS service`)).rows[0];
    assert.deepEqual(permissions, { anon: false, authenticated: false, service: true });

    const id = (await db.query<{ id: string }>("INSERT INTO admins(username,full_name,password_hash,is_active) VALUES ('teacher','Teacher','old-hash',true) RETURNING id")).rows[0].id;
    const other = (await db.query<{ id: string }>("INSERT INTO admins(username,full_name,password_hash,is_active) VALUES ('other','Other','other-hash',true) RETURNING id")).rows[0].id;
    const s1 = crypto.randomUUID(), s2 = crypto.randomUUID(), so = crypto.randomUUID();
    const expiry = new Date(Date.now() + 60_000).toISOString();
    async function start(admin: string, session: string, hash: string, expires = expiry) {
      return (await db.query<{ ok: boolean }>('SELECT public.mtc_create_admin_session($1,$2,$3,$4) AS ok', [admin, session, hash, expires])).rows[0].ok;
    }
    async function change(session: string, expected: string, next: string) {
      return (await db.query<{ ok: boolean }>('SELECT public.mtc_change_admin_password($1,$2,$3,$4) AS ok', [id, session, expected, next])).rows[0].ok;
    }
    assert.equal(await start(id, s1, 'old-hash'), true);
    assert.equal(await start(id, s2, 'old-hash'), true);
    assert.equal(await start(other, so, 'other-hash'), true);
    assert.equal(await start(id, crypto.randomUUID(), 'wrong-hash'), false);
    assert.equal(await start(id, crypto.randomUUID(), 'old-hash', new Date(Date.now() - 1000).toISOString()), false);
    assert.equal(await change(crypto.randomUUID(), 'old-hash', 'new-hash'), false);
    assert.equal(await change(s1, 'wrong-hash', 'new-hash'), false);
    assert.equal(await change(s1, 'old-hash', 'new-hash'), true);
    const sessions = (await db.query<{ id: string; revoked: boolean }>('SELECT id, revoked_at IS NOT NULL AS revoked FROM auth_sessions ORDER BY id')).rows;
    assert.equal(sessions.find((s) => s.id === s1)?.revoked, true);
    assert.equal(sessions.find((s) => s.id === s2)?.revoked, true);
    assert.equal(sessions.find((s) => s.id === so)?.revoked, false);
    assert.equal(await start(id, crypto.randomUUID(), 'old-hash'), false, 'a stale verified login must not survive a rotation');
    assert.equal(await change(s1, 'new-hash', 'another-hash'), false, 'a revoked session cannot change a password');
    const s3 = crypto.randomUUID(); assert.equal(await start(id, s3, 'new-hash'), true);
    const bootstrapped = (await db.query<{ id: string }>("SELECT public.mtc_bootstrap_admin('TeAcHeR','bootstrap-hash','Updated Teacher') AS id")).rows[0].id;
    assert.equal(bootstrapped, id, 'bootstrap finds usernames without regard to case');
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int n FROM admins')).rows[0].n, 2);
    assert.equal((await db.query<{ revoked: boolean }>('SELECT revoked_at IS NOT NULL AS revoked FROM auth_sessions WHERE id=$1', [s3])).rows[0].revoked, true);
    assert.equal(await start(id, crypto.randomUUID(), 'new-hash'), false);
    assert.equal(await start(id, crypto.randomUUID(), 'bootstrap-hash'), true);
  } finally { await db.close(); }
});
