import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AIProject } from '../types/aiProject';
import { createAIProject } from '../utils/aiProjectFactory';
import { supabase } from '../utils/supabaseClient';

type Confirm = (title: string, message: string, onConfirm: () => void) => void;
type ApplyProject = (project: AIProject, options?: { restoreGenerationState?: boolean; resetWizard?: boolean }) => void;

interface ProjectActionsOptions {
  projects: AIProject[];
  setProjects: Dispatch<SetStateAction<AIProject[]>>;
  activeProjectId: string;
  editingProjectName: string;
  setEditingProjectName: (name: string) => void;
  setIsEditingProjectName: (editing: boolean) => void;
  applyProjectToEditor: ApplyProject;
  showConfirm: Confirm;
}

const generateProjectId = () => crypto.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
  const random = (Math.random() * 16) | 0;
  const value = character === 'x' ? random : (random & 0x3) | 0x8;
  return value.toString(16);
});

export function useProjectActions({
  projects,
  setProjects,
  activeProjectId,
  editingProjectName,
  setEditingProjectName,
  setIsEditingProjectName,
  applyProjectToEditor,
  showConfirm
}: ProjectActionsOptions) {
  const switchProject = useCallback((projectId: string) => {
    const project = projects.find(item => item.id === projectId);
    if (project) applyProjectToEditor(project);
  }, [applyProjectToEditor, projects]);

  const startRenameProject = useCallback(() => {
    const project = projects.find(item => item.id === activeProjectId);
    if (!project) return;
    setEditingProjectName(project.name);
    setIsEditingProjectName(true);
  }, [activeProjectId, projects, setEditingProjectName, setIsEditingProjectName]);

  const saveProjectName = useCallback(() => {
    const name = editingProjectName.trim();
    if (!name) {
      alert('项目名称不能为空！');
      return;
    }
    setProjects(previous => previous.map(project => project.id === activeProjectId ? { ...project, name } : project));
    setIsEditingProjectName(false);
  }, [activeProjectId, editingProjectName, setIsEditingProjectName, setProjects]);

  const createNewProject = useCallback(() => {
    const defaultName = `项目_${projects.length + 1}`;
    const input = prompt('请输入新项目名称：', defaultName);
    if (input === null) return;
    const project = createAIProject({ id: generateProjectId(), name: input.trim() || defaultName });
    setProjects(previous => [...previous, project]);
    applyProjectToEditor(project, { restoreGenerationState: false });
  }, [applyProjectToEditor, projects.length, setProjects]);

  const deleteProject = useCallback((projectId: string) => {
    if (projects.length <= 1) return;
    showConfirm('删除项目', '确认要删除当前创作项目吗？所有未保存的配置及生成结果将丢失。', () => {
      const remaining = projects.filter(project => project.id !== projectId);
      setProjects(remaining);
      applyProjectToEditor(remaining[0]);
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user?.id) return supabase.from('ai_video_projects').delete().eq('id', projectId);
        return undefined;
      }).catch(error => console.warn('Failed to delete project from Supabase:', error));
    });
  }, [applyProjectToEditor, projects, setProjects, showConfirm]);

  return { switchProject, startRenameProject, saveProjectName, createNewProject, deleteProject };
}
