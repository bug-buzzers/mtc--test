'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import MaplesLogo from '@/components/MaplesLogo';
import { formatSectionDisplay } from '@/lib/constants';
import { apiFetch, clearClientSession } from '@/lib/client-api';
import { OptionKey } from '@/lib/types';
import {
  ArrowLeft,
  CheckCircle,
  LockSimple,
  MinusCircle,
  XCircle,
} from '@phosphor-icons/react';

interface QuestionReviewItem {
  question_number: number;
  subject_tag: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  selected_option: OptionKey | null;
  correct_option: OptionKey;
  is_correct: boolean;
}

interface StudentResultPayload {
  error?: string;
  attempt?: {
    id: string;
    class: number;
    started_at: string;
    submitted_at: string | null;
    total_questions: number;
    correct_count: number;
    score_percentage: number;
    passed: boolean;
    passing_score: number;
  };
  student?: {
    id: string;
    roll_number: string;
    full_name: string;
    class: number;
    section: string;
  };
  items?: QuestionReviewItem[];
}

type FilterMode = 'all' | 'correct' | 'wrong' | 'skipped';

export default function StudentQuestionWiseResultPage() {
  const params = useParams<{ attemptId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [lockedMessage, setLockedMessage] = useState('');
  const [resultData, setResultData] = useState<StudentResultPayload | null>(
    null
  );
  const [filter, setFilter] = useState<FilterMode>('all');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { ok, status, data } = await apiFetch<StudentResultPayload>(
        `/api/quiz/result/${params.attemptId}`
      );
      if (!mounted) return;
      if (status === 401) {
        clearClientSession();
        router.replace('/student/login');
        return;
      }
      if (!ok || status === 403) {
        setLockedMessage(
          data.error ||
            'Question-wise results have not been released by your teacher yet.'
        );
        setLoading(false);
        return;
      }
      setResultData(data);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [params.attemptId, router]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col">
        <header className="h-16 bg-white/80 border-b border-slate-200/60" />
        <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 space-y-4">
            <div className="h-4 w-40 rounded skeleton-shimmer" />
            <div className="h-8 w-60 rounded-lg skeleton-shimmer" />
            <div className="h-10 w-full rounded-xl skeleton-shimmer" />
          </div>
          <div className="bg-white rounded-[2rem] p-8 border border-slate-200/60 h-56 skeleton-shimmer" />
        </main>
      </div>
    );
  }

  if (lockedMessage || !resultData?.attempt || !resultData?.student) {
    return (
      <main
        id="main-content"
        className="min-h-[100dvh] bg-[#F9FAFB] flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full border border-slate-200/70 shadow-diffusion">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mb-5">
            <LockSimple size={22} weight="regular" />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
            Results not released yet
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
            {lockedMessage}
          </p>
          <div className="mt-6">
            <Link
              href="/student/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-sm transition duration-200"
            >
              <ArrowLeft size={16} weight="regular" />
              Return to dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { attempt, student, items = [] } = resultData;
  const correctCount = items.filter((i) => i.is_correct).length;
  const skippedCount = items.filter((i) => !i.selected_option).length;
  const wrongCount = items.length - correctCount - skippedCount;

  const filteredItems = items.filter((i) => {
    if (filter === 'correct') return i.is_correct;
    if (filter === 'wrong') return Boolean(i.selected_option) && !i.is_correct;
    if (filter === 'skipped') return !i.selected_option;
    return true;
  });

  const optionRows: Array<{ key: OptionKey; label: string }> = [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' },
    { key: 'c', label: 'C' },
    { key: 'd', label: 'D' },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-glass">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <MaplesLogo size="sm" showBadge />
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-medium text-sm transition duration-200"
          >
            <ArrowLeft size={16} weight="regular" />
            Dashboard
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in"
      >
        {/* Summary Card */}
        <section className="bg-white rounded-[2.5rem] p-7 sm:p-10 border border-slate-200/60 shadow-diffusion">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 pb-6 border-b border-slate-100">
            <div>
              <p className="font-mono text-xs font-medium text-maple-600 tracking-wider">
                Question-wise review · Class {attempt.class}
              </p>
              <h1 className="mt-1.5 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
                {student.full_name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-mono tabular-nums">
                Roll {student.roll_number} · Class {student.class} (
                {formatSectionDisplay(student.class, student.section)})
              </p>
            </div>

            <div className="flex items-baseline gap-4">
              <div>
                <p className="text-xs text-slate-500">Total score</p>
                <p className="font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                  {attempt.correct_count}/{attempt.total_questions}{' '}
                  <span className="text-sm font-normal text-slate-500">
                    ({attempt.score_percentage}%)
                  </span>
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-medium ${
                  attempt.passed
                    ? 'bg-forest-50 text-forest-600'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {attempt.passed ? 'Shortlisted' : 'Open track'}
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition active:scale-[0.98] ${
                  filter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('correct')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition active:scale-[0.98] ${
                  filter === 'correct'
                    ? 'bg-forest-600 text-white'
                    : 'bg-forest-50 text-forest-600 hover:bg-forest-100'
                }`}
              >
                Correct ({correctCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('wrong')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition active:scale-[0.98] ${
                  filter === 'wrong'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Incorrect ({wrongCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('skipped')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition active:scale-[0.98] ${
                  filter === 'skipped'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                Unanswered ({skippedCount})
              </button>
            </div>

            <p className="font-mono text-xs text-slate-500 tabular-nums">
              Qualifying mark: {attempt.passing_score}/{attempt.total_questions}
            </p>
          </div>
        </section>

        {/* Question-by-Question Review */}
        <section className="space-y-4">
          {filteredItems.map((item) => {
            const isSkipped = !item.selected_option;
            const optionTextMap: Record<OptionKey, string> = {
              a: item.option_a,
              b: item.option_b,
              c: item.option_c,
              d: item.option_d,
            };

            return (
              <article
                key={item.question_number}
                className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-200/60 shadow-diffusion"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-900 text-white tabular-nums">
                      Q{item.question_number}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium text-xs">
                      {item.subject_tag}
                    </span>
                  </div>

                  {item.is_correct ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-forest-50 text-forest-600 font-medium text-xs">
                      <CheckCircle size={14} weight="regular" />
                      Correct (+1)
                    </span>
                  ) : isSkipped ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium text-xs">
                      <MinusCircle size={14} weight="regular" />
                      Unanswered (0)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-medium text-xs">
                      <XCircle size={14} weight="regular" />
                      Incorrect (0)
                    </span>
                  )}
                </div>

                <h2 className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed mb-5 max-w-[65ch]">
                  {item.question_text}
                </h2>

                <div className="grid grid-cols-1 gap-2.5">
                  {optionRows.map(({ key, label }) => {
                    const isCorrectOpt = item.correct_option === key;
                    const isSelectedOpt = item.selected_option === key;

                    let cardStyle =
                      'bg-slate-50/60 border-slate-200/80 text-slate-700';
                    if (isCorrectOpt) {
                      cardStyle =
                        'bg-forest-50 border-forest-500/50 text-slate-900';
                    } else if (isSelectedOpt && !isCorrectOpt) {
                      cardStyle = 'bg-rose-50 border-rose-300 text-rose-900';
                    }

                    return (
                      <div
                        key={key}
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${cardStyle}`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`w-7 h-7 rounded-lg font-mono font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                              isCorrectOpt
                                ? 'bg-forest-600 text-white'
                                : isSelectedOpt
                                ? 'bg-rose-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600'
                            }`}
                          >
                            {label}
                          </span>
                          <span className="text-sm sm:text-base font-medium">
                            {optionTextMap[key]}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          {isSelectedOpt && isCorrectOpt && (
                            <span className="px-2.5 py-1 rounded-md bg-forest-600 text-white text-xs font-medium">
                              Your answer · Correct
                            </span>
                          )}
                          {isSelectedOpt && !isCorrectOpt && (
                            <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-xs font-medium">
                              Your answer
                            </span>
                          )}
                          {!isSelectedOpt && isCorrectOpt && (
                            <span className="px-2.5 py-1 rounded-md bg-white border border-forest-500/40 text-forest-600 text-xs font-medium">
                              Correct answer
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
