import crypto from 'node:crypto';

const DEFAULT_TIMEOUT_MS = 30_000;

const hashPayload = (payload) => crypto
  .createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex');

/**
 * Upstream idempotency key for a paid Sandbase submission.
 *
 * Scoped by the authenticated user and our own request key so two users can
 * never collide on the same upstream key, while retries of the exact same paid
 * request reuse it.
 */
export const buildUpstreamIdempotencyKey = ({ userId, requestKey, payload }) => {
  if (!userId || !requestKey) return '';
  return crypto
    .createHash('sha256')
    .update(`sandbase:${userId}:${requestKey}:${hashPayload(payload)}`)
    .digest('hex');
};

const fetchWithTimeout = async (fetchImpl, url, options, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`External request timed out after ${Math.round(timeoutMs / 1000)}s`, { cause: error });
      timeoutError.retryable = true;
      throw timeoutError;
    }
    if (error && typeof error === 'object') error.retryable = true;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Submits a task to Sandbase.
 *
 * Only responses that prove the task was NOT accepted (429/408) are retried.
 * Network errors, timeouts, 5xx and malformed success bodies are ambiguous: the
 * provider may already have created a paid task, so we fail fast and expose the
 * stable upstream idempotency key for an explicit retry instead of silently
 * creating duplicates.
 */
export const submitSandbaseTask = async (payload, {
  apiKey = process.env.SANDBASE_API_KEY,
  userId = '',
  requestKey = '',
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  maxAttempts = 4,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  baseUrl = 'https://api.sandbase.ai',
  logger = console
} = {}) => {
  const upstreamKey = buildUpstreamIdempotencyKey({ userId, requestKey, payload });
  const maxRetries = Math.max(1, Number(maxAttempts) || 1);
  let delay = 1500;

  logger.log(`[Sandbase API] Submitting model "${payload.model}"`);

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    let response;
    try {
      response = await fetchWithTimeout(fetchImpl, `${baseUrl}/v1/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(upstreamKey ? { 'Idempotency-Key': upstreamKey } : {})
        },
        body: JSON.stringify(payload)
      }, timeoutMs);
    } catch (error) {
      // The request may have reached the provider; never retry automatically.
      error.retryable = true;
      error.upstreamIdempotencyKey = upstreamKey || undefined;
      throw error;
    }

    if (!response.ok) {
      const errText = await response.text();
      const status = response.status;
      const retryable = status === 429 || status === 408;
      if (retryable && attempt < maxRetries) {
        logger.warn(`[Sandbase API] Submission rejected with ${status}; retrying in ${delay}ms (${attempt}/${maxRetries})`);
        await sleep(delay);
        delay *= 2;
        continue;
      }
      const error = new Error(`Sandbase submission failed (${status}): ${errText}`);
      error.status = status;
      error.retryable = retryable;
      error.upstreamIdempotencyKey = upstreamKey || undefined;
      throw error;
    }

    let data;
    try {
      data = await response.json();
    } catch (cause) {
      const error = new Error('Sandbase submission returned an unreadable response', { cause });
      error.retryable = true;
      error.upstreamIdempotencyKey = upstreamKey || undefined;
      throw error;
    }
    if (!data?.id) {
      const error = new Error('Sandbase submission did not return a task ID');
      error.retryable = true;
      error.upstreamIdempotencyKey = upstreamKey || undefined;
      throw error;
    }
    logger.log(`[Sandbase API] Task submitted with status "${data.status || 'unknown'}"`);
    return data.id;
  }

  throw new Error('Sandbase submission failed after retries');
};
