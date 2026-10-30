import type { AIProject } from '../types/aiProject';
import { getBackendUrl } from '../utils/aiGateway';
import { getApiAuthHeaders, getSsoAccessToken } from '../utils/apiAuth';

export type SsoCloudAsset = {
  id: string;
  name: string;
  src: string;
  desc?: string | null;
  created_at?: string;
  is_public?: boolean;
};

const isSsoConfigured = () => Boolean(getSsoAccessToken());

async function cloudRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const auth = await getApiAuthHeaders();
  if (auth.Authorization) headers.set('Authorization', auth.Authorization);
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${getBackendUrl()}/api/cloud${path}`, { ...init, headers });
  let payload: unknown = null;
  try { payload = await response.json(); } catch { /* empty response */ }
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error?: unknown }).error)
      : `云端请求失败（${response.status}）`;
    throw new Error(message);
  }
  return payload as T;
}

export function isSsoCloudSession(): boolean {
  return isSsoConfigured();
}

export async function loadSsoProjects(): Promise<Record<string, unknown>[] | null> {
  if (!isSsoConfigured()) return null;
  const result = await cloudRequest<{ projects?: Record<string, unknown>[] }>('/projects');
  return Array.isArray(result.projects) ? result.projects : [];
}

export async function syncProjectToSsoCloud(project: AIProject, urls: {
  topUrl: string;
  bottomUrl: string;
  referenceUrls: string[];
  outfitUrls: string[];
  storyboards: unknown[];
}): Promise<boolean> {
  if (!isSsoConfigured()) return false;
  await cloudRequest(`/projects/${encodeURIComponent(project.id)}`, {
    method: 'PUT',
    body: JSON.stringify({
      id: project.id,
      name: project.name,
      top_clothing_url: urls.topUrl || null,
      bottom_clothing_url: urls.bottomUrl || null,
      reference_outfit_url: urls.referenceUrls.length ? JSON.stringify(urls.referenceUrls) : null,
      model_outfit_img_url: urls.outfitUrls.length ? JSON.stringify(urls.outfitUrls) : null,
      model_gender: project.modelGender || 'female',
      model_region: project.modelRegion || 'east-asian',
      model_scene: project.modelScene || 'street',
      i2v_master_prompt_15s: project.i2vMasterPrompt15s || null,
      i2v_prompts: project.i2vPrompts || {},
      storyboards: urls.storyboards,
      i2v_step: project.i2vStep || 'idle',
      status: project.isI2vGenerating ? 'generating_video' : project.isStoryboardGenerating ? 'generating_storyboard' : project.isOutfitImgGenerating ? 'generating_outfit' : project.i2vStep || 'idle',
      video_duration: project.videoDuration || '15s'
    })
  });
  return true;
}

export async function deleteSsoProject(projectId: string): Promise<boolean> {
  if (!isSsoConfigured()) return false;
  await cloudRequest(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
  return true;
}

export async function loadSsoAssets(type: 'model' | 'audio'): Promise<SsoCloudAsset[] | null> {
  if (!isSsoConfigured()) return null;
  const result = await cloudRequest<{ assets?: SsoCloudAsset[] }>(`/assets/${type}`);
  return Array.isArray(result.assets) ? result.assets : [];
}

export async function createSsoAsset(type: 'model' | 'audio', payload: Record<string, unknown>): Promise<SsoCloudAsset | null> {
  if (!isSsoConfigured()) return null;
  const result = await cloudRequest<{ asset?: SsoCloudAsset }>(`/assets/${type}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return result.asset || null;
}

export async function updateSsoAsset(type: 'model' | 'audio', id: string, payload: Record<string, unknown>): Promise<SsoCloudAsset | null> {
  if (!isSsoConfigured()) return null;
  const result = await cloudRequest<{ asset?: SsoCloudAsset }>(`/assets/${type}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
  return result.asset || null;
}

export async function deleteSsoAsset(type: 'model' | 'audio', id: string): Promise<boolean> {
  if (!isSsoConfigured()) return false;
  await cloudRequest(`/assets/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}
