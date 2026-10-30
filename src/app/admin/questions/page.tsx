'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import {
  ALL_SUBJECT_TAGS,
  CLASSES,
  SUBJECT_TAGS_BY_CLASS,
} from '@/lib/constants';
import { apiFetch } from '@/lib/client-api';
import { Question } from '@/lib/types';
import {
  ArrowsClockwise,
  CheckCircle,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react';

interface ClassCountItem {
  class: number;
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function QuestionsBankContent() {
  const searchParams = useSearchParams();
  const initialClass = searchParams.get('class') || 'all';

  const [classFilter, setClassFilter] = useState<string>(initialClass);
  const [diffFilter, setDiffFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classCounts, setClassCounts] = useState<ClassCountItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [csvText, setCsvText] = useState<string>('');
  const [importMsg, setImportMsg] = useState<string>('');
  const [syncNotice, setSyncNotice] = useState('');

  const handleSyncSchemaFiles = async () => {
    setSyncNotice('Syncing from database/quizzes/*.json...');
    const { ok, data } = await apiFetch<{ message?: string; error?: string }>(
      '/api/admin/questions',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'sync_schema_files' }),
      }
    );
    setSyncNotice(
      ok
        ? data.message || 'Quiz schema files synced.'
        : data.error || 'Sync failed.'
    );
    loadQuestions();
    setTimeout(() => setSyncNotice(''), 4000);
  };

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (classFilter !== 'all') params.set('class', classFilter);
    if (diffFilter !== 'all') params.set('difficulty', diffFilter);
    if (subjectFilter !== 'all') params.set('subject_tag', subjectFilter);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());

    const { ok, data } = await apiFetch<{
      questions: Question[];
      class_counts: ClassCountItem[];
    }>(`/api/admin/questions?${params.toString()}`);

    if (ok) {
      setQuestions(data.questions || []);
      setClassCounts(data.class_counts || []);
    }
    setLoading(false);
  }, [classFilter, diffFilter, subjectFilter, searchQuery]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await apiFetch(`/api/admin/questions/${deleteTarget.id}`, {
      method: 'DELETE',
    });
    setDeleteTarget(null);
    loadQuestions();
  };

  const handleBulkImport = async () => {
    setImportMsg('');
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setImportMsg('Paste CSV rows before importing.');
      return;
    }

    const startIdx = lines[0].toLowerCase().startsWith('class,') ? 1 : 0;
    const parsedRows = [];

    for (let i = startIdx; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 9) {
        setImportMsg(
          `Line ${i + 1} has ${cols.length} columns (expected 9: class,subject_tag,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option).`
        );
        return;
      }
      parsedRows.push({
        class: Number(cols[0]),
        subject_tag: cols[1],
        difficulty: cols[2].toLowerCase(),
        question_text: cols[3],
        option_a: cols[4],
        option_b: cols[5],
        option_c: cols[6],
        option_d: cols[7],
        correct_option: cols[8].toLowerCase(),
      });
    }

    const { ok, data } = await apiFetch<{ message?: string; error?: string }>(
      '/api/admin/questions',
      {
        method: 'POST',
        body: JSON.stringify({ questions: parsedRows }),
      }
    );

    if (!ok) {
      setImportMsg(data.error || 'Import failed.');
      return;
    }

    setCsvText('');
    setShowImportModal(false);
    loadQuestions();
  };

  const availableSubjects =
    classFilter !== 'all'
      ? SUBJECT_TAGS_BY_CLASS[Number(classFilter)] || ALL_SUBJECT_TAGS
      : ALL_SUBJECT_TAGS;

  const activeCountObj =
    classFilter !== 'all'
      ? classCounts.find((c) => c.class === Number(classFilter))
      : null;

  return (
    <AdminShell
      title="Question bank"
      subtitle="Class-isolated practical computer MCQs synced with database/quizzes/class-06.json .. class-12.json"
      actions={
        <>
          <button
            type="button"
            onClick={handleSyncSchemaFiles}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-medium text-xs sm:text-sm transition"
          >
            <ArrowsClockwise size={15} weight="regular" />
            Sync schema files
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-medium text-xs sm:text-sm transition"
          >
            <UploadSimple size={15} weight="regular" />
            CSV import
          </button>
          <Link
            href="/admin/questions/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-xs sm:text-sm transition"
          >
            <Plus size={15} weight="regular" />
            Add question
          </Link>
        </>
      }
    >
      {syncNotice && (
        <div className="mb-4 p-3.5 rounded-2xl bg-forest-50 border border-forest-500/30 text-forest-600 text-sm font-medium">
          {syncNotice}
        </div>
      )}

      {/* Per-Class Quick Selector Pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={() => {
            setClassFilter('all');
            setSubjectFilter('all');
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition active:scale-[0.98] ${
            classFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          All classes (
          <span className="font-mono tabular-nums">
            {classCounts.reduce((acc, c) => acc + c.total, 0)}
          </span>
          )
        </button>

        {classCounts.map((c) => (
          <button
            key={c.class}
            type="button"
            onClick={() => {
              setClassFilter(String(c.class));
              setSubjectFilter('all');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition active:scale-[0.98] ${
              classFilter === String(c.class)
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Class {c.class}:{' '}
            <span className="font-mono tabular-nums">{c.total}</span>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-diffusion mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Class
          </label>
          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setSubjectFilter('all');
            }}
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
            Difficulty
          </label>
          <select
            value={diffFilter}
            onChange={(e) => setDiffFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
          >
            <option value="all">All difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Topic tag
          </label>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
          >
            <option value="all">All topics</option>
            {availableSubjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Search prompt
          </label>
          <div className="relative">
            <MagnifyingGlass
              size={15}
              weight="regular"
              className="text-slate-400 absolute left-3 top-2.5"
            />
            <input
              type="text"
              placeholder="Search question..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="space-y-3.5">
          <div className="h-36 rounded-[1.75rem] skeleton-shimmer" />
          <div className="h-36 rounded-[1.75rem] skeleton-shimmer" />
          <div className="h-36 rounded-[1.75rem] skeleton-shimmer" />
        </div>
      ) : questions.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-10 border border-slate-200/70 text-center">
          <p className="text-base font-semibold text-slate-800">
            No questions match your current filters.
          </p>
          <Link
            href="/admin/questions/new"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-medium text-sm"
          >
            <Plus size={15} weight="regular" />
            Add question
          </Link>
        </div>
      ) : (
        <div className="space-y-3.5">
          {questions.map((q) => {
            const diffBadge =
              q.difficulty === 'easy'
                ? 'bg-forest-50 text-forest-600'
                : q.difficulty === 'medium'
                ? 'bg-maple-100/70 text-maple-700'
                : 'bg-rose-50 text-rose-700';

            return (
              <div
                key={q.id}
                className="bg-white rounded-[1.75rem] p-6 border border-slate-200/70 shadow-diffusion"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-semibold tabular-nums">
                      Class {q.class}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize ${diffBadge}`}
                    >
                      {q.difficulty}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                      {q.subject_tag}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/questions/${q.id}/edit`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-medium transition"
                    >
                      <PencilSimple size={14} weight="regular" />
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(q)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 active:scale-[0.98] text-rose-600 text-xs font-medium transition"
                    >
                      <Trash size={14} weight="regular" />
                      Deactivate
                    </button>
                  </div>
                </div>

                <p className="text-base font-medium text-slate-900 mb-3 max-w-[65ch]">
                  {q.question_text}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {(
                    [
                      { k: 'a', label: 'A', val: q.option_a },
                      { k: 'b', label: 'B', val: q.option_b },
                      { k: 'c', label: 'C', val: q.option_c },
                      { k: 'd', label: 'D', val: q.option_d },
                    ] as const
                  ).map((o) => {
                    const isCorrect = q.correct_option === o.k;
                    return (
                      <div
                        key={o.k}
                        className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 ${
                          isCorrect
                            ? 'bg-forest-50 border-forest-500/40 text-slate-900 font-medium'
                            : 'bg-slate-50/70 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="font-mono font-semibold">
                          {o.label}.
                        </span>
                        <span className="flex-1">{o.val}</span>
                        {isCorrect && (
                          <CheckCircle
                            size={16}
                            weight="regular"
                            className="text-forest-600 shrink-0"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Summary Bar */}
      <div className="mt-6 bg-white rounded-2xl p-4 border border-slate-200/80 text-xs font-mono text-slate-600 flex flex-wrap items-center justify-between gap-2 tabular-nums">
        {activeCountObj ? (
          <span>
            Class {activeCountObj.class}: {activeCountObj.total} questions (
            {activeCountObj.easy} easy · {activeCountObj.medium} medium ·{' '}
            {activeCountObj.hard} hard)
          </span>
        ) : (
          <span>
            Showing {questions.length} filtered questions across Classes 6–12
          </span>
        )}
        <span className="text-slate-400">Minimum requirement: 100/class</span>
      </div>

      {/* Soft Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-7 max-w-md w-full border border-slate-200 shadow-diffusion">
            <h3 className="text-lg font-semibold text-slate-900">
              Deactivate question?
            </h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              This question will be marked inactive so it no longer appears in
              new random draws while preserving historical attempt records.
            </p>
            <p className="mt-3 p-3.5 rounded-xl bg-slate-50 text-xs font-medium text-slate-700">
              &ldquo;{deleteTarget.question_text}&rdquo;
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 font-medium text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 sm:p-7 max-w-2xl w-full border border-slate-200 shadow-diffusion">
            <h3 className="text-xl font-semibold text-slate-900">
              Bulk CSV question import
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Paste 9-column rows:{' '}
              <code className="font-mono">
                class,subject_tag,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option
              </code>
            </p>

            {importMsg && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {importMsg}
              </div>
            )}

            <textarea
              rows={7}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`class,subject_tag,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option\n6,Keyboard Shortcuts,easy,"Which shortcut copies selected text?",Ctrl + C,Ctrl + V,Ctrl + X,Ctrl + Z,a`}
              className="mt-4 w-full p-3.5 rounded-2xl border border-slate-300 font-mono text-xs"
            />

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 font-medium text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm"
              >
                Import rows
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

export default function AdminQuestionsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto p-8">
          <div className="h-64 rounded-[2rem] skeleton-shimmer" />
        </div>
      }
    >
      <QuestionsBankContent />
    </Suspense>
  );
}
