import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { CLASSES, isValidClass } from '@/lib/constants';
import { bulkCreateQuestions, createQuestion, listQuestions } from '@/lib/db';
import { getSupabase, isSupabaseConfigured } from '@/lib/db/connection';
import { reviewOptionLengths } from '@/lib/option-length-review';
import { Difficulty, OptionKey, Question } from '@/lib/types';

function validateQuestion(item: Record<string, unknown>) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const cls = Number(item.class), subject = String(item.subject_tag || '').trim(), difficulty = String(item.difficulty || '').trim().toLowerCase() as Difficulty;
  const text = String(item.question_text || '').trim(), a = String(item.option_a || '').trim(), b = String(item.option_b || '').trim(), c = String(item.option_c || '').trim(), d = String(item.option_d || '').trim();
  const correct = String(item.correct_option || '').trim().toLowerCase() as OptionKey;
  if (!isValidClass(cls) || !subject || subject.length > 150 || !['easy','medium','hard'].includes(difficulty) || !text || text.length > 3000 || [a,b,c,d].some((v) => !v || v.length > 1000) || !['a','b','c','d'].includes(correct)) return null;
  return { class: cls, subject_tag: subject, difficulty, question_text: text, option_a: a, option_b: b, option_c: c, option_d: d, correct_option: correct };
}

type ReviewFilter = 'all' | 'correct_longest' | 'uneven';
function matchesLengthReview(q: Question, filter: ReviewFilter): boolean {
  if (filter === 'all') return true;
  const review = reviewOptionLengths(q);
  return filter === 'correct_longest' ? review.correctLongest : review.uneven;
}

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const p = req.nextUrl.searchParams;
    const cls = Number(p.get('class')); const diff = p.get('difficulty') || ''; const subject = p.get('subject_tag') || '';
    const search = (p.get('search') || '').trim().slice(0, 150);
    const rawPage = Number(p.get('page'));
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.min(100000, Math.floor(rawPage))) : 1;
    const requestedSize = Number(p.get('page_size')); const pageSize = [10,25,50].includes(requestedSize) ? requestedSize : 10;
    const requestedReview = p.get('length_review');
    const review: ReviewFilter = requestedReview === 'correct_longest' || requestedReview === 'uneven' ? requestedReview : 'all';
    const order: Record<string, { column: string; ascending: boolean }> = {
      class: { column: 'class', ascending: true }, newest: { column: 'created_at', ascending: false },
      topic: { column: 'subject_tag', ascending: true }, difficulty: { column: 'difficulty', ascending: true }, question: { column: 'question_text', ascending: true },
    };
    const selectedOrder = order[p.get('sort') || 'class'] || order.class;
    let questions: Question[] = [], total = 0, classCounts: Array<{class: number; total: number}> = [];
    if (isSupabaseConfigured()) {
      const makeQuery = () => {
        let query = getSupabase().from('questions').select('*', { count: 'exact' }).eq('is_active', true).gte('bank_generation', 2);
        if (isValidClass(cls)) query = query.eq('class', cls);
        if (['easy','medium','hard'].includes(diff)) query = query.eq('difficulty', diff);
        if (subject && subject !== 'all') query = query.eq('subject_tag', subject);
        if (search) query = query.ilike('question_text', `%${search.replace(/[%_\\]/g, '')}%`);
        return query.order(selectedOrder.column, { ascending: selectedOrder.ascending }).order('id');
      };
      if (review === 'all') {
        const response = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
        if (response.error) throw new Error(response.error.message);
        questions = (response.data || []) as Question[]; total = response.count || 0;
      } else {
        // PostgREST cannot filter by the editorial heuristic without exposing
        // the key or altering stored questions. Scan every matching page on the
        // server, then return only the requested page of flagged questions.
        // Offset advances by the actual response length, including when a
        // project's configured PostgREST row limit is smaller than 1,000.
        const from = (page - 1) * pageSize;
        for (let offset = 0; ; ) {
          const response = await makeQuery().range(offset, offset + 999);
          if (response.error) throw new Error(response.error.message);
          if (!response.data?.length) break;
          for (const q of response.data as Question[]) {
            if (!matchesLengthReview(q, review)) continue;
            if (total >= from && total < from + pageSize) questions.push(q);
            total++;
          }
          offset += response.data.length;
          if (response.count !== null && offset >= response.count) break;
        }
      }
      classCounts = await Promise.all(CLASSES.map(async (c) => {
        const result = await getSupabase().from('questions').select('id', { count: 'exact', head: true }).eq('is_active', true).gte('bank_generation', 2).eq('class', c);
        if (result.error) throw new Error(result.error.message);
        return { class: c, total: result.count || 0 };
      }));
    } else {
      const all = await listQuestions();
      classCounts = CLASSES.map((c) => ({ class: c, total: all.filter((q) => q.class === c).length }));
      const filtered = all.filter((q) => (!isValidClass(cls) || q.class === cls) && (!['easy','medium','hard'].includes(diff) || q.difficulty === diff) && (!subject || subject === 'all' || q.subject_tag === subject) && (!search || q.question_text.toLowerCase().includes(search.toLowerCase())) && matchesLengthReview(q, review));
      filtered.sort((a, b) => {
        const key = selectedOrder.column as keyof Question; const av = a[key], bv = b[key];
        return (typeof av === 'number' && typeof bv === 'number' ? av-bv : String(av).localeCompare(String(bv))) * (selectedOrder.ascending ? 1 : -1) || a.id.localeCompare(b.id);
      });
      total = filtered.length; questions = filtered.slice((page-1)*pageSize, page*pageSize);
    }
    return NextResponse.json({ questions, total, page, page_size: pageSize, class_counts: classCounts }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { console.error('Question listing failed', error); return NextResponse.json({ error: 'Unable to load questions.' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    if (Array.isArray(body.questions)) {
      if (!body.questions.length || body.questions.length > 500) return NextResponse.json({ error: 'Import between 1 and 500 questions at a time.' }, { status: 400 });
      const validated = body.questions.map((q: Record<string, unknown>) => validateQuestion(q));
      const badIndex = validated.findIndex((q: ReturnType<typeof validateQuestion>) => !q);
      if (badIndex >= 0) return NextResponse.json({ error: `Question ${badIndex + 1} has invalid or missing fields.` }, { status: 400 });
      const items = validated as NonNullable<ReturnType<typeof validateQuestion>>[];
      const reviews = items.map(reviewOptionLengths);
      const count = await bulkCreateQuestions(items);
      return NextResponse.json({ message: `Imported ${count} private questions.`, count,
        length_review: { correct_longest: reviews.filter((r) => r.correctLongest).length, uneven: reviews.filter((r) => r.uneven).length } }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
    }
    const question = validateQuestion(body);
    if (!question) return NextResponse.json({ error: 'Complete all question fields accurately.' }, { status: 400 });
    return NextResponse.json({ message: 'Question added.', question: await createQuestion(question), length_review: reviewOptionLengths(question) }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { console.error('Question save failed', error); return NextResponse.json({ error: 'Unable to save questions.' }, { status: 500 }); }
}
