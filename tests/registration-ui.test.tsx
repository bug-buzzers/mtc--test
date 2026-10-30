import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

test('student registration offers a secure generated password without requiring a code', async () => {
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
    const roll = screen.getByLabelText('School roll number') as HTMLInputElement;
    const password = screen.getByLabelText('Create password') as HTMLInputElement;
    const confirm = screen.getByLabelText('Confirm password') as HTMLInputElement;
    assert.equal(roll.autocomplete, 'username');
    assert.equal(password.autocomplete, 'new-password');
    assert.equal(confirm.autocomplete, 'new-password');
    assert.equal(password.type, 'password');
    assert.match(screen.getByText(/if Chrome warns/i).textContent || '', /ask your teacher to reset/i);

    // If secure randomness is unavailable, leave the fields untouched instead of using a weak fallback.
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    try {
      setGlobal('crypto', undefined);
      fireEvent.click(screen.getByRole('button', { name: 'Generate strong password' }));
      assert.match(screen.getByRole('alert').textContent || '', /unavailable/i);
      assert.equal(password.value, ''); assert.equal(confirm.value, ''); assert.equal(saved, undefined);
    } finally {
      if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
      else Reflect.deleteProperty(globalThis, 'crypto');
    }

    fireEvent.click(screen.getByRole('button', { name: 'Generate strong password' }));
    const first = password.value;
    assert.match(first, /^[A-Za-z0-9_-]{24}$/);
    assert.equal(confirm.value, first);
    assert.equal(password.type, 'password', 'the real input stays recognizable to password managers');
    assert.equal(screen.getByLabelText('Visible password').textContent, first);
    assert.match(screen.getByRole('status').textContent || '', /save it securely/i);
    assert.equal(saved, undefined, 'generation never makes a request');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    assert.equal(screen.queryByLabelText('Visible password'), null);
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    assert.equal(screen.getByLabelText('Visible password').textContent, first);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Example Student' } });
    fireEvent.change(roll, { target: { value: 'X101' } });
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Stream'), { target: { value: 'Bio' } });
    fireEvent.change(confirm, { target: { value: 'different-password' } });
    fireEvent.click(screen.getByRole('button', { name: /Create student account/i }));
    assert.match(screen.getByRole('alert').textContent || '', /do not match/i);
    assert.equal(saved, undefined);

    const tooLongInBytes = '🚀'.repeat(20);
    fireEvent.change(password, { target: { value: tooLongInBytes } });
    fireEvent.change(confirm, { target: { value: tooLongInBytes } });
    fireEvent.click(screen.getByRole('button', { name: /Create student account/i }));
    assert.match(screen.getByRole('alert').textContent || '', /72 UTF-8 bytes/i);
    assert.equal(saved, undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Generate strong password' }));
    const generated = password.value;
    assert.match(generated, /^[A-Za-z0-9_-]{24}$/);
    assert.equal(confirm.value, generated);
    fireEvent.click(screen.getByRole('button', { name: /Create student account/i }));
    await waitFor(() => assert.ok(navigated[0]?.startsWith('/student/login?registered=1')));
    assert.deepEqual(saved, { full_name: 'Example Student', roll_number: 'X101', class: 11, section: 'Bio', password: generated });
    assert.equal(navigated[0].includes(generated), false, 'passwords must not be put in URLs');
    assert.equal(JSON.stringify(dom.window.localStorage).includes(generated), false, 'passwords must not be persisted in browser storage');
  } finally { cleanup(); dom.window.close(); }
});
