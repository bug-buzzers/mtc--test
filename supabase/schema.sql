-- MTC secure schema and idempotent security migration. Run as the database owner.
-- This intentionally closes exams and disables existing credentials and questions
-- once, because the previous demo credentials and bank were publicly exposed.
-- Historical records are preserved. Create a new admin and privately import a new bank.
BEGIN;

CREATE TABLE IF NOT EXISTS public.mtc_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), roll_number text NOT NULL, full_name text NOT NULL,
  class integer NOT NULL CHECK (class BETWEEN 6 AND 12), section text NOT NULL,
  password_hash text NOT NULL, is_active boolean NOT NULL DEFAULT true, password_reset_required boolean NOT NULL DEFAULT false,
  extra_attempts integer NOT NULL DEFAULT 0 CHECK (extra_attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT students_valid_class_section CHECK ((class BETWEEN 6 AND 10 AND section IN ('A','B')) OR (class IN (11,12) AND section IN ('Maths','Bio','Commerce','Humanities'))),
  CONSTRAINT students_roll_class_section_unique UNIQUE (roll_number,class,section)
);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS password_reset_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.students ALTER COLUMN password_reset_required SET DEFAULT false;
CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE,
  password_hash text NOT NULL, full_name text NOT NULL, is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class integer NOT NULL CHECK (class BETWEEN 6 AND 12),
  subject_tag text NOT NULL, difficulty text NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  question_text text NOT NULL, option_a text NOT NULL, option_b text NOT NULL, option_c text NOT NULL, option_d text NOT NULL,
  correct_option text NOT NULL CHECK (correct_option IN ('a','b','c','d')), is_active boolean NOT NULL DEFAULT true,
  bank_generation integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- Existing rows are generation 1; new private imports use generation 2.
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS bank_generation integer NOT NULL DEFAULT 1;
ALTER TABLE public.questions ALTER COLUMN bank_generation SET DEFAULT 2;
CREATE TABLE IF NOT EXISTS public.exam_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class integer NOT NULL UNIQUE CHECK (class BETWEEN 6 AND 12),
  is_open boolean NOT NULL DEFAULT false, total_questions integer NOT NULL DEFAULT 25 CHECK (total_questions BETWEEN 1 AND 100),
  time_limit_minutes integer NOT NULL DEFAULT 30 CHECK (time_limit_minutes BETWEEN 5 AND 180),
  passing_score integer NOT NULL DEFAULT 18 CHECK (passing_score >= 1), max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts >= 1),
  show_results_to_students boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_config ADD COLUMN IF NOT EXISTS show_results_to_students boolean NOT NULL DEFAULT false;
ALTER TABLE public.exam_config ALTER COLUMN is_open SET DEFAULT false;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='exam_config_pass_within_total' AND conrelid='public.exam_config'::regclass) THEN ALTER TABLE public.exam_config ADD CONSTRAINT exam_config_pass_within_total CHECK (passing_score <= total_questions) NOT VALID; END IF; END $$;
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class integer NOT NULL CHECK (class BETWEEN 6 AND 12), started_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz,
  total_questions integer NOT NULL, correct_count integer, score_percentage numeric(5,2), passed boolean,
  status text NOT NULL DEFAULT 'in_progress', deadline_at timestamptz, passing_score_snapshot integer,
  time_limit_minutes_snapshot integer, last_heartbeat_at timestamptz, tab_switch_warnings integer NOT NULL DEFAULT 0,
  blocked_reason text, blocked_at timestamptz, remaining_seconds_when_blocked integer
);
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS deadline_at timestamptz;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS passing_score_snapshot integer;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS time_limit_minutes_snapshot integer;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS tab_switch_warnings integer NOT NULL DEFAULT 0;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS blocked_reason text;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS remaining_seconds_when_blocked integer;
ALTER TABLE public.quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_status_check;
ALTER TABLE public.quiz_attempts ADD CONSTRAINT quiz_attempts_status_check CHECK (status IN ('in_progress','blocked','retired','submitted','graded'));
CREATE TABLE IF NOT EXISTS public.quiz_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id uuid NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT, question_order integer NOT NULL DEFAULT 1,
  selected_option text CHECK (selected_option IS NULL OR selected_option IN ('a','b','c','d')),
  is_correct boolean, question_snapshot jsonb
);
ALTER TABLE public.quiz_responses ADD COLUMN IF NOT EXISTS question_snapshot jsonb;
CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, role text NOT NULL CHECK (role IN ('admin','student')),
  expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  key text PRIMARY KEY, count integer NOT NULL, window_started_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.student_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code_hash text NOT NULL UNIQUE, roll_number text NOT NULL,
  class integer NOT NULL CHECK (class BETWEEN 6 AND 12), section text NOT NULL,
  expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.quiz_integrity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id uuid NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('tab_hidden','fullscreen_exit','quit','heartbeat_timeout','unlocked')),
  created_at timestamptz NOT NULL DEFAULT now(), actor_admin_id uuid REFERENCES public.admins(id)
);
CREATE INDEX IF NOT EXISTS idx_students_class_section ON public.students(class,section);
CREATE INDEX IF NOT EXISTS idx_questions_class_active ON public.questions(class,is_active);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON public.quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_attempt ON public.quiz_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_integrity_attempt ON public.quiz_integrity_events(attempt_id,created_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON public.auth_sessions(user_id,role);

-- Preserve a best-effort snapshot of historical questions and settings on upgrade.
UPDATE public.quiz_responses r SET question_snapshot = jsonb_build_object(
  'subject_tag',q.subject_tag,'difficulty',q.difficulty,'question_text',q.question_text,
  'option_a',q.option_a,'option_b',q.option_b,'option_c',q.option_c,'option_d',q.option_d,'correct_option',q.correct_option)
FROM public.questions q WHERE r.question_id=q.id AND r.question_snapshot IS NULL;
UPDATE public.quiz_attempts a SET
  time_limit_minutes_snapshot=COALESCE(a.time_limit_minutes_snapshot,c.time_limit_minutes,30),
  passing_score_snapshot=COALESCE(a.passing_score_snapshot,c.passing_score,18),
  deadline_at=COALESCE(a.deadline_at,a.started_at + make_interval(mins => COALESCE(c.time_limit_minutes,30))),
  last_heartbeat_at=COALESCE(a.last_heartbeat_at,a.started_at)
FROM public.exam_config c WHERE c.class=a.class AND (a.deadline_at IS NULL OR a.passing_score_snapshot IS NULL OR a.time_limit_minutes_snapshot IS NULL);
UPDATE public.quiz_attempts SET time_limit_minutes_snapshot=COALESCE(time_limit_minutes_snapshot,30),
  passing_score_snapshot=COALESCE(passing_score_snapshot,18), deadline_at=COALESCE(deadline_at,started_at + interval '30 minutes'),
  last_heartbeat_at=COALESCE(last_heartbeat_at,started_at) WHERE deadline_at IS NULL OR passing_score_snapshot IS NULL OR time_limit_minutes_snapshot IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mtc_migrations WHERE name='private-bank-and-credentials-v1') THEN
    UPDATE public.questions SET is_active=false WHERE bank_generation=1;
    UPDATE public.admins SET is_active=false;
    UPDATE public.students SET is_active=false, password_reset_required=true;
    -- Unfinished legacy papers used the exposed bank. Preserve them, but do not
    -- resume or count them against the student's new private-bank attempts.
    UPDATE public.quiz_attempts SET status='retired' WHERE status IN ('in_progress','blocked');
    UPDATE public.exam_config SET is_open=false, show_results_to_students=false;
    UPDATE public.auth_sessions SET revoked_at=now() WHERE revoked_at IS NULL;
    INSERT INTO public.mtc_migrations(name) VALUES ('private-bank-and-credentials-v1');
  END IF;
END $$;
INSERT INTO public.exam_config(class) SELECT generate_series(6,12) ON CONFLICT (class) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_questions_updated_at ON public.questions;
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_exam_config_updated_at ON public.exam_config;
CREATE TRIGGER trg_exam_config_updated_at BEFORE UPDATE ON public.exam_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- The application uses the service role on the server only. No direct anonymous
-- or authenticated PostgREST access to tables, views or functions is permitted.
DROP VIEW IF EXISTS public.student_attempt_summaries;
DO $$ DECLARE p record; t text; BEGIN
  FOR p IN SELECT policyname,tablename FROM pg_policies WHERE schemaname='public' AND tablename IN
    ('students','admins','questions','exam_config','quiz_attempts','quiz_responses','auth_sessions','auth_rate_limits','student_invites','quiz_integrity_events','mtc_migrations')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,p.tablename); END LOOP;
  FOREACH t IN ARRAY ARRAY['students','admins','questions','exam_config','quiz_attempts','quiz_responses','auth_sessions','auth_rate_limits','student_invites','quiz_integrity_events','mtc_migrations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.mtc_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
  INSERT INTO auth_rate_limits(key,count,window_started_at) VALUES (p_key,1,clock_timestamp())
  ON CONFLICT (key) DO UPDATE SET
    count=CASE WHEN auth_rate_limits.window_started_at + make_interval(secs=>p_window_seconds) <= clock_timestamp() THEN 1 ELSE auth_rate_limits.count+1 END,
    window_started_at=CASE WHEN auth_rate_limits.window_started_at + make_interval(secs=>p_window_seconds) <= clock_timestamp() THEN clock_timestamp() ELSE auth_rate_limits.window_started_at END
  RETURNING count INTO n;
  RETURN n <= p_limit;
END $$;

-- Retain historical invite records, but retire the old code-dependent RPC.
-- Apply this schema before deploying the corresponding registration API.
DROP FUNCTION IF EXISTS public.mtc_register_student(text,text,text,integer,text,text);
CREATE OR REPLACE FUNCTION public.mtc_register_student(p_full_name text,p_roll text,p_class integer,p_section text,p_password_hash text)
RETURNS public.students LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s students;
BEGIN
  IF p_full_name IS NULL OR length(trim(p_full_name)) NOT BETWEEN 2 AND 120
    OR p_roll IS NULL OR length(trim(p_roll)) NOT BETWEEN 1 AND 100
    OR p_class IS NULL OR p_section IS NULL OR NOT ((p_class BETWEEN 6 AND 10 AND p_section IN ('A','B')) OR (p_class IN (11,12) AND p_section IN ('Maths','Bio','Commerce','Humanities')))
    OR p_password_hash IS NULL OR p_password_hash='' THEN
    RAISE EXCEPTION 'Invalid registration details';
  END IF;
  -- Both student and administrator creation use this lock. It prevents
  -- concurrent case variations of the same roll from creating two accounts.
  PERFORM pg_advisory_xact_lock(hashtextextended('student-registration:' || p_class::text || ':' || p_section || ':' || lower(trim(p_roll)),0));
  IF EXISTS (SELECT 1 FROM students WHERE class=p_class AND section=p_section AND lower(trim(roll_number))=lower(trim(p_roll))) THEN
    RAISE EXCEPTION 'Student already registered' USING ERRCODE='23505';
  END IF;
  INSERT INTO students(roll_number,full_name,class,section,password_hash) VALUES (trim(p_roll),trim(p_full_name),p_class,p_section,p_password_hash) RETURNING * INTO s;
  RETURN s;
END $$;

-- Locking the student row serializes simultaneous starts; question snapshots,
-- exam configuration and all response rows are committed in one transaction.
CREATE OR REPLACE FUNCTION public.mtc_start_attempt(p_student_id uuid,p_question_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s students; cfg exam_config; a quiz_attempts; v_now timestamptz:=clock_timestamp(); n integer;
BEGIN
  SELECT * INTO s FROM students WHERE id=p_student_id FOR UPDATE;
  IF NOT FOUND OR NOT s.is_active THEN RAISE EXCEPTION 'Student account is unavailable'; END IF;
  SELECT * INTO a FROM quiz_attempts WHERE student_id=s.id AND status IN ('in_progress','blocked') ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN RETURN a.id; END IF;
  SELECT * INTO cfg FROM exam_config WHERE class=s.class FOR SHARE;
  IF NOT FOUND OR NOT cfg.is_open THEN RAISE EXCEPTION 'Exam window is closed'; END IF;
  SELECT count(*) INTO n FROM quiz_attempts WHERE student_id=s.id AND status IN ('submitted','graded');
  IF n >= cfg.max_attempts+s.extra_attempts THEN RAISE EXCEPTION 'No attempts remaining'; END IF;
  IF cfg.passing_score>cfg.total_questions OR cardinality(p_question_ids)<>cfg.total_questions OR
    (SELECT count(DISTINCT id) FROM questions WHERE id=ANY(p_question_ids) AND class=s.class AND is_active AND bank_generation>=2)<>cfg.total_questions THEN
    RAISE EXCEPTION 'The private question bank does not meet exam requirements';
  END IF;
  INSERT INTO quiz_attempts(student_id,class,started_at,total_questions,status,deadline_at,passing_score_snapshot,time_limit_minutes_snapshot,last_heartbeat_at)
  VALUES (s.id,s.class,v_now,cfg.total_questions,'in_progress',v_now+make_interval(mins=>cfg.time_limit_minutes),cfg.passing_score,cfg.time_limit_minutes,v_now) RETURNING * INTO a;
  INSERT INTO quiz_responses(attempt_id,question_id,question_order,question_snapshot)
  SELECT a.id,q.id,x.ord,jsonb_build_object('subject_tag',q.subject_tag,'difficulty',q.difficulty,'question_text',q.question_text,
    'option_a',q.option_a,'option_b',q.option_b,'option_c',q.option_c,'option_d',q.option_d,'correct_option',q.correct_option)
  FROM unnest(p_question_ids) WITH ORDINALITY x(id,ord) JOIN questions q ON q.id=x.id ORDER BY x.ord;
  RETURN a.id;
END $$;

-- Call only after locking/verifying the attempt in the public RPCs below.
CREATE OR REPLACE FUNCTION public.mtc_grade_locked(p_attempt_id uuid,p_responses jsonb DEFAULT NULL)
RETURNS public.quiz_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a quiz_attempts; correct integer;
BEGIN
  SELECT * INTO a FROM quiz_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR a.status<>'in_progress' THEN RETURN a; END IF;
  IF p_responses IS NOT NULL AND clock_timestamp() <= a.deadline_at + interval '30 seconds' THEN
    IF jsonb_typeof(p_responses)<>'array' OR jsonb_array_length(p_responses)>100 THEN RAISE EXCEPTION 'Invalid answers'; END IF;
    UPDATE quiz_responses r SET selected_option=CASE WHEN x.selected_option IN ('a','b','c','d') THEN x.selected_option ELSE NULL END
    FROM jsonb_to_recordset(p_responses) AS x(response_id uuid,selected_option text)
    WHERE r.id=x.response_id AND r.attempt_id=a.id;
  END IF;
  UPDATE quiz_responses SET is_correct=COALESCE(selected_option=question_snapshot->>'correct_option',false) WHERE attempt_id=a.id;
  SELECT count(*) INTO correct FROM quiz_responses WHERE attempt_id=a.id AND is_correct;
  UPDATE quiz_attempts SET submitted_at=clock_timestamp(),correct_count=correct,
    score_percentage=round(100.0*correct/GREATEST(total_questions,1),2),passed=(correct>=passing_score_snapshot),status='graded'
  WHERE id=a.id RETURNING * INTO a;
  RETURN a;
END $$;

CREATE OR REPLACE FUNCTION public.mtc_maintain_attempt(p_attempt_id uuid,p_student_id uuid DEFAULT NULL,p_touch boolean DEFAULT false)
RETURNS public.quiz_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a quiz_attempts; v_now timestamptz:=clock_timestamp();
BEGIN
  SELECT * INTO a FROM quiz_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR (p_student_id IS NOT NULL AND a.student_id<>p_student_id) THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF p_student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM students WHERE id=p_student_id AND is_active) THEN RAISE EXCEPTION 'Student account is unavailable'; END IF;
  IF a.status<>'in_progress' THEN RETURN a; END IF;
  IF a.last_heartbeat_at IS NOT NULL AND a.last_heartbeat_at + interval '60 seconds' < LEAST(v_now,a.deadline_at) THEN
    UPDATE quiz_attempts SET status='blocked',blocked_reason='heartbeat_timeout',blocked_at=v_now,
      remaining_seconds_when_blocked=GREATEST(0,ceil(extract(epoch FROM (deadline_at-(a.last_heartbeat_at+interval '60 seconds'))))::integer)
    WHERE id=a.id RETURNING * INTO a;
    INSERT INTO quiz_integrity_events(attempt_id,event_type) VALUES(a.id,'heartbeat_timeout');
    RETURN a;
  END IF;
  IF v_now > a.deadline_at + interval '30 seconds' THEN RETURN mtc_grade_locked(a.id,NULL); END IF;
  IF p_touch THEN UPDATE quiz_attempts SET last_heartbeat_at=v_now WHERE id=a.id RETURNING * INTO a; END IF;
  RETURN a;
END $$;

CREATE OR REPLACE FUNCTION public.mtc_record_integrity(p_attempt_id uuid,p_student_id uuid,p_event text)
RETURNS public.quiz_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a quiz_attempts; v_now timestamptz:=clock_timestamp(); should_block boolean;
BEGIN
  IF p_event NOT IN ('tab_hidden','fullscreen_exit','quit') THEN RAISE EXCEPTION 'Invalid event'; END IF;
  a:=mtc_maintain_attempt(p_attempt_id,p_student_id,false);
  IF a.status<>'in_progress' THEN RETURN a; END IF;
  should_block:=p_event<>'tab_hidden' OR a.tab_switch_warnings>=1;
  INSERT INTO quiz_integrity_events(attempt_id,event_type) VALUES(a.id,p_event);
  UPDATE quiz_attempts SET tab_switch_warnings=tab_switch_warnings+CASE WHEN p_event='tab_hidden' THEN 1 ELSE 0 END,
    status=CASE WHEN should_block THEN 'blocked' ELSE status END,
    blocked_reason=CASE WHEN should_block THEN p_event ELSE NULL END,
    blocked_at=CASE WHEN should_block THEN v_now ELSE NULL END,
    remaining_seconds_when_blocked=CASE WHEN should_block THEN GREATEST(0,ceil(extract(epoch FROM (deadline_at-v_now)))::integer) ELSE NULL END
  WHERE id=a.id RETURNING * INTO a;
  RETURN a;
END $$;

CREATE OR REPLACE FUNCTION public.mtc_save_responses(p_attempt_id uuid,p_student_id uuid,p_responses jsonb)
RETURNS public.quiz_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a quiz_attempts;
BEGIN
  a:=mtc_maintain_attempt(p_attempt_id,p_student_id,true);
  IF a.status<>'in_progress' THEN RETURN a; END IF;
  IF clock_timestamp()>a.deadline_at+interval '30 seconds' THEN RETURN mtc_grade_locked(a.id,NULL); END IF;
  IF jsonb_typeof(p_responses)<>'array' OR jsonb_array_length(p_responses)>100 THEN RAISE EXCEPTION 'Invalid answers'; END IF;
  UPDATE quiz_responses r SET selected_option=CASE WHEN x.selected_option IN ('a','b','c','d') THEN x.selected_option ELSE NULL END
    FROM jsonb_to_recordset(p_responses) AS x(response_id uuid,selected_option text) WHERE r.id=x.response_id AND r.attempt_id=a.id;
  RETURN a;
END $$;

CREATE OR REPLACE FUNCTION public.mtc_submit_attempt(p_attempt_id uuid,p_student_id uuid,p_responses jsonb)
RETURNS public.quiz_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a quiz_attempts;
BEGIN
  a:=mtc_maintain_attempt(p_attempt_id,p_student_id,true);
  IF a.status<>'in_progress' THEN RETURN a; END IF;
  RETURN mtc_grade_locked(a.id,p_responses);
END $$;

CREATE OR REPLACE FUNCTION public.mtc_unlock_attempt(p_attempt_id uuid,p_admin_id uuid)
RETURNS public.quiz_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a quiz_attempts;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admins WHERE id=p_admin_id AND is_active) THEN RAISE EXCEPTION 'Admin account is unavailable'; END IF;
  SELECT * INTO a FROM quiz_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR a.status<>'blocked' THEN RAISE EXCEPTION 'Attempt is not blocked'; END IF;
  UPDATE quiz_attempts SET status='in_progress',deadline_at=clock_timestamp()+make_interval(secs=>GREATEST(COALESCE(remaining_seconds_when_blocked,0),60)),
    last_heartbeat_at=clock_timestamp(),tab_switch_warnings=0,blocked_reason=NULL,blocked_at=NULL,remaining_seconds_when_blocked=NULL
  WHERE id=a.id RETURNING * INTO a;
  INSERT INTO quiz_integrity_events(attempt_id,event_type,actor_admin_id) VALUES(a.id,'unlocked',p_admin_id);
  RETURN a;
END $$;

CREATE OR REPLACE FUNCTION public.mtc_maintain_all()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record; n integer:=0;
BEGIN
  FOR r IN SELECT id FROM quiz_attempts WHERE status='in_progress' AND (deadline_at+interval '30 seconds'<clock_timestamp() OR last_heartbeat_at+interval '60 seconds'<LEAST(clock_timestamp(),deadline_at)) LOOP
    PERFORM mtc_maintain_attempt(r.id,NULL,false); n:=n+1;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.mtc_rate_limit(text,integer,integer), public.mtc_register_student(text,text,integer,text,text),
  public.mtc_start_attempt(uuid,uuid[]), public.mtc_grade_locked(uuid,jsonb), public.mtc_maintain_attempt(uuid,uuid,boolean),
  public.mtc_record_integrity(uuid,uuid,text), public.mtc_save_responses(uuid,uuid,jsonb), public.mtc_submit_attempt(uuid,uuid,jsonb),
  public.mtc_unlock_attempt(uuid,uuid), public.mtc_maintain_all() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mtc_rate_limit(text,integer,integer), public.mtc_register_student(text,text,integer,text,text),
  public.mtc_start_attempt(uuid,uuid[]), public.mtc_maintain_attempt(uuid,uuid,boolean), public.mtc_record_integrity(uuid,uuid,text),
  public.mtc_save_responses(uuid,uuid,jsonb), public.mtc_submit_attempt(uuid,uuid,jsonb), public.mtc_unlock_attempt(uuid,uuid), public.mtc_maintain_all() TO service_role;
COMMIT;
