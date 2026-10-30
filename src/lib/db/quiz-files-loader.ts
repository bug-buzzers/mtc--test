import fs from 'fs';
import path from 'path';
import { Difficulty, OptionKey } from '../types';

export interface QuizSchemaQuestion {
  code: string;
  class: number;
  subject_tag: string;
  difficulty: Difficulty;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: OptionKey;
}

export interface ClassQuizSchemaFile {
  schema_version: string;
  institution: string;
  club: string;
  class: number;
  eligible_sections: string[];
  selection_policy?: {
    mode: string;
    minimum_bank_size: number;
    syllabus_free: boolean;
  };
  exam_defaults: {
    total_questions_served: number;
    time_limit_minutes: number;
    passing_score: number;
    max_attempts?: number;
    show_results_to_students?: boolean;
  };
  categories?: string[];
  total_questions_in_bank?: number;
  questions: QuizSchemaQuestion[];
}

const QUIZZES_DIR = path.join(process.cwd(), 'database', 'quizzes');

/**
 * Reads all per-class JSON quiz schema files from `database/quizzes/class-06.json` .. `class-12.json`.
 * Each class file conforms to `database/schemas/class-quiz.schema.json` (>= 100 questions per class).
 */
export function loadAllQuizSchemaFiles(): ClassQuizSchemaFile[] {
  if (!fs.existsSync(QUIZZES_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(QUIZZES_DIR)
    .filter((f) => f.startsWith('class-') && f.endsWith('.json'))
    .sort();

  const parsed: ClassQuizSchemaFile[] = [];
  for (const filename of files) {
    const fullPath = path.join(QUIZZES_DIR, filename);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const doc = JSON.parse(raw) as ClassQuizSchemaFile;
    if (Array.isArray(doc.questions)) {
      parsed.push(doc);
    }
  }
  return parsed;
}

export function loadAllQuestionsFromQuizFiles(): QuizSchemaQuestion[] {
  return loadAllQuizSchemaFiles().flatMap((doc) => doc.questions);
}
