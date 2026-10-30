'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MaplesLogo from '@/components/MaplesLogo';
import { formatSectionDisplay } from '@/lib/constants';
import { apiFetch, clearClientSession } from '@/lib/client-api';
import { StudentAttemptHistoryItem } from '@/lib/types';
import {
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  Clock,
  ListChecks,
  Play,
  Shuffle,
  SignOut,
} from '@phosphor-icons/react';

interface QuizStatusResponse {
  error?: string;
  student?: {
    id: string;
    full_name: string;
    roll_number: string;
    class: number;
    section: string;
  };
  exam?: {
    is_open: boolean;
    total_questions: number;
    questions_in_bank?: number;
    time_limit_minutes: number;
    show_results_to_students?: boolean;
    has_active_attempt: boolean;
    active_attempt_id: string | null;
    can_start_new_attempt: boolean;
    completed_attempts_count: number;
    max_attempts: number;
  };
  history?: StudentAttemptHistoryItem[];
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<QuizStatusResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { ok, status, data } = await apiFetch<QuizStatusResponse>(
        '/api/quiz/status'
      );
      if (!mounted) return;
      if (!ok || status === 401 || status === 403 || !data.student) {
        clearClientSession();
        router.replace('/student/login');
        return;
      }
      setStatusData(data);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    clearClientSession();
    router.push('/student/login');
  };

  if (loading || !statusData?.student || !statusData?.exam) {
    return (
      <div className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col">
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 h-16" />
        <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 space-y-3">
            <div className="h-4 w-32 rounded skeleton-shimmer" />
            <div className="h-8 w-64 rounded-lg skeleton-shimmer" />
            <div className="flex gap-2 pt-2">
              <div className="h-7 w-24 rounded-lg skeleton-shimmer" />
              <div className="h-7 w-28 rounded-lg skeleton-shimmer" />
            </div>
          </div>
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 space-y-4">
            <div className="h-6 w-48 rounded-lg skeleton-shimmer" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-20 rounded-2xl skeleton-shimmer" />
              <div className="h-20 rounded-2xl skeleton-shimmer" />
              <div className="h-20 rounded-2xl skeleton-shimmer" />
            </div>
            <div className="h-12 w-44 rounded-xl skeleton-shimmer" />
          </div>
        </main>
      </div>
    );
  }

  const { student, exam, history = [] } = statusData;
  const completedHistory = history.filter((h) => h.status === 'submitted');
  const latestCompleted = completedHistory[0] || null;

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-glass">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <MaplesLogo size="sm" showBadge />
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-medium text-sm transition duration-200"
          >
            <SignOut size={16} weight="regular" />
            Sign out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main
        id="main-content"
        className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 animate-fade-in"
      >
        {/* Student Identity Header */}
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200/80">
          <div>
            <p className="font-mono text-xs font-medium text-maple-600 tracking-wider">
              Student dashboard
            </p>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              {student.full_name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200/80 text-slate-700 font-mono tabular-nums">
              Roll {student.roll_number}
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200/80 text-slate-700">
              Class {student.class}
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-maple-100/70 text-maple-700">
              {formatSectionDisplay(student.class, student.section)}
            </span>
          </div>
        </section>

        {/* Primary Quiz Status Container */}
        <section className="bg-white rounded-[2.5rem] p-8 sm:p-10 border border-slate-200/60 shadow-diffusion">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              Class {student.class} entrance quiz
            </h2>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              Attempt {exam.completed_attempts_count} / {exam.max_attempts}
            </span>
          </div>

          {exam.has_active_attempt ? (
            <div className="rounded-2xl bg-maple-100/45 border border-maple-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Your quiz session is active
                </h3>
                <p className="text-sm text-slate-600 mt-1 max-w-[50ch]">
                  Your selected answers are saved. Resume where you left off
                  before the timer closes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/student/quiz')}
                className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-maple-500 hover:bg-maple-600 active:scale-[0.98] text-white font-medium text-sm flex items-center justify-center gap-2 shrink-0 transition duration-200"
              >
                <Play size={16} weight="fill" />
                Resume quiz
              </button>
            </div>
          ) : exam.completed_attempts_count >= exam.max_attempts ? (
            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-forest-600 mb-2">
                    <CheckCircle size={16} weight="regular" />
                    Submission recorded
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    You have completed your Class {student.class} quiz.
                  </h3>

                  {exam.show_results_to_students &&
                  latestCompleted?.can_view_result ? (
                    <p className="text-sm text-slate-600 mt-1.5 max-w-[52ch]">
                      Your coordinator has enabled result review. Inspect your
                      score and question-by-question answer key.
                    </p>
                  ) : (
                    <p className="text-sm text-slate-600 mt-1.5 max-w-[52ch]">
                      Once your coordinator enables result visibility for Class{' '}
                      {student.class}, your score and question-wise answer
                      review will appear here.
                    </p>
                  )}
                </div>

                {exam.show_results_to_students &&
                  latestCompleted?.can_view_result && (
                    <div className="flex flex-col sm:items-end gap-3 shrink-0">
                      <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                        {latestCompleted.correct_count}/
                        {latestCompleted.total_questions}{' '}
                        <span className="text-sm font-normal text-slate-500">
                          ({latestCompleted.score_percentage}%)
                        </span>
                      </div>
                      <Link
                        href={`/student/result/${latestCompleted.id}`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-sm transition duration-200"
                      >
                        <ListChecks size={17} weight="regular" />
                        View question-wise result
                      </Link>
                    </div>
                  )}
              </div>
            </div>
          ) : !exam.is_open ? (
            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-slate-900">
                The Class {student.class} quiz window is currently closed.
              </h3>
              <p className="text-sm text-slate-600 mt-1.5 max-w-[52ch]">
                Check back when your teacher opens the session for your class.
              </p>
            </div>
          ) : (
            <div className="space-y-7">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/70">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span>Questions</span>
                    <ListChecks size={16} weight="regular" />
                  </div>
                  <p className="mt-2 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                    {exam.total_questions} MCQs
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/70">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span>Time limit</span>
                    <Clock size={16} weight="regular" />
                  </div>
                  <p className="mt-2 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                    {exam.time_limit_minutes} min
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/70">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span>Random bank</span>
                    <Shuffle size={16} weight="regular" />
                  </div>
                  <p className="mt-2 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                    {exam.questions_in_bank || 108} Qs
                  </p>
                </div>
              </div>

              <div className="text-sm text-slate-600 space-y-1.5 border-l-2 border-maple-500 pl-4 max-w-[62ch]">
                <p>
                  Questions cover everyday computer basics — shortcuts,
                  hardware, apps, web browsing, networking, and online ethics.
                </p>
                <p>
                  There is no negative marking, and you can move back and forth
                  between questions freely before submitting.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => router.push('/student/quiz')}
                  className="w-full sm:w-auto min-h-[50px] px-7 py-3.5 rounded-xl bg-maple-500 hover:bg-maple-600 active:scale-[0.98] text-white font-medium text-sm sm:text-base inline-flex items-center justify-center gap-2.5 shadow-diffusion transition duration-200"
                >
                  <span>Begin Class {student.class} quiz</span>
                  <ArrowRight size={17} weight="regular" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Past Quiz Activity (Clean Divide-Y List, No Box Clutter) */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <CalendarBlank size={17} weight="regular" className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">
              Submission history
            </h2>
          </div>

          {completedHistory.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/70 text-sm text-slate-500">
              No completed attempts yet. Once you submit your quiz, the
              timestamp will appear here.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/70 divide-y divide-slate-100">
              {completedHistory.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-slate-900 text-sm sm:text-base">
                      Class {item.class} entrance quiz · Attempt{' '}
                      <span className="font-mono tabular-nums">
                        #{completedHistory.length - idx}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Submitted{' '}
                      {new Date(
                        item.submitted_at || item.started_at
                      ).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {item.can_view_result ? (
                      <>
                        <span className="font-mono text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 tabular-nums">
                          {item.correct_count}/{item.total_questions} (
                          {item.score_percentage}%)
                        </span>
                        <Link
                          href={`/student/result/${item.id}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-xs transition duration-200"
                        >
                          <ListChecks size={14} weight="regular" />
                          Question-wise review
                        </Link>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-forest-50 text-forest-600 font-medium text-xs">
                        <CheckCircle size={14} weight="regular" />
                        Recorded
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
