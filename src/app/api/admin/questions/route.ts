import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth';
import { CLASSES, isValidClass } from '@/lib/constants';
import {
  bulkCreateQuestions,
  createQuestion,
  listQuestions,
} from '@/lib/db';
import { loadAllQuestionsFromQuizFiles } from '@/lib/db/quiz-files-loader';
import { Difficulty, OptionKey } from '@/lib/types';

function validateQuestionPayload(item: Record<string, unknown>) {
  const cls = Number(item.class);
  const subjectTag = String(item.subject_tag || '').trim();
  const difficulty = String(item.difficulty || '')
    .trim()
    .toLowerCase() as Difficulty;
  const questionText = String(item.question_text || '').trim();
  const optionA = String(item.option_a || '').trim();
  const optionB = String(item.option_b || '').trim();
  const optionC = String(item.option_c || '').trim();
  const optionD = String(item.option_d || '').trim();
  const correctOption = String(item.correct_option || '')
    .trim()
    .toLowerCase() as OptionKey;

  if (!isValidClass(cls)) {
    return { error: 'Class must be between 6 and 12.' };
  }
  if (!subjectTag) {
    return { error: 'Subject / Topic tag is required.' };
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    return { error: 'Difficulty must be easy, medium, or hard.' };
  }
  if (!questionText) {
    return { error: 'Question text is required.' };
  }
  if (!optionA || !optionB || !optionC || !optionD) {
    return { error: 'All four options (A, B, C, D) are required.' };
  }
  if (!['a', 'b', 'c', 'd'].includes(correctOption)) {
    return { error: 'Correct option must be a, b, c, or d.' };
  }

  return {
    value: {
      class: cls,
      subject_tag: subjectTag,
      difficulty,
      question_text: questionText,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_option: correctOption,
    },
  };
}

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clsParam = searchParams.get('class');
  const diffParam = searchParams.get('difficulty') as Difficulty | null;
  const subjectParam = searchParams.get('subject_tag');
  const searchParam = searchParams.get('search');

  const [filteredQuestions, allActiveQuestions] = await Promise.all([
    listQuestions({
      class: clsParam && clsParam !== 'all' ? Number(clsParam) : undefined,
      difficulty:
        diffParam && ['easy', 'medium', 'hard'].includes(diffParam)
          ? diffParam
          : undefined,
      subject_tag:
        subjectParam && subjectParam !== 'all' ? subjectParam : undefined,
      search: searchParam || undefined,
    }),
    listQuestions(),
  ]);

  const classCounts = CLASSES.map((c) => {
    const items = allActiveQuestions.filter((q) => q.class === c);
    return {
      class: c,
      total: items.length,
      easy: items.filter((q) => q.difficulty === 'easy').length,
      medium: items.filter((q) => q.difficulty === 'medium').length,
      hard: items.filter((q) => q.difficulty === 'hard').length,
    };
  });

  return NextResponse.json({
    questions: filteredQuestions,
    class_counts: classCounts,
    total_active: allActiveQuestions.length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Sync directly from database/quizzes/class-*.json schema files
    if (body.action === 'sync_schema_files') {
      const existing = await listQuestions({ include_inactive: true });
      const existingSet = new Set(
        existing.map(
          (q) => `${q.class}::${q.question_text.trim().toLowerCase()}`
        )
      );
      const fromFiles = loadAllQuestionsFromQuizFiles().filter(
        (fq) =>
          !existingSet.has(
            `${fq.class}::${fq.question_text.trim().toLowerCase()}`
          )
      );
      const inserted = await bulkCreateQuestions(
        fromFiles.map(({ code: _code, ...rest }) => rest)
      );
      return NextResponse.json({
        message:
          inserted > 0
            ? `Synced ${inserted} new questions from database/quizzes/*.json!`
            : 'All 756 practical quiz schema questions (108 per class) from database/quizzes/*.json are already synced!',
        inserted,
      });
    }

    // Support CSV / Bulk array import
    if (Array.isArray(body.questions)) {
      const validated = [];
      for (let i = 0; i < body.questions.length; i++) {
        const check = validateQuestionPayload(body.questions[i]);
        if (check.error || !check.value) {
          return NextResponse.json(
            { error: `Row ${i + 1}: ${check.error}` },
            { status: 400 }
          );
        }
        validated.push(check.value);
      }
      const inserted = await bulkCreateQuestions(validated);
      return NextResponse.json(
        { message: `Successfully imported ${inserted} questions.`, inserted },
        { status: 201 }
      );
    }

    const check = validateQuestionPayload(body);
    if (check.error || !check.value) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const created = await createQuestion(check.value);
    return NextResponse.json(
      { message: 'Question added successfully.', question: created },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Unable to save question.',
      },
      { status: 500 }
    );
  }
}
