export const getBackendUrl = (): string => {
  const localUrl = localStorage.getItem('KEYVIDEO_BACKEND_URL');
  if (localUrl) return localUrl;
  return import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
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
  const response = await fetch(`${getBackendUrl()}/api/ai/mannequin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Mannequin generation failed');
  }
  const data = await response.json();
  return data.url;
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
}): Promise<string> => {
  const response = await fetch(`${getBackendUrl()}/api/ai/tryon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Try-on failed');
  }
  const data = await response.json();
  return data.url;
};

export const generateBackgroundImage = async (params: {
  prompt: string;
  ratio: string;
  refImageUrl?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
}): Promise<string> => {
  const response = await fetch(`${getBackendUrl()}/api/ai/background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Background generation failed');
  }
  const data = await response.json();
  return data.url;
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
  const response = await fetch(`${getBackendUrl()}/api/ai/stylist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Stylist suggestion failed');
  }
  return response.json();
};

export const generatePromptsFromSkill = async (params: {
  modelOutfitImgUrl: string;
  videoDuration: '3s' | '15s';
  matchingItemDesc?: string;
  shoesDesc?: string;
  accessoriesDesc?: string;
  modelScene?: string;
  customScenes?: any[];
  storyboardImgUrls?: string[];
  backgroundImageUrl?: string;
  model?: string;
  storyboardMode?: string;
  useSlowMotion?: boolean;
  focus?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
}): Promise<string> => {
  const response = await fetch(`${getBackendUrl()}/api/ai/prompts-skill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Skill prompts generation failed');
  }
  const data = await response.json();
  return data.prompts;
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
}): Promise<string> => {
  const response = await fetch(`${getBackendUrl()}/api/video/task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Video task creation failed');
  }
  const data = await response.json();
  return data.id;
};

export const pollVideoTask = async (
  _gatewayUrl: string,
  _gatewayToken: string,
  taskId: string
): Promise<{ status: string; error?: string }> => {
  const response = await fetch(`${getBackendUrl()}/api/video/poll/${taskId}`, {
    method: 'GET'
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Polling video task failed');
  }
  return response.json();
};

export const getVideoContent = async (
  _gatewayUrl: string,
  _gatewayToken: string,
  taskId: string
): Promise<Blob> => {
  const response = await fetch(`${getBackendUrl()}/api/video/content/${taskId}`, {
    method: 'GET'
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Fetching video content failed');
  }
  return response.blob();
};
