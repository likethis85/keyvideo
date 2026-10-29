export const SSO_SESSION_STORAGE_KEY = 'KEYVIDEO_SSO_SESSION_V1';

const fnv1a = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

/**
 * Builds a request-dedup key scoped by operation, payload and the current
 * identity. Including identity prevents a request started by account A from
 * being replayed by account B during a fast account switch.
 */
export function buildRequestKey(scope: string, payload: unknown, identity = ''): string {
  const serialized = JSON.stringify(payload);
  return `${scope}:${identity}:${serialized.length}:${fnv1a(`${identity}:${serialized}`)}`;
}

/**
 * Synchronous, best-effort identity fingerprint. Tokens are hashed so they are
 * never retained as map keys. Falls back to "anon" when no session is present.
 */
export function getSyncAuthFingerprint(): string {
  if (typeof localStorage === 'undefined') return 'anon';
  try {
    const rawSso = localStorage.getItem(SSO_SESSION_STORAGE_KEY);
    if (rawSso) {
      const parsed = JSON.parse(rawSso) as { token?: unknown; expiresAt?: unknown };
      if (typeof parsed.token === 'string' && parsed.token
        && !(typeof parsed.expiresAt === 'number' && parsed.expiresAt <= Date.now())) {
        return `sso:${fnv1a(parsed.token)}`;
      }
    }
  } catch {
    // Fall through to Supabase detection.
  }

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { access_token?: unknown; session?: { access_token?: unknown } };
      const token = typeof parsed.access_token === 'string'
        ? parsed.access_token
        : (typeof parsed.session?.access_token === 'string' ? parsed.session.access_token : '');
      if (token) return `sb:${fnv1a(token)}`;
    }
  } catch {
    // Ignore malformed local sessions.
  }

  return 'anon';
}
