import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { reviewOptionLengths, type OptionLengthInput } from '../src/lib/option-length-review';

const schema = readFileSync('supabase/schema.sql', 'utf8');
const seed = readFileSync('supabase/legacy-756-question-seed.sql', 'utf8');

async function freshDb() {
  const db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  return db;
}

test('legacy seed requires the schema and creates a balanced, repeatable 756-question bank', async () => {
  const empty = await freshDb();
  try {
    await assert.rejects(() => empty.exec(seed), /Apply the complete supabase\/schema.sql/);
  } finally { await empty.close(); }

  const db = await freshDb();
  try {
    await db.exec(schema);
    await db.exec(seed);
    const report = await db.query('SELECT * FROM pg_temp.mtc_revised_seed_report_20261030 ORDER BY class');
    assert.deepEqual(report.rows, Array.from({ length: 7 }, (_, i) => ({
      class: i + 6, expected: 108, revised_ready: 108, needs_review: 0, other_active_matches: 0,
    })));
    const questions = await db.query<OptionLengthInput & { id: string; updated_at: Date }>(
      'SELECT id, option_a, option_b, option_c, option_d, correct_option, updated_at FROM questions WHERE is_active AND bank_generation >= 2',
    );
    assert.equal(questions.rows.length, 756);
    let uniquelyLongest = 0;
    for (const question of questions.rows) {
      const review = reviewOptionLengths(question);
      assert.equal(review.complete, true);
      assert.equal(review.uneven, false);
      const lengths = Object.values(review.counts).map((item) => item.characters);
      const correct = review.counts[question.correct_option].characters;
      const others = (['a', 'b', 'c', 'd'] as const)
        .filter((key) => key !== question.correct_option).map((key) => review.counts[key].characters);
      if (correct > Math.max(...others)) {
        uniquelyLongest++;
        assert.ok(correct - Math.max(...others) <= 5, 'correct-option character lead should remain small');
      }
      assert.equal(lengths.length, 4);
    }
    assert.ok(uniquelyLongest <= 124, 'correct option should not usually be the unique longest');
    const timestamps = new Map(questions.rows.map((q) => [q.id, String(q.updated_at)]));
    await db.exec(seed);
    const repeated = await db.query<{ id: string; updated_at: Date }>('SELECT id, updated_at FROM questions');
    assert.equal(repeated.rows.length, 756);
    for (const q of repeated.rows) assert.equal(String(q.updated_at), timestamps.get(q.id));
    assert.deepEqual((await db.query('SELECT * FROM pg_temp.mtc_revised_seed_report_20261030 ORDER BY class')).rows, report.rows);
  } finally { await db.close(); }
});

test('legacy seed preserves teacher edits, inactive questions and unrelated questions', async () => {
  const db = await freshDb();
  try {
    await db.exec(schema);
    await db.exec(seed);
    const selected = await db.query<{ id: string }>('SELECT id FROM questions WHERE class=6 ORDER BY id LIMIT 3');
    const [edited, inactive, renamed] = selected.rows.map((q) => q.id);
    await db.query("UPDATE questions SET option_a='Teacher customized option' WHERE id=$1", [edited]);
    await db.query('UPDATE questions SET is_active=false WHERE id=$1', [inactive]);
    await db.query("UPDATE questions SET question_text='Teacher edited prompt' WHERE id=$1", [renamed]);
    await db.exec("INSERT INTO questions(class,subject_tag,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option) VALUES (6,'Other','easy','Unrelated','One','Two','Three','Four','a')");
    await db.exec(seed);
    await db.exec(seed);
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int n FROM questions')).rows[0].n, 757);
    assert.equal((await db.query<{ option_a: string }>('SELECT option_a FROM questions WHERE id=$1', [edited])).rows[0].option_a, 'Teacher customized option');
    assert.equal((await db.query<{ is_active: boolean }>('SELECT is_active FROM questions WHERE id=$1', [inactive])).rows[0].is_active, false);
    assert.equal((await db.query<{ question_text: string }>('SELECT question_text FROM questions WHERE id=$1', [renamed])).rows[0].question_text, 'Teacher edited prompt');
    const report = (await db.query<{ needs_review: number; other_active_matches: number }>('SELECT needs_review,other_active_matches FROM pg_temp.mtc_revised_seed_report_20261030 WHERE class=6')).rows[0];
    assert.deepEqual(report, { needs_review: 3, other_active_matches: 2 });
  } finally { await db.close(); }
});
