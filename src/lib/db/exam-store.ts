import crypto from 'crypto';
import { getSupabase, isSupabaseConfigured } from './connection';
import { LocalDatabaseSchema, readLocalDb, writeLocalDb } from './local-store';
import { IntegrityEventType, OptionKey, Question, QuestionSnapshot, QuizAttempt, QuizResponse } from '../types';

export const SUBMISSION_GRACE_SECONDS = 30;
export const HEARTBEAT_TIMEOUT_SECONDS = 60;

type Answer = { response_id: string; selected_option: OptionKey | null };
type Violation = Extract<IntegrityEventType, 'tab_hidden' | 'fullscreen_exit' | 'quit'>;

export function questionSnapshot(q: Question): QuestionSnapshot {
  const { subject_tag, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option } = q;
  return { subject_tag, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option };
}

function result<T>(data: T | T[] | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  const value = Array.isArray(data) ? data[0] : data;
  if (!value) throw new Error('Database operation returned no result');
  return value as T;
}

function localAttempt(db: LocalDatabaseSchema, id: string, studentId?: string): QuizAttempt {
  const attempt = db.quiz_attempts.find((a) => a.id === id);
  if (!attempt || (studentId && attempt.student_id !== studentId)) throw new Error('Attempt not found');
  if (studentId && !db.students.some((s) => s.id === studentId && s.is_active)) throw new Error('Student account is unavailable');
  return attempt;
}

function logEvent(db: LocalDatabaseSchema, attemptId: string, type: IntegrityEventType, actor: string | null = null): void {
  db.integrity_events.push({ id: crypto.randomUUID(), attempt_id: attemptId, event_type: type, actor_admin_id: actor, created_at: new Date().toISOString() });
}

function blockLocal(db: LocalDatabaseSchema, attempt: QuizAttempt, reason: Exclude<IntegrityEventType, 'unlocked'>, at: number): void {
  attempt.status = 'blocked';
  attempt.blocked_reason = reason;
  attempt.blocked_at = new Date(at).toISOString();
  attempt.remaining_seconds_when_blocked = Math.max(0, Math.ceil((new Date(attempt.deadline_at).getTime() - at) / 1000));
  logEvent(db, attempt.id, reason);
}

function applyAnswers(db: LocalDatabaseSchema, attemptId: string, answers: Answer[]): void {
  if (!Array.isArray(answers) || answers.length > 100) throw new Error('Invalid answers');
  const updates = new Map(answers.map((a) => [a.response_id, ['a', 'b', 'c', 'd'].includes(a.selected_option || '') ? a.selected_option : null]));
  for (const r of db.quiz_responses) if (r.attempt_id === attemptId && updates.has(r.id)) r.selected_option = updates.get(r.id) ?? null;
}

function gradeLocal(db: LocalDatabaseSchema, attempt: QuizAttempt, answers?: Answer[]): QuizAttempt {
  if (attempt.status !== 'in_progress') return attempt;
  if (answers && Date.now() <= new Date(attempt.deadline_at).getTime() + SUBMISSION_GRACE_SECONDS * 1000) applyAnswers(db, attempt.id, answers);
  const responses = db.quiz_responses.filter((r) => r.attempt_id === attempt.id);
  if (responses.length !== attempt.total_questions || responses.some((r) => !r.question_snapshot)) throw new Error('Attempt snapshot is incomplete');
  let correct = 0;
  for (const r of responses) {
    r.is_correct = Boolean(r.selected_option && r.selected_option === r.question_snapshot!.correct_option);
    if (r.is_correct) correct++;
  }
  attempt.correct_count = correct;
  attempt.score_percentage = Number((100 * correct / Math.max(attempt.total_questions, 1)).toFixed(2));
  attempt.passed = correct >= attempt.passing_score_snapshot;
  attempt.submitted_at = new Date().toISOString();
  attempt.status = 'graded';
  return attempt;
}

/** Mutates the caller's in-memory transaction; caller writes once. */
function maintainLocal(db: LocalDatabaseSchema, attempt: QuizAttempt, touch = false): QuizAttempt {
  if (attempt.status !== 'in_progress') return attempt;
  const now = Date.now();
  const deadline = new Date(attempt.deadline_at).getTime();
  const last = new Date(attempt.last_heartbeat_at || attempt.started_at).getTime();
  if (last + HEARTBEAT_TIMEOUT_SECONDS * 1000 < Math.min(now, deadline)) {
    blockLocal(db, attempt, 'heartbeat_timeout', last + HEARTBEAT_TIMEOUT_SECONDS * 1000);
  } else if (now > deadline + SUBMISSION_GRACE_SECONDS * 1000) {
    gradeLocal(db, attempt);
  } else if (touch) {
    attempt.last_heartbeat_at = new Date(now).toISOString();
  }
  return attempt;
}

export async function startAttempt(studentId: string, selected: Question[]): Promise<{ attempt: QuizAttempt; responses: QuizResponse[] }> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().rpc('mtc_start_attempt', { p_student_id: studentId, p_question_ids: selected.map((q) => q.id) });
    const id = result<string>(data, error);
    const [a, r] = await Promise.all([
      getSupabase().from('quiz_attempts').select('*').eq('id', id).single(),
      getSupabase().from('quiz_responses').select('*').eq('attempt_id', id).order('question_order'),
    ]);
    if (r.error) throw new Error(r.error.message);
    return { attempt: result<QuizAttempt>(a.data, a.error), responses: (r.data || []) as QuizResponse[] };
  }
  const db = readLocalDb();
  const student = db.students.find((s) => s.id === studentId && s.is_active);
  if (!student) throw new Error('Student account is unavailable');
  const existing = db.quiz_attempts.find((a) => a.student_id === studentId && (a.status === 'in_progress' || a.status === 'blocked'));
  if (existing) return { attempt: existing, responses: db.quiz_responses.filter((r) => r.attempt_id === existing.id).sort((a, b) => a.question_order - b.question_order) };
  const cfg = db.exam_config.find((c) => c.class === student.class);
  if (!cfg?.is_open) throw new Error('Exam window is closed');
  if (db.quiz_attempts.filter((a) => a.student_id === studentId && (a.status === 'graded' || a.status === 'submitted')).length >= cfg.max_attempts + student.extra_attempts) throw new Error('No attempts remaining');
  const ids = new Set(selected.map((q) => q.id));
  const available = db.questions.filter((q) => ids.has(q.id) && q.class === student.class && q.is_active && q.bank_generation !== 1);
  if (cfg.passing_score > cfg.total_questions || ids.size !== cfg.total_questions || available.length !== cfg.total_questions) throw new Error('The private question bank does not meet exam requirements');
  const now = Date.now();
  const attempt: QuizAttempt = {
    id: crypto.randomUUID(), student_id: studentId, class: student.class, started_at: new Date(now).toISOString(),
    submitted_at: null, total_questions: cfg.total_questions, correct_count: null, score_percentage: null, passed: null,
    status: 'in_progress', deadline_at: new Date(now + cfg.time_limit_minutes * 60_000).toISOString(),
    passing_score_snapshot: cfg.passing_score, time_limit_minutes_snapshot: cfg.time_limit_minutes,
    last_heartbeat_at: new Date(now).toISOString(), tab_switch_warnings: 0, blocked_reason: null, blocked_at: null,
    remaining_seconds_when_blocked: null,
  };
  const byId = new Map(available.map((q) => [q.id, q]));
  const responses: QuizResponse[] = selected.map((q, i) => ({ id: crypto.randomUUID(), attempt_id: attempt.id, question_id: q.id,
    question_order: i + 1, selected_option: null, is_correct: null, question_snapshot: questionSnapshot(byId.get(q.id)!) }));
  db.quiz_attempts.push(attempt);
  db.quiz_responses.push(...responses);
  writeLocalDb(db);
  return { attempt, responses };
}

export async function maintainAttempt(attemptId: string, studentId?: string, touch = false): Promise<QuizAttempt> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().rpc('mtc_maintain_attempt', { p_attempt_id: attemptId, p_student_id: studentId || null, p_touch: touch });
    return result<QuizAttempt>(data, error);
  }
  const db = readLocalDb();
  const attempt = maintainLocal(db, localAttempt(db, attemptId, studentId), touch);
  writeLocalDb(db);
  return attempt;
}

export async function recordIntegrityEvent(attemptId: string, studentId: string, event: Violation): Promise<QuizAttempt> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().rpc('mtc_record_integrity', { p_attempt_id: attemptId, p_student_id: studentId, p_event: event });
    return result<QuizAttempt>(data, error);
  }
  const db = readLocalDb();
  const a = maintainLocal(db, localAttempt(db, attemptId, studentId));
  if (a.status === 'in_progress') {
    if (event === 'tab_hidden' && a.tab_switch_warnings === 0) {
      a.tab_switch_warnings++;
      logEvent(db, a.id, event);
    } else {
      if (event === 'tab_hidden') a.tab_switch_warnings++;
      blockLocal(db, a, event, Date.now());
    }
  }
  writeLocalDb(db);
  return a;
}

export async function saveResponses(attemptId: string, studentId: string, answers: Answer[]): Promise<QuizAttempt> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().rpc('mtc_save_responses', { p_attempt_id: attemptId, p_student_id: studentId, p_responses: answers });
    return result<QuizAttempt>(data, error);
  }
  const db = readLocalDb();
  const a = maintainLocal(db, localAttempt(db, attemptId, studentId), true);
  if (a.status === 'in_progress') applyAnswers(db, a.id, answers);
  writeLocalDb(db);
  return a;
}

export async function submitAttempt(attemptId: string, studentId: string, answers: Answer[]): Promise<QuizAttempt> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().rpc('mtc_submit_attempt', { p_attempt_id: attemptId, p_student_id: studentId, p_responses: answers });
    return result<QuizAttempt>(data, error);
  }
  const db = readLocalDb();
  const a = maintainLocal(db, localAttempt(db, attemptId, studentId), true);
  if (a.status === 'in_progress') gradeLocal(db, a, answers);
  writeLocalDb(db);
  return a;
}

export async function unlockAttempt(attemptId: string, adminId: string): Promise<QuizAttempt> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().rpc('mtc_unlock_attempt', { p_attempt_id: attemptId, p_admin_id: adminId });
    return result<QuizAttempt>(data, error);
  }
  const db = readLocalDb();
  if (!db.admins.some((a) => a.id === adminId && a.is_active)) throw new Error('Admin account is unavailable');
  const a = localAttempt(db, attemptId);
  if (a.status !== 'blocked') throw new Error('Attempt is not blocked');
  const now = Date.now();
  a.status = 'in_progress';
  a.deadline_at = new Date(now + Math.max(a.remaining_seconds_when_blocked || 0, 60) * 1000).toISOString();
  a.last_heartbeat_at = new Date(now).toISOString();
  a.tab_switch_warnings = 0; a.blocked_reason = null; a.blocked_at = null; a.remaining_seconds_when_blocked = null;
  logEvent(db, a.id, 'unlocked', adminId);
  writeLocalDb(db);
  return a;
}

export async function maintainAllAttempts(): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase().rpc('mtc_maintain_all');
    if (error) throw new Error(error.message);
    return;
  }
  const db = readLocalDb();
  for (const a of db.quiz_attempts) if (a.status === 'in_progress') maintainLocal(db, a);
  writeLocalDb(db);
}

export async function listBlockedAttempts() {
  await maintainAllAttempts();
  if (isSupabaseConfigured()) {
    const attempts = [];
    for (let offset = 0; ; ) {
      const { data, error, count } = await getSupabase().from('quiz_attempts').select('id,class,started_at,blocked_at,blocked_reason,tab_switch_warnings,remaining_seconds_when_blocked,students(full_name,roll_number,section)', { count: 'exact' }).eq('status', 'blocked').order('blocked_at', { ascending: false }).order('id').range(offset, offset + 999);
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      attempts.push(...data);
      offset += data.length;
      if (count !== null && offset >= count) break;
    }
    return attempts;
  }
  const db = readLocalDb();
  return db.quiz_attempts.filter((a) => a.status === 'blocked').map((a) => {
    const s = db.students.find((s) => s.id === a.student_id);
    return { id: a.id, class: a.class, started_at: a.started_at, blocked_at: a.blocked_at, blocked_reason: a.blocked_reason,
      tab_switch_warnings: a.tab_switch_warnings, remaining_seconds_when_blocked: a.remaining_seconds_when_blocked,
      students: s ? { full_name: s.full_name, roll_number: s.roll_number, section: s.section } : null };
  });
}
