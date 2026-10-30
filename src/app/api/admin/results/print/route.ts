import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth';
import { listResultsWithDetails } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clsParam = searchParams.get('class');
  const sectionParam = searchParams.get('section');

  const allAppeared = await listResultsWithDetails({
    class: clsParam && clsParam !== 'all' ? Number(clsParam) : undefined,
    section:
      sectionParam && sectionParam !== 'all' ? sectionParam : undefined,
    status: 'all',
  });

  const selected = allAppeared
    .filter((r) => r.passed)
    .sort(
      (a, b) =>
        a.class - b.class ||
        b.correct_count - a.correct_count ||
        a.roll_number.localeCompare(b.roll_number, undefined, { numeric: true })
    );

  return NextResponse.json({
    selected_students: selected,
    total_selected: selected.length,
    total_appeared: allAppeared.length,
    generated_at: new Date().toISOString(),
  });
}
