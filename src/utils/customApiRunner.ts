export interface CustomApiConfig {
  enabled: boolean;
  endpointUrl: string;
  authHeader: string;
  requestScript: string;
  responseScript: string;
}

const STORAGE_KEY = 'KEYVIDEO_CUSTOM_API_CONFIG';
const AUTH_SESSION_KEY = 'KEYVIDEO_CUSTOM_API_AUTH';

export const DEFAULT_CUSTOM_API_CONFIG: CustomApiConfig = {
  enabled: false,
  endpointUrl: 'https://api.openai.com/v1/images/generations',
  authHeader: 'Bearer YOUR_API_KEY',
  requestScript: JSON.stringify({
    model: '{{model}}',
    prompt: '{{prompt}}',
    n: 1,
    size: '{{size}}',
    response_format: 'url'
  }, null, 2),
  responseScript: 'data.0.url,url,image'
};

function interpolateTemplate(value: unknown, params: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map(item => interpolateTemplate(item, params));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolateTemplate(item, params)]));
  }
  if (typeof value !== 'string') return value;
  const exact = value.match(/^\{\{([A-Za-z0-9_]+)\}\}$/);
  if (exact) return params[exact[1]] ?? '';
  return value.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, key: string) => String(params[key] ?? ''));
}

export function buildCustomApiPayload(template: string, params: Record<string, unknown>): unknown {
  const enrichedParams = {
    ...params,
    size: params.ratio === '16-9' ? '1792x1024' : params.ratio === '9-16' ? '1024x1792' : '1024x1024'
  };
  return interpolateTemplate(JSON.parse(template), enrichedParams);
}

export function extractCustomApiResult(data: unknown, pathList: string): string {
  for (const path of pathList.split(',').map(item => item.trim()).filter(Boolean)) {
    let current: unknown = data;
    for (const segment of path.split('.')) {
      if (current === null || typeof current !== 'object') {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (typeof current === 'string' && current.trim()) return current;
  }
  throw new Error('未能按配置的响应路径解析到有效 URL');
}

export const getCustomApiConfig = (): CustomApiConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM_API_CONFIG;
    const parsed = JSON.parse(raw) as Partial<CustomApiConfig>;
    if (parsed.authHeader) {
      sessionStorage.setItem(AUTH_SESSION_KEY, parsed.authHeader);
      delete parsed.authHeader;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    try {
      JSON.parse(parsed.requestScript || DEFAULT_CUSTOM_API_CONFIG.requestScript);
    } catch {
      parsed.requestScript = DEFAULT_CUSTOM_API_CONFIG.requestScript;
    }
    if (!parsed.responseScript || !/^[A-Za-z0-9_.,\s-]+$/.test(parsed.responseScript)) {
      parsed.responseScript = DEFAULT_CUSTOM_API_CONFIG.responseScript;
    }
    return { ...DEFAULT_CUSTOM_API_CONFIG, ...parsed, authHeader: sessionStorage.getItem(AUTH_SESSION_KEY) || '' };
  } catch {
    return DEFAULT_CUSTOM_API_CONFIG;
  }
};

export const saveCustomApiConfig = (config: CustomApiConfig): void => {
  const { authHeader, ...persistedConfig } = config;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedConfig));
  if (authHeader) sessionStorage.setItem(AUTH_SESSION_KEY, authHeader);
  else sessionStorage.removeItem(AUTH_SESSION_KEY);
};

/**
 * Executes a custom generation call using the configured endpoint and scripts
 */
export const executeCustomApi = async (params: Record<string, unknown>): Promise<string> => {
  const config = getCustomApiConfig();
  if (!config.enabled || !config.endpointUrl.trim()) {
    throw new Error('自定义 API 尚未启用或未配置接口地址');
  }
  const endpoint = new URL(config.endpointUrl.trim());
  if (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') {
    throw new Error('自定义 API 地址仅支持 HTTP 或 HTTPS');
  }

  // 1. Build Payload via requestScript
  let requestBody: unknown;
  try {
    requestBody = buildCustomApiPayload(config.requestScript, params);
  } catch (err) {
    throw new Error(`请求脚本解析失败: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }

  // 2. Perform HTTP Fetch
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (config.authHeader.trim()) {
    headers['Authorization'] = config.authHeader.trim();
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`自定义 API 请求错误 (${response.status}): ${errorText}`);
  }

  const responseData = await response.json() as unknown;

  // 3. Extract Result URL via responseScript
  try {
    return extractCustomApiResult(responseData, config.responseScript);
  } catch (err) {
    throw new Error(`响应解析失败: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
};
