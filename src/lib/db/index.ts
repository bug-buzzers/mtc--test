import crypto from 'crypto';
import { CLASSES } from '../constants';
import {
  Admin,
  Difficulty,
  ExamConfig,
  Question,
  QuestionSnapshot,
  QuizAttempt,
  QuizResponse,
  Student,
} from '../types';
import { readLocalDb, writeLocalDb } from './local-store';

import { getAllRows, getSupabase, isSupabaseConfigured } from './connection';
import { maintainAttempt, maintainAllAttempts } from './exam-store';
import { registerStudent, StudentAlreadyRegisteredError } from './security-store';
export { isSupabaseConfigured } from './connection';

// =============================================================================
// STUDENTS & ADMINS
// =============================================================================

export async function findStudentByCredentials(
  roll_number: string,
  cls: number,
  section: string
): Promise<Student | null> {
  const cleanRoll = roll_number.trim();
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from('students')
      .select('*')
      .eq('roll_number', cleanRoll)
      .eq('class', cls)
      .eq('section', section)
      .maybeSingle();
    if (error || !data) return null;
    return data as Student;
  }

  const db = readLocalDb();
  return (
    db.students.find(
      (s) =>
        s.roll_number.toLowerCase() === cleanRoll.toLowerCase() &&
        s.class === cls &&
        s.section === section
    ) || null
  );
}

export async function getStudentById(id: string): Promise<Student | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data as Student;
  }
  const db = readLocalDb();
  return db.students.find((s) => s.id === id) || null;
}

export async function createStudent(input: {
  roll_number: string;
  full_name: string;
  class: number;
  section: string;
  password_hash: string;
}): Promise<{ student?: Student; error?: string }> {
  try {
    return { student: await registerStudent(input) };
  } catch (error) {
    if (error instanceof StudentAlreadyRegisteredError) return { error: 'This student is already registered for this Class & Section. Please log in.' };
    throw error;
  }
}

export async function listStudents(filters?: {
  class?: number;
  section?: string;
  search?: string;
}): Promise<Array<Omit<Student, 'password_hash'> & { attempts_count: number }>> {
  let students: Student[] = [];
  let attempts: QuizAttempt[] = [];

  if (isSupabaseConfigured()) {
    [students, attempts] = await Promise.all([getAllRows<Student>('students'), getAllRows<QuizAttempt>('quiz_attempts')]);
    if (filters?.class) students = students.filter((s) => s.class === filters.class);
    if (filters?.section) students = students.filter((s) => s.section === filters.section);
    students.sort((a, b) => a.class - b.class || a.section.localeCompare(b.section) || a.roll_number.localeCompare(b.roll_number));
  } else {
    const db = readLocalDb();
    students = [...db.students];
    if (filters?.class) {
      students = students.filter((s) => s.class === filters.class);
    }
    if (filters?.section) {
      students = students.filter((s) => s.section === filters.section);
    }
    students.sort(
      (a, b) =>
        a.class - b.class ||
        a.section.localeCompare(b.section) ||
        a.roll_number.localeCompare(b.roll_number, undefined, { numeric: true })
    );
    attempts = db.quiz_attempts;
  }

  if (filters?.search) {
    const term = filters.search.trim().toLowerCase();
    students = students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(term) ||
        s.roll_number.toLowerCase().includes(term)
    );
  }

  const countMap = new Map<string, number>();
  for (const att of attempts) {
    if (att.status !== 'submitted' && att.status !== 'graded') continue;
    countMap.set(att.student_id, (countMap.get(att.student_id) || 0) + 1);
  }

  return students.map(({ password_hash: _pw, ...rest }) => ({
    ...rest,
    attempts_count: countMap.get(rest.id) || 0,
  }));
}

export async function updateStudent(
  id: string,
  updates: {
    full_name?: string;
    is_active?: boolean;
    password_reset_required?: boolean;
    password_hash?: string;
    extra_attempts?: number;
  }
): Promise<Student | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from('students')
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error || !data) return null;
    return data as Student;
  }

  const db = readLocalDb();
  const idx = db.students.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  db.students[idx] = {
    ...db.students[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  writeLocalDb(db);
  return db.students[idx];
}

export async function findAdminByUsername(username: string): Promise<Admin | null> {
  const cleanUser = username.trim().toLowerCase();
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from('admins')
      .select('*')
      .ilike('username', cleanUser)
      .maybeSingle();
    if (error || !data) return null;
    return data as Admin;
  }

  const db = readLocalDb();
  return (
    db.admins.find((a) => a.username.toLowerCase() === cleanUser) || null
  );
}

// =============================================================================
// EXAM CONFIGURATION
// =============================================================================

export async function listExamConfigs(): Promise<ExamConfig[]> {
  if (isSupabaseConfigured()) {
    const { data } = await getSupabase()
      .from('exam_config')
      .select('*')
      .order('class', { ascending: true });
    return (data || []) as ExamConfig[];
  }
  const db = readLocalDb();
  return [...db.exam_config].sort((a, b) => a.class - b.class);
}

export async function getExamConfigByClass(cls: number): Promise<ExamConfig> {
  if (isSupabaseConfigured()) {
    const { data } = await getSupabase()
      .from('exam_config')
      .select('*')
      .eq('class', cls)
      .maybeSingle();
    if (data) return data as ExamConfig;
  } else {
    const db = readLocalDb();
    const found = db.exam_config.find((c) => c.class === cls);
    if (found) return found;
  }

  return {
    id: crypto.randomUUID(),
    class: cls,
    is_open: false,
    total_questions: 25,
    time_limit_minutes: 30,
    passing_score: 18,
    max_attempts: 1,
    show_results_to_students: false,
    updated_at: new Date().toISOString(),
  };
}

export async function updateExamConfig(
  cls: number,
  updates: Partial<
    Pick<
      ExamConfig,
      | 'is_open'
      | 'total_questions'
      | 'time_limit_minutes'
      | 'passing_score'
      | 'max_attempts'
      | 'show_results_to_students'
    >
  >
): Promise<ExamConfig | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from('exam_config')
      .update(updates)
      .eq('class', cls)
      .select('*')
      .maybeSingle();
    if (error || !data) return null;
    return data as ExamConfig;
  }

  const db = readLocalDb();
  const idx = db.exam_config.findIndex((c) => c.class === cls);
  if (idx === -1) return null;
  db.exam_config[idx] = {
    ...db.exam_config[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  writeLocalDb(db);
  return db.exam_config[idx];
}

// =============================================================================
// QUESTIONS
// =============================================================================

export async function listQuestions(filters?: {
  class?: number;
  difficulty?: Difficulty;
  subject_tag?: string;
  search?: string;
  include_inactive?: boolean;
}): Promise<Question[]> {
  let list: Question[] = [];

  if (isSupabaseConfigured()) {
    // PostgREST defaults to a maximum of 1,000 rows per response. Walk the
    // complete private pool so random papers are not biased to its first page.
    for (let offset = 0; ; ) {
      let q = getSupabase().from('questions').select('*', { count: 'exact' }).order('class').order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
      if (!filters?.include_inactive) q = q.eq('is_active', true).gte('bank_generation', 2);
      if (filters?.class) q = q.eq('class', filters.class);
      if (filters?.difficulty) q = q.eq('difficulty', filters.difficulty);
      if (filters?.subject_tag) q = q.eq('subject_tag', filters.subject_tag);
      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      list.push(...data as Question[]);
      offset += data.length;
      if (count !== null && offset >= count) break;
    }
  } else {
    const db = readLocalDb();
    list = db.questions.filter((q) =>
      filters?.include_inactive ? true : q.is_active && q.bank_generation !== 1
    );
    if (filters?.class) list = list.filter((q) => q.class === filters.class);
    if (filters?.difficulty) {
      list = list.filter((q) => q.difficulty === filters.difficulty);
    }
    if (filters?.subject_tag) {
      list = list.filter((q) => q.subject_tag === filters.subject_tag);
    }
  }

  if (filters?.search) {
    const term = filters.search.trim().toLowerCase();
    list = list.filter(
      (q) =>
        q.question_text.toLowerCase().includes(term) ||
        q.subject_tag.toLowerCase().includes(term)
    );
  }

  return list;
}

export async function countQuestions(cls: number): Promise<number> {
  if (isSupabaseConfigured()) {
    const { count, error } = await getSupabase().from('questions').select('id', { count: 'exact', head: true }).eq('is_active', true).gte('bank_generation', 2).eq('class', cls);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }
  return (await listQuestions({ class: cls })).length;
}

export async function getQuestionById(id: string): Promise<Question | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from('questions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data as Question;
  }
  const db = readLocalDb();
  return db.questions.find((q) => q.id === id) || null;
}

export async function createQuestion(
  input: Omit<Question, 'id' | 'is_active' | 'created_at' | 'updated_at'>
): Promise<Question> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from('questions')
      .insert({ ...input, is_active: true })
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(error?.message || 'Failed to add question');
    }
    return data as Question;
  }

  const db = readLocalDb();
  const now = new Date().toISOString();
  const created: Question & { bank_generation: number } = {
    bank_generation: 2,
    id: crypto.randomUUID(),
    ...input,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  db.questions.unshift(created);
  writeLocalDb(db);
  return created;
}

export async function bulkCreateQuestions(
  inputs: Array<Omit<Question, 'id' | 'is_active' | 'created_at' | 'updated_at'>>
): Promise<number> {
  if (inputs.length === 0) return 0;
  if (isSupabaseConfigured()) {
    const payload = inputs.map((item) => ({ ...item, is_active: true }));
    const { data, error } = await getSupabase()
      .from('questions')
      .insert(payload)
      .select('id');
    if (error) throw new Error(error.message);
    return data?.length || 0;
  }

  const db = readLocalDb();
  const now = new Date().toISOString();
  const created: Array<Question & { bank_generation: number }> = inputs.map((item) => ({
    bank_generation: 2,
    id: crypto.randomUUID(),
    ...item,
    is_active: true,
    created_at: now,
    updated_at: now,
  }));
  db.questions.unshift(...created);
  writeLocalDb(db);
  return created.length;
}

export async function updateQuestion(
  id: string,
  updates: Partial<
    Omit<Question, 'id' | 'created_at' | 'updated_at'>
  >
): Promise<Question | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from('questions')
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error || !data) return null;
    return data as Question;
  }

  const db = readLocalDb();
  const idx = db.questions.findIndex((q) => q.id === id);
  if (idx === -1) return null;
  db.questions[idx] = {
    ...db.questions[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  writeLocalDb(db);
  return db.questions[idx];
}

export async function softDeleteQuestion(id: string): Promise<boolean> {
  const res = await updateQuestion(id, { is_active: false });
  return Boolean(res);
}

// =============================================================================
// QUIZ ATTEMPTS, DRAFT SAVING & SERVER-SIDE GRADING
// =============================================================================

export async function getStudentAttempts(studentId: string): Promise<QuizAttempt[]> {
  let attempts: QuizAttempt[];
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().from('quiz_attempts').select('*').eq('student_id', studentId).order('started_at', { ascending: false });
    if (error) throw new Error(error.message);
    attempts = (data || []) as QuizAttempt[];
  } else {
    attempts = readLocalDb().quiz_attempts.filter((a) => a.student_id === studentId).sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  }
  return Promise.all(attempts.map((a) => a.status === 'in_progress' ? maintainAttempt(a.id, studentId) : a));
}

export async function getAttemptById(attemptId: string): Promise<QuizAttempt | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().from('quiz_attempts').select('*').eq('id', attemptId).maybeSingle();
    if (error) throw new Error(error.message);
    return data as QuizAttempt | null;
  }
  return readLocalDb().quiz_attempts.find((a) => a.id === attemptId) || null;
}

export async function getResponsesByAttemptId(attemptId: string): Promise<QuizResponse[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().from('quiz_responses').select('*').eq('attempt_id', attemptId).order('question_order', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []) as QuizResponse[];
  }
  return readLocalDb().quiz_responses.filter((r) => r.attempt_id === attemptId).sort((a, b) => a.question_order - b.question_order);
}

export async function getStudentAnsweredQuestionIds(studentId: string): Promise<Set<string>> {
  if (isSupabaseConfigured()) {
    const { data: attempts, error: aError } = await getSupabase().from('quiz_attempts').select('id').eq('student_id', studentId);
    if (aError) throw new Error(aError.message);
    const ids = (attempts || []).map((a: { id: string }) => a.id);
    if (!ids.length) return new Set();
    const { data, error } = await getSupabase().from('quiz_responses').select('question_id').in('attempt_id', ids);
    if (error) throw new Error(error.message);
    return new Set((data || []).map((r: { question_id: string }) => r.question_id));
  }
  const db = readLocalDb();
  const ids = new Set(db.quiz_attempts.filter((a) => a.student_id === studentId).map((a) => a.id));
  return new Set(db.quiz_responses.filter((r) => ids.has(r.attempt_id)).map((r) => r.question_id));
}

// =============================================================================
// ADMIN RESULTS, ATTEMPT DETAILS & ANALYTICS
// =============================================================================

export interface ResultRow {
  attempt_id: string;
  student_id: string;
  roll_number: string;
  full_name: string;
  class: number;
  section: string;
  started_at: string;
  submitted_at: string | null;
  total_questions: number;
  correct_count: number;
  score_percentage: number;
  passed: boolean;
  status: string;
  duration_minutes: number | null;
}

export async function listResultsWithDetails(filters?: {
  class?: number;
  section?: string;
  status?: 'all' | 'passed' | 'failed';
  search?: string;
}): Promise<ResultRow[]> {
  await maintainAllAttempts();
  let attempts: QuizAttempt[] = [];
  let students: Student[] = [];

  if (isSupabaseConfigured()) {
    [attempts, students] = await Promise.all([getAllRows<QuizAttempt>('quiz_attempts'), getAllRows<Student>('students')]);
    attempts = attempts.filter((a) => a.status === 'submitted' || a.status === 'graded').sort((a, b) => new Date(b.submitted_at || b.started_at).getTime() - new Date(a.submitted_at || a.started_at).getTime());
  } else {
    const db = readLocalDb();
    attempts = db.quiz_attempts
      .filter((a) => a.status === 'submitted' || a.status === 'graded')
      .sort(
        (a, b) =>
          new Date(b.submitted_at || b.started_at).getTime() -
          new Date(a.submitted_at || a.started_at).getTime()
      );
    students = db.students;
  }

  const stuMap = new Map(students.map((s) => [s.id, s]));

  let rows: ResultRow[] = attempts
    .map((a): ResultRow | null => {
      const stu = stuMap.get(a.student_id);
      if (!stu) return null;
      const dur =
        a.submitted_at && a.started_at
          ? Math.max(
              1,
              Math.round(
                (new Date(a.submitted_at).getTime() -
                  new Date(a.started_at).getTime()) /
                  60000
              )
            )
          : null;
      return {
        attempt_id: a.id,
        student_id: stu.id,
        roll_number: stu.roll_number,
        full_name: stu.full_name,
        class: a.class,
        section: stu.section,
        started_at: a.started_at,
        submitted_at: a.submitted_at,
        total_questions: a.total_questions,
        correct_count: a.correct_count ?? 0,
        score_percentage: Number(a.score_percentage ?? 0),
        passed: Boolean(a.passed),
        status: a.status,
        duration_minutes: dur,
      };
    })
    .filter((x): x is ResultRow => x !== null);

  if (filters?.class) {
    rows = rows.filter((r) => r.class === filters.class);
  }
  if (filters?.section) {
    rows = rows.filter((r) => r.section === filters.section);
  }
  if (filters?.status === 'passed') {
    rows = rows.filter((r) => r.passed);
  } else if (filters?.status === 'failed') {
    rows = rows.filter((r) => !r.passed);
  }
  if (filters?.search) {
    const term = filters.search.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(term) ||
        r.roll_number.toLowerCase().includes(term)
    );
  }

  return rows;
}

export async function getDetailedAttemptReview(attemptId: string) {
  const attempt = await getAttemptById(attemptId);
  if (!attempt) return null;
  const student = await getStudentById(attempt.student_id);
  if (!student) return null;
  const responses = await getResponsesByAttemptId(attemptId);

  let questions: Question[] = [];
  if (isSupabaseConfigured()) {
    const qIds = responses.map((r) => r.question_id);
    if (qIds.length > 0) {
      const { data } = await getSupabase()
        .from('questions')
        .select('*')
        .in('id', qIds);
      questions = (data || []) as Question[];
    }
  } else {
    const db = readLocalDb();
    questions = db.questions;
  }

  const qMap = new Map(questions.map((q) => [q.id, q]));

  const items = responses.map((r, index) => {
    const q = r.question_snapshot || qMap.get(r.question_id);
    return {
      question_number: r.question_order || index + 1,
      question_id: r.question_id,
      subject_tag: q?.subject_tag || 'General',
      difficulty: q?.difficulty || 'medium',
      question_text: q?.question_text || 'Question text unavailable',
      option_a: q?.option_a || '',
      option_b: q?.option_b || '',
      option_c: q?.option_c || '',
      option_d: q?.option_d || '',
      correct_option: q?.correct_option || 'a',
      selected_option: r.selected_option,
      is_correct: Boolean(r.is_correct),
    };
  });

  return {
    attempt,
    student: {
      id: student.id,
      roll_number: student.roll_number,
      full_name: student.full_name,
      class: student.class,
      section: student.section,
    },
    items,
  };
}

export async function getAnalyticsSummary() {
  await maintainAllAttempts();
  let students: Student[] = [];
  let questions: Question[] = [];
  let attempts: QuizAttempt[] = [];
  let responses: QuizResponse[] = [];
  let configs: ExamConfig[] = [];

  if (isSupabaseConfigured()) {
    [students, questions, attempts, responses, configs] = await Promise.all([
      getAllRows<Student>('students'), getAllRows<Question>('questions'), getAllRows<QuizAttempt>('quiz_attempts'),
      getAllRows<QuizResponse>('quiz_responses'), getAllRows<ExamConfig>('exam_config'),
    ]);
  } else {
    const db = readLocalDb();
    students = db.students;
    questions = db.questions;
    attempts = db.quiz_attempts;
    responses = db.quiz_responses;
    configs = db.exam_config;
  }

  const activeQuestions = questions.filter((q) => q.is_active);
  const completedAttempts = attempts.filter((a) => a.status === 'submitted' || a.status === 'graded');
  const inProgressAttempts = attempts.filter((a) => a.status === 'in_progress' || a.status === 'blocked');

  const todayStr = new Date().toISOString().slice(0, 10);
  const submittedToday = completedAttempts.filter((a) =>
    (a.submitted_at || '').startsWith(todayStr)
  ).length;

  const passedCount = completedAttempts.filter((a) => a.passed).length;
  const overallPassRate =
    completedAttempts.length > 0
      ? Math.round((passedCount / completedAttempts.length) * 100)
      : 0;

  const durations = completedAttempts
    .filter((a) => a.submitted_at && a.started_at)
    .map((a) =>
      Math.max(
        1,
        Math.round(
          (new Date(a.submitted_at!).getTime() -
            new Date(a.started_at).getTime()) /
            60000
        )
      )
    );
  const avgDurationMinutes =
    durations.length > 0
      ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length)
      : 0;

  const completionRate =
    completedAttempts.length + inProgressAttempts.length > 0
      ? Math.round((completedAttempts.length / (completedAttempts.length + inProgressAttempts.length)) * 100)
      : 100;

  const classBreakdown = CLASSES.map((cls) => {
    const clsAttempts = completedAttempts.filter((a) => a.class === cls);
    const clsPassed = clsAttempts.filter((a) => a.passed).length;
    const avgScorePct =
      clsAttempts.length > 0
        ? Math.round(
            clsAttempts.reduce((acc, a) => acc + Number(a.score_percentage || 0), 0) /
              clsAttempts.length
          )
        : 0;
    const avgCorrect =
      clsAttempts.length > 0
        ? Number(
            (
              clsAttempts.reduce((acc, a) => acc + (a.correct_count || 0), 0) /
              clsAttempts.length
            ).toFixed(1)
          )
        : 0;
    const clsQuestions = activeQuestions.filter((q) => q.class === cls);
    const cfg = configs.find((c) => c.class === cls);

    return {
      class: cls,
      is_open: cfg?.is_open ?? false,
      students_count: students.filter((s) => s.class === cls).length,
      questions_count: clsQuestions.length,
      easy_count: clsQuestions.filter((q) => q.difficulty === 'easy').length,
      medium_count: clsQuestions.filter((q) => q.difficulty === 'medium').length,
      hard_count: clsQuestions.filter((q) => q.difficulty === 'hard').length,
      attempts_count: clsAttempts.length,
      passed_count: clsPassed,
      pass_rate:
        clsAttempts.length > 0
          ? Math.round((clsPassed / clsAttempts.length) * 100)
          : 0,
      avg_score_percentage: avgScorePct,
      avg_correct: avgCorrect,
    };
  });

  // Group by the actual question version presented to students. Edits after
  // an attempt must not rewrite the wording or key shown by analytics.
  const completedById = new Map(completedAttempts.map((a) => [a.id, a]));
  const qMap = new Map(questions.map((q) => [q.id, q]));
  const qStats = new Map<string, { id: string; cls: number; snapshot: QuestionSnapshot; total: number; correct: number; wrongCounts: Record<string, number> }>();
  for (const r of responses) {
    const attempt = completedById.get(r.attempt_id);
    const source = r.question_snapshot || qMap.get(r.question_id);
    if (!attempt || !source) continue;
    const snapshot: QuestionSnapshot = { subject_tag: source.subject_tag, difficulty: source.difficulty, question_text: source.question_text,
      option_a: source.option_a, option_b: source.option_b, option_c: source.option_c, option_d: source.option_d, correct_option: source.correct_option };
    const version = JSON.stringify([r.question_id, snapshot]);
    if (!qStats.has(version)) qStats.set(version, { id: r.question_id, cls: attempt.class, snapshot, total: 0, correct: 0, wrongCounts: {} });
    const st = qStats.get(version)!;
    st.total++;
    if (r.is_correct) st.correct++;
    else if (r.selected_option) st.wrongCounts[r.selected_option] = (st.wrongCounts[r.selected_option] || 0) + 1;
  }
  const questionAccuracy = Array.from(qStats.values()).map((st) => {
    const commonWrong = Object.entries(st.wrongCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const q = st.snapshot;
    return { question_id: st.id, class: st.cls, subject_tag: q.subject_tag, difficulty: q.difficulty, question_text: q.question_text,
      correct_option: q.correct_option, attempts: st.total, correct: st.correct, accuracy_pct: Math.round(st.correct / st.total * 100),
      most_common_wrong_option: commonWrong, most_common_wrong_text: commonWrong ? q[`option_${commonWrong}` as keyof QuestionSnapshot] : null };
  }).sort((a, b) => a.accuracy_pct - b.accuracy_pct || b.attempts - a.attempts);

  return {
    database_mode: isSupabaseConfigured() ? 'supabase' : 'local_json',
    totals: {
      total_students: students.length,
      active_students: students.filter((s) => s.is_active).length,
      total_questions: activeQuestions.length,
      completed_attempts: completedAttempts.length,
      in_progress_attempts: inProgressAttempts.length,
      submitted_today: submittedToday,
      passed_students: passedCount,
      overall_pass_rate: overallPassRate,
      completion_rate: completionRate,
      avg_duration_minutes: avgDurationMinutes,
      open_classes_count: configs.filter((c) => c.is_open).length,
    },
    class_breakdown: classBreakdown,
    hardest_questions: questionAccuracy.slice(0, 15),
  };
}
