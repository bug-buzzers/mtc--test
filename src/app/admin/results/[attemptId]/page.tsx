'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { formatSectionDisplay } from '@/lib/constants';
import { apiFetch } from '@/lib/client-api';
import { OptionKey, QuizAttempt } from '@/lib/types';
import {
  ArrowLeft,
  CheckCircle,
  MinusCircle,
  XCircle,
} from '@phosphor-icons/react';

interface AttemptReviewData {
  attempt: QuizAttempt;
  student: {
    id: string;
    roll_number: string;
    full_name: string;
    class: number;
    section: string;
  };
  items: Array<{
    question_number: number;
    question_id: string;
    subject_tag: string;
    difficulty: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: OptionKey;
    selected_option: OptionKey | null;
    is_correct: boolean;
  }>;
}

export default function AttemptDetailPage() {
  const params = useParams<{ attemptId: string }>();
  const [review, setReview] = useState<AttemptReviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AttemptReviewData>(`/api/admin/results/${params.attemptId}`).then(
      ({ ok, data }) => {
        if (ok && data.attempt) {
          setReview(data);
        }
        setLoading(false);
      }
    );
  }, [params.attemptId]);

  return (
    <AdminShell
      title="Answer sheet review"
      subtitle="Question-by-question comparison of student response and answer key"
      actions={
        <Link
          href="/admin/results"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] font-medium text-sm text-slate-700 transition"
        >
          <ArrowLeft size={15} weight="regular" />
          Back to results
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-4">
          <div className="h-28 rounded-[2rem] skeleton-shimmer" />
          <div className="h-48 rounded-[2rem] skeleton-shimmer" />
        </div>
      ) : !review ? (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200/70 text-rose-700 font-medium">
          Attempt record not found.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-200/70 shadow-diffusion flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
                {review.student.full_name}
              </h2>
              <p className="text-sm font-mono text-slate-600 mt-1 tabular-nums">
                Roll {review.student.roll_number} · Class {review.student.class}{' '}
                ({formatSectionDisplay(review.student.class, review.student.section)})
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Submitted:{' '}
                {review.attempt.submitted_at
                  ? new Date(review.attempt.submitted_at).toLocaleString('en-IN')
                  : 'In progress'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                  {review.attempt.correct_count ?? 0}/
                  {review.attempt.total_questions}
                </p>
                <p className="font-mono text-xs text-slate-500 tabular-nums">
                  {review.attempt.score_percentage ?? 0}% accuracy
                </p>
              </div>
              {review.attempt.passed ? (
                <span className="px-3.5 py-1.5 rounded-lg bg-forest-50 text-forest-600 font-medium text-xs">
                  Shortlisted
                </span>
              ) : (
                <span className="px-3.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 font-medium text-xs">
                  Not shortlisted
                </span>
              )}
            </div>
          </section>

          <div className="space-y-4">
            {review.items.map((item) => {
              const opts: Array<{
                key: OptionKey;
                label: string;
                text: string;
              }> = [
                { key: 'a', label: 'A', text: item.option_a },
                { key: 'b', label: 'B', text: item.option_b },
                { key: 'c', label: 'C', text: item.option_c },
                { key: 'd', label: 'D', text: item.option_d },
              ];

              return (
                <article
                  key={item.question_number}
                  className="bg-white rounded-[1.75rem] p-6 border border-slate-200/70 shadow-diffusion"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-xs px-2.5 py-1 rounded-md bg-slate-900 text-white tabular-nums">
                        Q{item.question_number}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                        {item.subject_tag}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 text-xs font-medium">
                        {item.difficulty}
                      </span>
                    </div>

                    {item.selected_option === null ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                        <MinusCircle size={15} weight="regular" />
                        Unanswered
                      </span>
                    ) : item.is_correct ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-forest-600">
                        <CheckCircle size={15} weight="regular" />
                        Correct
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                        <XCircle size={15} weight="regular" />
                        Incorrect
                      </span>
                    )}
                  </div>

                  <p className="font-medium text-slate-900 mb-4 max-w-[65ch]">
                    {item.question_text}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                    {opts.map((o) => {
                      const isCorrectOpt = item.correct_option === o.key;
                      const isStudentChoice = item.selected_option === o.key;

                      let boxStyle =
                        'bg-slate-50/70 border-slate-200 text-slate-700';
                      if (isCorrectOpt) {
                        boxStyle =
                          'bg-forest-50 border-forest-500/50 text-slate-900 font-medium';
                      } else if (isStudentChoice && !isCorrectOpt) {
                        boxStyle =
                          'bg-rose-50 border-rose-300 text-rose-900 font-medium';
                      }

                      return (
                        <div
                          key={o.key}
                          className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 ${boxStyle}`}
                        >
                          <span>
                            <strong className="font-mono">{o.label}.</strong>{' '}
                            {o.text}
                          </span>
                          <span className="text-xs font-medium shrink-0">
                            {isCorrectOpt && isStudentChoice
                              ? 'Selected · Correct'
                              : isCorrectOpt
                              ? 'Answer key'
                              : isStudentChoice
                              ? 'Selected'
                              : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
