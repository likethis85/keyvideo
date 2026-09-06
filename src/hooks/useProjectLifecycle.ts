import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { AIProject, StoryboardItem } from '../types/aiProject';
import { createAIProject, DEFAULT_PROJECT_ID } from '../utils/aiProjectFactory';
import { localDB } from '../utils/db';
import { loadPersistedProjectState } from '../services/aiProjectPersistence';
import { syncProjectToSupabase } from '../services/aiProjectSyncService';
import { useAIProjectAutosave } from './useAIProjectAutosave';

interface Options {
  sessionKey: unknown;
  activeProjectId: string;
  isSwitchingProjectRef: MutableRefObject<boolean>;
  projects: AIProject[];
  setProjects: Dispatch<SetStateAction<AIProject[]>>;
  setIsConfigLoaded: (loaded: boolean) => void;
  setSwapModelUrl: (url: string) => void;
  applyProjectToEditor: (project: AIProject, options?: { restoreGenerationState?: boolean; resetWizard?: boolean }) => void;
  isConfigLoaded: boolean;
  editor: {
    topClothingUrl: string; bottomClothingUrl: string; referenceOutfitUrl: string; referenceOutfitUrls: string[];
    modelOutfitImgUrl: string | null; modelOutfitImgUrls: string[]; modelGender: AIProject['modelGender'];
    modelRegion: AIProject['modelRegion']; modelScene: string; swapModelUrl: string; i2vMasterPrompt15s: string;
    i2vPrompts: AIProject['i2vPrompts']; storyboards: StoryboardItem[]; i2vStep: AIProject['i2vStep'];
    videoDuration: '3s' | '15s'; isOutfitImgGenerating: boolean; isI2vGenerating: boolean;
  };
}

export function useProjectLifecycle(options: Options) {
  const editor = options.editor;
  useEffect(() => {
    if (!options.activeProjectId || options.isSwitchingProjectRef.current) return;
    options.setProjects(previous => previous.map(project => project.id === options.activeProjectId ? {
      ...project,
      ...editor,
      i2vPrompts: { ...editor.i2vPrompts, swapModelUrl: editor.swapModelUrl }
    } : project));
  // Every editor field below is an intentional persistence trigger; the container object itself is unstable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.activeProjectId, options.isSwitchingProjectRef, options.setProjects,
    editor.topClothingUrl, editor.bottomClothingUrl, editor.referenceOutfitUrl, editor.referenceOutfitUrls,
    editor.modelOutfitImgUrl, editor.modelOutfitImgUrls, editor.modelGender, editor.modelRegion, editor.modelScene,
    editor.swapModelUrl, editor.i2vMasterPrompt15s, editor.i2vPrompts, editor.storyboards, editor.i2vStep,
    editor.videoDuration, editor.isOutfitImgGenerating, editor.isI2vGenerating
  ]);

  useEffect(() => {
    if (editor.swapModelUrl) void localDB.set('ai_swap_model_url', editor.swapModelUrl).catch(error => console.warn(error));
  }, [editor.swapModelUrl]);

  useEffect(() => {
    const load = async () => {
      try {
        const persisted = await loadPersistedProjectState();
        if (persisted.swapModelUrl) options.setSwapModelUrl(persisted.swapModelUrl);
        if (persisted.projects.length > 0) {
          options.setProjects(persisted.projects);
          const id = persisted.activeProjectId && persisted.projects.some(project => project.id === persisted.activeProjectId)
            ? persisted.activeProjectId : persisted.projects[0].id;
          const project = persisted.projects.find(item => item.id === id);
          if (project) options.applyProjectToEditor(project, { restoreGenerationState: false, resetWizard: false });
        } else {
          const project = createAIProject({ id: DEFAULT_PROJECT_ID, name: '默认项目', withDefaultPrompts: true });
          options.setProjects([project]);
          options.applyProjectToEditor(project, { restoreGenerationState: false, resetWizard: false });
        }
      } catch (error) {
        console.warn('Failed to load projects config from localDB:', error);
      } finally {
        options.setIsConfigLoaded(true);
      }
    };
    void load();
    // Reload only when the authenticated session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.sessionKey]);

  useAIProjectAutosave({ projects: options.projects, activeProjectId: options.activeProjectId, enabled: options.isConfigLoaded, syncProject: syncProjectToSupabase });
}
