'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MaplesLogo from '@/components/MaplesLogo';
import { apiFetch } from '@/lib/client-api';
import { OptionKey, StudentFacingQuestion } from '@/lib/types';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  PaperPlaneTilt,
  WarningCircle,
} from '@phosphor-icons/react';

interface StartQuizResponse {
  error?: string;
  attempt_id?: string;
  class?: number;
  started_at?: string;
  time_limit_minutes?: number;
  remaining_seconds?: number;
  questions?: StudentFacingQuestion[];
}

export default function StudentQuizPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState('');
  const [attemptId, setAttemptId] = useState('');
  const [examClass, setExamClass] = useState<number>(8);
  const [questions, setQuestions] = useState<StudentFacingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, OptionKey | null>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1800);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submittingRef = useRef(false);
  const answersRef = useRef<Record<string, OptionKey | null>>({});
  answersRef.current = answers;

  const submitExamNow = useCallback(
    async (isAutoSubmit = false) => {
      if (submittingRef.current || !attemptId) return;
      submittingRef.current = true;
      setSubmitting(true);
      setShowConfirmModal(false);

      const payloadResponses = questions.map((q) => ({
        response_id: q.response_id,
        selected_option: answersRef.current[q.response_id] ?? null,
      }));

      await apiFetch('/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({
          attempt_id: attemptId,
          responses: payloadResponses,
        }),
      });

      router.replace(
        isAutoSubmit ? '/student/submitted?auto=1' : '/student/submitted'
      );
    },
    [attemptId, questions, router]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { ok, status, data } = await apiFetch<StartQuizResponse>(
        '/api/quiz/start',
        { method: 'POST' }
      );
      if (!mounted) return;
      if (status === 401) {
        router.replace('/student/login');
        return;
      }
      if (!ok || !data.attempt_id || !data.questions) {
        setInitError(data.error || 'We could not load your quiz paper.');
        setLoading(false);
        return;
      }

      setAttemptId(data.attempt_id);
      setExamClass(data.class || 8);
      setQuestions(data.questions);

      const initialAnswers: Record<string, OptionKey | null> = {};
      for (const q of data.questions) {
        initialAnswers[q.response_id] = q.selected_option ?? null;
      }
      setAnswers(initialAnswers);
      setRemainingSeconds(
        typeof data.remaining_seconds === 'number'
          ? data.remaining_seconds
          : (data.time_limit_minutes || 30) * 60
      );
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!attemptId || loading) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submittingRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      if (!submittingRef.current) {
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [attemptId, loading]);

  useEffect(() => {
    if (!attemptId || loading) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          submitExamNow(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [attemptId, loading, submitExamNow]);

  const saveOption = (responseId: string, option: OptionKey | null) => {
    setAnswers((prev) => ({
      ...prev,
      [responseId]: option,
    }));

    if (attemptId) {
      apiFetch('/api/quiz/save', {
        method: 'PATCH',
        body: JSON.stringify({
          attempt_id: attemptId,
          responses: [{ response_id: responseId, selected_option: option }],
        }),
      }).catch(() => {
        // Silent retry on next click or final submit
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col">
        <header className="h-16 bg-white/80 border-b border-slate-200/60" />
        <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 space-y-5">
            <div className="flex justify-between">
              <div className="h-4 w-32 rounded skeleton-shimmer" />
              <div className="h-6 w-28 rounded-lg skeleton-shimmer" />
            </div>
            <div className="h-20 w-full rounded-2xl skeleton-shimmer" />
            <div className="space-y-3">
              <div className="h-14 w-full rounded-2xl skeleton-shimmer" />
              <div className="h-14 w-full rounded-2xl skeleton-shimmer" />
              <div className="h-14 w-full rounded-2xl skeleton-shimmer" />
              <div className="h-14 w-full rounded-2xl skeleton-shimmer" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (initError) {
    return (
      <main
        id="main-content"
        className="min-h-[100dvh] bg-[#F9FAFB] flex items-center justify-center p-6"
      >
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/70 shadow-diffusion max-w-md w-full">
          <WarningCircle size={28} weight="regular" className="text-maple-600 mb-3" />
          <h1 className="text-xl font-semibold text-slate-900">{initError}</h1>
          <button
            type="button"
            onClick={() => router.push('/student/dashboard')}
            className="mt-6 min-h-[46px] px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-sm transition duration-200"
          >
            Return to dashboard
          </button>
        </div>
      </main>
    );
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((q) =>
    Boolean(answers[q.response_id])
  ).length;
  const unansweredCount = questions.length - answeredCount;
  const progressPct = Math.round((answeredCount / questions.length) * 100);

  const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const secs = String(remainingSeconds % 60).padStart(2, '0');
  const isLowTime = remainingSeconds <= 300;

  const optionItems: Array<{ key: OptionKey; label: string; text: string }> = [
    { key: 'a', label: 'A', text: currentQuestion.option_a },
    { key: 'b', label: 'B', text: currentQuestion.option_b },
    { key: 'c', label: 'C', text: currentQuestion.option_c },
    { key: 'd', label: 'D', text: currentQuestion.option_d },
  ];

  const selectedForCurrent = answers[currentQuestion.response_id] ?? null;

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col">
      {/* Top Sticky Exam Bar */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/60 shadow-glass">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <MaplesLogo size="sm" />
            <div className="min-w-0 border-l border-slate-200 pl-3">
              <p className="text-xs text-slate-500 truncate">
                Maples Tech Club
              </p>
              <p className="text-sm font-semibold text-slate-900 truncate">
                Class {examClass} entrance quiz
              </p>
            </div>
          </div>

          <div
            className={`px-3.5 py-2 rounded-xl border font-mono font-semibold text-sm sm:text-base flex items-center gap-2 tabular-nums shrink-0 transition ${
              isLowTime
                ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <Clock
              size={18}
              weight="regular"
              className={isLowTime ? 'text-rose-600' : 'text-maple-600'}
            />
            <span>
              {mins}:{secs}
            </span>
          </div>
        </div>

        {/* Subtle Progress Line */}
        <div className="w-full h-1 bg-slate-100">
          <div
            className="h-full bg-maple-500 transition-transform duration-300 origin-left"
            style={{ transform: `scaleX(${progressPct / 100})` }}
          />
        </div>
      </header>

      {/* Main Quiz Body */}
      <main
        id="main-content"
        className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6"
      >
        <section
          key={currentQuestion.response_id}
          className="bg-white rounded-[2.5rem] p-6 sm:p-10 border border-slate-200/60 shadow-diffusion animate-fade-in"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-5 mb-6 border-b border-slate-100">
            <span className="font-mono text-xs sm:text-sm font-medium text-maple-600 tabular-nums">
              Question {currentIndex + 1} / {questions.length}
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-100 text-xs font-medium text-slate-600">
              {currentQuestion.subject_tag}
            </span>
          </div>

          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 leading-relaxed mb-7 max-w-[65ch]">
            {currentQuestion.question_text}
          </h1>

          {/* 4 Option Buttons */}
          <div className="space-y-3">
            {optionItems.map((opt) => {
              const isSelected = selectedForCurrent === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    saveOption(currentQuestion.response_id, opt.key)
                  }
                  className={`w-full min-h-[56px] p-4 rounded-2xl border text-left flex items-center gap-4 transition duration-200 active:scale-[0.99] ${
                    isSelected
                      ? 'border-maple-500 bg-maple-100/45 ring-1 ring-maple-500/30'
                      : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-lg font-mono font-semibold text-sm flex items-center justify-center shrink-0 transition ${
                      isSelected
                        ? 'bg-maple-500 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="text-sm sm:text-base font-medium text-slate-800 flex-1">
                    {opt.text}
                  </span>
                  {isSelected && (
                    <span className="w-6 h-6 rounded-full bg-maple-500 text-white flex items-center justify-center shrink-0">
                      <Check size={13} weight="bold" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedForCurrent && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => saveOption(currentQuestion.response_id, null)}
                className="text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors"
              >
                Clear selected choice
              </button>
            </div>
          )}

          {/* Previous / Next Controls */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="min-h-[46px] px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40 font-medium text-slate-700 text-sm flex items-center gap-2 transition duration-200"
            >
              <ArrowLeft size={16} weight="regular" />
              Previous
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
                }
                className="min-h-[46px] px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-sm flex items-center gap-2 transition duration-200"
              >
                Next
                <ArrowRight size={16} weight="regular" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="min-h-[46px] px-6 py-2.5 rounded-xl bg-maple-500 hover:bg-maple-600 active:scale-[0.98] text-white font-medium text-sm flex items-center gap-2 transition duration-200"
              >
                <PaperPlaneTilt size={16} weight="regular" />
                Review &amp; submit
              </button>
            )}
          </div>
        </section>

        {/* Question Navigator */}
        <section className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-200/60 shadow-diffusion">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Question navigator{' '}
              <span className="font-mono font-normal text-slate-500 tabular-nums">
                ({answeredCount}/{questions.length} answered)
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-900 inline-block" />
                Current
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-maple-200 inline-block" />
                Answered
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block" />
                Unanswered
              </span>
            </div>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered = Boolean(answers[q.response_id]);
              return (
                <button
                  key={q.response_id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-10 rounded-xl font-mono text-xs font-medium tabular-nums flex items-center justify-center transition duration-150 active:scale-[0.96] ${
                    isCurrent
                      ? 'bg-slate-900 text-white'
                      : isAnswered
                      ? 'bg-maple-100 text-maple-700 border border-maple-200 hover:bg-maple-200/70'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowConfirmModal(true)}
              className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-maple-500 hover:bg-maple-600 active:scale-[0.98] disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-2 transition duration-200"
            >
              <PaperPlaneTilt size={16} weight="regular" />
              Submit quiz
            </button>
          </div>
        </section>
      </main>

      {/* Confirmation Dialog */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-[2rem] p-7 sm:p-8 max-w-md w-full border border-slate-200 shadow-diffusion animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  unansweredCount > 0
                    ? 'bg-maple-100 text-maple-600'
                    : 'bg-forest-50 text-forest-600'
                }`}
              >
                {unansweredCount > 0 ? (
                  <WarningCircle size={22} weight="regular" />
                ) : (
                  <Check size={20} weight="bold" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Submit your quiz?
                </h3>
                <p className="font-mono text-xs text-slate-500 tabular-nums">
                  {answeredCount} of {questions.length} answered
                </p>
              </div>
            </div>

            {unansweredCount > 0 ? (
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 leading-relaxed">
                You still have{' '}
                <strong className="text-slate-900 font-semibold">
                  {unansweredCount} unanswered{' '}
                  {unansweredCount === 1 ? 'question' : 'questions'}
                </strong>
                . There is no negative marking if you would like to attempt them
                first.
              </p>
            ) : (
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 leading-relaxed">
                You have answered all {questions.length} questions. Once
                submitted, responses are locked.
              </p>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-[0.98] font-medium text-slate-700 text-sm transition duration-200"
              >
                Review answers
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => submitExamNow(false)}
                className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-sm transition duration-200"
              >
                {submitting ? 'Submitting...' : 'Confirm submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
