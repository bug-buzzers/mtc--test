import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

function request(url: string, body: unknown, cookie?: string, origin = 'http://school.test') {
  return new NextRequest(`http://school.test${url}`, {
    method: 'POST', headers: { host: 'school.test', origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
  });
}
function cookie(res: Response) {
  const value = res.headers.get('set-cookie'); assert.ok(value); return value.split(';')[0];
}

test('admin password changes require the current password and revoke every session', async () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'mtc-admin-password-'));
  process.env.MTC_LOCAL_DB_PATH = path.join(temp, 'db.json');
  process.env.MTC_ALLOW_LOCAL_DEV = 'true';
  process.env.JWT_SECRET = 'this-is-a-long-random-looking-test-only-secret';
  delete process.env.SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const local = await import('../src/lib/db/local-store');
    const security = await import('../src/lib/db/security-store');
    const { signAuthToken } = await import('../src/lib/auth');
    const { proxy } = await import('../src/proxy');
    const login = await import('../src/app/api/auth/admin/login/route');
    const password = await import('../src/app/api/auth/admin/password/route');
    const me = await import('../src/app/api/auth/me/route');
    const now = new Date().toISOString();
    const adminId = crypto.randomUUID(), otherId = crypto.randomUUID(), studentId = crypto.randomUUID();
    const oldPassword = 'a-test-old-password', newPassword = 'a-test-new-password';
    const oldHash = await bcrypt.hash(oldPassword, 4);
    const db = local.readLocalDb();
    db.admins.push({ id: adminId, username: 'teacher', full_name: 'Test Teacher', password_hash: oldHash, is_active: true, created_at: now });
    db.admins.push({ id: otherId, username: 'other', full_name: 'Other Teacher', password_hash: oldHash, is_active: true, created_at: now });
    db.students.push({ id: studentId, roll_number: 'T-001', full_name: 'Test Student', class: 6, section: 'A', password_hash: oldHash, is_active: true, password_reset_required: false, extra_attempts: 0, created_at: now, updated_at: now });
    local.writeLocalDb(db);
    const loginBody = { username: 'teacher', password: oldPassword };
    const first = await login.POST(request('/api/auth/admin/login', loginBody)); assert.equal(first.status, 200);
    const second = await login.POST(request('/api/auth/admin/login', loginBody)); assert.equal(second.status, 200);
    const firstCookie = cookie(first), secondCookie = cookie(second);
    const otherSession = await security.createAdminSession(otherId, oldHash); assert.ok(otherSession);
    const studentSession = await security.createSession(studentId, 'student');
    const studentToken = await signAuthToken({ sub: studentId, sid: studentSession.id, role: 'student', name: 'Test Student' });
    const studentCookie = `mtc_auth_token=${studentToken}`;

    const change = (current: string, next: string, as = firstCookie) => password.POST(request('/api/auth/admin/password', { current_password: current, new_password: next }, as));
    assert.equal((await password.POST(request('/api/auth/admin/password', { current_password: oldPassword, new_password: newPassword }))).status, 403);
    assert.equal((await change(oldPassword, newPassword, studentCookie)).status, 403);
    assert.equal((await proxy(request('/api/auth/admin/password', {}, firstCookie, 'https://attacker.example'))).status, 403);
    assert.equal((await change(oldPassword, 'short')).status, 400);
    assert.equal((await change(oldPassword, 'é'.repeat(37))).status, 400, 'bcrypt limit is measured in bytes');
    assert.equal((await change(oldPassword, oldPassword)).status, 400);
    assert.equal((await change('wrong-current-password', newPassword)).status, 401);
    assert.equal(local.readLocalDb().admins.find((a) => a.id === adminId)?.password_hash, oldHash);

    const changed = await change(oldPassword, newPassword);
    assert.equal(changed.status, 200);
    assert.match(changed.headers.get('set-cookie') || '', /Max-Age=0/i);
    assert.doesNotMatch(JSON.stringify(await changed.json()), /a-test-(old|new)-password/);
    const after = local.readLocalDb();
    const updated = after.admins.find((a) => a.id === adminId)!;
    assert.equal(await bcrypt.compare(newPassword, updated.password_hash), true);
    assert.equal(await bcrypt.compare(oldPassword, updated.password_hash), false);
    assert.ok(after.auth_sessions.filter((s) => s.user_id === adminId && s.role === 'admin').every((s) => s.revoked_at));
    assert.equal(after.auth_sessions.find((s) => s.id === otherSession.id)?.revoked_at, null);
    assert.equal(after.auth_sessions.find((s) => s.id === studentSession.id)?.revoked_at, null);
    assert.equal((await me.GET(new NextRequest('http://school.test/api/auth/me', { headers: { cookie: firstCookie } }))).status, 401);
    assert.equal((await me.GET(new NextRequest('http://school.test/api/auth/me', { headers: { cookie: secondCookie } }))).status, 401);
    assert.equal(await security.createAdminSession(adminId, oldHash), null, 'a login that verified the old hash cannot create a new session after rotation');
    assert.equal((await login.POST(request('/api/auth/admin/login', loginBody))).status, 401);
    const newLogin = await login.POST(request('/api/auth/admin/login', { username: 'teacher', password: newPassword }));
    assert.equal(newLogin.status, 200);

    // Account-wide rate limiting covers requests from different IP addresses.
    const reset = local.readLocalDb(); reset.login_limits = []; local.writeLocalDb(reset);
    const currentCookie = cookie(newLogin);
    for (let i = 0; i < 5; i++) {
      const req = request('/api/auth/admin/password', { current_password: 'wrong-password', new_password: 'different-password' }, currentCookie);
      req.headers.set('x-forwarded-for', `192.0.2.${i + 1}`);
      assert.equal((await password.POST(req)).status, 401);
    }
    const blocked = request('/api/auth/admin/password', { current_password: 'wrong-password', new_password: 'different-password' }, currentCookie);
    blocked.headers.set('x-forwarded-for', '192.0.2.90');
    assert.equal((await password.POST(blocked)).status, 429);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
