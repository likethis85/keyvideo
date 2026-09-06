import { useEffect, useRef } from 'react';
import type { AIProject } from '../types/aiProject';
import { localDB } from '../utils/db';

interface AIProjectAutosaveOptions {
  projects: AIProject[];
  activeProjectId: string;
  enabled: boolean;
  syncProject: (project: AIProject) => void | Promise<void>;
}

export function useAIProjectAutosave({
  projects,
  activeProjectId,
  enabled,
  syncProject
}: AIProjectAutosaveOptions) {
  const syncProjectRef = useRef(syncProject);

  useEffect(() => {
    syncProjectRef.current = syncProject;
  }, [syncProject]);

  useEffect(() => {
    if (!enabled || projects.length === 0) return;

    void localDB.set('ai_projects', projects).catch(error => console.warn(error));
    const timer = window.setTimeout(() => {
      projects.forEach(project => void syncProjectRef.current(project));
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [enabled, projects]);

  useEffect(() => {
    if (!enabled || !activeProjectId) return;
    void localDB.set('ai_active_project_id', activeProjectId).catch(error => console.warn(error));
  }, [activeProjectId, enabled]);
}
