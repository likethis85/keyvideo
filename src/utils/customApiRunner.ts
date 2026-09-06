export interface CustomApiConfig {
  enabled: boolean;
  endpointUrl: string;
  authHeader: string;
  requestScript: string;
  responseScript: string;
}

const STORAGE_KEY = 'KEYVIDEO_CUSTOM_API_CONFIG';

export const DEFAULT_CUSTOM_API_CONFIG: CustomApiConfig = {
  enabled: false,
  endpointUrl: 'https://api.openai.com/v1/images/generations',
  authHeader: 'Bearer YOUR_API_KEY',
  requestScript: `// 入参转换脚本：将系统参数转化为目标 API 的 JSON Payload
// params 包含: { prompt, ratio, count, model, imageUrl, customPrompt }
return {
  model: params.model || 'dall-e-3',
  prompt: params.prompt,
  n: 1,
  size: params.ratio === '16-9' ? '1792x1024' : params.ratio === '9-16' ? '1024x1792' : '1024x1024',
  response_format: 'url'
};`,
  responseScript: `// 回包解析脚本：从接口响应数据中提取生图或视频的最终 URL
// data 为目标 API 返回的 JSON 对象
if (data.data && data.data[0] && data.data[0].url) {
  return data.data[0].url;
}
if (data.url) return data.url;
if (data.image) return data.image;
throw new Error('未能从响应中解析到图片 URL');`
};

export const getCustomApiConfig = (): CustomApiConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM_API_CONFIG;
    return { ...DEFAULT_CUSTOM_API_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CUSTOM_API_CONFIG;
  }
};

export const saveCustomApiConfig = (config: CustomApiConfig): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

/**
 * Executes a custom generation call using the configured endpoint and scripts
 */
export const executeCustomApi = async (params: Record<string, unknown>): Promise<string> => {
  const config = getCustomApiConfig();
  if (!config.enabled || !config.endpointUrl.trim()) {
    throw new Error('自定义 API 尚未启用或未配置接口地址');
  }

  // 1. Build Payload via requestScript
  let requestBody: unknown;
  try {
    const requestFn = new Function('params', config.requestScript);
    requestBody = requestFn(params);
  } catch (err) {
    throw new Error(`请求脚本解析失败: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Perform HTTP Fetch
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (config.authHeader.trim()) {
    headers['Authorization'] = config.authHeader.trim();
  }

  const response = await fetch(config.endpointUrl.trim(), {
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
    const responseFn = new Function('data', config.responseScript);
    const resultUrl = responseFn(responseData) as string;
    if (typeof resultUrl !== 'string' || !resultUrl) {
      throw new Error('解析脚本未返回有效的 URL 字符串');
    }
    return resultUrl;
  } catch (err) {
    throw new Error(`响应解析失败: ${err instanceof Error ? err.message : String(err)}`);
  }
};
