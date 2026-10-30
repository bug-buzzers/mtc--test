'use client';

import React, { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import { apiFetch } from '@/lib/client-api';
import { ArrowClockwise, LockKeyOpen, ShieldWarning } from '@phosphor-icons/react';

type BlockedAttempt = { id: string; class: number; blocked_at: string | null; blocked_reason: string | null; tab_switch_warnings: number; remaining_seconds_when_blocked: number | null; students: { full_name: string; roll_number: string; section: string } | null };
const labels: Record<string, string> = { tab_hidden: 'Repeated tab switch', fullscreen_exit: 'Full-screen exit', quit: 'Left the exam page', heartbeat_timeout: 'Connection or heartbeat interrupted' };

export default function IntegrityReviewPage() {
  const [attempts, setAttempts] = useState<BlockedAttempt[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const { ok, data } = await apiFetch<{ attempts?: BlockedAttempt[]; error?: string }>('/api/admin/integrity'); if (!ok) throw new Error(data.error || 'Unable to load attempts.'); setAttempts(data.attempts || []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Connection failed.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function unlock(a: BlockedAttempt) {
    if (!window.confirm(`Unlock ${a.students?.full_name || 'this student'}? Their remaining time will be restored, with at least one minute to reconnect.`)) return;
    setBusy(a.id); setError(''); setNotice('');
    try { const { ok, data } = await apiFetch<{ message?: string; error?: string }>(`/api/admin/integrity/${a.id}/unlock`, { method: 'POST' }); if (!ok) throw new Error(data.error || 'Unable to unlock.'); setNotice(data.message || 'Attempt unlocked.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Connection failed.'); } finally { setBusy(''); }
  }
  return <AdminShell title="Exam integrity" subtitle="Review interruptions before deciding whether a student can resume." actions={<button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium"><ArrowClockwise size={16} /> Refresh</button>}>
    <div className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><ShieldWarning size={20} className="mt-0.5 shrink-0" /><p>Interruptions can be accidental, including a phone call or lost connection. A lock is a signal to review, not proof of cheating. When unlocked, the saved time is restored; the student should resume promptly.</p></div>
    {notice && <p role="status" className="mb-4 rounded-xl bg-forest-50 p-3 text-sm text-forest-600">{notice}</p>}{error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {loading ? <div className="h-32 rounded-2xl skeleton-shimmer" /> : attempts.length === 0 ? <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center"><h2 className="font-semibold text-slate-900">No locked attempts</h2><p className="mt-2 text-sm text-slate-500">Students who need a review will appear here.</p></div> : <div className="space-y-3">{attempts.map((a) => <article key={a.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{a.students?.full_name || 'Student unavailable'}</h2><span className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">{labels[a.blocked_reason || ''] || 'Exam interruption'}</span></div><p className="mt-1 text-sm text-slate-500">Class {a.class} · {a.students?.section} · Roll {a.students?.roll_number}</p><p className="mt-1 text-xs text-slate-400">Locked {a.blocked_at ? new Date(a.blocked_at).toLocaleString('en-IN') : '—'} · {Math.ceil((a.remaining_seconds_when_blocked || 0)/60)} min remaining · {a.tab_switch_warnings} tab switch{a.tab_switch_warnings === 1 ? '' : 'es'} recorded</p></div><button disabled={busy === a.id} onClick={() => void unlock(a)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><LockKeyOpen size={16} />{busy === a.id ? 'Unlocking…' : 'Review & unlock'}</button></article>)}</div>}
  </AdminShell>;
}
