import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import MaplesLogo from '@/components/MaplesLogo';
import MagneticLink from '@/components/MagneticLink';
import ShareTestCard, { WhatsAppShareButton } from '@/components/ShareTestCard';
import { buildPortalMetadata } from '@/lib/share-test';
import {
  AutoSortingTopicStack,
  ClassFormatExplorer,
  InfiniteDomainStream,
  LiveExamStatusCard,
  LivePromptTypewriter,
} from '@/components/LandingBento';
import { ArrowRight, UserPlus } from '@phosphor-icons/react/dist/ssr';

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ class?: string }>;
}): Promise<Metadata> {
  const resolved = searchParams ? await searchParams : undefined;
  const cls = Number(resolved?.class);
  if (!Number.isInteger(cls) || cls < 6 || cls > 12) {
    return {};
  }

  let headersList: Awaited<ReturnType<typeof headers>> | null = null;
  try {
    headersList = await headers();
  } catch {
    headersList = null;
  }

  return buildPortalMetadata(headersList, cls);
}

const ESSENTIAL_NOTES = [
  {
    q: 'Do I need coding or textbook syllabus preparation?',
    a: 'No. Every question covers practical everyday computer awareness — shortcuts, hardware, apps, web browsing, basic Wi-Fi/networking, and online safety.',
  },
  {
    q: 'Who is eligible to register and appear?',
    a: 'Students in Classes 6 to 10 (Section A and Section B) and Classes 11 to 12 across Maths, Bio, Commerce, and Humanities.',
  },
  {
    q: 'Do I need an email address or fee to join?',
    a: 'No email or fee is required. Register using your name, school roll number, class, and section or stream.',
  },
  {
    q: 'When can I review my score and question-wise answers?',
    a: 'Scores remain hidden while classes finish testing. Once released by the club coordinator, your score and full question-by-question answer key appear in your dashboard.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F9FAFB] text-slate-900">
      {/* Liquid Glass Sticky Header (Zero Admin Links) */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-4">
          <MaplesLogo size="sm" showBadge />

          <nav
            aria-label="Primary portal navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#overview"
              className="hover:text-slate-900 transition-colors duration-200"
            >
              Quiz format
            </a>
            <a
              href="#classes"
              className="hover:text-slate-900 transition-colors duration-200"
            >
              Classes 6–12
            </a>
            <a
              href="#help"
              className="hover:text-slate-900 transition-colors duration-200"
            >
              Key details
            </a>
            <a
              href="#share-test"
              className="hover:text-slate-900 transition-colors duration-200"
            >
              Share test
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <WhatsAppShareButton
              size="sm"
              label="Share"
              className="hidden sm:inline-flex"
            />
            <Link
              href="/student/register"
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 active:scale-[0.98] transition duration-200"
            >
              Register
            </Link>
            <Link
              href="/student/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-sm font-medium transition duration-200"
            >
              Student sign in
              <ArrowRight size={15} weight="regular" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {/* ASYMMETRIC SPLIT HERO (min-h-[100dvh] safe, left-aligned, masked studio backdrop) */}
        <section className="relative overflow-hidden border-b border-slate-200/60 min-h-[calc(100dvh-4rem)] flex items-center">
          {/* Subtle CSS-only ambient gradient — no external image, fast on mobile */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute -top-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-maple-200/30 blur-3xl" />
            <div className="absolute top-1/3 -left-20 w-[24rem] h-[24rem] rounded-full bg-forest-100/40 blur-3xl" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#F9FAFB]" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pt-16 sm:pb-24 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Left Column: Focused Editorial Copy */}
              <div className="lg:col-span-7">
                <p className="font-mono text-xs font-medium text-maple-600 tracking-wider">
                  Maples Academy, Khatauli · Learn it. Build it. Ship it.
                </p>

                <h1 className="mt-4 text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold text-slate-900 tracking-tighter leading-[1.06] text-balance">
                  Maples Tech Club entrance quiz for Classes 6 to 12.
                </h1>

                <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-[56ch] text-pretty">
                  A hands-on student technology club where members learn by
                  building real projects together. The step-one online quiz
                  checks everyday computer sense — no coding or textbook
                  syllabus required.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3.5">
                  <MagneticLink href="/student/login" variant="subtle">
                    Start student sign in
                    <ArrowRight size={17} weight="regular" />
                  </MagneticLink>

                  <MagneticLink href="/student/register" variant="secondary">
                    <UserPlus size={17} weight="regular" />
                    Register roll number
                  </MagneticLink>

                  <WhatsAppShareButton label="Share Test on WhatsApp" />
                </div>

                {/* Tabular Monospace Essentials Strip (No Box Soup) */}
                <dl className="mt-12 pt-8 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-xl">
                  <div>
                    <dt className="text-xs text-slate-500">Questions</dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                      25 MCQs
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Duration</dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                      30 min
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Pool / class</dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                      Private
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Negative mark</dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                      0.00
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Right Column: Live Sample Question Card */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 border border-slate-200/60 shadow-diffusion">
                  <LivePromptTypewriter />
                </div>
                <p className="mt-3 px-2 text-xs text-slate-500">
                  Sample everyday questions — drawn randomly for every student
                  from their class pool.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* BENTO 2.0 "MOTION-ENGINE" OVERVIEW (Asymmetric 7/5 + 5/7 Grid, Gallery Captions Outside) */}
        <section
          id="overview"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 sm:pt-20 sm:pb-24"
        >
          <div className="max-w-2xl mb-12">
            <p className="font-mono text-xs font-medium text-maple-600 tracking-wider">
              01 / how the test works
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight text-balance">
              Practical computer literacy, randomized for every seat.
            </h2>
          </div>

          {/* Row 1: 7 / 5 Asymmetric Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 flex flex-col">
              <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 border border-slate-200/60 shadow-diffusion flex-1">
                <AutoSortingTopicStack />
              </div>
              <div className="mt-4 px-2">
                <h3 className="text-base font-semibold text-slate-900">
                  Six everyday topics, zero syllabus memorization
                </h3>
                <p className="mt-1 text-sm text-slate-600 max-w-[58ch]">
                  Shortcuts, hardware, everyday apps, web browsing, basic
                  connectivity, and respectful online conduct.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col">
              <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 border border-slate-200/60 shadow-diffusion flex-1">
                <LiveExamStatusCard />
              </div>
              <div className="mt-4 px-2">
                <h3 className="text-base font-semibold text-slate-900">
                  A private, class-specific question bank
                </h3>
                <p className="mt-1 text-sm text-slate-600 max-w-[46ch]">
                  Each attempt draws a randomized paper from questions configured by your teacher. Some questions may overlap.
                </p>
              </div>
            </div>
          </div>

          {/* Row 2: 5 / 7 Asymmetric Split */}
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 flex flex-col">
              <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 border border-slate-200/60 shadow-diffusion">
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between border-b border-slate-100 pb-3">
                    <span className="text-sm font-medium text-slate-700">
                      Step 1 · Online quiz
                    </span>
                    <span className="font-mono text-sm font-semibold text-maple-600 tabular-nums">
                      40% weight
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-slate-100 pb-3">
                    <span className="text-sm font-medium text-slate-700">
                      Step 2 · 1-week small project
                    </span>
                    <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      60% weight
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed pt-1">
                    Shortlisted students build one simple project of their own
                    choice in a week. Open workshops stay open to every student
                    regardless of shortlist status.
                  </p>
                </div>
              </div>
              <div className="mt-4 px-2">
                <h3 className="text-base font-semibold text-slate-900">
                  Simple two-step intake
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Effort and curiosity matter more than prior technical polish.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col">
              <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 border border-slate-200/60 shadow-diffusion">
                <InfiniteDomainStream />
                <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <span>Classes 6–10: Section A &amp; B</span>
                  <span>Classes 11–12: Maths, Bio, Commerce, Humanities</span>
                </div>
              </div>
              <div className="mt-4 px-2">
                <h3 className="text-base font-semibold text-slate-900">
                  What club squads build after joining
                </h3>
                <p className="mt-1 text-sm text-slate-600 max-w-[58ch]">
                  Members collaborate on web tools, data studies, electronics,
                  school media, and digital safety drives.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE CLASS 6-12 EXPLORER */}
        <section
          id="classes"
          className="border-t border-slate-200/60 bg-white/60 pt-14 pb-16 sm:pt-20 sm:pb-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ClassFormatExplorer />
          </div>
        </section>

        {/* INLINE SIDE-BY-SIDE ESSENTIAL DETAILS (Replaces Cliché Accordion FAQ) */}
        <section
          id="help"
          className="border-t border-slate-200/60 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 sm:pt-20 sm:pb-24"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
            <div className="lg:col-span-4">
              <p className="font-mono text-xs font-medium text-maple-600 tracking-wider">
                03 / essential details
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight text-balance">
                Clear answers before you begin.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-[40ch]">
                Have your school roll number ready and sign in from any lab PC,
                laptop, or mobile browser.
              </p>
              <div className="mt-6">
                <Link
                  href="/student/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-maple-600 hover:text-maple-700 transition-colors"
                >
                  Proceed to student login
                  <ArrowRight size={15} weight="regular" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-8 divide-y divide-slate-200/80 border-t border-b border-slate-200/80">
              {ESSENTIAL_NOTES.map((item) => (
                <article
                  key={item.q}
                  className="py-6 grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-6"
                >
                  <h3 className="sm:col-span-5 text-base font-semibold text-slate-900 leading-snug">
                    {item.q}
                  </h3>
                  <p className="sm:col-span-7 text-sm sm:text-base text-slate-600 leading-relaxed max-w-[58ch]">
                    {item.a}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* WHATSAPP TEST INVITATION & RICH SHARE CARD */}
        <section
          id="share-test"
          className="border-t border-slate-200/60 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 sm:pt-20 sm:pb-24"
        >
          <div className="mb-8">
            <p className="font-mono text-xs font-medium text-maple-600 tracking-wider">
              04 / share test link &amp; details
            </p>
          </div>
          <ShareTestCard />
        </section>
      </main>

      {/* Clean Minimal Footer with Navigation & Campus Attribution (Zero Admin Links) */}
      <footer className="border-t border-slate-200/70 bg-white py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <MaplesLogo size="sm" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Maples Academy, Khatauli
              </p>
              <p className="text-xs text-slate-500">
                Maples Tech Club · District Muzaffarnagar, U.P. – 251201
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-500">
            <a href="#overview" className="hover:text-slate-900 transition-colors">
              Quiz format
            </a>
            <a href="#classes" className="hover:text-slate-900 transition-colors">
              Classes 6–12
            </a>
            <Link
              href="/student/register"
              className="hover:text-slate-900 transition-colors"
            >
              Student registration
            </Link>
            <Link
              href="/student/login"
              className="hover:text-slate-900 transition-colors"
            >
              Student sign in
            </Link>
            <a
              href="#share-test"
              className="hover:text-slate-900 transition-colors"
            >
              Share on WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
