export type Difficulty = 'easy' | 'medium' | 'hard';
export type OptionKey = 'a' | 'b' | 'c' | 'd';
export type AttemptStatus = 'in_progress' | 'blocked' | 'retired' | 'submitted' | 'graded';
export type IntegrityEventType = 'tab_hidden' | 'fullscreen_exit' | 'quit' | 'heartbeat_timeout' | 'unlocked';

export interface Student {
  id: string;
  roll_number: string;
  full_name: string;
  class: number;
  section: string;
  password_hash: string;
  is_active: boolean;
  password_reset_required: boolean;
  extra_attempts: number;
  created_at: string;
  updated_at: string;
}

export type SafeStudent = Omit<Student, 'password_hash'>;

export interface Admin {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  class: number;
  subject_tag: string;
  difficulty: Difficulty;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: OptionKey;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Stored with each response. Never return correct_option to a student before release.
export type QuestionSnapshot = Pick<Question, 'subject_tag' | 'difficulty' | 'question_text' | 'option_a' | 'option_b' | 'option_c' | 'option_d' | 'correct_option'>;

export interface StudentFacingQuestion {
  response_id: string;
  question_number: number;
  subject_tag: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  selected_option: OptionKey | null;
}

export interface ExamConfig {
  id: string;
  class: number;
  is_open: boolean;
  total_questions: number;
  time_limit_minutes: number;
  passing_score: number;
  max_attempts: number;
  show_results_to_students: boolean;
  updated_at: string;
}

export interface QuizAttempt {
  id: string;
  student_id: string;
  class: number;
  started_at: string;
  submitted_at: string | null;
  total_questions: number;
  correct_count: number | null;
  score_percentage: number | null;
  passed: boolean | null;
  status: AttemptStatus;
  deadline_at: string;
  passing_score_snapshot: number;
  time_limit_minutes_snapshot: number;
  last_heartbeat_at: string | null;
  tab_switch_warnings: number;
  blocked_reason: string | null;
  blocked_at: string | null;
  remaining_seconds_when_blocked: number | null;
}

export interface StudentAttemptHistoryItem {
  id: string;
  class: number;
  started_at: string;
  submitted_at: string | null;
  total_questions: number;
  status: 'in_progress' | 'blocked' | 'retired' | 'submitted';
  can_view_result?: boolean;
  correct_count?: number | null;
  score_percentage?: number | null;
  passed?: boolean | null;
}

export interface QuizResponse {
  id: string;
  attempt_id: string;
  question_id: string;
  question_order: number;
  selected_option: OptionKey | null;
  is_correct: boolean | null;
  question_snapshot: QuestionSnapshot | null;
}

export interface AuthTokenPayload {
  sub: string;
  sid: string;
  role: 'student' | 'admin';
  name: string;
  class?: number;
  section?: string;
  roll_number?: string;
  username?: string;
}

export interface AuthSession {
  id: string;
  user_id: string;
  role: 'student' | 'admin';
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface StudentInvite {
  id: string;
  code_hash: string;
  roll_number: string;
  class: number;
  section: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface IntegrityEvent {
  id: string;
  attempt_id: string;
  event_type: IntegrityEventType;
  created_at: string;
  actor_admin_id: string | null;
}
