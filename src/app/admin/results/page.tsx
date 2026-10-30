'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import {
  ALL_SECTIONS,
  CLASSES,
  formatSectionDisplay,
  getSectionsForClass,
} from '@/lib/constants';
import { apiFetch } from '@/lib/client-api';
import {
  CheckCircle,
  Eye,
  MagnifyingGlass,
  Printer,
  XCircle,
} from '@phosphor-icons/react';

interface ResultItem {
  attempt_id: string;
  student_id: string;
  roll_number: string;
  full_name: string;
  class: number;
  section: string;
  started_at: string;
  submitted_at: string | null;
  total_questions: number;
  correct_count: number;
  score_percentage: number;
  passed: boolean;
  duration_minutes: number | null;
}

export default function AdminResultsPage() {
  const [classFilter, setClassFilter] = useState<string>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);

  const handleClassChange = (val: string) => {
    setClassFilter(val);
    if (val !== 'all') {
      const allowed = getSectionsForClass(Number(val));
      if (sectionFilter !== 'all' && !allowed.includes(sectionFilter)) {
        setSectionFilter('all');
      }
    }
  };

  const loadResults = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (classFilter !== 'all') params.set('class', classFilter);
    if (sectionFilter !== 'all') params.set('section', sectionFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());

    const { ok, data } = await apiFetch<{ results: ResultItem[] }>(
      `/api/admin/results?${params.toString()}`
    );
    if (ok) {
      setResults(data.results || []);
    }
    setLoading(false);
  }, [classFilter, sectionFilter, statusFilter, searchQuery]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const sectionOptions =
    classFilter === 'all'
      ? [...ALL_SECTIONS]
      : getSectionsForClass(Number(classFilter));

  const printQuery = new URLSearchParams();
  if (classFilter !== 'all') printQuery.set('class', classFilter);
  if (sectionFilter !== 'all') printQuery.set('section', sectionFilter);

  const passedCount = results.filter((r) => r.passed).length;

  return (
    <AdminShell
      title="Results & selection shortlist"
      subtitle="Review graded student attempts or print shortlist sheets — toggle student question-wise visibility in Settings"
      actions={
        <Link
          href={`/admin/results/print?${printQuery.toString()}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-sm transition"
        >
          <Printer size={16} weight="regular" />
          Print shortlist
        </Link>
      }
    >
      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-diffusion mb-5 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Class
          </label>
          <select
            value={classFilter}
            onChange={(e) => handleClassChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
          >
            <option value="all">All classes (6–12)</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                Class {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Section / Stream
          </label>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
          >
            <option value="all">All sections / streams</option>
            {sectionOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
          >
            <option value="all">All attempts</option>
            <option value="passed">Shortlisted</option>
            <option value="failed">Below threshold</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Search roll or name
          </label>
          <div className="relative">
            <MagnifyingGlass
              size={15}
              weight="regular"
              className="text-slate-400 absolute left-3 top-2.5"
            />
            <input
              type="text"
              placeholder="e.g., 801 or Meera"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500 px-1 tabular-nums">
        <span>
          Showing <strong className="text-slate-900">{results.length}</strong>{' '}
          graded attempts (
          <strong className="text-forest-600">{passedCount} shortlisted</strong>)
        </span>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-[2rem] border border-slate-200/70 shadow-diffusion overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-12 rounded-xl skeleton-shimmer" />
            <div className="h-12 rounded-xl skeleton-shimmer" />
            <div className="h-12 rounded-xl skeleton-shimmer" />
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No submitted exam attempts match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-medium text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">Roll no.</th>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-5 py-3.5">Class</th>
                  <th className="px-5 py-3.5">Section / Stream</th>
                  <th className="px-5 py-3.5">Score</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Duration</th>
                  <th className="px-5 py-3.5">Submitted</th>
                  <th className="px-5 py-3.5 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r) => (
                  <tr key={r.attempt_id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {r.roll_number}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {r.full_name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700 tabular-nums">
                      Class {r.class}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {formatSectionDisplay(r.class, r.section)}
                    </td>
                    <td className="px-5 py-3.5 font-mono tabular-nums">
                      <span className="font-semibold text-slate-900">
                        {r.correct_count}/{r.total_questions}
                      </span>{' '}
                      <span className="text-xs text-slate-400">
                        ({r.score_percentage}%)
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {r.passed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-forest-50 text-forest-600 text-xs font-medium">
                          <CheckCircle size={13} weight="regular" />
                          Shortlisted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 text-xs font-medium">
                          <XCircle size={13} weight="regular" />
                          Below cutoff
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600 text-xs tabular-nums">
                      {r.duration_minutes ? `${r.duration_minutes}m` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">
                      {r.submitted_at
                        ? new Date(r.submitted_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/results/${r.attempt_id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-slate-800 font-medium text-xs transition"
                      >
                        <Eye size={14} weight="regular" />
                        Answers
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
