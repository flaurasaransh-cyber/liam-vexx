import type { ChannelOption, Panel, PanelState } from '@vexx/shared'

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const KEY = 'vexx-session'

export function getToken(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const { token, expiresAt } = JSON.parse(raw) as { token: string; expiresAt: string }
    return new Date(expiresAt).getTime() > Date.now() ? token : null
  } catch {
    return null
  }
}

function setToken(value: { token: string; expiresAt: string } | null) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value))
    else localStorage.removeItem(KEY)
  } catch {
    // private mode: the session lasts until the tab closes
  }
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    })
  } catch {
    throw new ApiError('Could not reach the bot. It may be waking up; try again in a few seconds.', 0)
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/login') setToken(null)
    throw new ApiError(body.error ?? `The bot answered with an error (${res.status}).`, res.status)
  }
  return body as T
}

export const api = {
  async login(password: string) {
    const session = await call<{ token: string; expiresAt: string }>('/api/login', { method: 'POST', body: JSON.stringify({ password }) })
    setToken(session)
  },
  logout: () => setToken(null),
  state: () => call<PanelState>('/api/state'),
  savePanel: (panel: Panel) => call<PanelState>('/api/panel', { method: 'PUT', body: JSON.stringify({ panel }) }),
  uploadImage: (file: { name: string; type: string; data: string }) =>
    call<PanelState>('/api/roster-image', { method: 'POST', body: JSON.stringify(file) }),
  removeImage: () => call<PanelState>('/api/roster-image', { method: 'DELETE' }),
  channels: () => call<{ channels: ChannelOption[] }>('/api/channels'),
  uploadBanner: (file: { name: string; type: string; data: string }) =>
    call<PanelState>('/api/welcome/banners', { method: 'POST', body: JSON.stringify(file) }),
  removeBanner: (name: string) => call<PanelState>(`/api/welcome/banners/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  testWelcome: () => call<{ url: string }>('/api/welcome/test', { method: 'POST' }),
  publish: () => call<PanelState & { result: { url: string; edited: boolean } }>('/api/publish', { method: 'POST' }),
}
