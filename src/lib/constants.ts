export const SCHOOL_NAME = 'Maples Academy, Khatauli';
export const SCHOOL_LOCATION =
  'Khatauli, District Muzaffarnagar, Uttar Pradesh – 251201';
export const CLUB_NAME = 'Maples Tech Club (MTC)';
export const CLUB_MOTTO = 'Learn it. Build it. Ship it.';
export const LOGO_LOCAL_PATH = '/maples-logo.png';
export const LOGO_REMOTE_URL =
  'https://mapleskhatauli.com/wp-content/uploads/2025/03/maples_khatauli_logo_b_elong.png';

export const CLASSES = [6, 7, 8, 9, 10, 11, 12] as const;
export type SchoolClass = (typeof CLASSES)[number];

/**
 * Maples Academy Khatauli Section / Stream Structure:
 * - Classes 6 to 10: Section A and Section B only
 * - Classes 11 and 12: Maths, Bio, Commerce, Humanities
 */
export const SECTIONS_BY_CLASS: Record<number, string[]> = {
  6: ['A', 'B'],
  7: ['A', 'B'],
  8: ['A', 'B'],
  9: ['A', 'B'],
  10: ['A', 'B'],
  11: ['Maths', 'Bio', 'Commerce', 'Humanities'],
  12: ['Maths', 'Bio', 'Commerce', 'Humanities'],
};

export const ALL_SECTIONS = [
  'A',
  'B',
  'Maths',
  'Bio',
  'Commerce',
  'Humanities',
] as const;

export function getSectionsForClass(
  cls: number | string | null | undefined
): string[] {
  const num = Number(cls);
  if (SECTIONS_BY_CLASS[num]) {
    return SECTIONS_BY_CLASS[num];
  }
  return [...ALL_SECTIONS];
}

export function getSectionFieldLabel(
  cls: number | string | null | undefined
): string {
  const num = Number(cls);
  if (num === 11 || num === 12) {
    return 'Stream';
  }
  return 'Section';
}

export function formatSectionDisplay(cls: number, section: string): string {
  if (cls >= 11) {
    return `${section} Stream`;
  }
  return `Section ${section}`;
}

export function isValidClass(cls: number): boolean {
  return Number.isInteger(cls) && cls >= 6 && cls <= 12;
}

export function isValidClassSection(cls: number, section: string): boolean {
  const allowed = SECTIONS_BY_CLASS[cls];
  return Array.isArray(allowed) && allowed.includes(section);
}

/**
 * Practical, Non-Syllabus Everyday Computer Literacy Topics
 * (100+ questions per class across Classes 6–12, drawn randomly during each test)
 */
export const CORE_ENTRANCE_TAGS = [
  'Keyboard Shortcuts',
  'Computer Hardware',
  'Application Software & OS',
  'Web Browsing & Internet',
  'Basic Networking & Connectivity',
  'Social Ethics & Cyber Safety',
] as const;

export const SUBJECT_TAGS_BY_CLASS: Record<number, string[]> = {
  6: [...CORE_ENTRANCE_TAGS],
  7: [...CORE_ENTRANCE_TAGS],
  8: [...CORE_ENTRANCE_TAGS],
  9: [...CORE_ENTRANCE_TAGS],
  10: [...CORE_ENTRANCE_TAGS],
  11: [...CORE_ENTRANCE_TAGS],
  12: [...CORE_ENTRANCE_TAGS],
};

export const ALL_SUBJECT_TAGS = [...CORE_ENTRANCE_TAGS];

export const AUTH_COOKIE_NAME = 'mtc_auth_token';
