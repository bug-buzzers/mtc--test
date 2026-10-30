import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';

function request(url: string, method = 'GET', body?: unknown, cookie?: string) {
  return new NextRequest(`http://school.test${url}`, {
    method,
    headers: { host: 'school.test', origin: 'http://school.test', ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
function cookieFrom(res: Response) { const cookie = res.headers.get('set-cookie'); assert.ok(cookie); return cookie.split(';')[0]; }

test('authenticated registration, question bank, integrity, grading and published result flow', async () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'mtc-test-'));
  process.env.MTC_LOCAL_DB_PATH = path.join(temp, 'db.json');
  process.env.MTC_ALLOW_LOCAL_DEV = 'true';
  process.env.JWT_SECRET = 'this-is-a-long-random-looking-test-only-secret';
  delete process.env.SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const local = await import('../src/lib/db/local-store');
    const { verifyAuthToken, signAuthToken } = await import('../src/lib/auth');
    const { proxy } = await import('../src/proxy');
    const adminLogin = await import('../src/app/api/auth/admin/login/route');
    const studentLogin = await import('../src/app/api/auth/student/login/route');
    const register = await import('../src/app/api/auth/student/register/route');
    const logout = await import('../src/app/api/auth/logout/route');
    const questions = await import('../src/app/api/admin/questions/route');
    const adminStudents = await import('../src/app/api/admin/students/route');
    const settings = await import('../src/app/api/admin/settings/[class]/route');
    const status = await import('../src/app/api/quiz/status/route');
    const start = await import('../src/app/api/quiz/start/route');
    const save = await import('../src/app/api/quiz/save/route');
    const violation = await import('../src/app/api/quiz/violation/route');
    const submit = await import('../src/app/api/quiz/submit/route');
    const result = await import('../src/app/api/quiz/result/[attemptId]/route');
    const review = await import('../src/app/api/admin/integrity/route');
    const studentUpdate = await import('../src/app/api/admin/students/[id]/route');
    const unlock = await import('../src/app/api/admin/integrity/[attemptId]/unlock/route');
    const { createSession, consumeRateLimit } = await import('../src/lib/db/security-store');
    const now = new Date().toISOString();
    const db = local.readLocalDb();
    const adminId = crypto.randomUUID();
    db.admins.push({ id: adminId, username: 'test-teacher', full_name: 'Test Teacher', password_hash: await bcrypt.hash('a-test-password-123', 4), is_active: true, created_at: now });
    local.writeLocalDb(db);

    const crossSite = new NextRequest('http://school.test/api/quiz/start', { method: 'POST', headers: { host: 'school.test', origin: 'https://attacker.example' } });
    assert.equal((await proxy(crossSite)).status, 403);
    assert.equal((await proxy(request('/api/quiz/start', 'POST', {}))).status, 200);
    const forged = await new SignJWT({ sub: adminId, sid: 'fake', role: 'admin', name: 'Teacher' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('wrong-secret-that-is-long-enough-for-test'));
    assert.equal(await verifyAuthToken(forged), null);
    assert.equal((await questions.GET(request('/api/admin/questions', 'GET', undefined, `mtc_auth_token=${forged}`))).status, 403);
    const secret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    await assert.rejects(() => signAuthToken({ sub: adminId, sid: 'test', role: 'admin', name: 'Teacher' }), /JWT_SECRET/);
    assert.equal(await verifyAuthToken(forged), null);
    process.env.JWT_SECRET = secret;
    const realSignedButNoSession = await signAuthToken({ sub: adminId, sid: crypto.randomUUID(), role: 'admin', name: 'Teacher' });
    assert.equal((await questions.GET(request('/api/admin/questions', 'GET', undefined, `mtc_auth_token=${realSignedButNoSession}`))).status, 403);

    const adminResponse = await adminLogin.POST(request('/api/auth/admin/login', 'POST', { username: 'test-teacher', password: 'a-test-password-123' }));
    assert.equal(adminResponse.status, 200);
    const adminCookie = cookieFrom(adminResponse);
    assert.match(adminResponse.headers.get('set-cookie') || '', /HttpOnly/i);
    const registration = { full_name: 'First Student', roll_number: 'T001', class: 6, section: 'A', password: 'student-test-password' };
    assert.equal((await register.POST(request('/api/auth/student/register', 'POST', { ...registration, class: 11, section: 'A' }))).status, 400, 'class and section must be valid');
    assert.equal((await register.POST(request('/api/auth/student/register', 'POST', { ...registration, password: 'short' }))).status, 400, 'a strong password is still required');
    const registered = await register.POST(request('/api/auth/student/register', 'POST', registration));
    assert.equal(registered.status, 201, 'registration must not require a code');
    const registrationData = await registered.json();
    assert.equal('password_hash' in registrationData.student, false);
    assert.equal((await register.POST(request('/api/auth/student/register', 'POST', { ...registration, roll_number: 't001' }))).status, 409, 'case variations cannot claim an existing roll number');
    assert.equal((await adminStudents.POST(request('/api/admin/students', 'POST', { ...registration, roll_number: 't001' }, adminCookie))).status, 409, 'administrator creation must use the same duplicate checks');
    assert.notEqual(local.readLocalDb().students[0].password_hash, registration.password, 'passwords must still be hashed');
    for (let i = 0; i < 8; i++) assert.equal(await consumeRateLimit('registration', '6:A:RATE', 'unknown', 8), true);
    assert.equal((await register.POST(request('/api/auth/student/register', 'POST', { ...registration, roll_number: 'RATE' }))).status, 429, 'registration remains rate-limited');
    const login = await studentLogin.POST(request('/api/auth/student/login', 'POST', { roll_number: 'T001', class: 6, section: 'A', password: 'student-test-password' }));
    assert.equal(login.status, 200);
    const studentCookie = cookieFrom(login);
    assert.equal((await questions.GET(request('/api/admin/questions', 'GET', undefined, studentCookie))).status, 403);

    const updatedDb = local.readLocalDb();
    const student = updatedDb.students.find((s) => s.roll_number === 'T001'); assert.ok(student);
    const makePeer = (full_name: string, section: string, is_active: boolean) => ({ ...student, id: crypto.randomUUID(), roll_number: crypto.randomUUID(), full_name, section, is_active, created_at: now, updated_at: now });
    const peer = makePeer('Same Section', 'A', true);
    const legacy = { ...makePeer('Legacy account', 'B', false), password_reset_required: true };
    updatedDb.students.push(peer, makePeer('Other Section', 'B', true), makePeer('Inactive Peer', 'A', false), legacy);
    local.writeLocalDb(updatedDb);
    const legacyParams = { params: Promise.resolve({ id: legacy.id }) };
    assert.equal((await studentUpdate.PUT(request('/api/admin/students/x', 'PUT', { is_active: true }, adminCookie), legacyParams)).status, 400, 'an old password must be reset before reactivation');
    assert.equal((await studentUpdate.PUT(request('/api/admin/students/x', 'PUT', { new_password: 'fresh-password-for-test' }, adminCookie), legacyParams)).status, 200);
    assert.equal((await studentUpdate.PUT(request('/api/admin/students/x', 'PUT', { is_active: true }, adminCookie), legacyParams)).status, 200);
    let response: Response = await status.GET(request('/api/quiz/status', 'GET', undefined, studentCookie));
    let data = await response.json();
    assert.deepEqual(data.classmates, ['Same Section']);
    assert.equal(data.exam.is_open, false, 'empty private bank stays closed');

    const classParams = { params: Promise.resolve({ class: '6' }) };
    assert.equal((await settings.PUT(request('/api/admin/settings/6', 'PUT', { is_open: true }, adminCookie), classParams)).status, 400, 'a class cannot open without enough private questions');
    const privateQuestions = Array.from({ length: 30 }, (_, i) => ({ class: 6, subject_tag: i % 2 ? 'Topic B' : 'Topic A', difficulty: i % 2 ? 'medium' : 'easy', question_text: `Synthetic question ${i}`, option_a: 'Original A', option_b: 'B', option_c: 'C', option_d: 'D', correct_option: 'a' }));
    response = await questions.POST(request('/api/admin/questions', 'POST', { questions: privateQuestions }, adminCookie));
    assert.equal(response.status, 201);
    response = await questions.GET(request('/api/admin/questions?page=2&page_size=10&class=6&sort=question', 'GET', undefined, adminCookie));
    data = await response.json();
    assert.equal(data.total, 30); assert.equal(data.questions.length, 10);
    response = await questions.GET(request('/api/admin/questions?search=Synthetic%20question%2029&difficulty=medium', 'GET', undefined, adminCookie));
    data = await response.json(); assert.equal(data.total, 1);
    response = await settings.PUT(request('/api/admin/settings/6', 'PUT', { is_open: true, total_questions: 3, passing_score: 2, time_limit_minutes: 5 }, adminCookie), classParams);
    assert.equal(response.status, 200);
    response = await start.POST(request('/api/quiz/start', 'POST', { acknowledged: false, fullscreen: true }, studentCookie));
    assert.equal(response.status, 400);
    response = await start.POST(request('/api/quiz/start', 'POST', { acknowledged: true, fullscreen: true }, studentCookie));
    assert.equal(response.status, 200);
    const exam = await response.json();
    assert.equal(exam.questions.length, 3);
    assert.equal(JSON.stringify(exam).includes('correct_option'), false, 'answer key must not be exposed');
    assert.equal(JSON.stringify(exam).includes('correctLongest'), false, 'answer-dependent review metadata must not be exposed');
    assert.equal(JSON.stringify(exam).includes('length_review'), false, 'admin review metadata must not be exposed');
    response = await start.POST(request('/api/quiz/start', 'POST', { acknowledged: true, fullscreen: true }, studentCookie));
    assert.equal((await response.json()).attempt_id, exam.attempt_id, 'reload should resume the same attempt');
    const answers = exam.questions.map((q: { response_id: string }, i: number) => ({ response_id: q.response_id, selected_option: i === 2 ? 'b' : 'a' }));
    assert.equal((await save.PATCH(request('/api/quiz/save', 'PATCH', { attempt_id: exam.attempt_id, responses: answers }, studentCookie))).status, 200);
    response = await violation.POST(request('/api/quiz/violation', 'POST', { attempt_id: exam.attempt_id, event: 'tab_hidden' }, studentCookie));
    assert.equal((await response.json()).status, 'in_progress');
    response = await violation.POST(request('/api/quiz/violation', 'POST', { attempt_id: exam.attempt_id, event: 'tab_hidden' }, studentCookie));
    assert.equal((await response.json()).status, 'blocked');
    assert.equal((await save.PATCH(request('/api/quiz/save', 'PATCH', { attempt_id: exam.attempt_id, responses: answers }, studentCookie))).status, 423);
    assert.equal((await submit.POST(request('/api/quiz/submit', 'POST', { attempt_id: exam.attempt_id, responses: answers }, studentCookie))).status, 423);
    data = await (await status.GET(request('/api/quiz/status', 'GET', undefined, studentCookie))).json();
    assert.equal(data.exam.has_blocked_attempt, true);
    data = await (await review.GET(request('/api/admin/integrity', 'GET', undefined, adminCookie))).json();
    assert.equal(data.attempts.length, 1);
    const attemptParams = { params: Promise.resolve({ attemptId: exam.attempt_id }) };
    assert.equal((await unlock.POST(request('/api/admin/integrity/unlock', 'POST', {}, studentCookie), attemptParams)).status, 403);
    assert.equal((await unlock.POST(request('/api/admin/integrity/unlock', 'POST', {}, adminCookie), attemptParams)).status, 200);

    // Editing the source bank and pass mark after start cannot change this paper or grade.
    const changed = local.readLocalDb(); changed.questions.forEach((q) => { q.correct_option = 'd'; q.option_a = 'Changed'; }); local.writeLocalDb(changed);
    assert.equal((await settings.PUT(request('/api/admin/settings/6', 'PUT', { passing_score: 3 }, adminCookie), classParams)).status, 200);
    response = await submit.POST(request('/api/quiz/submit', 'POST', { attempt_id: exam.attempt_id, responses: answers }, studentCookie));
    assert.equal(response.status, 200);
    data = await (await status.GET(request('/api/quiz/status', 'GET', undefined, studentCookie))).json();
    assert.equal('correct_count' in data.history[0], false, 'scores remain hidden before publication');
    assert.equal((await result.GET(request('/api/quiz/result/x', 'GET', undefined, studentCookie), attemptParams)).status, 403);
    const peerSession = await createSession(peer.id, 'student');
    const peerToken = await signAuthToken({ sub: peer.id, sid: peerSession.id, role: 'student', name: peer.full_name });
    assert.equal((await result.GET(request('/api/quiz/result/x', 'GET', undefined, `mtc_auth_token=${peerToken}`), attemptParams)).status, 404);
    assert.equal((await settings.PUT(request('/api/admin/settings/6', 'PUT', { show_results_to_students: true }, adminCookie), classParams)).status, 200);
    response = await result.GET(request('/api/quiz/result/x', 'GET', undefined, studentCookie), attemptParams);
    assert.equal(response.status, 200);
    data = await response.json(); assert.equal(data.attempt.correct_count, 2); assert.equal(data.attempt.passed, true); assert.equal(data.attempt.passing_score, 2);
    assert.ok(data.items.every((item: { option_a: string; correct_option: string }) => item.option_a === 'Original A' && item.correct_option === 'a'));
    const analytics = await (await import('../src/lib/db')).getAnalyticsSummary();
    assert.ok(analytics.hardest_questions.every((q) => q.correct_option === 'a'), 'analytics must use question snapshots too');
    await logout.POST(request('/api/auth/logout', 'POST', {}, studentCookie));
    assert.equal((await status.GET(request('/api/quiz/status', 'GET', undefined, studentCookie))).status, 401, 'logout revokes the signed session');
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
