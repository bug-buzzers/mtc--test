'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { CLASSES } from '@/lib/constants';
import { apiFetch } from '@/lib/client-api';
import { Question } from '@/lib/types';
import { reviewOptionLengths } from '@/lib/option-length-review';
import { ArrowLeft, ArrowRight, MagnifyingGlass, PencilSimple, Plus, Trash, UploadSimple } from '@phosphor-icons/react';

function parseCsvLine(line: string): string[] {
  const fields: string[] = []; let value = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { fields.push(value.trim()); value = ''; }
    else value += ch;
  }
  if (quoted) throw new Error('An opening quote has not been closed.');
  fields.push(value.trim()); return fields;
}

type Listing = { questions: Question[]; total: number; class_counts: Array<{ class: number; total: number }> };

function QuestionsBankContent() {
  const query = useSearchParams();
  const [classFilter, setClassFilter] = useState(query.get('class') || 'all');
  const [difficulty, setDifficulty] = useState('all');
  const [topic, setTopic] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('class');
  const [lengthReview, setLengthReview] = useState(() => { const value = query.get('length_review'); return value === 'correct_longest' || value === 'uneven' ? value : 'all'; });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [listing, setListing] = useState<Listing>({ questions: [], total: 0, class_counts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ class: classFilter, difficulty, subject_tag: topic.trim(), search: debouncedSearch, sort, length_review: lengthReview, page: String(page), page_size: String(pageSize) });
    setLoading(true); setError('');
    apiFetch<Listing & { error?: string }>(`/api/admin/questions?${params}`, { signal: controller.signal }).then(({ ok, data }) => {
      if (!ok) { setError(data.error || 'Unable to load questions.'); return; }
      const lastPage = Math.max(1, Math.ceil(data.total / pageSize));
      if (page > lastPage) { setPage(lastPage); return; }
      setListing({ questions: data.questions || [], total: data.total || 0, class_counts: data.class_counts || [] });
    }).catch((e) => { if (e.name !== 'AbortError') setError('Connection failed. Please try again.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [classFilter, difficulty, topic, debouncedSearch, sort, lengthReview, page, pageSize, refresh]);

  const pages = Math.max(1, Math.ceil(listing.total / pageSize));
  async function deactivate() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const result = await apiFetch<{ error?: string }>(`/api/admin/questions/${deleteTarget.id}`, { method: 'DELETE' });
      if (!result.ok) { setError(result.data.error || 'Could not deactivate question.'); return; }
      setDeleteTarget(null); setRefresh((v) => v + 1);
    } catch { setError('Connection failed. Please try again.'); } finally { setBusy(false); }
  }
  async function importCsv() {
    setImportMessage('');
    try {
      const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) throw new Error('Paste one or more CSV rows.');
      const start = lines[0].toLowerCase().startsWith('class,') ? 1 : 0;
      const questions = lines.slice(start).map((line, i) => {
        const cols = parseCsvLine(line);
        if (cols.length !== 9) throw new Error(`Row ${i + start + 1}: expected 9 columns.`);
        return { class: Number(cols[0]), subject_tag: cols[1], difficulty: cols[2], question_text: cols[3], option_a: cols[4], option_b: cols[5], option_c: cols[6], option_d: cols[7], correct_option: cols[8] };
      });
      setBusy(true);
      const { ok, data } = await apiFetch<{ error?: string; message?: string; count?: number; length_review?: { correct_longest: number; uneven: number } }>('/api/admin/questions', { method: 'POST', body: JSON.stringify({ questions }) });
      if (!ok) { setImportMessage(data.error || 'Import failed.'); return; }
      setImportNotice(`Imported ${data.count ?? questions.length} questions. ${data.length_review?.correct_longest ?? 0} have the correct answer among the longest options; ${data.length_review?.uneven ?? 0} have uneven option lengths.`);
      setImportOpen(false); setCsv(''); setPage(1); setRefresh((v) => v + 1);
    } catch (e) { setImportMessage(e instanceof Error ? e.message : 'Import failed.'); } finally { setBusy(false); }
  }
  const field = 'w-full min-h-[43px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
  return <AdminShell title="Question bank" subtitle="Find, edit and privately import questions. Previously exposed questions are disabled." actions={<>
    <button type="button" onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"><UploadSimple size={16} /> CSV import</button>
    <Link href="/admin/questions/new" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"><Plus size={16} /> Add question</Link>
  </>}>
    <div className="mb-5 flex flex-wrap gap-2" aria-label="Class shortcuts">
      <button onClick={() => { setClassFilter('all'); setPage(1); }} className={`rounded-xl border px-3 py-2 text-xs font-medium ${classFilter === 'all' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>All classes</button>
      {listing.class_counts.map((c) => <button key={c.class} onClick={() => { setClassFilter(String(c.class)); setPage(1); }} className={`rounded-xl border px-3 py-2 text-xs font-medium ${classFilter === String(c.class) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>Class {c.class} <span className="ml-1 font-mono opacity-70">{c.total}</span></button>)}
    </div>
    <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <div><label htmlFor="q-search" className="mb-1 block text-xs font-medium text-slate-500">Search questions</label><div className="relative"><MagnifyingGlass size={16} className="absolute left-3 top-3.5 text-slate-400" /><input id="q-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search wording…" className={`${field} pl-9`} /></div></div>
      <div><label htmlFor="q-class" className="mb-1 block text-xs font-medium text-slate-500">Class</label><select id="q-class" value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage(1); }} className={field}><option value="all">All classes</option>{CLASSES.map((c) => <option value={c} key={c}>Class {c}</option>)}</select></div>
      <div><label htmlFor="q-diff" className="mb-1 block text-xs font-medium text-slate-500">Difficulty</label><select id="q-diff" value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setPage(1); }} className={field}><option value="all">All difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
      <div><label htmlFor="q-topic" className="mb-1 block text-xs font-medium text-slate-500">Exact topic</label><input id="q-topic" value={topic} onChange={(e) => { setTopic(e.target.value); setPage(1); }} placeholder="All topics" className={field} /></div>
      <div><label htmlFor="q-sort" className="mb-1 block text-xs font-medium text-slate-500">Sort by</label><select id="q-sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={field}><option value="class">Class</option><option value="newest">Newest</option><option value="topic">Topic</option><option value="difficulty">Difficulty</option><option value="question">Question text</option></select></div>
      <div><label htmlFor="q-length-review" className="mb-1 block text-xs font-medium text-slate-500">Length review</label><select id="q-length-review" value={lengthReview} onChange={(e) => { setLengthReview(e.target.value); setPage(1); }} className={field}><option value="all">All questions</option><option value="correct_longest">Correct answer among longest</option><option value="uneven">Uneven option lengths</option></select></div>
    </div>
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"><strong>Reduce answer-length clues.</strong> Filter the entire active private bank, then edit flagged questions. Give incorrect options plausible, comparable detail without changing which answer is correct. This is a heuristic, not an automatic rewrite or proof a question is fair.</div>
    {importNotice && <div role="status" className="mb-4 rounded-xl border border-forest-500/30 bg-forest-50 p-3 text-sm text-forest-600">{importNotice} <button onClick={() => { setClassFilter('all'); setDifficulty('all'); setTopic(''); setSearch(''); setDebouncedSearch(''); setLengthReview('correct_longest'); setPage(1); }} className="ml-1 font-semibold underline">Review length clues</button></div>}
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-slate-500"><span>{listing.total} matching question{listing.total === 1 ? '' : 's'}</span><label>Per page <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="ml-1 rounded-lg border border-slate-200 bg-white px-2 py-1">{[10,25,50].map((n) => <option key={n} value={n}>{n}</option>)}</select></label></div>
    {error && <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="space-y-3"><div className="h-28 rounded-2xl skeleton-shimmer" /><div className="h-28 rounded-2xl skeleton-shimmer" /></div> : listing.questions.length === 0 ? <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center"><h2 className="font-semibold text-slate-900">No questions found</h2><p className="mt-2 text-sm text-slate-500">Import a private bank or adjust your filters.</p></div> : <div className="space-y-3">
      {listing.questions.map((q) => { const review = reviewOptionLengths(q); return <article key={q.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-diffusion"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-2 text-xs"><span className="rounded-md bg-slate-900 px-2 py-1 font-mono text-white">Class {q.class}</span><span className="rounded-md bg-maple-100 px-2 py-1 capitalize text-maple-700">{q.difficulty}</span><span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{q.subject_tag}</span>{review.correctLongest ? <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900">Answer-length clue</span> : review.uneven ? <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-800">Uneven options</span> : null}</div><p className="font-medium leading-6 text-slate-900">{q.question_text}</p></div><div className="flex gap-2"><Link href={`/admin/questions/${q.id}/edit${lengthReview !== 'all' ? `?length_review=${lengthReview}&return_class=${classFilter}` : ''}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"><PencilSimple size={14} /> Edit</Link><button onClick={() => setDeleteTarget(q)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700"><Trash size={14} /> Deactivate</button></div></div>
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-xs font-medium text-slate-500">View options and correct answer</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{(['a','b','c','d'] as const).map((key) => <div key={key} className={`rounded-xl border px-3 py-2 ${q.correct_option === key ? 'border-forest-500/40 bg-forest-50 font-medium' : 'border-slate-100 bg-slate-50'}`}><span className="mr-2 font-mono uppercase">{key}.</span>{q[`option_${key}`]}{q.correct_option === key && <span className="ml-2 text-xs text-forest-600">Correct</span>}<span className="mt-1 block text-xs font-normal text-slate-500">{review.counts[key].words} words · {review.counts[key].characters} characters</span></div>)}</div></details>
      </article>; })}
    </div>}
    <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm"><span className="text-slate-500">Page {page} of {pages}</span><div className="flex gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((v) => v-1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"><ArrowLeft size={14} /> Previous</button><button disabled={page >= pages || loading} onClick={() => setPage((v) => v+1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40">Next <ArrowRight size={14} /></button></div></div>
    {deleteTarget && <div role="dialog" aria-modal="true" aria-labelledby="delete-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-md rounded-[2rem] bg-white p-7"><h2 id="delete-title" className="text-lg font-semibold">Deactivate question?</h2><p className="mt-2 text-sm text-slate-600">It will no longer be used in new exams. Existing answer sheets keep their original snapshot.</p><p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">{deleteTarget.question_text}</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setDeleteTarget(null)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button disabled={busy} onClick={deactivate} className="rounded-xl bg-rose-700 px-4 py-2 text-sm text-white disabled:opacity-50">Deactivate</button></div></div></div>}
    {importOpen && <div role="dialog" aria-modal="true" aria-labelledby="import-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-2xl rounded-[2rem] bg-white p-7"><h2 id="import-title" className="text-lg font-semibold">Import private questions</h2><p className="mt-2 text-sm text-slate-600">Paste CSV from a private source. Do not commit answer keys to Git. Import up to 500 rows at a time.</p><p className="mt-3 break-all rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-600">class,subject_tag,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option</p><textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={9} aria-label="CSV questions" placeholder="Paste CSV rows here" className="mt-3 w-full rounded-xl border border-slate-300 p-3 font-mono text-xs" />{importMessage && <p role="alert" className="mt-2 text-sm text-rose-700">{importMessage}</p>}<div className="mt-4 flex justify-end gap-2"><button onClick={() => { setImportOpen(false); setImportMessage(''); }} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button disabled={busy} onClick={importCsv} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? 'Importing…' : 'Import questions'}</button></div></div></div>}
  </AdminShell>;
}

export default function QuestionsBankPage() { return <Suspense fallback={<div className="p-8">Loading question bank…</div>}><QuestionsBankContent /></Suspense>; }
