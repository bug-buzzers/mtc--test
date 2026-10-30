import React from 'react';
import Link from 'next/link';
import MaplesLogo from '@/components/MaplesLogo';
import { ArrowLeft, Compass } from '@phosphor-icons/react/dist/ssr';

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col justify-between px-4 sm:px-6 py-8"
    >
      <div className="max-w-6xl w-full mx-auto">
        <MaplesLogo size="sm" showBadge />
      </div>

      <div className="max-w-xl w-full mx-auto py-16">
        <div className="w-12 h-12 rounded-2xl bg-maple-100 text-maple-600 flex items-center justify-center mb-6">
          <Compass size={24} weight="regular" />
        </div>
        <p className="font-mono text-xs font-medium text-maple-600 tracking-wider">
          404 / page not found
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight text-balance">
          We could not find the page you requested.
        </h1>
        <p className="mt-3 text-base text-slate-600 leading-relaxed max-w-[52ch]">
          The link may have moved or the address may contain a typo. Return to
          the entrance portal home or sign in to your student dashboard.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-sm transition duration-200"
          >
            <ArrowLeft size={16} weight="regular" />
            Return to portal home
          </Link>
          <Link
            href="/student/login"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 active:scale-[0.98] text-slate-700 font-medium text-sm transition duration-200"
          >
            Student sign in
          </Link>
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto text-xs text-slate-400">
        Maples Tech Club · Maples Academy, Khatauli
      </div>
    </main>
  );
}
