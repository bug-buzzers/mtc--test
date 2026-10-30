'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import MaplesLogo from '@/components/MaplesLogo';
import { apiFetch } from '@/lib/client-api';
import { StudentAttemptHistoryItem } from '@/lib/types';
import { ArrowLeft, CheckCircle, Clock, ListChecks } from '@phosphor-icons/react';

function SubmittedCard() {
  const searchParams = useSearchParams();
  const autoSubmitted = searchParams.get('auto') === '1';
  const [releasedAttempt, setReleasedAttempt] =
    useState<StudentAttemptHistoryItem | null>(null);

  useEffect(() => {
    apiFetch<{
      exam?: { show_results_to_students?: boolean };
      history?: StudentAttemptHistoryItem[];
    }>('/api/quiz/status').then(({ ok, data }) => {
      if (ok && data.exam?.show_results_to_students && data.history) {
        const latest = data.history.find(
          (h) => h.status === 'submitted' && h.can_view_result
        );
        if (latest) setReleasedAttempt(latest);
      }
    });
  }, []);

  return (
    <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 max-w-lg w-full border border-slate-200/70 shadow-diffusion animate-fade-in">
      <MaplesLogo size="sm" />

      <div className="mt-6 w-12 h-12 rounded-2xl bg-forest-50 text-forest-600 flex items-center justify-center">
        <CheckCircle size={26} weight="regular" />
      </div>

      <h1 className="mt-5 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
        Your quiz has been submitted.
      </h1>

      {autoSubmitted && (
        <div className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg px-3 py-1.5">
          <Clock size={14} weight="regular" className="text-maple-600" />
          <span>Time limit reached — saved responses were submitted automatically.</span>
        </div>
      )}

      {releasedAttempt ? (
        <div className="mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <p className="text-xs font-medium text-maple-600">
            Result released by coordinator
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {releasedAttempt.correct_count}/{releasedAttempt.total_questions}{' '}
            <span className="text-sm font-normal text-slate-500">
              ({releasedAttempt.score_percentage}%)
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Open your question-wise answer review below.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-[46ch]">
          Your responses have been stored securely. Shortlist notices are
          published by Maples Academy, Khatauli, and question-wise review
          becomes available on your dashboard once enabled by the coordinator.
        </p>
      )}

      <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {releasedAttempt && (
          <Link
            href={`/student/result/${releasedAttempt.id}`}
            className="inline-flex min-h-[48px] px-5 py-3 rounded-xl bg-maple-500 hover:bg-maple-600 active:scale-[0.98] text-white font-medium text-sm items-center justify-center gap-2 transition duration-200"
          >
            <ListChecks size={17} weight="regular" />
            View question-wise result
          </Link>
        )}

        <Link
          href="/student/dashboard"
          className="inline-flex min-h-[48px] px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-sm items-center justify-center gap-2 transition duration-200"
        >
          <ArrowLeft size={16} weight="regular" />
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}

export default function StudentSubmittedPage() {
  return (
    <main
      id="main-content"
      className="min-h-[100dvh] bg-[#F9FAFB] flex items-center justify-center p-4"
    >
      <Suspense
        fallback={
          <div className="w-full max-w-lg bg-white rounded-[2.5rem] p-8 border border-slate-200/70 space-y-4">
            <div className="h-8 w-36 rounded-lg skeleton-shimmer" />
            <div className="h-8 w-64 rounded-lg skeleton-shimmer" />
            <div className="h-16 w-full rounded-2xl skeleton-shimmer" />
          </div>
        }
      >
        <SubmittedCard />
      </Suspense>
    </main>
  );
}
