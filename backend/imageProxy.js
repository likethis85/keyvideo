import { assertSafeRemoteUrl } from './remoteUrl.js';

export const IMAGE_PROXY_ALLOWED_HOST = 'media.sandbase.ai';
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_REDIRECTS = 3;

const errorWithStatus = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const abortError = () => {
  const error = new Error('Image proxy request timed out');
  error.name = 'AbortError';
  return error;
};

const fetchWithAbort = (fetchImpl, url, options, signal) => {
  if (signal.aborted) return Promise.reject(abortError());
  let rejectOnAbort;
  const abortPromise = new Promise((_resolve, reject) => {
    rejectOnAbort = reject;
  });
  const onAbort = () => rejectOnAbort(abortError());
  signal.addEventListener('abort', onAbort, { once: true });
  return Promise.race([fetchImpl(url, options), abortPromise])
    .finally(() => signal.removeEventListener('abort', onAbort));
};

const readBodyWithLimit = async (response, maxBytes, signal) => {
  if (!response.body) {
    const buffer = Buffer.from(await Promise.race([
      response.arrayBuffer(),
      new Promise((_resolve, reject) => {
        if (signal.aborted) reject(abortError());
        else signal.addEventListener('abort', () => reject(abortError()), { once: true });
      })
    ]));
    if (buffer.length > maxBytes) throw errorWithStatus('Image exceeds the size limit', 413);
    return buffer;
  }

  const reader = response.body.getReader();
  let aborted = false;
  let rejectOnAbort;
  const abortPromise = new Promise((_resolve, reject) => {
    rejectOnAbort = reject;
  });
  const onAbort = () => {
    aborted = true;
    reader.cancel().catch(() => {});
    rejectOnAbort(abortError());
  };
  if (signal.aborted) onAbort();
  else signal.addEventListener('abort', onAbort, { once: true });

  try {
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), abortPromise]);
      if (aborted) throw abortError();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        reader.cancel().catch(() => {});
        throw errorWithStatus('Image exceeds the size limit', 413);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
};

const createRateLimiter = ({ limit, now, capacity = 5000 }) => {
  const buckets = new Map();
  return (key) => {
    const timestamp = now();
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetAt <= timestamp
      ? { count: 0, resetAt: timestamp + 60_000 }
      : existing;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > capacity) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= timestamp) buckets.delete(bucketKey);
      }
      for (const bucketKey of buckets.keys()) {
        if (buckets.size <= capacity) break;
        buckets.delete(bucketKey);
      }
    }
    return bucket.count <= limit;
  };
};

/**
 * Public image proxy for Sandbase-generated images.
 *
 * `<img>` tags cannot attach an Authorization header, so this route is
 * anonymous. It therefore limits the allowed origin, validates every redirect
 * hop against the SSRF guard, streams the body with a hard byte limit, applies a
 * total request timeout and rate-limits by client IP.
 */
export const createImageProxyHandler = ({
  fetchImpl = globalThis.fetch,
  validateUrl = assertSafeRemoteUrl,
  maxBytes = DEFAULT_MAX_BYTES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  rateLimitPerMinute = 300,
  now = Date.now
} = {}) => {
  const byteLimit = Math.max(1, Number(maxBytes) || DEFAULT_MAX_BYTES);
  const isAllowed = createRateLimiter({
    limit: Math.max(1, Number(rateLimitPerMinute) || 300),
    now
  });

  return async function imageProxyHandler(req, res) {
    const clientKey = req.ip || req.socket?.remoteAddress || 'unknown';
    if (!isAllowed(clientKey)) {
      res.set('Retry-After', '60');
      return res.status(429).json({ error: 'rate_limited' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
    timeout.unref?.();

    try {
      let current;
      try {
        current = new URL(String(req.query.url || ''));
      } catch {
        throw errorWithStatus('Invalid image URL', 400);
      }

      let response = null;
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        if (current.protocol !== 'https:' || current.hostname !== IMAGE_PROXY_ALLOWED_HOST) {
          throw errorWithStatus('Only Sandbase generated-image URLs can be proxied', 400);
        }
        await validateUrl(current);
        response = await fetchWithAbort(fetchImpl, current.toString(), {
          redirect: 'manual',
          signal: controller.signal
        }, controller.signal);
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location');
        if (!location) break;
        current = new URL(location, current);
        if (redirects === MAX_REDIRECTS) {
          throw errorWithStatus('Too many image proxy redirects', 502);
        }
      }

      if (!response) throw errorWithStatus('Image provider did not respond', 502);
      if (!response.ok) {
        throw errorWithStatus(`Image provider returned ${response.status}`, 502);
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        throw errorWithStatus('Upstream response is not an image', 502);
      }
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > byteLimit) {
        throw errorWithStatus('Image exceeds the size limit', 413);
      }

      const buffer = await readBodyWithLimit(response, byteLimit, controller.signal);
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'private, max-age=3600');
      return res.send(buffer);
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        return res.status(504).json({ error: 'Image proxy request timed out' });
      }
      const status = error?.statusCode || 400;
      return res.status(status).json({ error: error?.message || 'Invalid image URL' });
    } finally {
      clearTimeout(timeout);
    }
  };
};
