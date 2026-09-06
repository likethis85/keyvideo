import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AIProject } from '../types/aiProject';

interface OutfitResultsOptions {
  activeProjectId: string;
  outfitUrls: string[];
  setOutfitUrls: Dispatch<SetStateAction<string[]>>;
  setPrimaryOutfitUrl: Dispatch<SetStateAction<string | null>>;
  setProjects: Dispatch<SetStateAction<AIProject[]>>;
  syncProject: (project: AIProject) => void | Promise<void>;
}

export function useOutfitResults({
  activeProjectId,
  outfitUrls,
  setOutfitUrls,
  setPrimaryOutfitUrl,
  setProjects,
  syncProject
}: OutfitResultsOptions) {
  const persistResults = useCallback((urls: string[]) => {
    setOutfitUrls(urls);
    setPrimaryOutfitUrl(urls[0] || null);
    setProjects(previous => previous.map(project => {
      if (project.id !== activeProjectId) return project;
      const updated = {
        ...project,
        modelOutfitImgUrls: urls,
        modelOutfitImgUrl: urls[0] || null
      };
      void syncProject(updated);
      return updated;
    }));
  }, [activeProjectId, setOutfitUrls, setPrimaryOutfitUrl, setProjects, syncProject]);

  const deleteOutfitResult = useCallback((index: number) => {
    if (!activeProjectId) return;
    persistResults(outfitUrls.filter((_, itemIndex) => itemIndex !== index));
  }, [activeProjectId, outfitUrls, persistResults]);

  const clearOutfitResults = useCallback(() => {
    if (!activeProjectId) return;
    persistResults([]);
  }, [activeProjectId, persistResults]);

  return { persistOutfitResults: persistResults, deleteOutfitResult, clearOutfitResults };
}
