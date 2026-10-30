import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import { NextRequest } from 'next/server';

test('Supabase review scans every page even if PostgREST caps batches below 1,000 rows', async () => {
  const now = new Date().toISOString(), adminId = crypto.randomUUID(), sid = crypto.randomUUID();
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: String(i).padStart(4, '0'), class: 6, subject_tag: 'Synthetic', difficulty: 'easy', question_text: `Synthetic question ${i}`, option_a: i < 23 ? 'A considerably longer correct answer' : 'red car', option_b: i < 23 ? 'x' : 'big dog', option_c: i < 23 ? 'y' : 'new pen', option_d: i < 23 ? 'z' : 'old fox', correct_option: 'a', is_active: true, bank_generation: 2, created_at: now, updated_at: now }));
  const offsets: number[] = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    res.setHeader('content-type', 'application/json');
    if (url.pathname === '/rest/v1/auth_sessions') {
      res.end(JSON.stringify([{ id: sid, user_id: adminId, role: 'admin', revoked_at: null, created_at: now, expires_at: new Date(Date.now() + 60_000).toISOString() }])); return;
    }
    if (url.pathname === '/rest/v1/admins') {
      res.end(JSON.stringify([{ id: adminId, username: 'teacher', full_name: 'Teacher', password_hash: 'hash', is_active: true, created_at: now }])); return;
    }
    if (url.pathname === '/rest/v1/questions') {
      const cls = url.searchParams.get('class');
      const filtered = cls ? rows.filter((row) => `eq.${row.class}` === cls) : rows;
      res.setHeader('content-range', `0-${Math.max(0, filtered.length - 1)}/${filtered.length}`);
      if (req.method === 'HEAD') { res.end(); return; }
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Math.min(7, Number(url.searchParams.get('limit') || 1000));
      offsets.push(offset);
      res.end(JSON.stringify(filtered.slice(offset, offset + limit))); return;
    }
    res.statusCode = 404; res.end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.JWT_SECRET = 'test-only-supabase-review-secret-over-thirty-two-bytes';
  try {
    const { signAuthToken } = await import('../src/lib/auth');
    const bank = await import('../src/app/api/admin/questions/route');
    const token = await signAuthToken({ sub: adminId, sid, role: 'admin', name: 'Teacher' });
    const request = new NextRequest('http://school.test/api/admin/questions?length_review=correct_longest&page=3&page_size=10', { headers: { cookie: `mtc_auth_token=${token}` } });
    const response = await bank.GET(request);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.total, 23); assert.equal(data.questions.length, 3);
    assert.deepEqual(offsets, [0, 7, 14, 21, 28], 'no matching rows can be skipped');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});
