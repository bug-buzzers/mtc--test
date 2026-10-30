import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { SHORTCUTS_BANK } from './banks/shortcuts.mjs';
import { HARDWARE_BANK } from './banks/hardware.mjs';
import { SOFTWARE_BANK } from './banks/software.mjs';
import { BROWSING_BANK } from './banks/browsing.mjs';
import { NETWORKING_BANK } from './banks/networking.mjs';
import { ETHICS_BANK } from './banks/ethics.mjs';

const CATEGORY_POOLS = [
  { tag: 'Keyboard Shortcuts', items: SHORTCUTS_BANK },
  { tag: 'Computer Hardware', items: HARDWARE_BANK },
  { tag: 'Application Software & OS', items: SOFTWARE_BANK },
  { tag: 'Web Browsing & Internet', items: BROWSING_BANK },
  { tag: 'Basic Networking & Connectivity', items: NETWORKING_BANK },
  { tag: 'Social Ethics & Cyber Safety', items: ETHICS_BANK },
];

const CATEGORIES = CATEGORY_POOLS.map((c) => c.tag);
const OPTION_KEYS = ['a', 'b', 'c', 'd'];

// Deterministic permutation of [0,1,2,3] so correct answers are evenly balanced across A, B, C, D
const PERMUTATIONS = [
  [0, 1, 2, 3],
  [1, 0, 3, 2],
  [2, 3, 0, 1],
  [3, 2, 1, 0],
  [1, 2, 3, 0],
  [2, 0, 1, 3],
  [3, 1, 0, 2],
  [0, 2, 3, 1],
];

function rebalanceOptions(rawQ, seedIndex) {
  const origOptions = [
    rawQ.option_a,
    rawQ.option_b,
    rawQ.option_c,
    rawQ.option_d,
  ];
  const origCorrectIdx = OPTION_KEYS.indexOf(rawQ.correct_option);
  if (origCorrectIdx === -1) {
    throw new Error(`Invalid correct_option in "${rawQ.question_text}"`);
  }

  const perm = PERMUTATIONS[seedIndex % PERMUTATIONS.length];
  const newOptions = perm.map((oldIdx) => origOptions[oldIdx]);
  const newCorrectIdx = perm.indexOf(origCorrectIdx);

  return {
    option_a: newOptions[0],
    option_b: newOptions[1],
    option_c: newOptions[2],
    option_d: newOptions[3],
    correct_option: OPTION_KEYS[newCorrectIdx],
  };
}

fs.mkdirSync('./database/quizzes', { recursive: true });
fs.mkdirSync('./supabase/quizzes', { recursive: true });

const esc = (s) => String(s).replace(/'/g, "''");
let allFlatQuestions = [];

for (let cls = 6; cls <= 12; cls++) {
  const clsPad = String(cls).padStart(2, '0');
  const offset = (cls - 6) * 4; // 0, 4, 8, 12, 16, 20, 24 (each slice takes 18 -> max index 41)
  const eligibleSections =
    cls >= 11 ? ['Maths', 'Bio', 'Commerce', 'Humanities'] : ['A', 'B'];

  const classQuestions = [];
  const seenTexts = new Set();

  CATEGORY_POOLS.forEach((pool, catIdx) => {
    if (pool.items.length < 42) {
      throw new Error(
        `Category "${pool.tag}" has ${pool.items.length} items (expected 42)`
      );
    }

    const slice = pool.items.slice(offset, offset + 18);
    slice.forEach((rawItem, localIdx) => {
      // Relative age-appropriate difficulty within the 18-item slice:
      // 0..6 = easy (7), 7..13 = medium (7), 14..17 = hard (4) -> 42 easy, 42 medium, 24 hard = 108 total
      const relDifficulty =
        localIdx < 7 ? 'easy' : localIdx < 14 ? 'medium' : 'hard';

      const normText = rawItem.question_text.trim();
      if (seenTexts.has(normText.toLowerCase())) {
        throw new Error(`Duplicate question in Class ${cls}: "${normText}"`);
      }
      seenTexts.add(normText.toLowerCase());

      const qIndex = classQuestions.length + 1;
      const code = `MTC-C${clsPad}-Q${String(qIndex).padStart(3, '0')}`;
      const balanced = rebalanceOptions(
        rawItem,
        cls * 31 + catIdx * 17 + localIdx
      );

      classQuestions.push({
        code,
        class: cls,
        subject_tag: pool.tag,
        difficulty: relDifficulty,
        question_text: normText,
        ...balanced,
      });
    });
  });

  if (classQuestions.length < 100) {
    throw new Error(
      `Class ${cls} has only ${classQuestions.length} questions — minimum 100 required!`
    );
  }

  allFlatQuestions.push(...classQuestions);

  // 1. Write Class Quiz Schema JSON file (`database/quizzes/class-XX.json`)
  const quizJsonDoc = {
    schema_version: '2.0.0',
    institution: 'Maples Academy, Khatauli (District Muzaffarnagar, U.P. - 251201)',
    club: 'Maples Tech Club (MTC) — Learn it. Build it. Ship it.',
    class: cls,
    eligible_sections: eligibleSections,
    selection_policy: {
      mode: 'random_shuffle_per_attempt',
      minimum_bank_size: 100,
      syllabus_free: true,
    },
    exam_defaults: {
      total_questions_served: 25,
      time_limit_minutes: 30,
      passing_score: 18,
      max_attempts: 1,
      show_results_to_students: false,
    },
    categories: CATEGORIES,
    total_questions_in_bank: classQuestions.length,
    questions: classQuestions,
  };

  const jsonPath = path.join('./database/quizzes', `class-${clsPad}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(quizJsonDoc, null, 2) + '\n', 'utf8');

  // 2. Write per-class SQL Quiz file (`supabase/quizzes/class_XX_quiz.sql`)
  const sqlRows = classQuestions
    .map(
      (q) =>
        `  (${q.class}, '${esc(q.subject_tag)}', '${esc(q.difficulty)}', '${esc(q.question_text)}', '${esc(q.option_a)}', '${esc(q.option_b)}', '${esc(q.option_c)}', '${esc(q.option_d)}', '${esc(q.correct_option)}')`
    )
    .join(',\n');

  const classSql = `-- =============================================================================
-- MAPLES TECH CLUB (MTC) — CLASS ${cls} QUIZ BANK (${classQuestions.length} PRACTICAL MCQs)
-- Institution: Maples Academy, Khatauli, District Muzaffarnagar, U.P. - 251201
-- Non-Syllabus Everyday Computer Literacy: Shortcuts, Hardware, Software & OS,
-- Web Browsing, Basic Networking, and Social Ethics & Cyber Safety.
-- During each test, 25 questions are chosen randomly from this ${classQuestions.length}-question pool.
-- =============================================================================

INSERT INTO public.exam_config (class, is_open, total_questions, time_limit_minutes, passing_score, max_attempts, show_results_to_students)
VALUES (${cls}, true, 25, 30, 18, 1, false)
ON CONFLICT (class) DO NOTHING;

INSERT INTO public.questions (class, subject_tag, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option)
VALUES
${sqlRows};
`;

  const sqlPath = path.join('./supabase/quizzes', `class_${clsPad}_quiz.sql`);
  fs.writeFileSync(sqlPath, classSql, 'utf8');

  const dist = { a: 0, b: 0, c: 0, d: 0 };
  classQuestions.forEach((q) => dist[q.correct_option]++);
  console.log(
    `Class ${cls}: ${classQuestions.length} unique MCQs | Answer distribution A=${dist.a}, B=${dist.b}, C=${dist.c}, D=${dist.d}`
  );
}

// 3. Write Master `supabase/seed.sql`
const adminHash = bcrypt.hashSync('Maples@2026', 10);
const studentHash = bcrypt.hashSync('student123', 10);

const masterRows = allFlatQuestions
  .map(
    (q) =>
      `  (${q.class}, '${esc(q.subject_tag)}', '${esc(q.difficulty)}', '${esc(q.question_text)}', '${esc(q.option_a)}', '${esc(q.option_b)}', '${esc(q.option_c)}', '${esc(q.option_d)}', '${esc(q.correct_option)}')`
  )
  .join(',\n');

const masterSeedSql = `-- =============================================================================
-- MAPLES TECH CLUB (MTC) — MASTER DATABASE SEED (ALL CLASSES 6–12, ${allFlatQuestions.length} MCQs)
-- Institution: Maples Academy, Khatauli, District Muzaffarnagar, U.P. - 251201
-- Minimum 100+ Practical Everyday Computer MCQs per Class (108 per class × 7 = 756)
-- =============================================================================

INSERT INTO public.admins (username, password_hash, full_name)
VALUES ('admin', '${esc(adminHash)}', 'Faculty Advisor & MTC Coordinator — Maples Academy')
ON CONFLICT (username) DO NOTHING;

INSERT INTO public.exam_config (class, is_open, total_questions, time_limit_minutes, passing_score, max_attempts, show_results_to_students)
VALUES
  (6,  true, 25, 30, 18, 1, false),
  (7,  true, 25, 30, 18, 1, false),
  (8,  true, 25, 30, 18, 1, false),
  (9,  true, 25, 30, 18, 1, false),
  (10, true, 25, 30, 18, 1, false),
  (11, true, 25, 30, 18, 1, false),
  (12, true, 25, 30, 18, 1, false)
ON CONFLICT (class) DO NOTHING;

INSERT INTO public.students (roll_number, full_name, class, section, password_hash)
VALUES
  ('601',  'Aarav Sharma',     6,  'A',          '${esc(studentHash)}'),
  ('602',  'Ananya Verma',     6,  'B',          '${esc(studentHash)}'),
  ('701',  'Kabir Tyagi',      7,  'A',          '${esc(studentHash)}'),
  ('801',  'Meera Gupta',      8,  'A',          '${esc(studentHash)}'),
  ('802',  'Rohan Chauhan',    8,  'B',          '${esc(studentHash)}'),
  ('901',  'Ishita Singhal',   9,  'A',          '${esc(studentHash)}'),
  ('1001', 'Devansh Baliyan',  10, 'B',          '${esc(studentHash)}'),
  ('1101', 'Priyanshu Malik',  11, 'Maths',      '${esc(studentHash)}'),
  ('1102', 'Riya Choudhary',   11, 'Bio',        '${esc(studentHash)}'),
  ('13',   'Harsh',            12, 'Maths',      '${esc(studentHash)}'),
  ('14',   'Vidhan',           12, 'Maths',      '${esc(studentHash)}'),
  ('1202', 'Suhani Jain',      12, 'Humanities', '${esc(studentHash)}')
ON CONFLICT (roll_number, class, section) DO NOTHING;

INSERT INTO public.questions (class, subject_tag, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option)
VALUES
${masterRows};
`;

fs.writeFileSync('./supabase/seed.sql', masterSeedSql, 'utf8');
console.log(
  `Successfully generated 7 class quiz JSON files, 7 SQL quiz files, and supabase/seed.sql (${allFlatQuestions.length} total questions — 108 per class!).`
);
