import { useCallback, useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { AIProject, StoryboardItem } from '../types/aiProject';
import { syncProjectToSupabase } from '../services/aiProjectSyncService';

type StoryboardUpdate = SetStateAction<StoryboardItem[]>;
type PromptUpdate = SetStateAction<AIProject['i2vPrompts']>;

interface ProjectStateActionsOptions {
  activeProjectId: string;
  activeProjectIdRef: MutableRefObject<string>;
  projects: AIProject[];
  setProjects: Dispatch<SetStateAction<AIProject[]>>;
  setStoryboards: Dispatch<StoryboardUpdate>;
  setIsI2vGenerating: (value: boolean) => void;
  setIsOutfitImgGenerating: (value: boolean) => void;
  setIsStoryboardGenerating: (value: boolean) => void;
  setModelSwapRunning: (value: boolean) => void;
  setI2vStep: (value: AIProject['i2vStep']) => void;
  setI2vMasterPrompt15s: (value: string) => void;
  setI2vPrompts: Dispatch<PromptUpdate>;
}

export function useProjectStateActions(options: ProjectStateActionsOptions) {
  const {
    activeProjectId, projects, setIsStoryboardGenerating, setIsOutfitImgGenerating,
    setIsI2vGenerating, setModelSwapRunning
  } = options;
  useEffect(() => {
    const project = projects.find(item => item.id === activeProjectId);
    if (!project) return;
    setIsStoryboardGenerating(!!project.isStoryboardGenerating);
    setIsOutfitImgGenerating(!!project.isOutfitImgGenerating);
    setIsI2vGenerating(!!project.isI2vGenerating);
    setModelSwapRunning(!!(project.isStoryboardGenerating || project.isOutfitImgGenerating));
  }, [
    activeProjectId, projects, setIsStoryboardGenerating, setIsOutfitImgGenerating,
    setIsI2vGenerating, setModelSwapRunning
  ]);

  const setProjectStoryboards = useCallback((projectId: string, update: StoryboardUpdate) => {
    options.setProjects(previous => previous.map(project => project.id === projectId
      ? { ...project, storyboards: typeof update === 'function' ? update(project.storyboards) : update }
      : project));
    if (projectId === options.activeProjectIdRef.current) options.setStoryboards(update);
  }, [options]);

  const setGenerating = useCallback((projectId: string, field: 'isI2vGenerating' | 'isOutfitImgGenerating' | 'isStoryboardGenerating', value: boolean) => {
    options.setProjects(previous => {
      const next = previous.map(project => project.id === projectId ? { ...project, [field]: value } : project);
      const target = next.find(project => project.id === projectId);
      if (target) void syncProjectToSupabase(target);
      return next;
    });
    if (projectId !== options.activeProjectIdRef.current) return;
    if (field === 'isI2vGenerating') options.setIsI2vGenerating(value);
    else if (field === 'isOutfitImgGenerating') options.setIsOutfitImgGenerating(value);
    else options.setIsStoryboardGenerating(value);
  }, [options]);

  const setProjectI2vStep = useCallback((projectId: string, value: AIProject['i2vStep']) => {
    options.setProjects(previous => previous.map(project => project.id === projectId ? { ...project, i2vStep: value } : project));
    if (projectId === options.activeProjectIdRef.current) options.setI2vStep(value);
  }, [options]);

  const setProjectI2vMasterPrompt15s = useCallback((projectId: string, value: string) => {
    options.setProjects(previous => previous.map(project => project.id === projectId ? { ...project, i2vMasterPrompt15s: value } : project));
    if (projectId === options.activeProjectIdRef.current) options.setI2vMasterPrompt15s(value);
  }, [options]);

  const setProjectI2vPrompts = useCallback((projectId: string, update: PromptUpdate) => {
    options.setProjects(previous => previous.map(project => project.id === projectId
      ? { ...project, i2vPrompts: typeof update === 'function' ? update(project.i2vPrompts) : update }
      : project));
    if (projectId === options.activeProjectIdRef.current) options.setI2vPrompts(update);
  }, [options]);

  return {
    setProjectStoryboards,
    setProjectIsI2vGenerating: (projectId: string, value: boolean) => setGenerating(projectId, 'isI2vGenerating', value),
    setProjectIsOutfitImgGenerating: (projectId: string, value: boolean) => setGenerating(projectId, 'isOutfitImgGenerating', value),
    setProjectIsStoryboardGenerating: (projectId: string, value: boolean) => setGenerating(projectId, 'isStoryboardGenerating', value),
    setProjectI2vStep,
    setProjectI2vMasterPrompt15s,
    setProjectI2vPrompts
  };
}
