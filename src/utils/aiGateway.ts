import { runPollingTask } from './aiTaskStateMachine';
import { getCustomApiConfig, executeCustomApi } from './customApiRunner';

export const getBackendUrl = (): string => {
  const localUrl = localStorage.getItem('KEYVIDEO_BACKEND_URL');
  const isWebDeployment = typeof window !== 'undefined'
    && window.location
    && (window.location.pathname.startsWith('/videos') || window.location.hostname === 'www.marius.com.cn' || window.location.hostname === 'marius.com.cn');

  if (localUrl) {
    if (isWebDeployment && (localUrl.includes('localhost') || localUrl.includes('127.0.0.1'))) {
      return `${window.location.origin}/videos`;
    }
    return localUrl.replace('http://localhost:', 'http://127.0.0.1:');
  }

  if (isWebDeployment) {
    return `${window.location.origin}/videos`;
  }

  const envUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3001';
  return envUrl.replace('http://localhost:', 'http://127.0.0.1:');
};

export const getCanvasSafeImageUrl = (imageUrl: string): string => {
  if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.startsWith('blob:') || imageUrl.startsWith('/')) {
    return imageUrl;
  }
  try {
    const parsed = new URL(imageUrl);
    if (parsed.hostname === 'media.sandbase.ai') {
      return `${getBackendUrl()}/api/ai/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    }
  } catch {
    return imageUrl;
  }
  return imageUrl;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const LONG_AI_REQUEST_TIMEOUT_MS = 180_000;
const inFlightGenerationRequests = new Map<string, Promise<unknown>>();

const wait = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

const buildRequestKey = (scope: string, payload: unknown): string => {
  const serialized = JSON.stringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${scope}:${serialized.length}:${(hash >>> 0).toString(16)}`;
};

const dedupeGenerationRequest = <T>(
  scope: string,
  payload: unknown,
  operation: (requestKey: string) => Promise<T>
): Promise<T> => {
  const key = buildRequestKey(scope, payload);
  const existing = inFlightGenerationRequests.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const request = operation(key).finally(() => {
    if (inFlightGenerationRequests.get(key) === request) {
      inFlightGenerationRequests.delete(key);
    }
  });
  inFlightGenerationRequests.set(key, request);
  return request;
};

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    return body?.error || body?.message || fallback;
  }
  const text = await response.text().catch(() => '');
  return text.trim() || fallback;
};

const fetchWithTimeout = async (
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`, { cause: error });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const requestJson = async <T>(
  url: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; retries?: number; fallbackError: string; idempotencyKey?: string }
): Promise<T> => {
  const retries = options.retries ?? 0;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const headers = new Headers(init.headers);
      if (options.idempotencyKey) headers.set('X-Idempotency-Key', options.idempotencyKey);
      const response = await fetchWithTimeout(url, { ...init, headers }, options.timeoutMs);
      if (!response.ok) {
        const message = await readErrorMessage(response, options.fallbackError);
        const error = new Error(message) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number })?.status;
      const retryable = status === undefined || status === 429 || status >= 500;
      if (attempt >= retries || !retryable) throw error;
      await wait(500 * (2 ** attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(options.fallbackError);
};

// Helper: Poll backend task status until completed
export const pollBackendTask = async (taskId: string, maxSeconds = 180): Promise<string> => {
  const result = await runPollingTask<string>({
    taskId,
    intervalMs: 2000,
    maxAttempts: Math.max(1, Math.ceil((maxSeconds * 1000) / 2000)),
    estimatedAttempts: 50,
    poll: async () => {
      const task = await getTaskStatus(taskId);
      return { status: task.status, result: task.resultUrl, error: task.error };
    }
  });
  if (!result.result) throw new Error('AI task completed without a result URL');
  return result.result;
};

export const waitForVideoTask = async (options: {
  taskId: string;
  intervalMs: number;
  maxAttempts: number;
  estimatedAttempts: number;
  recovering?: boolean;
  isCancelled?: () => boolean;
  onProgress?: (progress: number) => void;
}): Promise<void> => {
  await runPollingTask({
    taskId: options.taskId,
    intervalMs: options.intervalMs,
    maxAttempts: options.maxAttempts,
    estimatedAttempts: options.estimatedAttempts,
    initialPhase: options.recovering ? 'recovering' : 'processing',
    isCancelled: options.isCancelled,
    poll: () => pollVideoTask('', '', options.taskId),
    onTransition: snapshot => {
      if (snapshot.phase === 'processing' || snapshot.phase === 'recovering') {
        options.onProgress?.(snapshot.progress);
      }
    }
  });
};

export const generateMannequinImage = async (params: {
  imageUrl: string;
  gender: string;
  region: string;
  ratio: string;
  customPrompt?: string;
  scene?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
}): Promise<string> => {
  if (getCustomApiConfig().enabled) {
    return executeCustomApi(params);
  }
  return dedupeGenerationRequest('mannequin', params, async (requestKey) => {
    const data = await requestJson<{ url?: string; taskId?: string }>(`${getBackendUrl()}/api/ai/mannequin?async=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }, {
      fallbackError: 'Mannequin generation failed',
      idempotencyKey: requestKey
    });
    if (data.url) return data.url;
    if (data.taskId) return pollBackendTask(data.taskId);
    throw new Error('Unexpected response from mannequin generation');
  });
};

export const generateInpaintImage = async (params: {
  imageUrl: string;
  maskUrl: string;
  prompt: string;
  strength: number;
  aspectRatio?: string;
}): Promise<string> => {
  return dedupeGenerationRequest('inpaint', params, async (requestKey) => {
    const data = await requestJson<{ url?: string; taskId?: string }>(`${getBackendUrl()}/api/ai/inpaint?async=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }, {
      fallbackError: 'Google image inpainting failed',
      idempotencyKey: requestKey
    });
    if (data.url) return data.url;
    if (data.taskId) return pollBackendTask(data.taskId);
    throw new Error('Unexpected response from inpainting generation');
  });
};

export const generateUpscaleImage = async (params: {
  imageUrl: string;
  scaleFactor: '2x' | '4x';
  mode: 'fashion' | 'portrait' | 'general';
  denoise: number;
  sharpen: number;
  aspectRatio?: string;
}): Promise<string> => {
  return dedupeGenerationRequest('upscale', params, async (requestKey) => {
    const data = await requestJson<{ url?: string; taskId?: string }>(`${getBackendUrl()}/api/ai/upscale?async=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }, {
      fallbackError: 'Google image upscale failed',
      idempotencyKey: requestKey
    });
    if (data.url) return data.url;
    if (data.taskId) return pollBackendTask(data.taskId);
    throw new Error('Unexpected response from upscale generation');
  });
};

export const generateTryOnImage = async (params: {
  clothingUrl: string | string[];
  clothingBottomUrl?: string;
  modelUrl?: string | string[];
  gender: string;
  region: string;
  scene: string;
  ratio: string;
  customPrompt?: string;
  backgroundImageUrl?: string;
  poseImageUrl?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  projectId?: string;
}): Promise<string> => {
  return dedupeGenerationRequest('tryon', params, async (requestKey) => {
    const data = await requestJson<{ url?: string; taskId?: string }>(`${getBackendUrl()}/api/ai/tryon?async=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }, {
      fallbackError: 'Try-on failed',
      idempotencyKey: requestKey
    });
    if (data.url) return data.url;
    if (data.taskId) return pollBackendTask(data.taskId);
    throw new Error('Unexpected response from try-on generation');
  });
};

export const generateBackgroundImage = async (params: {
  prompt: string;
  ratio: string;
  refImageUrl?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
}): Promise<string> => {
  if (getCustomApiConfig().enabled) {
    return executeCustomApi(params);
  }
  return dedupeGenerationRequest('background', params, async (requestKey) => {
    const data = await requestJson<{ url: string }>(`${getBackendUrl()}/api/ai/background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }, {
      timeoutMs: LONG_AI_REQUEST_TIMEOUT_MS,
      fallbackError: 'Background generation failed',
      idempotencyKey: requestKey
    });
    return data.url;
  });
};

export const generateOutfitSuggestion = async (params: {
  topUrl?: string;
  bottomUrl?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
}): Promise<{
  matchingItem: string;
  shoes: string;
  accessories: string;
}> => {
  return dedupeGenerationRequest('stylist', params, (requestKey) =>
    requestJson(`${getBackendUrl()}/api/ai/stylist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }, {
      timeoutMs: LONG_AI_REQUEST_TIMEOUT_MS,
      fallbackError: 'Stylist suggestion failed',
      idempotencyKey: requestKey
    })
  );
};

export const generatePromptsFromSkill = async (params: {
  modelOutfitImgUrl: string;
  videoDuration: '3s' | '15s';
  matchingItemDesc?: string;
  shoesDesc?: string;
  accessoriesDesc?: string;
  modelScene?: string;
  customScenes?: unknown[];
  storyboardImgUrls?: string[];
  backgroundImageUrl?: string;
  model?: string;
  storyboardMode?: string;
  useSlowMotion?: boolean;
  focus?: string;
  apparelStyle?: string;
  cameraStyle?: string;
  lightingMood?: string;
  singleShotIndex?: number;
  currentPrompt?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
}): Promise<string> => {
  return dedupeGenerationRequest('prompts-skill', params, async (requestKey) => {
    const data = await requestJson<{ prompts: string; singleShotIndex?: number }>(`${getBackendUrl()}/api/ai/prompts-skill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }, {
      timeoutMs: LONG_AI_REQUEST_TIMEOUT_MS,
      fallbackError: 'Skill prompts generation failed',
      idempotencyKey: requestKey
    });
    return data.prompts;
  });
};

export const polishSingleShotPrompt = async (params: {
  modelOutfitImgUrl: string;
  singleShotIndex: number;
  currentPrompt: string;
  apparelStyle?: string;
  cameraStyle?: string;
  lightingMood?: string;
  modelScene?: string;
  focus?: string;
  useSlowMotion?: boolean;
}): Promise<string> => {
  return generatePromptsFromSkill({
    ...params,
    videoDuration: '15s',
    singleShotIndex: params.singleShotIndex,
    currentPrompt: params.currentPrompt
  });
};

export const generateVideoTask = async (params: {
  model: string;
  prompt: string;
  imageSrc: string;
  modelOutfitImgUrl?: string;
  storyboardImgUrls?: string[];
  sceneImgUrl?: string;
  seconds?: number;
  size?: string;
  aspectRatio?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  projectId?: string;
}): Promise<string> => {
  return dedupeGenerationRequest('video-task', params, async (requestKey) => {
    const data = await requestJson<{ id: string }>(`${getBackendUrl()}/api/video/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }, {
      fallbackError: 'Video task creation failed',
      idempotencyKey: requestKey
    });
    return data.id;
  });
};

export const pollVideoTask = async (
  _gatewayUrl: string,
  _gatewayToken: string,
  taskId: string
): Promise<{ status: string; error?: string; resultUrl?: string }> => {
  return requestJson(`${getBackendUrl()}/api/video/poll/${encodeURIComponent(taskId)}`, {
    method: 'GET'
  }, {
    retries: 2,
    fallbackError: 'Polling video task failed'
  });
};

export const getVideoContent = async (
  _gatewayUrl: string,
  _gatewayToken: string,
  taskId: string
): Promise<Blob> => {
  const response = await fetchWithTimeout(`${getBackendUrl()}/api/video/content/${encodeURIComponent(taskId)}`, {
    method: 'GET'
  }, LONG_AI_REQUEST_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Fetching video content failed'));
  }
  return response.blob();
};

export const getRecentTasks = async (projectId?: string): Promise<Array<{
  taskId: string;
  status: string;
  resultUrl?: string;
  type?: string;
  scene?: string;
  projectId?: string;
  createdAt?: number;
  error?: string;
}>> => {
  try {
    const url = new URL(`${getBackendUrl()}/api/ai/tasks/recent`);
    if (projectId) url.searchParams.set('projectId', projectId);
    const data = await requestJson<{ tasks?: Array<{
      taskId: string;
      status: string;
      resultUrl?: string;
      type?: string;
      scene?: string;
      projectId?: string;
      createdAt?: number;
      error?: string;
    }> }>(url.toString(), {}, { retries: 2, fallbackError: 'Failed to fetch recent tasks' });
    return data.tasks || [];
  } catch (err) {
    console.warn('Failed to fetch recent tasks:', err);
    return [];
  }
};

export const getTaskStatus = async (taskId: string): Promise<{
  taskId: string;
  status: string;
  resultUrl?: string;
  error?: string;
}> => {
  return requestJson(`${getBackendUrl()}/api/ai/task/${encodeURIComponent(taskId)}`, {}, {
    retries: 2,
    fallbackError: 'Task status fetch failed'
  });
};

