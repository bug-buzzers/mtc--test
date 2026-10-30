import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

test('Supabase admin login and password change use service-only atomic RPCs', async () => {
  const oldPassword = 'old-password-for-test', newPassword = 'new-password-for-test';
  const adminId = crypto.randomUUID(), now = new Date().toISOString();
  const admin = { id: adminId, username: 'teacher', full_name: 'Teacher', password_hash: await bcrypt.hash(oldPassword, 4), is_active: true, created_at: now };
  const sessions = new Map<string, { id: string; user_id: string; role: string; expires_at: string; revoked_at: string | null; created_at: string }>();
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const url = new URL(req.url || '/', 'http://localhost');
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}') as Record<string, unknown>;
      calls.push({ path: url.pathname, body });
      res.setHeader('content-type', 'application/json');
      if (req.headers.apikey !== 'mock-service-role-key') { res.statusCode = 401; res.end('{}'); return; }
      if (url.pathname === '/rest/v1/admins') { res.end(JSON.stringify([admin])); return; }
      if (url.pathname === '/rest/v1/auth_sessions') {
        const id = (url.searchParams.get('id') || '').replace(/^eq\./, '');
        res.end(JSON.stringify(sessions.has(id) ? [sessions.get(id)] : [])); return;
      }
      if (url.pathname === '/rest/v1/rpc/mtc_rate_limit') { res.end('true'); return; }
      if (url.pathname === '/rest/v1/rpc/mtc_create_admin_session') {
        if (body.p_admin_id !== admin.id || body.p_expected_hash !== admin.password_hash) { res.end('false'); return; }
        const id = String(body.p_session_id);
        sessions.set(id, { id, user_id: admin.id, role: 'admin', expires_at: String(body.p_expires_at), revoked_at: null, created_at: now });
        res.end('true'); return;
      }
      if (url.pathname === '/rest/v1/rpc/mtc_change_admin_password') {
        const session = sessions.get(String(body.p_session_id));
        if (body.p_admin_id !== admin.id || body.p_expected_hash !== admin.password_hash || !session || session.revoked_at) { res.end('false'); return; }
        admin.password_hash = String(body.p_new_hash);
        for (const s of sessions.values()) s.revoked_at = new Date().toISOString();
        res.end('true'); return;
      }
      res.statusCode = 404; res.end('{}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.JWT_SECRET = 'test-only-supabase-admin-secret-at-least-thirty-two-bytes';
  try {
    const login = await import('../src/app/api/auth/admin/login/route');
    const password = await import('../src/app/api/auth/admin/password/route');
    const request = (url: string, body: unknown, cookie?: string) => new NextRequest(`http://school.test${url}`, {
      method: 'POST', headers: { 'content-type': 'application/json', host: 'school.test', origin: 'http://school.test', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
    });
    const loggedIn = await login.POST(request('/api/auth/admin/login', { username: 'teacher', password: oldPassword }));
    assert.equal(loggedIn.status, 200);
    const cookie = loggedIn.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
    const changed = await password.POST(request('/api/auth/admin/password', { current_password: oldPassword, new_password: newPassword }, cookie));
    assert.equal(changed.status, 200);
    const createCall = calls.find((call) => call.path.endsWith('/rpc/mtc_create_admin_session')); assert.ok(createCall);
    const changeCall = calls.find((call) => call.path.endsWith('/rpc/mtc_change_admin_password')); assert.ok(changeCall);
    assert.equal(changeCall.body.p_admin_id, adminId);
    assert.equal(changeCall.body.p_session_id, createCall.body.p_session_id);
    assert.equal(changeCall.body.p_expected_hash, createCall.body.p_expected_hash);
    assert.equal(await bcrypt.compare(newPassword, String(changeCall.body.p_new_hash)), true);
    assert.equal(await bcrypt.compare(oldPassword, admin.password_hash), false);
    assert.ok([...sessions.values()].every((s) => s.revoked_at));
    assert.equal(JSON.stringify(calls).includes(oldPassword), false, 'plaintext passwords must not be sent to the database');
    assert.equal(JSON.stringify(calls).includes(newPassword), false, 'plaintext passwords must not be sent to the database');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});
