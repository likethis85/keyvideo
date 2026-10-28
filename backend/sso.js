import crypto from 'node:crypto';
import express from 'express';

// The SSO login page itself is valid for 15 minutes, so keep the state slightly
// longer than that to avoid rejecting a legitimate completed login.
const STATE_TTL_MS = 20 * 60 * 1000;
const TICKET_TTL_MS = 60 * 1000;
const MAX_PENDING_ENTRIES = 5000;
const SESSION_ISSUER = 'keyvideo-backend';
const SESSION_AUDIENCE = 'keyvideo';
const DEFAULT_ALLOWED_RETURN_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://www.marius.com.cn',
  'https://marius.com.cn',
  'http://tauri.localhost',
  'tauri://localhost'
];

const nowSeconds = (now) => Math.floor(now() / 1000);

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const signPart = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

const originOf = (url) => (
  url.protocol === 'tauri:' ? `tauri://${url.host}` : url.origin
);

const parseUrl = (value) => {
  if (typeof value !== 'string' || !value || value.length > 4096) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const normalizeBaseUrl = (value) => {
  const parsed = parseUrl(value);
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) return '';
  return parsed.toString().replace(/\/+$/, '');
};

const withQuery = (target, params) => {
  const url = new URL(target);
  url.hash = '';
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  return url.toString();
};

const safeMessage = (value, fallback) => {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return value.trim().slice(0, 200);
};

export function readSsoConfig(env = process.env) {
  const baseUrl = normalizeBaseUrl(env.SSO_BASE_URL || 'https://sso.marius.com.cn');
  const clientId = String(env.SSO_CLIENT_ID || '').trim();
  const clientSecret = String(env.SSO_CLIENT_SECRET || '').trim();
  const redirectUri = String(env.SSO_REDIRECT_URI || '').trim();
  const postLoginCandidate = String(env.SSO_POST_LOGIN_REDIRECT || 'http://localhost:5173/').trim();
  const postLoginUrl = parseUrl(postLoginCandidate);
  const postLoginRedirect = postLoginUrl && ['http:', 'https:', 'tauri:'].includes(postLoginUrl.protocol)
    ? postLoginUrl.toString()
    : 'http://localhost:5173/';

  const configuredOrigins = String(env.SSO_ALLOWED_RETURN_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedReturnOrigins = [...new Set([
    ...DEFAULT_ALLOWED_RETURN_ORIGINS,
    ...configuredOrigins
  ])];

  const sessionSecret = String(env.SSO_SESSION_SECRET || '').trim()
    || (clientId && clientSecret
      ? crypto.createHash('sha256').update(`keyvideo-sso-session:${clientId}:${clientSecret}`).digest('hex')
      : '');
  const sessionTtlSeconds = Math.min(
    30 * 24 * 60 * 60,
    Math.max(300, Number(env.SSO_SESSION_TTL_SECONDS) || 8 * 60 * 60)
  );

  return {
    baseUrl,
    clientId,
    clientSecret,
    redirectUri,
    postLoginRedirect,
    allowedReturnOrigins,
    sessionSecret,
    sessionTtlSeconds,
    configured: Boolean(baseUrl && clientId && clientSecret && redirectUri && sessionSecret)
  };
}

export function signSessionToken(user, { secret, ttlSeconds = 8 * 60 * 60, now = Date.now } = {}) {
  if (!secret) throw new Error('A session signing secret is required');
  const issuedAt = nowSeconds(now);
  const payload = {
    iss: SESSION_ISSUER,
    aud: SESSION_AUDIENCE,
    sub: user.id,
    email: user.email ?? null,
    name: user.displayName ?? null,
    provider: user.provider ?? 'sso',
    jti: crypto.randomUUID(),
    iat: issuedAt,
    nbf: issuedAt,
    exp: issuedAt + ttlSeconds
  };
  const header = signPart({ alg: 'HS256', typ: 'JWT' });
  const body = signPart(payload);
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return {
    token: `${header}.${body}.${signature}`,
    expiresAt: payload.exp * 1000,
    user: {
      id: user.id,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      provider: user.provider ?? 'sso',
      avatarUrl: user.avatarUrl ?? null
    }
  };
}

export function verifySessionToken(token, { secret, now = Date.now } = {}) {
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (!safeEqual(signature, expected)) return null;

  let headerValue;
  let payload;
  try {
    headerValue = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (headerValue?.alg !== 'HS256') return null;
  if (payload?.iss !== SESSION_ISSUER || payload?.aud !== SESSION_AUDIENCE) return null;
  const current = nowSeconds(now);
  if (!Number.isFinite(payload.exp) || payload.exp <= current) return null;
  if (Number.isFinite(payload.nbf) && payload.nbf > current + 30) return null;
  return payload;
}

const sessionUserFromClaims = (claims) => ({
  id: claims.sub,
  email: claims.email ?? null,
  displayName: claims.name ?? null,
  provider: claims.provider ?? 'sso',
  avatarUrl: null
});

function createExpiringStore(ttlMs, now) {
  const entries = new Map();

  const cleanup = () => {
    const current = now();
    for (const [key, value] of entries) {
      if (value.expiresAt <= current) entries.delete(key);
    }
    while (entries.size > MAX_PENDING_ENTRIES) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) break;
      entries.delete(oldestKey);
    }
  };

  return {
    put(value) {
      cleanup();
      const key = crypto.randomBytes(24).toString('base64url');
      entries.set(key, { ...value, expiresAt: now() + ttlMs });
      return key;
    },
    consume(key) {
      if (typeof key !== 'string' || !key) return null;
      const value = entries.get(key);
      entries.delete(key);
      if (!value || value.expiresAt <= now()) return null;
      return value;
    }
  };
}

const isAllowedReturnUrl = (url, allowedOrigins) => {
  if (!url) return false;
  if (!['http:', 'https:', 'tauri:'].includes(url.protocol)) return false;
  const origin = originOf(url);
  if (allowedOrigins.includes(origin)) return true;
  // Local development uses arbitrary loopback ports.
  return (url.protocol === 'http:' || url.protocol === 'https:')
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
};

function resolveReturnTo(value, config) {
  const parsed = parseUrl(value);
  if (parsed && isAllowedReturnUrl(parsed, config.allowedReturnOrigins)) {
    parsed.hash = '';
    return parsed.toString();
  }
  return config.postLoginRedirect;
}

const redirectWithError = (res, target, code) => {
  const url = withQuery(target, { sso_error: code });
  return res.redirect(303, url);
};

const htmlError = (message) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>统一登录不可用</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0d14;color:#e5e7eb;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}div{max-width:520px;padding:32px;border:1px solid #2a2f45;border-radius:12px;background:#151827}p{color:#9ca3af;line-height:1.7}</style>
</head><body><div><h2>统一登录暂不可用</h2><p>${message}</p></div></body></html>`;

export function createSsoRouter({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now
} = {}) {
  const config = readSsoConfig(env);
  const stateStore = createExpiringStore(STATE_TTL_MS, now);
  const ticketStore = createExpiringStore(TICKET_TTL_MS, now);
  const router = express.Router();

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  router.get('/status', (_req, res) => {
    res.json({
      configured: config.configured,
      provider: 'marius-sso',
      baseUrl: config.configured ? config.baseUrl : null
    });
  });

  router.get('/start', (req, res) => {
    const returnTo = resolveReturnTo(req.query.return_to, config);
    if (!config.configured) {
      return res.status(503).type('html').send(htmlError('服务端还没有配置 SSO_CLIENT_ID / SSO_CLIENT_SECRET，请联系管理员。'));
    }
    if (typeof fetchImpl !== 'function') {
      return res.status(500).type('html').send(htmlError('服务端缺少网络请求能力。'));
    }

    const state = stateStore.put({ returnTo });
    const authorize = new URL(`${config.baseUrl}/authorize`);
    authorize.searchParams.set('client_id', config.clientId);
    authorize.searchParams.set('redirect_uri', config.redirectUri);
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('response_mode', 'code');
    return res.redirect(302, authorize.toString());
  });

  router.get('/callback', async (req, res) => {
    const pending = stateStore.consume(typeof req.query.state === 'string' ? req.query.state : '');
    const returnTo = pending?.returnTo || config.postLoginRedirect;

    if (!pending) return redirectWithError(res, returnTo, 'invalid_state');
    if (req.query.error) {
      const code = safeMessage(req.query.error, 'access_denied');
      return redirectWithError(res, returnTo, code === 'access_denied' ? 'access_denied' : 'sso_failed');
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) return redirectWithError(res, returnTo, 'missing_code');
    if (!config.configured) return redirectWithError(res, returnTo, 'not_configured');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    timeout.unref?.();
    let response;
    let body = {};
    try {
      response = await fetchImpl(`${config.baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret
        }),
        signal: controller.signal
      });
      const raw = await response.text();
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = {};
      }
    } catch (error) {
      console.warn('[sso] token exchange failed:', error instanceof Error ? error.message : error);
      return redirectWithError(res, returnTo, 'sso_unavailable');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.warn(`[sso] token endpoint returned HTTP ${response.status}: ${safeMessage(body.error_description, body.error || 'unknown')}`);
      return redirectWithError(res, returnTo, response.status === 401 ? 'invalid_client' : 'token_failed');
    }

    const sourceUser = body?.user;
    if (!sourceUser || typeof sourceUser.id !== 'string' || !sourceUser.id) {
      console.warn('[sso] token response did not include a user id');
      return redirectWithError(res, returnTo, 'invalid_user');
    }

    const user = {
      id: sourceUser.id,
      email: typeof sourceUser.email === 'string' ? sourceUser.email : null,
      displayName: typeof sourceUser.display_name === 'string'
        ? sourceUser.display_name
        : (typeof sourceUser.name === 'string' ? sourceUser.name : null),
      provider: typeof sourceUser.provider === 'string' ? sourceUser.provider : 'sso',
      avatarUrl: typeof sourceUser.avatar_url === 'string' ? sourceUser.avatar_url : null
    };
    const ticket = ticketStore.put({ user });
    return res.redirect(303, withQuery(returnTo, { sso_ticket: ticket }));
  });

  router.post('/exchange', (req, res) => {
    if (!config.configured) {
      return res.status(503).json({ error: 'not_configured', error_description: '统一登录尚未配置' });
    }
    const pending = ticketStore.consume(req.body?.ticket);
    if (!pending) {
      return res.status(400).json({ error: 'invalid_ticket', error_description: '登录票据无效或已过期，请重新登录' });
    }

    const session = signSessionToken(pending.user, {
      secret: config.sessionSecret,
      ttlSeconds: config.sessionTtlSeconds,
      now
    });
    return res.json({
      token: session.token,
      token_type: 'Bearer',
      expires_at: session.expiresAt,
      user: session.user
    });
  });

  router.get('/session', (req, res) => {
    if (!config.configured) {
      return res.status(503).json({ error: 'not_configured', error_description: '统一登录尚未配置' });
    }
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const claims = verifySessionToken(token, { secret: config.sessionSecret, now });
    if (!claims) {
      return res.status(401).json({ error: 'invalid_token', error_description: '登录状态已失效，请重新登录' });
    }
    return res.json({ user: sessionUserFromClaims(claims), expires_at: claims.exp * 1000 });
  });

  router.post('/logout', (_req, res) => {
    res.status(204).end();
  });

  router.use((error, _req, res, _next) => {
    console.error('[sso] unexpected route error:', error instanceof Error ? error.message : error);
    if (res.headersSent) return;
    res.status(500).json({ error: 'server_error', error_description: '统一登录服务暂时不可用' });
  });

  return router;
}
