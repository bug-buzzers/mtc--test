import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('local legacy data is backed up, preserved and secured once', async () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'mtc-migrate-'));
  const file = path.join(temp, 'db.json');
  process.env.MTC_LOCAL_DB_PATH = file;
  process.env.MTC_ALLOW_LOCAL_DEV = 'true';
  delete process.env.SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const now = new Date().toISOString();
  const legacy = { schema_source: 'legacy', admins: [{ id: 'admin', username: 'old', password_hash: 'old-hash', full_name: 'Teacher', created_at: now }],
    students: [{ id: 'student', roll_number: 'X', full_name: 'Student', class: 6, section: 'A', password_hash: 'old-hash', is_active: true, extra_attempts: 0, created_at: now, updated_at: now }],
    questions: [{ id: 'question', class: 6, subject_tag: 'Old', difficulty: 'easy', question_text: 'Old question', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', correct_option: 'a', is_active: true, created_at: now, updated_at: now }],
    exam_config: [{ id: 'config', class: 6, is_open: true, total_questions: 1, time_limit_minutes: 30, passing_score: 1, max_attempts: 1, show_results_to_students: true, updated_at: now }],
    quiz_attempts: [{ id: 'attempt', student_id: 'student', class: 6, started_at: now, submitted_at: null, total_questions: 1, correct_count: null, score_percentage: null, passed: null, status: 'in_progress' }],
    quiz_responses: [{ id: 'response', attempt_id: 'attempt', question_id: 'question', question_order: 1, selected_option: 'a', is_correct: null }] };
  writeFileSync(file, JSON.stringify(legacy));
  try {
    const { readLocalDb, writeLocalDb } = await import('../src/lib/db/local-store');
    const migrated = readLocalDb();
    assert.ok(existsSync(`${file}.pre-security-backup`));
    assert.equal(JSON.parse(readFileSync(`${file}.pre-security-backup`, 'utf8')).schema_source, 'legacy');
    assert.equal(migrated.students[0].is_active, false); assert.equal(migrated.students[0].password_reset_required, true);
    assert.equal(migrated.admins[0].is_active, false); assert.equal(migrated.questions[0].bank_generation, 1);
    assert.equal(migrated.questions[0].is_active, false); assert.equal(migrated.exam_config[0].is_open, false);
    assert.equal(migrated.quiz_attempts[0].status, 'retired'); assert.equal(migrated.quiz_responses[0].question_snapshot?.correct_option, 'a');
    migrated.admins[0].is_active = true; writeLocalDb(migrated);
    assert.equal(readLocalDb().admins[0].is_active, true, 'cutover must not repeat on every read');
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
