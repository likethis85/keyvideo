import { fetchImageAsBase64, getGatewayRequestConfig } from './helpers';

export interface VideoTaskParams {
  model: string;
  prompt: string;
  imageSrc: string;
  modelOutfitImgUrl?: string;
  storyboardImgUrls?: string[];
  sceneImgUrl?: string;
  seconds?: number;
  size?: string;
  aspectRatio?: string;
  gatewayUrl: string;
  gatewayToken: string;
}

export const generateVideoTask = async (params: VideoTaskParams): Promise<string> => {
  const { model, prompt, imageSrc, modelOutfitImgUrl, storyboardImgUrls, sceneImgUrl, seconds = 4, size = '720p', aspectRatio, gatewayUrl, gatewayToken } = params;

  if (!gatewayUrl) {
    throw new Error('AI Gateway URL is required. Please check your settings.');
  }
  if (!gatewayToken) {
    throw new Error('AI Gateway API Token is required. Please check your settings.');
  }

  // 1. Fetch image as base64
  let base64Image: string;
  try {
    base64Image = await fetchImageAsBase64(imageSrc);
  } catch (error: any) {
    throw new Error(`无法加载分镜参考图: ${error.message}`);
  }

  let sceneImageBase64: string | null = null;
  if (sceneImgUrl) {
    try {
      sceneImageBase64 = await fetchImageAsBase64(sceneImgUrl);
    } catch (err) {
      console.warn(`Failed to fetch scene reference image: ${sceneImgUrl}`, err);
    }
  }

  // 2. Build API Request Body according to Image-to-Video docs
  const requestBody: any = {
    model,
    prompt,
    seconds,
    size
  };

  if (model === 'kling-v3-omni') {
    let outfitImageBase64 = base64Image;
    if (modelOutfitImgUrl) {
      try {
        outfitImageBase64 = await fetchImageAsBase64(modelOutfitImgUrl);
      } catch (err) {
        console.warn('Failed to fetch modelOutfitImgUrl, using imageSrc as fallback', err);
      }
    }

    if (seconds === 15 && storyboardImgUrls && storyboardImgUrls.length > 0) {
      // 15s mode: 1 outfit image + 5 storyboard images
      const base64Storyboards = await Promise.all(
        storyboardImgUrls.map(async (url) => {
          try {
            return await fetchImageAsBase64(url);
          } catch (err) {
            console.warn(`Failed to fetch storyboard image: ${url}`, err);
            return null;
          }
        })
      );
      const validStoryboards = base64Storyboards.filter((b): b is string => b !== null);
      const references = [
        { image: outfitImageBase64 },
        ...validStoryboards.map(b64 => ({ image: b64 }))
      ];
      if (sceneImageBase64) {
        references.push({ image: sceneImageBase64 });
      }
      requestBody.eca_image_reference = references;
    } else {
      // 4s mode: 1 outfit image + 1 storyboard image
      const references = [
        { image: outfitImageBase64 },
        { image: base64Image }
      ];
      if (sceneImageBase64) {
        references.push({ image: sceneImageBase64 });
      }
      requestBody.eca_image_reference = references;
    }

    requestBody.eca_mode = 'std';
    requestBody.eca_audio = false;
    if (aspectRatio) {
      requestBody.eca_aspect_ratio = aspectRatio === '3:4' ? '9:16' : aspectRatio;
    }
  } else {
    if (model.includes('veo') || model.includes('MiniMax') || model.includes('pro')) {
      requestBody.eca_first_frame = base64Image;
    } else {
      const inputReference: any = {
        image: [base64Image]
      };
      if (model.includes('vidu')) {
        inputReference.type = 'eca_first_frame';
      }
      requestBody.input_reference = [inputReference];
    }

    if (aspectRatio) {
      requestBody.eca_aspect_ratio = aspectRatio;
    }
  }

  // Get request URL and headers
  const { requestUrl, headers } = getGatewayRequestConfig({
    path: '/videos',
    gatewayUrl,
    gatewayToken
  });

  console.log('[generateVideoTask] Requesting video generation...');
  console.log(`[generateVideoTask] URL: ${requestUrl}`);

  // Truncate base64 strings in logs to avoid freezing the browser console
  const loggedBody = { ...requestBody };
  if (loggedBody.eca_image_reference) {
    loggedBody.eca_image_reference = loggedBody.eca_image_reference.map((ref: any) => ({
      ...ref,
      image: ref.image ? `[Base64 Image, length: ${ref.image.length}]` : undefined
    }));
  }
  if (loggedBody.eca_first_frame) {
    loggedBody.eca_first_frame = `[Base64 Image, length: ${loggedBody.eca_first_frame.length}]`;
  }
  if (loggedBody.input_reference) {
    loggedBody.input_reference = loggedBody.input_reference.map((ref: any) => ({
      ...ref,
      image: ref.image ? ref.image.map((img: string) => `[Base64 Image, length: ${img.length}]`) : undefined
    }));
  }
  console.log('[generateVideoTask] Request Payload:', JSON.stringify(loggedBody, null, 2));

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[generateVideoTask] Error Status: ${response.status}, Error text:`, errorText);
    let errorDetail = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetail = errorJson.error?.message || errorText;
    } catch {
      // Not a JSON response
    }
    throw new Error(`视频生成请求失败 (${response.status}): ${errorDetail}`);
  }

  const responseData = await response.json();
  console.log('[generateVideoTask] Response JSON:', JSON.stringify(responseData, null, 2));
  if (!responseData.id) {
    throw new Error('视频任务创建成功，但未能返回任务 ID');
  }

  return responseData.id;
};

export const pollVideoTask = async (
  gatewayUrl: string,
  gatewayToken: string,
  taskId: string
): Promise<{ status: string; error?: string }> => {
  // Get request URL and headers
  const { requestUrl, headers } = getGatewayRequestConfig({
    path: `/videos/${taskId}`,
    gatewayUrl,
    gatewayToken,
    contentType: null // GET request, so no Content-Type header
  });

  console.log(`[pollVideoTask] Polling status for taskId: ${taskId} | URL: ${requestUrl}`);

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[pollVideoTask] Error Status: ${response.status}, Error text:`, errorText);
    let errorDetail = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetail = errorJson.error?.message || errorText;
    } catch {
      // Not JSON
    }
    throw new Error(`查询视频状态失败 (${response.status}): ${errorDetail}`);
  }

  const responseData = await response.json();
  console.log(`[pollVideoTask] Response for ${taskId}:`, JSON.stringify(responseData, null, 2));
  return {
    status: responseData.status,
    error: responseData.error?.message
  };
};

export const getVideoContent = async (
  gatewayUrl: string,
  gatewayToken: string,
  taskId: string
): Promise<Blob> => {
  // Get request URL and headers
  const { requestUrl, headers } = getGatewayRequestConfig({
    path: `/videos/${taskId}/content`,
    gatewayUrl,
    gatewayToken,
    contentType: null // GET request
  });

  console.log(`[getVideoContent] Fetching video content blob for taskId: ${taskId} | URL: ${requestUrl}`);

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[getVideoContent] Error Status: ${response.status}, Error text:`, errorText);
    let errorDetail = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetail = errorJson.error?.message || errorText;
    } catch {
      // Not JSON
    }
    throw new Error(`拉取视频内容失败 (${response.status}): ${errorDetail}`);
  }

  const blob = await response.blob();
  console.log(`[getVideoContent] Success. Retrieved Blob size: ${blob.size} bytes`);
  return blob;
};
