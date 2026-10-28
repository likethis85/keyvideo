import { getBackendUrl } from '../utils/aiGateway';
import { getApiAuthHeaders } from '../utils/apiAuth';

export interface BatchVideoShotItem {
  id: string;
  name: string;
  prompt: string;
  imageSrc: string;
  seconds?: number;
}

export interface BatchVideoTaskResult {
  shotId: string;
  shotIndex: number;
  shotName: string;
  taskId: string | null;
  status: 'processing' | 'completed' | 'failed';
  duration?: number;
  error?: string;
  resultUrl?: string;
}

export interface ProjectVideoTaskRecord {
  taskId: string;
  type: 'video';
  model: string;
  duration: number;
  projectId: string;
  shotId?: string;
  shotIndex?: number;
  shotName?: string;
  prompt?: string;
  imageSrc?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  error?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Submit all 5 storyboard shots in a single parallel batch request to backend
 */
const buildBatchRequestKey = (params: {
  projectId: string;
  shots: BatchVideoShotItem[];
  model?: string;
  seconds?: number;
}): string => {
  const signature = JSON.stringify({
    projectId: params.projectId,
    model: params.model,
    seconds: params.seconds,
    shots: params.shots.map(shot => ({ id: shot.id, prompt: shot.prompt, seconds: shot.seconds }))
  });
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `batch:${params.projectId}:${(hash >>> 0).toString(16)}`;
};

export async function submitBatchVideoTasks(params: {
  projectId: string;
  shots: BatchVideoShotItem[];
  model?: string;
  seconds?: number;
}): Promise<BatchVideoTaskResult[]> {
  const backendUrl = getBackendUrl();
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch(`${backendUrl}/api/video/task/batch`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': buildBatchRequestKey(params)
    },
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Batch video task submission failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.tasks || [];
}

/**
 * Fetch all registered video tasks for a specific project
 */
export async function fetchProjectVideoTasks(projectId: string): Promise<ProjectVideoTaskRecord[]> {
  if (!projectId) return [];
  const backendUrl = getBackendUrl();
  try {
    const authHeaders = await getApiAuthHeaders();
    const response = await fetch(`${backendUrl}/api/video/tasks/project/${encodeURIComponent(projectId)}`, {
      headers: authHeaders
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.tasks || [];
  } catch (err) {
    console.warn('Failed to fetch project video tasks:', err);
    return [];
  }
}
