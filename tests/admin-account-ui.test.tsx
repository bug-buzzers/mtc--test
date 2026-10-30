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
    const current = screen.getByLabelText('Current password') as HTMLInputElement;
    const next = screen.getByLabelText('New password') as HTMLInputElement;
    const confirm = screen.getByLabelText('Confirm new password') as HTMLInputElement;
    assert.equal(current.autocomplete, 'current-password');
    assert.equal(next.autocomplete, 'new-password');
    assert.equal(confirm.autocomplete, 'new-password');
    fireEvent.change(current, { target: { value: 'old-password-for-test' } });
    fireEvent.change(next, { target: { value: 'new-password-for-test' } });
    fireEvent.change(confirm, { target: { value: 'not-the-same-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    assert.match(screen.getByRole('alert').textContent || '', /do not match/i);
    assert.equal(calls.filter((call) => call.path === '/api/auth/admin/password').length, 0);

    fireEvent.click(screen.getByRole('button', { name: 'Generate strong password' }));
    const generated = next.value;
    assert.match(generated, /^[A-Za-z0-9_-]{24}$/);
    assert.equal(confirm.value, generated);
    assert.equal(current.value, 'old-password-for-test');
    assert.equal(next.type, 'password');
    assert.equal(screen.getByLabelText('Visible password').textContent, generated);
    assert.match(screen.getByRole('status').textContent || '', /save it securely/i);
    assert.equal(calls.filter((call) => call.path === '/api/auth/admin/password').length, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    assert.equal(screen.queryByLabelText('Visible password'), null);
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => assert.ok(screen.getByRole('status').textContent?.includes('Password changed')));
    assert.deepEqual(calls.find((call) => call.path === '/api/auth/admin/password')?.body, { current_password: 'old-password-for-test', new_password: generated });
    assert.ok(screen.getByRole('link', { name: 'Sign in again' }));
    assert.equal(JSON.stringify(dom.window.localStorage).includes(generated), false);
  } finally { cleanup(); dom.window.close(); }
});
