import { useState } from 'react';

export interface SidebarImagePreview { id?: string; src: string; name: string; storyboardId?: string; }
export interface SidebarVideoPreview { id: string; src: string; name: string; }

export function useSidebarModalState() {
  const [isGenModelModalOpen, setIsGenModelModalOpen] = useState(false);
  const [modelRefImageUrl, setModelRefImageUrl] = useState('');
  const [previewModel, setPreviewModel] = useState<SidebarImagePreview | null>(null);
  const [previewScene, setPreviewScene] = useState<SidebarImagePreview | null>(null);
  const [previewVideo, setPreviewVideo] = useState<SidebarVideoPreview | null>(null);
  const [isEditingModelName, setIsEditingModelName] = useState(false);
  const [editingModelNameValue, setEditingModelNameValue] = useState('');
  const [isEditingSceneName, setIsEditingSceneName] = useState(false);
  const [editingSceneNameValue, setEditingSceneNameValue] = useState('');
  const [isModelSelectorModalOpen, setIsModelSelectorModalOpen] = useState(false);
  const [isSceneSelectorModalOpen, setIsSceneSelectorModalOpen] = useState(false);
  const [storyboardEditPrompt, setStoryboardEditPrompt] = useState('');
  const [storyboardRegenBgUrl, setStoryboardRegenBgUrl] = useState<string | null>(null);
  const [outfitEditPrompt, setOutfitEditPrompt] = useState('');
  const [outfitPoseImageUrl, setOutfitPoseImageUrl] = useState<string | null>(null);
  const [usePoseCameraFraming, setUsePoseCameraFraming] = useState(true);
  const [modelEditPrompt, setModelEditPrompt] = useState('');
  const [sceneEditPrompt, setSceneEditPrompt] = useState('');

  const closePreviewModel = () => {
    setPreviewModel(null);
    setStoryboardEditPrompt('');
    setOutfitEditPrompt('');
    setOutfitPoseImageUrl(null);
    setStoryboardRegenBgUrl(null);
  };

  return {
    isGenModelModalOpen, setIsGenModelModalOpen, modelRefImageUrl, setModelRefImageUrl,
    previewModel, setPreviewModel, closePreviewModel, previewScene, setPreviewScene, previewVideo, setPreviewVideo,
    isEditingModelName, setIsEditingModelName, editingModelNameValue, setEditingModelNameValue,
    isEditingSceneName, setIsEditingSceneName, editingSceneNameValue, setEditingSceneNameValue,
    isModelSelectorModalOpen, setIsModelSelectorModalOpen, isSceneSelectorModalOpen, setIsSceneSelectorModalOpen,
    storyboardEditPrompt, setStoryboardEditPrompt, storyboardRegenBgUrl, setStoryboardRegenBgUrl,
    outfitEditPrompt, setOutfitEditPrompt, outfitPoseImageUrl, setOutfitPoseImageUrl,
    usePoseCameraFraming, setUsePoseCameraFraming, modelEditPrompt, setModelEditPrompt,
    sceneEditPrompt, setSceneEditPrompt
  };
}
