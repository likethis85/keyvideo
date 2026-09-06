import type { AIProject } from '../types/aiProject';
import { localDB } from '../utils/db';
import { supabase } from '../utils/supabaseClient';
import { mapProjectRow } from '../utils/aiProjectFactory';

export interface PersistedProjectState {
  projects: AIProject[];
  activeProjectId: string | null;
  swapModelUrl: string | null;
}

export async function loadPersistedProjectState(): Promise<PersistedProjectState> {
  let projects: AIProject[] = [];
  const { data: userSession } = await supabase.auth.getSession();
  const userId = userSession?.session?.user?.id;

  if (userId) {
    const { data: projectRows, error } = await supabase
      .from('ai_video_projects')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && projectRows?.length) {
      projects = projectRows.map((row: Record<string, unknown>) => mapProjectRow(row));

      const staleProjectIds = projects
        .filter(project => project.isOutfitImgGenerating)
        .map(project => project.id);

      if (staleProjectIds.length > 0) {
        void supabase
          .from('ai_video_projects')
          .update({ status: 'idle' })
          .in('id', staleProjectIds);
      }
    }
  }

  if (projects.length === 0) {
    const localProjects: unknown = await localDB.get('ai_projects');
    if (Array.isArray(localProjects)) projects = localProjects as AIProject[];
  }

  const storedActiveProjectId: unknown = await localDB.get('ai_active_project_id');
  const storedSwapModelUrl: unknown = await localDB.get('ai_swap_model_url');

  return {
    projects,
    activeProjectId: typeof storedActiveProjectId === 'string' ? storedActiveProjectId : null,
    swapModelUrl: typeof storedSwapModelUrl === 'string' ? storedSwapModelUrl : null
  };
}
