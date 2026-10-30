import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CLASSES } from '../constants';
import {
  Admin,
  Difficulty,
  ExamConfig,
  OptionKey,
  Question,
  QuizAttempt,
  QuizResponse,
  Student,
} from '../types';
import { readLocalDb, writeLocalDb } from './local-store';

let cachedSupabase: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    url &&
      key &&
      url.startsWith('http') &&
      !url.includes('your-project-id') &&
      key !== 'your-supabase-service-role-key'
  );
}

function getSupabase(): SupabaseClient {
  if (!cachedSupabase) {
    cachedSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }
  return cachedSupabase;
}

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
  const cleanRoll = input.roll_number.trim();
  const cleanName = input.full_name.trim();

  const existing = await findStudentByCredentials(
    cleanRoll,
    input.class,
    input.section
  );
  if (existing) {
    return {
      error: 'This student is already registered for this Class & Section. Please log in.',
    };
  }

  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from('students')
      .insert({
        roll_number: cleanRoll,
        full_name: cleanName,
        class: input.class,
        section: input.section,
        password_hash: input.password_hash,
        is_active: true,
        extra_attempts: 0,
      })
      .select('*')
      .single();

    if (error || !data) {
      return { error: error?.message || 'Could not create student account.' };
    }
    return { student: data as Student };
  }

  const db = readLocalDb();
  const now = new Date().toISOString();
  const student: Student = {
    id: crypto.randomUUID(),
    roll_number: cleanRoll,
    full_name: cleanName,
    class: input.class,
    section: input.section,
    password_hash: input.password_hash,
    is_active: true,
    extra_attempts: 0,
    created_at: now,
    updated_at: now,
  };
  db.students.push(student);
  writeLocalDb(db);
  return { student };
}

export async function listStudents(filters?: {
  class?: number;
  section?: string;
  search?: string;
}): Promise<Array<Omit<Student, 'password_hash'> & { attempts_count: number }>> {
  let students: Student[] = [];
  let attempts: QuizAttempt[] = [];

  if (isSupabaseConfigured()) {
    let q = getSupabase()
      .from('students')
      .select('*')
      .order('class', { ascending: true })
      .order('section', { ascending: true })
      .order('roll_number', { ascending: true });
    if (filters?.class) q = q.eq('class', filters.class);
    if (filters?.section) q = q.eq('section', filters.section);
    const { data } = await q;
    students = (data || []) as Student[];

    const { data: attData } = await getSupabase()
      .from('quiz_attempts')
      .select('*');
    attempts = (attData || []) as QuizAttempt[];
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
    let q = getSupabase()
      .from('questions')
      .select('*')
      .order('class', { ascending: true })
      .order('created_at', { ascending: false });
    if (!filters?.include_inactive) q = q.eq('is_active', true);
    if (filters?.class) q = q.eq('class', filters.class);
    if (filters?.difficulty) q = q.eq('difficulty', filters.difficulty);
    if (filters?.subject_tag) q = q.eq('subject_tag', filters.subject_tag);
    const { data } = await q;
    list = (data || []) as Question[];
  } else {
    const db = readLocalDb();
    list = db.questions.filter((q) =>
      filters?.include_inactive ? true : q.is_active
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
  const created: Question = {
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
  const created: Question[] = inputs.map((item) => ({
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
  let attempts: QuizAttempt[] = [];
  if (isSupabaseConfigured()) {
    const { data } = await getSupabase()
      .from('quiz_attempts')
      .select('*')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false });
    attempts = (data || []) as QuizAttempt[];
  } else {
    const db = readLocalDb();
    attempts = db.quiz_attempts
      .filter((a) => a.student_id === studentId)
      .sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      );
  }

  // Auto-grade any stale in_progress attempt whose timer already expired
  const result: QuizAttempt[] = [];
  for (const att of attempts) {
    if (att.status === 'in_progress') {
      const cfg = await getExamConfigByClass(att.class);
      const deadlineMs =
        new Date(att.started_at).getTime() +
        cfg.time_limit_minutes * 60 * 1000 +
        15000;
      if (Date.now() > deadlineMs) {
        const graded = await gradeAndSubmitAttempt(att.id, cfg.passing_score);
        result.push(graded || att);
        continue;
      }
    }
    result.push(att);
  }

  return result;
}

export async function getAttemptById(attemptId: string): Promise<QuizAttempt | null> {
  if (isSupabaseConfigured()) {
    const { data } = await getSupabase()
      .from('quiz_attempts')
      .select('*')
      .eq('id', attemptId)
      .maybeSingle();
    return (data as QuizAttempt) || null;
  }
  const db = readLocalDb();
  return db.quiz_attempts.find((a) => a.id === attemptId) || null;
}

export async function getResponsesByAttemptId(
  attemptId: string
): Promise<QuizResponse[]> {
  if (isSupabaseConfigured()) {
    const { data } = await getSupabase()
      .from('quiz_responses')
      .select('*')
      .eq('attempt_id', attemptId)
      .order('question_order', { ascending: true });
    return (data || []) as QuizResponse[];
  }
  const db = readLocalDb();
  return db.quiz_responses
    .filter((r) => r.attempt_id === attemptId)
    .sort((a, b) => a.question_order - b.question_order);
}

export async function getStudentAnsweredQuestionIds(
  studentId: string
): Promise<Set<string>> {
  if (isSupabaseConfigured()) {
    const { data: attempts } = await getSupabase()
      .from('quiz_attempts')
      .select('id')
      .eq('student_id', studentId);
    const ids = (attempts || []).map((a: { id: string }) => a.id);
    if (ids.length === 0) return new Set();
    const { data: resps } = await getSupabase()
      .from('quiz_responses')
      .select('question_id')
      .in('attempt_id', ids);
    return new Set((resps || []).map((r: { question_id: string }) => r.question_id));
  }

  const db = readLocalDb();
  const attemptIds = new Set(
    db.quiz_attempts
      .filter((a) => a.student_id === studentId)
      .map((a) => a.id)
  );
  const questionIds = new Set<string>();
  for (const r of db.quiz_responses) {
    if (attemptIds.has(r.attempt_id)) {
      questionIds.add(r.question_id);
    }
  }
  return questionIds;
}

export async function createQuizAttemptWithResponses(
  studentId: string,
  cls: number,
  selectedQuestions: Question[]
): Promise<{ attempt: QuizAttempt; responses: QuizResponse[] }> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const { data: attData, error: attErr } = await getSupabase()
      .from('quiz_attempts')
      .insert({
        student_id: studentId,
        class: cls,
        started_at: now,
        total_questions: selectedQuestions.length,
        status: 'in_progress',
      })
      .select('*')
      .single();
    if (attErr || !attData) {
      throw new Error(attErr?.message || 'Failed to start quiz attempt');
    }

    const responseRows = selectedQuestions.map((q, idx) => ({
      attempt_id: attData.id,
      question_id: q.id,
      question_order: idx + 1,
      selected_option: null,
      is_correct: null,
    }));

    const { data: respData, error: respErr } = await getSupabase()
      .from('quiz_responses')
      .insert(responseRows)
      .select('*');
    if (respErr || !respData) {
      throw new Error(respErr?.message || 'Failed to create quiz responses');
    }

    return {
      attempt: attData as QuizAttempt,
      responses: (respData as QuizResponse[]).sort(
        (a, b) => a.question_order - b.question_order
      ),
    };
  }

  const db = readLocalDb();
  const attempt: QuizAttempt = {
    id: crypto.randomUUID(),
    student_id: studentId,
    class: cls,
    started_at: now,
    submitted_at: null,
    total_questions: selectedQuestions.length,
    correct_count: null,
    score_percentage: null,
    passed: null,
    status: 'in_progress',
  };
  const responses: QuizResponse[] = selectedQuestions.map((q, idx) => ({
    id: crypto.randomUUID(),
    attempt_id: attempt.id,
    question_id: q.id,
    question_order: idx + 1,
    selected_option: null,
    is_correct: null,
  }));

  db.quiz_attempts.push(attempt);
  db.quiz_responses.push(...responses);
  writeLocalDb(db);

  return { attempt, responses };
}

export async function saveDraftResponses(
  attemptId: string,
  updates: Array<{ response_id: string; selected_option: OptionKey | null }>
): Promise<void> {
  const validOpts = new Set(['a', 'b', 'c', 'd']);
  if (isSupabaseConfigured()) {
    for (const item of updates) {
      const opt =
        item.selected_option && validOpts.has(item.selected_option)
          ? item.selected_option
          : null;
      await getSupabase()
        .from('quiz_responses')
        .update({ selected_option: opt })
        .eq('id', item.response_id)
        .eq('attempt_id', attemptId);
    }
    return;
  }

  const db = readLocalDb();
  const map = new Map<string, OptionKey | null>();
  for (const u of updates) {
    map.set(
      u.response_id,
      u.selected_option && validOpts.has(u.selected_option)
        ? u.selected_option
        : null
    );
  }
  for (const r of db.quiz_responses) {
    if (r.attempt_id === attemptId && map.has(r.id)) {
      r.selected_option = map.get(r.id)!;
    }
  }
  writeLocalDb(db);
}

export async function gradeAndSubmitAttempt(
  attemptId: string,
  passingScore: number,
  submittedResponses?: Array<{
    response_id: string;
    selected_option: OptionKey | null;
  }>
): Promise<QuizAttempt | null> {
  const validOpts = new Set(['a', 'b', 'c', 'd']);

  if (isSupabaseConfigured()) {
    const attempt = await getAttemptById(attemptId);
    if (!attempt) return null;
    if (attempt.status !== 'in_progress') return attempt;

    const existingResponses = await getResponsesByAttemptId(attemptId);
    const qIds = existingResponses.map((r) => r.question_id);
    const { data: qRows } = await getSupabase()
      .from('questions')
      .select('id, correct_option')
      .in('id', qIds);
    const answerKey = new Map<string, OptionKey>(
      (qRows || []).map((q: { id: string; correct_option: OptionKey }) => [
        q.id,
        q.correct_option,
      ])
    );

    const submittedMap = new Map<string, OptionKey | null>();
    if (submittedResponses) {
      for (const s of submittedResponses) {
        submittedMap.set(
          s.response_id,
          s.selected_option && validOpts.has(s.selected_option)
            ? s.selected_option
            : null
        );
      }
    }

    let correctCount = 0;
    for (const r of existingResponses) {
      const selected = submittedMap.has(r.id)
        ? submittedMap.get(r.id)!
        : r.selected_option;
      const correctOpt = answerKey.get(r.question_id);
      const isCorrect = Boolean(selected && correctOpt && selected === correctOpt);
      if (isCorrect) correctCount++;

      await getSupabase()
        .from('quiz_responses')
        .update({ selected_option: selected, is_correct: isCorrect })
        .eq('id', r.id);
    }

    const total = existingResponses.length || attempt.total_questions || 1;
    const pct = Number(((correctCount / total) * 100).toFixed(2));
    const passed = correctCount >= passingScore;

    const { data: updated } = await getSupabase()
      .from('quiz_attempts')
      .update({
        submitted_at: new Date().toISOString(),
        correct_count: correctCount,
        score_percentage: pct,
        passed,
        status: 'graded',
      })
      .eq('id', attemptId)
      .select('*')
      .single();

    return (updated as QuizAttempt) || null;
  }

  const db = readLocalDb();
  const attIdx = db.quiz_attempts.findIndex((a) => a.id === attemptId);
  if (attIdx === -1) return null;
  if (db.quiz_attempts[attIdx].status !== 'in_progress') {
    return db.quiz_attempts[attIdx];
  }

  const questionMap = new Map<string, Question>(
    db.questions.map((q) => [q.id, q])
  );
  const submittedMap = new Map<string, OptionKey | null>();
  if (submittedResponses) {
    for (const s of submittedResponses) {
      submittedMap.set(
        s.response_id,
        s.selected_option && validOpts.has(s.selected_option)
          ? s.selected_option
          : null
      );
    }
  }

  let correctCount = 0;
  let totalServed = 0;
  for (const r of db.quiz_responses) {
    if (r.attempt_id !== attemptId) continue;
    totalServed++;
    const chosen = submittedMap.has(r.id)
      ? submittedMap.get(r.id)!
      : r.selected_option;
    const q = questionMap.get(r.question_id);
    const isCorrect = Boolean(chosen && q && chosen === q.correct_option);
    r.selected_option = chosen;
    r.is_correct = isCorrect;
    if (isCorrect) correctCount++;
  }

  const denom = totalServed || db.quiz_attempts[attIdx].total_questions || 1;
  const pct = Number(((correctCount / denom) * 100).toFixed(2));

  db.quiz_attempts[attIdx] = {
    ...db.quiz_attempts[attIdx],
    submitted_at: new Date().toISOString(),
    correct_count: correctCount,
    score_percentage: pct,
    passed: correctCount >= passingScore,
    status: 'graded',
  };

  writeLocalDb(db);
  return db.quiz_attempts[attIdx];
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
  let attempts: QuizAttempt[] = [];
  let students: Student[] = [];

  if (isSupabaseConfigured()) {
    const { data: attData } = await getSupabase()
      .from('quiz_attempts')
      .select('*')
      .neq('status', 'in_progress')
      .order('submitted_at', { ascending: false });
    attempts = (attData || []) as QuizAttempt[];

    const { data: stuData } = await getSupabase().from('students').select('*');
    students = (stuData || []) as Student[];
  } else {
    const db = readLocalDb();
    attempts = db.quiz_attempts
      .filter((a) => a.status !== 'in_progress')
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
    const q = qMap.get(r.question_id);
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
  let students: Student[] = [];
  let questions: Question[] = [];
  let attempts: QuizAttempt[] = [];
  let responses: QuizResponse[] = [];
  let configs: ExamConfig[] = [];

  if (isSupabaseConfigured()) {
    const [sRes, qRes, aRes, rRes, cRes] = await Promise.all([
      getSupabase().from('students').select('*'),
      getSupabase().from('questions').select('*'),
      getSupabase().from('quiz_attempts').select('*'),
      getSupabase().from('quiz_responses').select('*'),
      getSupabase().from('exam_config').select('*'),
    ]);
    students = (sRes.data || []) as Student[];
    questions = (qRes.data || []) as Question[];
    attempts = (aRes.data || []) as QuizAttempt[];
    responses = (rRes.data || []) as QuizResponse[];
    configs = (cRes.data || []) as ExamConfig[];
  } else {
    const db = readLocalDb();
    students = db.students;
    questions = db.questions;
    attempts = db.quiz_attempts;
    responses = db.quiz_responses;
    configs = db.exam_config;
  }

  const activeQuestions = questions.filter((q) => q.is_active);
  const completedAttempts = attempts.filter((a) => a.status !== 'in_progress');
  const inProgressAttempts = attempts.filter((a) => a.status === 'in_progress');

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
    attempts.length > 0
      ? Math.round((completedAttempts.length / attempts.length) * 100)
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

  // Question-wise accuracy & most common wrong option analysis
  const completedAttemptIds = new Set(completedAttempts.map((a) => a.id));
  const qStats = new Map<
    string,
    {
      total: number;
      correct: number;
      wrongCounts: Record<string, number>;
    }
  >();

  for (const r of responses) {
    if (!completedAttemptIds.has(r.attempt_id)) continue;
    if (!qStats.has(r.question_id)) {
      qStats.set(r.question_id, { total: 0, correct: 0, wrongCounts: {} });
    }
    const st = qStats.get(r.question_id)!;
    st.total++;
    if (r.is_correct) {
      st.correct++;
    } else if (r.selected_option) {
      st.wrongCounts[r.selected_option] =
        (st.wrongCounts[r.selected_option] || 0) + 1;
    }
  }

  const qMap = new Map(questions.map((q) => [q.id, q]));
  const questionAccuracy = Array.from(qStats.entries())
    .map(([qId, st]) => {
      const q = qMap.get(qId);
      if (!q || st.total === 0) return null;
      let mostCommonWrong: string | null = null;
      let maxWrong = 0;
      for (const [opt, cnt] of Object.entries(st.wrongCounts)) {
        if (cnt > maxWrong) {
          maxWrong = cnt;
          mostCommonWrong = opt;
        }
      }
      return {
        question_id: q.id,
        class: q.class,
        subject_tag: q.subject_tag,
        difficulty: q.difficulty,
        question_text: q.question_text,
        correct_option: q.correct_option,
        attempts: st.total,
        correct: st.correct,
        accuracy_pct: Math.round((st.correct / st.total) * 100),
        most_common_wrong_option: mostCommonWrong,
        most_common_wrong_text: mostCommonWrong
          ? (q[`option_${mostCommonWrong}` as keyof Question] as string)
          : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => a.accuracy_pct - b.accuracy_pct || b.attempts - a.attempts);

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
