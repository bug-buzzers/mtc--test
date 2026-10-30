'use client';

import { AuthTokenPayload } from './types';

const TOKEN_STORAGE_KEY = 'mtc_session_token';
const USER_STORAGE_KEY = 'mtc_session_user';
const WINDOW_NAME_PREFIX = '__MTC_AUTH__:';

let memoryToken: string | null = null;
let memoryUser: AuthTokenPayload | null = null;

function readWindowNameStore(): {
  token?: string;
  user?: AuthTokenPayload;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.name && window.name.startsWith(WINDOW_NAME_PREFIX)) {
      return JSON.parse(window.name.slice(WINDOW_NAME_PREFIX.length));
    }
  } catch {
    // Ignore
  }
  return null;
}

export function saveClientSession(token: string, user: AuthTokenPayload): void {
  memoryToken = token;
  memoryUser = user;
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Fallback when third-party localStorage is restricted in iframes
  }

  try {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    window.sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore
  }

  try {
    window.name = WINDOW_NAME_PREFIX + JSON.stringify({ token, user });
  } catch {
    // Ignore
  }
}

export function clearClientSession(): void {
  memoryToken = null;
  memoryUser = null;
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Ignore
  }

  try {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Ignore
  }

  try {
    if (window.name && window.name.startsWith(WINDOW_NAME_PREFIX)) {
      window.name = '';
    }
  } catch {
    // Ignore
  }
}

export function getClientToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === 'undefined') return null;

  try {
    const ls = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (ls) {
      memoryToken = ls;
      return ls;
    }
  } catch {
    // Ignore
  }

  try {
    const ss = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (ss) {
      memoryToken = ss;
      return ss;
    }
  } catch {
    // Ignore
  }

  const wn = readWindowNameStore();
  if (wn?.token) {
    memoryToken = wn.token;
    return wn.token;
  }

  return null;
}

export function getClientUser(): AuthTokenPayload | null {
  if (memoryUser) return memoryUser;
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      memoryUser = JSON.parse(raw) as AuthTokenPayload;
      return memoryUser;
    }
  } catch {
    // Ignore
  }

  try {
    const raw = window.sessionStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      memoryUser = JSON.parse(raw) as AuthTokenPayload;
      return memoryUser;
    }
  } catch {
    // Ignore
  }

  const wn = readWindowNameStore();
  if (wn?.user) {
    memoryUser = wn.user;
    return wn.user;
  }

  return null;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getClientToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  return {
    ok: res.ok,
    status: res.status,
    data: data as T,
  };
}
