'use client';

/** Remove legacy script-readable tokens left by earlier versions. */
export function clearClientSession(): void {
  if (typeof window === 'undefined') return;
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try { const store = window[name]; store.removeItem('mtc_session_token'); store.removeItem('mtc_session_user'); } catch { /* Storage can be unavailable. */ }
  }
  try { if (window.name.startsWith('__MTC_AUTH__:')) window.name = ''; } catch { /* Ignore. */ }
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  const res = await fetch(path, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
  let data: unknown = {};
  try { data = await res.json(); } catch { /* Non-JSON response. */ }
  return { ok: res.ok, status: res.status, data: data as T };
}
