'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import { apiFetch, clearClientSession } from '@/lib/client-api';
import { generateSecurePassword } from '@/lib/password-generation';
import { isValidAdminPassword } from '@/lib/password-policy';
import { Key } from '@phosphor-icons/react';

export default function AdminAccountPage() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState('');

  const generatePassword = () => {
    try {
      const generated = generateSecurePassword();
      setNext(generated);
      setConfirm(generated);
      setShowPassword(true);
      setGeneratedPassword(true);
      setError('');
    } catch {
      setError('Secure password generation is unavailable. Use your password manager or choose a unique password.');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!isValidAdminPassword(next)) {
      setError('Choose a new password of at least 12 characters and at most 72 UTF-8 bytes.'); return;
    }
    if (next !== confirm) { setError('The new passwords do not match.'); return; }
    if (next === current) { setError('Choose a password different from the current one.'); return; }
    setSaving(true);
    try {
      const response = await apiFetch<{ error?: string }>('/api/auth/admin/password', {
        method: 'POST', body: JSON.stringify({ current_password: current, new_password: next }),
      });
      if (!response.ok) { setError(response.data.error || 'Unable to change your password.'); return; }
      setCurrent(''); setNext(''); setConfirm(''); setShowPassword(false); setGeneratedPassword(false); clearClientSession(); setChanged(true);
    } catch { setError('Connection failed. The password change was not confirmed; try signing in before retrying.'); }
    finally { setSaving(false); }
  };

  return (
    <AdminShell title="Account security" subtitle="Change the password for your coordinator account.">
      <section className="w-full max-w-xl rounded-[2rem] border border-slate-200/70 bg-white p-7 sm:p-8 shadow-diffusion">
        {changed ? (
          <div role="status">
            <h2 className="text-lg font-semibold text-slate-900">Password changed</h2>
            <p className="mt-2 text-sm text-slate-600">For security, you have been signed out on all devices. Sign in again with your new password.</p>
            <Link href="/admin/login" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">Sign in again</Link>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-slate-900">Change password</h2>
            <p className="mt-1.5 text-sm text-slate-600">Use a unique password of at least 12 characters. Changing it signs you out on every device.</p>
            {error && <p role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">{error}</p>}
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="current-password" className="text-sm font-medium text-slate-700">Current password</label>
                <input id="current-password" name="current_password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-maple-500" />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="new-password" className="text-sm font-medium text-slate-700">New password</label>
                <input id="new-password" name="new_password" type="password" autoComplete="new-password" required minLength={12} value={next} onChange={(e) => { setNext(e.target.value); setGeneratedPassword(false); }} className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-maple-500" />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="confirm-password" className="text-sm font-medium text-slate-700">Confirm new password</label>
                <input id="confirm-password" name="confirm_password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-maple-500" />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
                <button type="button" disabled={saving} onClick={generatePassword} className="text-maple-600 hover:text-maple-700 disabled:opacity-60">Generate strong password</button>
                <button type="button" disabled={!next} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="text-slate-600 hover:text-slate-900 disabled:opacity-60">{showPassword ? 'Hide password' : 'Show password'}</button>
              </div>
              {generatedPassword && <p role="status" className="text-xs text-slate-600">Generated on this device. Save it securely before changing your password.</p>}
              {showPassword && next && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <span className="block text-xs font-medium">Password to save</span>
                  <code aria-label="Visible password" className="mt-1 block select-all break-all">{next}</code>
                </div>
              )}
              <button type="submit" disabled={saving} className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60">
                <Key size={16} /> {saving ? 'Changing password...' : 'Change password'}
              </button>
            </form>
          </>
        )}
      </section>
    </AdminShell>
  );
}
