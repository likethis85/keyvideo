const DEFAULT_TIMEOUT_MS = 10_000;

export function getSupabaseAdminConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url, key } : null;
}

export async function supabaseAdminRequest(path, {
  env = process.env,
  method = 'GET',
  body,
  headers: extraHeaders = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch
} = {}) {
  const config = getSupabaseAdminConfig(env);
  if (!config) {
    const error = new Error('Supabase server storage is not configured');
    error.code = 'SUPABASE_SERVER_NOT_CONFIGURED';
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const headers = {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Accept: 'application/json',
      ...extraHeaders
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetchImpl(`${config.url}/rest/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = { message: text }; }
    }
    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error_description || `Supabase request failed: ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export function isSupabaseAdminConfigured(env = process.env) {
  return Boolean(getSupabaseAdminConfig(env));
}
