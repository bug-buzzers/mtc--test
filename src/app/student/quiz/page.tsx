'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MaplesLogo from '@/components/MaplesLogo';
import { apiFetch } from '@/lib/client-api';
import { OptionKey, StudentFacingQuestion } from '@/lib/types';
import { ArrowLeft, ArrowRight, Check, Clock, LockSimple, PaperPlaneTilt, ShieldWarning, WarningCircle } from '@phosphor-icons/react';

interface StartQuizResponse {
  error?: string; blocked?: boolean; attempt_id?: string; class?: number; remaining_seconds?: number;
  tab_switch_warnings?: number; questions?: StudentFacingQuestion[];
}
type Phase = 'instructions' | 'starting' | 'active' | 'blocked';
type IntegrityReply = { status?: string; tab_switch_warnings?: number; error?: string };

export default function StudentQuizPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('instructions');
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState('');
  const [attemptId, setAttemptId] = useState('');
  const [examClass, setExamClass] = useState(0);
  const [questions, setQuestions] = useState<StudentFacingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, OptionKey | null>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [needsFullscreen, setNeedsFullscreen] = useState(false);
  const [integrityPending, setIntegrityPending] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [connectionNotice, setConnectionNotice] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const answersRef = useRef(answers);
  const attemptRef = useRef('');
  const activeRef = useRef(false);
  const finishingRef = useRef(false);
  const submittingRef = useRef(false);
  const autoSubmitStarted = useRef(false);
  const hiddenRef = useRef(false);
  const fullscreenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockDeadline = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const integrityQueue = useRef<Promise<void>>(Promise.resolve());

  const lockLocally = useCallback((text: string) => {
    activeRef.current = false;
    setPhase('blocked'); setConfirm(false); setMessage(text);
  }, []);

  const reportViolation = useCallback(async (event: 'tab_hidden' | 'fullscreen_exit' | 'quit') => {
    const id = attemptRef.current;
    if (!id || finishingRef.current) return;
    if (event !== 'tab_hidden') lockLocally('Your quiz is locked because the exam screen was left. Ask your teacher to review and unlock it.');
    else setIntegrityPending(true);
    try {
      const { ok, data } = await apiFetch<IntegrityReply>('/api/quiz/violation', { method: 'POST', body: JSON.stringify({ attempt_id: id, event }), signal: AbortSignal.timeout(10000) });
      if (!ok) throw new Error(data.error || 'Could not record the interruption.');
      setWarnings(data.tab_switch_warnings || 0);
      if (data.status === 'blocked') lockLocally('Your quiz is locked after an exam interruption. Ask your teacher to review and unlock it.');
      else if (data.status === 'graded' || data.status === 'submitted') {
        finishingRef.current = true; activeRef.current = false;
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        router.replace(`/student/submitted?attempt=${encodeURIComponent(attemptRef.current)}&auto=1`);
      } else if (event === 'tab_hidden') {
        setMessage('Warning: you left the exam tab. A second switch will lock your attempt.');
      }
    } catch {
      lockLocally('The interruption could not be verified. Your exam is paused; reconnect and ask your teacher for help.');
    } finally { setIntegrityPending(false); }
  }, [lockLocally, router]);

  // Serialize integrity reports and wait for them before submission so a tab
  // violation cannot be overtaken by the final grading request.
  const enqueueViolation = useCallback((event: 'tab_hidden' | 'fullscreen_exit' | 'quit') => {
    const next = integrityQueue.current.then(() => reportViolation(event));
    integrityQueue.current = next;
    return next;
  }, [reportViolation]);

  const begin = async () => {
    if (!agreed || phase !== 'instructions') return;
    setMessage('');
    if (!document.documentElement.requestFullscreen) { setMessage('Full screen is not supported on this browser. Please use a supported browser or ask your teacher for help.'); return; }
    try {
      // Must be invoked directly by the student's click, before any network request.
      await document.documentElement.requestFullscreen();
    } catch {
      setMessage('Full-screen permission is required. Try opening the portal in a new browser tab, or ask your teacher for help.'); return;
    }
    setPhase('starting');
    try {
      const { ok, status, data } = await apiFetch<StartQuizResponse>('/api/quiz/start', { method: 'POST', body: JSON.stringify({ acknowledged: true, fullscreen: true }) });
      if (!ok || !data.attempt_id || !data.questions?.length) {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        if (status === 423 || data.blocked) { lockLocally(data.error || 'Your attempt is locked. Ask your teacher to unlock it.'); return; }
        setPhase('instructions'); setMessage(data.error || 'Could not start the exam.'); return;
      }
      attemptRef.current = data.attempt_id; finishingRef.current = false; hiddenRef.current = false; autoSubmitStarted.current = false;
      setAttemptId(data.attempt_id); setExamClass(data.class || 0); setQuestions(data.questions);
      const initial: Record<string, OptionKey | null> = {};
      for (const q of data.questions) initial[q.response_id] = q.selected_option;
      answersRef.current = initial; setAnswers(initial);
      const seconds = Math.max(0, data.remaining_seconds || 0);
      clockDeadline.current = Date.now() + seconds * 1000;
      setRemaining(seconds); setWarnings(data.tab_switch_warnings || 0); setNeedsFullscreen(false);
      activeRef.current = true; setPhase('active');
      // Full screen may have ended while the start request was in flight.
      if (!document.fullscreenElement) void enqueueViolation('fullscreen_exit');
    } catch {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setPhase('instructions'); setMessage('Could not connect to the exam. Please retry or contact your teacher.');
    }
  };

  const submitExam = useCallback(async (automatic = false) => {
    if (!attemptRef.current || submittingRef.current || !activeRef.current) return;
    submittingRef.current = true; setSubmitting(true); setConfirm(false); setMessage('');
    try {
      await integrityQueue.current;
      if (!activeRef.current) return;
      const payload = questions.map((q) => ({ response_id: q.response_id, selected_option: answersRef.current[q.response_id] ?? null }));
      const { ok, status, data } = await apiFetch<{ status?: string; blocked?: boolean; error?: string }>('/api/quiz/submit', { method: 'POST', body: JSON.stringify({ attempt_id: attemptRef.current, responses: payload }), signal: AbortSignal.timeout(15000) });
      if (status === 423 || data.blocked) { lockLocally(data.error || 'Your attempt is locked. Contact your teacher.'); return; }
      if (!ok || data.status !== 'submitted') throw new Error(data.error || 'Submission was not confirmed.');
      finishingRef.current = true; activeRef.current = false;
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      router.replace(`/student/submitted?attempt=${encodeURIComponent(attemptRef.current)}${automatic ? '&auto=1' : ''}`);
    } catch (error) {
      setMessage(error instanceof Error ? `${error.message} Please retry or contact your teacher.` : 'Submission was not confirmed. Please retry or contact your teacher.');
    } finally { submittingRef.current = false; setSubmitting(false); }
  }, [questions, router, lockLocally]);

  useEffect(() => {
    if (phase !== 'active' || !attemptId) return;
    const beforeUnload = (e: BeforeUnloadEvent) => { if (activeRef.current && !finishingRef.current) { e.preventDefault(); e.returnValue = ''; } };
    const pageHide = () => {
      if (!activeRef.current || finishingRef.current) return;
      const payload = JSON.stringify({ attempt_id: attemptRef.current, event: 'quit' });
      navigator.sendBeacon('/api/quiz/violation', new Blob([payload], { type: 'application/json' }));
    };
    const visibility = () => {
      if (!activeRef.current || finishingRef.current) return;
      if (document.visibilityState === 'hidden' && !hiddenRef.current) {
        hiddenRef.current = true;
        if (fullscreenTimer.current) clearTimeout(fullscreenTimer.current);
        void enqueueViolation('tab_hidden');
      } else if (document.visibilityState === 'visible' && hiddenRef.current) {
        hiddenRef.current = false;
        if (!document.fullscreenElement) setNeedsFullscreen(true);
      }
    };
    const fullscreenChange = () => {
      if (!activeRef.current || finishingRef.current || document.fullscreenElement || document.visibilityState === 'hidden' || hiddenRef.current) return;
      if (fullscreenTimer.current) clearTimeout(fullscreenTimer.current);
      // Tab switches can themselves end full screen in some browsers. Treat that
      // as the tab warning rather than a separate full-screen violation.
      fullscreenTimer.current = setTimeout(() => {
        if (activeRef.current && !document.fullscreenElement && document.visibilityState === 'visible' && !hiddenRef.current) void enqueueViolation('fullscreen_exit');
      }, 400);
    };
    const pop = () => { if (activeRef.current && !finishingRef.current) { history.pushState(null, '', location.href); void enqueueViolation('quit'); } };
    history.pushState(null, '', location.href);
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('pagehide', pageHide);
    document.addEventListener('visibilitychange', visibility); document.addEventListener('fullscreenchange', fullscreenChange); window.addEventListener('popstate', pop);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('pagehide', pageHide);
      document.removeEventListener('visibilitychange', visibility); document.removeEventListener('fullscreenchange', fullscreenChange); window.removeEventListener('popstate', pop);
      if (fullscreenTimer.current) clearTimeout(fullscreenTimer.current);
    };
  }, [phase, attemptId, enqueueViolation]);

  useEffect(() => {
    if (phase !== 'active' || !attemptId) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((clockDeadline.current - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && !autoSubmitStarted.current && activeRef.current) { autoSubmitStarted.current = true; void submitExam(true); }
    };
    const timer = setInterval(tick, 1000); tick();
    const pulse = async () => {
      if (!activeRef.current || finishingRef.current) return;
      try {
        const { ok, status, data } = await apiFetch<IntegrityReply & { remaining_seconds?: number }>('/api/quiz/heartbeat', { method: 'POST', body: JSON.stringify({ attempt_id: attemptId }), signal: AbortSignal.timeout(10000) });
        if (!ok) { if (status === 401) lockLocally('Your session expired. Ask your teacher for help.'); else setConnectionNotice('Connection interrupted. Reconnect quickly; prolonged disconnection locks the exam.'); return; }
        setConnectionNotice('');
        if (data.status === 'blocked') { lockLocally('Your attempt is locked after an interruption. Ask your teacher to review it.'); return; }
        if (data.status === 'graded' || data.status === 'submitted') { finishingRef.current = true; activeRef.current = false; if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); router.replace(`/student/submitted?attempt=${encodeURIComponent(attemptRef.current)}&auto=1`); return; }
        if (typeof data.remaining_seconds === 'number') { clockDeadline.current = Date.now() + Math.max(0, data.remaining_seconds) * 1000; setRemaining(data.remaining_seconds); }
        setWarnings(data.tab_switch_warnings || 0);
      } catch { setConnectionNotice('Connection interrupted. Reconnect quickly; prolonged disconnection locks the exam.'); }
    };
    const heartbeat = setInterval(pulse, 15000);
    return () => { clearInterval(timer); clearInterval(heartbeat); };
  }, [phase, attemptId, submitExam, lockLocally, router]);

  function selectAnswer(id: string, value: OptionKey) {
    if (!activeRef.current || needsFullscreen || integrityPending) return;
    const next = { ...answersRef.current, [id]: value }; answersRef.current = next; setAnswers(next);
    saveQueue.current = saveQueue.current.then(async () => {
      const { ok, status, data } = await apiFetch<{ error?: string; blocked?: boolean }>('/api/quiz/save', { method: 'PATCH', body: JSON.stringify({ attempt_id: attemptRef.current, responses: [{ response_id: id, selected_option: value }] }), signal: AbortSignal.timeout(10000) });
      if (status === 423 || data.blocked) { lockLocally(data.error || 'Your exam is locked.'); return; }
      if (!ok) throw new Error(data.error || 'Save failed');
      setSaveNotice('');
    }).catch(() => { setSaveNotice('This answer could not be saved yet. Keep this page open; your final submission will retry all answers.'); });
  }

  async function returnToFullscreen() {
    try { await document.documentElement.requestFullscreen(); setNeedsFullscreen(false); }
    catch { setMessage('Full screen is required. Please re-enter full screen to continue.'); }
  }
  async function leaveBlocked() {
    finishingRef.current = true; activeRef.current = false;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    router.replace('/student/dashboard');
  }

  if (phase === 'instructions' || phase === 'starting') return <main id="main-content" className="min-h-[100dvh] bg-[#F9FAFB] px-4 py-8 sm:py-12"><div className="mx-auto max-w-3xl"><MaplesLogo size="sm" /><div className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-diffusion sm:p-10"><span className="inline-flex items-center gap-2 rounded-full bg-maple-100 px-3 py-1.5 text-xs font-semibold text-maple-700"><ShieldWarning size={16} /> Before you begin</span><h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Read the exam rules</h1><p className="mt-2 text-sm leading-6 text-slate-600">Your teacher can help if a technical interruption occurs. The timer starts only after you enter full screen and the exam opens.</p><ul className="mt-6 space-y-3 text-sm leading-6 text-slate-700"><li>• Full screen is required for the entire exam. Leaving it locks your attempt.</li><li>• The first tab switch is a warning; a second switch locks the attempt.</li><li>• Closing, refreshing, navigating away, or a connection interruption longer than 60 seconds can lock your attempt.</li><li>• Only your teacher can review and unlock a locked attempt. Keep your device charged and stay connected.</li><li>• Some mobile browsers do not support full screen. Use a supported browser or contact your teacher.</li></ul><p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Browser monitoring cannot prevent every form of cheating or reliably distinguish an interruption from misconduct. An administrator should review every lock.</p><label className="mt-6 flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-800"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-maple-600" />I understand the rules and am ready to start in full screen.</label>{message && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}<div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={!agreed || phase === 'starting'} onClick={begin} className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{phase === 'starting' ? 'Preparing exam…' : 'Enter full screen & start'} <ArrowRight size={16} /></button><button type="button" disabled={phase === 'starting'} onClick={() => router.push('/student/dashboard')} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700">Back to dashboard</button></div></div></div></main>;

  if (phase === 'blocked') return <main id="main-content" className="flex min-h-[100dvh] items-center justify-center bg-[#F9FAFB] p-5"><div className="w-full max-w-md rounded-[2rem] border border-rose-100 bg-white p-8 shadow-diffusion"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><LockSimple size={24} /></div><h1 className="mt-5 text-2xl font-semibold text-slate-900">Exam locked</h1><p role="alert" className="mt-3 text-sm leading-6 text-slate-600">{message || 'Ask your teacher to review your attempt.'}</p><button onClick={leaveBlocked} className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Return to dashboard</button></div></main>;

  const q = questions[current];
  if (!q) return null;
  const answered = questions.filter((item) => answers[item.response_id]).length;
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0'), seconds = String(remaining % 60).padStart(2, '0');
  return <div className="min-h-[100dvh] bg-[#F9FAFB] text-slate-900"><header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3"><div className="flex items-center gap-3"><MaplesLogo size="sm" /><div className="border-l border-slate-200 pl-3"><p className="text-xs text-slate-500">Class {examClass} · entrance quiz</p><p className="text-sm font-semibold">{answered} of {questions.length} answered</p></div></div><div aria-live="polite" className={`flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-sm font-semibold ${remaining <= 300 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'}`}><Clock size={17} />{minutes}:{seconds}</div></div><div className="h-1 bg-slate-100"><div className="h-full bg-maple-500 transition-all" style={{ width: `${answered / questions.length * 100}%` }} /></div></header>
    <main id="main-content" className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[1fr_230px]">
      <div className="space-y-4">{message && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}{connectionNotice && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{connectionNotice}</div>}{saveNotice && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{saveNotice}</div>}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-diffusion sm:p-8"><div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4 text-xs font-medium"><span className="font-mono text-maple-600">QUESTION {current + 1} / {questions.length}</span><span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">{q.subject_tag}</span></div><h1 className="text-lg font-semibold leading-7 sm:text-xl">{q.question_text}</h1><div className="mt-6 space-y-2.5">{(['a','b','c','d'] as const).map((key) => { const selected = answers[q.response_id] === key; return <button key={key} type="button" aria-pressed={selected} disabled={needsFullscreen || integrityPending || submitting || remaining === 0} onClick={() => selectAnswer(q.response_id, key)} className={`flex min-h-[54px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${selected ? 'border-maple-500 bg-maple-100/60 font-medium' : 'border-slate-200 bg-white hover:bg-slate-50'} disabled:opacity-60`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono font-semibold uppercase ${selected ? 'bg-maple-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{key}</span><span className="flex-1">{q[`option_${key}`]}</span>{selected && <Check size={17} className="text-maple-600" />}</button>; })}</div><div className="mt-7 flex items-center justify-between gap-3"><button type="button" disabled={current === 0} onClick={() => setCurrent((v) => v-1)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium disabled:opacity-40"><ArrowLeft size={16} /> Previous</button>{current < questions.length-1 ? <button type="button" onClick={() => setCurrent((v) => v+1)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">Next <ArrowRight size={16} /></button> : <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-2 rounded-xl bg-maple-500 px-4 py-2.5 text-sm font-semibold text-white"><PaperPlaneTilt size={16} /> Submit exam</button>}</div></section>
      </div>
      <aside className="h-fit rounded-[2rem] border border-slate-200 bg-white p-5 shadow-diffusion"><div className="flex items-center justify-between"><h2 className="font-semibold">Question map</h2><span className="text-xs text-slate-500">{answered}/{questions.length}</span></div><div className="mt-4 grid grid-cols-5 gap-2">{questions.map((item, i) => <button key={item.response_id} type="button" aria-label={`Question ${i+1}${answers[item.response_id] ? ', answered' : ', unanswered'}`} aria-current={i === current ? 'step' : undefined} onClick={() => setCurrent(i)} className={`aspect-square rounded-lg border text-xs font-mono font-semibold ${i === current ? 'border-slate-900 bg-slate-900 text-white' : answers[item.response_id] ? 'border-forest-500/30 bg-forest-50 text-forest-600' : 'border-slate-200 text-slate-500'}`}>{i+1}</button>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">{warnings ? 'Your one tab-switch warning has been used.' : 'Keep this tab open and stay in full screen.'}</p><button type="button" onClick={() => setConfirm(true)} className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Review & submit</button></aside>
    </main>
    {(needsFullscreen || integrityPending) && <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4"><div className="w-full max-w-md rounded-[2rem] bg-white p-7"><WarningCircle size={26} className="text-maple-600" /><h2 className="mt-3 text-xl font-semibold">{integrityPending ? 'Checking the interruption' : 'Return to full screen'}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{integrityPending ? 'Please wait while the exam records this event.' : 'Your first tab switch is a warning. A second switch will lock your attempt.'}</p>{needsFullscreen && !integrityPending && <button type="button" onClick={returnToFullscreen} className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Re-enter full screen</button>}</div></div>}
    {confirm && <div role="dialog" aria-modal="true" aria-labelledby="submit-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div className="w-full max-w-md rounded-[2rem] bg-white p-7"><h2 id="submit-title" className="text-xl font-semibold">Submit your exam?</h2><p className="mt-3 text-sm leading-6 text-slate-600">You answered {answered} of {questions.length} questions. {questions.length-answered > 0 ? `${questions.length-answered} unanswered questions will be marked incorrect.` : 'You have answered every question.'} You cannot change answers after submitting.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium">Keep working</button><button disabled={submitting} onClick={() => void submitExam(false)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Submitting…' : 'Confirm submit'}</button></div></div></div>}
  </div>;
}
