import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';

function request(url: string, method = 'GET', body?: unknown, cookie?: string) {
  return new NextRequest(`http://school.test${url}`, { method, headers: { host: 'school.test', origin: 'http://school.test', ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

test('teachers can review all imported length clues across pages and update distractors', async () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'mtc-length-review-'));
  process.env.MTC_LOCAL_DB_PATH = path.join(temp, 'db.json'); process.env.MTC_ALLOW_LOCAL_DEV = 'true';
  process.env.JWT_SECRET = 'test-only-length-review-secret-with-over-32-bytes';
  delete process.env.SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const { readLocalDb, writeLocalDb } = await import('../src/lib/db/local-store');
    const { createSession } = await import('../src/lib/db/security-store');
    const { signAuthToken } = await import('../src/lib/auth');
    const bank = await import('../src/app/api/admin/questions/route');
    const edit = await import('../src/app/api/admin/questions/[id]/route');
    const now = new Date().toISOString(), db = readLocalDb(), adminId = crypto.randomUUID(), studentId = crypto.randomUUID();
    db.admins.push({ id: adminId, username: 'teacher', full_name: 'Teacher', password_hash: 'test', is_active: true, created_at: now });
    db.students.push({ id: studentId, roll_number: 'X', full_name: 'Student', class: 6, section: 'A', password_hash: 'test', password_reset_required: false, is_active: true, extra_attempts: 0, created_at: now, updated_at: now });
    writeLocalDb(db);
    const session = await createSession(adminId, 'admin');
    const cookie = `mtc_auth_token=${await signAuthToken({ sub: adminId, sid: session.id, role: 'admin', name: 'Teacher' })}`;
    const studentSession = await createSession(studentId, 'student');
    const studentCookie = `mtc_auth_token=${await signAuthToken({ sub: studentId, sid: studentSession.id, role: 'student', name: 'Student' })}`;
    const base = { class: 6, subject_tag: 'Synthetic', difficulty: 'easy', option_a: 'A substantially long correct answer', option_b: 'x', option_c: 'y', option_d: 'z', correct_option: 'a' };
    const questions = Array.from({ length: 35 }, (_, i) => ({ ...base, question_text: `Test question ${i}`, ...(i >= 25 ? { option_a: 'red car', option_b: 'big dog', option_c: 'new pen', option_d: 'old fox' } : {}) }));
    const imported = await bank.POST(request('/api/admin/questions', 'POST', { questions }, cookie));
    assert.equal(imported.status, 201);
    const importedData = await imported.json();
    assert.equal(importedData.length_review.correct_longest, 25);
    assert.equal(importedData.length_review.uneven, 25);
    assert.equal((await bank.GET(request('/api/admin/questions?length_review=correct_longest', 'GET', undefined, studentCookie))).status, 403);
    const page1 = await (await bank.GET(request('/api/admin/questions?length_review=correct_longest&page=1&page_size=10', 'GET', undefined, cookie))).json();
    const page3 = await (await bank.GET(request('/api/admin/questions?length_review=correct_longest&page=3&page_size=10', 'GET', undefined, cookie))).json();
    assert.equal(page1.total, 25); assert.equal(page1.questions.length, 10);
    assert.equal(page3.total, 25); assert.equal(page3.questions.length, 5);
    assert.equal(new Set([...page1.questions, ...page3.questions].map((q: { id: string }) => q.id)).size, 15);
    const picked = page1.questions[0];
    const editBody = { ...picked, option_b: 'A plausible but incorrect choice with additional detail here', option_c: 'Yet another plausible but incorrect choice with additional detail here', option_d: 'A different plausible but incorrect choice with additional detail here' };
    const updated = await edit.PUT(request(`/api/admin/questions/${picked.id}`, 'PUT', editBody, cookie), { params: Promise.resolve({ id: picked.id }) });
    assert.equal(updated.status, 200);
    const after = await (await bank.GET(request('/api/admin/questions?length_review=correct_longest&page_size=10', 'GET', undefined, cookie))).json();
    assert.equal(after.total, 24);
    const stored = readLocalDb().questions.find((q) => q.id === picked.id);
    assert.equal(stored?.option_a, picked.option_a); assert.equal(stored?.correct_option, picked.correct_option);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
