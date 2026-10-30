'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MaplesLogo from '@/components/MaplesLogo';
import {
  CLASSES,
  getSectionFieldLabel,
  getSectionsForClass,
} from '@/lib/constants';
import { apiFetch } from '@/lib/client-api';
import { ArrowLeft, UserPlus } from '@phosphor-icons/react';

export default function StudentRegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [selectedClass, setSelectedClass] = useState<number>(6);
  const [section, setSection] = useState<string>('A');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClassChange = (newClass: number) => {
    setSelectedClass(newClass);
    const validSections = getSectionsForClass(newClass);
    if (!validSections.includes(section)) {
      setSection(validSections[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (fullName.trim().length < 2) {
      setError('Enter your full name as shown on school records.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Re-enter both fields.');
      return;
    }

    setLoading(true);
    try {
      const { ok, data } = await apiFetch<{ error?: string }>(
        '/api/auth/student/register',
        {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName,
            roll_number: rollNumber,
            class: selectedClass,
            section,
            password,
          }),
        }
      );

      if (!ok) {
        setError(data.error || 'We could not complete registration. Try again.');
        return;
      }

      const params = new URLSearchParams({
        registered: '1',
        roll: rollNumber.trim(),
        class: String(selectedClass),
        section,
      });
      router.push(`/student/login?${params.toString()}`);
    } catch { setError('Connection failed. Check your network and try again.'); } finally { setLoading(false); }
  };

  const sections = getSectionsForClass(selectedClass);
  const sectionLabel = getSectionFieldLabel(selectedClass);

  return (
    <main
      id="main-content"
      className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col justify-between px-4 sm:px-6 py-6"
    >
      <div className="max-w-6xl w-full mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} weight="regular" />
          Back to portal home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 sm:p-10 border border-slate-200/70 shadow-diffusion animate-fade-in">
          <div className="mb-7">
            <MaplesLogo size="sm" />
            <h1 className="mt-5 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              Student registration
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Register using your school roll number, class, and section or stream.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-sm font-medium"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="reg-name"
                className="text-sm font-medium text-slate-700"
              >
                Full name
              </label>
              <input
                id="reg-name"
                type="text"
                required
                placeholder="e.g. Aarav Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:border-maple-500 outline-none text-sm transition"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="reg-roll"
                className="text-sm font-medium text-slate-700"
              >
                School roll number
              </label>
              <input
                id="reg-roll"
                type="text"
                required
                placeholder="e.g. 2413"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:border-maple-500 outline-none text-sm font-mono tabular-nums transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reg-class"
                  className="text-sm font-medium text-slate-700"
                >
                  Class
                </label>
                <select
                  id="reg-class"
                  value={selectedClass}
                  onChange={(e) => handleClassChange(Number(e.target.value))}
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:border-maple-500 outline-none text-sm font-medium transition"
                >
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>
                      Class {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reg-section"
                  className="text-sm font-medium text-slate-700"
                >
                  {sectionLabel}
                </label>
                <select
                  id="reg-section"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:border-maple-500 outline-none text-sm font-medium transition"
                >
                  {sections.map((sec) => (
                    <option key={sec} value={sec}>
                      {selectedClass >= 11 ? sec : `Section ${sec}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reg-pass"
                  className="text-sm font-medium text-slate-700"
                >
                  Create password
                </label>
                <input
                  id="reg-pass"
                  type="password"
                  required
                  minLength={10}
                  placeholder="Min 10 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:border-maple-500 outline-none text-sm transition"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reg-confirm"
                  className="text-sm font-medium text-slate-700"
                >
                  Confirm password
                </label>
                <input
                  id="reg-confirm"
                  type="password"
                  required
                  minLength={10}
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:border-maple-500 outline-none text-sm transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] mt-2 px-5 py-3 rounded-xl bg-maple-500 hover:bg-maple-600 active:scale-[0.98] disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-2 transition duration-200"
            >
              <UserPlus size={17} weight="regular" />
              {loading ? 'Creating account...' : 'Create student account'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-sm text-slate-600">
            Already registered?{' '}
            <Link
              href="/student/login"
              className="font-semibold text-maple-600 hover:text-maple-700 transition-colors"
            >
              Sign in here
            </Link>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400">
        Maples Tech Club · Maples Academy, Khatauli
      </div>
    </main>
  );
}
