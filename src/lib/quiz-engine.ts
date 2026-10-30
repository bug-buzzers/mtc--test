import crypto from 'crypto';
import { Difficulty, Question } from './types';

/**
 * Cryptographically unbiased Fisher-Yates shuffle so every student receives
 * a genuinely random selection and question order from their private class pool.
 */
function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Picks up to `count` questions randomly from `pool`, spreading across distinct `subject_tag`s
 * so a student gets a well-rounded mix of Shortcuts, Hardware, Software, Browsing, Networking & Ethics.
 */
function pickRandomSubjectSpread(pool: Question[], count: number): Question[] {
  if (count <= 0 || pool.length === 0) return [];
  if (pool.length <= count) return shuffleArray(pool);

  const bySubject = new Map<string, Question[]>();
  for (const q of shuffleArray(pool)) {
    const tag = q.subject_tag || 'General';
    if (!bySubject.has(tag)) bySubject.set(tag, []);
    bySubject.get(tag)!.push(q);
  }

  const tags = shuffleArray(Array.from(bySubject.keys()));
  const selected: Question[] = [];
  let round = 0;

  while (selected.length < count) {
    let addedInRound = false;
    const roundTags = shuffleArray(tags);
    for (const tag of roundTags) {
      if (selected.length >= count) break;
      const bucket = bySubject.get(tag)!;
      if (round < bucket.length) {
        selected.push(bucket[round]);
        addedInRound = true;
      }
    }
    if (!addedInRound) break;
    round++;
  }

  return shuffleArray(selected);
}

/**
 * Randomly draws `targetCount` (e.g., 25) questions from the student's active class quiz pool.
 * Prioritizes unseen questions if an admin grants a student an extra attempt, and balances
 * difficulty gently (~40% easy, ~40% medium, ~20% practical everyday awareness).
 */
export function selectQuizQuestions(
  classQuestions: Question[],
  answeredQuestionIds: Set<string>,
  targetCount: number
): Question[] {
  const activePool = classQuestions.filter((q) => q.is_active);
  const count = Math.min(targetCount, activePool.length);
  if (count === 0) return [];

  const unusedPool = shuffleArray(
    activePool.filter((q) => !answeredQuestionIds.has(q.id))
  );
  const usedPool = shuffleArray(
    activePool.filter((q) => answeredQuestionIds.has(q.id))
  );

  const easyTarget = Math.round(count * 0.4);
  const hardTarget = Math.round(count * 0.2);
  const mediumTarget = Math.max(0, count - easyTarget - hardTarget);

  const targets: Record<Difficulty, number> = {
    easy: easyTarget,
    medium: mediumTarget,
    hard: hardTarget,
  };

  const chosenIds = new Set<string>();
  const chosen: Question[] = [];

  // Pass 1: Random draw from unused questions across difficulty tiers & topics
  (['easy', 'medium', 'hard'] as Difficulty[]).forEach((diff) => {
    const tierUnused = unusedPool.filter(
      (q) => q.difficulty === diff && !chosenIds.has(q.id)
    );
    const picked = pickRandomSubjectSpread(tierUnused, targets[diff]);
    for (const q of picked) {
      chosenIds.add(q.id);
      chosen.push(q);
    }
  });

  // Pass 2: Fill any remaining slots randomly from unused pool
  if (chosen.length < count) {
    const remainingUnused = unusedPool.filter((q) => !chosenIds.has(q.id));
    const fill = pickRandomSubjectSpread(remainingUnused, count - chosen.length);
    for (const q of fill) {
      chosenIds.add(q.id);
      chosen.push(q);
    }
  }

  // Pass 3: Backfill randomly from previously seen questions only if student exhausted the unseen pool
  if (chosen.length < count) {
    const remainingUsed = usedPool.filter((q) => !chosenIds.has(q.id));
    const fillUsed = pickRandomSubjectSpread(
      remainingUsed,
      count - chosen.length
    );
    for (const q of fillUsed) {
      chosenIds.add(q.id);
      chosen.push(q);
    }
  }

  return shuffleArray(chosen);
}
