import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth';
import { isValidClass } from '@/lib/constants';
import {
  getQuestionById,
  softDeleteQuestion,
  updateQuestion,
} from '@/lib/db';
import { Difficulty, OptionKey } from '@/lib/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const question = await getQuestionById(params.id);
  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }
  return NextResponse.json({ question });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const cls = Number(body.class);
    const subjectTag = String(body.subject_tag || '').trim();
    const difficulty = String(body.difficulty || '')
      .trim()
      .toLowerCase() as Difficulty;
    const questionText = String(body.question_text || '').trim();
    const optionA = String(body.option_a || '').trim();
    const optionB = String(body.option_b || '').trim();
    const optionC = String(body.option_c || '').trim();
    const optionD = String(body.option_d || '').trim();
    const correctOption = String(body.correct_option || '')
      .trim()
      .toLowerCase() as OptionKey;

    if (
      !isValidClass(cls) ||
      !subjectTag ||
      !['easy', 'medium', 'hard'].includes(difficulty) ||
      !questionText ||
      !optionA ||
      !optionB ||
      !optionC ||
      !optionD ||
      !['a', 'b', 'c', 'd'].includes(correctOption)
    ) {
      return NextResponse.json(
        { error: 'Please complete all required question fields accurately.' },
        { status: 400 }
      );
    }

    const updated = await updateQuestion(params.id, {
      class: cls,
      subject_tag: subjectTag,
      difficulty,
      question_text: questionText,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_option: correctOption,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Question not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Question updated successfully.',
      question: updated,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update question.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const deleted = await softDeleteQuestion(params.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
  }

  return NextResponse.json({
    message: 'Question deactivated (soft-deleted) while preserving past quiz records.',
  });
}
