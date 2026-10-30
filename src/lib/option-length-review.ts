import type { OptionKey, Question } from './types';

/** This is an editorial heuristic, not a determination of answer quality.
 * It must only be used in the authenticated teacher interface: the result
 * depends on the answer key and must never be sent to an exam taker. */
export type OptionLengthInput = Pick<Question, 'option_a' | 'option_b' | 'option_c' | 'option_d' | 'correct_option'>;
export type OptionLength = { characters: number; words: number };
export type OptionLengthReview = {
  complete: boolean;
  counts: Record<OptionKey, OptionLength>;
  correctLongestCharacters: boolean;
  correctLongestWords: boolean;
  correctLongest: boolean;
  uneven: boolean;
};

const keys: OptionKey[] = ['a', 'b', 'c', 'd'];

function measure(value: string): OptionLength {
  // Treat repeated whitespace and Unicode-combining characters consistently;
  // punctuation contributes to visual length, but is not counted as a word.
  const text = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const words = text.match(/[\p{L}\p{N}]+(?:[\p{M}'’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  return { characters: Array.from(text).length, words };
}

export function reviewOptionLengths(input: OptionLengthInput): OptionLengthReview {
  const counts = {
    a: measure(input.option_a), b: measure(input.option_b),
    c: measure(input.option_c), d: measure(input.option_d),
  };
  const complete = keys.every((key) => counts[key].characters > 0) && keys.includes(input.correct_option);
  if (!complete) return { complete, counts, correctLongestCharacters: false, correctLongestWords: false, correctLongest: false, uneven: false };

  const correct = counts[input.correct_option];
  const lengths = keys.map((key) => counts[key]);
  const longestChars = Math.max(...lengths.map((item) => item.characters));
  const shortestChars = Math.min(...lengths.map((item) => item.characters));
  const longestWords = Math.max(...lengths.map((item) => item.words));
  const shortestWords = Math.min(...lengths.map((item) => item.words));
  // Ties still leave a reduced set for a test taker to guess from. Equal
  // lengths across every option are not flagged as a longest-answer clue.
  const correctLongestCharacters = correct.characters === longestChars && shortestChars < longestChars;
  const correctLongestWords = correct.words === longestWords && shortestWords < longestWords;
  const uneven = (longestChars - shortestChars >= 8 && longestChars > shortestChars * 1.5)
    || (longestWords - shortestWords >= 2 && longestWords > shortestWords * 1.5);

  return { complete, counts, correctLongestCharacters, correctLongestWords,
    correctLongest: correctLongestCharacters || correctLongestWords, uneven };
}
