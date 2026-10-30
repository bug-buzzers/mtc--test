import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CLASSES } from '../constants';
import { Admin, AuthSession, ExamConfig, IntegrityEvent, Question, QuizAttempt, QuizResponse, Student, StudentInvite } from '../types';

/** Local storage is an explicit development/test aid, never the production database. */
export interface LocalDatabaseSchema {
  schema_source: string;
  students: Student[];
  admins: Admin[];
  questions: Array<Question & { code?: string; bank_generation?: number }>;
  exam_config: ExamConfig[];
  quiz_attempts: QuizAttempt[];
  quiz_responses: QuizResponse[];
  auth_sessions: AuthSession[];
  student_invites: StudentInvite[];
  integrity_events: IntegrityEvent[];
  login_limits: Array<{ key: string; count: number; window_started_at: string }>;
}

const CURRENT_SCHEMA_SOURCE = 'secure-private-bank-v1';
const DB_FILE = process.env.MTC_LOCAL_DB_PATH || path.join(process.cwd(), 'data', 'mtc-local-db.json');

function emptyDatabase(): LocalDatabaseSchema {
  const now = new Date().toISOString();
  return {
    schema_source: CURRENT_SCHEMA_SOURCE,
    students: [], admins: [], questions: [], quiz_attempts: [], quiz_responses: [],
    auth_sessions: [], student_invites: [], integrity_events: [], login_limits: [],
    exam_config: CLASSES.map((cls) => ({
      id: crypto.randomUUID(), class: cls, is_open: false, total_questions: 25,
      time_limit_minutes: 30, passing_score: 18, max_attempts: 1,
      show_results_to_students: false, updated_at: now,
    })),
  };
}

function snapshot(q: Question) {
  const { subject_tag, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option } = q;
  return { subject_tag, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option };
}

/** Upgrade legacy local data in place, preserving records and a backup. Exposed
 * questions and existing accounts are disabled until a coordinator reviews them. */
function upgradeLegacyDb(raw: LocalDatabaseSchema): LocalDatabaseSchema {
  const db = { ...emptyDatabase(), ...raw };
  db.admins = (raw.admins || []).map((a) => ({ ...a, is_active: false }));
  db.students = (raw.students || []).map((s) => ({ ...s, is_active: false, password_reset_required: true }));
  db.questions = (raw.questions || []).map((q) => ({ ...q, is_active: false, bank_generation: 1 }));
  db.exam_config = (raw.exam_config || []).map((c) => ({ ...c, is_open: false, show_results_to_students: false }));
  const questions = new Map(db.questions.map((q) => [q.id, q]));
  db.quiz_responses = (raw.quiz_responses || []).map((r) => ({
    ...r, question_snapshot: r.question_snapshot || (questions.get(r.question_id) ? snapshot(questions.get(r.question_id)!) : null),
  }));
  db.quiz_attempts = (raw.quiz_attempts || []).map((a) => {
    const cfg = db.exam_config.find((c) => c.class === a.class);
    const minutes = a.time_limit_minutes_snapshot || cfg?.time_limit_minutes || 30;
    return {
      ...a,
      status: a.status === 'in_progress' || a.status === 'blocked' ? 'retired' : a.status,
      deadline_at: a.deadline_at || new Date(new Date(a.started_at).getTime() + minutes * 60_000).toISOString(),
      passing_score_snapshot: a.passing_score_snapshot || cfg?.passing_score || 18,
      time_limit_minutes_snapshot: minutes,
      last_heartbeat_at: a.last_heartbeat_at || a.started_at,
      tab_switch_warnings: a.tab_switch_warnings || 0,
      blocked_reason: a.blocked_reason || null,
      blocked_at: a.blocked_at || null,
      remaining_seconds_when_blocked: a.remaining_seconds_when_blocked ?? null,
    };
  });
  db.auth_sessions = [];
  db.student_invites = raw.student_invites || [];
  db.integrity_events = raw.integrity_events || [];
  db.login_limits = [];
  db.schema_source = CURRENT_SCHEMA_SOURCE;
  return db;
}

export function readLocalDb(): LocalDatabaseSchema {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Local JSON storage is disabled in production. Configure Supabase.');
  }
  if (!fs.existsSync(/*turbopackIgnore: true*/ DB_FILE)) {
    const db = emptyDatabase();
    writeLocalDb(db);
    return db;
  }
  const parsed = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ DB_FILE, 'utf8')) as LocalDatabaseSchema;
  if (parsed.schema_source !== CURRENT_SCHEMA_SOURCE) {
    const backup = `${DB_FILE}.pre-security-backup`;
    if (!fs.existsSync(backup)) fs.copyFileSync(DB_FILE, backup);
    const migrated = upgradeLegacyDb(parsed);
    writeLocalDb(migrated);
    return migrated;
  }
  return parsed;
}

export function writeLocalDb(db: LocalDatabaseSchema): void {
  if (process.env.NODE_ENV === 'production') throw new Error('Local storage is disabled in production.');
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}
