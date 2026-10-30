'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import { apiFetch } from '@/lib/client-api';
import {
  CheckCircle,
  Clock,
  TrendUp,
  WarningCircle,
} from '@phosphor-icons/react';

interface AnalyticsResponse {
  totals: {
    completed_attempts: number;
    in_progress_attempts: number;
    passed_students: number;
    overall_pass_rate: number;
    completion_rate: number;
    avg_duration_minutes: number;
  };
  class_breakdown: Array<{
    class: number;
    attempts_count: number;
    passed_count: number;
    pass_rate: number;
    avg_score_percentage: number;
    avg_correct: number;
  }>;
  hardest_questions: Array<{
    question_id: string;
    class: number;
    subject_tag: string;
    difficulty: string;
    question_text: string;
    correct_option: string;
    attempts: number;
    correct: number;
    accuracy_pct: number;
    most_common_wrong_option: string | null;
    most_common_wrong_text: string | null;
  }>;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AnalyticsResponse>('/api/admin/analytics').then(({ ok, data }) => {
      if (ok) setData(data);
      setLoading(false);
    });
  }, []);

  return (
    <AdminShell
      title="Performance analytics"
      subtitle="Class-wise pass rates, average scores, completion times, and frequently missed questions"
    >
      {loading || !data ? (
        <div className="space-y-6">
          <div className="h-28 rounded-[2rem] skeleton-shimmer" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 rounded-[2rem] skeleton-shimmer" />
            <div className="h-64 rounded-[2rem] skeleton-shimmer" />
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Unified Divide-X Metric Strip (Avoids 3-Column Card Cliché) */}
          <section className="bg-white rounded-[2rem] border border-slate-200/70 shadow-diffusion grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            <div className="p-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Overall pass rate
                </p>
                <p className="mt-2 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                  {data.totals.overall_pass_rate}%
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                  {data.totals.passed_students} of{' '}
                  {data.totals.completed_attempts} shortlisted
                </p>
              </div>
              <TrendUp size={20} weight="regular" className="text-forest-600" />
            </div>

            <div className="p-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Completion rate
                </p>
                <p className="mt-2 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                  {data.totals.completion_rate}%
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                  {data.totals.in_progress_attempts} active right now
                </p>
              </div>
              <CheckCircle size={20} weight="regular" className="text-slate-700" />
            </div>

            <div className="p-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Mean completion time
                </p>
                <p className="mt-2 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                  {data.totals.avg_duration_minutes} min
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Within 30-minute standard window
                </p>
              </div>
              <Clock size={20} weight="regular" className="text-maple-600" />
            </div>
          </section>

          {/* 2-Column Class Distributions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white rounded-[2rem] p-7 border border-slate-200/70 shadow-diffusion">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                Pass rate by class
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 mb-6">
                Share of submitted attempts meeting the qualifying score
              </p>

              <div className="space-y-4">
                {data.class_breakdown.map((row) => (
                  <div key={row.class}>
                    <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                      <span className="text-slate-700">
                        Class {row.class}{' '}
                        <span className="font-mono text-slate-400 tabular-nums">
                          ({row.passed_count}/{row.attempts_count})
                        </span>
                      </span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {row.pass_rate}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-forest-500 origin-left transition-transform duration-500"
                        style={{ transform: `scaleX(${row.pass_rate / 100})` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-[2rem] p-7 border border-slate-200/70 shadow-diffusion">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                Mean score by class
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 mb-6">
                Average score percentage across submitted attempts
              </p>

              <div className="space-y-4">
                {data.class_breakdown.map((row) => (
                  <div key={row.class}>
                    <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                      <span className="text-slate-700">
                        Class {row.class}{' '}
                        <span className="font-mono text-slate-400 tabular-nums">
                          (avg {row.avg_correct}/25)
                        </span>
                      </span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {row.avg_score_percentage}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-maple-500 origin-left transition-transform duration-500"
                        style={{
                          transform: `scaleX(${row.avg_score_percentage / 100})`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Lowest-Accuracy Questions Table */}
          <section className="bg-white rounded-[2rem] border border-slate-200/70 shadow-diffusion overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2.5">
              <WarningCircle
                size={18}
                weight="regular"
                className="text-maple-600"
              />
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                  Lowest-accuracy questions &amp; common misconceptions
                </h2>
                <p className="text-xs text-slate-500">
                  Questions missed most often and the most frequent wrong choice
                </p>
              </div>
            </div>

            {data.hardest_questions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Additional graded responses are required to compute item
                accuracy.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 text-xs font-medium text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3">Class</th>
                      <th className="px-5 py-3">Question</th>
                      <th className="px-5 py-3">Accuracy</th>
                      <th className="px-5 py-3">Frequent wrong option</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.hardest_questions.map((q) => (
                      <tr key={q.question_id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                          Class {q.class}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-slate-900">
                            {q.question_text}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {q.subject_tag} · {q.difficulty}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span
                            className={`font-mono px-2.5 py-1 rounded-md text-xs font-medium tabular-nums ${
                              q.accuracy_pct < 50
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-maple-100/70 text-maple-700'
                            }`}
                          >
                            {q.accuracy_pct}% ({q.correct}/{q.attempts})
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600">
                          {q.most_common_wrong_option ? (
                            <span>
                              Option{' '}
                              <strong className="uppercase text-rose-700 font-mono">
                                {q.most_common_wrong_option}
                              </strong>
                              : &ldquo;{q.most_common_wrong_text}&rdquo;
                            </span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}
