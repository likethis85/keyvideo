import crypto from 'node:crypto';
import { readSsoConfig, verifySessionToken } from './sso.js';

const SUPABASE_CACHE_MS = 60 * 1000;
const SUPABASE_TIMEOUT_MS = 8_000;

const tokenCache = new Map();

const tokenCacheKey = (token) => crypto.createHash('sha256').update(token).digest('hex');

const getCached = (key, now) => {
  const entry = tokenCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    tokenCache.delete(key);
    return null;
  }
  return entry.user;
};

const setCached = (key, user, now) => {
  if (tokenCache.size > 1000) {
    for (const [cacheKey, entry] of tokenCache) {
      if (entry.expiresAt <= now()) tokenCache.delete(cacheKey);
    }
  }
  tokenCache.set(key, { user, expiresAt: now() + SUPABASE_CACHE_MS });
};

const verifySupabaseToken = async (token, { supabaseUrl, supabaseAnonKey, fetchImpl, now }) => {
  if (!supabaseUrl || !supabaseAnonKey || typeof fetchImpl !== 'function') return null;
  const key = `supabase:${tokenCacheKey(token)}`;
  const cached = getCached(key, now);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  timeout.unref?.();
  try {
    const response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`
      },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const user = await response.json();
    if (!user || typeof user.id !== 'string') return null;
    const authUser = {
      id: user.id,
      email: typeof user.email === 'string' ? user.email : null,
      provider: 'supabase'
    };
    setCached(key, authUser, now);
    return authUser;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export function createApiAuthMiddleware({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now
} = {}) {
  const ssoConfig = readSsoConfig(env);
  const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseAnonKey = String(env.SUPABASE_ANON_KEY || '').trim();
  const disabledInNonProduction = env.API_AUTH_DISABLED === 'true' && env.NODE_ENV !== 'production';

  return async function apiAuth(req, res, next) {
    if (req.method === 'OPTIONS') return next();

    // Public media proxy: <img> tags cannot send an Authorization header. This route
    // is already restricted to the Sandbase media host by the route itself.
    if (req.method === 'GET' && req.path === '/ai/image-proxy') return next();

    if (disabledInNonProduction) {
      req.authUser = { id: 'local-dev', email: null, provider: 'dev' };
      return next();
    }

    if (!ssoConfig.configured && !supabaseUrl && !supabaseAnonKey) {
      return res.status(503).json({
        error: 'auth_not_configured',
        error_description: '服务端尚未配置 SSO 或 Supabase 鉴权'
      });
    }

    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) {
      res.set('WWW-Authenticate', 'Bearer');
      return res.status(401).json({
        error: 'unauthorized',
        error_description: '请先登录后再调用该接口'
      });
    }

    if (ssoConfig.configured) {
      const claims = verifySessionToken(token, { secret: ssoConfig.sessionSecret, now });
      if (claims) {
        req.authUser = {
          id: claims.sub,
          email: claims.email ?? null,
          provider: claims.provider ?? 'sso'
        };
        return next();
      }
    }

    const supabaseUser = await verifySupabaseToken(token, {
      supabaseUrl,
      supabaseAnonKey,
      fetchImpl,
      now
    });
    if (supabaseUser) {
      req.authUser = supabaseUser;
      return next();
    }

    res.set('WWW-Authenticate', 'Bearer');
    return res.status(401).json({
      error: 'unauthorized',
      error_description: '登录状态无效或已过期，请重新登录'
    });
  };
}
