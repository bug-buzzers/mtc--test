import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const schema = readFileSync('supabase/schema.sql', 'utf8');
async function freshDb() {
  const db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  return db;
}
type Row = Record<string, unknown>;
async function one(db: PGlite, sql: string, params: unknown[] = []) {
  const result = await db.query<Row>(sql, params);
  assert.ok(result.rows[0], `No row returned by ${sql}`);
  return result.rows[0];
}

test('schema RPCs serialize start, preserve snapshots, enforce integrity and grade atomically', async () => {
  const db = await freshDb();
  try {
    await db.exec(schema);
    const student = await one(db, "INSERT INTO students(roll_number,full_name,class,section,password_hash) VALUES ('A1','Test Student',6,'A','hash') RETURNING id");
    const second = await one(db, "INSERT INTO students(roll_number,full_name,class,section,password_hash) VALUES ('A2','Other Student',6,'A','hash') RETURNING id");
    const admin = await one(db, "INSERT INTO admins(username,full_name,password_hash,is_active) VALUES ('teacher','Teacher','hash',true) RETURNING id");
    await db.exec('UPDATE exam_config SET is_open=true,total_questions=3,passing_score=2,time_limit_minutes=5 WHERE class=6');
    const questions = await db.query<{ id: string }>(`INSERT INTO questions(class,subject_tag,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option)
      SELECT 6,'Topic','easy','Private question '||n,'Original A','B','C','D','a' FROM generate_series(1,3) n RETURNING id`);
    const ids = questions.rows.map((q) => q.id);
    await assert.rejects(() => db.query('SELECT mtc_start_attempt($1,$2::uuid[])', [second.id, ids.slice(0,2)]), /private question bank/);
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM quiz_attempts WHERE student_id=$1', [second.id])).n, 0);
    const starts = await Promise.all(Array.from({ length: 4 }, () => one(db, 'SELECT mtc_start_attempt($1,$2::uuid[]) AS id', [student.id, ids])));
    assert.equal(new Set(starts.map((r) => r.id)).size, 1, 'concurrent/retried starts must reuse one attempt');
    const id = starts[0].id;
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM quiz_responses WHERE attempt_id=$1', [id])).n, 3);
    await db.exec("UPDATE questions SET option_a='Changed', correct_option='d'; UPDATE exam_config SET passing_score=3 WHERE class=6");
    let response = await one(db, "SELECT * FROM mtc_record_integrity($1,$2,'tab_hidden')", [id, student.id]);
    assert.equal(response.status, 'in_progress'); assert.equal(response.tab_switch_warnings, 1);
    response = await one(db, "SELECT * FROM mtc_record_integrity($1,$2,'tab_hidden')", [id, student.id]);
    assert.equal(response.status, 'blocked'); assert.equal(response.blocked_reason, 'tab_hidden');
    const responseRows = await db.query<{ id: string }>('SELECT id FROM quiz_responses WHERE attempt_id=$1 ORDER BY question_order', [id]);
    const answers = responseRows.rows.map(({ id: response_id }, i) => ({ response_id, selected_option: i === 2 ? 'b' : 'a' }));
    response = await one(db, 'SELECT * FROM mtc_save_responses($1,$2,$3::jsonb)', [id, student.id, JSON.stringify(answers)]);
    assert.equal(response.status, 'blocked');
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM quiz_responses WHERE attempt_id=$1 AND selected_option IS NOT NULL', [id])).n, 0);
    response = await one(db, 'SELECT * FROM mtc_unlock_attempt($1,$2)', [id, admin.id]);
    assert.equal(response.status, 'in_progress');
    response = await one(db, 'SELECT * FROM mtc_submit_attempt($1,$2,$3::jsonb)', [id, student.id, JSON.stringify(answers)]);
    assert.equal(response.status, 'graded'); assert.equal(response.correct_count, 2); assert.equal(response.passed, true);
    assert.equal(response.passing_score_snapshot, 2);
    const saved = await one(db, "SELECT question_snapshot->>'option_a' AS a, question_snapshot->>'correct_option' AS key FROM quiz_responses WHERE attempt_id=$1 LIMIT 1", [id]);
    assert.equal(saved.a, 'Original A'); assert.equal(saved.key, 'a');
    const again = await one(db, "SELECT * FROM mtc_submit_attempt($1,$2,'[]'::jsonb)", [id, student.id]);
    assert.equal(again.correct_count, 2, 'duplicate submit must not change grading');
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM quiz_integrity_events WHERE attempt_id=$1', [id])).n, 3);
  } finally { await db.close(); }
});

test('missed heartbeat locks, deadline auto-grades, and a different student cannot operate on the attempt', async () => {
  const db = await freshDb();
  try {
    await db.exec(schema);
    const student = await one(db, "INSERT INTO students(roll_number,full_name,class,section,password_hash) VALUES ('B1','Student',6,'A','hash') RETURNING id");
    const stranger = await one(db, "INSERT INTO students(roll_number,full_name,class,section,password_hash) VALUES ('B2','Stranger',6,'A','hash') RETURNING id");
    await db.exec('UPDATE exam_config SET is_open=true,total_questions=1,passing_score=1,time_limit_minutes=5,max_attempts=2 WHERE class=6');
    const q = await one(db, "INSERT INTO questions(class,subject_tag,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option) VALUES (6,'T','easy','Q','A','B','C','D','a') RETURNING id");
    const a = await one(db, 'SELECT mtc_start_attempt($1,$2::uuid[]) AS id', [student.id, [q.id]]);
    await assert.rejects(() => db.query('SELECT * FROM mtc_maintain_attempt($1,$2,true)', [a.id, stranger.id]), /Attempt not found/);
    await db.query("UPDATE quiz_attempts SET last_heartbeat_at=clock_timestamp()-interval '61 seconds' WHERE id=$1", [a.id]);
    assert.equal((await one(db, 'SELECT * FROM mtc_maintain_attempt($1,$2,true)', [a.id, student.id])).status, 'blocked');
    // Separate attempt: its last heartbeat falls within 60s before deadline,
    // so expiration is graded, not mistaken for a connection interruption.
    const b = await one(db, 'SELECT mtc_start_attempt($1,$2::uuid[]) AS id', [stranger.id, [q.id]]);
    await db.query("UPDATE quiz_attempts SET deadline_at=clock_timestamp()-interval '31 seconds',last_heartbeat_at=clock_timestamp()-interval '32 seconds' WHERE id=$1", [b.id]);
    assert.equal((await one(db, 'SELECT * FROM mtc_maintain_attempt($1,$2)', [b.id, stranger.id])).status, 'graded');
    const graceStudent = await one(db, "INSERT INTO students(roll_number,full_name,class,section,password_hash) VALUES ('B3','Grace',6,'A','hash') RETURNING id");
    const grace = await one(db, 'SELECT mtc_start_attempt($1,$2::uuid[]) AS id', [graceStudent.id, [q.id]]);
    await db.query("UPDATE quiz_attempts SET deadline_at=clock_timestamp()-interval '20 seconds',last_heartbeat_at=clock_timestamp()-interval '21 seconds' WHERE id=$1", [grace.id]);
    const r = await one(db, 'SELECT id FROM quiz_responses WHERE attempt_id=$1', [grace.id]);
    const graded = await one(db, 'SELECT * FROM mtc_submit_attempt($1,$2,$3::jsonb)', [grace.id, graceStudent.id, JSON.stringify([{ response_id: r.id, selected_option: 'a' }])]);
    assert.equal(graded.status, 'graded'); assert.equal(graded.correct_count, 1, 'submission is accepted within the 30-second grace period');
    const exitStudent = await one(db, "INSERT INTO students(roll_number,full_name,class,section,password_hash) VALUES ('B4','Exit',6,'A','hash') RETURNING id");
    const exitAttempt = await one(db, 'SELECT mtc_start_attempt($1,$2::uuid[]) AS id', [exitStudent.id, [q.id]]);
    assert.equal((await one(db, "SELECT * FROM mtc_record_integrity($1,$2,'fullscreen_exit')", [exitAttempt.id, exitStudent.id])).status, 'blocked');
  } finally { await db.close(); }
});

test('registration without a code preserves uniqueness and database permissions', async () => {
  const db = await freshDb();
  try {
    await db.exec(schema);
    const student = await one(db, "SELECT * FROM mtc_register_student(' Student ',' C1 ',6,'A','hash')");
    assert.equal(student.full_name, 'Student'); assert.equal(student.roll_number, 'C1');
    assert.equal(student.is_active, true); assert.equal(student.password_reset_required, false);
    await assert.rejects(() => db.query("SELECT * FROM mtc_register_student('Again','c1',6,'A','hash')"), /already registered/);
    await assert.rejects(() => db.query("SELECT * FROM mtc_register_student('Student','X',11,'A','hash')"), /Invalid registration details/);
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM students')).n, 1);
    const privileges = await one(db, "SELECT has_table_privilege('anon','questions','SELECT') AS anon_read, has_function_privilege('authenticated','mtc_register_student(text,text,integer,text,text)','EXECUTE') AS auth_register, has_function_privilege('service_role','mtc_register_student(text,text,integer,text,text)','EXECUTE') AS service_register, has_function_privilege('authenticated','mtc_start_attempt(uuid,uuid[])','EXECUTE') AS auth_execute, has_function_privilege('service_role','mtc_start_attempt(uuid,uuid[])','EXECUTE') AS service_execute");
    assert.deepEqual(privileges, { anon_read: false, auth_register: false, service_register: true, auth_execute: false, service_execute: true });

    // Reapplying the migration removes the old overload without deleting its records.
    await db.exec("INSERT INTO student_invites(code_hash,roll_number,class,section,expires_at) VALUES ('old-hash','X',6,'A',clock_timestamp()+interval '1 day')");
    await db.exec("CREATE FUNCTION public.mtc_register_student(text,text,text,integer,text,text) RETURNS public.students LANGUAGE sql AS 'SELECT NULL::public.students'");
    await db.exec(schema);
    assert.equal((await one(db, "SELECT to_regprocedure('public.mtc_register_student(text,text,text,integer,text,text)') IS NULL AS removed")).removed, true);
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM student_invites')).n, 1);
  } finally { await db.close(); }
});

test('security migration preserves historical rows, disables exposed accounts/bank only once, and is repeatable', async () => {
  const db = await freshDb();
  try {
    // A minimal pre-cutover schema, with real historical rows, tests the ALTER path.
    await db.exec(`
      CREATE TABLE students (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),roll_number text NOT NULL,full_name text NOT NULL,class int NOT NULL,section text NOT NULL,password_hash text NOT NULL,is_active boolean NOT NULL DEFAULT true,extra_attempts int NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(roll_number,class,section));
      CREATE TABLE admins (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text UNIQUE NOT NULL,password_hash text NOT NULL,full_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE questions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),class int NOT NULL,subject_tag text NOT NULL,difficulty text NOT NULL,question_text text NOT NULL,option_a text NOT NULL,option_b text NOT NULL,option_c text NOT NULL,option_d text NOT NULL,correct_option text NOT NULL,is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE exam_config (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),class int UNIQUE NOT NULL,is_open boolean NOT NULL DEFAULT true,total_questions int NOT NULL DEFAULT 25,time_limit_minutes int NOT NULL DEFAULT 30,passing_score int NOT NULL DEFAULT 18,max_attempts int NOT NULL DEFAULT 1,show_results_to_students boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE quiz_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES students(id),class int NOT NULL,started_at timestamptz NOT NULL DEFAULT now(),submitted_at timestamptz,total_questions int NOT NULL,correct_count int,score_percentage numeric,passed boolean,status text NOT NULL CHECK(status IN ('in_progress','submitted','graded')));
      CREATE TABLE quiz_responses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),attempt_id uuid NOT NULL REFERENCES quiz_attempts(id),question_id uuid NOT NULL REFERENCES questions(id),question_order int NOT NULL,selected_option text,is_correct boolean,UNIQUE(attempt_id,question_id));
      INSERT INTO students(roll_number,full_name,class,section,password_hash) VALUES ('OLD','Historical Student',6,'A','old-hash');
      INSERT INTO admins(username,password_hash,full_name) VALUES ('old-admin','old-hash','Teacher');
      INSERT INTO questions(class,subject_tag,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option) VALUES(6,'Old','easy','Old private question','A','B','C','D','a');
      INSERT INTO exam_config(class) VALUES (6);
      INSERT INTO quiz_attempts(student_id,class,total_questions,status,correct_count,passed) SELECT id,6,1,'graded',1,true FROM students;
      INSERT INTO quiz_responses(attempt_id,question_id,question_order,selected_option,is_correct) SELECT a.id,q.id,1,'a',true FROM quiz_attempts a CROSS JOIN questions q;
      INSERT INTO quiz_attempts(student_id,class,total_questions,status) SELECT id,6,1,'in_progress' FROM students;
    `);
    await db.exec(schema);
    const state = await one(db, 'SELECT (SELECT count(*)::int FROM students) AS students,(SELECT is_active FROM students LIMIT 1) AS student_active,(SELECT password_reset_required FROM students LIMIT 1) AS reset_required,(SELECT is_active FROM admins LIMIT 1) AS admin_active,(SELECT is_active FROM questions LIMIT 1) AS q_active,(SELECT bank_generation FROM questions LIMIT 1) AS generation,(SELECT is_open FROM exam_config WHERE class=6) AS open,(SELECT correct_count FROM quiz_attempts LIMIT 1) AS score,(SELECT question_snapshot->>\'question_text\' FROM quiz_responses LIMIT 1) AS question');
    assert.deepEqual(state, { students: 1, student_active: false, reset_required: true, admin_active: false, q_active: false, generation: 1, open: false, score: 1, question: 'Old private question' });
    assert.equal((await one(db, "SELECT count(*)::int AS n FROM quiz_attempts WHERE status='retired'")).n, 1, 'unfinished legacy papers must not be resumed');
    await db.exec("UPDATE admins SET is_active=true; UPDATE exam_config SET is_open=true WHERE class=6; INSERT INTO questions(class,subject_tag,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option) VALUES(6,'New','easy','New private question','A','B','C','D','b')");
    await db.exec(schema);
    const after = await one(db, "SELECT (SELECT is_active FROM admins LIMIT 1) AS admin_active,(SELECT is_open FROM exam_config WHERE class=6) AS open,(SELECT is_active FROM questions WHERE question_text='New private question') AS new_active,(SELECT bank_generation FROM questions WHERE question_text='New private question') AS generation");
    assert.deepEqual(after, { admin_active: true, open: true, new_active: true, generation: 2 });
  } finally { await db.close(); }
});
