import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AIProject, StoryboardItem } from '../types/aiProject';
import type { AiWizardStep } from './useAiWizardNavigation';
import { DEFAULT_I2V_PROMPTS } from '../utils/aiProjectFactory';

interface ProjectEditorSetters {
  setActiveProjectId: (id: string) => void;
  setTopClothingUrl: Dispatch<SetStateAction<string>>;
  setBottomClothingUrl: Dispatch<SetStateAction<string>>;
  setReferenceOutfitUrl: Dispatch<SetStateAction<string>>;
  setReferenceOutfitUrls: Dispatch<SetStateAction<string[]>>;
  setModelOutfitImgUrl: Dispatch<SetStateAction<string | null>>;
  setModelOutfitImgUrls: Dispatch<SetStateAction<string[]>>;
  setModelGender: Dispatch<SetStateAction<'female' | 'male'>>;
  setModelRegion: Dispatch<SetStateAction<'east-asian' | 'western'>>;
  setModelScene: Dispatch<SetStateAction<string>>;
  setI2vMasterPrompt15s: Dispatch<SetStateAction<string>>;
  setI2vPrompts: Dispatch<SetStateAction<AIProject['i2vPrompts']>>;
  setSwapModelUrl: Dispatch<SetStateAction<string>>;
  setStoryboards: Dispatch<SetStateAction<StoryboardItem[]>>;
  setI2vStep: Dispatch<SetStateAction<AIProject['i2vStep']>>;
  setVideoDuration: Dispatch<SetStateAction<'3s' | '15s'>>;
  setIsOutfitImgGenerating: Dispatch<SetStateAction<boolean>>;
  setIsI2vGenerating: Dispatch<SetStateAction<boolean>>;
  changeAiWizardStep: (step: AiWizardStep) => void;
}

interface ApplyProjectOptions {
  restoreGenerationState?: boolean;
  resetWizard?: boolean;
}

export function useAIProjectController(activeProjectId: string, setters: ProjectEditorSetters) {
  const activeProjectIdRef = useRef(activeProjectId);
  const isSwitchingProjRef = useRef(false);
  const releaseTimerRef = useRef<number | null>(null);
  const settersRef = useRef(setters);

  useEffect(() => {
    settersRef.current = setters;
  }, [setters]);

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  useEffect(() => () => {
    if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current);
  }, []);

  const applyProjectToEditor = useCallback((
    project: AIProject,
    { restoreGenerationState = true, resetWizard = true }: ApplyProjectOptions = {}
  ) => {
    const editor = settersRef.current;
    isSwitchingProjRef.current = true;
    editor.setActiveProjectId(project.id);
    editor.setTopClothingUrl(project.topClothingUrl || '');
    editor.setBottomClothingUrl(project.bottomClothingUrl || '');
    editor.setReferenceOutfitUrl(project.referenceOutfitUrl || '');
    editor.setReferenceOutfitUrls(project.referenceOutfitUrls || (project.referenceOutfitUrl ? [project.referenceOutfitUrl] : []));
    editor.setModelOutfitImgUrl(project.modelOutfitImgUrl || null);
    editor.setModelOutfitImgUrls(project.modelOutfitImgUrls || (project.modelOutfitImgUrl ? [project.modelOutfitImgUrl] : []));
    editor.setModelGender(project.modelGender || 'female');
    editor.setModelRegion(project.modelRegion || 'east-asian');
    editor.setModelScene(project.modelScene || 'street');
    editor.setI2vMasterPrompt15s(project.i2vMasterPrompt15s || '');
    editor.setI2vPrompts(project.i2vPrompts || { ...DEFAULT_I2V_PROMPTS });
    const legacyProject = project as AIProject & { swapModelUrl?: string };
    editor.setSwapModelUrl(project.i2vPrompts?.swapModelUrl || legacyProject.swapModelUrl || '/clothing_model.png');
    editor.setStoryboards(project.storyboards || []);
    editor.setI2vStep(project.i2vStep || 'idle');
    editor.setVideoDuration(project.videoDuration === '3s' ? '3s' : '15s');
    editor.setIsOutfitImgGenerating(restoreGenerationState && !!project.isOutfitImgGenerating);
    editor.setIsI2vGenerating(restoreGenerationState && !!project.isI2vGenerating);
    if (resetWizard) editor.changeAiWizardStep(1);

    if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = window.setTimeout(() => {
      isSwitchingProjRef.current = false;
      releaseTimerRef.current = null;
    }, 0);
  }, []);

  return { activeProjectIdRef, isSwitchingProjRef, applyProjectToEditor };
}
