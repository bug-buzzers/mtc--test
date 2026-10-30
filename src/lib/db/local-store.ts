import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { CLASSES } from '../constants';
import {
  Admin,
  ExamConfig,
  OptionKey,
  Question,
  QuizAttempt,
  QuizResponse,
  Student,
} from '../types';
import {
  loadAllQuestionsFromQuizFiles,
  loadAllQuizSchemaFiles,
} from './quiz-files-loader';

export interface LocalDatabaseSchema {
  schema_source?: string;
  students: Student[];
  admins: Admin[];
  questions: Array<Question & { code?: string }>;
  exam_config: ExamConfig[];
  quiz_attempts: QuizAttempt[];
  quiz_responses: QuizResponse[];
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'mtc-local-db.json');
const CURRENT_SCHEMA_SOURCE = 'mtc-practical-108-per-class-v3';

function deterministicQuestionUuid(code: string): string {
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    'a' + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

function buildInitialSeed(): LocalDatabaseSchema {
  const now = new Date().toISOString();
  const adminPasswordHash = bcrypt.hashSync('Maples@2026', 10);
  const studentPasswordHash = bcrypt.hashSync('student123', 10);

  const admins: Admin[] = [
    {
      id: crypto.randomUUID(),
      username: 'admin',
      password_hash: adminPasswordHash,
      full_name: 'Faculty Advisor & MTC Coordinator — Maples Academy',
      created_at: now,
    },
  ];

  const quizDocs = loadAllQuizSchemaFiles();
  const docByClass = new Map(quizDocs.map((d) => [d.class, d]));

  const exam_config: ExamConfig[] = CLASSES.map((cls) => {
    const defaults = docByClass.get(cls)?.exam_defaults;
    return {
      id: crypto.randomUUID(),
      class: cls,
      is_open: true,
      total_questions: defaults?.total_questions_served ?? 25,
      time_limit_minutes: defaults?.time_limit_minutes ?? 30,
      passing_score: defaults?.passing_score ?? 18,
      max_attempts: defaults?.max_attempts ?? 1,
      show_results_to_students: defaults?.show_results_to_students ?? false,
      updated_at: now,
    };
  });

  // Read questions directly from database/quizzes/class-*.json schema files
  const schemaQuestions = loadAllQuestionsFromQuizFiles();
  const questions: Array<Question & { code?: string }> = schemaQuestions.map(
    (q) => ({
      id: deterministicQuestionUuid(q.code),
      code: q.code,
      class: q.class,
      subject_tag: q.subject_tag,
      difficulty: q.difficulty,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      is_active: true,
      created_at: now,
      updated_at: now,
    })
  );

  const starterStudents: Array<{
    roll_number: string;
    full_name: string;
    class: number;
    section: string;
    sampleScore?: number;
  }> = [
    // Ready-to-test students (NO prior attempt — ready to click "Start Your Exam")
    { roll_number: '601', full_name: 'Aarav Sharma', class: 6, section: 'A' },
    { roll_number: '802', full_name: 'Rohan Chauhan', class: 8, section: 'B' },
    { roll_number: '1101', full_name: 'Priyanshu Malik', class: 11, section: 'Maths' },

    // Founding Proposers (Harsh Roll 13 & Vidhan — Class XII, Maples Academy Khatauli)
    { roll_number: '13', full_name: 'Harsh', class: 12, section: 'Maths', sampleScore: 25 },
    { roll_number: '14', full_name: 'Vidhan', class: 12, section: 'Maths', sampleScore: 24 },

    // Sample graded attempts across Classes 6–12 for Admin Results, Print & Analytics
    { roll_number: '602', full_name: 'Ananya Verma', class: 6, section: 'B', sampleScore: 21 },
    { roll_number: '603', full_name: 'Vihaan Gupta', class: 6, section: 'A', sampleScore: 15 },
    { roll_number: '701', full_name: 'Kabir Tyagi', class: 7, section: 'A', sampleScore: 20 },
    { roll_number: '702', full_name: 'Navya Rathi', class: 7, section: 'B', sampleScore: 19 },
    { roll_number: '801', full_name: 'Meera Gupta', class: 8, section: 'A', sampleScore: 23 },
    { roll_number: '803', full_name: 'Arjun Pundir', class: 8, section: 'A', sampleScore: 19 },
    { roll_number: '804', full_name: 'Kritika Saini', class: 8, section: 'B', sampleScore: 14 },
    { roll_number: '901', full_name: 'Ishita Singhal', class: 9, section: 'A', sampleScore: 22 },
    { roll_number: '902', full_name: 'Yashvardhan Tomar', class: 9, section: 'B', sampleScore: 16 },
    { roll_number: '1001', full_name: 'Devansh Baliyan', class: 10, section: 'B', sampleScore: 21 },
    { roll_number: '1102', full_name: 'Riya Choudhary', class: 11, section: 'Bio', sampleScore: 20 },
    { roll_number: '1103', full_name: 'Kunal Agarwal', class: 11, section: 'Commerce', sampleScore: 13 },
    { roll_number: '1202', full_name: 'Suhani Jain', class: 12, section: 'Humanities', sampleScore: 19 },
  ];

  const students: Student[] = [];
  const quiz_attempts: QuizAttempt[] = [];
  const quiz_responses: QuizResponse[] = [];

  starterStudents.forEach((s, idx) => {
    const studentId = crypto.randomUUID();
    students.push({
      id: studentId,
      roll_number: s.roll_number,
      full_name: s.full_name,
      class: s.class,
      section: s.section,
      password_hash: studentPasswordHash,
      is_active: true,
      extra_attempts: 0,
      created_at: now,
      updated_at: now,
    });

    if (typeof s.sampleScore === 'number') {
      const clsQuestions = questions.filter((q) => q.class === s.class).slice(0, 25);
      const attemptId = crypto.randomUUID();
      const startedDate = new Date(Date.now() - (idx + 2) * 3600 * 1000);
      const durationMinutes = 17 + (idx % 10);
      const submittedDate = new Date(
        startedDate.getTime() + durationMinutes * 60 * 1000
      );

      const correctTarget = Math.min(s.sampleScore, clsQuestions.length);
      const pct = Number(((correctTarget / clsQuestions.length) * 100).toFixed(2));

      quiz_attempts.push({
        id: attemptId,
        student_id: studentId,
        class: s.class,
        started_at: startedDate.toISOString(),
        submitted_at: submittedDate.toISOString(),
        total_questions: clsQuestions.length,
        correct_count: correctTarget,
        score_percentage: pct,
        passed: correctTarget >= 18,
        status: 'graded',
      });

      const allOpts: OptionKey[] = ['a', 'b', 'c', 'd'];
      clsQuestions.forEach((q, qIdx) => {
        const makeCorrect = qIdx < correctTarget;
        const wrongOpts = allOpts.filter((o) => o !== q.correct_option);
        const chosenOpt: OptionKey = makeCorrect
          ? q.correct_option
          : wrongOpts[(qIdx + idx) % wrongOpts.length];

        quiz_responses.push({
          id: crypto.randomUUID(),
          attempt_id: attemptId,
          question_id: q.id,
          question_order: qIdx + 1,
          selected_option: chosenOpt,
          is_correct: makeCorrect,
        });
      });
    }
  });

  return {
    schema_source: CURRENT_SCHEMA_SOURCE,
    students,
    admins,
    questions,
    exam_config,
    quiz_attempts,
    quiz_responses,
  };
}

/**
 * Syncs any new questions added to `database/quizzes/class-*.json` into an existing local DB
 * automatically by `code`, without overwriting admin edits/soft-deletes.
 */
function syncNewQuestionsFromSchemaFiles(db: LocalDatabaseSchema): boolean {
  const fileQuestions = loadAllQuestionsFromQuizFiles();
  const existingCodes = new Set(
    db.questions.map((q) => q.code).filter(Boolean)
  );
  const existingIds = new Set(db.questions.map((q) => q.id));

  let changed = false;
  const now = new Date().toISOString();

  for (const fq of fileQuestions) {
    const detId = deterministicQuestionUuid(fq.code);
    if (!existingCodes.has(fq.code) && !existingIds.has(detId)) {
      db.questions.push({
        id: detId,
        code: fq.code,
        class: fq.class,
        subject_tag: fq.subject_tag,
        difficulty: fq.difficulty,
        question_text: fq.question_text,
        option_a: fq.option_a,
        option_b: fq.option_b,
        option_c: fq.option_c,
        option_d: fq.option_d,
        correct_option: fq.correct_option,
        is_active: true,
        created_at: now,
        updated_at: now,
      });
      changed = true;
    }
  }

  return changed;
}

export function readLocalDb(): LocalDatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    const seeded = buildInitialSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf8');
    return seeded;
  }

  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const parsed = JSON.parse(raw) as LocalDatabaseSchema;

  // Upgrade older v1 seed automatically to the Proposal-aligned v2 Quiz Schema Bank
  if (parsed.schema_source !== CURRENT_SCHEMA_SOURCE) {
    const upgraded = buildInitialSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(upgraded, null, 2), 'utf8');
    return upgraded;
  }

  if (syncNewQuestionsFromSchemaFiles(parsed)) {
    writeLocalDb(parsed);
  }

  return parsed;
}

export function writeLocalDb(db: LocalDatabaseSchema): void {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}
