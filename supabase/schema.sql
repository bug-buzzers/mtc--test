-- =============================================================================
-- MAPLES TECH CLUB (MTC) — DIGITAL ENTRANCE EXAMINATION SYSTEM
-- Institution: Maples Academy, Khatauli
-- Database Schema & Row Level Security (Supabase / PostgreSQL)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Automatic updated_at Trigger Function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. Table: students
-- Sections:
--   • Classes 6–10 : 'A', 'B'
--   • Classes 11–12: 'Maths', 'Bio', 'Commerce', 'Humanities'
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  class INTEGER NOT NULL CHECK (class BETWEEN 6 AND 12),
  section TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  extra_attempts INTEGER NOT NULL DEFAULT 0 CHECK (extra_attempts >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT students_valid_class_section CHECK (
    (class BETWEEN 6 AND 10 AND section IN ('A', 'B'))
    OR
    (class IN (11, 12) AND section IN ('Maths', 'Bio', 'Commerce', 'Humanities'))
  ),
  CONSTRAINT students_roll_class_section_unique UNIQUE (roll_number, class, section)
);

CREATE INDEX IF NOT EXISTS idx_students_class_section ON public.students(class, section);
CREATE INDEX IF NOT EXISTS idx_students_roll ON public.students(roll_number);

DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;
CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Table: admins
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. Table: questions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class INTEGER NOT NULL CHECK (class BETWEEN 6 AND 12),
  subject_tag TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_class_active_diff
  ON public.questions(class, is_active, difficulty);

DROP TRIGGER IF EXISTS trg_questions_updated_at ON public.questions;
CREATE TRIGGER trg_questions_updated_at
BEFORE UPDATE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Table: exam_config
-- Each class (6–12) has >= 100 quiz questions in its bank, drawn randomly per test.
-- Admins can toggle `show_results_to_students` per class to allow students to
-- inspect their score and full question-wise answer review.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class INTEGER NOT NULL UNIQUE CHECK (class BETWEEN 6 AND 12),
  is_open BOOLEAN NOT NULL DEFAULT true,
  total_questions INTEGER NOT NULL DEFAULT 25 CHECK (total_questions BETWEEN 1 AND 100),
  time_limit_minutes INTEGER NOT NULL DEFAULT 30 CHECK (time_limit_minutes BETWEEN 5 AND 180),
  passing_score INTEGER NOT NULL DEFAULT 18 CHECK (passing_score >= 1),
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts >= 1),
  show_results_to_students BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_config
  ADD COLUMN IF NOT EXISTS show_results_to_students BOOLEAN NOT NULL DEFAULT false;

DROP TRIGGER IF EXISTS trg_exam_config_updated_at ON public.exam_config;
CREATE TRIGGER trg_exam_config_updated_at
BEFORE UPDATE ON public.exam_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Table: quiz_attempts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class INTEGER NOT NULL CHECK (class BETWEEN 6 AND 12),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  total_questions INTEGER NOT NULL,
  correct_count INTEGER,
  score_percentage NUMERIC(5,2),
  passed BOOLEAN,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'graded'))
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON public.quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_class_status ON public.quiz_attempts(class, status);

-- -----------------------------------------------------------------------------
-- 6. Table: quiz_responses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  question_order INTEGER NOT NULL DEFAULT 1,
  selected_option TEXT CHECK (selected_option IS NULL OR selected_option IN ('a', 'b', 'c', 'd')),
  is_correct BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_quiz_responses_attempt ON public.quiz_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_question ON public.quiz_responses(question_id);

-- -----------------------------------------------------------------------------
-- Safe View for Student History (strictly hides score, correct_count, passed)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.student_attempt_summaries AS
SELECT
  id,
  student_id,
  class,
  started_at,
  submitted_at,
  total_questions,
  CASE
    WHEN status = 'graded' THEN 'submitted'
    ELSE status
  END AS status
FROM public.quiz_attempts;

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- Note: Next.js serverless API routes connect using SUPABASE_SERVICE_ROLE_KEY
-- and enforce strict JWT role checks. Direct client/anon access is locked down
-- by RLS as defense-in-depth.
-- -----------------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;

-- Students can read/update only their own row when authenticated with custom claims
DROP POLICY IF EXISTS "students_self_select" ON public.students;
CREATE POLICY "students_self_select" ON public.students
  FOR SELECT
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin'
    OR id::text = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
  );

DROP POLICY IF EXISTS "students_self_update" ON public.students;
CREATE POLICY "students_self_update" ON public.students
  FOR UPDATE
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin'
    OR id::text = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
  );

-- Admins only on admins table
DROP POLICY IF EXISTS "admins_full_access" ON public.admins;
CREATE POLICY "admins_full_access" ON public.admins
  FOR ALL
  USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin');

-- Questions table: direct client access restricted to admins only;
-- students receive questions exclusively via serverless API without correct_option
DROP POLICY IF EXISTS "questions_admin_only" ON public.questions;
CREATE POLICY "questions_admin_only" ON public.questions
  FOR ALL
  USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin');

-- Exam config: readable for checking open window, writable by admins only
DROP POLICY IF EXISTS "exam_config_read_authenticated" ON public.exam_config;
CREATE POLICY "exam_config_read_authenticated" ON public.exam_config
  FOR SELECT
  USING (current_setting('request.jwt.claims', true) IS NOT NULL);

DROP POLICY IF EXISTS "exam_config_admin_write" ON public.exam_config;
CREATE POLICY "exam_config_admin_write" ON public.exam_config
  FOR ALL
  USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin');

-- Quiz attempts & responses: direct table read restricted to admins so students
-- can NEVER inspect correct_count, score_percentage, passed, or is_correct
DROP POLICY IF EXISTS "quiz_attempts_admin_only" ON public.quiz_attempts;
CREATE POLICY "quiz_attempts_admin_only" ON public.quiz_attempts
  FOR ALL
  USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin');

DROP POLICY IF EXISTS "quiz_responses_admin_only" ON public.quiz_responses;
CREATE POLICY "quiz_responses_admin_only" ON public.quiz_responses
  FOR ALL
  USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin');
