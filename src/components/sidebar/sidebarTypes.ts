import type React from 'react';
import type { Layer } from '../VideoCanvas';
import type { AIProject } from '../../types/aiProject';

export type SidebarTab = 'template' | 'media' | 'text' | 'sticker' | 'ai' | 'audio' | 'prompt';

export interface SidebarDrawerRef {
  switchProject: (id: string) => void;
  createNewProject: (name?: string) => AIProject | undefined;
  createProjectWithTemplate: (input: {
    name: string;
    masterPrompt: string;
    prompts: { 'full-body': string; 'medium': string; 'close-up': string };
  }) => AIProject;
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
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
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
  isProjectsModalOpen?: boolean;
  setIsProjectsModalOpen?: (value: boolean) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenInCanvas?: (options?: { type?: 'outfit' | 'storyboard' | 'image' | 'project'; src?: string; title?: string; prompt?: string }) => void;
}
