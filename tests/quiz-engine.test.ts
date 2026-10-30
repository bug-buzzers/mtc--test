import assert from 'node:assert/strict';
import test from 'node:test';
import { selectQuizQuestions } from '../src/lib/quiz-engine';
import { Difficulty, Question } from '../src/lib/types';

test('random papers contain only active, unique questions and prefer unseen material', () => {
  const now = new Date().toISOString();
  const pool: Question[] = Array.from({ length: 75 }, (_, i) => ({ id: String(i), class: 6, subject_tag: `Topic ${i % 5}`, difficulty: (['easy', 'medium', 'hard'] as Difficulty[])[i % 3], question_text: `Synthetic ${i}`, option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', correct_option: 'a', is_active: true, created_at: now, updated_at: now }));
  pool[0].is_active = false;
  const seen = new Set(pool.slice(0, 20).map((q) => q.id));
  for (let run = 0; run < 10; run++) {
    const selected = selectQuizQuestions(pool, seen, 25);
    assert.equal(selected.length, 25); assert.equal(new Set(selected.map((q) => q.id)).size, 25);
    assert.ok(selected.every((q) => q.is_active && !seen.has(q.id)));
    assert.equal(selected.filter((q) => q.difficulty === 'easy').length, 10);
    assert.equal(selected.filter((q) => q.difficulty === 'medium').length, 10);
    assert.equal(selected.filter((q) => q.difficulty === 'hard').length, 5);
  }
  assert.equal(selectQuizQuestions(pool, new Set(), 100).length, 74);
  assert.equal(selectQuizQuestions(pool, new Set(), 0).length, 0);
});
