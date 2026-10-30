'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import MaplesLogo from './MaplesLogo';
import { apiFetch, clearClientSession } from '@/lib/client-api';
import { AuthTokenPayload } from '@/lib/types';
import {
  BookOpenText,
  ChartBar,
  ClipboardText,
  GearSix,
  SignOut,
  ShieldWarning,
  SquaresFour,
  Users,
} from '@phosphor-icons/react';

interface AdminShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Overview', icon: SquaresFour },
  { href: '/admin/questions', label: 'Question bank', icon: BookOpenText },
  { href: '/admin/results', label: 'Results & print', icon: ClipboardText },
  { href: '/admin/students', label: 'Students', icon: Users },
  { href: '/admin/integrity', label: 'Integrity', icon: ShieldWarning },
  { href: '/admin/settings', label: 'Settings', icon: GearSix },
  { href: '/admin/analytics', label: 'Analytics', icon: ChartBar },
];

export default function AdminShell({
  children,
  title,
  subtitle,
  actions,
}: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [adminUser, setAdminUser] = useState<AuthTokenPayload | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { ok, status, data } = await apiFetch<{ user: AuthTokenPayload | null }>('/api/auth/me');
        if (!mounted) return;
        if (status === 401 || (ok && (!data.user || data.user.role !== 'admin'))) { clearClientSession(); router.replace('/admin/login'); return; }
        if (!ok || !data.user) throw new Error('Unable to verify your administrator session.');
        setAdminUser(data.user);
      } catch { if (mounted) setAuthError('Unable to verify your session. Check your connection and retry.'); }
      finally { if (mounted) setChecking(false); }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    setLogoutError('');
    try {
      const response = await apiFetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Sign-out could not be confirmed.');
      clearClientSession(); router.push('/admin/login');
    } catch { setLogoutError('Sign-out could not be confirmed. Check your connection and retry.'); }
  };

  if (authError) return <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-4"><div role="alert" className="max-w-md rounded-2xl border border-rose-200 bg-white p-7"><h1 className="text-lg font-semibold">Coordinator workspace unavailable</h1><p className="mt-2 text-sm text-slate-600">{authError}</p><button onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Retry</button></div></main>;

  if (checking) {
    return (
      <div className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col">
        <header className="h-24 bg-white border-b border-slate-200/70" />
        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="h-8 w-64 rounded-lg skeleton-shimmer" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="h-24 rounded-2xl skeleton-shimmer" />
            <div className="h-24 rounded-2xl skeleton-shimmer" />
            <div className="h-24 rounded-2xl skeleton-shimmer" />
            <div className="h-24 rounded-2xl skeleton-shimmer" />
          </div>
          <div className="h-64 rounded-3xl skeleton-shimmer" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col">
      {/* Liquid Glass Top Navigation (No Left Sidebar) */}
      <header className="no-print sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/70 shadow-glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link href="/admin/dashboard" className="flex items-center gap-3.5">
            <MaplesLogo size="sm" />
            <div className="hidden md:block border-l border-slate-200 pl-3.5">
              <p className="text-xs font-semibold text-maple-600">
                Coordinator workspace
              </p>
              <p className="text-xs text-slate-500">
                {adminUser?.name || 'Administrator'}
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-medium text-sm transition duration-200"
          >
            <SignOut size={16} weight="regular" />
            <span>Sign out</span>
          </button>
        </div>

        {/* Active-Indicated Horizontal Nav */}
        <nav
          aria-label="Coordinator sections"
          className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-slate-100 py-1.5"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== '/admin/dashboard' &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition duration-200 active:scale-[0.98] ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={16} weight="regular" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main
        id="main-content"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-7 sm:py-9 animate-fade-in"
      >
        {logoutError && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{logoutError}</p>}
        {(title || actions) && (
          <div className="no-print mb-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200/80">
            <div>
              {title && (
                <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-slate-500 max-w-[65ch]">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
