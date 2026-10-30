'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import MaplesLogo from '@/components/MaplesLogo';
import {
  ALL_SECTIONS,
  CLASSES,
  formatSectionDisplay,
  getSectionsForClass,
} from '@/lib/constants';
import { apiFetch } from '@/lib/client-api';
import { ArrowLeft, Printer } from '@phosphor-icons/react';

interface SelectedRow {
  attempt_id: string;
  roll_number: string;
  full_name: string;
  class: number;
  section: string;
  correct_count: number;
  total_questions: number;
  score_percentage: number;
}

function PrintSelectionSheetContent() {
  const searchParams = useSearchParams();
  const [classFilter, setClassFilter] = useState<string>(
    searchParams.get('class') || 'all'
  );
  const [sectionFilter, setSectionFilter] = useState<string>(
    searchParams.get('section') || 'all'
  );
  const [showScoresOnSheet, setShowScoresOnSheet] = useState<boolean>(true);
  const [selected, setSelected] = useState<SelectedRow[]>([]);
  const [totalAppeared, setTotalAppeared] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const loadPrintData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (classFilter !== 'all') params.set('class', classFilter);
    if (sectionFilter !== 'all') params.set('section', sectionFilter);

    const { ok, data } = await apiFetch<{
      selected_students: SelectedRow[];
      total_appeared: number;
    }>(`/api/admin/results/print?${params.toString()}`);

    if (ok) {
      setSelected(data.selected_students || []);
      setTotalAppeared(data.total_appeared || 0);
    }
    setLoading(false);
  }, [classFilter, sectionFilter]);

  useEffect(() => {
    loadPrintData();
  }, [loadPrintData]);

  const handleClassChange = (val: string) => {
    setClassFilter(val);
    if (val !== 'all') {
      const valid = getSectionsForClass(Number(val));
      if (sectionFilter !== 'all' && !valid.includes(sectionFilter)) {
        setSectionFilter('all');
      }
    }
  };

  const sectionOptions =
    classFilter === 'all'
      ? [...ALL_SECTIONS]
      : getSectionsForClass(Number(classFilter));

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const headingScope =
    classFilter === 'all'
      ? 'Classes 6 to 12'
      : `Class ${classFilter}${
          sectionFilter !== 'all'
            ? ` — ${formatSectionDisplay(Number(classFilter), sectionFilter)}`
            : ''
        }`;

  return (
    <AdminShell
      title="Printable shortlist sheet"
      subtitle="Formatted notice sheet for school notice boards and official records"
      actions={
        <>
          <Link
            href="/admin/results"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] font-medium text-sm text-slate-700 transition"
          >
            <ArrowLeft size={15} weight="regular" />
            Back to results
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-sm transition"
          >
            <Printer size={15} weight="regular" />
            Print / save as PDF
          </button>
        </>
      }
    >
      {/* Print Controls (Hidden when printing) */}
      <div className="no-print bg-white rounded-2xl p-4 border border-slate-200/80 shadow-diffusion mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Class
          </label>
          <select
            value={classFilter}
            onChange={(e) => handleClassChange(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
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
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
          >
            <option value="all">All sections / streams</option>
            {sectionOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={showScoresOnSheet}
            onChange={(e) => setShowScoresOnSheet(e.target.checked)}
            className="w-4 h-4 accent-slate-900"
          />
          Include score column
        </label>
      </div>

      {/* Printable Official Notice Board Sheet */}
      <div className="print-sheet bg-white rounded-[2rem] p-8 sm:p-12 border border-slate-200/90 shadow-diffusion max-w-4xl mx-auto">
        <div className="border-b-2 border-slate-900 pb-5 mb-6 flex flex-col items-center text-center">
          <MaplesLogo size="lg" />
          <h2 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Maples Academy, Khatauli
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Muzaffarnagar, Uttar Pradesh – 251201
          </p>
          <p className="text-sm sm:text-base font-semibold text-maple-600 mt-2">
            Maples Tech Club — Entrance Quiz Shortlist
          </p>
          <div className="mt-4 w-full flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-medium text-slate-700 pt-2.5 border-t border-slate-200">
            <span>Scope: {headingScope}</span>
            <span className="font-mono tabular-nums">Date: {formattedDate}</span>
          </div>
        </div>

        {loading ? (
          <div className="py-10 space-y-3">
            <div className="h-8 rounded-xl skeleton-shimmer" />
            <div className="h-8 rounded-xl skeleton-shimmer" />
          </div>
        ) : selected.length === 0 ? (
          <p className="py-10 text-center font-medium text-slate-600 border border-dashed border-slate-300 rounded-xl">
            No shortlisted students match the selected filter yet.
          </p>
        ) : (
          <table className="w-full border-collapse border border-slate-800 text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-900">
                <th className="border border-slate-800 px-3 py-2.5 text-center w-16 font-semibold">
                  S.No
                </th>
                <th className="border border-slate-800 px-4 py-2.5 text-left font-semibold">
                  Student name
                </th>
                <th className="border border-slate-800 px-4 py-2.5 text-center font-semibold">
                  Roll no.
                </th>
                <th className="border border-slate-800 px-4 py-2.5 text-center font-semibold">
                  Class &amp; section
                </th>
                {showScoresOnSheet && (
                  <th className="border border-slate-800 px-4 py-2.5 text-center font-semibold">
                    Score
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {selected.map((s, idx) => (
                <tr key={s.attempt_id}>
                  <td className="border border-slate-800 px-3 py-2 text-center font-mono tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-800 px-4 py-2 font-medium text-slate-900">
                    {s.full_name}
                  </td>
                  <td className="border border-slate-800 px-4 py-2 text-center font-mono tabular-nums">
                    {s.roll_number}
                  </td>
                  <td className="border border-slate-800 px-4 py-2 text-center">
                    Class {s.class} ({s.section})
                  </td>
                  {showScoresOnSheet && (
                    <td className="border border-slate-800 px-4 py-2 text-center font-mono font-medium tabular-nums">
                      {s.correct_count}/{s.total_questions}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-6 pt-4 flex flex-col gap-10 text-sm text-slate-800">
          <p className="font-mono text-xs font-medium tabular-nums">
            Shortlisted: {selected.length} of {totalAppeared} appeared
          </p>

          <div className="grid grid-cols-2 gap-8 pt-8">
            <div>
              <div className="w-52 border-t border-slate-800 pt-1.5 font-semibold text-xs">
                MTC Coordinator
              </div>
              <p className="text-xs text-slate-500">Maples Tech Club</p>
            </div>
            <div className="flex flex-col items-end">
              <div className="w-52 border-t border-slate-800 pt-1.5 font-semibold text-xs text-right">
                Principal
              </div>
              <p className="text-xs text-slate-500">Maples Academy, Khatauli</p>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

export default function AdminPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto p-8">
          <div className="h-64 rounded-[2rem] skeleton-shimmer" />
        </div>
      }
    >
      <PrintSelectionSheetContent />
    </Suspense>
  );
}
