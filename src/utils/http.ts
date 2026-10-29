export interface FetchWithTimeoutOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Fetch with a bounded wait. Used by callers that previously issued bare
 * fetches and could leave the UI stuck in "submitting" forever when the
 * network or server never answered.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  { timeoutMs = 30_000, fetchImpl = globalThis.fetch }: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function readBodyWithTimeout<T = unknown>(
  response: Response,
  { timeoutMs = 30_000, format = 'json' as 'json' | 'text' | 'arrayBuffer' } = {}
): Promise<T> {
  let timer;
  try {
    return await Promise.race([
      (format === 'json' ? response.json() : format === 'text' ? response.text() : response.arrayBuffer()) as Promise<T>,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Response body timed out after ${Math.round(timeoutMs / 1000)}s`)),
          Math.max(1, timeoutMs)
        );
      })
    ]);
  } catch (error) {
    try {
      await response.body?.cancel();
    } catch {
      // Body may already be consumed.
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function readResponseText(response: Response, fallback = ''): Promise<string> {
  try {
    return await response.text();
  } catch {
    return fallback;
  }
}
