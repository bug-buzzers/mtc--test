import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

test('Supabase registration uses the new service-only RPC and handles failures safely', async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  let registrationCalls = 0;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const path = new URL(req.url || '/', 'http://localhost').pathname;
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}') as Record<string, unknown>;
      calls.push({ path, body });
      res.setHeader('content-type', 'application/json');
      if (req.headers.apikey !== 'mock-service-key') { res.statusCode = 401; res.end('{}'); return; }
      if (path === '/rest/v1/rpc/mtc_rate_limit') { res.end('true'); return; }
      if (path === '/rest/v1/rpc/mtc_register_student') {
        registrationCalls++;
        if (registrationCalls === 1) {
          res.end(JSON.stringify([{ id: 'synthetic-id', full_name: body.p_full_name, roll_number: body.p_roll, class: body.p_class, section: body.p_section, password_hash: body.p_password_hash }]));
        } else if (registrationCalls === 2) {
          res.statusCode = 409; res.end(JSON.stringify({ code: '23505', message: 'private duplicate detail' }));
        } else {
          res.statusCode = 500; res.end(JSON.stringify({ code: '42P01', message: 'private database detail' }));
        }
        return;
      }
      res.statusCode = 404; res.end('{}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-key';
  const logError = console.error;
  try {
    const { POST } = await import('../src/app/api/auth/student/register/route');
    const body = { full_name: 'Example Student', roll_number: 'S001', class: 6, section: 'A', password: 'test-password-long' };
    const request = () => new NextRequest('http://school.test/api/auth/student/register', { method: 'POST', headers: { 'content-type': 'application/json', host: 'school.test', origin: 'http://school.test' }, body: JSON.stringify(body) });
    const response = await POST(request());
    assert.equal(response.status, 201);
    assert.equal('password_hash' in (await response.json()).student, false);
    const rpc = calls.find((call) => call.path.endsWith('/rpc/mtc_register_student'))!;
    assert.deepEqual(Object.keys(rpc.body).sort(), ['p_class', 'p_full_name', 'p_password_hash', 'p_roll', 'p_section']);
    assert.equal(await bcrypt.compare(body.password, String(rpc.body.p_password_hash)), true);
    const duplicate = await POST(request());
    assert.equal(duplicate.status, 409); assert.doesNotMatch(JSON.stringify(await duplicate.json()), /private duplicate detail/);
    console.error = () => {}; // A database outage is expected for this assertion.
    const unavailable = await POST(request());
    assert.equal(unavailable.status, 503); assert.doesNotMatch(JSON.stringify(await unavailable.json()), /private database detail/);
  } finally {
    console.error = logError;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});
