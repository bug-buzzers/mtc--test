'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import MaplesLogo from '@/components/MaplesLogo';
import {
  CLASSES,
  getSectionFieldLabel,
  getSectionsForClass,
} from '@/lib/constants';
import { apiFetch, saveClientSession } from '@/lib/client-api';
import { AuthTokenPayload } from '@/lib/types';
import { ArrowLeft, ArrowRight, CheckCircle, Info } from '@phosphor-icons/react';

function StudentLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rollNumber, setRollNumber] = useState('');
  const [selectedClass, setSelectedClass] = useState<number>(8);
  const [section, setSection] = useState<string>('A');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredBanner, setRegisteredBanner] = useState(false);

  useEffect(() => {
    const reg = searchParams.get('registered');
    const r = searchParams.get('roll');
    const c = Number(searchParams.get('class'));
    const s = searchParams.get('section');

    if (reg === '1') setRegisteredBanner(true);
    if (r) setRollNumber(r);
    if (c >= 6 && c <= 12) {
      setSelectedClass(c);
      const validSecs = getSectionsForClass(c);
      if (s && validSecs.includes(s)) {
        setSection(s);
      } else {
        setSection(validSecs[0]);
      }
    }
  }, [searchParams]);

  const handleClassChange = (newClass: number) => {
    setSelectedClass(newClass);
    const validSections = getSectionsForClass(newClass);
    if (!validSections.includes(section)) {
      setSection(validSections[0]);
    }
  };

  const fillDemoStudent = (roll: string, cls: number, sec: string) => {
    setRollNumber(roll);
    setSelectedClass(cls);
    setSection(sec);
    setPassword('student123');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { ok, data } = await apiFetch<{
      error?: string;
      token?: string;
      user?: AuthTokenPayload;
    }>('/api/auth/student/login', {
      method: 'POST',
      body: JSON.stringify({
        roll_number: rollNumber,
        class: selectedClass,
        section,
        password,
      }),
    });

    setLoading(false);
    if (!ok || !data.token || !data.user) {
      setError(data.error || 'We could not sign you in. Check your details and try again.');
      return;
    }

    saveClientSession(data.token, data.user);
    router.push('/student/dashboard');
  };

  const sections = getSectionsForClass(selectedClass);
  const sectionLabel = getSectionFieldLabel(selectedClass);

  return (
    <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 sm:p-10 border border-slate-200/70 shadow-diffusion animate-fade-in">
      <div className="mb-7">
        <MaplesLogo size="sm" />
        <h1 className="mt-5 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
          Student sign in
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Enter your school roll number and class to access your quiz dashboard.
        </p>
      </div>

      {registeredBanner && (
        <div className="mb-5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium flex items-center gap-2.5">
          <CheckCircle size={18} weight="regular" className="text-maple-600 shrink-0" />
          <span>Account created. Enter your password below to continue.</span>
        </div>
      )}

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
            htmlFor="login-roll"
            className="text-sm font-medium text-slate-700"
          >
            Roll number
          </label>
          <input
            id="login-roll"
            type="text"
            required
            placeholder="e.g. 802"
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:border-maple-500 outline-none text-sm font-mono tabular-nums transition"
          />
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="login-class"
              className="text-sm font-medium text-slate-700"
            >
              Class
            </label>
            <select
              id="login-class"
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
              htmlFor="login-section"
              className="text-sm font-medium text-slate-700"
            >
              {sectionLabel}
            </label>
            <select
              id="login-section"
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

        <div className="flex flex-col gap-2">
          <label
            htmlFor="login-password"
            className="text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300/90 bg-white focus:border-maple-500 outline-none text-sm transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] mt-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-2 transition duration-200"
        >
          <span>{loading ? 'Signing in...' : 'Continue to dashboard'}</span>
          {!loading && <ArrowRight size={16} weight="regular" />}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100 text-sm text-slate-600">
        First time here?{' '}
        <Link
          href="/student/register"
          className="font-semibold text-maple-600 hover:text-maple-700 transition-colors"
        >
          Register roll number
        </Link>
      </div>

      {/* Quick Demo Fill Helper */}
      <details className="mt-5 rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700 flex items-center gap-1.5 select-none">
          <Info size={15} weight="regular" className="text-maple-600" />
          Sample student accounts (click to fill)
        </summary>
        <div className="mt-2.5 space-y-2">
          <p className="text-slate-500">
            Ready to attempt quiz (password:{' '}
            <code className="font-mono text-slate-700">student123</code>):
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => fillDemoStudent('601', 6, 'A')}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 active:scale-[0.98] font-mono text-slate-700 transition"
            >
              6-A · 601
            </button>
            <button
              type="button"
              onClick={() => fillDemoStudent('802', 8, 'B')}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 active:scale-[0.98] font-mono text-slate-700 transition"
            >
              8-B · 802
            </button>
            <button
              type="button"
              onClick={() => fillDemoStudent('1101', 11, 'Maths')}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 active:scale-[0.98] font-mono text-slate-700 transition"
            >
              11-Maths · 1101
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}

export default function StudentLoginPage() {
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
        <Suspense
          fallback={
            <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 border border-slate-200/70 space-y-4">
              <div className="h-8 w-36 rounded-lg skeleton-shimmer" />
              <div className="h-6 w-48 rounded-lg skeleton-shimmer" />
              <div className="h-11 w-full rounded-xl skeleton-shimmer" />
              <div className="h-11 w-full rounded-xl skeleton-shimmer" />
            </div>
          }
        >
          <StudentLoginForm />
        </Suspense>
      </div>

      <div className="text-center text-xs text-slate-400">
        Maples Tech Club · Maples Academy, Khatauli
      </div>
    </main>
  );
}
