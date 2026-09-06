import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../utils/supabaseClient';
import { deleteFileFromOSS } from '../utils/ossClient';
import { TemplateTab } from './sidebar/TemplateTab';
import { TextTab } from './sidebar/TextTab';
import { StickerTab } from './sidebar/StickerTab';
import { AudioTab } from './sidebar/AudioTab';
import { MediaTab } from './sidebar/MediaTab';
import { ProjectsModal } from './sidebar/ProjectsModal';
import type { VideoStepProps } from './sidebar/ai/VideoStep';
import type { TryOnStepProps } from './sidebar/ai/TryOnStep';
import type { StoryboardStepProps } from './sidebar/ai/StoryboardStep';
import { AIWizardPanel } from './sidebar/ai/AIWizardPanel';
import { ModelSelectorModal } from './sidebar/ModelSelectorModal';
import { SceneSelectorModal } from './sidebar/SceneSelectorModal';
import { ConfirmDialog } from './sidebar/ConfirmDialog';
import { ClothingFocusModal } from './sidebar/ai/ClothingFocusModal';
import { VideoPreviewModal } from './sidebar/ai/VideoPreviewModal';
import { AISceneGenerationModal } from './sidebar/ai/AISceneGenerationModal';
import { ScenePreviewModal } from './sidebar/ai/ScenePreviewModal';
import { ModelPreviewModal } from './sidebar/ai/ModelPreviewModal';
import { AIModelGenerationModal } from './sidebar/ai/AIModelGenerationModal';
import { SidebarCollapseButton } from './sidebar/SidebarCollapseButton';
import { SCENE_BACKGROUNDS } from '../config/sceneBackgrounds';
import type { SidebarDrawerProps, SidebarDrawerRef } from './sidebar/sidebarTypes';
import { useSidebarModalState } from '../hooks/useSidebarModalState';
import { useAIGenerationState } from '../hooks/useAIGenerationState';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { AI_GATEWAY_CONFIG } from '../config/aiGatewayConfig';
import { useAiWizardNavigation } from '../hooks/useAiWizardNavigation';
import { useGenerationUnloadGuard } from '../hooks/useGenerationUnloadGuard';
import { useAIProjectController } from '../hooks/useAIProjectController';
import { useAssetLibrary } from '../hooks/useAssetLibrary';
import { useAssetLibraryActions } from '../hooks/useAssetLibraryActions';
import { useAISceneGeneration } from '../hooks/useAISceneGeneration';
import { useOutfitStylist } from '../hooks/useOutfitStylist';
import { useClothingInputs } from '../hooks/useClothingInputs';
import { useAIModelGeneration } from '../hooks/useAIModelGeneration';
import { useOutfitResults } from '../hooks/useOutfitResults';
import { useTryOnGeneration } from '../hooks/useTryOnGeneration';
import { parseFiveShotPrompt } from '../services/storyboardPromptParser';
import { syncProjectToSupabase } from '../services/aiProjectSyncService';
import { useTimelineActions } from '../hooks/useTimelineActions';
import { useProjectActions } from '../hooks/useProjectActions';
import { useStoryboardPromptGeneration } from '../hooks/useStoryboardPromptGeneration';
import { useStoryboardVideoAssets } from '../hooks/useStoryboardVideoAssets';
import { useStoryboardVideoRegeneration } from '../hooks/useStoryboardVideoRegeneration';
import { useStoryboardVideoGeneration } from '../hooks/useStoryboardVideoGeneration';
import { useStoryboardImageGeneration } from '../hooks/useStoryboardImageGeneration';
import { useGenerationTaskRecovery } from '../hooks/useGenerationTaskRecovery';
import { useRecentStoryboardRecovery } from '../hooks/useRecentStoryboardRecovery';
import { useAudioPreview } from '../hooks/useAudioPreview';
import { useLocalMediaActions } from '../hooks/useLocalMediaActions';
import { useAssetPanelActions } from '../hooks/useAssetPanelActions';
import { useProjectStateActions } from '../hooks/useProjectStateActions';
import { useAISceneDialogActions } from '../hooks/useAISceneDialogActions';
import { useAIModelDialogActions } from '../hooks/useAIModelDialogActions';
import { useSidebarUtilityActions } from '../hooks/useSidebarUtilityActions';
import { useProjectLifecycle } from '../hooks/useProjectLifecycle';

export type { AIProject, StoryboardItem } from '../types/aiProject';
export type { SidebarDrawerRef } from './sidebar/sidebarTypes';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const SidebarDrawer = forwardRef<SidebarDrawerRef, SidebarDrawerProps>(({
  activeTab,
  setActiveTab,
  layers,
  setLayers,
  selectedLayerId,
  setSelectedLayerId,
  setModelSwapRunning,
  ratio,
  session,
  projects,
  setProjects,
  activeProjectId,
  setActiveProjectId,
  setIsEditingProjName,
  editingProjNameValue,
  setEditingProjNameValue,
  isProjectsModalOpen,
  setIsProjectsModalOpen,
  isCollapsed = false,
  onToggleCollapse,
}, ref) => {
  const {
    addTextLayer,
    addStickerLayer,
    addBrandLogoLayer: addBrandLogoStickerLayer,
    addLocalVideoLayer,
    selectBgm
  } = useTimelineActions(setLayers, setSelectedLayerId);
  const {
    modelLibrary, setModelLibrary,
    customScenes, setCustomScenes,
    bgmLibrary, setBgmLibrary,
    localVideos, setLocalVideos
  } = useAssetLibrary(setLayers);
  const {
    saveModelLibrarySafely,
    saveCustomScenesSafely,
    saveBgmLibrarySafely,
    addModelToLibrary,
    addSceneToLibrary,
    deleteScene,
    renameScene,
    renameModel,
    deleteBgm,
    deleteLocalVideo,
    importLocalAudio,
    importLocalVideos
  } = useAssetLibraryActions({ setModelLibrary, setCustomScenes, setBgmLibrary, setLocalVideos });
  const { previewAudioSrc, togglePreviewAudio } = useAudioPreview(activeTab);
  const { aiDrawerContentRef, aiWizardStep, changeAiWizardStep } = useAiWizardNavigation();


  const {
    modelGender, setModelGender, modelRegion, setModelRegion, modelScene, setModelScene, swapModelUrl, setSwapModelUrl,
    isConfigLoaded, setIsConfigLoaded, batchClothingUrl, topClothingUrl, setTopClothingUrl, bottomClothingUrl, setBottomClothingUrl,
    referenceOutfitUrl, setReferenceOutfitUrl, referenceOutfitUrls, setReferenceOutfitUrls, storyboards, setStoryboards,
    i2vStep, setI2vStep, i2vPrompts, setI2vPrompts, videoDuration, setVideoDuration, i2vMasterPrompt15s, setI2vMasterPrompt15s,
    videoModel, setVideoModel, includeI2VSubtitles, setIncludeI2VSubtitles, includeI2VStickers, setIncludeI2VStickers,
    useSlowMotion, setUseSlowMotion, modelOutfitImgUrl, setModelOutfitImgUrl, modelOutfitImgUrls, setModelOutfitImgUrls,
    clothingFocus, setClothingFocus, isOutfitImgGenerating, setIsOutfitImgGenerating, outfitGenInterrupted, setOutfitGenInterrupted,
    clothingFocusModalOpen, setClothingFocusModalOpen, isI2vGenerating, setIsI2vGenerating, isRegeneratingShotId,
    setIsRegeneratingShotId, isStoryboardGenerating, setIsStoryboardGenerating, storyboardMode, setStoryboardMode
  } = useAIGenerationState();

  const gatewayUrl = AI_GATEWAY_CONFIG.imageUrl;
  const gatewayVideoUrl = AI_GATEWAY_CONFIG.videoUrl;
  const gatewayToken = AI_GATEWAY_CONFIG.imageToken;
  const gatewayVideoToken = AI_GATEWAY_CONFIG.videoToken;
  const { isGeneratingAiScene, generateScene, regenerateScene } = useAISceneGeneration({
    gatewayUrl,
    gatewayToken,
    setCustomScenes,
    saveCustomScenes: saveCustomScenesSafely,
    addScene: addSceneToLibrary
  });
  const {
    matchingItemDesc,
    setMatchingItemDesc,
    shoesDesc,
    setShoesDesc,
    accessoriesDesc,
    setAccessoriesDesc,
    isStylingLoading,
    triggerOutfitStylist
  } = useOutfitStylist({ gatewayUrl, gatewayToken });

  const {
    handleTopClothingUpload,
    handleBottomClothingUpload,
    handleReferenceOutfitUpload
  } = useClothingInputs({
    activeProjectId,
    setProjects,
    topClothingUrl,
    setTopClothingUrl,
    bottomClothingUrl,
    setBottomClothingUrl,
    referenceOutfitUrls,
    setReferenceOutfitUrl,
    setReferenceOutfitUrls,
    triggerOutfitStylist
  });

  const {
    persistOutfitResults,
    deleteOutfitResult: handleDeleteOutfitImg,
    clearOutfitResults: handleDeleteSingleOutfitImg
  } = useOutfitResults({
    activeProjectId,
    outfitUrls: modelOutfitImgUrls,
    setOutfitUrls: setModelOutfitImgUrls,
    setPrimaryOutfitUrl: setModelOutfitImgUrl,
    setProjects,
    syncProject: syncProjectToSupabase
  });
  const {
    isGenModelModalOpen, setIsGenModelModalOpen, modelRefImageUrl, setModelRefImageUrl,
    previewModel, setPreviewModel, closePreviewModel, previewScene, setPreviewScene, previewVideo, setPreviewVideo,
    isEditingModelName, setIsEditingModelName, editingModelNameValue, setEditingModelNameValue,
    isEditingSceneName, setIsEditingSceneName, editingSceneNameValue, setEditingSceneNameValue,
    isModelSelectorModalOpen, setIsModelSelectorModalOpen, isSceneSelectorModalOpen, setIsSceneSelectorModalOpen,
    storyboardEditPrompt, setStoryboardEditPrompt, storyboardRegenBgUrl, setStoryboardRegenBgUrl,
    outfitEditPrompt, setOutfitEditPrompt, outfitPoseImageUrl, setOutfitPoseImageUrl,
    usePoseCameraFraming, setUsePoseCameraFraming, modelEditPrompt, setModelEditPrompt,
    sceneEditPrompt, setSceneEditPrompt
  } = useSidebarModalState();
  const { isGeneratingModel: localModelSwapRunning, generateModel } = useAIModelGeneration({
    gatewayUrl,
    gatewayToken,
    gender: modelGender,
    region: modelRegion,
    scene: modelScene,
    ratio,
    setModelSwapRunning,
    setModelLibrary,
    saveModelLibrary: saveModelLibrarySafely,
    addModel: addModelToLibrary
  });
  const customScene = customScenes.find(s => s.id === modelScene);
  const activeBackgroundUrl = customScene ? customScene.src : (SCENE_BACKGROUNDS[modelScene as keyof typeof SCENE_BACKGROUNDS] || SCENE_BACKGROUNDS.studio);

  const { confirmDialog, showConfirm, closeConfirm } = useConfirmDialog();
  const {
    importAudio: handleImportLocalAudio,
    importVideos: handleImportLocalVideo,
    removeVideo: handleDeleteLocalVideo
  } = useLocalMediaActions({
    enabled: isTauri, importLocalAudio, importLocalVideos, deleteLocalVideo, showConfirm
  });
  const {
    handleModelUpload, handleModelRefUpload, handlePoseRefUpload, handleSceneUpload,
    deleteCustomScene, handleSaveSceneName, handleSaveModelPreviewName,
    handleBgmUpload, handleBgmDelete
  } = useAssetPanelActions({
    customScenes, setCustomScenes, setBgmLibrary, addModelToLibrary, addSceneToLibrary,
    saveCustomScenesSafely, saveBgmLibrarySafely, deleteScene, deleteBgm, renameScene, renameModel,
    previewScene, setPreviewScene, previewModel, setPreviewModel,
    editingSceneName: editingSceneNameValue, editingModelName: editingModelNameValue,
    setIsEditingSceneName, setIsEditingModelName, setModelRefImageUrl, setOutfitPoseImageUrl, showConfirm
  });

  // AI Project Management States
  const cancelledProjectsRef = useRef<Record<string, boolean>>({});
  const { activeProjectIdRef, isSwitchingProjRef, applyProjectToEditor } = useAIProjectController(activeProjectId, {
    setActiveProjectId,
    setTopClothingUrl,
    setBottomClothingUrl,
    setReferenceOutfitUrl,
    setReferenceOutfitUrls,
    setModelOutfitImgUrl,
    setModelOutfitImgUrls,
    setModelGender,
    setModelRegion,
    setModelScene,
    setI2vMasterPrompt15s,
    setI2vPrompts,
    setSwapModelUrl,
    setStoryboards,
    setI2vStep,
    setVideoDuration,
    setIsOutfitImgGenerating,
    setIsI2vGenerating,
    changeAiWizardStep
  });
  const { switchProject, startRenameProject, saveProjectName, createNewProject, deleteProject } = useProjectActions({
    projects,
    setProjects,
    activeProjectId,
    editingProjectName: editingProjNameValue,
    setEditingProjectName: setEditingProjNameValue,
    setIsEditingProjectName: setIsEditingProjName,
    applyProjectToEditor,
    showConfirm
  });
  const {
    setProjectStoryboards, setProjectIsI2vGenerating, setProjectIsOutfitImgGenerating,
    setProjectIsStoryboardGenerating, setProjectI2vStep,
    setProjectI2vMasterPrompt15s, setProjectI2vPrompts
  } = useProjectStateActions({
    activeProjectId, activeProjectIdRef, projects, setProjects, setStoryboards,
    setIsI2vGenerating, setIsOutfitImgGenerating, setIsStoryboardGenerating, setModelSwapRunning,
    setI2vStep, setI2vMasterPrompt15s, setI2vPrompts
  });


  useGenerationUnloadGuard(isOutfitImgGenerating || isStoryboardGenerating || isI2vGenerating);

  const selectedClothingLayer = layers.find(layer => layer.id === selectedLayerId);
  const fallbackClothingUrl = batchClothingUrl || (selectedClothingLayer?.type === 'media' ? selectedClothingLayer.properties.src || '' : '');
  const { generateConfiguredOutfits: handleGenerateModelOutfit } = useTryOnGeneration({
    activeProjectId,
    setProjectGenerating: setProjectIsOutfitImgGenerating,
    persistResults: persistOutfitResults,
    setPreviewModel,
    activeProjectIdRef,
    setOutfitUrls: setModelOutfitImgUrls,
    setPrimaryOutfitUrl: setModelOutfitImgUrl,
    setProjects,
    planDefaults: {
      referenceUrls: referenceOutfitUrls,
      modelUrl: swapModelUrl,
      existingUrls: modelOutfitImgUrls,
      primaryExistingUrl: modelOutfitImgUrl,
      topClothingUrl,
      bottomClothingUrl,
      matchingItem: matchingItemDesc,
      shoes: shoesDesc,
      accessories: accessoriesDesc,
      editPrompt: outfitEditPrompt,
      poseImageUrl: outfitPoseImageUrl,
      usePoseCameraFraming,
      gender: modelGender,
      region: modelRegion,
      ratio,
      gatewayUrl,
      gatewayToken
    },
    fallbackClothingUrl,
    previewSource: previewModel?.storyboardId === undefined ? previewModel?.src || null : null,
    onConfigurationRequired: () => setShowConfig(true)
  });

  const {
    downloadImage: handleDownloadImage,
    reorderStoryboards: handleReorderStoryboards,
    applyVideoToTimeline: handleApplyI2VToTimeline,
    applyTemplate,
    applyModel: applyModelFromLibrary,
    applyScene: applySceneBackground
  } = useSidebarUtilityActions({
    activeProjectId, setProjectStoryboards, storyboards, bgmLibrary, videoDuration, videoModel,
    storyboardMode, includeI2VStickers, includeI2VSubtitles, setLayers, setSelectedLayerId,
    customScenes, setSwapModelUrl, setModelScene, setActiveTab
  });

  useProjectLifecycle({
    sessionKey: session, activeProjectId, isSwitchingProjectRef: isSwitchingProjRef, projects, setProjects,
    setIsConfigLoaded, setSwapModelUrl, applyProjectToEditor, isConfigLoaded,
    editor: {
      topClothingUrl, bottomClothingUrl, referenceOutfitUrl, referenceOutfitUrls,
      modelOutfitImgUrl, modelOutfitImgUrls, modelGender, modelRegion, modelScene, swapModelUrl,
      i2vMasterPrompt15s, i2vPrompts, storyboards, i2vStep, videoDuration,
      isOutfitImgGenerating, isI2vGenerating
    }
  });

  useGenerationTaskRecovery({
    isConfigLoaded, projects, setProjects, activeProjectIdRef, setModelOutfitImgUrl, setModelOutfitImgUrls,
    setIsOutfitImgGenerating, videoModel, videoDuration, gatewayVideoUrl, gatewayVideoToken,
    cancelledProjectsRef, setStoryboards, setI2vStep, setIsI2vGenerating
  });
















  const [customPrompt, setCustomPrompt] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [showAiSceneModal, setShowAiSceneModal] = useState(false);
  const [aiScenePrompt, setAiScenePrompt] = useState('');
  const [aiSceneRefImage, setAiSceneRefImage] = useState<string | null>(null);
  const [aiSceneMultiView, setAiSceneMultiView] = useState(false);

  const { handleGenerateAiScene, handleRegenerateScene } = useAISceneDialogActions({
    prompt: aiScenePrompt, referenceImage: aiSceneRefImage, multiView: aiSceneMultiView, gatewayUrl, gatewayToken,
    previewScene, editPrompt: sceneEditPrompt, modelScene, generateScene, regenerateScene, setModelScene,
    setActiveTab, setShowConfig, setShowModal: setShowAiSceneModal, setPrompt: setAiScenePrompt,
    setReferenceImage: setAiSceneRefImage, setMultiView: setAiSceneMultiView, setPreviewScene
  });

  const { handleCustomModelSwap } = useAIModelDialogActions({
    gatewayUrl, gatewayToken, modelRefImageUrl, previewModel, modelEditPrompt, customPrompt,
    generateModel, setPreviewModel, setShowConfig
  });

  const {
    isGeneratingPromptsFromSkill,
    generateStoryboardPrompts: handleGeneratePromptsFromSkill
  } = useStoryboardPromptGeneration({
    activeProjectId, modelOutfitImgUrl, modelOutfitImgUrls, storyboards, swapModelUrl,
    videoDuration, gatewayUrl, gatewayToken, matchingItemDesc, shoesDesc, accessoriesDesc,
    modelScene, customScenes, activeBackgroundUrl, videoModel, storyboardMode, useSlowMotion,
    clothingFocus, setProjectI2vMasterPrompt15s, setProjectI2vPrompts
  });

  const { handleRegenerateStoryboard, executeGenerateStoryboards, handleGenerateStoryboards } = useStoryboardImageGeneration({
    activeProjectId, projects, storyboards, layers, selectedLayerId, batchClothingUrl, topClothingUrl, bottomClothingUrl,
    referenceOutfitUrl, referenceOutfitUrls, modelOutfitImgUrl, modelOutfitImgUrls, swapModelUrl, modelGender, modelRegion,
    matchingItemDesc, shoesDesc, accessoriesDesc, modelScene, customScenes, activeBackgroundUrl, videoDuration,
    storyboardMode, i2vMasterPrompt15s, i2vPrompts, gatewayUrl, gatewayToken, ratio, cancelledProjectsRef,
    setProjectStoryboards, setProjectI2vStep, setProjectIsStoryboardGenerating, setModelSwapRunning,
    setIsRegeneratingShotId, setPreviewModel, setClothingFocusModalOpen
  });


  const { isFetchingRecent, fetchRecentTasks: handleFetchRecentTasks } = useRecentStoryboardRecovery({
    activeProjectId, setProjectStoryboards, setProjectIsStoryboardGenerating
  });

  const [draggedStoryboardIndex, setDraggedStoryboardIndex] = useState<number | null>(null);

  const handleGenerateI2V = useStoryboardVideoGeneration({
    activeProjectId, projects, gatewayVideoUrl, gatewayVideoToken, setShowConfig, setProjectStoryboards,
    setProjectIsI2vGenerating, setProjectI2vStep, videoModel, videoDuration, storyboardMode,
    customScenes, modelScene, i2vMasterPrompt15s, i2vPrompts, activeBackgroundUrl, ratio,
    modelOutfitImgUrl, swapModelUrl, cancelledProjectsRef
  });


  const {
    redownloadVideo: handleRedownloadVideo,
    uploadVideo: handleManualVideoUpload
  } = useStoryboardVideoAssets({
    activeProjectId, gatewayVideoUrl, gatewayVideoToken, setShowConfig,
    setProjects, setStoryboards, setPreviewVideo
  });

  const handleRegenerateStoryboardVideo = useStoryboardVideoRegeneration({
    activeProjectId, projects, gatewayVideoUrl, gatewayVideoToken, setShowConfig, setProjectStoryboards,
    videoModel, customScenes, modelScene, i2vMasterPrompt15s, videoDuration, i2vPrompts,
    activeBackgroundUrl, ratio, modelOutfitImgUrl, swapModelUrl, cancelledProjectsRef, setPreviewVideo
  });


  useImperativeHandle(ref, () => ({
    switchProject,
    createNewProject,
    startRenameProject,
    deleteProject,
    saveProjectName
  }), [
    switchProject,
    createNewProject,
    startRenameProject,
    deleteProject,
    saveProjectName
  ]);

  const tryOnStepProps: TryOnStepProps = {
    swapModelUrl, modelLibrary, setIsModelSelectorModalOpen, modelScene, SCENE_BACKGROUNDS,
    customScenes, setIsSceneSelectorModalOpen, outfitGenInterrupted, setOutfitGenInterrupted,
    topClothingUrl, setTopClothingUrl, bottomClothingUrl, setBottomClothingUrl,
    handleTopClothingUpload, handleBottomClothingUpload, triggerOutfitStylist,
    referenceOutfitUrls, setReferenceOutfitUrls, setReferenceOutfitUrl, handleReferenceOutfitUpload,
    activeProjectId, projects, syncProjectToSupabase, deleteFileFromOSS,
    matchingItemDesc, setMatchingItemDesc, shoesDesc, setShoesDesc,
    accessoriesDesc, setAccessoriesDesc, isStylingLoading, handleGenerateModelOutfit,
    isOutfitImgGenerating, modelOutfitImgUrls, modelOutfitImgUrl, setPreviewModel,
    handleDeleteOutfitImg, handleDeleteSingleOutfitImg, setAiWizardStep: changeAiWizardStep
  };
  const storyboardStepProps: StoryboardStepProps = {
    videoDuration, setVideoDuration, storyboardMode, setStoryboardMode,
    includeI2VSubtitles, setIncludeI2VSubtitles, includeI2VStickers, setIncludeI2VStickers,
    useSlowMotion, setUseSlowMotion, clothingFocus, setClothingFocus,
    handleGenerateStoryboards, isStoryboardGenerating, handleFetchRecentTasks, isFetchingRecent,
    storyboards, draggedStoryboardIndex, setDraggedStoryboardIndex, handleReorderStoryboards,
    isRegeneratingShotId, setPreviewModel, modelOutfitImgUrl, handleGeneratePromptsFromSkill,
    isGeneratingPromptsFromSkill, i2vMasterPrompt15s, setI2vMasterPrompt15s,
    parse15sMasterPrompt: parseFiveShotPrompt, activeProjectId, setProjectI2vMasterPrompt15s,
    i2vPrompts, setI2vPrompts, setAiWizardStep: changeAiWizardStep
  };
  const videoStepProps: VideoStepProps = {
    storyboards, setPreviewVideo, videoModel, setVideoModel, handleGenerateI2V,
    isI2vGenerating, i2vStep, handleApplyI2VToTimeline, setAiWizardStep: changeAiWizardStep
  };

  return (
    <div className={`sidebar-drawer ${isCollapsed ? 'collapsed' : ''}`}>
      <SidebarCollapseButton collapsed={isCollapsed} onToggle={onToggleCollapse} />

      {/* 1. TEMPLATES PANEL */}
      {activeTab === 'template' && (
        <TemplateTab applyTemplate={applyTemplate} />
      )}

      {/* 2. MEDIA LIBRARY */}
      {activeTab === 'media' && (
        <MediaTab
          handleModelUpload={handleModelUpload}
          setIsGenModelModalOpen={setIsGenModelModalOpen}
          modelLibrary={modelLibrary}
          swapModelUrl={swapModelUrl}
          applyModelFromLibrary={applyModelFromLibrary}
          setPreviewModel={setPreviewModel}
          setEditingModelNameValue={setEditingModelNameValue}
          setIsEditingModelName={setIsEditingModelName}
          showConfirm={showConfirm}
          supabase={supabase}
          setModelLibrary={setModelLibrary}
          saveModelLibrarySafely={saveModelLibrarySafely}
          handleSceneUpload={handleSceneUpload}
          setShowAiSceneModal={setShowAiSceneModal}
          modelScene={modelScene}
          applySceneBackground={applySceneBackground}
          setPreviewScene={setPreviewScene}
          customScenes={customScenes}
          setEditingSceneNameValue={setEditingSceneNameValue}
          setIsEditingSceneName={setIsEditingSceneName}
          deleteCustomScene={deleteCustomScene}
          isTauri={isTauri}
          handleImportLocalVideo={handleImportLocalVideo}
          localVideos={localVideos}
          addLocalVideoLayer={addLocalVideoLayer}
          handleDeleteLocalVideo={handleDeleteLocalVideo}
        />
      )}

      {/* 3. TEXT OVERLAYS */}
      {activeTab === 'text' && (
        <TextTab addTextLayer={addTextLayer} />
      )}

      {/* 4. STICKERS AND BADGES */}
      {activeTab === 'sticker' && (
        <StickerTab addStickerLayer={addStickerLayer} addBrandLogoStickerLayer={addBrandLogoStickerLayer} />
      )}

      {activeTab === 'ai' && (
        <AIWizardPanel
          contentRef={aiDrawerContentRef}
          step={aiWizardStep}
          onStepChange={changeAiWizardStep}
          tryOnProps={tryOnStepProps}
          storyboardProps={storyboardStepProps}
          videoProps={videoStepProps}
          configExpanded={showConfig}
          onConfigToggle={() => setShowConfig(!showConfig)}
          backendUrl={import.meta.env.VITE_BACKEND_URL}
        />
      )}

     {/* 6. AUDIO AND TTS */}
      {activeTab === 'audio' && (
        <AudioTab
          isTauri={isTauri}
          handleImportLocalAudio={handleImportLocalAudio}
          handleBgmUpload={handleBgmUpload}
          bgmLibrary={bgmLibrary}
          selectBgm={selectBgm}
          togglePreviewAudio={togglePreviewAudio}
          previewAudioSrc={previewAudioSrc}
          handleBgmDelete={handleBgmDelete}
        />
      )}

      <AIModelGenerationModal
        isOpen={isGenModelModalOpen}
        referenceImage={modelRefImageUrl}
        gender={modelGender}
        region={modelRegion}
        prompt={customPrompt}
        onClose={() => setIsGenModelModalOpen(false)}
        onReferenceUpload={handleModelRefUpload}
        onReferenceClear={() => setModelRefImageUrl('')}
        onGenderChange={setModelGender}
        onRegionChange={setModelRegion}
        onPromptChange={setCustomPrompt}
        onGenerate={() => handleCustomModelSwap()}
      />

      <ScenePreviewModal
        scene={previewScene}
        editingName={isEditingSceneName}
        nameValue={editingSceneNameValue}
        editPrompt={sceneEditPrompt}
        isGenerating={isGeneratingAiScene}
        onClose={() => setPreviewScene(null)}
        onStartRename={() => { if (previewScene) setEditingSceneNameValue(previewScene.name); setIsEditingSceneName(true); }}
        onCancelRename={() => setIsEditingSceneName(false)}
        onNameChange={setEditingSceneNameValue}
        onSaveName={handleSaveSceneName}
        onPromptChange={setSceneEditPrompt}
        onApply={applySceneBackground}
        onRegenerate={handleRegenerateScene}
      />

      <ModelPreviewModal
        preview={previewModel}
        storyboards={storyboards}
        editingName={isEditingModelName}
        nameValue={editingModelNameValue}
        storyboardPrompt={storyboardEditPrompt}
        storyboardBackground={storyboardRegenBgUrl}
        outfitPrompt={outfitEditPrompt}
        poseImage={outfitPoseImageUrl}
        usePoseCameraFraming={usePoseCameraFraming}
        modelPrompt={modelEditPrompt}
        regeneratingStoryboardId={isRegeneratingShotId}
        outfitGenerating={isOutfitImgGenerating}
        modelGenerating={localModelSwapRunning}
        isOutfitPreview={!!previewModel && previewModel.storyboardId === undefined && (previewModel.src === modelOutfitImgUrl || modelOutfitImgUrls.includes(previewModel.src))}
        onClose={closePreviewModel}
        onPreviewChange={setPreviewModel}
        onStartRename={() => { if (previewModel) setEditingModelNameValue(previewModel.name); setIsEditingModelName(true); }}
        onCancelRename={() => setIsEditingModelName(false)}
        onNameChange={setEditingModelNameValue}
        onSaveName={handleSaveModelPreviewName}
        onDownload={handleDownloadImage}
        onStoryboardPromptChange={setStoryboardEditPrompt}
        onStoryboardBackgroundChange={setStoryboardRegenBgUrl}
        onRegenerateStoryboard={handleRegenerateStoryboard}
        onOutfitPromptChange={setOutfitEditPrompt}
        onPoseUpload={handlePoseRefUpload}
        onPoseImageClear={() => setOutfitPoseImageUrl(null)}
        onPoseCameraFramingChange={setUsePoseCameraFraming}
        onGenerateOutfit={handleGenerateModelOutfit}
        onModelPromptChange={setModelEditPrompt}
        onEditModel={() => handleCustomModelSwap(true)}
        onApplyModel={applyModelFromLibrary}
      />

      <ClothingFocusModal
        isOpen={clothingFocusModalOpen}
        hasReferenceOutfits={referenceOutfitUrls.length > 0}
        onClose={() => setClothingFocusModalOpen(false)}
        onSelect={focus => {
          setClothingFocusModalOpen(false);
          setClothingFocus(focus);
          void executeGenerateStoryboards(focus);
        }}
      />

      {/* AI Projects Management Dashboard Modal */}
      <ProjectsModal
        isOpen={isProjectsModalOpen}
        onClose={() => setIsProjectsModalOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        createNewProject={createNewProject}
        switchProject={switchProject}
        setProjects={setProjects}
        deleteProject={deleteProject}
      />

      <VideoPreviewModal
        preview={previewVideo}
        storyboards={storyboards}
        onClose={() => setPreviewVideo(null)}
        onUpload={handleManualVideoUpload}
        onRedownload={handleRedownloadVideo}
        onRegenerate={handleRegenerateStoryboardVideo}
      />

      <AISceneGenerationModal
        isOpen={showAiSceneModal}
        isGenerating={isGeneratingAiScene}
        prompt={aiScenePrompt}
        referenceImage={aiSceneRefImage}
        multiView={aiSceneMultiView}
        onClose={() => setShowAiSceneModal(false)}
        onPromptChange={setAiScenePrompt}
        onReferenceImageChange={setAiSceneRefImage}
        onMultiViewChange={setAiSceneMultiView}
        onGenerate={handleGenerateAiScene}
      />

      {/* 1. Model Selector Modal */}
      <ModelSelectorModal
        isOpen={isModelSelectorModalOpen}
        onClose={() => setIsModelSelectorModalOpen(false)}
        swapModelUrl={swapModelUrl}
        setSwapModelUrl={setSwapModelUrl}
        modelLibrary={modelLibrary}
        onGoToMedia={() => setActiveTab('media')}
      />

      {/* 2. Scene Selector Modal */}
      <SceneSelectorModal
        isOpen={isSceneSelectorModalOpen}
        onClose={() => setIsSceneSelectorModalOpen(false)}
        modelScene={modelScene}
        setModelScene={setModelScene}
        sceneBackgrounds={SCENE_BACKGROUNDS}
        customScenes={customScenes}
        onGoToMedia={() => setActiveTab('media')}
      />

      <ConfirmDialog dialog={confirmDialog} onClose={closeConfirm} />
    </div>
  );
});
