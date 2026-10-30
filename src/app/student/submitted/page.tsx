'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import MaplesLogo from '@/components/MaplesLogo';
import { apiFetch } from '@/lib/client-api';
import { StudentAttemptHistoryItem } from '@/lib/types';
import { ArrowLeft, CheckCircle, Clock, ListChecks, WarningCircle } from '@phosphor-icons/react';

function SubmittedCard() {
  const params = useSearchParams();
  const attemptId = params.get('attempt');
  const auto = params.get('auto') === '1';
  const [state, setState] = useState<'checking' | 'confirmed' | 'unconfirmed'>('checking');
  const [attempt, setAttempt] = useState<StudentAttemptHistoryItem | null>(null);
  useEffect(() => {
    let mounted = true;
    if (!attemptId) { setState('unconfirmed'); return; }
    apiFetch<{ history?: StudentAttemptHistoryItem[] }>('/api/quiz/status').then(({ ok, data }) => {
      if (!mounted) return;
      const found = ok ? data.history?.find((h) => h.id === attemptId && h.status === 'submitted') : undefined;
      if (found) { setAttempt(found); setState('confirmed'); } else setState('unconfirmed');
    }).catch(() => { if (mounted) setState('unconfirmed'); });
    return () => { mounted = false; };
  }, [attemptId]);

  if (state === 'checking') return <div className="w-full max-w-lg rounded-[2.5rem] border border-slate-200 bg-white p-8 text-sm text-slate-600">Checking your submission…</div>;
  if (state === 'unconfirmed') return <div className="w-full max-w-lg rounded-[2.5rem] border border-rose-100 bg-white p-8 shadow-diffusion"><WarningCircle size={30} className="text-rose-600" /><h1 className="mt-4 text-2xl font-semibold text-slate-900">Submission not confirmed</h1><p className="mt-3 text-sm leading-6 text-slate-600">We could not confirm this attempt. Check your dashboard and connection, or contact your teacher before leaving.</p><Link href="/student/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"><ArrowLeft size={16} /> Dashboard</Link></div>;
  return <div className="w-full max-w-lg rounded-[2.5rem] border border-slate-200/70 bg-white p-8 shadow-diffusion sm:p-10"><MaplesLogo size="sm" /><div className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-50 text-forest-600"><CheckCircle size={26} /></div><h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Your quiz has been submitted.</h1>
    {auto && <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"><Clock size={14} /> Time ended — your submission was recorded.</div>}
    {attempt?.can_view_result ? <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-medium text-maple-600">Result published by your teacher</p><p className="mt-1 font-mono text-2xl font-semibold text-slate-900">{attempt.correct_count}/{attempt.total_questions} <span className="text-sm font-normal text-slate-500">({attempt.score_percentage}%)</span></p></div> : <p className="mt-3 text-sm leading-6 text-slate-600">Your submission is recorded. Your scorecard and answer review will appear when your teacher publishes results.</p>}
    <div className="mt-8 flex flex-wrap gap-3">{attempt?.can_view_result && <Link href={`/student/result/${attempt.id}`} className="inline-flex items-center gap-2 rounded-xl bg-maple-500 px-5 py-3 text-sm font-medium text-white"><ListChecks size={17} /> View scorecard</Link>}<Link href="/student/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"><ArrowLeft size={16} /> Dashboard</Link></div>
  </div>;
}

export default function StudentSubmittedPage() {
  return <main id="main-content" className="flex min-h-[100dvh] items-center justify-center bg-[#F9FAFB] p-4"><Suspense fallback={<div className="w-full max-w-lg rounded-[2.5rem] bg-white p-8">Checking your submission…</div>}><SubmittedCard /></Suspense></main>;
}
