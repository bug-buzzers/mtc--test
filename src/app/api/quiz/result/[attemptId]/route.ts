import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import {
  getDetailedAttemptReview,
  getExamConfigByClass,
} from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const review = await getDetailedAttemptReview((await params).attemptId);
  if (!review || review.attempt.student_id !== auth.sub) {
    return NextResponse.json(
      { error: 'Attempt not found.' },
      { status: 404 }
    );
  }

  if (review.attempt.status !== 'submitted' && review.attempt.status !== 'graded') {
    return NextResponse.json(
      { error: 'A result is available only for a completed exam.' },
      { status: 400 }
    );
  }

  const config = await getExamConfigByClass(review.attempt.class);
  if (!config.show_results_to_students) {
    return NextResponse.json(
      {
        error:
          'Question-wise results have not been released by your teacher yet. Please check back once results are enabled!',
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    attempt: {
      id: review.attempt.id,
      class: review.attempt.class,
      started_at: review.attempt.started_at,
      submitted_at: review.attempt.submitted_at,
      total_questions: review.attempt.total_questions,
      correct_count: review.attempt.correct_count ?? 0,
      score_percentage: review.attempt.score_percentage ?? 0,
      passed: Boolean(review.attempt.passed),
      passing_score: review.attempt.passing_score_snapshot,
    },
    student: review.student,
    items: review.items.map((item) => ({
      question_number: item.question_number,
      subject_tag: item.subject_tag,
      question_text: item.question_text,
      option_a: item.option_a,
      option_b: item.option_b,
      option_c: item.option_c,
      option_d: item.option_d,
      selected_option: item.selected_option,
      correct_option: item.correct_option,
      is_correct: item.is_correct,
    })),
  });
}
