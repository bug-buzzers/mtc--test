import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';

test('student and admin logins can reveal and hide their password without submitting the form', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://school.test/', pretendToBeVisual: true });
  const setGlobal = (key: string, value: unknown) => Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  setGlobal('window', dom.window); setGlobal('self', dom.window); setGlobal('document', dom.window.document); setGlobal('navigator', dom.window.navigator);
  setGlobal('HTMLElement', dom.window.HTMLElement); setGlobal('Event', dom.window.Event); setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
  const { default: StudentLogin } = await import('../src/app/student/login/page');
  const { default: AdminLogin } = await import('../src/app/admin/login/page');
  const destinations: string[] = [];
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const router = { bfcacheId: 'test', back() {}, forward() {}, refresh() {}, push(href: string) { destinations.push(href); }, replace() {}, prefetch() {} };
  setGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    calls.push({ path, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ user: { role: path.includes('/admin/') ? 'admin' : 'student' } }), { status: 200 });
  });

  const checkVisibility = (password: HTMLInputElement, expectedId: string, expectedValue: string, priorCalls: number) => {
    assert.equal(password.type, 'password', 'passwords start masked');
    assert.equal(password.autocomplete, 'current-password');
    fireEvent.change(password, { target: { value: expectedValue } });
    const show = screen.getByRole('button', { name: 'Show password' });
    assert.equal(show.getAttribute('type'), 'button');
    assert.equal(show.getAttribute('aria-controls'), expectedId);
    fireEvent.click(show);
    assert.equal(password.type, 'text');
    assert.equal(password.value, expectedValue);
    assert.equal(password.autocomplete, 'current-password');
    assert.equal(calls.length, priorCalls, 'showing the password must not submit');
    const hide = screen.getByRole('button', { name: 'Hide password' });
    assert.equal(hide.getAttribute('aria-controls'), expectedId);
    fireEvent.click(hide);
    assert.equal(password.type, 'password');
    assert.equal(password.value, expectedValue);
    assert.equal(calls.length, priorCalls, 'hiding the password must not submit');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  };

  try {
    render(<AppRouterContext.Provider value={router}><SearchParamsContext.Provider value={new URLSearchParams()}><StudentLogin /></SearchParamsContext.Provider></AppRouterContext.Provider>);
    fireEvent.change(screen.getByLabelText('Roll number'), { target: { value: 'R123' } });
    const studentPassword = screen.getByLabelText('Password') as HTMLInputElement;
    checkVisibility(studentPassword, 'login-password', 'student-test-password', 0);
    fireEvent.click(screen.getByRole('button', { name: 'Continue to dashboard' }));
    await waitFor(() => assert.equal(destinations[0], '/student/dashboard'));
    assert.deepEqual(calls[0], { path: '/api/auth/student/login', body: { roll_number: 'R123', class: 8, section: 'A', password: 'student-test-password' } });
    cleanup();

    render(<AppRouterContext.Provider value={router}><AdminLogin /></AppRouterContext.Provider>);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'teacher' } });
    const adminPassword = screen.getByLabelText('Password') as HTMLInputElement;
    checkVisibility(adminPassword, 'admin-pass', 'admin-test-password', 1);
    fireEvent.click(screen.getByRole('button', { name: 'Open coordinator workspace' }));
    await waitFor(() => assert.equal(destinations[1], '/admin/dashboard'));
    assert.deepEqual(calls[1], { path: '/api/auth/admin/login', body: { username: 'teacher', password: 'admin-test-password' } });
  } finally { cleanup(); dom.window.close(); }
});
