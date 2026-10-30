'use client';

import React, { useState } from 'react';
import { LOGO_LOCAL_PATH, LOGO_REMOTE_URL } from '@/lib/constants';

interface MaplesLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
  className?: string;
}

export default function MaplesLogo({
  size = 'md',
  showBadge = false,
  className = '',
}: MaplesLogoProps) {
  const [src, setSrc] = useState(LOGO_LOCAL_PATH);

  const sizeClasses = {
    sm: 'h-9 sm:h-10',
    md: 'h-11 sm:h-12',
    lg: 'h-14 sm:h-16',
  }[size];

  return (
    <div className={`inline-flex items-center gap-3.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Maples Academy Khatauli official crest and wordmark"
        onError={() => {
          if (src !== LOGO_REMOTE_URL) {
            setSrc(LOGO_REMOTE_URL);
          }
        }}
        className={`${sizeClasses} w-auto object-contain select-none`}
      />
      {showBadge && (
        <div className="hidden sm:flex flex-col border-l border-slate-200 pl-3.5">
          <span className="text-sm font-semibold tracking-tight text-slate-900 leading-tight">
            Maples Tech Club
          </span>
          <span className="text-xs font-normal text-slate-500 leading-tight mt-0.5">
            Khatauli Campus
          </span>
        </div>
      )}
    </div>
  );
}
