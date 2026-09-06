import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { generateTryOnPlan, preloadGeneratedImages } from '../services/tryOnGenerationService';
import type { TryOnPlanRequest } from '../services/tryOnGenerationService';
import type { AIProject } from '../types/aiProject';

interface PreviewModel {
  id?: string;
  src: string;
  name: string;
  storyboardId?: string;
}

interface TryOnGenerationOptions {
  activeProjectId: string;
  setProjectGenerating: (projectId: string, generating: boolean) => void;
  persistResults: (urls: string[]) => void;
  setPreviewModel: Dispatch<SetStateAction<PreviewModel | null>>;
  activeProjectIdRef: MutableRefObject<string>;
  setOutfitUrls: Dispatch<SetStateAction<string[]>>;
  setPrimaryOutfitUrl: Dispatch<SetStateAction<string | null>>;
  setProjects: Dispatch<SetStateAction<AIProject[]>>;
  planDefaults: Omit<TryOnPlanRequest, 'fallbackClothingUrl' | 'editTargetIndex' | 'projectId'>;
  fallbackClothingUrl: string;
  previewSource: string | null;
  onConfigurationRequired: () => void;
}

interface ExecuteTryOnOptions {
  editTargetIndex: number;
  generate: () => Promise<string[]>;
}

export function useTryOnGeneration({
  activeProjectId,
  setProjectGenerating,
  persistResults,
  setPreviewModel,
  activeProjectIdRef,
  setOutfitUrls,
  setPrimaryOutfitUrl,
  setProjects,
  planDefaults,
  fallbackClothingUrl,
  previewSource,
  onConfigurationRequired
}: TryOnGenerationOptions) {
  const planDefaultsRef = useRef(planDefaults);
  const selectionRef = useRef({ fallbackClothingUrl, previewSource, onConfigurationRequired });

  useEffect(() => {
    planDefaultsRef.current = planDefaults;
  }, [planDefaults]);

  useEffect(() => {
    selectionRef.current = { fallbackClothingUrl, previewSource, onConfigurationRequired };
  }, [fallbackClothingUrl, onConfigurationRequired, previewSource]);
  const executeTryOn = useCallback(async ({
    editTargetIndex,
    generate
  }: ExecuteTryOnOptions): Promise<string[]> => {
    if (!activeProjectId) return [];
    setProjectGenerating(activeProjectId, true);

    try {
      const generatedUrls = await generate();
      if (generatedUrls.length > 0) await preloadGeneratedImages(generatedUrls);
      persistResults(generatedUrls);

      const displayIndex = editTargetIndex >= 0 ? editTargetIndex : 0;
      setPreviewModel(previous => previous && previous.storyboardId === undefined
        ? { ...previous, src: generatedUrls[displayIndex] || '' }
        : previous);
      return generatedUrls;
    } finally {
      setProjectGenerating(activeProjectId, false);
    }
  }, [activeProjectId, persistResults, setPreviewModel, setProjectGenerating]);

  const executeTryOnPlan = useCallback((request: TryOnPlanRequest) => executeTryOn({
    editTargetIndex: request.editTargetIndex,
    generate: () => generateTryOnPlan({
      ...request,
      onProgress: (urls, completedIndex) => {
        if (activeProjectIdRef.current === request.projectId) {
          setOutfitUrls(urls);
          setPrimaryOutfitUrl(urls[0] || null);
        }
        setProjects(previous => previous.map(project => project.id === request.projectId ? {
          ...project,
          modelOutfitImgUrls: urls,
          modelOutfitImgUrl: urls[0] || project.modelOutfitImgUrl
        } : project));
        request.onProgress?.(urls, completedIndex);
      },
      onItemError: (error, index, total) => {
        console.warn(`[Multi Outfit Gen] Outfit ${index + 1}/${total} request timed out on client, backend will auto-recover it:`, error);
        request.onItemError?.(error, index, total);
      }
    })
  }), [activeProjectIdRef, executeTryOn, setOutfitUrls, setPrimaryOutfitUrl, setProjects]);

  const generateOutfits = useCallback(({
    fallbackClothingUrl,
    editTargetIndex
  }: {
    fallbackClothingUrl: string;
    editTargetIndex: number;
  }) => executeTryOnPlan({
    ...planDefaultsRef.current,
    fallbackClothingUrl,
    editTargetIndex,
    projectId: activeProjectId
  }), [activeProjectId, executeTryOnPlan]);

  const generateOutfitsFromSelection = useCallback(async ({
    fallbackClothingUrl,
    previewSource
  }: {
    fallbackClothingUrl: string;
    previewSource: string | null;
  }) => {
    const defaults = planDefaultsRef.current;
    const hasClothingInput = defaults.referenceUrls.length > 0
      || !!defaults.topClothingUrl
      || !!defaults.bottomClothingUrl
      || !!fallbackClothingUrl;
    if (!hasClothingInput) {
      throw new Error('请先上传「服装白底图」或「穿搭参考图」，或在时间轴中选中一个衣服图层！');
    }
    if (!defaults.gatewayUrl.trim() || !defaults.gatewayToken.trim()) {
      throw new Error('请确保在底部的「AI 网关配置」中输入了正确的网关地址与 Token！');
    }

    let editTargetIndex = previewSource ? defaults.existingUrls.indexOf(previewSource) : -1;
    if (editTargetIndex === -1 && previewSource && previewSource === defaults.primaryExistingUrl) {
      editTargetIndex = 0;
    }
    const urls = await generateOutfits({ fallbackClothingUrl, editTargetIndex });
    return { urls, isEditMode: previewSource !== null, editTargetIndex };
  }, [generateOutfits]);

  const generateConfiguredOutfits = useCallback(async () => {
    const selection = selectionRef.current;
    try {
      const result = await generateOutfitsFromSelection({
        fallbackClothingUrl: selection.fallbackClothingUrl,
        previewSource: selection.previewSource
      });
      window.setTimeout(() => {
        alert(result.isEditMode ? '修改生成成功！' : `模特服装穿搭参考图生成成功！已为您渲染生成 ${result.urls.length} 套对应效果图。`);
      }, 50);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('AI 网关配置')) selection.onConfigurationRequired();
      alert(`穿搭图生成失败: ${message}`);
    }
  }, [generateOutfitsFromSelection]);

  return { executeTryOn, executeTryOnPlan, generateOutfits, generateOutfitsFromSelection, generateConfiguredOutfits };
}
