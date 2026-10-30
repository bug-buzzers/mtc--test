'use client';

import React, { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import {
  ALL_SECTIONS,
  CLASSES,
  formatSectionDisplay,
  getSectionFieldLabel,
  getSectionsForClass,
} from '@/lib/constants';
import { apiFetch } from '@/lib/client-api';
import {
  ArrowCounterClockwise,
  CheckCircle,
  Key,
  MagnifyingGlass,
  UserPlus,
  XCircle,
} from '@phosphor-icons/react';

interface StudentRow {
  id: string;
  roll_number: string;
  full_name: string;
  class: number;
  section: string;
  is_active: boolean;
  password_reset_required: boolean;
  extra_attempts: number;
  attempts_count: number;
  created_at: string;
}

export default function AdminStudentsPage() {
  const [classFilter, setClassFilter] = useState<string>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<string>('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRoll, setNewRoll] = useState('');
  const [newClass, setNewClass] = useState<number>(6);
  const [newSection, setNewSection] = useState<string>('A');
  const [newPassword, setNewPassword] = useState('');
  const [formErr, setFormErr] = useState('');

  const [resetStudent, setResetStudent] = useState<StudentRow | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadStudents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (classFilter !== 'all') params.set('class', classFilter);
    if (sectionFilter !== 'all') params.set('section', sectionFilter);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());

    const { ok, data } = await apiFetch<{ students: StudentRow[] }>(
      `/api/admin/students?${params.toString()}`
    );
    if (ok) {
      setStudents(data.students || []);
    }
    setLoading(false);
  }, [classFilter, sectionFilter, searchQuery]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleFilterClass = (val: string) => {
    setClassFilter(val);
    if (val !== 'all') {
      const valid = getSectionsForClass(Number(val));
      if (sectionFilter !== 'all' && !valid.includes(sectionFilter)) {
        setSectionFilter('all');
      }
    }
  };

  const handleNewClassChange = (cls: number) => {
    setNewClass(cls);
    const valid = getSectionsForClass(cls);
    if (!valid.includes(newSection)) {
      setNewSection(valid[0]);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    const { ok, data } = await apiFetch<{ error?: string }>(
      '/api/admin/students',
      {
        method: 'POST',
        body: JSON.stringify({
          full_name: newName,
          roll_number: newRoll,
          class: newClass,
          section: newSection,
          password: newPassword,
        }),
      }
    );

    if (!ok) {
      setFormErr(data.error || 'We could not register this student.');
      return;
    }

    setShowAddModal(false);
    setNewName('');
    setNewRoll('');
    showNotice('Student registered.');
    loadStudents();
  };

  const toggleActive = async (stu: StudentRow) => {
    const { ok, data } = await apiFetch<{ error?: string }>(`/api/admin/students/${stu.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: !stu.is_active }),
    });
    if (!ok) { showNotice(data.error || 'Unable to change account status.'); return; }
    if (ok) {
      showNotice(
        `${stu.full_name} account ${
          !stu.is_active ? 'activated' : 'deactivated'
        }.`
      );
      loadStudents();
    }
  };

  const grantExtraAttempt = async (stu: StudentRow) => {
    const nextExtra = (stu.extra_attempts || 0) + 1;
    const { ok } = await apiFetch(`/api/admin/students/${stu.id}`, {
      method: 'PUT',
      body: JSON.stringify({ extra_attempts: nextExtra }),
    });
    if (ok) {
      showNotice(`Granted +1 exam retake to ${stu.full_name}.`);
      loadStudents();
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStudent || resetPasswordValue.trim().length < 10) return;
    const { ok } = await apiFetch(`/api/admin/students/${resetStudent.id}`, {
      method: 'PUT',
      body: JSON.stringify({ new_password: resetPasswordValue.trim() }),
    });
    if (ok) {
      showNotice(`Password updated for ${resetStudent.full_name}.`);
      setResetStudent(null);
      setResetPasswordValue('');
      loadStudents();
    } else showNotice('Unable to reset this password.');
  };

  const sectionOptions =
    classFilter === 'all'
      ? [...ALL_SECTIONS]
      : getSectionsForClass(Number(classFilter));

  return (
    <AdminShell
      title="Student directory"
      subtitle="Manage registered student accounts, reset passwords, or grant additional exam attempts"
      actions={
        <>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-sm transition"
        >
          <UserPlus size={16} weight="regular" />
          Register student
        </button>
        </>
      }
    >
      {toast && (
        <div className="mb-5 p-3.5 rounded-2xl bg-forest-50 border border-forest-500/30 text-forest-600 text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-diffusion mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Class
          </label>
          <select
            value={classFilter}
            onChange={(e) => handleFilterClass(e.target.value)}
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
              placeholder="Search student..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-[2rem] border border-slate-200/70 shadow-diffusion overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-12 rounded-xl skeleton-shimmer" />
            <div className="h-12 rounded-xl skeleton-shimmer" />
            <div className="h-12 rounded-xl skeleton-shimmer" />
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No student accounts match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-medium text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">Roll no.</th>
                  <th className="px-5 py-3.5">Full name</th>
                  <th className="px-5 py-3.5">Class</th>
                  <th className="px-5 py-3.5">Section / Stream</th>
                  <th className="px-5 py-3.5">Attempts</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((stu) => (
                  <tr key={stu.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {stu.roll_number}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {stu.full_name}
                      {stu.password_reset_required && <span className="mt-1 block text-xs font-normal text-rose-700">Password reset required</span>}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700 tabular-nums">
                      Class {stu.class}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {formatSectionDisplay(stu.class, stu.section)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700 tabular-nums">
                      {stu.attempts_count} taken
                      {stu.extra_attempts > 0 && (
                        <span className="ml-1.5 px-2 py-0.5 rounded-md bg-maple-100/70 text-maple-700">
                          +{stu.extra_attempts} allowed
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {stu.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-forest-50 text-forest-600 text-xs font-medium">
                          <CheckCircle size={13} weight="regular" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 text-xs font-medium">
                          <XCircle size={13} weight="regular" />
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => grantExtraAttempt(stu)}
                          title="Allow one extra exam attempt"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-medium text-xs transition"
                        >
                          <ArrowCounterClockwise size={13} weight="regular" />
                          +1 retake
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetStudent(stu);
                            setResetPasswordValue('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-medium text-xs transition"
                        >
                          <Key size={13} weight="regular" />
                          Reset PW
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(stu)}
                          className={`px-2.5 py-1.5 rounded-lg border font-medium text-xs transition active:scale-[0.98] ${
                            stu.is_active
                              ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                              : 'border-forest-500/30 text-forest-600 hover:bg-forest-50'
                          }`}
                        >
                          {stu.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Register Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 sm:p-7 max-w-md w-full border border-slate-200 shadow-diffusion">
            <h3 className="text-xl font-semibold text-slate-900">
              Register student
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Classes 6–10: A, B · Classes 11–12: Maths, Bio, Commerce,
              Humanities
            </p>

            {formErr && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {formErr}
              </div>
            )}

            <form onSubmit={handleCreateStudent} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Student full name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Roll number
                </label>
                <input
                  type="text"
                  required
                  value={newRoll}
                  onChange={(e) => setNewRoll(e.target.value)}
                  placeholder="e.g., 805"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Class
                  </label>
                  <select
                    value={newClass}
                    onChange={(e) =>
                      handleNewClassChange(Number(e.target.value))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
                  >
                    {CLASSES.map((c) => (
                      <option key={c} value={c}>
                        Class {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {getSectionFieldLabel(newClass)}
                  </label>
                  <select
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
                  >
                    {getSectionsForClass(newClass).map((s) => (
                      <option key={s} value={s}>
                        {newClass >= 11 ? s : `Section ${s}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Initial password
                </label>
                <input
                  type="password"
                  required
                  minLength={10}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm text-slate-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full border border-slate-200 shadow-diffusion">
            <h3 className="text-lg font-semibold text-slate-900">
              Reset student password
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Setting a new password for <strong>{resetStudent.full_name}</strong>{' '}
              (Roll <span className="font-mono">{resetStudent.roll_number}</span>)
            </p>
            <form onSubmit={handlePasswordReset} className="mt-4 space-y-4">
              <input
                type="password"
                required
                minLength={10}
                placeholder="New password (min 10 characters)"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm text-slate-900"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetStudent(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium"
                >
                  Save password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
