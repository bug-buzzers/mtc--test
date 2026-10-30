import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

test('student registration no longer asks for or sends a code', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://school.test/student/register', pretendToBeVisual: true });
  const setGlobal = (key: string, value: unknown) => Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  setGlobal('window', dom.window); setGlobal('self', dom.window); setGlobal('document', dom.window.document); setGlobal('navigator', dom.window.navigator);
  setGlobal('HTMLElement', dom.window.HTMLElement); setGlobal('Event', dom.window.Event); setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
  const { default: RegistrationPage } = await import('../src/app/student/register/page');
  const navigated: string[] = []; let saved: Record<string, unknown> | undefined;
  const router = { bfcacheId: 'test', back() {}, forward() {}, refresh() {}, push(href: string) { navigated.push(href); }, replace() {}, prefetch() {} };
  setGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => { saved = JSON.parse(String(init?.body)); return new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } }); });
  try {
    render(<AppRouterContext.Provider value={router}><RegistrationPage /></AppRouterContext.Provider>);
    assert.equal(screen.queryByLabelText(/registration code/i), null);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Example Student' } });
    fireEvent.change(screen.getByLabelText('School roll number'), { target: { value: 'X101' } });
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Stream'), { target: { value: 'Bio' } });
    fireEvent.change(screen.getByLabelText('Create password'), { target: { value: 'password-for-test' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password-for-test' } });
    fireEvent.click(screen.getByRole('button', { name: /Create student account/i }));
    await waitFor(() => assert.ok(navigated[0]?.startsWith('/student/login?registered=1')));
    assert.deepEqual(saved, { full_name: 'Example Student', roll_number: 'X101', class: 11, section: 'Bio', password: 'password-for-test' });
  } finally { cleanup(); dom.window.close(); }
});
