import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { Question } from '../src/lib/types';

test('question editor exposes length clues and keeps the review filter after saving', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://school.test/admin/questions/test/edit?length_review=correct_longest&return_class=all', pretendToBeVisual: true });
  const setGlobal = (key: string, value: unknown) => Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  setGlobal('window', dom.window); setGlobal('self', dom.window); setGlobal('document', dom.window.document); setGlobal('navigator', dom.window.navigator);
  setGlobal('HTMLElement', dom.window.HTMLElement); setGlobal('Event', dom.window.Event); setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
  const { default: QuestionForm } = await import('../src/components/QuestionForm');
  const navigated: string[] = []; let saved: Record<string, unknown> | undefined;
  const router = { bfcacheId: 'test', back() {}, forward() {}, refresh() {}, push(href: string) { navigated.push(href); }, replace() {}, prefetch() {} };
  setGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => { saved = JSON.parse(String(init?.body)); return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }); });
  const q: Question = { id: 'test', class: 6, subject_tag: 'Test', difficulty: 'easy', question_text: 'Synthetic question', option_a: 'red car', option_b: 'dog', option_c: 'pen', option_d: 'fox', correct_option: 'a', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  try {
    render(<AppRouterContext.Provider value={router}><QuestionForm mode="edit" initialQuestion={q} /></AppRouterContext.Provider>);
    assert.ok(screen.getByText('The correct answer is among the longest options'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Option B' }), { target: { value: 'big dog' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Option C' }), { target: { value: 'new pen' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Option D' }), { target: { value: 'old fox' } });
    await screen.findByText('No length clue detected by this check');
    fireEvent.click(screen.getByRole('button', { name: /Update question/i }));
    await waitFor(() => assert.equal(navigated[0], '/admin/questions?class=all&length_review=correct_longest'));
    assert.equal(saved?.option_a, q.option_a); assert.equal(saved?.correct_option, q.correct_option);
  } finally { cleanup(); dom.window.close(); }
});
