import { API_BASE, TOKEN_KEY } from './config';

export { API_BASE };

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function rejectUnauthorized(path: string, status: number) {
  if (status !== 401 || path.startsWith('/school/auth/login')) return;
  setAuthToken(null);
  unauthorizedHandler?.();
}

export function getStoredToken(): string | null {
  if (typeof localStorage === 'undefined') return authToken;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const extraHeaders = (options.headers || {}) as Record<string, string>;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: authHeaders(extraHeaders),
  });
  return res;
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = { ...(options.headers as Record<string, string> | undefined) };
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await apiFetch(path, { ...options, headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    rejectUnauthorized(path, res.status);
    throw new Error(data.message || data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function apiDownload(path: string, filename: string) {
  const res = await apiFetch(path);
  if (!res.ok) {
    rejectUnauthorized(path, res.status);
    throw new Error('Download failed');
  }
  const blob = await res.blob();
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const href = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(href);
}
