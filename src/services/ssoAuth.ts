import { getBackendUrl } from '../utils/aiGateway';
import { SSO_SESSION_STORAGE_KEY } from '../utils/apiAuth';

export interface AppUser {
  id: string;
  email: string | null;
  displayName: string | null;
  provider: string;
  avatarUrl?: string | null;
}

export interface StoredSsoSession {
  token: string;
  user: AppUser;
  expiresAt: number;
}

export interface SsoStatus {
  configured: boolean;
  reachable: boolean;
}

const ssoEndpoint = (path: string) => `${getBackendUrl().replace(/\/+$/, '')}/api/auth/sso${path}`;

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const body = await response.json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const requestWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 12_000): Promise<Response> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
};

const isAppUser = (value: unknown): value is AppUser => {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === 'string' && user.id.length > 0;
};

export function saveSsoSession(session: StoredSsoSession): void {
  try {
    localStorage.setItem(SSO_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('Unable to persist SSO session:', error);
  }
}

export function loadSsoSession(): StoredSsoSession | null {
  try {
    const raw = localStorage.getItem(SSO_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSsoSession>;
    if (!parsed || typeof parsed.token !== 'string' || !isAppUser(parsed.user)) {
      localStorage.removeItem(SSO_SESSION_STORAGE_KEY);
      return null;
    }
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now() + 5_000) {
      localStorage.removeItem(SSO_SESSION_STORAGE_KEY);
      return null;
    }
    return { token: parsed.token, user: parsed.user, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export function clearSsoSession(): void {
  try {
    localStorage.removeItem(SSO_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the in-memory user is cleared by the caller.
  }
}

export async function getSsoStatus(): Promise<SsoStatus> {
  try {
    const response = await requestWithTimeout(ssoEndpoint('/status'), {
      headers: { Accept: 'application/json' }
    }, 5_000);
    if (!response.ok) return { configured: false, reachable: false };
    const body = await readJson(response);
    return { configured: body.configured === true, reachable: true };
  } catch {
    return { configured: false, reachable: false };
  }
}

export function startSsoLogin(): void {
  const url = new URL(ssoEndpoint('/start'));
  url.searchParams.set('return_to', window.location.href);
  window.location.assign(url.toString());
}

export async function exchangeSsoTicket(ticket: string): Promise<StoredSsoSession> {
  const response = await requestWithTimeout(ssoEndpoint('/exchange'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ticket })
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(
      typeof body.error_description === 'string'
        ? body.error_description
        : '统一登录票据验证失败，请重新登录'
    );
  }
  if (typeof body.token !== 'string' || !isAppUser(body.user) || typeof body.expires_at !== 'number') {
    throw new Error('统一登录返回的数据不完整，请重试');
  }

  const session: StoredSsoSession = {
    token: body.token,
    user: body.user,
    expiresAt: body.expires_at
  };
  saveSsoSession(session);
  return session;
}

// React StrictMode mounts effects twice in development. Both runs would otherwise
// POST the same one-time ticket; the first consumes it and the second reports an
// invalid ticket. Reuse one in-flight/settled exchange per ticket instead.
const ticketExchanges = new Map<string, Promise<StoredSsoSession>>();

export function exchangeSsoTicketOnce(ticket: string): Promise<StoredSsoSession> {
  const existing = ticketExchanges.get(ticket);
  if (existing) return existing;

  const promise = exchangeSsoTicket(ticket);
  ticketExchanges.set(ticket, promise);
  const forget = () => {
    if (ticketExchanges.get(ticket) === promise) ticketExchanges.delete(ticket);
  };
  window.setTimeout(forget, 60_000);
  return promise;
}

/**
 * Verify the local SSO session with the backend. A local session is never trusted
 * without server verification: a forged localStorage entry must not unlock the UI.
 */
export async function refreshSsoUser(session: StoredSsoSession): Promise<AppUser | null> {
  try {
    const response = await requestWithTimeout(ssoEndpoint('/session'), {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${session.token}`
      }
    }, 5_000);
    if (response.status === 401) {
      clearSsoSession();
      return null;
    }
    if (!response.ok) {
      return null;
    }
    const body = await readJson(response);
    if (!isAppUser(body.user)) {
      clearSsoSession();
      return null;
    }
    const nextSession: StoredSsoSession = {
      ...session,
      user: body.user,
      expiresAt: typeof body.expires_at === 'number' ? body.expires_at : session.expiresAt
    };
    saveSsoSession(nextSession);
    return body.user;
  } catch {
    return null;
  }
}

export async function logoutSso(): Promise<void> {
  const session = loadSsoSession();
  clearSsoSession();
  try {
    await requestWithTimeout(ssoEndpoint('/logout'), {
      method: 'POST',
      headers: session ? { Authorization: `Bearer ${session.token}` } : {}
    }, 3_000);
  } catch {
    // The local session is already gone; a failed server notification is harmless.
  }
}

export function readSsoTicket(): string | null {
  return new URLSearchParams(window.location.search).get('sso_ticket');
}

export function readSsoError(): string | null {
  return new URLSearchParams(window.location.search).get('sso_error');
}

export function clearSsoParams(): void {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ['sso_ticket', 'sso_error']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

export function describeSsoError(code: string): string {
  switch (code) {
    case 'access_denied':
      return '你在统一登录页取消了登录';
    case 'invalid_state':
      return '登录请求已过期，请重新发起统一登录';
    case 'missing_code':
      return '统一登录没有返回授权码，请重试';
    case 'not_configured':
      return '服务端尚未配置统一登录，请联系管理员';
    case 'invalid_client':
      return '统一登录应用凭证无效，请联系管理员检查配置';
    case 'token_failed':
      return '统一登录授权码交换失败，请重试';
    case 'invalid_user':
      return '统一登录没有返回有效的用户信息';
    case 'sso_unavailable':
      return '暂时无法连接统一登录服务，请稍后重试';
    case 'sso_failed':
      return '统一登录失败，请重试';
    default:
      return '统一登录失败，请重试';
  }
}
