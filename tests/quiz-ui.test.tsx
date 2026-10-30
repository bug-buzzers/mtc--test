import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';

test('exam UI enforces interruptions and does not pretend failed submissions succeeded', async (t) => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://school.test/student/quiz', pretendToBeVisual: true });
  const setGlobal = (key: string, value: unknown) => Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  setGlobal('window', dom.window); setGlobal('self', dom.window); setGlobal('document', dom.window.document); setGlobal('navigator', dom.window.navigator);
  setGlobal('HTMLElement', dom.window.HTMLElement); setGlobal('Event', dom.window.Event); setGlobal('history', dom.window.history); setGlobal('location', dom.window.location);
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const { render, screen, fireEvent, waitFor, cleanup, act } = await import('@testing-library/react');
  const { default: Quiz } = await import('../src/app/student/quiz/page');
  const { default: Submitted } = await import('../src/app/student/submitted/page');
  let fullscreen: Element | null = null;
  let visibility = 'visible';
  const beacons: string[] = [];
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: (url: string) => { beacons.push(url); return true; } });
  document.documentElement.requestFullscreen = async () => { fullscreen = document.documentElement; document.dispatchEvent(new Event('fullscreenchange')); };
  document.exitFullscreen = async () => { fullscreen = null; document.dispatchEvent(new Event('fullscreenchange')); };
  const navigated: string[] = [];
  const router = { bfcacheId: 'test', back() {}, forward() {}, refresh() {}, push(href: string) { navigated.push(href); }, replace(href: string) { navigated.push(href); }, prefetch() {} };
  let calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  let warningCount = 0;
  let failures = 0;
  let deferViolation: ((response: Response) => void) | null = null;
  let delayViolation = false;
  let submittedHistory: unknown[] = [];
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  setGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    calls.push({ url, body });
    if (url === '/api/quiz/status') return json({ history: submittedHistory });
    if (url === '/api/quiz/start') return json({ attempt_id: 'test-attempt', class: 6, remaining_seconds: 300, tab_switch_warnings: 0, questions: [{ response_id: 'response-1', question_number: 1, subject_tag: 'Test', question_text: 'Synthetic UI question', option_a: 'Choice A', option_b: 'Choice B', option_c: 'Choice C', option_d: 'Choice D', selected_option: null }] });
    if (url === '/api/quiz/violation') {
      if (delayViolation) return new Promise<Response>((resolve) => { deferViolation = resolve; });
      if (body.event === 'tab_hidden') return json({ status: ++warningCount > 1 ? 'blocked' : 'in_progress', tab_switch_warnings: warningCount });
      return json({ status: 'blocked', tab_switch_warnings: warningCount });
    }
    if (url === '/api/quiz/save') return json({ ok: true });
    if (url === '/api/quiz/submit') { if (failures-- > 0) return json({ error: 'Submission failed on server.' }, 503); return json({ status: 'submitted' }); }
    if (url === '/api/quiz/heartbeat') return json({ status: 'in_progress', remaining_seconds: 290 });
    throw new Error(`Unexpected request ${url}`);
  });
  function reset() { cleanup(); fullscreen = null; visibility = 'visible'; calls = []; navigated.length = 0; beacons.length = 0; warningCount = 0; failures = 0; delayViolation = false; deferViolation = null; submittedHistory = []; }
  async function begin() {
    render(<AppRouterContext.Provider value={router}><Quiz /></AppRouterContext.Provider>);
    const startButton = screen.getByRole('button', { name: /enter full screen & start/i }) as HTMLButtonElement;
    assert.equal(startButton.disabled, true);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(startButton);
    await screen.findByText('Synthetic UI question');
    await act(async () => {});
  }
  try {
    await t.test('one tab warning, return to full screen, and second switch locks', async () => {
      reset(); await begin();
      // Some browsers send fullscreenchange immediately before visibilitychange.
      fullscreen = null; fireEvent(document, new Event('fullscreenchange'));
      visibility = 'hidden'; fireEvent(document, new Event('visibilitychange'));
      await screen.findByText(/Warning: you left the exam tab/);
      visibility = 'visible'; fireEvent(document, new Event('visibilitychange'));
      fireEvent.click(await screen.findByRole('button', { name: /Re-enter full screen/i }));
      await waitFor(() => assert.ok(!screen.queryByText('Return to full screen')));
      assert.equal(calls.some((c) => c.body.event === 'fullscreen_exit'), false);
      visibility = 'hidden'; fireEvent(document, new Event('visibilitychange'));
      await screen.findByRole('heading', { name: 'Exam locked' });
      assert.equal(calls.filter((c) => c.body.event === 'tab_hidden').length, 2);
    });
    await t.test('a visible full-screen exit locks, while pagehide sends a best-effort quit report', async () => {
      reset(); await begin();
      fireEvent(window, new Event('pagehide'));
      assert.deepEqual(beacons, ['/api/quiz/violation']);
      fullscreen = null; fireEvent(document, new Event('fullscreenchange'));
      await screen.findByRole('heading', { name: 'Exam locked' }, { timeout: 2000 });
      assert.ok(calls.some((c) => c.body.event === 'fullscreen_exit'));
    });
    await t.test('failed submit remains on the exam and can be retried with all answers', async () => {
      reset(); failures = 1; await begin();
      fireEvent.click(screen.getByRole('button', { name: /Choice A/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Submit exam' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm submit' }));
      await screen.findByText(/Submission failed on server/);
      assert.deepEqual(navigated, []);
      fireEvent.click(screen.getByRole('button', { name: 'Submit exam' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm submit' }));
      await waitFor(() => assert.deepEqual(navigated, ['/student/submitted?attempt=test-attempt']));
      const submitted = calls.filter((c) => c.url === '/api/quiz/submit');
      assert.equal(submitted.length, 2);
      assert.deepEqual(submitted[1].body.responses, [{ response_id: 'response-1', selected_option: 'a' }]);
    });
    await t.test('the submitted screen verifies the specific attempt before showing success', async () => {
      reset();
      submittedHistory = [{ id: 'other-attempt', status: 'submitted' }];
      render(<AppRouterContext.Provider value={router}><SearchParamsContext.Provider value={new URLSearchParams('attempt=test-attempt')}><Submitted /></SearchParamsContext.Provider></AppRouterContext.Provider>);
      await screen.findByRole('heading', { name: 'Submission not confirmed' });
      reset();
      submittedHistory = [{ id: 'test-attempt', status: 'submitted', can_view_result: false }];
      render(<AppRouterContext.Provider value={router}><SearchParamsContext.Provider value={new URLSearchParams('attempt=test-attempt')}><Submitted /></SearchParamsContext.Provider></AppRouterContext.Provider>);
      await screen.findByRole('heading', { name: 'Your quiz has been submitted.' });
    });
    await t.test('submission waits for a pending integrity decision', async () => {
      reset(); delayViolation = true; await begin();
      visibility = 'hidden'; fireEvent(document, new Event('visibilitychange'));
      await waitFor(() => assert.ok(calls.some((c) => c.url === '/api/quiz/violation')));
      fireEvent.click(screen.getByRole('button', { name: 'Submit exam' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm submit' }));
      assert.equal(calls.some((c) => c.url === '/api/quiz/submit'), false);
      assert.ok(deferViolation);
      await act(async () => { (deferViolation as (response: Response) => void)(json({ status: 'blocked', tab_switch_warnings: 2 })); });
      await screen.findByRole('heading', { name: 'Exam locked' });
      assert.equal(calls.some((c) => c.url === '/api/quiz/submit'), false);
    });
  } finally { cleanup(); dom.window.close(); }
});
