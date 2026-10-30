'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import { apiFetch } from '@/lib/client-api';
import { ExamConfig } from '@/lib/types';
import { Eye, EyeSlash, FloppyDisk } from '@phosphor-icons/react';

interface EnrichedExamConfig extends ExamConfig {
  questions_in_bank: number;
}

export default function AdminSettingsPage() {
  const [configs, setConfigs] = useState<EnrichedExamConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingClass, setSavingClass] = useState<number | null>(null);
  const [savedNotice, setSavedNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');

  useEffect(() => {
    apiFetch<{ settings: EnrichedExamConfig[] }>('/api/admin/settings').then(
      ({ ok, data }) => {
        if (ok) setConfigs(data.settings || []);
        setLoading(false);
      }
    );
  }, []);

  const updateLocalField = (
    cls: number,
    field: keyof EnrichedExamConfig,
    value: boolean | number
  ) => {
    setConfigs((prev) =>
      prev.map((c) => (c.class === cls ? { ...c, [field]: value } : c))
    );
  };

  const handleSaveClass = async (cfg: EnrichedExamConfig) => {
    setSavingClass(cfg.class);
    setErrorNotice('');
    setSavedNotice('');

    const { ok, data } = await apiFetch<{ message?: string; error?: string }>(
      `/api/admin/settings/${cfg.class}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          is_open: cfg.is_open,
          total_questions: Number(cfg.total_questions),
          time_limit_minutes: Number(cfg.time_limit_minutes),
          passing_score: Number(cfg.passing_score),
          max_attempts: Number(cfg.max_attempts),
          show_results_to_students: Boolean(cfg.show_results_to_students),
        }),
      }
    );

    setSavingClass(null);
    if (!ok) {
      setErrorNotice(data.error || 'We could not save settings for this class.');
      return;
    }

    setSavedNotice(`Class ${cfg.class} configuration saved.`);
    setTimeout(() => setSavedNotice(''), 3000);
  };

  const handleQuickToggleStudentResult = async (cfg: EnrichedExamConfig) => {
    const nextVal = !cfg.show_results_to_students;
    updateLocalField(cfg.class, 'show_results_to_students', nextVal);
    await apiFetch(`/api/admin/settings/${cfg.class}`, {
      method: 'PUT',
      body: JSON.stringify({ show_results_to_students: nextVal }),
    });
    setSavedNotice(
      nextVal
        ? `Class ${cfg.class} students can now view their score and question-wise answers.`
        : `Class ${cfg.class} student results hidden.`
    );
    setTimeout(() => setSavedNotice(''), 3000);
  };

  const toggleAllWindows = async (open: boolean) => {
    setConfigs((prev) => prev.map((c) => ({ ...c, is_open: open })));
    await Promise.all(
      configs.map((c) =>
        apiFetch(`/api/admin/settings/${c.class}`, {
          method: 'PUT',
          body: JSON.stringify({ is_open: open }),
        })
      )
    );
    setSavedNotice(
      open
        ? 'Opened quiz windows for Classes 6 to 12.'
        : 'Closed quiz windows for Classes 6 to 12.'
    );
    setTimeout(() => setSavedNotice(''), 3000);
  };

  const toggleAllStudentResults = async (allow: boolean) => {
    setConfigs((prev) =>
      prev.map((c) => ({ ...c, show_results_to_students: allow }))
    );
    await Promise.all(
      configs.map((c) =>
        apiFetch(`/api/admin/settings/${c.class}`, {
          method: 'PUT',
          body: JSON.stringify({ show_results_to_students: allow }),
        })
      )
    );
    setSavedNotice(
      allow
        ? 'Released question-wise results to students across Classes 6 to 12.'
        : 'Hidden quiz results from students across Classes 6 to 12.'
    );
    setTimeout(() => setSavedNotice(''), 3500);
  };

  return (
    <AdminShell
      title="Exam windows & result visibility"
      subtitle="Configure class quiz sessions, random sample counts, time limits, and question-wise student result access"
      actions={
        <>
          <button
            type="button"
            onClick={() => toggleAllStudentResults(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-xs sm:text-sm inline-flex items-center gap-1.5 transition"
          >
            <Eye size={15} weight="regular" />
            Release results (all)
          </button>
          <button
            type="button"
            onClick={() => toggleAllStudentResults(false)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-medium text-xs sm:text-sm inline-flex items-center gap-1.5 transition"
          >
            <EyeSlash size={15} weight="regular" />
            Hide results (all)
          </button>
          <button
            type="button"
            onClick={() => toggleAllWindows(true)}
            className="px-3.5 py-2 rounded-xl bg-forest-600 hover:bg-forest-500 active:scale-[0.98] text-white font-medium text-xs sm:text-sm transition"
          >
            Open all windows
          </button>
          <button
            type="button"
            onClick={() => toggleAllWindows(false)}
            className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 active:scale-[0.98] text-rose-700 font-medium text-xs sm:text-sm transition"
          >
            Close all windows
          </button>
        </>
      }
    >
      {savedNotice && (
        <div className="mb-5 p-3.5 rounded-2xl bg-forest-50 border border-forest-500/30 text-forest-600 text-sm font-medium">
          {savedNotice}
        </div>
      )}

      {errorNotice && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium"
        >
          {errorNotice}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-80 rounded-[2rem] skeleton-shimmer" />
          <div className="h-80 rounded-[2rem] skeleton-shimmer" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {configs.map((cfg) => {
            const passPct =
              cfg.total_questions > 0
                ? Math.round((cfg.passing_score / cfg.total_questions) * 100)
                : 0;

            return (
              <div
                key={cfg.class}
                className="bg-white rounded-[2rem] p-7 border border-slate-200/70 shadow-diffusion flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        Class {cfg.class}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cfg.class >= 11
                          ? 'Maths, Bio, Commerce, Humanities'
                          : 'Section A and Section B'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        updateLocalField(cfg.class, 'is_open', !cfg.is_open)
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition active:scale-[0.98] ${
                        cfg.is_open
                          ? 'bg-forest-50 text-forest-600 border-forest-500/30'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {cfg.is_open ? 'Window open' : 'Window closed'}
                    </button>
                  </div>

                  <div className="space-y-3.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <label className="font-medium text-slate-700">
                        Random quiz size
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={cfg.total_questions}
                        onChange={(e) =>
                          updateLocalField(
                            cfg.class,
                            'total_questions',
                            Number(e.target.value)
                          )
                        }
                        className="w-24 px-3 py-1.5 rounded-xl border border-slate-300 text-right font-mono font-medium tabular-nums"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <label className="font-medium text-slate-700">
                        Time limit (min)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={180}
                        value={cfg.time_limit_minutes}
                        onChange={(e) =>
                          updateLocalField(
                            cfg.class,
                            'time_limit_minutes',
                            Number(e.target.value)
                          )
                        }
                        className="w-24 px-3 py-1.5 rounded-xl border border-slate-300 text-right font-mono font-medium tabular-nums"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <label className="font-medium text-slate-700">
                        Qualifying score ({passPct}%)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={cfg.total_questions}
                        value={cfg.passing_score}
                        onChange={(e) =>
                          updateLocalField(
                            cfg.class,
                            'passing_score',
                            Number(e.target.value)
                          )
                        }
                        className="w-24 px-3 py-1.5 rounded-xl border border-slate-300 text-right font-mono font-medium tabular-nums"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <label className="font-medium text-slate-700">
                        Max attempts
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={cfg.max_attempts}
                        onChange={(e) =>
                          updateLocalField(
                            cfg.class,
                            'max_attempts',
                            Number(e.target.value)
                          )
                        }
                        className="w-24 px-3 py-1.5 rounded-xl border border-slate-300 text-right font-mono font-medium tabular-nums"
                      />
                    </div>

                    {/* Question-wise Result Toggle */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-900">
                            Student question-wise result
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {cfg.show_results_to_students
                              ? 'Students can view score and answers'
                              : 'Hidden from students'}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleQuickToggleStudentResult(cfg)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border inline-flex items-center gap-1.5 transition active:scale-[0.98] ${
                            cfg.show_results_to_students
                              ? 'bg-maple-500 text-white border-maple-500'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cfg.show_results_to_students ? (
                            <>
                              <Eye size={14} weight="regular" /> Allowed
                            </>
                          ) : (
                            <>
                              <EyeSlash size={14} weight="regular" /> Hidden
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>Class quiz bank</span>
                      <span className="font-mono font-medium text-slate-800 tabular-nums">
                        {cfg.questions_in_bank} active MCQs
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={savingClass === cfg.class}
                  onClick={() => handleSaveClass(cfg)}
                  className="mt-6 w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-2 transition"
                >
                  <FloppyDisk size={16} weight="regular" />
                  {savingClass === cfg.class ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
