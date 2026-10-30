'use client';

import React, { memo, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CLASSES } from '@/lib/constants';
import {
  AppWindow,
  Browser,
  Check,
  Cpu,
  Fingerprint,
  Keyboard,
  Shuffle,
  TerminalWindow,
  WifiHigh,
} from '@phosphor-icons/react';

const SPRING_SPEC = { type: 'spring' as const, stiffness: 100, damping: 20 };

const INITIAL_TOPICS = [
  {
    id: 'shortcuts',
    label: 'Keyboard shortcuts',
    sample: 'Ctrl + C, Alt + Tab, Ctrl + Shift + T',
    count: 18,
    Icon: Keyboard,
  },
  {
    id: 'hardware',
    label: 'Computer hardware',
    sample: 'RAM vs SSD, HDMI, UPS backup, peripherals',
    count: 18,
    Icon: Cpu,
  },
  {
    id: 'software',
    label: 'Applications & OS',
    sample: 'Files, folders, PDFs, Docs, Sheets & slides',
    count: 18,
    Icon: AppWindow,
  },
  {
    id: 'browsing',
    label: 'Web browsing & cloud',
    sample: 'Tabs, HTTPS padlock, Drive & email basics',
    count: 18,
    Icon: Browser,
  },
  {
    id: 'networking',
    label: 'Basic networking',
    sample: 'Wi-Fi, Bluetooth, Hotspot, LAN & Mbps',
    count: 18,
    Icon: WifiHigh,
  },
  {
    id: 'ethics',
    label: 'Social ethics & safety',
    sample: 'OTP privacy, netiquette & safe digital habits',
    count: 18,
    Icon: Fingerprint,
  },
];

/**
 * Archetype 1: Intelligent Auto-Sorting Topic Stack (Perpetual layoutId spring swap)
 */
export const AutoSortingTopicStack = memo(function AutoSortingTopicStack() {
  const [items, setItems] = useState(INITIAL_TOPICS);

  useEffect(() => {
    const interval = setInterval(() => {
      setItems((prev) => {
        const next = [...prev];
        const first = next.shift();
        if (first) next.push(first);
        return next;
      });
    }, 3400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2.5">
      {items.slice(0, 4).map((item, idx) => {
        const Icon = item.Icon;
        return (
          <motion.div
            key={item.id}
            layout
            layoutId={`topic-${item.id}`}
            transition={SPRING_SPEC}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition-colors ${
              idx === 0
                ? 'bg-maple-100/55 border-maple-200/80'
                : 'bg-slate-50/80 border-slate-200/60'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  idx === 0
                    ? 'bg-maple-500 text-white'
                    : 'bg-white text-slate-700 border border-slate-200/80'
                }`}
              >
                <Icon size={18} weight="regular" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {item.label}
                </p>
                <p className="text-xs text-slate-500 truncate">{item.sample}</p>
              </div>
            </div>
            <span className="font-mono text-xs font-medium text-slate-500 tabular-nums shrink-0">
              {item.count} Qs
            </span>
          </motion.div>
        );
      })}
    </div>
  );
});

const SAMPLE_PROMPTS = [
  {
    category: 'Keyboard shortcuts',
    q: 'You closed a browser tab by mistake. Which shortcut reopens it right away?',
    ans: 'Ctrl + Shift + T',
  },
  {
    category: 'Basic networking',
    q: 'No Wi-Fi nearby and you share phone internet with a laptop. Which feature is used?',
    ans: 'Mobile Hotspot',
  },
  {
    category: 'Social ethics & safety',
    q: 'Do you ever enter your secret UPI PIN to receive money into your account?',
    ans: 'Never — PIN is only for sending',
  },
  {
    category: 'Web browsing',
    q: 'What does the padlock icon next to https:// in the address bar indicate?',
    ans: 'Encrypted connection',
  },
];

/**
 * Archetype 2: Multi-step Typewriter Practical Question Preview
 */
export const LivePromptTypewriter = memo(function LivePromptTypewriter() {
  const [promptIdx, setPromptIdx] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const activePrompt = SAMPLE_PROMPTS[promptIdx];

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (charCount < activePrompt.q.length) {
      timer = setTimeout(() => {
        setCharCount((c) => c + 1);
      }, 26);
    } else if (!showAnswer) {
      timer = setTimeout(() => {
        setShowAnswer(true);
      }, 450);
    } else {
      timer = setTimeout(() => {
        setShowAnswer(false);
        setCharCount(0);
        setPromptIdx((i) => (i + 1) % SAMPLE_PROMPTS.length);
      }, 2600);
    }

    return () => clearTimeout(timer);
  }, [charCount, showAnswer, activePrompt.q.length]);

  return (
    <div className="flex flex-col justify-between h-full min-h-[210px]">
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-maple-600">
            <TerminalWindow size={15} weight="regular" />
            {activePrompt.category}
          </span>
          <span className="font-mono text-[11px] text-slate-400 tabular-nums">
            0{promptIdx + 1} / 0{SAMPLE_PROMPTS.length}
          </span>
        </div>

        <p className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed min-h-[3.5rem]">
          {activePrompt.q.slice(0, charCount)}
          <span className="inline-block w-[2px] h-4 bg-maple-500 ml-0.5 align-middle animate-pulse" />
        </p>
      </div>

      <div className="pt-4 min-h-[52px] flex items-end">
        <AnimatePresence mode="wait">
          {showAnswer ? (
            <motion.div
              key={activePrompt.ans}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={SPRING_SPEC}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between text-xs sm:text-sm"
            >
              <span className="font-medium">{activePrompt.ans}</span>
              <span className="inline-flex items-center gap-1 text-maple-200 font-mono text-xs">
                <Check size={14} weight="bold" />
                practical sense
              </span>
            </motion.div>
          ) : (
            <div className="w-full h-10 rounded-xl skeleton-shimmer opacity-50" />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

/**
 * Archetype 3: Breathing Live Exam Window & Random Draw Status Card
 */
export const LiveExamStatusCard = memo(function LiveExamStatusCard() {
  const [drawSeed, setDrawSeed] = useState(14);
  const [showToast, setShowToast] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setDrawSeed((prev) => ((prev * 7 + 19) % 89) + 10);
      setShowToast(false);
      setTimeout(() => setShowToast(true), 350);
    }, 4200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col justify-between h-full min-h-[210px]">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-maple-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-maple-500" />
          </span>
          Classes 6–12 active
        </div>

        <span className="font-mono text-xs text-slate-400 tabular-nums">
          30:00 timer
        </span>
      </div>

      <div className="my-5 grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
          <p className="text-xs text-slate-500">Served per test</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            25
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
          <p className="text-xs text-slate-500">Pool per class</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            108
          </p>
        </div>
      </div>

      <div className="min-h-[38px]">
        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ type: 'spring', stiffness: 160, damping: 16 }}
              className="px-3.5 py-2 rounded-xl border border-maple-200 bg-maple-100/50 text-xs text-slate-800 flex items-center justify-between"
            >
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Shuffle size={14} weight="regular" className="text-maple-600" />
                Random paper generated
              </span>
              <span className="font-mono text-[11px] text-maple-700 tabular-nums">
                #MTC-{drawSeed}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

const CLUB_DOMAINS = [
  'Web & App Building',
  'AI & Data Literacy',
  'Robotics & Circuits',
  'Design & Media',
  'Cyber Safety',
  'Problem Solving',
];

/**
 * Archetype 4: Seamless Horizontal Infinite Stream of Club Domains
 */
export const InfiniteDomainStream = memo(function InfiniteDomainStream() {
  return (
    <div className="overflow-hidden py-2 select-none">
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{ repeat: Infinity, ease: 'linear', duration: 22 }}
        className="flex items-center gap-3 w-max will-change-transform"
      >
        {[...CLUB_DOMAINS, ...CLUB_DOMAINS].map((domain, idx) => (
          <div
            key={`${domain}-${idx}`}
            className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-sm font-medium text-slate-700 whitespace-nowrap"
          >
            {domain}
          </div>
        ))}
      </motion.div>
    </div>
  );
});

const CLASS_SUMMARY: Record<
  number,
  {
    group: string;
    sections: string;
    focus: string;
  }
> = {
  6: {
    group: 'Middle stage',
    sections: 'Section A and Section B',
    focus:
      'Everyday shortcuts (Ctrl+C, Ctrl+V, Caps Lock), computer parts, folders, browser tabs, Wi-Fi basics, and polite online habits.',
  },
  7: {
    group: 'Middle stage',
    sections: 'Section A and Section B',
    focus:
      'Undo/save/print shortcuts, webcam & UPS basics, common file types (.jpg, .mp3, .pdf), search engines, hotspot, and OTP privacy.',
  },
  8: {
    group: 'Middle stage',
    sections: 'Section A and Section B',
    focus:
      'Window switching (Alt+Tab, Ctrl+F), RAM vs storage, documents & slides, HTTPS padlock, LAN vs Wi-Fi, and group-chat netiquette.',
  },
  9: {
    group: 'Secondary stage',
    sections: 'Section A and Section B',
    focus:
      'Browser & file shortcuts (F2, Ctrl+W), SSD vs HDD, ZIP archives, cloud sharing permissions, download vs upload speeds, and phishing checks.',
  },
  10: {
    group: 'Secondary stage',
    sections: 'Section A and Section B',
    focus:
      'Productivity shortcuts (Win+L, Ctrl+Shift+T), display & storage care, cloud version history, 2.4GHz vs 5GHz Wi-Fi, and 2FA security.',
  },
  11: {
    group: 'Senior secondary · All streams',
    sections: 'Maths, Bio, Commerce, and Humanities',
    focus:
      'Fast OS shortcuts (Win+E, Win+Shift+S), practical hardware troubleshooting, CSV/PDF workflows, email BCC privacy, and responsible AI use.',
  },
  12: {
    group: 'Senior secondary · All streams',
    sections: 'Maths, Bio, Commerce, and Humanities',
    focus:
      'Everyday power shortcuts (Ctrl+K, Ctrl+L), browser profiles, DNS & router security, USB tethering, deepfake awareness, and digital ethics.',
  },
};

/**
 * Interactive Asymmetric Class 6-12 Explorer with shared layoutId pill
 */
export function ClassFormatExplorer() {
  const [selectedClass, setSelectedClass] = useState<number>(8);
  const info = CLASS_SUMMARY[selectedClass];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
      <div className="lg:col-span-5">
        <p className="font-mono text-xs font-medium text-maple-600 tracking-wider">
          02 / class-isolated pools
        </p>
        <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight text-balance">
          Tailored for every class, open to every stream.
        </h2>
        <p className="mt-3 text-base text-slate-600 leading-relaxed max-w-[48ch]">
          A Class 6 student is never graded against a Class 12 paper. Pick your
          class to see eligible sections and what kind of everyday computer
          questions appear.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {CLASSES.map((cls) => {
            const active = selectedClass === cls;
            return (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(cls)}
                className={`relative px-4 py-2.5 rounded-xl text-sm font-medium transition duration-200 active:scale-[0.98] ${
                  active
                    ? 'text-white'
                    : 'text-slate-600 bg-white border border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="active-class-pill"
                    transition={SPRING_SPEC}
                    className="absolute inset-0 rounded-xl bg-slate-900"
                  />
                )}
                <span className="relative z-10 font-mono tabular-nums">
                  Class {cls}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedClass}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="bg-white rounded-[2.5rem] p-8 sm:p-10 border border-slate-200/60 shadow-diffusion"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3 pb-6 border-b border-slate-100">
              <div>
                <p className="text-xs font-medium text-maple-600">
                  {info.group}
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900 tracking-tight">
                  Class {selectedClass} entrance quiz
                </h3>
              </div>
              <span className="font-mono text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                {info.sections}
              </span>
            </div>

            <p className="mt-6 text-base text-slate-600 leading-relaxed max-w-[60ch]">
              {info.focus}
            </p>

            <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500">Questions</p>
                <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  25 MCQs
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Time limit</p>
                <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  30 min
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Class pool</p>
                <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  108 Qs
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
