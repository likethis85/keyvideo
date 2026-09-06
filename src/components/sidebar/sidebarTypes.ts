import type React from 'react';
import type { Layer } from '../VideoCanvas';
import type { AIProject } from '../../types/aiProject';

export type SidebarTab = 'template' | 'media' | 'text' | 'sticker' | 'ai' | 'audio';

export interface SidebarDrawerRef {
  switchProject: (id: string) => void;
  createNewProject: () => void;
  startRenameProject: () => void;
  deleteProject: (id: string) => void;
  saveProjectName: () => void;
}

export interface SidebarDrawerProps {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  setModelSwapRunning: (running: boolean) => void;
  ratio: '1-1' | '3-4' | '9-16' | '16-9';
  session?: unknown;
  projects: AIProject[];
  setProjects: React.Dispatch<React.SetStateAction<AIProject[]>>;
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  isEditingProjName: boolean;
  setIsEditingProjName: (value: boolean) => void;
  editingProjNameValue: string;
  setEditingProjNameValue: (value: string) => void;
  isProjectsModalOpen: boolean;
  setIsProjectsModalOpen: (value: boolean) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}
