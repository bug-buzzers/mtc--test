'use client';

import React, { useEffect, useState } from 'react';
import { CLASSES, CLUB_NAME, SCHOOL_NAME } from '@/lib/constants';
import {
  buildTestShareLinks,
  buildWhatsAppShareHref,
  buildWhatsAppTestMessage,
} from '@/lib/share-test';
import {
  Check,
  Copy,
  Link as LinkIcon,
  ShareNetwork,
  WhatsappLogo,
} from '@phosphor-icons/react';

export interface ClassExamShareSetting {
  class: number;
  total_questions: number;
  time_limit_minutes: number;
  passing_score?: number;
  is_open?: boolean;
}

interface ShareTestCardProps {
  /** Optional default selected class (null = All Classes 6–12) */
  defaultClass?: number | null;
  /** Optional per-class configuration loaded from admin settings */
  classSettings?: ClassExamShareSetting[];
  /** Compact button-only trigger or full card */
  variant?: 'full' | 'compact';
  className?: string;
}

export function WhatsAppShareButton({
  targetClass = null,
  totalQuestions = 25,
  timeLimitMinutes = 30,
  passingScore = null,
  label = 'Share on WhatsApp',
  size = 'md',
  className = '',
}: {
  targetClass?: number | null;
  totalQuestions?: number;
  timeLimitMinutes?: number;
  passingScore?: number | null;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [origin, setOrigin] = useState('https://mtc-exam.vercel.app');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setOrigin(window.location.origin);
    }
  }, []);

  const message = buildWhatsAppTestMessage({
    baseUrl: origin,
    targetClass,
    totalQuestions,
    timeLimitMinutes,
    passingScore,
  });

  const whatsappHref = buildWhatsAppShareHref(message);

  const sizeStyles =
    size === 'sm'
      ? 'px-3.5 py-2 text-xs sm:text-sm rounded-xl gap-1.5'
      : 'min-h-[48px] px-5 py-3 text-sm sm:text-base rounded-xl gap-2';

  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} via WhatsApp`}
      className={`inline-flex items-center justify-center font-medium bg-[#25D366] hover:bg-[#1EBE5D] active:scale-[0.98] text-white shadow-diffusion transition duration-200 ${sizeStyles} ${className}`}
    >
      <WhatsappLogo size={size === 'sm' ? 17 : 20} weight="fill" />
      <span>{label}</span>
    </a>
  );
}

export default function ShareTestCard({
  defaultClass = null,
  classSettings,
  variant = 'full',
  className = '',
}: ShareTestCardProps) {
  const [origin, setOrigin] = useState('https://mtc-exam.vercel.app');
  const [selectedClass, setSelectedClass] = useState<number | null>(
    defaultClass
  );
  const [copiedType, setCopiedType] = useState<'message' | 'url' | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setOrigin(window.location.origin);
    }
  }, []);

  const activeSetting =
    selectedClass && classSettings
      ? classSettings.find((s) => s.class === selectedClass)
      : undefined;

  const totalQuestions = activeSetting?.total_questions ?? 25;
  const timeLimitMinutes = activeSetting?.time_limit_minutes ?? 30;
  const passingScore = activeSetting?.passing_score ?? null;

  const links = buildTestShareLinks(origin, selectedClass);
  const shareMessage = buildWhatsAppTestMessage({
    baseUrl: origin,
    targetClass: selectedClass,
    totalQuestions,
    timeLimitMinutes,
    passingScore,
  });
  const whatsappHref = buildWhatsAppShareHref(shareMessage);

  const copyText = async (text: string, type: 'message' | 'url') => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'absolute';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopiedType(type);
      setTimeout(() => {
        setCopiedType((prev) => (prev === type ? null : prev));
      }, 2400);
    } catch {
      // Ignore clipboard permission rejections silently
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: selectedClass
            ? `${CLUB_NAME} — Class ${selectedClass} Entrance Test | ${SCHOOL_NAME}`
            : `${CLUB_NAME} — Online Entrance Test | ${SCHOOL_NAME}`,
          text: shareMessage,
          url: links.shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed; fall back to copying
      }
    }
    await copyText(shareMessage, 'message');
  };

  if (variant === 'compact') {
    return (
      <div
        className={`bg-white rounded-[2rem] p-6 sm:p-7 border border-slate-200/70 shadow-diffusion ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#25D366]/15 text-[#128C7E] flex items-center justify-center shrink-0">
              <WhatsappLogo size={24} weight="fill" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                Share entrance test on WhatsApp
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-[54ch]">
                Send complete test instructions, eligibility, duration, and
                direct registration &amp; login URLs with the official school
                preview card.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] active:scale-[0.98] text-white font-medium text-sm transition duration-200"
            >
              <WhatsappLogo size={18} weight="fill" />
              <span>Share on WhatsApp</span>
            </a>
            <button
              type="button"
              onClick={() => copyText(shareMessage, 'message')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-medium text-sm transition duration-200"
            >
              {copiedType === 'message' ? (
                <>
                  <Check size={16} weight="bold" className="text-forest-600" />
                  <span>Copied details</span>
                </>
              ) : (
                <>
                  <Copy size={16} weight="regular" />
                  <span>Copy info &amp; link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-[2.5rem] p-6 sm:p-10 border border-slate-200/70 shadow-diffusion ${className}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left Column: Controls, Class Picker & Share Actions */}
        <div className="lg:col-span-6 space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#25D366]/12 text-[#128C7E] text-xs font-semibold">
              <WhatsappLogo size={15} weight="fill" />
              WhatsApp Test Invitation
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight text-balance">
              Share complete test details &amp; portal link on WhatsApp.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed max-w-[54ch]">
              Forward the official {SCHOOL_NAME} entrance quiz invitation to
              class groups, classmates, or parents — complete with school logo
              link preview, test format, and direct sign-in URLs.
            </p>
          </div>

          {/* Target Class Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
              Customize invitation for class group
            </label>
            <div
              role="group"
              aria-label="Select class for WhatsApp share message"
              className="flex flex-wrap gap-2"
            >
              <button
                type="button"
                onClick={() => setSelectedClass(null)}
                aria-pressed={selectedClass === null}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition active:scale-[0.98] ${
                  selectedClass === null
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                All Classes (6–12)
              </button>
              {CLASSES.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setSelectedClass(cls)}
                  aria-pressed={selectedClass === cls}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-medium tabular-nums transition active:scale-[0.98] ${
                    selectedClass === cls
                      ? 'bg-maple-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  Cls {cls}
                </button>
              ))}
            </div>
          </div>

          {/* Direct Share URL Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 shrink-0">
                <LinkIcon size={16} weight="regular" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500">
                  Direct Test Portal URL
                </p>
                <p className="text-xs sm:text-sm font-mono text-slate-900 truncate">
                  {links.shareUrl}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => copyText(links.shareUrl, 'url')}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 shrink-0 transition"
            >
              {copiedType === 'url' ? (
                <>
                  <Check size={14} weight="bold" className="text-forest-600" />
                  <span>Copied URL</span>
                </>
              ) : (
                <>
                  <Copy size={14} weight="regular" />
                  <span>Copy URL</span>
                </>
              )}
            </button>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 min-h-[48px] px-6 py-3 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] active:scale-[0.98] text-white font-semibold text-sm sm:text-base shadow-diffusion transition duration-200"
            >
              <WhatsappLogo size={21} weight="fill" />
              <span>
                {selectedClass
                  ? `Share Class ${selectedClass} Test on WhatsApp`
                  : 'Share Test on WhatsApp'}
              </span>
            </a>

            <button
              type="button"
              onClick={() => copyText(shareMessage, 'message')}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-medium text-sm transition duration-200"
            >
              {copiedType === 'message' ? (
                <>
                  <Check size={17} weight="bold" className="text-emerald-400" />
                  <span>Full message copied!</span>
                </>
              ) : (
                <>
                  <Copy size={17} weight="regular" />
                  <span>Copy full info &amp; links</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleNativeShare}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-medium text-sm transition duration-200"
            >
              <ShareNetwork size={17} weight="regular" />
              <span>More apps</span>
            </button>
          </div>
        </div>

        {/* Right Column: Authentic WhatsApp Link Card + Message Preview */}
        <div className="lg:col-span-6">
          <div className="rounded-[2rem] bg-[#EFEAE2] p-4 sm:p-5 border border-slate-200/80 shadow-inner">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                WhatsApp Rich Preview &amp; Message
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                 School Logo + Meta Card
              </span>
            </div>

            {/* Simulated WhatsApp Outgoing Bubble */}
            <div className="rounded-2xl rounded-tr-sm bg-[#D9FDD3] p-2.5 shadow-sm border border-[#C5EBBF]">
              {/* OG Rich Link Preview Header */}
              <div className="rounded-xl overflow-hidden bg-[#F0F2F5] border border-black/5 mb-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    selectedClass
                      ? `/api/og?class=${selectedClass}`
                      : '/whatsapp-share.png'
                  }
                  alt="Maples Academy Khatauli WhatsApp Share Card with School Logo"
                  className="w-full h-auto object-cover border-b border-slate-200/70"
                />
                <div className="p-3">
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug line-clamp-1">
                    {selectedClass
                      ? `${CLUB_NAME} — Class ${selectedClass} Online Entrance Test | ${SCHOOL_NAME}`
                      : `${CLUB_NAME} — Online Entrance Test | ${SCHOOL_NAME}`}
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 line-clamp-2">
                    {SCHOOL_NAME} · Classes 6 to 12 Online Entrance Quiz (
                    {totalQuestions} MCQs · {timeLimitMinutes} Min · Zero
                    Negative Marking).
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-1 truncate">
                    {origin.replace(/^https?:\/\//, '')}
                  </p>
                </div>
              </div>

              {/* Formatted WhatsApp Text Body */}
              <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-slate-800 px-1.5 py-1 max-h-60 overflow-y-auto">
                {shareMessage}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
