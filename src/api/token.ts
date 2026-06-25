/**
 * Auth token holder — a dependency-free module so both the API client and the
 * auth store can read/write the JWT without a circular import. Backed by
 * localStorage so it survives reloads.
 */
const KEY = 'pg_token'

let _token: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null

export function getToken(): string | null {
  return _token
}

export function setToken(token: string): void {
  _token = token
  try { localStorage.setItem(KEY, token) } catch { /* ignore */ }
}

export function clearToken(): void {
  _token = null
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
