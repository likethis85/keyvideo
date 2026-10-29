import crypto from 'node:crypto';

export const IDEMPOTENT_GENERATION_PATHS = [
  '/api/ai/mannequin',
  '/api/ai/inpaint',
  '/api/ai/upscale',
  '/api/ai/tryon',
  '/api/ai/background',
  '/api/ai/stylist',
  '/api/ai/prompts-skill',
  '/api/video/task',
  '/api/video/task/batch'
];

export const DEFAULT_IDEMPOTENCY_TTL_MS = 30_000;
export const DEFAULT_IDEMPOTENCY_MAX_ENTRIES = 1000;

const canonicalize = (value, depth = 0) => {
  if (depth > 20) return '"[max-depth]"';
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => canonicalize(item, depth + 1)).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map(key => `${JSON.stringify(key)}:${canonicalize(value[key], depth + 1)}`)
      .join(',')}}`;
  }
  return 'null';
};

export const fingerprintRequestBody = (body) => crypto
  .createHash('sha256')
  .update(canonicalize(body ?? {}))
  .digest('hex');

const purgeExpired = (store, now) => {
  for (const [key, value] of store) {
    if (value.expiresAt <= now) store.delete(key);
  }
};

/**
 * Idempotent generation cache.
 *
 * Must be mounted after authentication so the cache cannot be reached without a
 * verified identity. Keys include the authenticated user, HTTP method, route,
 * client-supplied key and a canonical body hash, so neither anonymous callers
 * nor another account (nor the same account with a different payload) can
 * replay another request's cached paid generation.
 */
export const createIdempotencyMiddleware = ({
  ttlMs = DEFAULT_IDEMPOTENCY_TTL_MS,
  maxEntries = DEFAULT_IDEMPOTENCY_MAX_ENTRIES,
  now = Date.now
} = {}) => {
  const store = new Map();
  const ttl = Math.max(1, Number(ttlMs) || DEFAULT_IDEMPOTENCY_TTL_MS);
  const capacity = Math.max(1, Number(maxEntries) || DEFAULT_IDEMPOTENCY_MAX_ENTRIES);

  const middleware = async (req, res, next) => {
    const userId = req.authUser?.id;
    if (!userId) return next();

    const requestKey = String(req.get('X-Idempotency-Key') || '').trim();
    if (!requestKey || requestKey.length > 200) return next();

    const timestamp = now();
    const bodyHash = fingerprintRequestBody(req.body);
    const scopedKey = [
      encodeURIComponent(userId),
      req.method,
      req.path,
      requestKey,
      bodyHash
    ].join('|');

    const existing = store.get(scopedKey);
    if (existing && existing.expiresAt > timestamp) {
      try {
        const replay = existing.response || await existing.promise;
        res.set('X-Idempotency-Replayed', 'true');
        return res.status(replay.status).json(replay.body);
      } catch (error) {
        store.delete(scopedKey);
        return next(error);
      }
    }
    if (existing) store.delete(scopedKey);

    let settleRequest;
    const promise = new Promise(resolve => { settleRequest = resolve; });
    const record = { promise, response: null, expiresAt: timestamp + ttl };
    store.set(scopedKey, record);

    // Enforce a hard cap: Map preserves insertion order, so the oldest entries
    // are evicted first even when they have not expired yet.
    if (store.size > capacity) {
      purgeExpired(store, timestamp);
      for (const key of store.keys()) {
        if (store.size <= capacity) break;
        if (key !== scopedKey) store.delete(key);
      }
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const response = { status: res.statusCode, body };
      record.response = response;
      settleRequest(response);
      if (res.statusCode >= 500) store.delete(scopedKey);
      return originalJson(body);
    };

    res.once('close', () => {
      if (!record.response) {
        const response = { status: 503, body: { error: 'Original idempotent request disconnected' } };
        settleRequest(response);
        store.delete(scopedKey);
      }
    });

    return next();
  };

  middleware.store = store;
  middleware.capacity = capacity;
  return middleware;
};
