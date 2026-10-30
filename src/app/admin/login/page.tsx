'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MaplesLogo from '@/components/MaplesLogo';
import { apiFetch, clearClientSession } from '@/lib/client-api';
import { ArrowLeft, Key } from '@phosphor-icons/react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { ok, data } = await apiFetch<{
        error?: string;
        user?: { role: string };
      }>('/api/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      if (!ok || !data.user) {
        setError(data.error || 'Invalid coordinator username or password.');
        return;
      }

      clearClientSession();
      router.push('/admin/dashboard');
    } catch { setError('Connection failed. Please try again.'); } finally { setLoading(false); }
  };

  return (
    <main
      id="main-content"
      className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col justify-between px-4 sm:px-6 py-6"
    >
      <div className="max-w-5xl w-full mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} weight="regular" />
          Back to portal home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 sm:p-10 border border-slate-200/70 shadow-diffusion animate-fade-in">
          <div className="mb-7">
            <MaplesLogo size="sm" />
            <p className="mt-5 font-mono text-xs font-medium text-maple-600 tracking-wider">
              Coordinator workspace
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              Administrator sign in
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in to manage class quiz banks, student records, and result
              visibility.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="admin-user"
                className="text-sm font-medium text-slate-700"
              >
                Username
              </label>
              <input
                id="admin-user"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-maple-500 outline-none text-sm font-mono transition"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="admin-pass"
                className="text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="admin-pass"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Enter coordinator password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-maple-500 outline-none text-sm transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] mt-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-2 transition duration-200"
            >
              <Key size={16} weight="regular" />
              {loading ? 'Signing in...' : 'Open coordinator workspace'}
            </button>
          </form>


        </div>
      </div>

      <div className="text-center text-xs text-slate-400">
        Maples Tech Club · Maples Academy, Khatauli
      </div>
    </main>
  );
}
