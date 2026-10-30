import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/auth-server';
import { listResultsWithDetails } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clsParam = searchParams.get('class');
  const sectionParam = searchParams.get('section');
  const statusParam = (searchParams.get('status') || 'all') as
    | 'all'
    | 'passed'
    | 'failed';
  const searchParam = searchParams.get('search') || undefined;

  const results = await listResultsWithDetails({
    class: clsParam && clsParam !== 'all' ? Number(clsParam) : undefined,
    section:
      sectionParam && sectionParam !== 'all' ? sectionParam : undefined,
    status: statusParam,
    search: searchParam,
  });

  return NextResponse.json({ results });
}
