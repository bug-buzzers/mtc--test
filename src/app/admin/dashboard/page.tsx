'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import { apiFetch } from '@/lib/client-api';
import {
  ArrowRight,
  BookOpenText,
  ChartBar,
  CheckCircle,
  ClipboardText,
  Database,
  GearSix,
  Printer,
  Users,
} from '@phosphor-icons/react';

interface AnalyticsPayload {
  database_mode: 'supabase' | 'local_json';
  totals: {
    total_students: number;
    active_students: number;
    total_questions: number;
    completed_attempts: number;
    in_progress_attempts: number;
    submitted_today: number;
    passed_students: number;
    overall_pass_rate: number;
    completion_rate: number;
    avg_duration_minutes: number;
    open_classes_count: number;
  };
  class_breakdown: Array<{
    class: number;
    is_open: boolean;
    students_count: number;
    questions_count: number;
    easy_count: number;
    medium_count: number;
    hard_count: number;
    attempts_count: number;
    passed_count: number;
    pass_rate: number;
    avg_score_percentage: number;
  }>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);

  useEffect(() => {
    apiFetch<AnalyticsPayload>('/api/admin/analytics').then(({ ok, data }) => {
      if (ok) setData(data);
    });
  }, []);

  const totals = data?.totals;

  const modules = [
    {
      href: '/admin/questions',
      title: 'Question bank',
      desc: 'Manage private question banks or import questions from CSV.',
      stat: `${totals?.total_questions ?? '—'} MCQs`,
      Icon: BookOpenText,
    },
    {
      href: '/admin/results',
      title: 'Results & shortlist',
      desc: 'Filter graded attempts, inspect student responses, and export notice sheets.',
      stat: `${totals?.passed_students ?? '—'} shortlisted`,
      Icon: ClipboardText,
    },
    {
      href: '/admin/students',
      title: 'Student roster',
      desc: 'Register students, reset forgotten passwords, or grant extra attempts.',
      stat: `${totals?.total_students ?? '—'} registered`,
      Icon: Users,
    },
    {
      href: '/admin/settings',
      title: 'Windows & result release',
      desc: 'Open class sessions, adjust timers, and allow students to view question-wise answers.',
      stat: `${totals?.open_classes_count ?? '—'}/7 open`,
      Icon: GearSix,
    },
    {
      href: '/admin/analytics',
      title: 'Performance insights',
      desc: 'Compare pass rates, average scores, and frequently missed questions.',
      stat: `${totals?.overall_pass_rate ?? 0}% pass rate`,
      Icon: ChartBar,
    },
  ];

  return (
    <AdminShell
      title="Coordinator overview"
      subtitle="Maples Academy, Khatauli · Entrance examination operations"
      actions={
        <Link
          href="/admin/results/print"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-sm transition duration-200"
        >
          <Printer size={16} weight="regular" />
          Print shortlist sheet
        </Link>
      }
    >
      {/* Tabular Monospace KPI Strip (Divide-X / Border Grouping — Anti-Card Clutter) */}
      <section className="bg-white rounded-[2rem] border border-slate-200/70 shadow-diffusion grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 mb-8">
        <div className="p-6">
          <p className="text-xs font-medium text-slate-500">
            Registered students
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
            {totals?.total_students ?? '—'}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            {totals?.active_students ?? 0} active accounts
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs font-medium text-slate-500">
            Completed attempts
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
            {totals?.completed_attempts ?? '—'}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            {totals?.submitted_today ?? 0} submitted today
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs font-medium text-slate-500">
            Shortlisted students
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold text-forest-600 tabular-nums">
            {totals?.passed_students ?? '—'}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            {totals?.overall_pass_rate ?? 0}% overall pass rate
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs font-medium text-slate-500">
            Active quiz bank
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold text-maple-600 tabular-nums">
            {totals?.total_questions ?? '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500 inline-flex items-center gap-1.5">
            <Database size={13} weight="regular" />
            {data?.database_mode === 'supabase'
              ? 'Supabase PostgreSQL'
              : 'Schema JSON + SQL synced'}
          </p>
        </div>
      </section>

      {/* Asymmetric 2-Column Workspace Grid (Avoids Generic 3-Column Card Row) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8 items-start">
        {/* Left: Workspace Directory List */}
        <section className="lg:col-span-5 bg-white rounded-[2rem] border border-slate-200/70 shadow-diffusion divide-y divide-slate-100">
          {modules.map((mod) => {
            const Icon = mod.Icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="p-5 sm:p-6 flex items-start justify-between gap-4 hover:bg-slate-50/80 transition group first:rounded-t-[2rem] last:rounded-b-[2rem]"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                    <Icon size={18} weight="regular" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                        {mod.title}
                      </h2>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 tabular-nums">
                        {mod.stat}
                      </span>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={16}
                  weight="regular"
                  className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition shrink-0 mt-1"
                />
              </Link>
            );
          })}
        </section>

        {/* Right: Class 6-12 Readiness Table */}
        <section className="lg:col-span-7 bg-white rounded-[2rem] border border-slate-200/70 shadow-diffusion overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                Class 6–12 readiness &amp; shortlist matrix
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Classes 6–10: Section A &amp; B · Classes 11–12: Maths, Bio,
                Commerce, Humanities
              </p>
            </div>
            <Link
              href="/admin/settings"
              className="text-xs font-medium text-maple-600 hover:text-maple-700 shrink-0"
            >
              Configure settings
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-medium text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Quiz bank</th>
                  <th className="px-5 py-3">Appeared</th>
                  <th className="px-5 py-3">Shortlisted</th>
                  <th className="px-5 py-3">Pass rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.class_breakdown || []).map((row) => (
                  <tr key={row.class} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-semibold text-slate-900 font-mono tabular-nums">
                      Class {row.class}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.is_open ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-forest-50 text-forest-600 font-medium text-xs">
                          <CheckCircle size={13} weight="regular" />
                          Open
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-xs">
                          Closed
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700 tabular-nums">
                      {row.questions_count} Qs
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700 tabular-nums">
                      {row.attempts_count} / {row.students_count}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-forest-600 tabular-nums">
                      {row.passed_count}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-maple-500 origin-left transition-transform"
                            style={{ transform: `scaleX(${row.pass_rate / 100})` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-slate-700 tabular-nums">
                          {row.pass_rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
