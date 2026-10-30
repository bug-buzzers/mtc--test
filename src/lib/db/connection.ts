import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedSupabase: SupabaseClient | null = null;

/** Fail closed in production. The JSON backend is opt-in and development only. */
export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const configured = Boolean(url && /^https?:\/\//.test(url) && key && !url.includes('your-project') && !key.includes('your-service'));
  if (!configured && (process.env.NODE_ENV === 'production' || (process.env.NODE_ENV !== 'test' && process.env.MTC_ALLOW_LOCAL_DEV !== 'true'))) {
    throw new Error('Supabase is required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Local JSON is available only with MTC_ALLOW_LOCAL_DEV=true in development.');
  }
  return configured;
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');
  if (!cachedSupabase) {
    cachedSupabase = createClient((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedSupabase;
}

/** PostgREST caps response sizes, so administrative reports must page rather
 * than silently report only the first 1,000 records. */
export async function getAllRows<T>(table: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; ) {
    const { data, error, count } = await getSupabase().from(table).select('*', { count: 'exact' }).order('id').range(offset, offset + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data as T[]);
    offset += data.length;
    if (count !== null && offset >= count) break;
  }
  return rows;
}
