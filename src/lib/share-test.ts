import type { Metadata } from 'next';
import {
  CLUB_MOTTO,
  CLUB_NAME,
  CORE_ENTRANCE_TAGS,
  SCHOOL_LOCATION,
  SCHOOL_NAME,
  SECTIONS_BY_CLASS,
  isValidClass,
} from './constants';

export interface ShareTestOptions {
  /** Base portal origin or URL (e.g. https://mtc.mapleskhatauli.com) */
  baseUrl: string;
  /** Optional class filter (6–12) for class-specific WhatsApp group shares */
  targetClass?: number | null;
  /** Optional customized question count (defaults to 25) */
  totalQuestions?: number;
  /** Optional customized duration in minutes (defaults to 30) */
  timeLimitMinutes?: number;
  /** Optional passing score count */
  passingScore?: number | null;
}

export function normalizeBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return 'https://mtc-exam.vercel.app';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function resolveMetadataBaseUrl(
  headersList?: { get(name: string): string | null } | null
): URL {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (explicit) {
    try {
      return new URL(normalizeBaseUrl(explicit));
    } catch {
      // fall through to request headers or fallback
    }
  }

  if (headersList) {
    const rawHost =
      headersList.get('x-forwarded-host') || headersList.get('host');
    const host = rawHost?.split(',')[0]?.trim();
    if (host) {
      const rawProto = headersList.get('x-forwarded-proto')?.split(',')[0]?.trim();
      const proto =
        rawProto ||
        (host.startsWith('localhost') || host.startsWith('127.0.0.1')
          ? 'http'
          : 'https');
      try {
        return new URL(`${proto}://${host}`);
      } catch {
        // fall through
      }
    }
  }

  return new URL('https://mtc-exam.vercel.app');
}

export function buildTestShareLinks(
  baseUrl: string,
  targetClass?: number | null
): {
  portalUrl: string;
  registerUrl: string;
  loginUrl: string;
  shareUrl: string;
} {
  const origin = normalizeBaseUrl(baseUrl);
  const validClass =
    typeof targetClass === 'number' && isValidClass(targetClass)
      ? targetClass
      : null;

  const classQuery = validClass ? `?class=${validClass}` : '';

  return {
    portalUrl: `${origin}/${classQuery}`,
    registerUrl: `${origin}/student/register${classQuery}`,
    loginUrl: `${origin}/student/login${classQuery}`,
    shareUrl: `${origin}/${classQuery}`,
  };
}

export function buildWhatsAppTestMessage({
  baseUrl,
  targetClass = null,
  totalQuestions = 25,
  timeLimitMinutes = 30,
  passingScore = null,
}: ShareTestOptions): string {
  const validClass =
    typeof targetClass === 'number' && isValidClass(targetClass)
      ? targetClass
      : null;

  const { portalUrl, registerUrl, loginUrl } = buildTestShareLinks(
    baseUrl,
    validClass
  );

  const eligibilityLine = validClass
    ? validClass >= 11
      ? `Class ${validClass} (${SECTIONS_BY_CLASS[validClass].join(', ')} Streams)`
      : `Class ${validClass} (${SECTIONS_BY_CLASS[validClass].map((s) => `Section ${s}`).join(' & ')})`
    : 'Classes 6 to 10 (Section A & B) and Classes 11 to 12 (Maths, Bio, Commerce & Humanities)';

  const heading = validClass
    ? `*${SCHOOL_NAME}*\n*${CLUB_NAME} — Class ${validClass} Online Entrance Test*`
    : `*${SCHOOL_NAME}*\n*${CLUB_NAME} — Online Entrance Test*`;

  const qualifyingLine =
    typeof passingScore === 'number' && passingScore > 0 && totalQuestions > 0
      ? `\n• *Qualifying Score:* ${passingScore}/${totalQuestions} (${Math.round(
          (passingScore / totalQuestions) * 100
        )}%)`
      : '';

  const topicsList = CORE_ENTRANCE_TAGS.join(', ');

  return [
    heading,
    `_${CLUB_MOTTO}_`,
    '',
    'Dear Students,',
    validClass
      ? `Appear for the *Class ${validClass} Maples Tech Club (MTC)* step-one online entrance quiz from any computer lab PC, laptop, or mobile browser.`
      : 'Appear for the *Maples Tech Club (MTC)* step-one online entrance quiz from any computer lab PC, laptop, or mobile browser.',
    '',
    '*Test Details & Format:*',
    `• *Eligibility:* ${eligibilityLine}`,
    `• *Questions:* ${totalQuestions} Multiple Choice Questions (Randomized paper)`,
    `• *Time Limit:* ${timeLimitMinutes} Minutes`,
    `• *Negative Marking:* None (0.00)${qualifyingLine}`,
    `• *Topics Covered:* ${topicsList} _(Practical everyday computer awareness — no coding or textbook syllabus required)_`,
    '• *Registration:* Free — use your Name, School Roll Number, Class & Section/Stream (no email required)',
    '',
    '*Test Portal & Direct Links:*',
    `• *Test Portal & Details:* ${portalUrl}`,
    `• *New Student Registration:* ${registerUrl}`,
    `• *Student Sign In & Start Test:* ${loginUrl}`,
    '',
    `📍 _${SCHOOL_LOCATION}_`,
  ].join('\n');
}

export function buildWhatsAppShareHref(message: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

export function buildPortalMetadata(
  headersList?: { get(name: string): string | null } | null,
  targetClass?: number | null
): Metadata {
  const metadataBase = resolveMetadataBaseUrl(headersList);
  const validClass =
    typeof targetClass === 'number' && isValidClass(targetClass)
      ? targetClass
      : null;

  const shareTitle = validClass
    ? `${CLUB_NAME} — Class ${validClass} Online Entrance Test | ${SCHOOL_NAME}`
    : `${CLUB_NAME} — Online Entrance Test | ${SCHOOL_NAME}`;

  const classEligibility = validClass
    ? validClass >= 11
      ? `Class ${validClass} (${SECTIONS_BY_CLASS[validClass].join(', ')})`
      : `Class ${validClass} (Section ${SECTIONS_BY_CLASS[validClass].join(' & ')})`
    : 'Classes 6 to 12';

  const shareDescription = `${SCHOOL_NAME} · ${classEligibility} Online Entrance Quiz (25 MCQs · 30 Min · Zero Negative Marking). Practical everyday computer literacy — shortcuts, hardware, apps, web & cyber safety. ${CLUB_MOTTO}`;

  const primaryImageUrl = validClass
    ? `/api/og?class=${validClass}`
    : '/whatsapp-share.png';

  return {
    metadataBase,
    title: {
      default: validClass
        ? `Class ${validClass} Entrance Test — Maples Tech Club | Maples Academy, Khatauli`
        : 'Maples Tech Club — Entrance Portal | Maples Academy, Khatauli',
      template: '%s | Maples Tech Club · Maples Academy, Khatauli',
    },
    description: shareDescription,
    applicationName: 'Maples Tech Club Entrance Portal',
    keywords: [
      'Maples Academy Khatauli',
      'Maples Tech Club',
      'MTC Entrance Test',
      'Online Quiz Portal',
      'Classes 6 to 12',
      'Computer Literacy Quiz',
      'Muzaffarnagar',
    ],
    alternates: {
      canonical: validClass ? `/?class=${validClass}` : '/',
    },
    openGraph: {
      title: shareTitle,
      description: shareDescription,
      url: validClass ? `/?class=${validClass}` : '/',
      siteName: `${SCHOOL_NAME} · ${CLUB_NAME}`,
      type: 'website',
      locale: 'en_IN',
      images: [
        {
          url: primaryImageUrl,
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: `${SCHOOL_NAME} — ${CLUB_NAME} Online Entrance Test Portal (25 MCQs · 30 Mins · ${classEligibility})`,
        },
        {
          url: '/whatsapp-share-square.png',
          width: 600,
          height: 600,
          type: 'image/png',
          alt: `${SCHOOL_NAME} — ${CLUB_NAME} Entrance Test Card`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description: shareDescription,
      images: [primaryImageUrl],
    },
  };
}
