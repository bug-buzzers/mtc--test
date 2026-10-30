import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewOptionLengths } from '../src/lib/option-length-review';

const balanced = { option_a: 'red car', option_b: 'big dog', option_c: 'new pen', option_d: 'old fox', correct_option: 'a' as const };

test('finds a correct answer that is longest by characters or words, including ties', () => {
  const byCharacters = reviewOptionLengths({ ...balanced, option_a: 'extraordinary', option_b: 'cat', option_c: 'dog', option_d: 'rat' });
  assert.equal(byCharacters.correctLongestCharacters, true);
  assert.equal(byCharacters.correctLongestWords, false);
  assert.equal(byCharacters.correctLongest, true);

  const byWords = reviewOptionLengths({ ...balanced, option_a: 'a b c d', option_b: 'extraordinary', option_c: 'x', option_d: 'y' });
  assert.equal(byWords.correctLongestCharacters, false);
  assert.equal(byWords.correctLongestWords, true);
  assert.equal(byWords.correctLongest, true);

  const tied = reviewOptionLengths({ ...balanced, option_c: 'rat' });
  assert.equal(tied.correctLongest, true, 'a tie among only some options still leaves a guessable subset');
});

test('comparable options remove the length clue without rewriting the correct answer', () => {
  const original = { ...balanced, option_b: 'dog', option_c: 'pen', option_d: 'fox' };
  assert.equal(reviewOptionLengths(original).correctLongest, true);
  const revised = { ...original, option_b: 'big dog', option_c: 'new pen', option_d: 'old fox' };
  const review = reviewOptionLengths(revised);
  assert.equal(revised.option_a, original.option_a);
  assert.equal(review.correctLongest, false);
  assert.equal(review.uneven, false);
  assert.deepEqual(review.counts.a, { words: 2, characters: 7 });
});

test('independently flags uneven distractors and handles Unicode, whitespace, punctuation and incomplete forms', () => {
  const uneven = reviewOptionLengths({ ...balanced, option_b: 'A much longer incorrect alternative with extra detail' });
  assert.equal(uneven.correctLongest, false);
  assert.equal(uneven.uneven, true);
  const normalized = reviewOptionLengths({ ...balanced, option_a: ' e\u0301   car ', option_b: 'é car' });
  assert.deepEqual(normalized.counts.a, { characters: 5, words: 2 });
  assert.deepEqual(normalized.counts.b, normalized.counts.a);
  const symbols = reviewOptionLengths({ ...balanced, option_a: 'Ctrl + C', option_b: 'Ctrl + V' });
  assert.equal(symbols.counts.a.words, 2);
  const incomplete = reviewOptionLengths({ ...balanced, option_d: '  ' });
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.correctLongest, false);
  assert.equal(incomplete.uneven, false);
});
