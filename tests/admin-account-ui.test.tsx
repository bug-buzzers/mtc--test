import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';

test('admin account page validates confirmation and shows the signed-out state', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://school.test/admin/account', pretendToBeVisual: true });
  const setGlobal = (key: string, value: unknown) => Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  setGlobal('window', dom.window); setGlobal('self', dom.window); setGlobal('document', dom.window.document); setGlobal('navigator', dom.window.navigator);
  setGlobal('HTMLElement', dom.window.HTMLElement); setGlobal('Event', dom.window.Event); setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
  const { default: AccountPage } = await import('../src/app/admin/account/page');
  const router = { bfcacheId: 'test', back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
  const calls: Array<{ path: string; body?: Record<string, string> }> = [];
  setGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input); calls.push({ path, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (path === '/api/auth/me') return new Response(JSON.stringify({ user: { sub: 'test', sid: 'session', role: 'admin', name: 'Teacher' } }), { status: 200 });
    if (path === '/api/auth/admin/password') return new Response(JSON.stringify({ message: 'Password changed.' }), { status: 200 });
    return new Response('{}', { status: 404 });
  });
  try {
    render(<AppRouterContext.Provider value={router}><PathnameContext.Provider value="/admin/account"><AccountPage /></PathnameContext.Provider></AppRouterContext.Provider>);
    await screen.findByRole('heading', { name: 'Change password' });
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'old-password-for-test' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password-for-test' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'not-the-same-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    assert.match(screen.getByRole('alert').textContent || '', /do not match/i);
    assert.equal(calls.filter((call) => call.path === '/api/auth/admin/password').length, 0);
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password-for-test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => assert.ok(screen.getByRole('status').textContent?.includes('Password changed')));
    assert.deepEqual(calls.find((call) => call.path === '/api/auth/admin/password')?.body, { current_password: 'old-password-for-test', new_password: 'new-password-for-test' });
    assert.ok(screen.getByRole('link', { name: 'Sign in again' }));
  } finally { cleanup(); dom.window.close(); }
});
