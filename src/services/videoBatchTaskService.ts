import { getBackendUrl } from '../utils/aiGateway';
import { getApiAuthHeaders } from '../utils/apiAuth';
import { buildBatchRequestKey } from '../utils/batchRequestKey';

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
export async function submitBatchVideoTasks(params: {
  projectId: string;
  shots: BatchVideoShotItem[];
  model?: string;
  seconds?: number;
  retryToken?: string;
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
