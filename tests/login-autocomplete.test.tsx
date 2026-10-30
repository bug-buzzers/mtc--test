import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';

test('student and administrator login identify existing credentials to password managers', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://school.test/', pretendToBeVisual: true });
  const setGlobal = (key: string, value: unknown) => Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  setGlobal('window', dom.window); setGlobal('self', dom.window); setGlobal('document', dom.window.document); setGlobal('navigator', dom.window.navigator);
  setGlobal('HTMLElement', dom.window.HTMLElement); setGlobal('Event', dom.window.Event); setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const { render, screen, cleanup } = await import('@testing-library/react');
  const { default: StudentLogin } = await import('../src/app/student/login/page');
  const { default: AdminLogin } = await import('../src/app/admin/login/page');
  const router = { bfcacheId: 'test', back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
  try {
    render(<AppRouterContext.Provider value={router}><SearchParamsContext.Provider value={new URLSearchParams('registered=1')}><StudentLogin /></SearchParamsContext.Provider></AppRouterContext.Provider>);
    assert.equal((screen.getByLabelText('Roll number') as HTMLInputElement).autocomplete, 'username');
    assert.equal((screen.getByLabelText('Password') as HTMLInputElement).autocomplete, 'current-password');
    assert.match(screen.getByText(/Account created/).textContent || '', /ask your teacher to reset/i);
    cleanup();
    render(<AppRouterContext.Provider value={router}><AdminLogin /></AppRouterContext.Provider>);
    assert.equal((screen.getByLabelText('Username') as HTMLInputElement).autocomplete, 'username');
    assert.equal((screen.getByLabelText('Password') as HTMLInputElement).autocomplete, 'current-password');
  } finally { cleanup(); dom.window.close(); }
});
