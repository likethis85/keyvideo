import { generateTryOnImage } from '../utils/aiGateway';
import { buildTryOnPrompt } from './tryOnPromptBuilder';

interface TryOnGenerationRequest {
  clothingUrl: string | string[];
  clothingBottomUrl?: string;
  modelUrl: string;
  gender: 'female' | 'male';
  region: 'east-asian' | 'western';
  ratio: '1-1' | '3-4' | '9-16' | '16-9';
  prompt: string;
  poseImageUrl?: string;
  projectId?: string;
  gatewayUrl: string;
  gatewayToken: string;
}

export async function generateTryOnResult({
  clothingUrl,
  clothingBottomUrl,
  modelUrl,
  gender,
  region,
  ratio,
  prompt,
  poseImageUrl,
  projectId,
  gatewayUrl,
  gatewayToken
}: TryOnGenerationRequest): Promise<string> {
  if (!gatewayUrl.trim() || !gatewayToken.trim()) {
    await new Promise(resolve => window.setTimeout(resolve, 1000));
    return modelUrl;
  }

  return generateTryOnImage({
    clothingUrl,
    clothingBottomUrl,
    modelUrl,
    gender,
    region,
    scene: 'studio',
    ratio,
    gatewayUrl,
    gatewayToken,
    customPrompt: prompt,
    poseImageUrl,
    projectId
  });
}

export async function preloadGeneratedImages(urls: string[]): Promise<void> {
  await Promise.all(urls.filter(Boolean).map(url => new Promise<void>(resolve => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  })));
}

interface ReferenceTryOnRequest {
  referenceUrl: string;
  referenceIndex: number;
  topClothingUrl: string;
  bottomClothingUrl: string;
  modelUrl: string;
  matchingItem: string;
  shoes: string;
  accessories: string;
  editPrompt: string;
  poseImageUrl: string | null;
  usePoseCameraFraming: boolean;
  gender: 'female' | 'male';
  region: 'east-asian' | 'western';
  ratio: '1-1' | '3-4' | '9-16' | '16-9';
  gatewayUrl: string;
  gatewayToken: string;
  projectId: string;
}

type ReferenceTryOnBaseRequest = Omit<ReferenceTryOnRequest, 'referenceUrl' | 'referenceIndex' | 'modelUrl'>;

export async function generateReferenceTryOnResult({
  referenceUrl,
  referenceIndex,
  topClothingUrl,
  bottomClothingUrl,
  modelUrl,
  matchingItem,
  shoes,
  accessories,
  editPrompt,
  poseImageUrl,
  usePoseCameraFraming,
  gender,
  region,
  ratio,
  gatewayUrl,
  gatewayToken,
  projectId
}: ReferenceTryOnRequest): Promise<string> {
  const includeFlatlays = referenceIndex === 0 && !!(topClothingUrl || bottomClothingUrl);
  const clothingUrls = includeFlatlays
    ? [referenceUrl, topClothingUrl, bottomClothingUrl].filter(Boolean)
    : [referenceUrl];
  const modelIndex = 1 + clothingUrls.length;
  const prompt = buildTryOnPrompt({
    modelIndex,
    poseIndex: modelIndex + 1,
    clothingRef: clothingUrls.length > 1 ? '图1 and 图2' : '图1',
    matchingItem,
    shoes,
    accessories,
    editPrompt,
    poseImageUrl,
    usePoseCameraFraming,
    includeFlatlayDetails: includeFlatlays
  });

  return generateTryOnResult({
    clothingUrl: clothingUrls,
    modelUrl,
    gender,
    region,
    ratio,
    gatewayUrl,
    gatewayToken,
    prompt,
    poseImageUrl: poseImageUrl || undefined,
    projectId
  });
}

interface ReferenceTryOnBatchRequest extends ReferenceTryOnBaseRequest {
  referenceUrls: string[];
  modelUrl: string;
  existingUrls: string[];
  primaryExistingUrl: string | null;
  editTargetIndex: number;
  onProgress?: (urls: string[], completedIndex: number) => void;
  onItemError?: (error: unknown, index: number, total: number) => void;
}

export async function generateReferenceTryOnBatch({
  referenceUrls,
  modelUrl,
  existingUrls,
  primaryExistingUrl,
  editTargetIndex,
  onProgress,
  onItemError,
  ...request
}: ReferenceTryOnBatchRequest): Promise<string[]> {
  if (editTargetIndex >= 0) {
    const currentModelUrl = existingUrls[editTargetIndex] || primaryExistingUrl || modelUrl;
    const generatedUrl = await generateReferenceTryOnResult({
      ...request,
      referenceUrl: referenceUrls[editTargetIndex],
      referenceIndex: editTargetIndex,
      modelUrl: currentModelUrl
    });
    const updated = [...existingUrls];
    updated[editTargetIndex] = generatedUrl;
    onProgress?.([...updated], editTargetIndex);
    return updated;
  }

  const generatedUrls: string[] = [];
  for (let index = 0; index < referenceUrls.length; index++) {
    try {
      const generatedUrl = await generateReferenceTryOnResult({
        ...request,
        referenceUrl: referenceUrls[index],
        referenceIndex: index,
        modelUrl
      });
      if (generatedUrl) {
        generatedUrls.push(generatedUrl);
        onProgress?.([...generatedUrls], index);
      }
    } catch (error) {
      onItemError?.(error, index, referenceUrls.length);
    }
  }
  return generatedUrls;
}

interface FlatlayTryOnRequest extends Omit<TryOnGenerationRequest, 'clothingUrl' | 'clothingBottomUrl' | 'prompt' | 'poseImageUrl'> {
  mainClothingUrl: string;
  bottomClothingUrl?: string;
  matchingItem: string;
  shoes: string;
  accessories: string;
  editPrompt: string;
  poseImageUrl: string | null;
  usePoseCameraFraming: boolean;
}

export async function generateFlatlayTryOnResult({
  mainClothingUrl,
  bottomClothingUrl,
  matchingItem,
  shoes,
  accessories,
  editPrompt,
  poseImageUrl,
  usePoseCameraFraming,
  ...request
}: FlatlayTryOnRequest): Promise<string> {
  const modelIndex = 2 + (bottomClothingUrl ? 1 : 0);
  const prompt = buildTryOnPrompt({
    modelIndex,
    poseIndex: modelIndex + 1,
    clothingRef: bottomClothingUrl ? '图1 and 图2' : '图1',
    matchingItem,
    shoes,
    accessories,
    editPrompt,
    poseImageUrl,
    usePoseCameraFraming
  });

  return generateTryOnResult({
    ...request,
    clothingUrl: mainClothingUrl,
    clothingBottomUrl: bottomClothingUrl,
    prompt,
    poseImageUrl: poseImageUrl || undefined
  });
}

export interface TryOnPlanRequest extends ReferenceTryOnBaseRequest {
  referenceUrls: string[];
  fallbackClothingUrl: string;
  modelUrl: string;
  existingUrls: string[];
  primaryExistingUrl: string | null;
  editTargetIndex: number;
  onProgress?: (urls: string[], completedIndex: number) => void;
  onItemError?: (error: unknown, index: number, total: number) => void;
}

export async function generateTryOnPlan({
  referenceUrls,
  fallbackClothingUrl,
  modelUrl,
  existingUrls,
  primaryExistingUrl,
  editTargetIndex,
  onProgress,
  onItemError,
  ...request
}: TryOnPlanRequest): Promise<string[]> {
  if (referenceUrls.length > 0) {
    return generateReferenceTryOnBatch({
      ...request,
      referenceUrls,
      modelUrl,
      existingUrls,
      primaryExistingUrl,
      editTargetIndex,
      onProgress,
      onItemError
    });
  }

  const mainClothingUrl = request.topClothingUrl || request.bottomClothingUrl || fallbackClothingUrl;
  if (!mainClothingUrl) {
    throw new Error('请先上传「服装白底图」或「穿搭参考图」，或在时间轴中选中一个衣服图层！');
  }
  const baseModelUrl = editTargetIndex >= 0
    ? existingUrls[editTargetIndex] || primaryExistingUrl || modelUrl
    : modelUrl;
  const generatedUrl = await generateFlatlayTryOnResult({
    ...request,
    mainClothingUrl,
    bottomClothingUrl: request.topClothingUrl ? request.bottomClothingUrl || undefined : undefined,
    modelUrl: baseModelUrl
  });
  const results = editTargetIndex >= 0 ? [...existingUrls] : [];
  if (editTargetIndex >= 0) results[editTargetIndex] = generatedUrl;
  else results.push(generatedUrl);
  onProgress?.([...results], editTargetIndex >= 0 ? editTargetIndex : 0);
  return results;
}
