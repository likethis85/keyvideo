import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import type { Layer } from './VideoCanvas';
import { generateMannequinImage, generateTryOnImage, generateVideoTask, pollVideoTask, getVideoContent, generateOutfitSuggestion, generatePromptsFromSkill, generateBackgroundImage } from '../utils/aiGateway';
import { localDB } from '../utils/db';
import { supabase } from '../utils/supabaseClient';
import { uploadAudioToOSS, uploadFileToOSS } from '../utils/ossClient';

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

const SCENE_BACKGROUNDS = {
  street: 'https://images.unsplash.com/photo-1527853787696-f7be74f2e39a?auto=format&fit=crop&w=800&q=80',
  studio: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=800&q=80',
  home: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80',
  office: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
  beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  runway: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
  minimalist: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'
};

const SCENE_PROMPT_DESCRIPTIONS: Record<string, string> = {
  street: 'posing in a premium cinematic urban street corner. The background features a consistent architectural facade with sleek dark metal panels, a large polished display window reflecting warm golden indoor lights on the left, and clean wet asphalt pavement reflecting soft ambient streetlights. Background city traffic is softly blurred into beautiful bokeh (out-of-focus circle lights), creating depth while maintaining a consistent outdoor urban layout.',
  studio: 'posing in a professional high-end wabi-sabi photo studio. The background features a textured beige micro-cement wall, a large geometric concrete archway on the left, and a soft sunlight beam slanting from a high side window creating elegant shadows. On the right side, there is a minimalist travertine stone pedestal and a designer lounge chair, maintaining a consistent minimalist studio setting with high-end gallery layout.',
  home: 'posing in a modernist luxury villa interior. The setting consists of polished micro-cement floors, a premium warm travertine marble accent wall in the background, and a large floor-to-ceiling glass window on the right showcasing a softly blurred outdoor garden with lush misty green foliage. The scene features warm ambient lighting from minimalist recessed led strips, maintaining a highly consistent, premium indoor layout.',
  office: 'posing in a sleek modern executive office interior. The background features a large transparent glass curtain wall showcasing a distant blurred skyline of skyscrapers at twilight, polished light-gray terrazzo flooring reflecting soft overhead lights, and a luxury dark walnut wood panel wall on the left. The scene maintains a consistent high-end corporate layout.',
  beach: 'posing at a high-end luxury resort private beach. The setting features clean fine white sand, a minimalist white concrete colonnade and arch structure in the background on the left, and palm leaf shadows cast onto a light-colored stucco wall. In the distance, a calm turquoise ocean with shimmering sunlight bokeh is visible under a warm morning sky, maintaining a consistent tropical resort layout.',
  runway: 'posing on a high-fashion runway stage. The background features a raw textured fair-faced concrete wall, a dark reflective mirror-like catwalk stage floor reflecting high-contrast overhead spotlights, and a subtle soft mist in the ambient air. Spotlights create dramatic light-and-shadow outlines on the model, maintaining a consistent runway environment.',
  minimalist: 'posing against a minimalist gallery concrete wall. The background features a textured beige plaster wall with clean geometric recessed niches, soft artistic shadows, and a gentle slanting warm light beam from the top left. The space is uncluttered with elegant architectural minimalism and generous negative space, maintaining a consistent high-end brand lookbook setting.'
};

export interface StoryboardItem {
  id: string;
  name: string;
  shotType: 'full-body' | 'medium' | 'close-up' | 'shot-1' | 'shot-2' | 'shot-3' | 'shot-4' | 'shot-5';
  imageSrc: string;
  videoSrc: string | null;
  videoBlob?: Blob;
  isGeneratingVideo: boolean;
  progress: number;
  isGeneratingImage?: boolean;
  videoTaskId?: string;
}

export interface AIProject {
  id: string;
  name: string;
  createdAt: string;
  topClothingUrl: string;
  bottomClothingUrl: string;
  referenceOutfitUrl?: string;
  referenceOutfitUrls?: string[];
  modelOutfitImgUrl: string | null;
  modelOutfitImgUrls?: string[];
  modelGender: 'female' | 'male';
  modelRegion: 'east-asian' | 'western';
  modelScene: string;
  i2vMasterPrompt15s: string;
  i2vPrompts: {
    'full-body': string;
    'medium': string;
    'close-up': string;
    swapModelUrl?: string;
  };
  storyboards: StoryboardItem[];
  i2vStep: 'idle' | 'storyboard_generated' | 'video_generated';
  videoDuration?: '3s' | '15s';
  isOutfitImgGenerating: boolean;
  isI2vGenerating: boolean;
  isStoryboardGenerating?: boolean;
}

export interface SidebarDrawerRef {
  switchProject: (id: string) => void;
  createNewProject: () => void;
  startRenameProject: () => void;
  deleteProject: (id: string) => void;
  saveProjectName: () => void;
}

interface SidebarDrawerProps {
  activeTab: 'template' | 'media' | 'text' | 'sticker' | 'ai' | 'audio';
  setActiveTab: (tab: 'template' | 'media' | 'text' | 'sticker' | 'ai' | 'audio') => void;
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  setModelSwapRunning: (running: boolean) => void;
  ratio: '1-1' | '3-4' | '9-16';
  session?: any;
  projects: AIProject[];
  setProjects: React.Dispatch<React.SetStateAction<AIProject[]>>;
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  isEditingProjName: boolean;
  setIsEditingProjName: (val: boolean) => void;
  editingProjNameValue: string;
  setEditingProjNameValue: (val: string) => void;
  isProjectsModalOpen: boolean;
  setIsProjectsModalOpen: (val: boolean) => void;
}

const base64ToBlob = (base64: string): Blob => {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
};

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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
  isEditingProjName,
  setIsEditingProjName,
  editingProjNameValue,
  setEditingProjNameValue,
  isProjectsModalOpen,
  setIsProjectsModalOpen
}, ref) => {
  // Model Library State (saved generated models)
  const [modelLibrary, setModelLibrary] = useState<{ id: string; src: string; date: string; name: string }[]>([]);

  // Custom Scene Library State (user uploaded scenes)
  const [customScenes, setCustomScenes] = useState<{ id: string; name: string; src: string }[]>([]);

  // Custom BGM Library State (user uploaded BGMs)
  const [bgmLibrary, setBgmLibrary] = useState<{ id: string; name: string; src: string; desc?: string }[]>([]);
  const [localVideos, setLocalVideos] = useState<{ id: string; name: string; src: string; desc: string; duration?: number }[]>([]);
  const [previewAudioSrc, setPreviewAudioSrc] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);


  const [modelGender, setModelGender] = useState<'female' | 'male'>('female');
  const [modelRegion, setModelRegion] = useState<'east-asian' | 'western'>('east-asian');
  const [modelScene, setModelScene] = useState<string>('street');
  const [swapModelUrl, setSwapModelUrl] = useState<string>('/clothing_model.png');
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  const gatewayUrl = 'backend-managed';
  const gatewayVideoUrl = 'backend-managed';
  const gatewayToken = 'backend-managed';
  const gatewayVideoToken = 'backend-managed';

  const [batchClothingUrl] = useState<string>('');
  const [topClothingUrl, setTopClothingUrl] = useState<string>('');
  const [bottomClothingUrl, setBottomClothingUrl] = useState<string>('');
  const [referenceOutfitUrl, setReferenceOutfitUrl] = useState<string>('');
  const [referenceOutfitUrls, setReferenceOutfitUrls] = useState<string[]>([]);
  const [matchingItemDesc, setMatchingItemDesc] = useState<string>('');
  const [shoesDesc, setShoesDesc] = useState<string>('');
  const [accessoriesDesc, setAccessoriesDesc] = useState<string>('');
  const [isStylingLoading, setIsStylingLoading] = useState<boolean>(false);

  const [storyboards, setStoryboards] = useState<StoryboardItem[]>([]);
  const [i2vStep, setI2vStep] = useState<'idle' | 'storyboard_generated' | 'video_generated'>('idle');

  const [i2vPrompts, setI2vPrompts] = useState({
    'full-body': '模特从远处缓慢走向镜头并步入画面中心。镜头保持平稳，慢速跟焦推进，展示全身服装版型与行走时的灵动垂感。',
    'medium': '镜头缓慢自左向右横移。半身中景对焦模特上身，模特伴随轻微自然的侧身姿势调整，慢速横移运镜，画面流畅。',
    'close-up': '微距镜头缓慢拉近。极细致特写聚焦于衣服面料纹理、做工走线与接缝细节，轻微景深虚化与慢速推进，保留呼吸感运镜。'
  });
  const [videoDuration, setVideoDuration] = useState<'3s' | '15s'>('15s');

  const [i2vMasterPrompt15s, setI2vMasterPrompt15s] = useState(
    '15秒快节奏连贯 5 幕叙事，引用参考图作为服装和模特的严格一致性参考。场景设定：摩登街头。第一幕：固定中景镜头，起初为场景空镜头，随后模特从画外走入镜头中央，风轻轻吹动发丝 and 服装衣角，确立高级气场。镜头切换（Cut to）第二幕：特写镜头，镜头聚焦在领口褶皱 and 收腰剪裁，清晰展现哑光羊绒的厚实温暖质感。镜头切换（Cut to）第三幕：中景跟拍，模特转身大步向前走，镜头跟随，完美展现流线型垂坠感。镜头切换（Cut to）第四幕：优雅侧面视角人像（模特微微侧身45度），模特微低头整理衣服袖口，展现别具一格的侧姿版型与剪裁。镜头切换（Cut to）第五幕：正面全身广角镜头，模特正面直视前方镜头站立，双手自然下垂，大方定格展示整体服装的穿着全貌。原生音效：环境白噪音与高跟鞋大理石脚步声混合舒缓大提琴乐。'
  );

  const [videoModel, setVideoModel] = useState(() => {
    return localStorage.getItem('ai_video_model') || 'viduq2';
  });
  const [includeI2VSubtitles, setIncludeI2VSubtitles] = useState(false);
  const [includeI2VStickers, setIncludeI2VStickers] = useState(false);
  const [useSlowMotion, setUseSlowMotion] = useState<boolean>(() => {
    return localStorage.getItem('ai_use_slow_motion') === 'true';
  });
  const [modelOutfitImgUrl, setModelOutfitImgUrl] = useState<string | null>(null);
  const [modelOutfitImgUrls, setModelOutfitImgUrls] = useState<string[]>([]);
  const [clothingFocus, setClothingFocus] = useState<'top' | 'bottom' | 'both'>(() => {
    return (localStorage.getItem('ai_clothing_focus') as any) || 'both';
  });

  const [isOutfitImgGenerating, setIsOutfitImgGenerating] = useState<boolean>(false);
  const [outfitGenInterrupted, setOutfitGenInterrupted] = useState(false);
  const [outfitEditPrompt, setOutfitEditPrompt] = useState('');
  const [outfitPoseImageUrl, setOutfitPoseImageUrl] = useState<string | null>(null);
  const [modelEditPrompt, setModelEditPrompt] = useState('');
  const [sceneEditPrompt, setSceneEditPrompt] = useState('');
  const [localModelSwapRunning, setLocalModelSwapRunning] = useState(false);
  const [clothingFocusModalOpen, setClothingFocusModalOpen] = useState(false);
  const [isGeneratingPromptsFromSkill, setIsGeneratingPromptsFromSkill] = useState<boolean>(false);

  const [isI2vGenerating, setIsI2vGenerating] = useState(false);
  const [isRegeneratingShotId, setIsRegeneratingShotId] = useState<string | null>(null);
  const [isStoryboardGenerating, setIsStoryboardGenerating] = useState<boolean>(false);
  const [storyboardMode, setStoryboardMode] = useState<'individual' | 'composite_slice' | 'composite_no_slice'>(() => {
    const saved = localStorage.getItem('ai_storyboard_mode');
    if (saved === 'composite_slice' || saved === 'composite_no_slice' || saved === 'individual') {
      return saved;
    }
    const oldCheck = localStorage.getItem('ai_generate_on_single_image');
    return oldCheck === 'true' ? 'composite_slice' : 'individual';
  });




  const [isGenModelModalOpen, setIsGenModelModalOpen] = useState(false);
  const [modelRefImageUrl, setModelRefImageUrl] = useState<string>('');
  const [previewModel, setPreviewModel] = useState<{ id?: string; src: string; name: string; storyboardId?: string } | null>(null);
  const [storyboardEditPrompt, setStoryboardEditPrompt] = useState<string>('');
  const [storyboardRegenBgUrl, setStoryboardRegenBgUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!previewModel) {
      setStoryboardEditPrompt('');
      setOutfitEditPrompt('');
      setOutfitPoseImageUrl(null);
      setStoryboardRegenBgUrl(null);
    }
  }, [previewModel]);
  const [isEditingModelName, setIsEditingModelName] = useState(false);
  const [editingModelNameValue, setEditingModelNameValue] = useState('');
  const [previewScene, setPreviewScene] = useState<{ id?: string; src: string; name: string } | null>(null);
  const [isEditingSceneName, setIsEditingSceneName] = useState(false);
  const [editingSceneNameValue, setEditingSceneNameValue] = useState('');
  const [previewVideo, setPreviewVideo] = useState<{ id: string; src: string; name: string } | null>(null);
  const [aiWizardStep, setAiWizardStep] = useState<1 | 2 | 3>(1);
  const [isModelSelectorModalOpen, setIsModelSelectorModalOpen] = useState(false);
  const [isSceneSelectorModalOpen, setIsSceneSelectorModalOpen] = useState(false);

  const customScene = customScenes.find(s => s.id === modelScene);
  const activeBackgroundUrl = customScene ? customScene.src : (SCENE_BACKGROUNDS[modelScene as keyof typeof SCENE_BACKGROUNDS] || SCENE_BACKGROUNDS.studio);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ title, message, onConfirm });
  };

  // AI Project Management States
  const activeProjectIdRef = useRef(activeProjectId);
  const isSwitchingProjRef = useRef(false);
  const cancelledProjectsRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);


  // Prevent accidental page refresh/close during active generation
  useEffect(() => {
    const isAnyGenerating = isOutfitImgGenerating || isStoryboardGenerating || isI2vGenerating;
    if (!isAnyGenerating) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '生成任务正在进行中，关闭页面将中断任务。确定要离开吗？';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOutfitImgGenerating, isStoryboardGenerating, isI2vGenerating]);

  // Synchronize local loading/generating states when switching projects
  useEffect(() => {
    if (!activeProjectId || projects.length === 0) return;
    const activeProj = projects.find(p => p.id === activeProjectId);
    if (activeProj) {
      setIsStoryboardGenerating(!!activeProj.isStoryboardGenerating);
      setIsOutfitImgGenerating(!!activeProj.isOutfitImgGenerating);
      setIsI2vGenerating(!!activeProj.isI2vGenerating);
      
      const activeRunning = !!(activeProj.isStoryboardGenerating || activeProj.isOutfitImgGenerating);
      setModelSwapRunning(activeRunning);
    }
  }, [activeProjectId, projects.length === 0]);

  const setProjectStoryboards = (projId: string, updater: StoryboardItem[] | ((prev: StoryboardItem[]) => StoryboardItem[])) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projId) {
        const newSbs = typeof updater === 'function' ? updater(p.storyboards) : updater;
        return { ...p, storyboards: newSbs };
      }
      return p;
    }));
    if (projId === activeProjectIdRef.current) {
      setStoryboards(updater);
    }
  };

  const setProjectIsI2vGenerating = (projId: string, val: boolean) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === projId ? { ...p, isI2vGenerating: val } : p);
      const targetProj = next.find(p => p.id === projId);
      if (targetProj) {
        syncProjectToSupabase(targetProj);
      }
      return next;
    });
    if (projId === activeProjectIdRef.current) {
      setIsI2vGenerating(val);
    }
  };


  const setProjectIsOutfitImgGenerating = (projId: string, val: boolean) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === projId ? { ...p, isOutfitImgGenerating: val } : p);
      const targetProj = next.find(p => p.id === projId);
      if (targetProj) {
        syncProjectToSupabase(targetProj);
      }
      return next;
    });
    if (projId === activeProjectIdRef.current) {
      setIsOutfitImgGenerating(val);
    }
  };

  const setProjectIsStoryboardGenerating = (projId: string, val: boolean) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === projId ? { ...p, isStoryboardGenerating: val } : p);
      const targetProj = next.find(p => p.id === projId);
      if (targetProj) {
        syncProjectToSupabase(targetProj);
      }
      return next;
    });
    if (projId === activeProjectIdRef.current) {
      setIsStoryboardGenerating(val);
    }
  };

  const setProjectI2vStep = (projId: string, val: 'idle' | 'storyboard_generated' | 'video_generated') => {
    setProjects(prev => prev.map(p => p.id === projId ? { ...p, i2vStep: val } : p));
    if (projId === activeProjectIdRef.current) {
      setI2vStep(val);
    }
  };

  const setProjectI2vMasterPrompt15s = (projId: string, val: string) => {
    setProjects(prev => prev.map(p => p.id === projId ? { ...p, i2vMasterPrompt15s: val } : p));
    if (projId === activeProjectIdRef.current) {
      setI2vMasterPrompt15s(val);
    }
  };

  const setProjectI2vPrompts = (projId: string, updater: any) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projId) {
        const nextPrompts = typeof updater === 'function' ? updater(p.i2vPrompts) : updater;
        return { ...p, i2vPrompts: nextPrompts };
      }
      return p;
    }));
    if (projId === activeProjectIdRef.current) {
      setI2vPrompts(updater);
    }
  };

  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download image, falling back to direct tab open:', err);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Sync active project state to projects list whenever local active states change
  useEffect(() => {
    if (!activeProjectId || isSwitchingProjRef.current) return;
    setProjects(prev => prev.map(p => p.id === activeProjectId ? {
      ...p,
      topClothingUrl,
      bottomClothingUrl,
      referenceOutfitUrl,
      referenceOutfitUrls,
      modelOutfitImgUrl,
      modelOutfitImgUrls,
      modelGender,
      modelRegion,
      modelScene,
      i2vMasterPrompt15s,
      i2vPrompts: {
        ...i2vPrompts,
        swapModelUrl
      },
      storyboards,
      i2vStep,
      videoDuration,
      isOutfitImgGenerating,
      isI2vGenerating
    } : p));
  }, [
    activeProjectId,
    topClothingUrl,
    bottomClothingUrl,
    referenceOutfitUrl,
    referenceOutfitUrls,
    modelOutfitImgUrl,
    modelOutfitImgUrls,
    modelGender,
    modelRegion,
    modelScene,
    swapModelUrl,
    i2vMasterPrompt15s,
    i2vPrompts,
    storyboards,
    i2vStep,
    videoDuration,
    isOutfitImgGenerating,
    isI2vGenerating
  ]);

  // Sync swapModelUrl to localDB global setting
  useEffect(() => {
    if (swapModelUrl) {
      localDB.set('ai_swap_model_url', swapModelUrl).catch(err => console.warn(err));
    }
  }, [swapModelUrl]);

  // Load projects from localDB on mount
  useEffect(() => {
    const loadProjectsAndConfig = async () => {
      try {
        let loadedProjects: AIProject[] = [];
        
        // 1. Try to fetch from Supabase if logged in
        const { data: userSession } = await supabase.auth.getSession();
        const userId = userSession?.session?.user?.id;
        
        if (userId) {
          const { data: dbProjects, error: dbError } = await supabase
            .from('ai_video_projects')
            .select('*')
            .order('created_at', { ascending: true });
            
          if (!dbError && dbProjects && dbProjects.length > 0) {
            let hadInterruptedOutfitGen = false;
            loadedProjects = dbProjects.map((p: any) => {
              let refUrls: string[] = [];
              if (p.reference_outfit_url) {
                if (p.reference_outfit_url.startsWith('[')) {
                  try { refUrls = JSON.parse(p.reference_outfit_url); } catch (e) { refUrls = [p.reference_outfit_url]; }
                } else {
                  refUrls = [p.reference_outfit_url];
                }
              }
              let outfitImgUrls: string[] = [];
              if (p.model_outfit_img_url) {
                if (p.model_outfit_img_url.startsWith('[')) {
                  try { outfitImgUrls = JSON.parse(p.model_outfit_img_url); } catch (e) { outfitImgUrls = [p.model_outfit_img_url]; }
                } else {
                  outfitImgUrls = [p.model_outfit_img_url];
                }
              }
              // Detect interrupted outfit generation (status was persisted as generating_outfit)
              if (p.status === 'generating_outfit') {
                hadInterruptedOutfitGen = true;
                // Reset status in DB so it won't keep showing on next reload
                supabase.from('ai_video_projects').update({ status: 'idle' }).eq('id', p.id).then(() => {});
              }
              return {
                id: p.id,
                name: p.name,
                createdAt: p.created_at,
                topClothingUrl: p.top_clothing_url || '',
                bottomClothingUrl: p.bottom_clothing_url || '',
                referenceOutfitUrl: refUrls[0] || '',
                referenceOutfitUrls: refUrls,
                modelOutfitImgUrl: outfitImgUrls[0] || null,
                modelOutfitImgUrls: outfitImgUrls,
                modelGender: p.model_gender,
                modelRegion: p.model_region,
                modelScene: p.model_scene,
                i2vMasterPrompt15s: p.i2v_master_prompt_15s || '',
                i2vPrompts: p.i2v_prompts,
                storyboards: p.storyboards || [],
                i2vStep: p.i2v_step || 'idle',
                videoDuration: p.video_duration === '4s' ? '3s' : (p.video_duration || '15s'),
                isOutfitImgGenerating: false,
                isI2vGenerating: false
              };
            });
            if (hadInterruptedOutfitGen) {
              setOutfitGenInterrupted(true);
            }
          }
        }
        
        // 2. Fall back to localDB if nothing loaded from Supabase
        if (loadedProjects.length === 0) {
          const savedProjects = await localDB.get('ai_projects');
          if (savedProjects && savedProjects.length > 0) {
            loadedProjects = savedProjects;
          }
        }

        const savedActiveId = await localDB.get('ai_active_project_id');
        const savedSwapUrl = await localDB.get('ai_swap_model_url');
        if (savedSwapUrl) setSwapModelUrl(savedSwapUrl);

        if (loadedProjects.length > 0) {
          setProjects(loadedProjects);
          const activeId = savedActiveId && loadedProjects.some((p: any) => p.id === savedActiveId)
            ? savedActiveId
            : loadedProjects[0].id;

          const activeProj = loadedProjects.find((p: any) => p.id === activeId);
          if (activeProj) {
            isSwitchingProjRef.current = true;
            setActiveProjectId(activeId);
            setTopClothingUrl(activeProj.topClothingUrl || '');
            setBottomClothingUrl(activeProj.bottomClothingUrl || '');
            setReferenceOutfitUrl(activeProj.referenceOutfitUrl || '');
            setReferenceOutfitUrls(activeProj.referenceOutfitUrls || (activeProj.referenceOutfitUrl ? [activeProj.referenceOutfitUrl] : []));
            setVideoDuration((activeProj.videoDuration as any) === '4s' ? '3s' : (activeProj.videoDuration || '15s'));
            setModelOutfitImgUrl(activeProj.modelOutfitImgUrl || null);
            setModelOutfitImgUrls(activeProj.modelOutfitImgUrls || (activeProj.modelOutfitImgUrl ? [activeProj.modelOutfitImgUrl] : []));
            setModelGender(activeProj.modelGender || 'female');
            setModelRegion(activeProj.modelRegion || 'east-asian');
            setModelScene(activeProj.modelScene || 'street');
            setI2vMasterPrompt15s(activeProj.i2vMasterPrompt15s || '');
            setI2vPrompts(activeProj.i2vPrompts || {
              'full-body': '模特从远处缓慢走向镜头并步入画面中心。镜头保持平稳，慢速跟焦推进，展示全身服装版型与行走时的灵动垂感。',
              'medium': '镜头缓慢自左向右横移。半身中景对焦模特上身，模特伴随轻微自然的侧身姿势调整，慢速横移运镜，画面流畅。',
              'close-up': '微距镜头缓慢拉近。极细致特写聚焦于衣服面料纹理、拉链纽扣与走线细节，轻微景深虚化与慢速推进，保留呼吸感运镜。'
            });
            const savedSwapModelUrl = activeProj.i2vPrompts?.swapModelUrl || (activeProj as any).swapModelUrl || '/clothing_model.png';
            setSwapModelUrl(savedSwapModelUrl);
            setStoryboards(activeProj.storyboards || []);
            setI2vStep(activeProj.i2vStep || 'idle');
            setIsOutfitImgGenerating(false);
            setIsI2vGenerating(false);
            setTimeout(() => {
              isSwitchingProjRef.current = false;
            }, 0);
          }
        } else {
          // Initialize default project
          const defaultId = '00000000-0000-0000-0000-000000000000';
          const defaultProj: AIProject = {
            id: defaultId,
            name: '默认项目',
            createdAt: new Date().toISOString(),
            topClothingUrl: '',
            bottomClothingUrl: '',
            referenceOutfitUrl: '',
            referenceOutfitUrls: [],
            modelOutfitImgUrl: null,
            modelOutfitImgUrls: [],
            modelGender: 'female',
            modelRegion: 'east-asian',
            modelScene: 'street',
            i2vMasterPrompt15s: '15秒快节奏连贯 5 幕叙事，引用参考图作为服装和模特的严格一致性参考。场景设定：摩登街头。第一幕：固定中景镜头，起初为场景空镜头，随后模特从画外走入镜头中央，风轻轻吹动发丝 and 服装衣角，确立高级气场。镜头切换（Cut to）第二幕：特写镜头，镜头聚焦在领口褶皱 and 收腰剪裁，清晰展现哑光羊绒的厚实温暖质感。镜头切换（Cut to）第三幕：中景跟拍，模特转身大步向前走，镜头跟随，完美展现流线型垂坠感。镜头切换（Cut to）第四幕：侧面中景，模特低头轻微整理下摆折边，展示真实穿搭场景。镜头切换（Cut to）第五幕：全景，镜头拉远，模特展现整体穿搭的完美比例，画面定格。原生音效：环境白噪音与高跟鞋大理石脚步声混合舒缓大提琴乐。',
            i2vPrompts: {
              'full-body': '模特从远处缓慢走向镜头并步入画面中心。镜头保持平稳，慢速跟焦推进，展示全身服装版型与行走时的灵动垂感。',
              'medium': '镜头缓慢自左向右横移。半身中景对焦模特上身，模特伴随轻微自然的侧身姿势调整，慢速横移运镜，画面流畅。',
              'close-up': '微距镜头缓慢拉近。极细致特写聚焦于衣服面料纹理、做工走线与接缝细节，轻微景深虚化与慢速推进，保留呼吸感运镜。'
            },
            storyboards: [],
            i2vStep: 'idle',
            videoDuration: '15s',
            isOutfitImgGenerating: false,
            isI2vGenerating: false,
            isStoryboardGenerating: false
          };
          setProjects([defaultProj]);
          isSwitchingProjRef.current = true;
          setActiveProjectId(defaultId);
          setI2vMasterPrompt15s(defaultProj.i2vMasterPrompt15s);
          setI2vPrompts(defaultProj.i2vPrompts);
          setTimeout(() => {
            isSwitchingProjRef.current = false;
          }, 0);
        }
      } catch (err) {
        console.warn('Failed to load projects config from localDB:', err);
      } finally {
        setIsConfigLoaded(true);
      }
    };
    loadProjectsAndConfig();
  }, [session]);

  // Save projects and active ID to localDB, debounced sync to Supabase
  useEffect(() => {
    if (!isConfigLoaded || projects.length === 0) return;

    // Save to IndexedDB immediately
    localDB.set('ai_projects', projects).catch(err => console.warn(err));

    // Debounce the Supabase sync
    const handler = setTimeout(() => {
      projects.forEach(p => {
        syncProjectToSupabase(p);
      });
    }, 1500); // 1.5 seconds debounce

    return () => clearTimeout(handler);
  }, [projects, isConfigLoaded]);

  useEffect(() => {
    if (isConfigLoaded && activeProjectId) {
      localDB.set('ai_active_project_id', activeProjectId).catch(err => console.warn(err));
    }
  }, [activeProjectId, isConfigLoaded]);

  const activePollingTasksRef = useRef<{ [storyboardId: string]: boolean }>({});

  const resumeStoryboardVideoPolling = async (projId: string, sbId: string, taskId: string) => {
    activePollingTasksRef.current[sbId] = true;
    console.log(`[Resume Polling] Starting polling loop for storyboard ${sbId}, task ID: ${taskId}`);

    try {
      let isCompleted = false;
      let pollCount = 0;
      const currentVideoModel = videoModel || 'Kling-V3-omni';
      const pollIntervalMs = currentVideoModel.includes('veo') ? 4000 : 3000;
      const maxPolls = (videoDuration === '15s' || videoDuration === '3s') ? 300 : (currentVideoModel.includes('veo') ? 150 : 200);

      while (!isCompleted && pollCount < maxPolls) {
        if (cancelledProjectsRef.current[projId]) {
          throw new Error('user_cancelled');
        }
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        if (cancelledProjectsRef.current[projId]) {
          throw new Error('user_cancelled');
        }
        pollCount++;

        try {
          const pollRes = await pollVideoTask(gatewayVideoUrl, gatewayVideoToken, taskId);

          if (pollRes.status === 'completed') {
            isCompleted = true;
            const videoBlob = await getVideoContent(gatewayVideoUrl, gatewayVideoToken, taskId);
            const localVideoUrl = URL.createObjectURL(videoBlob);
            
            // Update storyboard item inside projects list
            setProjects(prev => prev.map(p => {
              if (p.id !== projId) return p;
              return {
                ...p,
                storyboards: p.storyboards.map(s => s.id === sbId ? {
                  ...s,
                  videoSrc: localVideoUrl,
                  videoBlob: videoBlob,
                  isGeneratingVideo: false,
                  progress: 100,
                  videoTaskId: taskId
                } : s)
              };
            }));

            // Sync to UI state if active
            if (projId === activeProjectIdRef.current) {
              setStoryboards(prev => prev.map(s => s.id === sbId ? {
                ...s,
                videoSrc: localVideoUrl,
                videoBlob: videoBlob,
                isGeneratingVideo: false,
                progress: 100,
                videoTaskId: taskId
              } : s));
            }

            // Check if all other storyboards in this project have finished generating
            setProjects(prev => {
              const proj = prev.find(p => p.id === projId);
              if (proj) {
                const stillGenerating = proj.storyboards.some(s => s.id !== sbId && s.isGeneratingVideo);
                if (!stillGenerating) {
                  return prev.map(p => p.id === projId ? {
                    ...p,
                    i2vStep: 'video_generated' as const,
                    isI2vGenerating: false
                  } : p);
                }
              }
              return prev;
            });
            
            if (projId === activeProjectIdRef.current) {
              setI2vStep('video_generated');
              setIsI2vGenerating(false);
            }
          } else if (pollRes.status === 'failed') {
            throw new Error(pollRes.error || '视频生成模型内部错误导致生成失败');
          } else {
            const estimatedDuration = (videoDuration === '15s' || videoDuration === '3s') ? 100 : (currentVideoModel.includes('veo') ? 60 : 20);
            const calculatedProgress = Math.min(5 + Math.floor((pollCount / estimatedDuration) * 85), 90);
            
            setProjects(prev => prev.map(p => {
              if (p.id !== projId) return p;
              return {
                ...p,
                storyboards: p.storyboards.map(s => s.id === sbId ? {
                  ...s,
                  progress: calculatedProgress
                } : s)
              };
            }));

            if (projId === activeProjectIdRef.current) {
              setStoryboards(prev => prev.map(s => s.id === sbId ? {
                ...s,
                progress: calculatedProgress
              } : s));
            }
          }
        } catch (pollErr: any) {
          if (pollErr.message && (pollErr.message.includes('生成失败') || pollErr.message.includes('failed'))) {
            throw pollErr;
          }
          console.warn(`[Resume Poll Warning] Attempt ${pollCount} failed:`, pollErr);
        }
      }

      if (!isCompleted) {
        throw new Error('视频生成任务超时，请重试');
      }

    } catch (err: any) {
      console.error(`[Resume Polling Error] Storyboard ${sbId} failed:`, err);
      
      setProjects(prev => prev.map(p => {
        if (p.id !== projId) return p;
        return {
          ...p,
          storyboards: p.storyboards.map(s => s.id === sbId ? {
            ...s,
            isGeneratingVideo: false,
            progress: 0,
            videoTaskId: taskId
          } : s)
        };
      }));

      if (projId === activeProjectIdRef.current) {
        setStoryboards(prev => prev.map(s => s.id === sbId ? {
          ...s,
          isGeneratingVideo: false,
          progress: 0,
          videoTaskId: taskId
        } : s));
      }

      // Check if this was the last pending one to clean up isI2vGenerating status
      setProjects(prev => {
        const proj = prev.find(p => p.id === projId);
        if (proj) {
          const stillGenerating = proj.storyboards.some(s => s.isGeneratingVideo);
          if (!stillGenerating) {
            return prev.map(p => p.id === projId ? {
              ...p,
              isI2vGenerating: false
            } : p);
          }
        }
        return prev;
      });

      if (projId === activeProjectIdRef.current) {
        setIsI2vGenerating(false);
      }
    } finally {
      delete activePollingTasksRef.current[sbId];
    }
  };

  useEffect(() => {
    if (!isConfigLoaded || projects.length === 0 || !gatewayVideoUrl || !gatewayVideoToken) return;

    // Check all storyboards across all projects to resume polling
    projects.forEach(proj => {
      proj.storyboards.forEach(sb => {
        if (sb.isGeneratingVideo && sb.videoTaskId && !activePollingTasksRef.current[sb.id]) {
          resumeStoryboardVideoPolling(proj.id, sb.id, sb.videoTaskId);
        }
      });
    });
  }, [isConfigLoaded, projects, gatewayVideoUrl, gatewayVideoToken]);

  const startRenameProject = () => {
    const proj = projects.find(p => p.id === activeProjectId);
    if (proj) {
      setEditingProjNameValue(proj.name);
      setIsEditingProjName(true);
    }
  };

  const saveProjectName = () => {
    if (!editingProjNameValue.trim()) {
      alert('项目名称不能为空！');
      return;
    }
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, name: editingProjNameValue.trim() } : p));
    setIsEditingProjName(false);
  };

  const createNewProject = () => {
    const defaultName = `项目_${projects.length + 1}`;
    const nameInput = prompt('请输入新项目名称：', defaultName);
    
    if (nameInput === null) {
      return; // Aborted by user
    }
    
    const finalName = nameInput.trim() || defaultName;
    const id = generateUUID();
    const newProj: AIProject = {
      id,
      name: finalName,
      createdAt: new Date().toISOString(),
      topClothingUrl: '',
      bottomClothingUrl: '',
      referenceOutfitUrl: '',
      referenceOutfitUrls: [],
      modelOutfitImgUrl: null,
      modelOutfitImgUrls: [],
      modelGender: 'female',
      modelRegion: 'east-asian',
      modelScene: 'street',
      i2vMasterPrompt15s: '',
      i2vPrompts: {
        'full-body': '',
        'medium': '',
        'close-up': '',
        swapModelUrl: '/clothing_model.png'
      },
      storyboards: [],
      i2vStep: 'idle',
      videoDuration: '15s',
      isOutfitImgGenerating: false,
      isI2vGenerating: false,
      isStoryboardGenerating: false
    };

    isSwitchingProjRef.current = true;
    setProjects(prev => [...prev, newProj]);
    setActiveProjectId(id);
    setTopClothingUrl('');
    setBottomClothingUrl('');
    setReferenceOutfitUrl('');
    setReferenceOutfitUrls([]);
    setModelOutfitImgUrl(null);
    setModelOutfitImgUrls([]);
    setModelGender('female');
    setModelRegion('east-asian');
    setModelScene('street');
    setI2vMasterPrompt15s(newProj.i2vMasterPrompt15s);
    setI2vPrompts(newProj.i2vPrompts);
    setStoryboards([]);
    setI2vStep('idle');
    setVideoDuration('15s');
    setSwapModelUrl('/clothing_model.png');
    setIsOutfitImgGenerating(false);
    setIsI2vGenerating(false);

    setTimeout(() => {
      isSwitchingProjRef.current = false;
    }, 0);
  };

  const deleteProject = (id: string) => {
    if (projects.length <= 1) return;
    showConfirm('删除项目', '确认要删除当前创作项目吗？所有未保存的配置及生成结果将丢失。', async () => {
      const remaining = projects.filter(p => p.id !== id);
      setProjects(remaining);
      switchProject(remaining[0].id);
      
      try {
        const { data: userSession } = await supabase.auth.getSession();
        const userId = userSession?.session?.user?.id;
        if (userId) {
          await supabase.from('ai_video_projects').delete().eq('id', id);
        }
      } catch (err) {
        console.warn('Failed to delete project from Supabase:', err);
      }
    });
  };

  const switchProject = (targetProjectId: string) => {
    const targetProj = projects.find(p => p.id === targetProjectId);
    if (!targetProj) return;

    isSwitchingProjRef.current = true;
    setActiveProjectId(targetProjectId);
    setTopClothingUrl(targetProj.topClothingUrl || '');
    setBottomClothingUrl(targetProj.bottomClothingUrl || '');
    setReferenceOutfitUrl(targetProj.referenceOutfitUrl || '');
    setReferenceOutfitUrls(targetProj.referenceOutfitUrls || (targetProj.referenceOutfitUrl ? [targetProj.referenceOutfitUrl] : []));
    setModelOutfitImgUrl(targetProj.modelOutfitImgUrl || null);
    setModelOutfitImgUrls(targetProj.modelOutfitImgUrls || (targetProj.modelOutfitImgUrl ? [targetProj.modelOutfitImgUrl] : []));
    setModelGender(targetProj.modelGender || 'female');
    setModelRegion(targetProj.modelRegion || 'east-asian');
    setModelScene(targetProj.modelScene || 'street');
    setI2vMasterPrompt15s(targetProj.i2vMasterPrompt15s || '');
    setI2vPrompts(targetProj.i2vPrompts || {
      'full-body': '模特从远处缓慢走向镜头并步入画面中心。镜头保持平稳，慢速跟焦推进，展示全身服装版型与行走时的灵动垂感。',
      'medium': '镜头缓慢自左向右横移。半身中景对焦模特上身，模特伴随轻微自然的侧身姿势调整，慢速横移运镜，画面流畅。',
      'close-up': '微距镜头缓慢拉近。极细致特写聚焦于衣服面料纹理、做工走线与接缝细节，轻微景深虚化与慢速推进，保留呼吸感运镜。'
    });
    const savedSwapModelUrl = targetProj.i2vPrompts?.swapModelUrl || (targetProj as any).swapModelUrl || '/clothing_model.png';
    setSwapModelUrl(savedSwapModelUrl);
    setStoryboards(targetProj.storyboards || []);
    setI2vStep(targetProj.i2vStep || 'idle');
    setVideoDuration((targetProj.videoDuration as any) === '4s' ? '3s' : (targetProj.videoDuration || '15s'));
    setIsOutfitImgGenerating(targetProj.isOutfitImgGenerating || false);
    setIsI2vGenerating(targetProj.isI2vGenerating || false);
    setAiWizardStep(1);

    setTimeout(() => {
      isSwitchingProjRef.current = false;
    }, 0);
  };

  async function sliceStoryboardImage(
    srcUrl: string,
    numPanels: number,
    direction: 'horizontal' | 'vertical' = 'horizontal'
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const results: string[] = [];
        const W = img.naturalWidth;
        const H = img.naturalHeight;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        if (direction === 'horizontal') {
          const panelW = W / numPanels;
          canvas.width = panelW;
          canvas.height = H;

          for (let i = 0; i < numPanels; i++) {
            ctx.clearRect(0, 0, panelW, H);
            ctx.drawImage(img, i * panelW, 0, panelW, H, 0, 0, panelW, H);
            results.push(canvas.toDataURL('image/png'));
          }
        } else {
          const panelH = H / numPanels;
          canvas.width = W;
          canvas.height = panelH;

          for (let i = 0; i < numPanels; i++) {
            ctx.clearRect(0, 0, W, panelH);
            ctx.drawImage(img, 0, i * panelH, W, panelH, 0, 0, W, panelH);
            results.push(canvas.toDataURL('image/png'));
          }
        }
        resolve(results);
      };
      img.onerror = () => {
        reject(new Error('Failed to load image for slicing'));
      };
      img.src = srcUrl;
    });
  }

  async function checkAndSliceBackground(
    srcUrl: string
  ): Promise<string[] | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        const aspect = W / H;
        
        // If aspect ratio is wide enough (>= 2.0), we treat it as a multi-perspective/panoramic background
        if (aspect >= 2.0) {
          const results: string[] = [];
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          
          // Spatial scene templates are composed of exactly 3 panels
          const actualPanels = 3;
          const panelW = W / actualPanels;
          canvas.width = panelW;
          canvas.height = H;
          
          for (let i = 0; i < actualPanels; i++) {
            ctx.clearRect(0, 0, panelW, H);
            ctx.drawImage(img, i * panelW, 0, panelW, H, 0, 0, panelW, H);
            results.push(canvas.toDataURL('image/png'));
          }
          resolve(results);
        } else {
          resolve(null);
        }
      };
      img.onerror = (e) => {
        console.warn('Failed to load background image for slicing:', srcUrl, e);
        resolve(null);
      };

      // Append cache buster to avoid browser caching CORS issues
      if (srcUrl.startsWith('http')) {
        img.src = srcUrl.includes('?') ? `${srcUrl}&t=${Date.now()}` : `${srcUrl}?t=${Date.now()}`;
      } else {
        img.src = srcUrl;
      }
    });
  }

  // Safely write to IndexedDB to bypass the 5MB LocalStorage limit
  const saveModelLibrarySafely = (updated: { id: string; src: string; date: string; name: string }[]) => {
    localDB.set('ai_model_library', updated).catch(e => {
      console.error('Failed to save model library to IndexedDB:', e);
    });
    return updated;
  };

  async function ensureOssUrl(srcUrl: string, prefix: string): Promise<string> {
    if (!srcUrl) return '';
    if (!srcUrl.startsWith('data:') && !srcUrl.startsWith('blob:') && !srcUrl.startsWith('http://localhost') && !srcUrl.startsWith('https://localhost')) {
      return srcUrl; // Already a remote public URL
    }
    try {
      let fileToUpload: File;
      if (srcUrl.startsWith('data:')) {
        const blob = base64ToBlob(srcUrl);
        const ext = blob.type.split('/')[1] || 'png';
        fileToUpload = new File([blob], `${prefix}_${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
      } else {
        const response = await fetch(srcUrl);
        const blob = await response.blob();
        const ext = blob.type.split('/')[1] || 'png';
        fileToUpload = new File([blob], `${prefix}_${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
      }
      return await uploadFileToOSS(fileToUpload);
    } catch (e) {
      console.warn('Failed to upload file to OSS:', e);
      return srcUrl;
    }
  }

  async function syncProjectToSupabase(project: AIProject) {
    try {
      const { data: userSession } = await supabase.auth.getSession();
      const userId = userSession?.session?.user?.id;
      if (!userId) return; // Ignore if not authenticated

      // 1. Ensure clothing flatlays and outcomes are uploaded to OSS
      let topUrl = project.topClothingUrl;
      if (topUrl && topUrl.startsWith('data:')) {
        topUrl = await ensureOssUrl(topUrl, 'top_clothing');
      }
      let bottomUrl = project.bottomClothingUrl;
      if (bottomUrl && bottomUrl.startsWith('data:')) {
        bottomUrl = await ensureOssUrl(bottomUrl, 'bottom_clothing');
      }

      // Handle multiple reference outfits
      const refUrls = (project as any).referenceOutfitUrls || (project.referenceOutfitUrl ? [project.referenceOutfitUrl] : []);
      const uploadedRefUrls = await Promise.all(
        refUrls.map(async (url: string, idx: number) => {
          if (url && url.startsWith('data:')) {
            return await ensureOssUrl(url, `reference_outfit_${idx}`);
          }
          return url;
        })
      );
      const refOutfitUrlPayload = uploadedRefUrls.length > 0 ? JSON.stringify(uploadedRefUrls) : null;

      // Handle multiple model outfits outcomes
      const outfitUrls = (project as any).modelOutfitImgUrls || (project.modelOutfitImgUrl ? [project.modelOutfitImgUrl] : []);
      const uploadedOutfitUrls = await Promise.all(
        outfitUrls.map(async (url: string, idx: number) => {
          if (url && (url.startsWith('data:') || url.startsWith('blob:'))) {
            return await ensureOssUrl(url, `model_outfit_${idx}`);
          }
          return url;
        })
      );
      const outfitImgUrlPayload = uploadedOutfitUrls.length > 0 ? JSON.stringify(uploadedOutfitUrls) : null;

      // 2. Ensure all storyboards images and videos are uploaded to OSS
      const uploadedStoryboards = await Promise.all(
        project.storyboards.map(async (sb) => {
          let imageSrc = sb.imageSrc;
          let videoSrc = sb.videoSrc;

          if (imageSrc && (imageSrc.startsWith('data:') || imageSrc.startsWith('blob:'))) {
            imageSrc = await ensureOssUrl(imageSrc, `storyboard_img_${sb.id}`);
          }
          if (videoSrc && videoSrc.startsWith('blob:')) {
            videoSrc = await ensureOssUrl(videoSrc, `storyboard_video_${sb.id}`);
          }

          return {
            id: sb.id,
            name: sb.name,
            shotType: sb.shotType,
            imageSrc,
            videoSrc,
            isGeneratingVideo: sb.isGeneratingVideo,
            progress: sb.progress,
            videoTaskId: sb.videoTaskId || null
          };
        })
      );

      // Determine state status
      let projectStatus = 'idle';
      if (project.isI2vGenerating) {
        projectStatus = 'generating_video';
      } else if (project.isStoryboardGenerating) {
        projectStatus = 'generating_storyboard';
      } else if (project.isOutfitImgGenerating) {
        projectStatus = 'generating_outfit';
      } else if (project.i2vStep === 'video_generated') {
        projectStatus = 'video_generated';
      } else if (project.i2vStep === 'storyboard_generated') {
        projectStatus = 'storyboard_generated';
      }

      // Upsert into Supabase public.ai_video_projects
      const { error } = await supabase
        .from('ai_video_projects')
        .upsert({
          id: project.id,
          name: project.name,
          user_id: userId,
          top_clothing_url: topUrl || null,
          bottom_clothing_url: bottomUrl || null,
          reference_outfit_url: refOutfitUrlPayload,
          model_outfit_img_url: outfitImgUrlPayload,
          model_gender: project.modelGender || 'female',
          model_region: project.modelRegion || 'east-asian',
          model_scene: project.modelScene || 'street',
          i2v_master_prompt_15s: project.i2vMasterPrompt15s || null,
          i2v_prompts: project.i2vPrompts || {},
          storyboards: uploadedStoryboards,
          i2v_step: project.i2vStep || 'idle',
          status: projectStatus,
          video_duration: project.videoDuration || '15s'
        });

      if (error) {
        console.error('Failed to sync project to Supabase:', error);
      }
    } catch (e) {
      console.error('Error during Supabase project sync:', e);
    }
  }

  const addModelToLibrary = async (name: string, srcUrl: string): Promise<{ id: string; name: string; src: string; date: string } | null> => {
    try {
      let finalUrl = srcUrl;
      // 1. Upload to OSS if it is base64 or external URL
      if (srcUrl.startsWith('data:') || srcUrl.startsWith('http://') || srcUrl.startsWith('https://')) {
        try {
          let fileToUpload: File;
          if (srcUrl.startsWith('data:')) {
            const blob = base64ToBlob(srcUrl);
            fileToUpload = new File([blob], `ai_model_${Date.now()}.png`, { type: blob.type || 'image/png' });
          } else {
            const response = await fetch(srcUrl);
            const blob = await response.blob();
            fileToUpload = new File([blob], `ai_model_${Date.now()}.png`, { type: blob.type || 'image/png' });
          }
          finalUrl = await uploadFileToOSS(fileToUpload);
        } catch (e) {
          console.warn('Failed to upload model to OSS, using source URL:', e);
        }
      }

      // 2. Save to Supabase
      const { data: userSession } = await supabase.auth.getSession();
      const userId = userSession?.session?.user?.id;

      const newModelItem = {
        name,
        src: finalUrl,
        user_id: userId || null
      };

      const { data: insertData, error: insertError } = await supabase
        .from('model_assets')
        .insert([newModelItem])
        .select();

      if (insertError) throw insertError;

      const inserted = insertData?.[0];
      if (inserted) {
        const localItem = {
          id: inserted.id,
          src: inserted.src,
          date: new Date(inserted.created_at).toLocaleDateString(),
          name: inserted.name
        };

        setModelLibrary(prev => {
          const updated = [localItem, ...prev];
          saveModelLibrarySafely(updated);
          return updated;
        });

        return localItem;
      }
    } catch (err) {
      console.error('Failed to add model to library:', err);
    }
    return null;
  };

  const saveCustomScenesSafely = (updated: { id: string; name: string; src: string }[]) => {
    localDB.set('ai_custom_scenes', updated).catch(e => {
      console.error('Failed to save custom scenes to IndexedDB:', e);
    });
    return updated;
  };

  const saveBgmLibrarySafely = (updated: { id: string; name: string; src: string; desc?: string }[]) => {
    localDB.set('ai_bgm_library', updated).catch(e => {
      console.error('Failed to save bgm library to IndexedDB:', e);
    });
    return updated;
  };

  // Load libraries from IndexedDB on mount with localStorage migration fallback
  React.useEffect(() => {
    const loadFromDB = async () => {
      // 1. Model Library from Supabase with localDB fallback
      try {
        const { data: modelsData, error: modelsError } = await supabase
          .from('model_assets')
          .select('*')
          .order('created_at', { ascending: false });

        if (modelsData && !modelsError) {
          setModelLibrary(modelsData.map((m: any) => ({
            id: m.id,
            src: m.src,
            date: new Date(m.created_at).toLocaleDateString(),
            name: m.name
          })));
        } else {
          let models = await localDB.get('ai_model_library');
          if (!models) {
            try {
              const legacy = localStorage.getItem('ai_model_library');
              if (legacy) {
                models = JSON.parse(legacy);
                await localDB.set('ai_model_library', models);
              }
            } catch (e) {
              console.error(e);
            }
          }
          if (models) {
            setModelLibrary(models);
          }
        }
      } catch (err) {
        console.error('Failed to load models from Supabase:', err);
        let models = await localDB.get('ai_model_library');
        if (models) {
          setModelLibrary(models);
        }
      }

      // 2. Custom Scenes
      let scenes = await localDB.get('ai_custom_scenes');
      if (!scenes) {
        try {
          const legacy = localStorage.getItem('ai_custom_scenes');
          if (legacy) {
            scenes = JSON.parse(legacy);
            await localDB.set('ai_custom_scenes', scenes);
          }
        } catch (e) {
          console.error(e);
        }
      }
      if (scenes) {
        setCustomScenes(scenes);
      }

      // 3. Custom BGM from Supabase with localDB fallback
      try {
        const { data: bgmsData, error: bgmsError } = await supabase
          .from('audio_assets')
          .select('*')
          .order('created_at', { ascending: false });

        if (bgmsData && !bgmsError) {
          const mapped = bgmsData.map((b: any) => ({
            id: b.id,
            name: b.name,
            src: b.src,
            desc: b.desc
          }));
          setBgmLibrary(mapped);
          
          if (mapped.length > 0) {
            setLayers(prev => prev.map(l => {
              if (l.type === 'audio' && (l.properties.src === 'fashion_beat.mp3' || l.properties.src === 'jazz.mp3' || l.properties.src === 'tech_ambient.mp3')) {
                return {
                  ...l,
                  name: mapped[0].name,
                  properties: {
                    ...l.properties,
                    src: mapped[0].src
                  }
                };
              }
              return l;
            }));
          }
        } else {
          const bgms = await localDB.get('ai_bgm_library');
          if (bgms) {
            setBgmLibrary(bgms);
            if (bgms.length > 0) {
              setLayers(prev => prev.map(l => {
                if (l.type === 'audio' && (l.properties.src === 'fashion_beat.mp3' || l.properties.src === 'jazz.mp3' || l.properties.src === 'tech_ambient.mp3')) {
                  return {
                    ...l,
                    name: bgms[0].name,
                    properties: {
                      ...l.properties,
                      src: bgms[0].src
                    }
                  };
                }
                return l;
              }));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load bgms from Supabase:', err);
        const bgms = await localDB.get('ai_bgm_library');
        if (bgms) {
          setBgmLibrary(bgms);
          if (bgms.length > 0) {
            setLayers(prev => prev.map(l => {
              if (l.type === 'audio' && (l.properties.src === 'fashion_beat.mp3' || l.properties.src === 'jazz.mp3' || l.properties.src === 'tech_ambient.mp3')) {
                return {
                  ...l,
                  name: bgms[0].name,
                  properties: {
                    ...l.properties,
                    src: bgms[0].src
                  }
                };
              }
              return l;
            }));
          }
        }
      }

      // Load local videos from SQLite/localDB
      const videos = await localDB.getLocalVideos();
      if (videos) {
        setLocalVideos(videos);
      }
    };

    loadFromDB();
  }, []);

  // Cleanup preview audio on unmount or tab change
  React.useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, [activeTab]);









  const cleanPromptRefText = (text: string): string => {
    return text
      // 1. Clean specific starting prefixes
      .replace(/对应\s*图\d+\s*中的(?:最左侧第一格|第二格特写镜头|第三格中景|第四格侧面|最右侧第五格全景|第一格|第二格|第三格|第四格|第五格)[，,、]?\s*/g, '')
      .replace(/引用\s*图\d+\s*(?:做为特写|中景|侧面中景|全景)[，,、]?\s*/g, '')
      
      // 2. Clean inline bracketed reference pairs
      .replace(/\[分镜图_幕\d+\][（(]图\d+[）)](?:中的|中|的|所示的|所示)?/g, '')
      .replace(/\[分镜图_幕\d+\](?:中的|中|的|所示的|所示)?/g, '')
      .replace(/\[模特穿搭主图\][（(]图1[）)](?:中的|中|的|所示的|所示)?/g, '')
      .replace(/\[模特穿搭主图\](?:中的|中|的|所示的|所示)?/g, '')
      
      // 3. Clean parenthesized references
      .replace(/[（(]图\d+[）)](?:中的|中|的|所示的|所示)?/g, '')
      .replace(/[（(]Image\s*\d+[）)](?:中的|中|的|所示的|所示)?/g, '')
      
      // 4. Clean "引用/参考/对应 图X" structures
      .replace(/(?:引用|参考|对应)\s*(?:图\d+|参考图|\[@[^\]]+\])(?:中的|中|的|所示的|所示)?[，,、]?\s*/g, '')
      
      // 5. Clean any plain remaining "图X" or "Image X" along with optional trailing particles
      .replace(/图\d+(?:中的|中|的|所示的|所示)?/g, '')
      .replace(/Image\s*\d+(?:in|of|shown in)?/gi, '')
      
      // 6. Clean punctuation artifacts
      .replace(/^[，,、\s\.]+/, '')
      .replace(/[，,、\s\.]+$/, '')
      .replace(/，，/g, '，')
      .replace(/,,/g, ',')
      .trim();
  };

  const parse15sMasterPrompt = (prompt: string) => {
    const getPart = (startMarker: string, endMarker: string, fallback: string): string => {
      const startIdx = prompt.indexOf(startMarker);
      if (startIdx === -1) return fallback;
      const contentStart = startIdx + startMarker.length;
      const endIdx = endMarker ? prompt.indexOf(endMarker, contentStart) : prompt.length;
      if (endIdx === -1) return prompt.substring(contentStart).trim();
      return prompt.substring(contentStart, endIdx).trim();
    };

    const shot1 = cleanPromptRefText(getPart('第一幕：', '镜头切换（Cut to）第二幕：', '模特迈着从容的步伐从画外走入镜头中央并站定，微风轻轻吹动发丝和服装衣角。'));
    const shot2 = cleanPromptRefText(getPart('第二幕：', '镜头切换（Cut to）第三幕：', '镜头缓慢向前推进聚焦于模特的下半身服饰，展示服装的版型 and 剪裁设计。'));
    const shot3 = cleanPromptRefText(getPart('第三幕：', '镜头切换（Cut to）第四幕：', '镜头平滑拉近对准模特的手部特写，模特手部微调姿态展示材质的质地细节。'));
    const shot4 = cleanPromptRefText(getPart('第四幕：', '镜头切换（Cut to）第五幕：', '优雅侧面视角人像（模特微微侧身45度），模特微低头转身，展现别具一格的侧姿版型与剪裁。'));
    const shot5 = cleanPromptRefText(getPart('第五幕：', '原生音效：', '正面全身广角镜头，模特正面直视前方镜头站立，双手自然下垂，大方定格展示整体服装的穿着全貌。'));

    return {
      'shot-1': shot1,
      'shot-2': shot2,
      'shot-3': shot3,
      'shot-4': shot4,
      'shot-5': shot5
    };
  };

  const parse4sMasterPrompt = (prompt: string) => {
    const getPart = (startMarker: string, endMarker: string, fallback: string): string => {
      const startIdx = prompt.indexOf(startMarker);
      if (startIdx === -1) return fallback;
      const contentStart = startIdx + startMarker.length;
      const endIdx = endMarker ? prompt.indexOf(endMarker, contentStart) : prompt.length;
      if (endIdx === -1) return prompt.substring(contentStart).trim();
      return prompt.substring(contentStart, endIdx).trim();
    };

    const shot1 = cleanPromptRefText(getPart('第一幕：', '镜头切换（Cut to）第二幕：', '模特从远处缓慢走向镜头并步入画面中心。镜头保持平稳，慢速跟焦推进，展示全身服装版型与行走时的灵动垂感。'));
    const shot2 = cleanPromptRefText(getPart('第二幕：', '镜头切换（Cut to）第三幕：', '镜头缓慢自左向右横移。半身中景对焦模特上身，模特伴随轻微自然的侧身姿势调整，慢速横移运镜，画面流畅。'));
    const shot3 = cleanPromptRefText(getPart('第三幕：', '原生音效：', '微距镜头缓慢拉近。极细致特写聚焦于衣服面料纹理、做工走线与接缝细节，轻微景深虚化与慢速推进，保留呼吸感运镜。'));

    return {
      'full-body': shot1,
      'medium': shot2,
      'close-up': shot3
    };
  };







  const [customPrompt, setCustomPrompt] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [showAiSceneModal, setShowAiSceneModal] = useState(false);
  const [aiScenePrompt, setAiScenePrompt] = useState('');
  const [aiSceneRefImage, setAiSceneRefImage] = useState<string | null>(null);
  const [isGeneratingAiScene, setIsGeneratingAiScene] = useState(false);
  const [aiSceneMultiView, setAiSceneMultiView] = useState(false);

  const handleGenerateAiScene = async () => {
    if (!aiScenePrompt.trim() && !aiSceneRefImage) {
      alert('请输入背景场景描述词或上传场景参考图！');
      return;
    }
    if (!gatewayUrl.trim() || !gatewayToken.trim()) {
      alert('请确保在底部的「AI 网关配置」中输入了正确的网关地址与 Token！');
      setShowConfig(true);
      return;
    }

    setIsGeneratingAiScene(true);
    try {
      let finalPrompt = aiScenePrompt.trim();
      if (aiSceneMultiView) {
        finalPrompt = `A premium 16:9 architectural storyboard showing 3 different empty views of a luxury space, arranged side-by-side as a single horizontal comic strip with 3 equal panels. The panels are clearly separated by clean thin margins and showcase the empty backgrounds from different angles:
- Panel 1 (Left): A wide-angle view of the empty space showing ${aiScenePrompt.trim()} with curved minimalist architecture and soft diffused light.
- Panel 2 (Middle): A medium shot of the same space, showing ${aiScenePrompt.trim()} with refined material textures under soft side lighting.
- Panel 3 (Right): A close-up or alternative perspective view of the same space, focusing on detailed architectural lines and elegant shadows.
All panels must depict clean, empty spaces with absolutely no people, no models, no mannequins, and no clothing. High-end photography, serene and luxurious editorial aesthetic, warm color palette, ultra-high resolution.
Strict rule: There must be absolutely no text, writing, labels, titles, numbers, panel names, annotations, signatures, watermarks, or captions on any part of the image.`;
      }

      const generatedUrl = await generateBackgroundImage({
        prompt: finalPrompt,
        ratio: '16-9',
        gatewayUrl,
        gatewayToken,
        refImageUrl: aiSceneRefImage || undefined
      });

      const newScene = {
        id: `custom_scene_ai_${Date.now()}`,
        name: aiScenePrompt.trim().substring(0, 10) || 'AI 场景',
        src: generatedUrl
      };

      setCustomScenes(prev => {
        const updated = [newScene, ...prev];
        return saveCustomScenesSafely(updated);
      });

      setModelScene(newScene.id);
      setActiveTab('ai');
      setShowAiSceneModal(false);
      setAiScenePrompt('');
      setAiSceneRefImage(null);
      setAiSceneMultiView(false);
      alert(`已成功生成背景场景「${newScene.name}」并自动选定为 AI 绘图的参考背景！`);
    } catch (error: any) {
      console.error(error);
      alert(`AI 场景生成失败: ${error.message}`);
    } finally {
      setIsGeneratingAiScene(false);
    }
  };
  const handleRegenerateScene = async () => {
    if (!previewScene || !previewScene.id) return;
    if (!gatewayUrl.trim() || !gatewayToken.trim()) {
      alert('请确保在底部的「AI 网关配置」中输入了正确的网关地址与 Token！');
      setShowConfig(true);
      return;
    }

    setIsGeneratingAiScene(true);
    try {
      const generatedUrl = await generateBackgroundImage({
        prompt: sceneEditPrompt.trim() || previewScene.name,
        ratio: '16-9',
        gatewayUrl,
        gatewayToken,
        refImageUrl: previewScene.src
      });

      // Update customScenes state
      setCustomScenes(prev => {
        const updated = prev.map(s => s.id === previewScene.id ? { 
          ...s, 
          src: generatedUrl,
          name: sceneEditPrompt.trim().substring(0, 10) || s.name
        } : s);
        return saveCustomScenesSafely(updated);
      });

      // Update current preview source
      setPreviewScene(prev => prev ? { 
        ...prev, 
        src: generatedUrl, 
        name: sceneEditPrompt.trim().substring(0, 10) || prev.name 
      } : null);

      if (modelScene === previewScene.id) {
        applySceneBackground(sceneEditPrompt.trim().substring(0, 10) || previewScene.name, generatedUrl);
      }

      setIsGeneratingAiScene(false);
      alert('背景场景修改成功！');
    } catch (error: any) {
      setIsGeneratingAiScene(false);
      console.error(error);
      alert(`背景场景修改生成失败: ${error.message}`);
    }
  };



  const triggerOutfitStylist = async (top: string, bottom: string) => {
    if (!top && !bottom) return;
    if (!gatewayUrl.trim() || !gatewayToken.trim()) return;

    setIsStylingLoading(true);
    try {
      const res = await generateOutfitSuggestion({
        topUrl: top || undefined,
        bottomUrl: bottom || undefined,
        gatewayUrl,
        gatewayToken
      });
      setMatchingItemDesc(res.matchingItem);
      setShoesDesc(res.shoes);
      setAccessoriesDesc(res.accessories);
    } catch (e: any) {
      console.error('Stylist generation failed:', e);
    } finally {
      setIsStylingLoading(false);
    }
  };

  const handleTopClothingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Auto-rename project if it's default/unnamed
    const baseName = file.name.split('.')[0] || '上装';
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId && (p.name.startsWith('新项目_') || p.name === '新项目' || p.name === '默认项目' || p.name === '项目_1')) {
        return { ...p, name: `项目 - ${baseName}` };
      }
      return p;
    }));

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setTopClothingUrl(base64);
      await triggerOutfitStylist(base64, bottomClothingUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleBottomClothingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Auto-rename project if it's default/unnamed
    const baseName = file.name.split('.')[0] || '下装';
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId && (p.name.startsWith('新项目_') || p.name === '新项目' || p.name === '默认项目' || p.name === '项目_1')) {
        return { ...p, name: `项目 - ${baseName}` };
      }
      return p;
    }));

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setBottomClothingUrl(base64);
      await triggerOutfitStylist(topClothingUrl, base64);
    };
    reader.readAsDataURL(file);
  };

  const handleReferenceOutfitUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const availableSlots = 3 - referenceOutfitUrls.length;
    if (availableSlots <= 0) {
      alert('最多只能上传 3 套穿搭参考图！');
      return;
    }

    const filesToUpload = fileArray.slice(0, availableSlots);
    const baseName = filesToUpload[0].name.split('.')[0] || '穿搭参考';
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId && (p.name.startsWith('新项目_') || p.name === '新项目' || p.name === '默认项目' || p.name === '项目_1')) {
        return { ...p, name: `项目 - ${baseName}` };
      }
      return p;
    }));

    filesToUpload.forEach(file => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        setReferenceOutfitUrls(prev => {
          const next = [...prev, base64];
          if (next.length === 1) {
            setReferenceOutfitUrl(base64);
          }
          return next;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCustomModelSwap = async (isEditModeFromPreview = false) => {
    const currentSrc = isEditModeFromPreview && previewModel ? previewModel.src : (modelRefImageUrl || '/clothing_model.png');

    if (!gatewayUrl.trim()) {
      alert('请先在底部的「AI 网关配置」中输入您的 AI 网关地址！');
      setShowConfig(true);
      return;
    }
    if (!gatewayToken.trim()) {
      alert('请先在底部的「AI 网关配置」中输入您的 API Token！');
      setShowConfig(true);
      return;
    }

    setLocalModelSwapRunning(true);
    setModelSwapRunning(true);
    try {
      const regionStr = modelRegion === 'east-asian' ? 'East Asian' : 'Western';
      const genderStr = modelGender === 'female' ? 'female' : 'male';
      const wearPrompt = modelGender === 'female'
        ? 'wearing a simple minimalist beige tank top and beige shorts'
        : 'wearing a simple plain beige t-shirt and beige shorts';

      let characterSheetPrompt = '';
      const editPromptText = isEditModeFromPreview ? modelEditPrompt.trim() : customPrompt.trim();
      
      if (isEditModeFromPreview) {
        characterSheetPrompt = `Character sheet, concept art, model reference sheet. This is an image-to-image edit of the provided input model image. You must strictly preserve the model's exact facial features, facial structure, facial expression, hair color, skin tone, and body proportions from the input image. Keep the same model identity. Apply the following modifications to this model: ${editPromptText || 'regenerate cleanly'}. Keep the 3 panels (front view portrait of the face, side profile view of the face, and full body pose) arranged side-by-side in a single image, posing against a clean solid white background, matching the style and layout of the input image.`;
      } else {
        characterSheetPrompt = `Character sheet, concept art, model reference sheet. A high-resolution photo of the same professional ${regionStr} ${genderStr} model, ${wearPrompt}: featuring a front view portrait of the face, a side profile view of the face, and a full body pose showing the entire figure, all presented side-by-side in a single image. ${editPromptText ? editPromptText + '.' : ''} Posing against a clean solid white background. Flat studio lighting, detailed skin texture, realistic clothing folds, premium catalog quality.`;
      }

      const generatedImageUrl = await generateMannequinImage({
        imageUrl: currentSrc,
        gender: modelGender,
        region: modelRegion,
        scene: (modelScene === 'street' || modelScene === 'studio' || modelScene === 'home' || modelScene === 'office' || modelScene === 'beach' || modelScene === 'runway' || modelScene === 'minimalist') ? modelScene : 'studio',
        ratio,
        gatewayUrl,
        gatewayToken,
        customPrompt: characterSheetPrompt
      });

      if (isEditModeFromPreview && previewModel && previewModel.id) {
        // Update existing model in library
        const updatedLibrary = modelLibrary.map(m => m.id === previewModel.id ? { ...m, src: generatedImageUrl } : m);
        setModelLibrary(saveModelLibrarySafely(updatedLibrary));
        setPreviewModel(prev => prev ? { ...prev, src: generatedImageUrl } : null);
        alert('AI 模特修改重新生成成功！');
      } else {
        // Create new model in library
        const modelNameLabel = `参考卡-${modelGender === 'female' ? '女' : '男'}-${modelRegion === 'east-asian' ? '东亚' : '欧美'}`;
        await addModelToLibrary(modelNameLabel, generatedImageUrl);
        alert('AI 模特定制生成成功！已自动保存至您的「模特库」中。');
      }

      setLocalModelSwapRunning(false);
      setModelSwapRunning(false);
    } catch (error: any) {
      setLocalModelSwapRunning(false);
      setModelSwapRunning(false);
      console.error(error);
      alert(`AI 模特生成失败: ${error.message}`);
    }
  };

  const handleDeleteOutfitImg = (indexToDelete: number) => {
    const currentProjId = activeProjectId;
    if (!currentProjId) return;

    const nextUrls = modelOutfitImgUrls.filter((_, idx) => idx !== indexToDelete);
    setModelOutfitImgUrls(nextUrls);

    setProjects(prev => {
      const next = prev.map(p => {
        if (p.id === currentProjId) {
          const updated = {
            ...p,
            modelOutfitImgUrls: nextUrls,
            modelOutfitImgUrl: nextUrls[0] || ''
          };
          syncProjectToSupabase(updated);
          return updated;
        }
        return p;
      });
      return next;
    });
  };

  const handleDeleteSingleOutfitImg = () => {
    const currentProjId = activeProjectId;
    if (!currentProjId) return;

    setModelOutfitImgUrls([]);
    setModelOutfitImgUrl('');

    setProjects(prev => {
      const next = prev.map(p => {
        if (p.id === currentProjId) {
          const updated = {
            ...p,
            modelOutfitImgUrls: [],
            modelOutfitImgUrl: ''
          };
          syncProjectToSupabase(updated);
          return updated;
        }
        return p;
      });
      return next;
    });
  };

  const handleGenerateModelOutfit = async () => {
    const currentProjId = activeProjectId;
    if (!currentProjId) return;

    const usingRefOutfits = referenceOutfitUrls && referenceOutfitUrls.length > 0;
    
    // Check if we are in preview-edit mode
    const isEditMode = !!previewModel && previewModel.storyboardId === undefined;
    let targetIndex = -1;
    if (isEditMode && previewModel) {
      targetIndex = modelOutfitImgUrls.indexOf(previewModel.src);
      if (targetIndex === -1 && previewModel.src === modelOutfitImgUrl) {
        targetIndex = 0;
      }
    }

    let generatedUrls = [...modelOutfitImgUrls];

    if (!usingRefOutfits) {
      let currentSrc = '';
      if (batchClothingUrl) {
        currentSrc = batchClothingUrl;
      } else {
        const activeLayer = layers.find(l => l.id === selectedLayerId);
        if (activeLayer && activeLayer.type === 'media') {
          currentSrc = activeLayer.properties.src || '';
        }
      }

      const mainClothing = topClothingUrl || bottomClothingUrl || currentSrc;
      const bottomClothing = topClothingUrl ? bottomClothingUrl : undefined;

      if (!mainClothing) {
        alert('请先上传「服装白底图」或「穿搭参考图」，或在时间轴中选中一个衣服图层！');
        return;
      }

      if (!gatewayUrl.trim() || !gatewayToken.trim()) {
        alert('请确保在底部的「AI 网关配置」中输入了正确的网关地址与 Token！');
        setShowConfig(true);
        return;
      }

      setProjectIsOutfitImgGenerating(currentProjId, true);
      try {
        const regionStr = modelRegion === 'east-asian' ? 'East Asian' : 'Western';
        const genderStr = modelGender === 'female' ? 'female' : 'male';

        let stylingInfo = '';
        if (matchingItemDesc.trim()) stylingInfo += ` Outfit styling match: ${matchingItemDesc.trim()}.`;
        if (shoesDesc.trim()) stylingInfo += ` Footwear styling: ${shoesDesc.trim()}.`;
        if (accessoriesDesc.trim()) stylingInfo += ` Accessories/bags: ${accessoriesDesc.trim()}.`;

        let modificationInfo = '';
        if (outfitEditPrompt.trim()) modificationInfo = ` Please apply the following modification request: ${outfitEditPrompt.trim()}.`;

        const completionInstruction = ` Outfit Dressing and Completion Instruction: Dress the target model from the model reference image in the provided clothing garments. If only a top or bottom is provided, or if the clothing image is cropped or incomplete, automatically outpaint and generate matching pieces (e.g. pants, skirts, shoes) to present a complete, fully-dressed model from head to toe. Ensure all generated parts blend seamlessly in style, texture, and color with the visible garments.`;

        const customPromptText = `A premium quality fashion catalog photo. A high-resolution photo of the same professional ${regionStr} ${genderStr} model wearing the clothing item(s) provided. The model is standing in a neutral studio backdrop with a solid light grey/white background, showcasing the complete outfit. High-fidelity garment texture transfer, realistic drapery, correct drapery and fit. Detailed skin, studio lighting.${stylingInfo}${modificationInfo}${completionInstruction} Strict Outfit Consistency Rule: The model's complete outfit combination (including bottom pants/shorts/skirt, footwear, and any accessories) must remain strictly identical, consistent, and completely unchanged.`;

        // Use already generated outfit image if in edit mode
        const baseModelUrl = (isEditMode && targetIndex !== -1) 
          ? (modelOutfitImgUrls[targetIndex] || modelOutfitImgUrl || swapModelUrl) 
          : swapModelUrl;

        let generatedUrl = '';
        if (gatewayUrl && gatewayToken) {
          generatedUrl = await generateTryOnImage({
            clothingUrl: mainClothing,
            clothingBottomUrl: bottomClothing || undefined,
            modelUrl: baseModelUrl,
            gender: modelGender,
            region: modelRegion,
            scene: 'studio',
            ratio,
            gatewayUrl,
            gatewayToken,
            customPrompt: customPromptText,
            poseImageUrl: outfitPoseImageUrl || undefined
          });
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
          generatedUrl = baseModelUrl;
        }

        if (isEditMode && targetIndex !== -1) {
          generatedUrls = [...modelOutfitImgUrls];
          generatedUrls[targetIndex] = generatedUrl;
        } else {
          generatedUrls = [generatedUrl];
        }
      } catch (error: any) {
        console.error(error);
        alert(`穿搭图生成失败: ${error.message}`);
        setProjectIsOutfitImgGenerating(currentProjId, false);
        return;
      }
    } else {
      if (!gatewayUrl.trim() || !gatewayToken.trim()) {
        alert('请确保在底部的「AI 网关配置」中输入了正确的网关地址与 Token！');
        setShowConfig(true);
        return;
      }

      setProjectIsOutfitImgGenerating(currentProjId, true);
      try {
        const regionStr = modelRegion === 'east-asian' ? 'East Asian' : 'Western';
        const genderStr = modelGender === 'female' ? 'female' : 'male';

        let stylingInfo = '';
        if (matchingItemDesc.trim()) stylingInfo += ` Outfit styling match: ${matchingItemDesc.trim()}.`;
        if (shoesDesc.trim()) stylingInfo += ` Footwear styling: ${shoesDesc.trim()}.`;
        if (accessoriesDesc.trim()) stylingInfo += ` Accessories/bags: ${accessoriesDesc.trim()}.`;

        let modificationInfo = '';
        if (outfitEditPrompt.trim()) modificationInfo = ` Please apply the following modification request: ${outfitEditPrompt.trim()}.`;

        if (isEditMode && targetIndex !== -1) {
          // Regenerate only the previewed item based on its current generated image
          const refUrl = referenceOutfitUrls[targetIndex];
          const isFirstOutfit = (targetIndex === 0);
          const hasFlatlays = isFirstOutfit && !!(topClothingUrl || bottomClothingUrl);
          const clothingUrls = hasFlatlays
            ? [refUrl, topClothingUrl, bottomClothingUrl].filter(Boolean) as string[]
            : [refUrl];

          const flatlayDetailPrompt = hasFlatlays
            ? ' The provided clothing images also include clean flatlay garment images (top and/or bottom). You must strictly reference these clean flatlay garment images to capture the exact details, fabric textures, colors, logos, and patterns of the clothing, while using the model outfit reference image for styling/layering/drape reference. This is crucial because the clothing in the model outfit reference image might be partially blocked, folded, or shaded.'
            : '';

          const completionInstruction = ` Model Replacement and Outfit Preservation Instruction: The provided clothing image is a model outfit reference photo containing a person wearing the clothes. You must transfer the exact outfit (including the style, fabric texture, drapery, and colors) from this clothing image onto the target model from the model reference image. Replace the original model's face, hair, and skin tone with the face, hair, and body features of the target model.${flatlayDetailPrompt} If the outfit in the clothing image is cropped or incomplete, automatically outpaint and complete the rest (bottoms, footwear, or cuffs) to present a cohesive head-to-toe look.`;

          const customPromptText = `A premium quality fashion catalog photo. A high-resolution photo of the same professional ${regionStr} ${genderStr} model wearing the clothing item(s) provided. The model is standing in a neutral studio backdrop with a solid light grey/white background, showcasing the complete outfit. High-fidelity garment texture transfer, realistic drapery, correct drapery and fit. Detailed skin, studio lighting.${stylingInfo}${modificationInfo}${completionInstruction} Strict Outfit Consistency Rule: The model's complete outfit combination (including bottom pants/shorts/skirt, footwear, and any accessories) must remain strictly identical, consistent, and completely unchanged.`;

          const currentGeneratedUrl = modelOutfitImgUrls[targetIndex] || swapModelUrl;

          let generatedUrl = '';
          if (gatewayUrl && gatewayToken) {
            generatedUrl = await generateTryOnImage({
              clothingUrl: clothingUrls,
              modelUrl: currentGeneratedUrl, // Use the generated dressed model image
              gender: modelGender,
              region: modelRegion,
              scene: 'studio',
              ratio,
              gatewayUrl,
              gatewayToken,
              customPrompt: customPromptText,
              poseImageUrl: outfitPoseImageUrl || undefined
            });
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
            generatedUrl = currentGeneratedUrl;
          }
          generatedUrls[targetIndex] = generatedUrl;
        } else {
          // Generate all from scratch
          generatedUrls = [];
          for (let i = 0; i < referenceOutfitUrls.length; i++) {
            const refUrl = referenceOutfitUrls[i];
            const isFirstOutfit = (i === 0);
            const hasFlatlays = isFirstOutfit && !!(topClothingUrl || bottomClothingUrl);
            const clothingUrls = hasFlatlays
              ? [refUrl, topClothingUrl, bottomClothingUrl].filter(Boolean) as string[]
              : [refUrl];

            const flatlayDetailPrompt = hasFlatlays
              ? ' The provided clothing images also include clean flatlay garment images (top and/or bottom). You must strictly reference these clean flatlay garment images to capture the exact details, fabric textures, colors, logos, and patterns of the clothing, while using the model outfit reference image for styling/layering/drape reference. This is crucial because the clothing in the model outfit reference image might be partially blocked, folded, or shaded.'
              : '';

            const completionInstruction = ` Model Replacement and Outfit Preservation Instruction: The provided clothing image is a model outfit reference photo containing a person wearing the clothes. You must transfer the exact outfit (including the style, fabric texture, drapery, and colors) from this clothing image onto the target model from the model reference image. Replace the original model's face, hair, and skin tone with the face, hair, and body features of the target model.${flatlayDetailPrompt} If the outfit in the clothing image is cropped or incomplete, automatically outpaint and complete the rest (bottoms, footwear, or cuffs) to present a cohesive head-to-toe look.`;

            const customPromptText = `A premium quality fashion catalog photo. A high-resolution photo of the same professional ${regionStr} ${genderStr} model wearing the clothing item(s) provided. The model is standing in a neutral studio backdrop with a solid light grey/white background, showcasing the complete outfit. High-fidelity garment texture transfer, realistic drapery, correct drapery and fit. Detailed skin, studio lighting.${stylingInfo}${modificationInfo}${completionInstruction} Strict Outfit Consistency Rule: The model's complete outfit combination (including bottom pants/shorts/skirt, footwear, and any accessories) must remain strictly identical, consistent, and completely unchanged.`;

            let generatedUrl = '';
            if (gatewayUrl && gatewayToken) {
              generatedUrl = await generateTryOnImage({
                clothingUrl: clothingUrls,
                modelUrl: swapModelUrl,
                gender: modelGender,
                region: modelRegion,
                scene: 'studio',
                ratio,
                gatewayUrl,
                gatewayToken,
                customPrompt: customPromptText,
                poseImageUrl: outfitPoseImageUrl || undefined
              });
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000));
              generatedUrl = swapModelUrl;
            }
            generatedUrls.push(generatedUrl);
          }
        }
      } catch (error: any) {
        console.error(error);
        alert(`穿搭图生成失败: ${error.message}`);
        setProjectIsOutfitImgGenerating(currentProjId, false);
        return;
      }
    }

    setProjects(prev => prev.map(p => p.id === currentProjId ? {
      ...p,
      modelOutfitImgUrls: generatedUrls,
      modelOutfitImgUrl: generatedUrls[0] || null
    } : p));

    if (currentProjId === activeProjectIdRef.current) {
      setModelOutfitImgUrls(generatedUrls);
      setModelOutfitImgUrl(generatedUrls[0] || null);
      const displayIndex = targetIndex !== -1 ? targetIndex : 0;
      setPreviewModel(prev => prev && prev.storyboardId === undefined ? { ...prev, src: generatedUrls[displayIndex] || '' } : prev);
    }
    
    alert(isEditMode ? '修改生成成功！' : `模特服装穿搭参考图生成成功！已为您渲染生成 ${generatedUrls.length} 套对应效果图。`);
    setProjectIsOutfitImgGenerating(currentProjId, false);
  };

  const handleGeneratePromptsFromSkill = async () => {
    const currentProjId = activeProjectId;
    if (!currentProjId) return;

    const baseOutfitImg = modelOutfitImgUrls[0] || modelOutfitImgUrl;
    if (!baseOutfitImg) {
      alert('请先在一键生成穿搭图生成穿搭参考图，才能基于此参考图进行分析生成分镜提示词！');
      return;
    }
    if (!gatewayUrl.trim() || !gatewayToken.trim()) {
      alert('请确保在底部的「AI 网关配置」中输入了正确的网关地址与 Token！');
      setShowConfig(true);
      return;
    }

    setIsGeneratingPromptsFromSkill(true);
    try {
      const storyboardImgUrls = storyboards
        .map(s => s.imageSrc)
        .filter(src => src && src !== swapModelUrl);

      const responsePrompt = await generatePromptsFromSkill({
        modelOutfitImgUrl: baseOutfitImg,
        videoDuration,
        gatewayUrl,
        gatewayToken,
        matchingItemDesc,
        shoesDesc,
        accessoriesDesc,
        modelScene,
        customScenes,
        storyboardImgUrls,
        backgroundImageUrl: activeBackgroundUrl || undefined,
        model: videoModel,
        storyboardMode,
        useSlowMotion,
        focus: clothingFocus
      });

      if (videoDuration === '15s' || videoDuration === '3s') {
        setProjectI2vMasterPrompt15s(currentProjId, responsePrompt);
      } else {
        const parsed = parse4sMasterPrompt(responsePrompt);
        setProjectI2vPrompts(currentProjId, parsed);
      }
      alert('分镜视频提示词智能生成成功！已根据穿搭特征、物理动效与分镜编排自动注入分镜脚本中。');
    } catch (error: any) {
      console.error(error);
      alert(`智能生成分镜提示词失败: ${error.message}`);
    } finally {
      setIsGeneratingPromptsFromSkill(false);
    }
  };

  const getOutfitIndexForShot = (shotIndex: number, totalShots: number, totalOutfits: number): number => {
    if (totalOutfits <= 1) return 0;
    if (totalOutfits === 2) {
      if (totalShots === 5) {
        return shotIndex < 3 ? 0 : 1;
      } else {
        return shotIndex < 2 ? 0 : 1;
      }
    }
    if (totalOutfits === 3) {
      if (totalShots === 5) {
        if (shotIndex < 2) return 0;
        if (shotIndex < 4) return 1;
        return 2;
      } else {
        return shotIndex;
      }
    }
    return 0;
  };

  const handleRegenerateStoryboard = async (shotId: string, customPromptOverride?: string, bgOverrideUrl?: string | null) => {
    const currentProjId = activeProjectId;
    if (!currentProjId) return;

    let shotIndex = storyboards.findIndex(s => s.id === shotId);
    // Parse index from ID if possible (e.g. storyboard_shot_2_...)
    const idParts = shotId.split('_');
    const shotIndexPart = idParts.find((part, idx) => part === 'shot' && idParts[idx + 1] !== undefined);
    if (shotIndexPart) {
      const idxFromId = parseInt(idParts[idParts.indexOf('shot') + 1], 10);
      if (!isNaN(idxFromId)) {
        shotIndex = idxFromId;
      }
    }
    const shot = storyboards.find(s => s.id === shotId);
    if (!shot) return;

    const outfitIndex = getOutfitIndexForShot(shotIndex, storyboards.length, referenceOutfitUrls.length);
    const currentModelOutfitImg = modelOutfitImgUrls[outfitIndex];
    const currentReferenceOutfit = referenceOutfitUrls[outfitIndex];
    const mainClothing = currentReferenceOutfit || topClothingUrl || bottomClothingUrl || '';
    const bottomClothing = currentReferenceOutfit ? undefined : (topClothingUrl ? bottomClothingUrl : undefined);

    if (!mainClothing) {
      alert('请先上传「服装白底图」或「模特穿搭参考图」，或在时间轴中选中一个衣服图层！');
      return;
    }

    let clothingUrlPayload;
    let modelUrlPayload;
    let bottomUrlPayload;

    if (currentModelOutfitImg) {
      clothingUrlPayload = currentModelOutfitImg;
      modelUrlPayload = swapModelUrl;
      bottomUrlPayload = undefined;
    } else {
      clothingUrlPayload = mainClothing;
      modelUrlPayload = swapModelUrl;
      bottomUrlPayload = bottomClothing || undefined;
    }

    setIsRegeneratingShotId(shotId);
    try {
      const regionStr = modelRegion === 'east-asian' ? 'East Asian' : 'Western';
      const genderStr = modelGender === 'female' ? 'female' : 'male';
      const customSceneObj = customScenes.find(s => s.id === modelScene);
      const initialSceneDesc = SCENE_PROMPT_DESCRIPTIONS[modelScene as keyof typeof SCENE_PROMPT_DESCRIPTIONS]
        || (customSceneObj ? `posing in a custom scene: ${customSceneObj.name}` : 'posing in a matching catalog studio setting');

      const isNoSlice = storyboardMode === 'composite_no_slice';
      const numPanels = storyboards.length;
      
      let basePrompt = '';
      if (isNoSlice) {
        const parsedPrompts = parse15sMasterPrompt(i2vMasterPrompt15s);
        const shotsConfig = (videoDuration === '15s' || videoDuration === '3s') ? [
          { type: 'shot-1' as const, name: '分镜一：全身走秀出场 (0-3s)', prompt: parsedPrompts['shot-1'] },
          { type: 'shot-2' as const, name: '分镜二：下半身聚焦 (3-6s)', prompt: parsedPrompts['shot-2'] },
          { type: 'shot-3' as const, name: '分镜三：手部捏褶细节 (6-9s)', prompt: parsedPrompts['shot-3'] },
          { type: 'shot-4' as const, name: '分镜四：特写回拉全身 (9-12s)', prompt: parsedPrompts['shot-4'] },
          { type: 'shot-5' as const, name: '分镜五：换景全身定格 (12-15s)', prompt: parsedPrompts['shot-5'] }
        ] : [
          { type: 'full-body' as const, name: '分镜一：全身展示 (0-4s)', prompt: i2vPrompts['full-body'] },
          { type: 'medium' as const, name: '分镜二：半身中景 (4-8s)', prompt: i2vPrompts['medium'] },
          { type: 'close-up' as const, name: '分镜三：细节特写 (8-12s)', prompt: i2vPrompts['close-up'] }
        ];

        const panelsPromptList = shotsConfig.map((s, idx) => `Panel ${idx + 1} (${s.name}): ${s.prompt}`).join('. ');
        basePrompt = `A premium quality 16:9 multi-panel fashion storyboard, arranged side-by-side as a single horizontal comic strip with exactly ${numPanels} equal columns/panels. The panels must be clearly separated and show different views of the same model and outfit in a consistent setting: ${initialSceneDesc}. Here are the descriptions for each panel from left to right: ${panelsPromptList}`;
      } else {
        const parsedPrompts = parse15sMasterPrompt(i2vMasterPrompt15s);
        basePrompt = (videoDuration === '15s' || videoDuration === '3s')
          ? `${parsedPrompts[shot.shotType as keyof typeof parsedPrompts] || ''}`
          : `${i2vPrompts[shot.shotType as keyof typeof i2vPrompts] || ''}`;
      }

      const effectivePromptText = customPromptOverride && customPromptOverride.trim()
        ? `${basePrompt}. Additional instructions: ${customPromptOverride.trim()}`
        : basePrompt;

      // Use the per-shot uploaded override background first, fall back to global active background
      const effectiveBgSource = bgOverrideUrl || activeBackgroundUrl || undefined;
      let currentBackgroundUrl = effectiveBgSource;
      if (effectiveBgSource) {
        try {
          const sliced = await checkAndSliceBackground(effectiveBgSource);
          if (sliced && sliced.length === 3) {
            currentBackgroundUrl = sliced[shotIndex % 3];
            console.log('Successfully used sliced background panel', shotIndex % 3, 'for regeneration. (Override:', !!bgOverrideUrl, ')');
          }
        } catch (err) {
          console.warn('Failed to slice background during regeneration, using original:', err);
        }
      }

      const bgIndex = 3 + (bottomUrlPayload ? 1 : 0);
      const sceneDesc = currentBackgroundUrl
        ? `the setting shown in the background reference image (图${bgIndex})`
        : (SCENE_PROMPT_DESCRIPTIONS[modelScene as keyof typeof SCENE_PROMPT_DESCRIPTIONS] || (customSceneObj ? `posing in a custom scene: ${customSceneObj.name}` : 'posing in a matching catalog studio setting'));

      const isFullBody = shot.shotType === 'full-body' || shot.shotType === 'shot-1';
      let stylingInfo = '';
      if (matchingItemDesc.trim()) stylingInfo += ` Outfit styling match: ${matchingItemDesc.trim()}.`;
      if (shoesDesc.trim()) stylingInfo += ` Footwear styling: ${shoesDesc.trim()}.`;
      if (isFullBody && accessoriesDesc.trim()) {
        stylingInfo += ` Accessories/bags: ${accessoriesDesc.trim()}. The model should carry or wear the accessory naturally if the pose permits.`;
      } else if (!isFullBody) {
        stylingInfo += ` No bags or handbags should be visible in this view.`;
      }

      const outfitRefNote = currentModelOutfitImg ? ` IMPORTANT: The model reference image (图1) already shows the complete character wearing the full outfit. Use the character appearance, face, body proportions, and complete outfit exactly as shown in the model reference image (图1).` : '';

      const customPromptText = `A premium quality fashion portrait shot. A high-resolution cinematic photo of the same professional ${regionStr} ${genderStr} model from the target model reference image (图${bgIndex - 1}) wearing the clothing item(s) provided. The model must be posing elegantly in the following setting: ${sceneDesc}. Specifying view details: ${effectivePromptText}. High-fidelity garment texture transfer, realistic drapery, correct drapery and fit. Detailed skin, natural lighting.${stylingInfo}${outfitRefNote} Strict Face and Character Consistency Rule: The model's face, eyes, lips, nose, hair style, hair color, skin tone, facial features, body proportions, and overall identity must remain strictly identical, consistent, and completely unchanged, matching the target model reference image (图${bgIndex - 1}) exactly. The generated image must depict the exact same person with the identical face from the target model reference image (图${bgIndex - 1}). Strict Model Reference Rule: The model reference image (图${bgIndex - 1}) is ONLY used to reference the model's face, facial features, hair style, hair color, skin tone, and body features. Do NOT reference or copy the clothing, outfit, colors, or fabrics from the model reference image (图${bgIndex - 1}). The outfit must be strictly copied and transferred from the clothing reference image (图1) instead. Strict Outfit Consistency Rule: The model's complete outfit combination (including bottom pants/shorts/skirt, footwear, and any accessories) must remain strictly identical, consistent, and completely unchanged across all views, crops, and angles. The entire outfit must be a single, cohesive, identical set. No text or captions. There must be absolutely no text, writing, labels, titles, annotations, letters, numbers, or captions on any part of the image. Strict Anatomy Rule: Strictly prevent duplicate limbs, extra hands, floating fingers, or overlapping arms. The model must have anatomically correct posture and exactly two hands. Strict Single Panel Rule: The image must be a single, complete, unified photograph showing one single view of the model. Do not split, cut, divide, or slice the image into multiple columns, grids, panels, or separate boxes. Strictly prevent any borders, partitions, or line dividers within the image. Strict Background Consistency Rule: The background of the generated image must strictly and exactly match the provided background reference image (图${bgIndex}) in every single pixel, detail, color, furniture, layout, texture, and structure. Do not alter, regenerate, modify, or add any new elements to the background. The model must be seamlessly integrated into the exact background provided.`;

      let generatedUrl = '';
      if (gatewayUrl && gatewayToken) {
        generatedUrl = await generateTryOnImage({
          clothingUrl: clothingUrlPayload,
          clothingBottomUrl: bottomUrlPayload,
          modelUrl: modelUrlPayload,
          gender: modelGender,
          region: modelRegion,
          scene: (modelScene === 'street' || modelScene === 'studio' || modelScene === 'home' || modelScene === 'office' || modelScene === 'beach' || modelScene === 'runway' || modelScene === 'minimalist') ? (modelScene as any) : 'studio',
          ratio: isNoSlice ? '16-9' : ratio,
          gatewayUrl,
          gatewayToken,
          customPrompt: customPromptText,
          backgroundImageUrl: currentBackgroundUrl
        });
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500));
        generatedUrl = currentModelOutfitImg || swapModelUrl;
      }

      setProjectStoryboards(currentProjId, prev => prev.map(s => s.id === shotId ? { ...s, imageSrc: generatedUrl, videoSrc: null, progress: 0 } : s));
      setPreviewModel(prev => prev && prev.storyboardId === shotId ? { ...prev, src: generatedUrl } : prev);
      alert(`分镜「${shot.name}」静态画面重新生成成功！`);
    } catch (error: any) {
      console.error(error);
      alert(`分镜重新生成失败: ${error.message}`);
    } finally {
      setIsRegeneratingShotId(null);
    }
  };

  const executeGenerateStoryboards = async (focus: 'top' | 'bottom' | 'both') => {
    const currentProjId = activeProjectId;
    if (!currentProjId) return;

    let currentSrc = '';
    if (batchClothingUrl) {
      currentSrc = batchClothingUrl;
    } else {
      const activeLayer = layers.find(l => l.id === selectedLayerId);
      if (activeLayer && activeLayer.type === 'media') {
        currentSrc = activeLayer.properties.src || '';
      }
    }

    const hasUnrenderedOutfit = referenceOutfitUrls.some((_, idx) => !modelOutfitImgUrls[idx]);
    if (referenceOutfitUrls.length > 0 && hasUnrenderedOutfit) {
      alert('检测到您已上传模特穿搭参考图，请先点击上方「一键生成模特服装穿搭图」渲染目标模特效果，再进行分镜生成！');
      return;
    }

    const mainClothing = referenceOutfitUrls[0] || referenceOutfitUrl || topClothingUrl || bottomClothingUrl || currentSrc || '';
    const bottomClothing = (referenceOutfitUrls.length > 0 || referenceOutfitUrl) ? undefined : (topClothingUrl ? bottomClothingUrl : undefined);

    if (!mainClothing) {
      alert('请先上传「服装白底图」或「模特穿搭参考图」，或在时间轴中选中一个衣服图层！');
      return;
    }

    let focusPrompt = '';
    if (focus === 'top') {
      focusPrompt = ' The generation must emphasize and highlight the design, silhouette, texture, and details of the outermost upper garment (outer top / jacket / coat / vest / outer layer). Make this outermost upper clothing layer the clear focal point of the visual composition, showcasing its texture, seams, and overall fit over any inner layers.';
    } else if (focus === 'bottom') {
      focusPrompt = ' The generation must emphasize and highlight the drape, legs silhouette, texture, and details of the lower garment (pants / trousers / skirt). Make the bottom clothing the focal point of the visual composition.';
    }

    setModelSwapRunning(true);
    setProjectI2vStep(currentProjId, 'idle');
    setProjectIsStoryboardGenerating(currentProjId, true);
    cancelledProjectsRef.current[currentProjId] = false;

    try {
      const regionStr = modelRegion === 'east-asian' ? 'East Asian' : 'Western';
      const genderStr = modelGender === 'female' ? 'female' : 'male';
      const customSceneObj = customScenes.find(s => s.id === modelScene);
      const sceneDesc = SCENE_PROMPT_DESCRIPTIONS[modelScene as keyof typeof SCENE_PROMPT_DESCRIPTIONS]
        || (customSceneObj ? `posing in a custom scene: ${customSceneObj.name}` : 'posing in a matching catalog studio setting');

      const parsedPrompts = parse15sMasterPrompt(i2vMasterPrompt15s);
      let shotsConfig = [];
      if (videoDuration === '15s' || videoDuration === '3s') {
        if (focus === 'top') {
          shotsConfig = [
            { type: 'shot-1' as const, name: '分镜一：全身展示与上装轮廓 (0-3s)', prompt: `${parsedPrompts['shot-1']}, ${sceneDesc}. Focus on showing the overall silhouette of the top outerwear.` },
            { type: 'shot-2' as const, name: '分镜二：上半身领口剪裁特写 (3-6s)', prompt: `${parsedPrompts['shot-2'] || '聚焦于上衣的领口、肩膀与上半身细节'}, ${sceneDesc}. Extreme close-up focusing on the collar, neckline, chest and upper body of the top garment.` },
            { type: 'shot-3' as const, name: '分镜三：衣服袖口与材质细节 (6-9s)', prompt: `${parsedPrompts['shot-3'] || '聚焦于服装的材质材质与做工细节'}, ${sceneDesc}. Close-up of the fabric texture, stitching, seams, or sleeve cuffs of the top outerwear.` },
            { type: 'shot-4' as const, name: '分镜四：侧面半身活动特写 (9-12s)', prompt: `${parsedPrompts['shot-4']}, ${sceneDesc}. Medium shot focusing on the upper body and top garment fit.` },
            { type: 'shot-5' as const, name: '分镜五：正面半身搭配定格 (12-15s)', prompt: `${parsedPrompts['shot-5']}, ${sceneDesc}. Front view focusing on the upper body and top garment details.` }
          ];
        } else if (focus === 'bottom') {
          shotsConfig = [
            { type: 'shot-1' as const, name: '分镜一：全身展示与下装版型 (0-3s)', prompt: `${parsedPrompts['shot-1']}, ${sceneDesc}. Focus on showing the overall layout and silhouette of the pants/skirt.` },
            { type: 'shot-2' as const, name: '分镜二：下半身聚焦展示 (3-6s)', prompt: `${parsedPrompts['shot-2'] || '镜头向下推聚焦于下半身服饰'}, ${sceneDesc}. Medium shot focusing on the legs, waistline, and overall fit of the bottom pants/skirt.` },
            { type: 'shot-3' as const, name: '分镜三：口袋与裤腰剪裁特写 (6-9s)', prompt: `${parsedPrompts['shot-3'] || '聚焦于裤边或裙摆的线脚细节'}, ${sceneDesc}. Close-up of the waist, pockets, hem, or seams of the bottom pants/skirt.` },
            { type: 'shot-4' as const, name: '分镜四：腿部走动垂坠感特写 (9-12s)', prompt: `${parsedPrompts['shot-4']}, ${sceneDesc}. Medium close-up of the bottom pants/skirt showing drape and movement.` },
            { type: 'shot-5' as const, name: '分镜五：全身定格聚焦下半截 (12-15s)', prompt: `${parsedPrompts['shot-5']}, ${sceneDesc}. Focus on the lower body showing the bottom pants/skirt.` }
          ];
        } else {
          shotsConfig = [
            { type: 'shot-1' as const, name: '分镜一：全身走秀出场 (0-3s)', prompt: `${parsedPrompts['shot-1']}, ${sceneDesc}` },
            { type: 'shot-2' as const, name: '分镜二：下半身聚焦 (3-6s)', prompt: `${parsedPrompts['shot-2']}, ${sceneDesc}` },
            { type: 'shot-3' as const, name: '分镜三：手部捏褶细节 (6-9s)', prompt: `${parsedPrompts['shot-3']}, ${sceneDesc}` },
            { type: 'shot-4' as const, name: '分镜四：特写回拉全身 (9-12s)', prompt: `${parsedPrompts['shot-4']}, ${sceneDesc}` },
            { type: 'shot-5' as const, name: '分镜五：换景全身定格 (12-15s)', prompt: `${parsedPrompts['shot-5']}, ${sceneDesc}` }
          ];
        }
      } else {
        if (focus === 'top') {
          shotsConfig = [
            { type: 'full-body' as const, name: '分镜一：全身展示 (0-4s)', prompt: `${i2vPrompts['full-body']}, ${sceneDesc}. Showcasing the model wearing the top clothing.` },
            { type: 'medium' as const, name: '分镜二：上半身中景 (4-8s)', prompt: `${i2vPrompts['medium']}, ${sceneDesc}. Focus on the upper body and design of the top clothing.` },
            { type: 'close-up' as const, name: '分镜三：领口/材质特写 (8-12s)', prompt: `${i2vPrompts['close-up']}, ${sceneDesc}. Extreme close-up of the top fabric texture, seams, and details.` }
          ];
        } else if (focus === 'bottom') {
          shotsConfig = [
            { type: 'full-body' as const, name: '分镜一：全身展示 (0-4s)', prompt: `${i2vPrompts['full-body']}, ${sceneDesc}. Showcasing the model wearing the bottom pants/skirt.` },
            { type: 'medium' as const, name: '分镜二：下半身聚焦 (4-8s)', prompt: `${i2vPrompts['medium']}, ${sceneDesc}. Focus on the lower body and layout of the bottom pants/skirt.` },
            { type: 'close-up' as const, name: '分镜三：裤边/裙脚特写 (8-12s)', prompt: `${i2vPrompts['close-up']}, ${sceneDesc}. Extreme close-up of the bottom pants/skirt stitching, texture, and hem.` }
          ];
        } else {
          shotsConfig = [
            { type: 'full-body' as const, name: '分镜一：全身展示 (0-4s)', prompt: `${i2vPrompts['full-body']}, ${sceneDesc}` },
            { type: 'medium' as const, name: '分镜二：半身中景 (4-8s)', prompt: `${i2vPrompts['medium']}, ${sceneDesc}` },
            { type: 'close-up' as const, name: '分镜三：细节特写 (8-12s)', prompt: `${i2vPrompts['close-up']}, ${sceneDesc}` }
          ];
        }
      }

      let stylingInfo = '';
      if (matchingItemDesc.trim()) stylingInfo += ` Outfit styling match: ${matchingItemDesc.trim()}.`;
      if (shoesDesc.trim()) stylingInfo += ` Footwear styling: ${shoesDesc.trim()}.`;
      if (accessoriesDesc.trim()) {
        stylingInfo += ` Accessories/bags: ${accessoriesDesc.trim()}. Note: Only show the accessory/bag in the full-body panel (Panel 1); other panels (Panel 2, 3, 4, 5) which are medium or close-up views must not show any bag or handbag.`;
      }

      let isSpatialBackground = false;
      let slicedBackgrounds: string[] = [];
      if (activeBackgroundUrl) {
        try {
          const sliced = await checkAndSliceBackground(activeBackgroundUrl);
          if (sliced && sliced.length === 3) {
            isSpatialBackground = true;
            slicedBackgrounds = shotsConfig.map((_, idx) => sliced[idx % 3]);
            console.log('Successfully pre-sliced background image into 3 panels for parallel mode');
          }
        } catch (err) {
          console.warn('Failed to pre-slice spatial background:', err);
        }
      }

      const isSlice = storyboardMode === 'composite_slice';
      const isNoSlice = storyboardMode === 'composite_no_slice';
      const isComposite = (isSlice || isNoSlice) && !isSpatialBackground;

      if (isSpatialBackground && (isSlice || isNoSlice)) {
        alert('💡 检测到您选用了包含 3 个画面的空间场景模板。\n为了保证分镜背景不错位，系统已自动采用【多图并行生成模式】（依次为各个分镜分配对应的子场景画面）。');
      }

      const effectiveModelUrl = modelOutfitImgUrls[0] || modelOutfitImgUrl || swapModelUrl;
      const outfitRefNote = (modelOutfitImgUrls.length > 0 || modelOutfitImgUrl)
        ? ' IMPORTANT: The model reference image(s) provided show the complete character wearing the outfits in different views/poses. Use the character appearance, face, body proportions, and complete outfits exactly as shown in the model reference image(s) to guarantee strict consistency across the storyboard panels.'
        : '';

      if (isNoSlice) {
        const initialStoryboards = [{
          id: `storyboard_shot_composite_${Date.now()}`,
          name: `${videoDuration === '15s' || videoDuration === '3s' ? '15秒' : '12秒'} 分镜合集 (16:9整图)`,
          shotType: 'shot-1' as const,
          imageSrc: effectiveModelUrl,
          videoSrc: null,
          isGeneratingVideo: false,
          progress: 0,
          isGeneratingImage: true
        }];
        setProjectStoryboards(currentProjId, initialStoryboards);
      } else {
        const initialStoryboards = shotsConfig.map((shot, idx) => {
          const outfitIndex = getOutfitIndexForShot(idx, shotsConfig.length, referenceOutfitUrls.length);
          const initialImg = modelOutfitImgUrls[outfitIndex] || referenceOutfitUrls[outfitIndex] || swapModelUrl;
          return {
            id: `storyboard_shot_${idx}_${Date.now()}`,
            name: shot.name,
            shotType: shot.type,
            imageSrc: initialImg,
            videoSrc: null,
            isGeneratingVideo: false,
            progress: 0,
            isGeneratingImage: true
          };
        });
        setProjectStoryboards(currentProjId, initialStoryboards);
      }

      let generatedImages: string[] = [];

      if (gatewayUrl && gatewayToken) {
        if (isComposite) {
          const numPanels = shotsConfig.length;
          const panelsPromptList = shotsConfig.map((shot, idx) => `Panel ${idx + 1}: ${shot.prompt}`).join('. ');
          const compositePromptText = `A premium quality ${isNoSlice ? '16:9' : 'multi-panel'} fashion storyboard, arranged side-by-side as a single horizontal comic strip with exactly ${numPanels} equal columns/panels. The panels must be clearly separated and show different views of the same model and outfit in a consistent setting: ${sceneDesc}.
          Here are the descriptions for each panel from left to right:
          ${panelsPromptList}
          High-fidelity garment texture transfer, realistic drapery, correct drapery and fit. Detailed skin, natural lighting.${stylingInfo}${outfitRefNote} Strict Outfit Consistency Rule: The model's complete outfit combination (including bottom pants/shorts/skirt, footwear, and any accessories) must remain strictly identical, consistent, and completely unchanged across all views, crops, and angles. The entire outfit must be a single, cohesive, identical set. No text or captions. There must be absolutely no text, writing, labels, titles, annotations, letters, numbers, panel names, or captions on any part of the image. Strict Anatomy & Border Integrity Rule: Each panel must be an independent, clean shot of the model. Strictly prevent duplicate limbs, extra hands, floating fingers, or overlapping arms. Each individual panel must depict exactly one model with anatomically correct posture and exactly two hands. Do not allow any body parts, hands, arms, or accessories to cross, bleed, or overlap across the vertical borders separating the panels. Keep the panel margins and borders clean, sharp, and empty.${focusPrompt}`;

          const modelUrls = modelOutfitImgUrls.length > 0 
            ? modelOutfitImgUrls 
            : (modelOutfitImgUrl ? [modelOutfitImgUrl] : [swapModelUrl]);

          let generatedCompositeUrl = '';
          try {
            if (cancelledProjectsRef.current[currentProjId]) {
              throw new Error('USER_CANCELLED');
            }
            generatedCompositeUrl = await generateTryOnImage({
              clothingUrl: mainClothing,
              clothingBottomUrl: bottomClothing || undefined,
              modelUrl: modelUrls,
              gender: modelGender,
              region: modelRegion,
              scene: (modelScene === 'street' || modelScene === 'studio' || modelScene === 'home' || modelScene === 'office' || modelScene === 'beach' || modelScene === 'runway' || modelScene === 'minimalist') ? (modelScene as any) : 'studio',
              ratio: isNoSlice ? '16-9' : '1-1',
              gatewayUrl,
              gatewayToken,
              customPrompt: compositePromptText,
              backgroundImageUrl: activeBackgroundUrl
            });
            if (cancelledProjectsRef.current[currentProjId]) {
              throw new Error('USER_CANCELLED');
            }
          } catch (err: any) {
            if (err.message === 'USER_CANCELLED') throw err;
            console.error('Failed to generate composite storyboard image:', err);
            throw new Error(`生成分镜合集图失败: ${err.message}`);
          }

          if (isNoSlice) {
            setProjectStoryboards(currentProjId, [{
              id: `storyboard_shot_composite_${Date.now()}`,
              name: `${videoDuration === '15s' || videoDuration === '3s' ? '15秒' : '12秒'} 分镜合集 (16:9整图)`,
              shotType: 'shot-1' as const,
              imageSrc: generatedCompositeUrl,
              videoSrc: null,
              isGeneratingVideo: false,
              progress: 0,
              isGeneratingImage: false
            }]);
          } else {
            let slicedUrls: string[] = [];
            try {
              slicedUrls = await sliceStoryboardImage(generatedCompositeUrl, numPanels, 'horizontal');
            } catch (sliceErr) {
              console.warn('Failed to slice composite storyboard image, falling back to cloning:', sliceErr);
              slicedUrls = shotsConfig.map(() => generatedCompositeUrl);
            }

            if (cancelledProjectsRef.current[currentProjId]) {
              throw new Error('USER_CANCELLED');
            }

            setProjectStoryboards(currentProjId, prev =>
              prev.map((s, idx) => ({
                ...s,
                imageSrc: slicedUrls[idx] || generatedCompositeUrl,
                isGeneratingImage: false
              }))
            );
          }
        } else {
          // Parallel Multi-Image Mode
          if (activeBackgroundUrl && slicedBackgrounds.length === 0) {
            try {
              const sliced = await checkAndSliceBackground(activeBackgroundUrl);
              if (sliced && sliced.length === 3) {
                slicedBackgrounds = shotsConfig.map((_, idx) => sliced[idx % 3]);
                console.log('Successfully sliced background image into 3 panels and mapped to shots');
              }
            } catch (err) {
              console.warn('Failed to slice background image, using original background:', err);
            }
          }

          const generationPromises = shotsConfig.map(async (shot, i) => {
            if (cancelledProjectsRef.current[currentProjId]) {
              throw new Error('USER_CANCELLED');
            }

            const outfitIndex = getOutfitIndexForShot(i, shotsConfig.length, referenceOutfitUrls.length);
            const currentModelOutfitImg = modelOutfitImgUrls[outfitIndex];
            const currentReferenceOutfit = referenceOutfitUrls[outfitIndex];

            const currentMainClothing = currentReferenceOutfit || topClothingUrl || bottomClothingUrl || currentSrc || '';
            const currentBottomClothing = currentReferenceOutfit ? undefined : (topClothingUrl ? bottomClothingUrl : undefined);
            const currentBackgroundUrl = slicedBackgrounds[i] || activeBackgroundUrl || undefined;

            let clothingUrlPayload;
            let modelUrlPayload;
            let bottomUrlPayload;

            if (currentModelOutfitImg) {
              clothingUrlPayload = currentModelOutfitImg;
              modelUrlPayload = swapModelUrl;
              bottomUrlPayload = undefined;
            } else {
              clothingUrlPayload = currentMainClothing;
              modelUrlPayload = swapModelUrl;
              bottomUrlPayload = currentBottomClothing || undefined;
            }

            const currentOutfitRefNote = currentModelOutfitImg
              ? ' IMPORTANT: The model reference image (图1) already shows the complete character wearing the full outfit. Use the character appearance, face, body proportions, and complete outfit exactly as shown in the model reference image (图1).'
              : '';

            const bgIndex = 3 + (bottomUrlPayload ? 1 : 0);
            const currentSceneDesc = currentBackgroundUrl
              ? `the setting shown in the background reference image (图${bgIndex})`
              : sceneDesc;

            const isFullBody = shot.type === 'full-body' || shot.type === 'shot-1';
            let currentStylingInfo = '';
            if (matchingItemDesc.trim()) currentStylingInfo += ` Outfit styling match: ${matchingItemDesc.trim()}.`;
            if (shoesDesc.trim()) currentStylingInfo += ` Footwear styling: ${shoesDesc.trim()}.`;
            if (isFullBody && accessoriesDesc.trim()) {
              currentStylingInfo += ` Accessories/bags: ${accessoriesDesc.trim()}. The model should carry or wear the accessory naturally if the pose permits.`;
            } else if (!isFullBody) {
              currentStylingInfo += ` No bags or handbags should be visible in this view.`;
            }

            const customPromptText = `A premium quality fashion portrait shot. A high-resolution cinematic photo of the same professional ${regionStr} ${genderStr} model from the target model reference image (图${bgIndex - 1}) wearing the clothing item(s) provided. The model must be posing elegantly in the following setting: ${currentSceneDesc}. Specifying view details: ${shot.prompt}. High-fidelity garment texture transfer, realistic drapery, correct drapery and fit. Detailed skin, natural lighting.${currentStylingInfo}${currentOutfitRefNote} Strict Face and Character Consistency Rule: The model's face, eyes, lips, nose, hair style, hair color, skin tone, facial features, body proportions, and overall identity must remain strictly identical, consistent, and completely unchanged, matching the target model reference image (图${bgIndex - 1}) exactly. The generated image must depict the exact same person with the identical face from the target model reference image (图${bgIndex - 1}). Strict Model Reference Rule: The model reference image (图${bgIndex - 1}) is ONLY used to reference the model's face, facial features, hair style, hair color, skin tone, and body features. Do NOT reference or copy the clothing, outfit, colors, or fabrics from the model reference image (图${bgIndex - 1}). The outfit must be strictly copied and transferred from the clothing reference image (图1) instead. Strict Outfit Consistency Rule: The model's complete outfit combination (including bottom pants/shorts/skirt, footwear, and any accessories) must remain strictly identical, consistent, and completely unchanged across all views, crops, and angles. The entire outfit must be a single, cohesive, identical set. No text or captions. There must be absolutely no text, writing, labels, titles, annotations, letters, numbers, or captions on any part of the image. Strict Anatomy Rule: Strictly prevent duplicate limbs, extra hands, floating fingers, or overlapping arms. The model must have anatomically correct posture and exactly two hands. Strict Single Panel Rule: The image must be a single, complete, unified photograph showing one single view of the model. Do not split, cut, divide, or slice the image into multiple columns, grids, panels, or separate boxes. Strictly prevent any borders, partitions, or line dividers within the image. Strict Background Consistency Rule: The background of the generated image must strictly and exactly match the provided background reference image (图${bgIndex}) in every single pixel, detail, color, furniture, layout, texture, and structure. Do not alter, regenerate, modify, or add any new elements to the background. The model must be seamlessly integrated into the exact background provided.${focusPrompt}`;

            let imgUrl = currentModelOutfitImg || swapModelUrl;
            try {
              imgUrl = await generateTryOnImage({
                clothingUrl: clothingUrlPayload,
                clothingBottomUrl: bottomUrlPayload,
                modelUrl: modelUrlPayload,
                gender: modelGender,
                region: modelRegion,
                scene: (modelScene === 'street' || modelScene === 'studio' || modelScene === 'home' || modelScene === 'office' || modelScene === 'beach' || modelScene === 'runway' || modelScene === 'minimalist') ? (modelScene as any) : 'studio',
                ratio,
                gatewayUrl,
                gatewayToken,
                customPrompt: customPromptText,
                backgroundImageUrl: currentBackgroundUrl
              });
            } catch (err: any) {
              if (err.message === 'USER_CANCELLED') throw err;
              console.warn(`Gateway call failed in I2V storyboard generation for ${shot.name}, falling back:`, err);
            }

            if (cancelledProjectsRef.current[currentProjId]) {
              throw new Error('USER_CANCELLED');
            }

            setProjectStoryboards(currentProjId, prev =>
              prev.map((s, idx) => idx === i ? { ...s, imageSrc: imgUrl, isGeneratingImage: false } : s)
            );
            generatedImages.push(imgUrl);
          });

          await Promise.all(generationPromises);
        }
      } else {
        // Mockup mode
        if (isNoSlice) {
          if (cancelledProjectsRef.current[currentProjId]) {
            throw new Error('USER_CANCELLED');
          }
          await new Promise(resolve => setTimeout(resolve, 800));
          if (cancelledProjectsRef.current[currentProjId]) {
            throw new Error('USER_CANCELLED');
          }
          setProjectStoryboards(currentProjId, prev =>
            prev.map(s => ({ ...s, isGeneratingImage: false }))
          );
        } else {
          for (let i = 0; i < shotsConfig.length; i++) {
            if (cancelledProjectsRef.current[currentProjId]) {
              throw new Error('USER_CANCELLED');
            }
            await new Promise(resolve => setTimeout(resolve, 800));
            if (cancelledProjectsRef.current[currentProjId]) {
              throw new Error('USER_CANCELLED');
            }
            setProjectStoryboards(currentProjId, prev =>
              prev.map((s, idx) => idx === i ? { ...s, isGeneratingImage: false } : s)
            );
          }
        }
      }

      setProjectI2vStep(currentProjId, 'storyboard_generated');
      setProjectIsStoryboardGenerating(currentProjId, false);
      setModelSwapRunning(false);
      alert('分镜故事板静态画面生成成功！下一步请调用「图生视频大模型」进行动态分镜渲染。');
    } catch (error: any) {
      setProjectIsStoryboardGenerating(currentProjId, false);
      setModelSwapRunning(false);
      setProjectStoryboards(currentProjId, prev => prev.map(s => ({ ...s, isGeneratingImage: false })));
      if (error.message === 'USER_CANCELLED') {
        console.log('Storyboard generation was cancelled by the user.');
        return;
      }
      console.error(error);
      alert(`分镜静态画面生成失败: ${error.message}`);
    }
  };

  const handleGenerateStoryboards = async () => {
    const currentProjId = activeProjectId;
    if (!currentProjId) return;

    const projectObj = projects.find(p => p.id === currentProjId);
    if (projectObj && projectObj.isStoryboardGenerating) {
      cancelledProjectsRef.current[currentProjId] = true;
      setProjectIsStoryboardGenerating(currentProjId, false);
      setModelSwapRunning(false);
      setProjectStoryboards(currentProjId, prev => prev.map(s => ({ ...s, isGeneratingImage: false })));
      return;
    }

    if (!topClothingUrl && !bottomClothingUrl) {
      setClothingFocusModalOpen(true);
    } else {
      let autoFocus: 'top' | 'bottom' | 'both' = 'both';
      if (topClothingUrl && !bottomClothingUrl) {
        autoFocus = 'top';
      } else if (!topClothingUrl && bottomClothingUrl) {
        autoFocus = 'bottom';
      }
      executeGenerateStoryboards(autoFocus);
    }
  };

  const handleGenerateI2V = async () => {
    const currentProjId = activeProjectId;
    if (!currentProjId) return;

    const projectObj = projects.find(p => p.id === currentProjId);
    if (!projectObj) return;

    if (projectObj.isI2vGenerating) {
      cancelledProjectsRef.current[currentProjId] = true;
      setProjectIsI2vGenerating(currentProjId, false);
      return;
    }

    const projectStoryboards = projectObj.storyboards;
    if (projectStoryboards.length === 0) {
      alert('请先完成步骤 1，生成分镜故事板！');
      return;
    }

    if (!gatewayVideoUrl.trim()) {
      alert('请先在底部的「AI 网关配置」中输入您的 AI 视频生成网关地址！');
      setShowConfig(true);
      return;
    }
    if (!gatewayVideoToken.trim()) {
      alert('请先在底部的「AI 网关配置」中输入您的视频网关 API Token！');
      setShowConfig(true);
      return;
    }

    setProjectIsI2vGenerating(currentProjId, true);
    cancelledProjectsRef.current[currentProjId] = false;
    try {
      const activeStoryboards = projectStoryboards;

      if (videoModel === 'kling-v3-omni' && (videoDuration === '15s' || videoDuration === '3s') && storyboardMode !== 'individual') {
        // ----------------------------------------------------
        // Kling-v3-omni 15s/3s Mode: Single Task with 6 images
        // ----------------------------------------------------
        setProjectStoryboards(currentProjId, prev => prev.map(s => ({ ...s, isGeneratingVideo: true, progress: 5 })));

        let sizeStr = '720p';
        const customSceneObj = customScenes.find(s => s.id === modelScene);
        const sceneDesc = SCENE_PROMPT_DESCRIPTIONS[modelScene as keyof typeof SCENE_PROMPT_DESCRIPTIONS]
          || (customSceneObj ? `posing in a custom scene: ${customSceneObj.name}` : 'posing in a matching catalog studio setting');

        const secondsNum = videoDuration === '15s' ? 15 : 3;
        const apiAspectRatio = ratio === '9-16' ? '9:16' : ratio === '3-4' ? '3:4' : '1:1';

        let promptText = '';
        if (secondsNum === 15) {
          promptText = `Referencing 图1 (outfit model) as the strict character consistency reference. Referencing 图2, 图3, 图4, 图5, and 图6 as the storyboard sequence references for each respective shot.`;
          if (activeBackgroundUrl) {
            promptText += ` Referencing 图7 (scene template) to lock background scene consistency.`;
          }
        } else {
          // 3s composite mode: only outfit model, composite image, and scene background are sent (3 images)
          promptText = `Referencing 图1 (outfit model) as the strict character consistency reference, and referencing 图2 (16:9 composite storyboard image) as the layout and pose references for each frame.`;
          if (activeBackgroundUrl) {
            promptText += ` Referencing 图3 (scene template) to lock background scene consistency.`;
          }
        }

        promptText += ` ${i2vMasterPrompt15s}。The background scene environment is: ${sceneDesc}. A high-end cinematic fashion commercial blockbuster style. The camera performs slow-motion elegant operations like dolly zoom, slow panning, or orbital rotation. The model performs high-fashion micro-movements with subtle elegant posture adjustments, keeping action amplitude small and natural. Premium Vogue-style chiaroscuro studio lighting, highly detailed skin textures, realistic fabric folds, smooth continuous motion, 8k resolution, cinematic color grading.`;

        if (activeBackgroundUrl) {
          if (secondsNum === 15) {
            promptText += ` The background scene, environment layout, colors, and lighting of the generated video must remain strictly identical and consistent with the provided scene reference image (图7). Keep the background completely stable and unchanged.`;
          } else {
            promptText += ` The background scene, environment layout, colors, and lighting of the generated video must remain strictly identical and consistent with the provided scene reference image (图3). Keep the background completely stable and unchanged.`;
          }
        }

        console.log(`[Video Task Triggered] Composite Mode, Duration: ${videoDuration}`);
        console.log(`[Video Task Payload]`, {
          model: videoModel,
          prompt: promptText,
          imageSrc: activeStoryboards[0].imageSrc,
          modelOutfitImgUrl: modelOutfitImgUrl || swapModelUrl || undefined,
          storyboardImgUrls: activeStoryboards.map(s => s.imageSrc),
          sceneImgUrl: activeBackgroundUrl || undefined,
          seconds: secondsNum,
          size: sizeStr,
          aspectRatio: apiAspectRatio
        });

        const taskId = await generateVideoTask({
          model: videoModel,
          prompt: promptText,
          imageSrc: activeStoryboards[0].imageSrc,
          modelOutfitImgUrl: modelOutfitImgUrl || swapModelUrl || undefined,
          storyboardImgUrls: activeStoryboards.map(s => s.imageSrc),
          sceneImgUrl: activeBackgroundUrl || undefined,
          seconds: secondsNum,
          size: sizeStr,
          aspectRatio: apiAspectRatio,
          gatewayUrl: gatewayVideoUrl,
          gatewayToken: gatewayVideoToken
        });

        setProjectStoryboards(currentProjId, prev => prev.map(s => ({ ...s, videoTaskId: taskId })));

        // Poll Video Generation Task status
        let isCompleted = false;
        let pollCount = 0;
        const pollIntervalMs = 4000;
        const maxPolls = 300;

        while (!isCompleted && pollCount < maxPolls) {
          if (cancelledProjectsRef.current[currentProjId]) {
            throw new Error('user_cancelled');
          }
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
          if (cancelledProjectsRef.current[currentProjId]) {
            throw new Error('user_cancelled');
          }
          pollCount++;

          try {
            const pollRes = await pollVideoTask(gatewayVideoUrl, gatewayVideoToken, taskId);

            if (pollRes.status === 'completed') {
              isCompleted = true;
              setProjectStoryboards(currentProjId, prev => prev.map(s => ({ ...s, progress: 95 })));
            } else if (pollRes.status === 'failed') {
              throw new Error(pollRes.error || '视频生成模型内部错误导致生成失败');
            } else {
              const estimatedDuration = 100;
              const calculatedProgress = Math.min(5 + Math.floor((pollCount / estimatedDuration) * 85), 90);
              setProjectStoryboards(currentProjId, prev => prev.map(s => ({ ...s, progress: calculatedProgress })));
            }
          } catch (pollErr: any) {
            if (pollErr.message && (pollErr.message.includes('生成失败') || pollErr.message.includes('failed'))) {
              throw pollErr;
            }
            console.warn(`[Poll Warning] Attempt ${pollCount} failed:`, pollErr);
          }
        }

        if (!isCompleted) {
          throw new Error('视频生成任务超时，请重试');
        }

        if (cancelledProjectsRef.current[currentProjId]) {
          throw new Error('user_cancelled');
        }

        const videoBlob = await getVideoContent(gatewayVideoUrl, gatewayVideoToken, taskId);
        const localVideoUrl = URL.createObjectURL(videoBlob);

        setProjectStoryboards(currentProjId, prev => prev.map(s => ({
          ...s,
          isGeneratingVideo: false,
          progress: 100,
          videoSrc: localVideoUrl,
          videoBlob: videoBlob
        })));
      } else {
        // ----------------------------------------------------
        // Standard Multi-Task Stitching Parallel Mode (Veo/MiniMax/Vidu/4s)
        // ----------------------------------------------------
        const tasks = activeStoryboards.map(async (shot) => {
          const shotId = shot.id;
          setProjectStoryboards(currentProjId, prev => prev.map(s => s.id === shotId ? { ...s, isGeneratingVideo: true, progress: 5 } : s));

          let sizeStr = '720p';
          if (videoModel.includes('MiniMax')) {
            sizeStr = '768P';
          } else if (videoModel.includes('sora')) {
            sizeStr = '1280x720';
          } else if (videoModel.includes('veo')) {
            sizeStr = '720p';
          } else {
            sizeStr = '720p';
          }

          const customSceneObj = customScenes.find(s => s.id === modelScene);
          const sceneDesc = SCENE_PROMPT_DESCRIPTIONS[modelScene as keyof typeof SCENE_PROMPT_DESCRIPTIONS]
            || (customSceneObj ? `posing in a custom scene: ${customSceneObj.name}` : 'posing in a matching catalog studio setting');
          const parsedPrompts = parse15sMasterPrompt(i2vMasterPrompt15s);
          const userPrompt = (videoDuration === '15s' || videoDuration === '3s')
            ? (parsedPrompts[shot.shotType as keyof typeof parsedPrompts] || '')
            : (i2vPrompts[shot.shotType as keyof typeof i2vPrompts] || '');

          let rewrittenUserPrompt = userPrompt;
          rewrittenUserPrompt = rewrittenUserPrompt.replace(/图[2-6]/g, '图2').replace(/Image\s*[2-6]/gi, 'Image 2');
          rewrittenUserPrompt = rewrittenUserPrompt.replace(/图7/g, '图3').replace(/Image\s*7/gi, 'Image 3');

          let promptText = '';
          if (videoModel.includes('veo')) {
            promptText = `${rewrittenUserPrompt}，背景场景环境为：${sceneDesc}，高端商业时装大片电影质感。采用极其缓慢优雅的推近、拉远或轨道环绕等电影级运镜。模特采取高级微动态（如肩膀微调、眼神微转、深呼吸），动作幅度小而极具张力，展示衣服材质纹理与垂坠感。明暗对比强烈的高级影棚光，画面高清稳定，质感高级。`;
            if (activeBackgroundUrl) {
              promptText += ` 生成的视频背景和环境光影必须与提供的场景参考图完全一致，保持背景静止与稳定。`;
            }
          } else {
            promptText = `Referencing 图1 (outfit model) as the strict character consistency reference, and referencing 图2 (storyboard frame) as the first-frame layout and pose.`;
            if (activeBackgroundUrl) {
              promptText += ` Referencing 图3 (scene template) to lock background scene consistency.`;
            }
            promptText += ` ${rewrittenUserPrompt}。The background scene environment is: ${sceneDesc}. A high-end cinematic fashion commercial blockbuster style. The camera performs slow-motion elegant operations like dolly zoom, slow panning, or orbital rotation. The model performs high-fashion micro-movements with subtle elegant posture adjustments, keeping action amplitude small and natural. Premium Vogue-style chiaroscuro studio lighting, highly detailed skin textures, realistic fabric folds, smooth continuous motion, 8k resolution, cinematic color grading.`;
            
            if (activeBackgroundUrl) {
              promptText += ` The background scene, environment layout, colors, and lighting of the generated video clip must strictly match and remain consistent with the provided scene background reference image (图3). Keep the background stable.`;
            }
          }

          const apiAspectRatio = ratio === '9-16' ? '9:16' : ratio === '3-4' ? '3:4' : '1:1';

          const secondsNum = (videoDuration === '15s' || videoDuration === '3s') ? 3 : 4;

          console.log(`[Video Task Triggered] Individual Shot Mode, Shot: ${shot.name}, Duration: ${videoDuration}`);
          console.log(`[Video Task Payload]`, {
            model: videoModel,
            prompt: promptText,
            imageSrc: shot.imageSrc,
            modelOutfitImgUrl: modelOutfitImgUrl || swapModelUrl || undefined,
            sceneImgUrl: activeBackgroundUrl || undefined,
            seconds: secondsNum,
            size: sizeStr,
            aspectRatio: apiAspectRatio
          });

          const taskId = await generateVideoTask({
            model: videoModel,
            prompt: promptText,
            imageSrc: shot.imageSrc,
            modelOutfitImgUrl: modelOutfitImgUrl || swapModelUrl || undefined,
            sceneImgUrl: activeBackgroundUrl || undefined,
            seconds: secondsNum,
            size: sizeStr,
            aspectRatio: apiAspectRatio,
            gatewayUrl: gatewayVideoUrl,
            gatewayToken: gatewayVideoToken
          });

          setProjectStoryboards(currentProjId, prev => prev.map(s => s.id === shotId ? { ...s, videoTaskId: taskId } : s));

          let isCompleted = false;
          let pollCount = 0;
          const pollIntervalMs = videoModel.includes('veo') ? 4000 : 3000;
          const maxPolls = (videoDuration === '15s' || videoDuration === '3s') ? 300 : (videoModel.includes('veo') ? 150 : 200);

          while (!isCompleted && pollCount < maxPolls) {
            if (cancelledProjectsRef.current[currentProjId]) {
              throw new Error('user_cancelled');
            }
            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
            if (cancelledProjectsRef.current[currentProjId]) {
              throw new Error('user_cancelled');
            }
            pollCount++;

            try {
              const pollRes = await pollVideoTask(gatewayVideoUrl, gatewayVideoToken, taskId);

              if (pollRes.status === 'completed') {
                isCompleted = true;
                setProjectStoryboards(currentProjId, prev => prev.map(s => s.id === shotId ? { ...s, progress: 95 } : s));
              } else if (pollRes.status === 'failed') {
                throw new Error(pollRes.error || '视频生成模型内部错误导致生成失败');
              } else {
                const estimatedDuration = videoDuration === '15s' ? 100 : (videoModel.includes('veo') ? 60 : 20);
                const calculatedProgress = Math.min(5 + Math.floor((pollCount / estimatedDuration) * 85), 90);
                setProjectStoryboards(currentProjId, prev => prev.map(s => s.id === shotId ? { ...s, progress: calculatedProgress } : s));
              }
            } catch (pollErr: any) {
              if (pollErr.message && (pollErr.message.includes('生成失败') || pollErr.message.includes('failed'))) {
                throw pollErr;
              }
              console.warn(`[Poll Warning] Attempt ${pollCount} failed:`, pollErr);
            }
          }

          if (!isCompleted) {
            throw new Error('视频生成任务超时，请重试');
          }

          if (cancelledProjectsRef.current[currentProjId]) {
            throw new Error('user_cancelled');
          }

          const videoBlob = await getVideoContent(gatewayVideoUrl, gatewayVideoToken, taskId);
          const localVideoUrl = URL.createObjectURL(videoBlob);

          setProjectStoryboards(currentProjId, prev => prev.map(s => s.id === shotId ? { ...s, isGeneratingVideo: false, progress: 100, videoSrc: localVideoUrl, videoBlob: videoBlob } : s));
        });

        await Promise.all(tasks);
      }

      setProjectI2vStep(currentProjId, 'video_generated');
      alert((videoDuration === '15s' || videoDuration === '3s')
        ? '15s分镜拼接视频生成成功！已为 5 段镜头生成动态视频片段，请点击步骤 3 拼装导入时间轴播放。'
        : '图生视频模型调用成功！已为所有分镜生成动态视频片段，请点击步骤 3 拼装导入时间轴播放。');
    } catch (err: any) {
      if (err.message === 'user_cancelled') {
        alert('视频生成已成功中断。');
      } else {
        console.error(err);
        alert(`图生视频失败: ${err.message}`);
      }
      setProjectStoryboards(currentProjId, prev => prev.map(s => s.isGeneratingVideo ? { ...s, isGeneratingVideo: false, progress: 0 } : s));
    } finally {
      setProjectIsI2vGenerating(currentProjId, false);
      cancelledProjectsRef.current[currentProjId] = false;
    }
  };

  const handleRegenerateStoryboardVideo = async (sbId: string) => {
    const currentProjId = activeProjectId;
    if (!currentProjId) return;

    const projectObj = projects.find(p => p.id === currentProjId);
    if (!projectObj) return;

    const sb = projectObj.storyboards.find(s => s.id === sbId);
    if (!sb) return;

    if (!gatewayVideoUrl.trim() || !gatewayVideoToken.trim()) {
      alert('请先在底部的「AI 网关配置」中输入您的视频网关地址与 Token！');
      setShowConfig(true);
      return;
    }

    // Set generating state for this specific storyboard card
    setProjectStoryboards(currentProjId, prev =>
      prev.map(s => s.id === sbId ? { ...s, isGeneratingVideo: true, progress: 5 } : s)
    );

    try {
      let sizeStr = '720p';
      if (videoModel.includes('MiniMax')) {
        sizeStr = '768P';
      } else if (videoModel.includes('sora')) {
        sizeStr = '1280x720';
      } else if (videoModel.includes('veo')) {
        sizeStr = '720p';
      }

      const customSceneObj = customScenes.find(s => s.id === modelScene);
      const sceneDesc = SCENE_PROMPT_DESCRIPTIONS[modelScene as keyof typeof SCENE_PROMPT_DESCRIPTIONS]
        || (customSceneObj ? `posing in a custom scene: ${customSceneObj.name}` : 'posing in a matching catalog studio setting');

      const parsedPrompts = parse15sMasterPrompt(i2vMasterPrompt15s);
      const userPrompt = (videoDuration === '15s' || videoDuration === '3s')
        ? (parsedPrompts[sb.shotType as keyof typeof parsedPrompts] || '')
        : (i2vPrompts[sb.shotType as keyof typeof i2vPrompts] || '');

      let rewrittenUserPrompt = userPrompt;
      rewrittenUserPrompt = rewrittenUserPrompt.replace(/图[2-6]/g, '图2').replace(/Image\s*[2-6]/gi, 'Image 2');
      rewrittenUserPrompt = rewrittenUserPrompt.replace(/图7/g, '图3').replace(/Image\s*7/gi, 'Image 3');

      let promptText = '';
      if (videoModel.includes('veo')) {
        promptText = `${rewrittenUserPrompt}，背景场景环境为：${sceneDesc}，高端商业时装大片电影质感。采用极其缓慢优雅的推近、拉远或轨道环绕等电影级运镜。模特采取高级微动态（如肩膀微调、眼神微转、深呼吸），动作幅度小而极具张力，展示衣服材质纹理与垂坠感。明暗对比强烈的高级影棚光，画面高清稳定，质感高级。`;
        if (activeBackgroundUrl) {
          promptText += ` 生成的视频背景和环境光影必须与提供的场景参考图完全一致，保持背景静止与稳定。`;
        }
      } else {
        promptText = `Referencing 图1 (outfit model) as the strict character consistency reference, and referencing 图2 (storyboard frame) as the first-frame layout and pose.`;
        if (activeBackgroundUrl) {
          promptText += ` Referencing 图3 (scene template) to lock background scene consistency.`;
        }
        promptText += ` ${rewrittenUserPrompt}。The background scene environment is: ${sceneDesc}. A high-end cinematic fashion commercial blockbuster style. The camera performs slow-motion elegant operations like dolly zoom, slow panning, or orbital rotation. The model performs high-fashion micro-movements with subtle elegant posture adjustments, keeping action amplitude small and natural. Premium Vogue-style chiaroscuro studio lighting, highly detailed skin textures, realistic fabric folds, smooth continuous motion, 8k resolution, cinematic color grading.`;
        
        if (activeBackgroundUrl) {
          promptText += ` The background scene, environment layout, colors, and lighting of the generated video clip must strictly match and remain consistent with the provided scene background reference image (图3). Keep the background stable.`;
        }
      }

      // Check if we have sliced background
      let currentBackgroundUrl = activeBackgroundUrl || undefined;
      if (activeBackgroundUrl) {
        try {
          const index = projectObj.storyboards.findIndex(s => s.id === sbId);
          const sliced = await checkAndSliceBackground(activeBackgroundUrl);
          if (sliced && sliced.length === 3 && index !== -1) {
            currentBackgroundUrl = sliced[index % 3];
          }
        } catch (err) {
          console.warn('Failed to slice background during single video regeneration:', err);
        }
      }

      const apiAspectRatio = ratio === '9-16' ? '9:16' : ratio === '3-4' ? '3:4' : '1:1';
      const secondsNum = (videoDuration === '15s' || videoDuration === '3s') ? 3 : 4;

      console.log(`[Single Video Task Triggered] Shot: ${sb.name}, Duration: ${videoDuration}`);
      console.log(`[Single Video Task Payload]`, {
        model: videoModel,
        prompt: promptText,
        imageSrc: sb.imageSrc,
        modelOutfitImgUrl: modelOutfitImgUrl || swapModelUrl || undefined,
        sceneImgUrl: currentBackgroundUrl,
        seconds: secondsNum,
        size: sizeStr,
        aspectRatio: apiAspectRatio
      });

      const taskId = await generateVideoTask({
        model: videoModel,
        prompt: promptText,
        imageSrc: sb.imageSrc,
        modelOutfitImgUrl: modelOutfitImgUrl || swapModelUrl || undefined,
        sceneImgUrl: currentBackgroundUrl,
        seconds: secondsNum,
        size: sizeStr,
        aspectRatio: apiAspectRatio,
        gatewayUrl: gatewayVideoUrl,
        gatewayToken: gatewayVideoToken
      });

      // Update state with taskId
      setProjectStoryboards(currentProjId, prev =>
        prev.map(s => s.id === sbId ? { ...s, videoTaskId: taskId } : s)
      );

      // Poll task status
      let isCompleted = false;
      let pollCount = 0;
      const pollIntervalMs = videoModel.includes('veo') ? 4000 : 3000;
      const maxPolls = (videoDuration === '15s' || videoDuration === '3s') ? 300 : (videoModel.includes('veo') ? 150 : 200);

      while (!isCompleted && pollCount < maxPolls) {
        if (cancelledProjectsRef.current[currentProjId]) {
          throw new Error('user_cancelled');
        }
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        if (cancelledProjectsRef.current[currentProjId]) {
          throw new Error('user_cancelled');
        }
        pollCount++;

        try {
          const pollRes = await pollVideoTask(gatewayVideoUrl, gatewayVideoToken, taskId);
          if (pollRes.status === 'completed') {
            isCompleted = true;
            
            // Fetch video Blob and convert to local URL
            const videoBlob = await getVideoContent(gatewayVideoUrl, gatewayVideoToken, taskId);
            const localVideoUrl = URL.createObjectURL(videoBlob);
            setProjectStoryboards(currentProjId, prev =>
              prev.map(s => s.id === sbId ? { ...s, videoSrc: localVideoUrl, videoBlob: videoBlob, isGeneratingVideo: false, progress: 100 } : s)
            );
            
            // If the preview is currently showing this video, update the preview state
            setPreviewVideo(prev => prev && prev.id === sbId ? { ...prev, src: localVideoUrl } : prev);
          } else if (pollRes.status === 'failed') {
            throw new Error(pollRes.error || '视频生成模型内部错误导致生成失败');
          } else {
            const estimatedDuration = 100;
            const calculatedProgress = Math.min(5 + Math.floor((pollCount / estimatedDuration) * 90), 95);
            setProjectStoryboards(currentProjId, prev =>
              prev.map(s => s.id === sbId ? { ...s, progress: calculatedProgress } : s)
            );
          }
        } catch (pollErr: any) {
          if (pollErr.message && (pollErr.message.includes('生成失败') || pollErr.message.includes('failed'))) {
            throw pollErr;
          }
          console.warn(`[Poll Warning] Attempt ${pollCount} failed:`, pollErr);
        }
      }

      if (!isCompleted) {
        throw new Error('视频生成任务超时，请重试');
      }

      alert(`分镜「${sb.name}」视频重新生成成功！`);
    } catch (error: any) {
      console.error(error);
      setProjectStoryboards(currentProjId, prev =>
        prev.map(s => s.id === sbId ? { ...s, isGeneratingVideo: false, progress: 0 } : s)
      );
      if (error.message === 'user_cancelled') {
        alert('视频重新生成已被用户中断。');
      } else {
        alert(`分镜视频重新生成失败: ${error.message}`);
      }
    }
  };

  const handleRedownloadVideo = async (sbId: string, taskId: string) => {
    const currentProjId = activeProjectId;
    if (!currentProjId) return;

    try {
      if (!gatewayVideoUrl.trim() || !gatewayVideoToken.trim()) {
        alert('请先在底部的「AI 网关配置」中输入您的视频网关地址与 Token！');
        setShowConfig(true);
        return;
      }

      alert('开始从服务器重新拉取视频，请稍候...');

      const videoBlob = await getVideoContent(gatewayVideoUrl, gatewayVideoToken, taskId);
      const localVideoUrl = URL.createObjectURL(videoBlob);

      // Save to projects
      setProjects(prev => prev.map(p => {
        if (p.id !== currentProjId) return p;
        return {
          ...p,
          storyboards: p.storyboards.map(s => s.id === sbId ? {
            ...s,
            videoSrc: localVideoUrl,
            videoBlob: videoBlob,
            videoTaskId: taskId
          } : s)
        };
      }));

      // Sync active UI state
      setStoryboards(prev => prev.map(s => s.id === sbId ? {
        ...s,
        videoSrc: localVideoUrl,
        videoBlob: videoBlob,
        videoTaskId: taskId
      } : s));

      // If preview video is open, update its src
      setPreviewVideo(prev => prev && prev.id === sbId ? { ...prev, src: localVideoUrl } : prev);

      alert('视频拉取并下载成功！已替换当前分镜视频。');
    } catch (err: any) {
      console.error('Failed to redownload video:', err);
      alert(`拉取视频失败: ${err.message || err}`);
    }
  };

  const handleManualVideoUpload = async (sbId: string, file: File) => {
    const currentProjId = activeProjectId;
    if (!currentProjId) return;

    try {
      if (!file) return;
      const localVideoUrl = URL.createObjectURL(file);

      // Save to projects
      setProjects(prev => prev.map(p => {
        if (p.id !== currentProjId) return p;
        return {
          ...p,
          storyboards: p.storyboards.map(s => s.id === sbId ? {
            ...s,
            videoSrc: localVideoUrl,
            videoBlob: file
          } : s)
        };
      }));

      // Sync active UI state
      setStoryboards(prev => prev.map(s => s.id === sbId ? {
        ...s,
        videoSrc: localVideoUrl,
        videoBlob: file
      } : s));

      // If preview video is open, update its src
      setPreviewVideo(prev => prev && prev.id === sbId ? { ...prev, src: localVideoUrl } : prev);

      alert('本地视频上传替换成功！');
    } catch (err: any) {
      console.error('Failed to manually upload video:', err);
      alert(`替换视频失败: ${err.message || err}`);
    }
  };

  const handleApplyI2VToTimeline = () => {
    if (storyboards.length === 0 || storyboards.some(s => !s.videoSrc)) {
      alert('请先完成步骤 2 生成动态分镜视频！');
      return;
    }

    const logoId = `logo_i2v_${Date.now()}`;
    let newLayers: Layer[] = [];

    const firstBgm = bgmLibrary[0];
    const defaultBgmSrc = firstBgm?.src || 'fashion_beat.mp3';
    const defaultBgmName = firstBgm?.name || '动感电音卡点 BGM';

    if (videoDuration === '15s' || videoDuration === '3s') {
      // 15s / 3s 5-Segment Storyboard Stitching Mode
      const isKling15s = videoModel === 'kling-v3-omni' && storyboardMode !== 'individual';
      if (isKling15s) {
        newLayers = [
          // Single continuous video layer
          {
            id: `media_i2v_0_${Date.now()}`,
            type: 'media',
            name: '🎬 可灵15s合成视频',
            start: 0,
            end: 15,
            visible: true,
            x: 50,
            y: 50,
            scale: 1.0,
            opacity: 1,
            properties: {
              src: storyboards[0]?.videoSrc || '/video.mp4',
              isVideo: true,
              videoStartOffset: 0,
              videoEndOffset: 15
            }
          },
          // Background Beat Audio track (up to 15s)
          {
            id: `audio_i2v_${Date.now()}`,
            type: 'audio',
            name: defaultBgmName,
            start: 0,
            end: 15,
            visible: true,
            x: 0,
            y: 0,
            scale: 1,
            opacity: 1,
            properties: {
              src: defaultBgmSrc,
              volume: 0.8
            }
          },
          // Brand logo
          {
            id: logoId,
            type: 'media',
            name: '品牌 LOGO',
            start: 0,
            end: 1.5,
            visible: true,
            x: 50,
            y: 50,
            scale: 1.0,
            opacity: 1,
            properties: { src: '/logo.png', bgRemoved: false }
          }
        ];
      } else {
        newLayers = [
          // Shot 1: 0s to 3s (3 seconds)
          {
            id: `media_i2v_0_${Date.now()}`,
            type: 'media',
            name: '🎬 分镜一 (全身出场)',
            start: 0,
            end: 3,
            visible: true,
            x: 50,
            y: 50,
            scale: 1.0,
            opacity: 1,
            properties: {
              src: storyboards[0]?.videoSrc || '/video.mp4',
              isVideo: true,
              videoStartOffset: 0,
              videoEndOffset: 3
            }
          },
          // Shot 2: 3s to 6s (3 seconds)
          {
            id: `media_i2v_1_${Date.now()}`,
            type: 'media',
            name: '🎬 分镜二 (下身聚焦)',
            start: 3,
            end: 6,
            visible: true,
            x: 50,
            y: 50,
            scale: 1.0,
            opacity: 1,
            properties: {
              src: storyboards[1]?.videoSrc || '/video.mp4',
              isVideo: true,
              videoStartOffset: 0,
              videoEndOffset: 3,
              transitionType: 'fade',
              transitionDuration: 0.3
            }
          },
          // Shot 3: 6s to 9s (3 seconds)
          {
            id: `media_i2v_2_${Date.now()}`,
            type: 'media',
            name: '🎬 分镜三 (手部拧捏)',
            start: 6,
            end: 9,
            visible: true,
            x: 50,
            y: 50,
            scale: 1.0,
            opacity: 1,
            properties: {
              src: storyboards[2]?.videoSrc || '/video.mp4',
              isVideo: true,
              videoStartOffset: 0,
              videoEndOffset: 3,
              transitionType: 'fade',
              transitionDuration: 0.3
            }
          },
          // Shot 4: 9s to 12s (3 seconds)
          {
            id: `media_i2v_3_${Date.now()}`,
            type: 'media',
            name: '🎬 分镜四 (特写拉回)',
            start: 9,
            end: 12,
            visible: true,
            x: 50,
            y: 50,
            scale: 1.0,
            opacity: 1,
            properties: {
              src: storyboards[3]?.videoSrc || '/video.mp4',
              isVideo: true,
              videoStartOffset: 0,
              videoEndOffset: 3,
              transitionType: 'fade',
              transitionDuration: 0.3
            }
          },
          // Shot 5: 12s to 15s (3 seconds)
          {
            id: `media_i2v_4_${Date.now()}`,
            type: 'media',
            name: '🎬 分镜五 (全身定格)',
            start: 12,
            end: 15,
            visible: true,
            x: 50,
            y: 50,
            scale: 1.0,
            opacity: 1,
            properties: {
              src: storyboards[4]?.videoSrc || '/video.mp4',
              isVideo: true,
              videoStartOffset: 0,
              videoEndOffset: 3,
              transitionType: 'fade',
              transitionDuration: 0.3
            }
          },
          // Background Beat Audio track (up to 15s)
          {
            id: `audio_i2v_${Date.now()}`,
            type: 'audio',
            name: defaultBgmName,
            start: 0,
            end: 15,
            visible: true,
            x: 0,
            y: 0,
            scale: 1,
            opacity: 1,
            properties: {
              src: defaultBgmSrc,
              volume: 0.8
            }
          },
          // Brand logo
          {
            id: logoId,
            type: 'media',
            name: '品牌 LOGO',
            start: 0,
            end: 1.5,
            visible: true,
            x: 50,
            y: 50,
            scale: 1.0,
            opacity: 1,
            properties: { src: '/logo.png', bgRemoved: false }
          }
        ];
      }

      if (includeI2VSubtitles) {
        newLayers.push(
          // Subtitle 1 (0.5s - 2.5s)
          {
            id: `text_i2v_1_${Date.now()}`,
            type: 'text',
            name: '文案 (全身出场)',
            start: 0.5,
            end: 2.5,
            visible: true,
            x: 50,
            y: 80,
            scale: 1,
            opacity: 1,
            properties: {
              text: '全场景高级感走秀出场展示',
              fontSize: 28,
              color: '#ffffff',
              animation: 'zoom',
              bold: true,
              shadow: true
            }
          },
          // Subtitle 2 (3.5s - 5.5s)
          {
            id: `text_i2v_2_${Date.now()}`,
            type: 'text',
            name: '文案 (下半身聚焦)',
            start: 3.5,
            end: 5.5,
            visible: true,
            x: 50,
            y: 80,
            scale: 1,
            opacity: 1,
            properties: {
              text: '下半身聚焦 展现下装版型',
              fontSize: 28,
              color: '#00f2fe',
              animation: 'typewriter',
              bold: true,
              shadow: true
            }
          },
          // Subtitle 3 (6.5s - 8.5s)
          {
            id: `text_i2v_3_${Date.now()}`,
            type: 'text',
            name: '文案 (面料细节)',
            start: 6.5,
            end: 8.5,
            visible: true,
            x: 50,
            y: 80,
            scale: 1,
            opacity: 1,
            properties: {
              text: '微距对准手部 呈现面料质地',
              fontSize: 28,
              color: '#ff007f',
              animation: 'slide',
              bold: true,
              shadow: true
            }
          },
          // Subtitle 4 (9.5s - 11.5s)
          {
            id: `text_i2v_4_${Date.now()}`,
            type: 'text',
            name: '文案 (全身拉回)',
            start: 9.5,
            end: 11.5,
            visible: true,
            x: 50,
            y: 80,
            scale: 1,
            opacity: 1,
            properties: {
              text: '特写拉回全身 完美身姿舒展',
              fontSize: 28,
              color: '#00ff66',
              animation: 'zoom',
              bold: true,
              shadow: true
            }
          },
          // Subtitle 5 (12.5s - 14.5s)
          {
            id: `text_i2v_5_${Date.now()}`,
            type: 'text',
            name: '文案 (全新定格)',
            start: 12.5,
            end: 14.5,
            visible: true,
            x: 50,
            y: 80,
            scale: 1,
            opacity: 1,
            properties: {
              text: '优雅站立定格 完美呈现穿搭',
              fontSize: 28,
              color: '#ffaa00',
              animation: 'typewriter',
              bold: true,
              shadow: true
            }
          }
        );
      }

      if (includeI2VStickers) {
        newLayers.push({
          id: `sticker_i2v_${Date.now()}`,
          type: 'sticker',
          name: 'AI 贴纸',
          start: 0,
          end: 15,
          visible: true,
          x: 80,
          y: 15,
          scale: 1.1,
          opacity: 1,
          properties: {
            text: '图生视频合成',
            style: 'purple'
          }
        });
      }
    } else {
      // 4s Loop (3 segments = 12s total)
      newLayers = [
        // Shot 1: Full-body (0s to 4s)
        {
          id: `media_i2v_0_${Date.now()}`,
          type: 'media',
          name: '🎬 视频分镜一 (全身展示)',
          start: 0,
          end: 4,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: {
            src: storyboards[0]?.videoSrc || '/video.mp4',
            isVideo: true,
            videoStartOffset: 0,
            videoEndOffset: 4
          }
        },
        // Shot 2: Medium (4s to 8s)
        {
          id: `media_i2v_1_${Date.now()}`,
          type: 'media',
          name: '🎬 视频分镜二 (半身中景)',
          start: 4,
          end: 8,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: {
            src: storyboards[1]?.videoSrc || '/video.mp4',
            isVideo: true,
            videoStartOffset: 0,
            videoEndOffset: 4,
            transitionType: 'fade',
            transitionDuration: 0.5
          }
        },
        // Shot 3: Close-Up (8s to 12s)
        {
          id: `media_i2v_2_${Date.now()}`,
          type: 'media',
          name: '🎬 视频分镜三 (细节特写)',
          start: 8,
          end: 12,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: {
            src: storyboards[2]?.videoSrc || '/video.mp4',
            isVideo: true,
            videoStartOffset: 0,
            videoEndOffset: 4,
            transitionType: 'fade',
            transitionDuration: 0.5
          }
        },
        // Background Beat Audio track
        {
          id: `audio_i2v_${Date.now()}`,
          type: 'audio',
          name: defaultBgmName,
          start: 0,
          end: 12,
          visible: true,
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          properties: {
            src: defaultBgmSrc,
            volume: 0.8
          }
        },
        {
          id: logoId,
          type: 'media',
          name: '品牌 LOGO',
          start: 0,
          end: 1,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: { src: '/logo.png', bgRemoved: false }
        }
      ];

      if (includeI2VSubtitles) {
        newLayers.push(
          // Subtitle 1 (0.5s - 3.5s)
          {
            id: `text_i2v_1_${Date.now()}`,
            type: 'text',
            name: '文案 (全身展示)',
            start: 0.5,
            end: 3.5,
            visible: true,
            x: 50,
            y: 80,
            scale: 1,
            opacity: 1,
            properties: {
              text: '全场景高级感模特上身展示',
              fontSize: 28,
              color: '#ffffff',
              animation: 'zoom',
              bold: true,
              shadow: true
            }
          },
          // Subtitle 2 (4.5s - 7.5s)
          {
            id: `text_i2v_2_${Date.now()}`,
            type: 'text',
            name: '文案 (半身版型)',
            start: 4.5,
            end: 7.5,
            visible: true,
            x: 50,
            y: 80,
            scale: 1,
            opacity: 1,
            properties: {
              text: '智能模特贴合 剪裁显瘦版型',
              fontSize: 28,
              color: '#00f2fe',
              animation: 'typewriter',
              bold: true,
              shadow: true
            }
          },
          // Subtitle 3 (8.5s - 11.5s)
          {
            id: `text_i2v_3_${Date.now()}`,
            type: 'text',
            name: '文案 (面料细节)',
            start: 8.5,
            end: 11.5,
            visible: true,
            x: 50,
            y: 80,
            scale: 1,
            opacity: 1,
            properties: {
              text: '大师级车线走工 细节清晰可见',
              fontSize: 28,
              color: '#ff007f',
              animation: 'slide',
              bold: true,
              shadow: true
            }
          }
        );
      }

      if (includeI2VStickers) {
        newLayers.push({
          id: `sticker_i2v_${Date.now()}`,
          type: 'sticker',
          name: 'AI 贴纸',
          start: 0,
          end: 12,
          visible: true,
          x: 80,
          y: 15,
          scale: 1.1,
          opacity: 1,
          properties: {
            text: '图生视频合成',
            style: 'purple'
          }
        });
      }
    }

    setLayers(newLayers);
    setSelectedLayerId(logoId);

    let autoItems = [];
    if (includeI2VSubtitles) autoItems.push('卖点字幕');
    if (includeI2VStickers) autoItems.push('AI 贴纸');
    const autoStr = autoItems.length > 0 ? `并自动配置音轨与${autoItems.join('、')}` : '并自动配置音轨';
    alert(videoDuration === '15s' || videoDuration === '3s'
      ? `一键拼接 15s 分镜视频大功告成！5 段视频分镜已拼接${autoStr}，您现在可以点击画布底部的播放按钮观看，或直接导出视频！`
      : `一键拼接分镜视频大功告成！三段视频分镜已拼接${autoStr}，您现在可以点击画布底部的播放按钮观看，或直接导出视频！`);
  };

  // 1. Templates Application
  const applyTemplate = (tplType: 'beat' | 'split' | 'detail' | 'transition_demo') => {
    let tplLayers: Layer[] = [];
    const firstBgm = bgmLibrary[0];
    const defaultBgmSrc = firstBgm?.src || (tplType === 'beat' ? 'fashion_beat.mp3' : tplType === 'split' ? 'jazz.mp3' : 'tech_ambient.mp3');
    const defaultBgmName = firstBgm?.name || (tplType === 'beat' ? '动感时尚卡点音轨' : tplType === 'split' ? '轻快爵士音轨' : '极简科技感纯音乐');

    if (tplType === 'beat') {
      tplLayers = [
        {
          id: 'media_1',
          type: 'media',
          name: '商品图 (亚麻衬衫)',
          start: 0,
          end: 15,
          visible: true,
          x: 50,
          y: 45,
          scale: 0.95,
          opacity: 1,
          properties: { src: '/clothing_shirt.png', bgRemoved: false }
        },
        {
          id: 'text_1',
          type: 'text',
          name: '主标题 (天然面料)',
          start: 1,
          end: 6,
          visible: true,
          x: 50,
          y: 78,
          scale: 1,
          opacity: 1,
          properties: { text: '100% 纯天然法国亚麻', fontSize: 32, color: '#ffffff', animation: 'zoom', bold: true, shadow: true }
        },
        {
          id: 'text_2',
          type: 'text',
          name: '副标题 (透气排汗)',
          start: 6.5,
          end: 12,
          visible: true,
          x: 50,
          y: 78,
          scale: 1,
          opacity: 1,
          properties: { text: '干爽透气 • 不易起皱', fontSize: 32, color: '#00f2fe', animation: 'typewriter', bold: true, shadow: true }
        },
        {
          id: 'sticker_1',
          type: 'sticker',
          name: '促销标签',
          start: 2,
          end: 14,
          visible: true,
          x: 80,
          y: 18,
          scale: 1.1,
          opacity: 1,
          properties: { text: '新品上市', style: 'purple' }
        },
        {
          id: 'audio_1',
          type: 'audio',
          name: defaultBgmName,
          start: 0,
          end: 15,
          visible: true,
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          properties: { src: defaultBgmSrc, volume: 0.8 }
        }
      ];
    } else if (tplType === 'split') {
      tplLayers = [
        {
          id: 'media_1',
          type: 'media',
          name: '模特展示图',
          start: 0,
          end: 15,
          visible: true,
          x: 50,
          y: 48,
          scale: 1.05,
          opacity: 1,
          properties: { src: '/clothing_model.png', bgRemoved: false }
        },
        {
          id: 'text_1',
          type: 'text',
          name: '文案 (法式优雅)',
          start: 0.5,
          end: 14.5,
          visible: true,
          x: 50,
          y: 82,
          scale: 1,
          opacity: 1,
          properties: { text: '法式复古 · 优雅风度', fontSize: 36, color: '#ffb703', animation: 'slide', bold: true, shadow: true }
        },
        {
          id: 'sticker_1',
          type: 'sticker',
          name: '爆款标签',
          start: 1,
          end: 15,
          visible: true,
          x: 20,
          y: 15,
          scale: 1.2,
          opacity: 1,
          properties: { text: '年度爆款', style: 'gold' }
        },
        {
          id: 'audio_1',
          type: 'audio',
          name: defaultBgmName,
          start: 0,
          end: 15,
          visible: true,
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          properties: { src: defaultBgmSrc, volume: 0.7 }
        }
      ];
    } else if (tplType === 'detail') {
      tplLayers = [
        {
          id: 'media_1',
          type: 'media',
          name: '瑜伽服平铺图',
          start: 0,
          end: 15,
          visible: true,
          x: 50,
          y: 45,
          scale: 0.9,
          opacity: 1,
          properties: { src: '/clothing_flatlay.png', bgRemoved: false }
        },
        {
          id: 'text_1',
          type: 'text',
          name: '文案 (轻盈亲肤)',
          start: 1.5,
          end: 13.5,
          visible: true,
          x: 50,
          y: 80,
          scale: 1,
          opacity: 1,
          properties: { text: '轻盈包裹 塑形美背', fontSize: 34, color: '#00f2fe', animation: 'zoom', bold: true, shadow: true }
        },
        {
          id: 'sticker_1',
          type: 'sticker',
          name: '特惠贴纸',
          start: 0.5,
          end: 14.5,
          visible: true,
          x: 82,
          y: 15,
          scale: 1.1,
          opacity: 1,
          properties: { text: '限时特惠', style: 'cyan' }
        },
        {
          id: 'audio_1',
          type: 'audio',
          name: defaultBgmName,
          start: 0,
          end: 15,
          visible: true,
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          properties: { src: defaultBgmSrc, volume: 0.6 }
        }
      ];
    } else if (tplType === 'transition_demo') {
      const now = Date.now();
      tplLayers = [
        {
          id: `media_demo_1_${now}`,
          type: 'media',
          name: '🎬 视频片段一 (全身大图)',
          start: 0,
          end: 5,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: {
            src: '/clothing_model.png',
            bgRemoved: false,
            isVideo: false
          }
        },
        {
          id: `media_demo_2_${now}`,
          type: 'media',
          name: '🎬 视频片段二 (半身展示)',
          start: 5,
          end: 10,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: {
            src: '/clothing_model_yoga.png',
            bgRemoved: false,
            isVideo: false,
            transitionType: 'fade',
            transitionDuration: 0.8
          }
        },
        {
          id: `media_demo_3_${now}`,
          type: 'media',
          name: '🎬 视频片段三 (平铺质感)',
          start: 10,
          end: 15,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: {
            src: '/clothing_flatlay.png',
            bgRemoved: false,
            isVideo: false,
            transitionType: 'slideLeft',
            transitionDuration: 0.8
          }
        },
        {
          id: `text_demo_1_${now}`,
          type: 'text',
          name: '过渡演示文案',
          start: 1.5,
          end: 13.5,
          visible: true,
          x: 50,
          y: 82,
          scale: 1,
          opacity: 1,
          properties: {
            text: '丝滑视频片段转场过渡演示',
            fontSize: 28,
            color: '#00f2fe',
            animation: 'zoom',
            bold: true,
            shadow: true
          }
        },
        {
          id: `audio_demo_${now}`,
          type: 'audio',
          name: defaultBgmName,
          start: 0,
          end: 15,
          visible: true,
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          properties: {
            src: defaultBgmSrc,
            volume: 0.6
          }
        }
      ];
    }
    const logoLayer: Layer = {
      id: `logo_layer_${Date.now()}`,
      type: 'media',
      name: '品牌 LOGO',
      start: 0,
      end: 1,
      visible: true,
      x: 50,
      y: 50,
      scale: 1.0,
      opacity: 1,
      properties: { src: '/logo.png', bgRemoved: false }
    };
    const finalLayers = [logoLayer, ...tplLayers];
    setLayers(finalLayers);
    setSelectedLayerId(logoLayer.id);
  };





  // Handle model library upload (uploads to OSS and stores in Supabase)
  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const fileName = file.name.split('.')[0] || '上传模特';

      const added = await addModelToLibrary(fileName, base64);
      if (added) {
        alert(`模特「${fileName}」上传并保存至云端模特库成功！`);
      } else {
        alert(`模特「${fileName}」上传失败，请检查网络或服务配置。`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle model reference image upload inside modal
  const handleModelRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setModelRefImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePoseRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setOutfitPoseImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };



  // Handle scene upload
  const handleSceneUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const newScene = {
        id: `custom_scene_${Date.now()}`,
        name: file.name.split('.')[0] || '自定义场景',
        src: base64
      };
      setCustomScenes(prev => {
        const updated = [newScene, ...prev];
        return saveCustomScenesSafely(updated);
      });
    };
    reader.readAsDataURL(file);
  };

  // Delete custom scene
  const deleteCustomScene = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm('删除自定义场景', '确认删除该自定义场景吗？', () => {
      setCustomScenes(prev => {
        const updated = prev.filter(s => s.id !== id);
        return saveCustomScenesSafely(updated);
      });
    });
  };

  // Save renamed custom scene name
  const handleSaveSceneName = () => {
    if (!previewScene || !previewScene.id) return;
    const newName = editingSceneNameValue.trim();
    if (!newName) {
      alert('名称不能为空！');
      return;
    }

    setCustomScenes(prev => {
      const updated = prev.map(s => s.id === previewScene.id ? { ...s, name: newName } : s);
      return saveCustomScenesSafely(updated);
    });

    setPreviewScene(prev => prev ? { ...prev, name: newName } : null);
    setIsEditingSceneName(false);
  };

  // Save renamed model name from preview modal
  const handleSaveModelPreviewName = async () => {
    if (!previewModel || !previewModel.id) return;
    const trimmedName = editingModelNameValue.trim();
    if (!trimmedName) {
      alert('名称不能为空！');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('model_assets')
        .update({ name: trimmedName })
        .eq('id', previewModel.id);

      if (updateError) throw updateError;

      setModelLibrary(prev => {
        const updated = prev.map(m => m.id === previewModel.id ? { ...m, name: trimmedName } : m);
        saveModelLibrarySafely(updated);
        return updated;
      });

      setPreviewModel(prev => prev ? { ...prev, name: trimmedName } : null);
      setIsEditingModelName(false);
    } catch (err: any) {
      console.error('Failed to rename model in Supabase:', err);
      // Fallback local update
      setModelLibrary(prev => {
        const updated = prev.map(m => m.id === previewModel.id ? { ...m, name: trimmedName } : m);
        saveModelLibrarySafely(updated);
        return updated;
      });
      setPreviewModel(prev => prev ? { ...prev, name: trimmedName } : null);
      setIsEditingModelName(false);
    }
  };

  // Upload custom BGM
  const handleBgmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('音频文件过大，为保证流畅度，请上传小于 20MB 的背景音乐！');
      return;
    }

    try {
      // 1. Get current logged in user session
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      // 2. Upload file to Aliyun OSS
      const ossUrl = await uploadAudioToOSS(file);

      // 3. Save to Supabase
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      const fileDesc = `${(file.size / 1024 / 1024).toFixed(2)}MB • 云端存储`;

      const { data: insertedData, error: dbError } = await supabase
        .from('audio_assets')
        .insert({
          name: fileName,
          src: ossUrl,
          desc: fileDesc,
          user_id: userId || null
        })
        .select();

      if (dbError) throw dbError;

      const newId = insertedData?.[0]?.id || `custom_bgm_${Date.now()}`;
      const newBgm = {
        id: newId,
        name: fileName,
        src: ossUrl,
        desc: fileDesc
      };

      setBgmLibrary(prev => {
        const updated = [...prev, newBgm];
        saveBgmLibrarySafely(updated); // Sync to localDB fallback as well
        return updated;
      });

      alert(`音频「${newBgm.name}」已成功上传至 OSS 并保存至云数据库！`);
    } catch (err: any) {
      console.error('BGM upload failed:', err);
      alert('音频上传失败: ' + (err.message || err));
    }
  };

  // Delete custom BGM
  const handleBgmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    showConfirm('删除背景音乐', '确定要从云端及背景音乐库中删除该音乐吗？', async () => {
      try {
        const { error } = await supabase
          .from('audio_assets')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setBgmLibrary(prev => {
          const updated = prev.filter(b => b.id !== id);
          saveBgmLibrarySafely(updated); // Sync to localDB fallback
          return updated;
        });
        alert('该背景音乐已成功从云端删除！');
      } catch (err: any) {
        console.error('BGM delete failed:', err);
        // Fallback local deletion if db fails
        setBgmLibrary(prev => {
          const updated = prev.filter(b => b.id !== id);
          saveBgmLibrarySafely(updated);
          return updated;
        });
        alert('云端删除失败（已同步从本地列表移除）: ' + (err.message || err));
      }
    });
  };

  // Apply model image from Model Library as AI reference input
  const applyModelFromLibrary = (modelSrc: string, modelName: string) => {
    setSwapModelUrl(modelSrc);
    setActiveTab('ai');
    alert(`已选定模特「${modelName}」作为生成参考模特，已为您自动切换至「AI工具」面板。`);
  };

  // Apply scene background from Scene Library as AI reference input
  const applySceneBackground = (sceneName: string, src: string) => {
    let sceneKeyOrId = '';
    if (sceneName === '摩登街头') sceneKeyOrId = 'street';
    else if (sceneName === '专业影棚') sceneKeyOrId = 'studio';
    else if (sceneName === '温馨居家') sceneKeyOrId = 'home';
    else if (sceneName === '职场办公') sceneKeyOrId = 'office';
    else if (sceneName === '阳光海滩') sceneKeyOrId = 'beach';
    else if (sceneName === '时尚秀场') sceneKeyOrId = 'runway';
    else if (sceneName === '极简侘寂') sceneKeyOrId = 'minimalist';
    else {
      const customScene = customScenes.find(s => s.src === src || s.name === sceneName);
      sceneKeyOrId = customScene ? customScene.id : '';
    }

    if (sceneKeyOrId) {
      setModelScene(sceneKeyOrId);
      setActiveTab('ai');
      alert(`已选定场景「${sceneName}」作为生成参考背景，已为您自动切换至「AI工具」面板。`);
    } else {
      alert(`未找到该场景，请在 AI 面板中手动选择。`);
    }
  };

  // 3. Add Text Slogan
  const addTextLayer = (presetText: string) => {
    const id = `text_${Date.now()}`;
    const newLayer: Layer = {
      id,
      type: 'text',
      name: `文本 (${presetText.slice(0, 5)})`,
      start: 2,
      end: 8,
      visible: true,
      x: 50,
      y: 75,
      scale: 1,
      opacity: 1,
      properties: {
        text: presetText,
        fontSize: 32,
        color: '#ffffff',
        animation: 'fade',
        bold: true,
        shadow: true
      }
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(id);
  };

  // 4. Add Sticker
  const addStickerLayer = (stickerText: string, style: 'red' | 'gold' | 'cyan' | 'black' | 'purple') => {
    const id = `sticker_${Date.now()}`;
    const newLayer: Layer = {
      id,
      type: 'sticker',
      name: `贴纸 (${stickerText})`,
      start: 1,
      end: 14,
      visible: true,
      x: 30,
      y: 20,
      scale: 1.1,
      opacity: 1,
      properties: { text: stickerText, style }
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(id);
  };

  const addBrandLogoStickerLayer = () => {
    const id = `logo_layer_${Date.now()}`;
    const newLayer: Layer = {
      id,
      type: 'media',
      name: '品牌 LOGO',
      start: 0,
      end: 15,
      visible: true,
      x: 50,
      y: 50,
      scale: 1.0,
      opacity: 1,
      properties: { src: '/logo.png', bgRemoved: false }
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(id);
  };

  const handleImportLocalAudio = async () => {
    if (!isTauri) return;

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { convertFileSrc } = await import('@tauri-apps/api/core');

      const selected = await open({
        multiple: true,
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] }]
      });

      if (!selected) return;

      const filePaths = Array.isArray(selected) ? selected : [selected];
      const newBgms: any[] = [];

      for (const path of filePaths) {
        const name = path.split(/[/\\]/).pop() || '本地音频';
        const fileSrc = convertFileSrc(path);
        
        const newBgm = {
          id: `local_bgm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: name.replace(/\.[^/.]+$/, ""),
          src: fileSrc,
          desc: `本地音频 • ${path}`
        };
        newBgms.push(newBgm);
      }

      if (newBgms.length > 0) {
        setBgmLibrary(prev => {
          const updated = [...prev, ...newBgms];
          saveBgmLibrarySafely(updated);
          return updated;
        });
        alert(`成功导入 ${newBgms.length} 首本地音乐！`);
      }
    } catch (err: any) {
      console.error('Failed to import local audio:', err);
      alert('导入本地音频失败: ' + (err.message || err));
    }
  };

  const handleImportLocalVideo = async () => {
    if (!isTauri) return;

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { convertFileSrc } = await import('@tauri-apps/api/core');

      const selected = await open({
        multiple: true,
        filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] }]
      });

      if (!selected) return;

      const filePaths = Array.isArray(selected) ? selected : [selected];
      const addedVideos: any[] = [];

      for (const path of filePaths) {
        const name = path.split(/[/\\]/).pop() || '本地视频';
        const fileSrc = convertFileSrc(path);
        const newVideo = {
          id: `local_video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: name.replace(/\.[^/.]+$/, ""),
          src: fileSrc,
          desc: `本地视频 • ${path}`,
          duration: 0
        };

        await localDB.saveLocalVideo(newVideo);
        addedVideos.push(newVideo);
      }

      if (addedVideos.length > 0) {
        setLocalVideos(prev => [...prev, ...addedVideos]);
        alert(`成功导入 ${addedVideos.length} 个本地视频素材！`);
      }
    } catch (err: any) {
      console.error('Failed to import local video:', err);
      alert('导入本地视频失败: ' + (err.message || err));
    }
  };

  const handleDeleteLocalVideo = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    showConfirm('删除本地视频', '确定要从本地素材库中删除该视频吗？', async () => {
      try {
        await localDB.deleteLocalVideo(id);
        setLocalVideos(prev => prev.filter(v => v.id !== id));
      } catch (err: any) {
        console.error('Failed to delete local video:', err);
        alert('删除失败: ' + (err.message || err));
      }
    });
  };

  const addLocalVideoLayer = (video: { name: string; src: string }) => {
    const id = `local_video_layer_${Date.now()}`;
    const newLayer: Layer = {
      id,
      type: 'media',
      name: `本地视频: ${video.name}`,
      start: 0,
      end: 15,
      visible: true,
      x: 50,
      y: 50,
      scale: 1.0,
      opacity: 1,
      properties: { src: video.src, bgRemoved: false }
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(id);
  };

  // 5. AI Actions




  const togglePreviewAudio = (e: React.MouseEvent, src: string) => {
    e.stopPropagation(); // Avoid selecting the BGM when clicking preview
    if (previewAudioSrc === src) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPreviewAudioSrc(null);
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(err => console.error('Audio preview failed:', err));
    audio.onended = () => {
      setPreviewAudioSrc(null);
    };
    previewAudioRef.current = audio;
    setPreviewAudioSrc(src);
  };

  // 6. Audio/BGM Selection and TTS Generator
  const selectBgm = (src: string, name: string) => {
    // Check if audio track already exists
    const hasAudio = layers.some(l => l.type === 'audio');
    if (hasAudio) {
      setLayers(layers.map(l => {
        if (l.type === 'audio') {
          return { ...l, name, properties: { ...l.properties, src } };
        }
        return l;
      }));
    } else {
      const id = `audio_${Date.now()}`;
      setLayers([...layers, {
        id,
        type: 'audio',
        name,
        start: 0,
        end: 15,
        visible: true,
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        properties: { src, volume: 0.8 }
      }]);
    }
  };
  useImperativeHandle(ref, () => ({
    switchProject,
    createNewProject,
    startRenameProject,
    deleteProject,
    saveProjectName
  }), [
    projects,
    activeProjectId,
    isEditingProjName,
    editingProjNameValue,
    isProjectsModalOpen,
    switchProject,
    createNewProject,
    startRenameProject,
    deleteProject,
    saveProjectName
  ]);

  return (
    <div className="sidebar-drawer">
      {/* 1. TEMPLATES PANEL */}
      {activeTab === 'template' && (
        <>
          <div className="drawer-header">
            <div className="drawer-title">电商爆款视频模板</div>
            <div className="drawer-subtitle">专为服装类目剪裁，替换素材即可出片</div>
          </div>
          <div className="drawer-content">
            <div className="template-grid">
              <div className="template-card" onClick={() => applyTemplate('beat')}>
                <div className="template-thumb" style={{ background: '#111827' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" strokeWidth="2">
                    <path d="M12 2v20M17 5v14M7 9v6M22 10v4M2 10v4" />
                  </svg>
                </div>
                <div className="template-name">时尚卡点卖点流</div>
              </div>
              <div className="template-card" onClick={() => applyTemplate('split')}>
                <div className="template-thumb" style={{ background: '#111827' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="12" y1="3" x2="12" y2="21" />
                  </svg>
                </div>
                <div className="template-name">模特画报风</div>
              </div>
              <div className="template-card" onClick={() => applyTemplate('detail')}>
                <div className="template-thumb" style={{ background: '#111827' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-pink)" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <div className="template-name">简约细节大图款</div>
              </div>
              <div className="template-card" onClick={() => applyTemplate('transition_demo')}>
                <div className="template-thumb" style={{ background: '#111827' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#52ff52" strokeWidth="2">
                    <path d="M17 1l4 4-4 4" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <path d="M7 23l-4-4 4-4" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </div>
                <div className="template-name">多片段过渡演示</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 2. MEDIA LIBRARY */}
      {activeTab === 'media' && (
        <>
          <div className="drawer-header">
            <div className="drawer-title">智能素材与场景库</div>
            <div className="drawer-subtitle">管理您的 AI 模特及自定义场景</div>
          </div>
          <div className="drawer-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* 2. AI MODEL LIBRARY SECTION */}
            <div className="media-section-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="property-label" style={{ margin: 0, fontSize: '12px', fontWeight: '600' }}>🧍 我的 AI 模特库</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <label className="btn-primary" style={{ padding: '3px 8px', fontSize: '10px', cursor: 'pointer', margin: 0, borderRadius: '4px', height: 'auto', display: 'inline-flex', alignItems: 'center', background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}>
                    上传模特
                    <input type="file" accept="image/*" onChange={handleModelUpload} style={{ display: 'none' }} />
                  </label>
                  <button
                    className="btn-secondary"
                    onClick={() => setIsGenModelModalOpen(true)}
                    style={{ padding: '3px 8px', fontSize: '10px', margin: 0, borderRadius: '4px', height: 'auto', display: 'inline-flex', alignItems: 'center' }}
                  >
                    生成模特
                  </button>
                </div>
              </div>
              {modelLibrary.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                  暂无已生成/上传的模特。点击「上传模特」或在「AI工具」中一键定制模特，即可保存至此。
                </div>
              ) : (
                <div className="media-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                  {modelLibrary.map(model => {
                    const isActive = swapModelUrl === model.src;
                    return (
                      <div
                        key={model.id}
                        className="media-thumb"
                        onClick={() => applyModelFromLibrary(model.src, model.name)}
                        title="点击将此模特设为 AI 生成参考"
                        style={{
                          position: 'relative',
                          cursor: 'pointer',
                          border: isActive ? '2px solid var(--accent-purple)' : '1px solid var(--border-color)',
                          borderRadius: '4px',
                          padding: '2px',
                          background: isActive ? 'rgba(138, 43, 226, 0.1)' : 'rgba(255,255,255,0.02)'
                        }}
                      >
                        <div style={{
                          height: '54px',
                          width: '100%',
                          position: 'relative',
                          borderRadius: '2px',
                          overflow: 'hidden',
                          background: `url(${activeBackgroundUrl}) center/cover`
                        }}>
                          <img
                            src={model.src}
                            alt={model.name}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain'
                            }}
                          />
                        </div>
                        <div className="media-thumb-label" style={{ fontSize: '9px', textAlign: 'center', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.name}</div>
                        {isActive && (
                          <div style={{ position: 'absolute', top: '4px', left: '4px', background: 'var(--accent-purple)', color: '#ffffff', borderRadius: '50%', width: '14px', height: '14px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', zIndex: 2 }}>
                            ✓
                          </div>
                        )}
                        {/* Preview Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewModel({ id: model.id, src: model.src, name: model.name });
                            setEditingModelNameValue(model.name);
                            setIsEditingModelName(false);
                          }}
                          style={{ position: 'absolute', top: '2px', right: '19px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', color: '#ffffff', width: '15px', height: '15px', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                          title="预览"
                        >
                          👁
                        </button>
                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            showConfirm('删除模特', '确认从模特库中删除该模特吗？', async () => {
                              try {
                                const { error: deleteError } = await supabase
                                  .from('model_assets')
                                  .delete()
                                  .eq('id', model.id);

                                if (deleteError) throw deleteError;

                                setModelLibrary(prev => {
                                  const updated = prev.filter(m => m.id !== model.id);
                                  saveModelLibrarySafely(updated);
                                  return updated;
                                });
                              } catch (err: any) {
                                console.error('Failed to delete model from Supabase:', err);
                                alert(`删除失败: ${err.message || '网络错误'}`);
                              }
                            });
                          }}
                          style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', color: '#ff5252', width: '15px', height: '15px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                          title="删除"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. SCENE LIBRARY SECTION */}
            <div className="media-section-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="property-label" style={{ margin: 0, fontSize: '12px', fontWeight: '600' }}>🎨 背景场景库</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <label className="btn-primary" style={{ padding: '3px 8px', fontSize: '10px', cursor: 'pointer', margin: 0, borderRadius: '4px', height: 'auto', display: 'inline-flex', alignItems: 'center', background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}>
                    上传场景
                    <input type="file" accept="image/*" onChange={handleSceneUpload} style={{ display: 'none' }} />
                  </label>
                  <button
                    onClick={() => setShowAiSceneModal(true)}
                    className="btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '10px', margin: 0, borderRadius: '4px', height: 'auto', display: 'inline-flex', alignItems: 'center' }}
                  >
                    生成场景
                  </button>
                </div>
              </div>

              <div className="media-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                {/* Built-in Scenes */}
                {[
                  { key: 'studio', name: '专业影棚', src: SCENE_BACKGROUNDS.studio, emoji: '🧘' },
                  { key: 'home', name: '温馨居家', src: SCENE_BACKGROUNDS.home, emoji: '🏡' },
                  { key: 'office', name: '职场办公', src: SCENE_BACKGROUNDS.office, emoji: '💼' },
                  { key: 'beach', name: '阳光海滩', src: SCENE_BACKGROUNDS.beach, emoji: '🏖️' },
                  { key: 'runway', name: '时尚秀场', src: SCENE_BACKGROUNDS.runway, emoji: '👠' },
                  { key: 'minimalist', name: '极简侘寂', src: SCENE_BACKGROUNDS.minimalist, emoji: '🎨' },
                ].map(scene => {
                  const isActive = modelScene === scene.key;
                  return (
                    <div
                      key={scene.key}
                      className="media-thumb"
                      onClick={() => applySceneBackground(scene.name, scene.src)}
                      title="点击将此场景设为 AI 生成参考"
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        border: isActive ? '2px solid var(--accent-purple)' : '1px solid var(--border-color)',
                        background: isActive ? 'rgba(138, 43, 226, 0.1)' : 'rgba(255,255,255,0.02)',
                        borderRadius: '4px',
                        padding: '2px'
                      }}
                    >
                      <div style={{ height: '48px', background: `url(${scene.src}) center/cover`, borderRadius: '4px' }} />
                      <div className="media-thumb-label" style={{ fontSize: '9px', textAlign: 'center', marginTop: '2px' }}>{scene.emoji} {scene.name}</div>
                      {isActive && (
                        <div style={{ position: 'absolute', top: '4px', left: '4px', background: 'var(--accent-purple)', color: '#ffffff', borderRadius: '50%', width: '14px', height: '14px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', zIndex: 2 }}>
                          ✓
                        </div>
                      )}
                      {/* Preview Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewScene({ src: scene.src, name: scene.name });
                        }}
                        style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', color: '#ffffff', width: '15px', height: '15px', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        title="预览"
                      >
                        👁
                      </button>
                    </div>
                  );
                })}

                {/* Custom Scenes */}
                {customScenes.map(scene => {
                  const isActive = modelScene === scene.id;
                  return (
                    <div
                      key={scene.id}
                      className="media-thumb"
                      onClick={() => applySceneBackground(scene.name, scene.src)}
                      title="点击将此场景设为 AI 生成参考"
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        border: isActive ? '2px solid var(--accent-purple)' : '1px solid var(--border-color)',
                        background: isActive ? 'rgba(138, 43, 226, 0.1)' : 'rgba(255,255,255,0.02)',
                        borderRadius: '4px',
                        padding: '2px'
                      }}
                    >
                      <div style={{ height: '48px', background: `url(${scene.src}) center/cover`, borderRadius: '4px' }} />
                      <div className="media-thumb-label" style={{ fontSize: '9px', textAlign: 'center', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🖼️ {scene.name}</div>
                      {isActive && (
                        <div style={{ position: 'absolute', top: '4px', left: '4px', background: 'var(--accent-purple)', color: '#ffffff', borderRadius: '50%', width: '14px', height: '14px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', zIndex: 2 }}>
                          ✓
                        </div>
                      )}
                      {/* Preview Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewScene({ id: scene.id, src: scene.src, name: scene.name });
                          setEditingSceneNameValue(scene.name);
                          setIsEditingSceneName(false);
                        }}
                        style={{ position: 'absolute', top: '2px', right: '19px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', color: '#ffffff', width: '15px', height: '15px', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        title="预览"
                      >
                        👁
                      </button>
                      {/* Delete Button */}
                      <button
                        onClick={(e) => deleteCustomScene(scene.id, e)}
                        style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', color: '#ff5252', width: '15px', height: '15px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        title="删除"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. LOCAL VIDEO LIBRARY SECTION (Tauri Only or Fallback) */}
            <div className="media-section-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="property-label" style={{ margin: 0, fontSize: '12px', fontWeight: '600' }}>📼 本地视频素材库</span>
                {isTauri && (
                  <button
                    className="btn-primary"
                    onClick={handleImportLocalVideo}
                    style={{ padding: '3px 8px', fontSize: '10px', margin: 0, borderRadius: '4px', height: 'auto', display: 'inline-flex', alignItems: 'center', background: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)' }}
                  >
                    导入本地视频
                  </button>
                )}
              </div>
              
              {!isTauri ? (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                  提示：导入本地视频功能仅在桌面客户端中可用。
                </div>
              ) : localVideos.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                  暂无导入的本地视频。点击「导入本地视频」直接选择本地 MP4 视频加入时间轴。
                </div>
              ) : (
                <div className="media-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {localVideos.map(video => (
                    <div
                      key={video.id}
                      className="media-thumb"
                      onClick={() => addLocalVideoLayer(video)}
                      title="双击或点击将此本地视频作为图层加入时间轴"
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        padding: '2px',
                        background: 'rgba(255,255,255,0.02)'
                      }}
                    >
                      <div style={{
                        height: '54px',
                        width: '100%',
                        position: 'relative',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        background: '#08090d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <video
                          src={video.src}
                          muted
                          preload="metadata"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                          <span style={{ fontSize: '16px' }}>▶️</span>
                        </div>
                      </div>
                      <div className="media-thumb-label" style={{ fontSize: '9px', textAlign: 'center', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.name}</div>
                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteLocalVideo(e, video.id)}
                        style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', color: '#ff5252', width: '15px', height: '15px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        title="从库中移除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {/* 3. TEXT OVERLAYS */}
      {activeTab === 'text' && (
        <>
          <div className="drawer-header">
            <div className="drawer-title">卖点动态字幕</div>
            <div className="drawer-subtitle">选择样式并添加到时间轴</div>
          </div>
          <div className="drawer-content">
            <button className="btn-secondary" onClick={() => addTextLayer('100% 极软新疆棉')} style={{ justifyContent: 'flex-start' }}>
              <span style={{ fontSize: '18px', fontWeight: '700', marginRight: '8px' }}>T</span>
              主标题 - 材质卖点 (纯棉)
            </button>
            <button className="btn-secondary" onClick={() => addTextLayer('显瘦版型 不挑身材')} style={{ justifyContent: 'flex-start' }}>
              <span style={{ fontSize: '16px', marginRight: '8px' }}>T</span>
              主标题 - 版型卖点 (显瘦)
            </button>
            <button className="btn-secondary" onClick={() => addTextLayer('限时大促 立减￥50')} style={{ justifyContent: 'flex-start' }}>
              <span style={{ fontSize: '14px', color: 'var(--accent-cyan)', marginRight: '8px' }}>T</span>
              营销文案 - 促销量级
            </button>
          </div>
        </>
      )}

      {/* 4. STICKERS AND BADGES */}
      {activeTab === 'sticker' && (
        <>
          <div className="drawer-header">
            <div className="drawer-title">电商氛围贴纸</div>
            <div className="drawer-subtitle">内置服装大促常用角标贴纸</div>
          </div>
          <div className="drawer-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="sticker-item" style={{ background: 'linear-gradient(to right, #8a2be2, #ff007f)' }} onClick={() => addStickerLayer('新品推荐', 'purple')}>新品推荐 🟣</div>
            <div className="sticker-item" style={{ background: 'linear-gradient(to right, #ffb703, #fb8500)', color: '#090a0f' }} onClick={() => addStickerLayer('爆款直降', 'gold')}>爆款直降 🟡</div>
            <div className="sticker-item" style={{ background: 'linear-gradient(to right, #00f2fe, #4facfe)', color: '#090a0f' }} onClick={() => addStickerLayer('极速发货', 'cyan')}>极速发货 🔵</div>
            <div className="sticker-item" style={{ background: 'linear-gradient(to right, #ff007f, #ff5252)' }} onClick={() => addStickerLayer('限时立减', 'red')}>限时立减 🔴</div>
            <div className="sticker-item" style={{ background: 'linear-gradient(to right, #243b55, #141e30)', border: '1px solid rgba(255, 255, 255, 0.1)' }} onClick={() => addBrandLogoStickerLayer()}>品牌 LOGO 🏷️</div>
          </div>
        </>
      )}

      {/* 5. AI MAGIC TOOLS */}
      {activeTab === 'ai' && (
        <>
          <div className="drawer-header">
            <div className="drawer-title">AI 智能设计中心</div>
            <div className="drawer-subtitle">依托深度算法，零门槛进行服装美化</div>
          </div>
          <div className="drawer-content" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Step navigation bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginBottom: '4px', gap: '4px' }}>
              {[
                { step: 1, label: '1. 服装试衣' },
                { step: 2, label: '2. 场景分镜' },
                { step: 3, label: '3. 视频生成' }
              ].map(item => (
                <button
                  key={item.step}
                  onClick={() => setAiWizardStep(item.step as any)}
                  style={{
                    flex: 1,
                    background: aiWizardStep === item.step ? 'rgba(138, 43, 226, 0.15)' : 'transparent',
                    border: '1px solid ' + (aiWizardStep === item.step ? 'var(--accent-purple)' : 'rgba(255,255,255,0.08)'),
                    color: aiWizardStep === item.step ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    borderRadius: '6px',
                    padding: '6px 4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {aiWizardStep === 1 && (
              <>
                {/* Model & Scene Config Group */}
                <div className="property-group" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span className="property-label" style={{ marginBottom: '2px', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)' }}>
                👤 模特与场景配置
              </span>
              
              {/* Select Try-on Model */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>选择试衣模特</span>
                <div
                  onClick={() => setIsModelSelectorModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-cyan)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={swapModelUrl}
                      alt="selected model"
                      style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', border: '1.5px solid rgba(255,255,255,0.15)' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', color: '#fff', fontWeight: '600' }}>
                        {swapModelUrl === '/clothing_model.png' ? '默认模特 (风衣模特)' : (modelLibrary.find(m => m.src === swapModelUrl)?.name || '库内模特')}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>点击打开模特库选择</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>➔</span>
                </div>
              </div>

              {/* Select Try-on Background Scene */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>选择分镜背景场景</span>
                {(() => {
                  let src = '';
                  if (modelScene === 'street') { src = SCENE_BACKGROUNDS.street; }
                  else if (modelScene === 'studio') { src = SCENE_BACKGROUNDS.studio; }
                  else if (modelScene === 'home') { src = SCENE_BACKGROUNDS.home; }
                  else if (modelScene === 'office') { src = SCENE_BACKGROUNDS.office; }
                  else if (modelScene === 'beach') { src = SCENE_BACKGROUNDS.beach; }
                  else if (modelScene === 'runway') { src = SCENE_BACKGROUNDS.runway; }
                  else if (modelScene === 'minimalist') { src = SCENE_BACKGROUNDS.minimalist; }
                  else {
                    const custom = customScenes.find(s => s.id === modelScene);
                    if (custom) src = custom.src;
                  }
                  const name = modelScene === 'street' ? '🏙️ 摩登街头' :
                               modelScene === 'studio' ? '🧘 专业影棚' :
                               modelScene === 'home' ? '🏡 温馨居家' :
                               modelScene === 'office' ? '💼 职场办公' :
                               modelScene === 'beach' ? '🏖️ 阳光海滩' :
                               modelScene === 'runway' ? '👠 时尚秀场' :
                               modelScene === 'minimalist' ? '🎨 极简侘寂' :
                               (customScenes.find(s => s.id === modelScene)?.name || '自定义场景');
                  return (
                    <div
                      onClick={() => setIsSceneSelectorModalOpen(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-cyan)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {src ? (
                          <img
                            src={src}
                            alt="selected scene"
                            style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', border: '1.5px solid rgba(255,255,255,0.15)' }}
                          />
                        ) : (
                          <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🖼️</div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12px', color: '#fff', fontWeight: '600' }}>
                            {name}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>点击打开场景库选择</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>➔</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Clothing Flatlay Upload Panel (Direct Input) */}
            <div className="property-group" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px' }}>👕</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff', letterSpacing: '0.01em' }}>配置服装与穿搭图</span>
              </div>

              {/* Interrupted generation warning banner */}
              {outfitGenInterrupted && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#fbbf24' }}>上次穿搭图生成被中断</span>
                    <span style={{ fontSize: '10px', color: 'rgba(251,191,36,0.7)', lineHeight: '1.4' }}>
                      检测到上次页面刷新时「生成模特穿搭图」任务正在进行中，已被中断。请重新点击「一键生成」按钮。
                    </span>
                  </div>
                  <button
                    onClick={() => setOutfitGenInterrupted(false)}
                    style={{ background: 'none', border: 'none', color: 'rgba(251,191,36,0.5)', cursor: 'pointer', fontSize: '14px', padding: '0', flexShrink: 0, lineHeight: '1' }}
                  >×</button>
                </div>
              )}

              {/* Upload Cards Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {/* 1. Top Clothing Upload Card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: '500', letterSpacing: '0.02em' }}>上装白底图</span>
                  {topClothingUrl ? (
                    <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid rgba(99,202,253,0.4)', aspectRatio: '1/1', background: 'rgba(0,0,0,0.3)' }}>
                      <img src={topClothingUrl} alt="top clothing" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '6px' }}>
                        <span style={{ fontSize: '8px', color: '#63cafd', fontWeight: '600' }}>✓ 已载入</span>
                      </div>
                      <button
                        onClick={() => { setTopClothingUrl(''); triggerOutfitStylist('', bottomClothingUrl); }}
                        style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,80,80,0.5)', color: '#ff6b6b', cursor: 'pointer', fontSize: '11px', padding: '0', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}
                      >×</button>
                    </div>
                  ) : (
                    <div
                      onClick={() => document.getElementById('top-clothing-upload-trigger')?.click()}
                      style={{
                        border: '1.5px dashed rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        aspectRatio: '1/1',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        transition: 'border-color 0.2s, background 0.2s'
                      }}
                      onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,202,253,0.4)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,202,253,0.04)'; }}
                      onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
                    >
                      <span style={{ fontSize: '20px', opacity: 0.5 }}>📤</span>
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>上传上装</span>
                    </div>
                  )}
                  <input id="top-clothing-upload-trigger" type="file" accept="image/*" onChange={handleTopClothingUpload} style={{ display: 'none' }} />
                </div>

                {/* 2. Bottom Clothing Upload Card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: '500', letterSpacing: '0.02em' }}>下装白底图</span>
                  {bottomClothingUrl ? (
                    <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid rgba(99,202,253,0.4)', aspectRatio: '1/1', background: 'rgba(0,0,0,0.3)' }}>
                      <img src={bottomClothingUrl} alt="bottom clothing" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '6px' }}>
                        <span style={{ fontSize: '8px', color: '#63cafd', fontWeight: '600' }}>✓ 已载入</span>
                      </div>
                      <button
                        onClick={() => { setBottomClothingUrl(''); triggerOutfitStylist(topClothingUrl, ''); }}
                        style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,80,80,0.5)', color: '#ff6b6b', cursor: 'pointer', fontSize: '11px', padding: '0', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}
                      >×</button>
                    </div>
                  ) : (
                    <div
                      onClick={() => document.getElementById('bottom-clothing-upload-trigger')?.click()}
                      style={{
                        border: '1.5px dashed rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        aspectRatio: '1/1',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        transition: 'border-color 0.2s, background 0.2s'
                      }}
                      onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,202,253,0.4)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,202,253,0.04)'; }}
                      onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
                    >
                      <span style={{ fontSize: '20px', opacity: 0.5 }}>📤</span>
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>上传下装</span>
                    </div>
                  )}
                  <input id="bottom-clothing-upload-trigger" type="file" accept="image/*" onChange={handleBottomClothingUpload} style={{ display: 'none' }} />
                </div>
              </div>

              {/* 3. Reference Outfit Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: '500', letterSpacing: '0.02em' }}>穿搭参考图</span>
                  <span style={{ fontSize: '9px', color: referenceOutfitUrls.length >= 3 ? '#ff6b6b' : 'rgba(255,255,255,0.25)' }}>
                    {referenceOutfitUrls.length}/3 套
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {referenceOutfitUrls.map((url, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid rgba(168,85,247,0.5)', aspectRatio: '3/4', background: 'rgba(0,0,0,0.3)' }}>
                        <img src={url} alt={`outfit ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 45%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '5px' }}>
                          <span style={{ fontSize: '8px', color: '#c084fc', fontWeight: '700' }}>套 {idx + 1}</span>
                        </div>
                        <button
                          onClick={() => {
                            setReferenceOutfitUrls(prev => {
                              const next = prev.filter((_, i) => i !== idx);
                              if (next.length > 0) { setReferenceOutfitUrl(next[0]); }
                              else { setReferenceOutfitUrl(''); }
                              return next;
                            });
                          }}
                          style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,80,80,0.5)', color: '#ff6b6b', cursor: 'pointer', fontSize: '10px', padding: '0', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}
                        >×</button>
                      </div>
                    </div>
                  ))}
                  {referenceOutfitUrls.length < 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div
                        onClick={() => document.getElementById('reference-outfit-upload-trigger')?.click()}
                        style={{
                          border: '1.5px dashed rgba(168,85,247,0.3)',
                          borderRadius: '8px',
                          aspectRatio: '3/4',
                          cursor: 'pointer',
                          background: 'rgba(168,85,247,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          transition: 'border-color 0.2s, background 0.2s'
                        }}
                        onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(168,85,247,0.6)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(168,85,247,0.07)'; }}
                        onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(168,85,247,0.3)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(168,85,247,0.03)'; }}
                      >
                        <span style={{ fontSize: '18px', opacity: 0.5 }}>➕</span>
                        <span style={{ fontSize: '8px', color: 'rgba(168,85,247,0.6)', textAlign: 'center', lineHeight: '1.3' }}>
                          {referenceOutfitUrls.length === 0 ? '上传\n参考图' : '添加\n参考图'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <input id="reference-outfit-upload-trigger" type="file" accept="image/*" multiple={true} onChange={handleReferenceOutfitUpload} style={{ display: 'none' }} />
              </div>

              {/* Outfit Suggestions Panel */}
              {(topClothingUrl || bottomClothingUrl || (referenceOutfitUrls && referenceOutfitUrls.length > 0)) && (
                <div style={{
                  background: 'rgba(138,43,226,0.06)',
                  border: '1px solid rgba(138,43,226,0.2)',
                  borderRadius: '8px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ✨ AI 穿搭与配饰推荐
                    </span>
                    {isStylingLoading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ border: '1.5px solid #c084fc', borderTop: '1.5px solid transparent', borderRadius: '50%', width: '9px', height: '9px', animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: '9px', color: '#c084fc' }}>设计搭配中...</span>
                      </div>
                    )}
                  </div>

                  {[
                    { label: '下装/上装款式搭配', val: matchingItemDesc, set: setMatchingItemDesc, placeholder: 'AI 根据服装设计自动生成...' },
                    { label: '鞋履搭配', val: shoesDesc, set: setShoesDesc, placeholder: 'AI 鞋子搭配建议...' },
                    { label: '首饰包包配饰 (可选)', val: accessoriesDesc, set: setAccessoriesDesc, placeholder: 'AI 配饰建议...' }
                  ].map(({ label, val, set, placeholder }) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>{label}</span>
                      <input
                        type="text"
                        value={val}
                        onChange={e => set(e.target.value)}
                        placeholder={placeholder}
                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', color: '#fff', fontSize: '10px', padding: '5px 8px', width: '100%', boxSizing: 'border-box' }}
                        disabled={isStylingLoading}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Generation Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                {(topClothingUrl || bottomClothingUrl || (referenceOutfitUrls && referenceOutfitUrls.length > 0)) && (
                  <button
                    onClick={handleGenerateModelOutfit}
                    disabled={isOutfitImgGenerating}
                    className="ai-btn"
                    style={{
                      background: isOutfitImgGenerating ? 'rgba(138,43,226,0.15)' : 'linear-gradient(135deg, rgba(138,43,226,0.25), rgba(99,102,241,0.25))',
                      borderColor: 'rgba(138,43,226,0.6)',
                      color: '#fff',
                      justifyContent: 'center',
                      fontSize: '12px',
                      padding: '9px 12px',
                      fontWeight: '600',
                      borderRadius: '8px'
                    }}
                  >
                    {isOutfitImgGenerating ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{ border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                        <span>正在渲染穿搭图...</span>
                      </div>
                    ) : (
                      <span>✨ 一键生成模特服装穿搭图</span>
                    )}
                  </button>
                )}

                {/* Generated Outfit Results */}
                {modelOutfitImgUrls && modelOutfitImgUrls.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>
                      已生成穿搭图 ({modelOutfitImgUrls.length} 套)
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {modelOutfitImgUrls.map((imgUrl, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div
                            style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid rgba(99,202,253,0.4)', aspectRatio: '3/4', background: 'rgba(0,0,0,0.3)', cursor: 'pointer' }}
                          >
                            <img 
                              src={imgUrl} 
                              alt={`outfit result ${idx + 1}`} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onClick={() => setPreviewModel({ src: imgUrl, name: `模特穿搭图 套${idx + 1}`, storyboardId: undefined })}
                            />
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', transition: 'background 0.2s', pointerEvents: 'none' }}
                              className="eye-overlay"
                            />
                            
                            {/* Delete button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`确定要删除第 ${idx + 1} 套已生成的模特穿搭图吗？`)) {
                                  handleDeleteOutfitImg(idx);
                                }
                              }}
                              style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                background: 'rgba(0,0,0,0.7)',
                                border: '1px solid rgba(255,80,80,0.5)',
                                color: '#ff6b6b',
                                cursor: 'pointer',
                                fontSize: '10px',
                                padding: '0',
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: '1',
                                zIndex: 10
                              }}
                              title="删除此穿搭图"
                            >×</button>

                            <div 
                              onClick={() => setPreviewModel({ src: imgUrl, name: `模特穿搭图 套${idx + 1}`, storyboardId: undefined })}
                              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)', padding: '5px 5px 4px' }}
                            >
                              <span style={{ fontSize: '8px', color: '#63cafd', fontWeight: '700' }}>套 {idx + 1}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : modelOutfitImgUrl ? (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(99,202,253,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(99,202,253,0.15)' }}>
                    <div
                      style={{ position: 'relative', width: '52px', height: '52px', cursor: 'pointer', overflow: 'hidden', borderRadius: '6px', border: '1.5px solid rgba(99,202,253,0.4)', flexShrink: 0 }}
                      onClick={() => setPreviewModel({ src: modelOutfitImgUrl, name: '模特服装穿搭效果图 (白底/灰底)', storyboardId: undefined })}
                    >
                      <img src={modelOutfitImgUrl} alt="Outfit try-on" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                        onMouseOver={e => (e.currentTarget as HTMLDivElement).style.opacity = '1'}
                        onMouseOut={e => (e.currentTarget as HTMLDivElement).style.opacity = '0'}>
                        <span style={{ fontSize: '10px', color: '#fff' }}>👁️</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#63cafd' }}>穿搭图已就绪</span>
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>纯色背景棚拍效果</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => {
                          if (confirm('确定要删除这套已生成的穿搭图吗？')) {
                            handleDeleteSingleOutfitImg();
                          }
                        }}
                        style={{ background: 'rgba(255, 82, 82, 0.1)', border: '1px solid rgba(255, 82, 82, 0.3)', color: '#ff7b7b', fontSize: '10px', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        title="删除穿搭图"
                      >
                        🗑️ 删除
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Step 1 Navigation Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                className="btn-primary"
                onClick={() => setAiWizardStep(2)}
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                下一步：配置场景分镜 ➔
              </button>
            </div>
          </>
        )}

        {aiWizardStep === 2 && (
          <>
            {/* I2V Storyboard Panel */}
            <div className="property-group" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
              <span className="property-label" style={{ marginBottom: '6px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)' }}>
                🎬 AI 智能图生视频分镜合成 (I2V 故事板)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>
                一键通过 AI 模特分镜图调用「图生视频大模型」，进行多视角的视频片段合成与无缝卡点剪辑拼接：
              </span>





              {/* Video Duration Selector */}
              <div className="property-group" style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>选择视频时长</span>
                <select
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(e.target.value as any)}
                  className="text-input"
                  style={{ padding: '6px', fontSize: '12px' }}
                >
                  <option value="3s">⏱️ 3秒 (分镜拼接 - 生成 5 段合成 15s 视频)</option>
                  <option value="15s">⏱️ 15秒 (可灵单任务或分镜拼接 - 15s 视频)</option>
                </select>
              </div>

              {/* Storyboard Generation Mode Selector */}
              <div className="property-group" style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>分镜图生成模式</span>
                <select
                  value={storyboardMode}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setStoryboardMode(val);
                    localStorage.setItem('ai_storyboard_mode', val);
                  }}
                  className="text-input"
                  style={{ padding: '6px', fontSize: '12px' }}
                >
                  <option value="individual">🖼️ 独立分镜逐个生成 (多图模式)</option>
                  <option value="composite_slice">✨ 合集单图生成并切割 (多分镜卡片)</option>
                  <option value="composite_no_slice">🎬 16:9 合图不切割 (整图传视频模型)</option>
                </select>
              </div>

              {/* Checkbox for Subtitles and Stickers */}
              <div className="property-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={includeI2VSubtitles}
                    onChange={(e) => setIncludeI2VSubtitles(e.target.checked)}
                  />
                  生成并添加卖点字幕文案
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={includeI2VStickers}
                    onChange={(e) => setIncludeI2VStickers(e.target.checked)}
                  />
                  生成并添加 AI 贴纸
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={useSlowMotion}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setUseSlowMotion(val);
                      localStorage.setItem('ai_use_slow_motion', String(val));
                    }}
                  />
                  🏃‍♂️ 人物慢动作，注重镜头运镜
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', width: '100%' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>视频分镜推广重点</span>
                  <select
                    value={clothingFocus}
                    onChange={(e) => {
                      const val = e.target.value as 'top' | 'bottom' | 'both';
                      setClothingFocus(val);
                      localStorage.setItem('ai_clothing_focus', val);
                    }}
                    className="text-input"
                    style={{ padding: '6px', fontSize: '12px', width: '100%', background: 'rgba(0,0,0,0.2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="both">👗 整体搭配 / 两者同样重要</option>
                    <option value="top">👕 重点推广上装</option>
                    <option value="bottom">👖 重点推广下装</option>
                  </select>
                </div>
              </div>

              {/* Step 1: Generate Storyboards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                <button
                  className="ai-btn"
                  onClick={handleGenerateStoryboards}
                  style={{
                    background: isStoryboardGenerating
                      ? 'linear-gradient(135deg, #ff5252, #ff7b7b)'
                      : 'rgba(255,255,255,0.04)',
                    borderColor: isStoryboardGenerating
                      ? 'rgba(255, 82, 82, 0.6)'
                      : (i2vStep !== 'idle' ? 'var(--accent-purple)' : 'var(--border-color)'),
                    color: '#fff',
                    justifyContent: 'center',
                    boxShadow: isStoryboardGenerating ? '0 0 12px rgba(255, 82, 82, 0.4)' : 'none'
                  }}
                >
                  {isStoryboardGenerating ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🛑</span>
                      <span>停止生成 (点击中断)</span>
                    </div>
                  ) : (
                    <>
                      <span style={{ marginRight: '4px' }}>1️⃣</span> 一键生成模特场景分镜图
                    </>
                  )}
                </button>

                {storyboards.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    {storyboards.map((sb) => (
                      <div key={sb.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                        <div
                          onMouseOver={(e) => {
                            const overlay = e.currentTarget.querySelector('.storyboard-hover-overlay') as HTMLElement;
                            if (overlay) overlay.style.opacity = '1';
                          }}
                          onMouseOut={(e) => {
                            const overlay = e.currentTarget.querySelector('.storyboard-hover-overlay') as HTMLElement;
                            if (overlay) overlay.style.opacity = '0';
                          }}
                          style={{
                            width: '100%',
                            height: '54px',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.1)',
                            position: 'relative',
                            background: '#000',
                            cursor: 'default'
                          }}
                        >
                          <img src={sb.imageSrc} alt={sb.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                          {sb.isGeneratingImage && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', zIndex: 10 }}>
                              <div style={{ border: '2px solid #fff', borderTop: '2px solid var(--accent-purple)', borderRadius: '50%', width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                              <span style={{ fontSize: '8px', color: 'var(--accent-purple)', fontWeight: 'bold' }}>生成中...</span>
                            </div>
                          )}

                          {isRegeneratingShotId === sb.id && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', zIndex: 10 }}>
                              <div style={{ border: '2px solid #fff', borderTop: '2px solid var(--accent-purple)', borderRadius: '50%', width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                              <span style={{ fontSize: '7px', color: 'var(--accent-purple)', fontWeight: 'bold' }}>重做中...</span>
                            </div>
                          )}

                          {isRegeneratingShotId !== sb.id && !sb.isGeneratingImage && (
                            <div
                              className="storyboard-hover-overlay"
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(0,0,0,0.75)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                opacity: 0,
                                transition: 'opacity 0.2s',
                                zIndex: 5
                              }}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewModel({ src: sb.imageSrc, name: `${sb.name} (静态分镜)`, storyboardId: sb.id });
                                }}
                                style={{
                                  background: 'rgba(255,255,255,0.2)',
                                  border: 'none',
                                  borderRadius: '50%',
                                  color: '#fff',
                                  width: '20px',
                                  height: '20px',
                                  fontSize: '10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                                title="预览图片"
                              >
                                👁️
                              </button>
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={sb.name}>
                          {sb.shotType === 'full-body' ? '全身展示' : sb.shotType === 'medium' ? '半身中景' : sb.shotType === 'close-up' ? '细节特写' : sb.shotType === 'shot-1' ? '分镜一 (0-3s)' : sb.shotType === 'shot-2' ? '分镜二 (3-5s)' : sb.shotType === 'shot-3' ? '分镜三 (5-8s)' : sb.shotType === 'shot-4' ? '分镜四 (8-12s)' : '分镜五 (12-15s)'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Editable Storyboard Prompts */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    🖊️ 编辑各分镜 Prompt 提示词 ({videoDuration === '15s' || videoDuration === '3s' ? '15s 模式 - 5段' : '4s 模式 - 3段'})
                  </span>
                  {modelOutfitImgUrl && (
                    <button
                      onClick={handleGeneratePromptsFromSkill}
                      disabled={isGeneratingPromptsFromSkill}
                      className="ai-btn"
                      style={{
                        padding: '4px 8px',
                        fontSize: '9px',
                        background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                        borderColor: 'transparent',
                        color: '#fff',
                        margin: 0,
                        height: 'auto',
                        lineHeight: '1.2',
                        cursor: isGeneratingPromptsFromSkill ? 'not-allowed' : 'pointer'
                      }}
                      title="根据模特穿搭图调用 I2V 规约智能生成分镜提示词"
                    >
                      {isGeneratingPromptsFromSkill ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ border: '1.5px solid #fff', borderTop: '1.5px solid transparent', borderRadius: '50%', width: '8px', height: '8px', animation: 'spin 1s linear infinite' }} />
                          AI 编排中...
                        </div>
                      ) : (
                        <>✨ 基于穿搭图智能编排</>
                      )}
                    </button>
                  )}
                </div>

                {(videoDuration === '15s' || videoDuration === '3s') ? (
                  storyboardMode === 'composite_no_slice' ? (
                    <div className="property-group" style={{ marginBottom: 0, width: '100%' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>15s 视频完整脚本提示词 (一整段叙事)</span>
                      <textarea
                        value={i2vMasterPrompt15s}
                        onChange={(e) => setI2vMasterPrompt15s(e.target.value)}
                        className="text-input"
                        rows={9}
                        style={{
                          padding: '8px 12px',
                          fontSize: '11px',
                          lineHeight: '1.6',
                          width: '100%',
                          resize: 'vertical',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '4px',
                          color: '#fff',
                          fontFamily: 'inherit',
                          outline: 'none'
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        placeholder="15秒快节奏连贯 5 幕叙事，引用参考图作为服装和模特的严格一致性参考。场景设定：[场景] 第一幕：... 镜头切换（Cut to）第二幕：... 原生音效：..."
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(() => {
                        const parsed = parse15sMasterPrompt(i2vMasterPrompt15s);
                        const updateShotPrompt = (shotKey: 'shot-1' | 'shot-2' | 'shot-3' | 'shot-4' | 'shot-5', newVal: string) => {
                          const currentProjId = activeProjectId;
                          if (!currentProjId) return;
                          
                          parsed[shotKey] = newVal;
                          
                          // Re-assemble the master prompt
                          const audioMarker = '原生音效：';
                          const audioIdx = i2vMasterPrompt15s.indexOf(audioMarker);
                          const audioPart = audioIdx !== -1 ? i2vMasterPrompt15s.substring(audioIdx + audioMarker.length).trim() : '高级环境底噪 + 衣服摩擦与高跟鞋脚步拟音 Foley + 舒缓音乐 BGM。';
                          
                          const newMasterPrompt = `15秒快节奏连贯 5 幕叙事，引用参考图作为服装和模特的严格一致性参考。第一幕：${parsed['shot-1']} 镜头切换（Cut to）第二幕：${parsed['shot-2']} 镜头切换（Cut to）第三幕：${parsed['shot-3']} 镜头切换（Cut to）第四幕：${parsed['shot-4']} 镜头切换（Cut to）第五幕：${parsed['shot-5']} 原生音效：${audioPart}`;
                          
                          setI2vMasterPrompt15s(newMasterPrompt);
                          setProjectI2vMasterPrompt15s(currentProjId, newMasterPrompt);
                        };

                        return (
                          <>
                            <div className="property-group" style={{ marginBottom: 0 }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>分镜一：全身走秀出场 (0-3s)</span>
                              <textarea
                                value={parsed['shot-1']}
                                onChange={(e) => updateShotPrompt('shot-1', e.target.value)}
                                className="text-input"
                                rows={3}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '11px',
                                  lineHeight: '1.6',
                                  width: '100%',
                                  resize: 'vertical',
                                  background: 'rgba(0,0,0,0.3)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '4px',
                                  color: '#fff',
                                  fontFamily: 'inherit',
                                  outline: 'none'
                                }}
                              />
                            </div>
                            <div className="property-group" style={{ marginBottom: 0 }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>分镜二：下半身聚焦 (3-6s)</span>
                              <textarea
                                value={parsed['shot-2']}
                                onChange={(e) => updateShotPrompt('shot-2', e.target.value)}
                                className="text-input"
                                rows={3}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '11px',
                                  lineHeight: '1.6',
                                  width: '100%',
                                  resize: 'vertical',
                                  background: 'rgba(0,0,0,0.3)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '4px',
                                  color: '#fff',
                                  fontFamily: 'inherit',
                                  outline: 'none'
                                }}
                              />
                            </div>
                            <div className="property-group" style={{ marginBottom: 0 }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>分镜三：手部捏褶细节 (6-9s)</span>
                              <textarea
                                value={parsed['shot-3']}
                                onChange={(e) => updateShotPrompt('shot-3', e.target.value)}
                                className="text-input"
                                rows={3}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '11px',
                                  lineHeight: '1.6',
                                  width: '100%',
                                  resize: 'vertical',
                                  background: 'rgba(0,0,0,0.3)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '4px',
                                  color: '#fff',
                                  fontFamily: 'inherit',
                                  outline: 'none'
                                }}
                              />
                            </div>
                            <div className="property-group" style={{ marginBottom: 0 }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>分镜四：特写回拉全身 (9-12s)</span>
                              <textarea
                                value={parsed['shot-4']}
                                onChange={(e) => updateShotPrompt('shot-4', e.target.value)}
                                className="text-input"
                                rows={3}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '11px',
                                  lineHeight: '1.6',
                                  width: '100%',
                                  resize: 'vertical',
                                  background: 'rgba(0,0,0,0.3)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '4px',
                                  color: '#fff',
                                  fontFamily: 'inherit',
                                  outline: 'none'
                                }}
                              />
                            </div>
                            <div className="property-group" style={{ marginBottom: 0 }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>分镜五：换景全身定格 (12-15s)</span>
                              <textarea
                                value={parsed['shot-5']}
                                onChange={(e) => updateShotPrompt('shot-5', e.target.value)}
                                className="text-input"
                                rows={3}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '11px',
                                  lineHeight: '1.6',
                                  width: '100%',
                                  resize: 'vertical',
                                  background: 'rgba(0,0,0,0.3)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '4px',
                                  color: '#fff',
                                  fontFamily: 'inherit',
                                  outline: 'none'
                                }}
                              />
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )
                ) : (
                  <>
                    <div className="property-group" style={{ marginBottom: 0 }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>分镜一 (全身远景)</span>
                      <input
                        type="text"
                        value={i2vPrompts['full-body']}
                        onChange={(e) => setI2vPrompts(prev => ({ ...prev, 'full-body': e.target.value }))}
                        className="text-input"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="property-group" style={{ marginBottom: 0 }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>分镜二 (半身中景)</span>
                      <input
                        type="text"
                        value={i2vPrompts['medium']}
                        onChange={(e) => setI2vPrompts(prev => ({ ...prev, 'medium': e.target.value }))}
                        className="text-input"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                      />
                    </div>
                    <div className="property-group" style={{ marginBottom: 0 }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>分镜三 (细节特写)</span>
                      <input
                        type="text"
                        value={i2vPrompts['close-up']}
                        onChange={(e) => setI2vPrompts(prev => ({ ...prev, 'close-up': e.target.value }))}
                        className="text-input"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Next/Prev Navigation */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '4px' }}>
              <button
                className="btn-secondary"
                onClick={() => setAiWizardStep(1)}
                style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', borderRadius: '8px', width: '48%', margin: 0 }}
              >
                ⬅ 上一步
              </button>
              <button
                className="btn-primary"
                onClick={() => setAiWizardStep(3)}
                disabled={storyboards.length === 0}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  cursor: storyboards.length === 0 ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  opacity: storyboards.length === 0 ? 0.5 : 1,
                  width: '48%',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
                title={storyboards.length === 0 ? '请先一键生成分镜图再进入下一步' : ''}
              >
                下一步：生成视频 ➔
              </button>
            </div>
          </>
        )}

        {aiWizardStep === 3 && (
          <>
            <div className="property-group" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span className="property-label" style={{ marginBottom: '4px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-purple)' }}>
                🎥 AI 视频生成与合成
              </span>

              {/* Generated Videos / Status Grid */}
              {storyboards.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                    🎬 各分镜视频生成与预览
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {storyboards.map((sb) => (
                      <div key={sb.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                        <div
                          onMouseOver={(e) => {
                            const overlay = e.currentTarget.querySelector('.storyboard-video-overlay') as HTMLElement;
                            if (overlay) overlay.style.opacity = '1';
                          }}
                          onMouseOut={(e) => {
                            const overlay = e.currentTarget.querySelector('.storyboard-video-overlay') as HTMLElement;
                            if (overlay) overlay.style.opacity = '0';
                          }}
                          style={{
                            width: '100%',
                            height: '54px',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            border: '1px solid ' + (sb.videoSrc ? 'rgba(0, 242, 254, 0.4)' : 'rgba(255,255,255,0.08)'),
                            position: 'relative',
                            background: '#000',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setPreviewVideo({ id: sb.id, src: sb.videoSrc || '', name: sb.name });
                          }}
                        >
                          <img src={sb.imageSrc} alt={sb.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: sb.videoSrc ? 0.85 : 0.4 }} />



                          {/* Generating Video Progress Spinner */}
                          {sb.isGeneratingVideo && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', zIndex: 10 }}>
                              <div style={{ border: '2px solid #fff', borderTop: '2px solid var(--accent-cyan)', borderRadius: '50%', width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                              <span style={{ fontSize: '8px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{sb.progress}%</span>
                            </div>
                          )}

                          {/* Play Icon Hover Overlay */}
                          {sb.videoSrc && !sb.isGeneratingVideo && (
                            <div
                              className="storyboard-video-overlay"
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(0,0,0,0.6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0,
                                transition: 'opacity 0.2s',
                                zIndex: 5
                              }}
                            >
                              <span style={{ fontSize: '16px', color: 'var(--accent-cyan)' }}>▶</span>
                            </div>
                          )}

                          {/* Dynamic Video Badge */}
                          {sb.videoSrc && (
                            <div style={{ position: 'absolute', bottom: '2px', right: '2px', background: 'var(--accent-cyan)', color: '#090a0f', borderRadius: '2px', padding: '1px 3px', fontSize: '8px', fontWeight: 'bold', zIndex: 2 }}>
                              🎥 播放
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '8px', color: sb.videoSrc ? 'var(--accent-cyan)' : 'var(--text-muted)', marginTop: '4px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={sb.name}>
                          {sb.shotType === 'full-body' ? '全身展示' : sb.shotType === 'medium' ? '半身中景' : sb.shotType === 'close-up' ? '细节特写' : sb.shotType === 'shot-1' ? '分镜一' : sb.shotType === 'shot-2' ? '分镜二' : sb.shotType === 'shot-3' ? '分镜三' : sb.shotType === 'shot-4' ? '分镜四' : '分镜五'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Video Model Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>选择图生视频大模型</span>
                <select
                  value={videoModel}
                  onChange={(e) => {
                    setVideoModel(e.target.value);
                    localStorage.setItem('ai_video_model', e.target.value);
                  }}
                  className="text-input"
                  style={{ padding: '6px', fontSize: '12px' }}
                >
                  <option value="kling-v3-omni">🎥 kling-v3-omni (快手可灵 v3.0)</option>
                  <option value="viduq2">🎥 viduq2 (Vidu 2.0 - 极速推荐)</option>
                  <option value="veo-3.1-fast-generate-001">🎥 veo-3.1-fast-generate-001 (Google Veo)</option>
                  <option value="MiniMax-Hailuo-2.3">🎥 MiniMax-Hailuo-2.3 (海螺 AI)</option>
                </select>
              </div>

              {/* Video Generation Trigger */}
              <button
                className="ai-btn"
                onClick={handleGenerateI2V}
                style={{
                  background: isI2vGenerating
                    ? 'linear-gradient(135deg, #ff5252, #ff7b7b)'
                    : 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                  boxShadow: isI2vGenerating ? '0 0 12px rgba(255, 82, 82, 0.4)' : 'none',
                  marginTop: '6px',
                  justifyContent: 'center'
                }}
              >
                <span className="ai-icon">{isI2vGenerating ? '🛑' : '✨'}</span> {isI2vGenerating ? '停止生成 (点击中断)' : '一键调用图生视频模型'}
              </button>

              {/* Apply to Timeline */}
              {i2vStep === 'video_generated' && (
                <button
                  className="ai-btn"
                  onClick={handleApplyI2VToTimeline}
                  style={{ background: 'linear-gradient(135deg, #00f2fe, #4facfe)', color: '#090a0f', fontWeight: 'bold', justifyContent: 'center', marginTop: '6px' }}
                >
                  <span>🎬</span> 一键拼接导入时间轴播放
                </button>
              )}
            </div>

            {/* Next/Prev Navigation */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start', marginTop: '4px' }}>
              <button
                className="btn-secondary"
                onClick={() => setAiWizardStep(2)}
                style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', borderRadius: '8px', width: '100%', margin: 0 }}
              >
                ⬅ 上一步：返回场景分镜
              </button>
            </div>
          </>
        )}



            <div className="property-group" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setShowConfig(!showConfig)}
              >
                <span className="property-label" style={{ margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚙️ AI 服务与网关状态 🟢
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{showConfig ? '收起 ▲' : '展开 ▼'}</span>
              </div>

              {showConfig && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  <div style={{ padding: '8px', borderRadius: '4px', background: 'rgba(0, 240, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.1)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    <strong>🔒 独立后端托管密钥：</strong>
                    <br />
                    系统已升级为独立的后端微服务架构。您的网关地址、Token、阿里 OSS 密钥均已由后端服务安全托管，前端不再保留明文密钥以确保运行安全。
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>服务地址:</span>
                    <span style={{ color: 'var(--accent-cyan)' }}>{import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 6. AUDIO AND TTS */}
      {activeTab === 'audio' && (
        <>
          <div className="drawer-header">
            <div className="drawer-title">背景音乐与配音</div>
            <div className="drawer-subtitle">为视频匹配节奏感，添加真实人声配音</div>
          </div>
          <div className="drawer-content">
            <div className="property-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="property-label" style={{ margin: 0 }}>🎵 背景音乐库 (BGM)</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {isTauri && (
                    <button
                      className="btn-primary"
                      onClick={handleImportLocalAudio}
                      style={{ padding: '3px 8px', fontSize: '10px', cursor: 'pointer', margin: 0, borderRadius: '4px', height: 'auto', display: 'inline-flex', alignItems: 'center', background: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)' }}
                    >
                      导入本地音频
                    </button>
                  )}
                  <label className="btn-primary" style={{ padding: '3px 8px', fontSize: '10px', cursor: 'pointer', margin: 0, borderRadius: '4px', height: 'auto', display: 'inline-flex', alignItems: 'center' }}>
                    上传音乐
                    <input type="file" accept="audio/*" onChange={handleBgmUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '480px', overflowY: 'auto' }}>
                {bgmLibrary.map(bgm => (
                  <div key={bgm.id} className="music-item" onClick={() => selectBgm(bgm.src, bgm.name)} title="点击设置为背景音乐" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '60px', position: 'relative' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="music-name">{bgm.name}</div>
                      <div className="music-meta">{bgm.desc || '自定义上传音乐'}</div>
                    </div>
                    <div style={{ position: 'absolute', right: '35px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={(e) => togglePreviewAudio(e, bgm.src)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '14px', padding: '4px' }}
                        title={previewAudioSrc === bgm.src ? '暂停试听' : '点击试听'}
                      >
                        {previewAudioSrc === bgm.src ? '⏸️' : '▶️'}
                      </button>
                    </div>
                    <button
                      onClick={(e) => handleBgmDelete(e, bgm.id)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#ff5252',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      title="删除音乐"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {bgmLibrary.length === 0 && (
                  <div style={{ padding: '10px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '4px', marginTop: '4px' }}>
                    暂无自定义上传音乐，点击右上角「上传音乐」进行维护。
                  </div>
                )}
              </div>
            </div>


          </div>
        </>
      )}

      {/* AI Model Generation Modal */}
      {isGenModelModalOpen && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 10, 15, 0.82)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{
            width: '460px',
            background: 'rgba(20, 21, 31, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(138, 43, 226, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🧍 AI 智能模特参考卡生成
              </h3>
              <button
                onClick={() => setIsGenModelModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px', transition: 'color 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
              >
                ×
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', lineHeight: '1.5' }}>
              系统将根据性别和肤色设定，智能生成纯色打底、白底的三视图专属模特卡（包含模特正脸、侧脸和全身姿态），并自动保存至“我的 AI 模特库”中，用于后期多镜头视频生成的肖像对齐参考。
            </p>

            {/* 模特肖像/姿态参考图上传 */}
            <div className="property-group" style={{ gap: '6px' }}>
              <span className="property-label" style={{ fontSize: '11px', color: '#d1d5db', fontWeight: '500' }}>上传肖像/姿态参考图 (可选)</span>
              {modelRefImageUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <img src={modelRefImageUrl} alt="model reference" style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'contain', background: '#000', border: '1px solid rgba(255,255,255,0.1)' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '12px', color: '#f3f4f6', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      已关联模特参考图
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--accent-cyan)' }}>AI 绘图将参考该肖像/姿态特征</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => document.getElementById('modal-model-ref-upload-trigger')?.click()}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', padding: '5px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                    >
                      重新上传
                    </button>
                    <button
                      onClick={() => setModelRefImageUrl('')}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-red)', fontSize: '12px', cursor: 'pointer' }}
                    >
                      清除
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => document.getElementById('modal-model-ref-upload-trigger')?.click()}
                  style={{
                    border: '1.5px dashed var(--border-color)',
                    borderRadius: '8px',
                    padding: '16px 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.01)',
                    transition: 'border-color 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <span style={{ fontSize: '20px' }}>👤</span>
                  <span style={{ fontSize: '11px', color: '#e5e7eb', fontWeight: '500' }}>点击上传模特参考图（可选）</span>
                  <span style={{ fontSize: '9px', color: '#6b7280' }}>上传后，AI 会根据您提供的面部/发型/姿态进行绘制</span>
                </div>
              )}
              <input
                id="modal-model-ref-upload-trigger"
                type="file"
                accept="image/*"
                onChange={handleModelRefUpload}
                style={{ display: 'none' }}
              />
            </div>

            {/* 1. 模特性别 & 肤色地域 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="property-group">
                <span className="property-label" style={{ fontSize: '11px', color: '#d1d5db', fontWeight: '500' }}>1. 模特性别</span>
                <select
                  value={modelGender}
                  onChange={(e) => setModelGender(e.target.value as any)}
                  className="text-input"
                  style={{ padding: '8px', fontSize: '12px' }}
                >
                  <option value="female">女性 (Female)</option>
                  <option value="male">男性 (Male)</option>
                </select>
              </div>
              <div className="property-group">
                <span className="property-label" style={{ fontSize: '11px', color: '#d1d5db', fontWeight: '500' }}>2. 肤色地域</span>
                <select
                  value={modelRegion}
                  onChange={(e) => setModelRegion(e.target.value as any)}
                  className="text-input"
                  style={{ padding: '8px', fontSize: '12px' }}
                >
                  <option value="east-asian">东亚模特 (East Asian)</option>
                  <option value="western">欧美模特 (Western)</option>
                </select>
              </div>
            </div>

            {/* 2. 自定义 Prompt */}
            <div className="property-group">
              <span className="property-label" style={{ fontSize: '11px', color: '#d1d5db', fontWeight: '500' }}>3. 自定义特征 Prompt 描述词 (可选)</span>
              <textarea
                placeholder="例如：发型、发色、身材特征（如：金色短发、面带微笑）。默认情况下，系统会自动控制模特穿着最简约的安全打底（男模穿米色T恤+短裤，女模穿米色背心+短裤）以防安全拦截机制。"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="text-input"
                rows={3}
                style={{ resize: 'none', padding: '8px', fontSize: '12px', fontFamily: 'inherit' }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => setIsGenModelModalOpen(false)}
                style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  setIsGenModelModalOpen(false);
                  await handleCustomModelSwap();
                }}
                style={{
                  padding: '8px 20px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  background: 'var(--accent-purple)',
                  borderColor: 'var(--accent-purple)',
                  boxShadow: '0 0 10px var(--accent-purple-glow)'
                }}
              >
                一键生成参考模特卡
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* AI Scene Preview Modal */}
      {previewScene && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 10, 15, 0.85)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.25s ease-out'
        }} onClick={() => setPreviewScene(null)}>
          <div style={{
            position: 'relative',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxSizing: 'border-box',
            background: 'rgba(20, 21, 31, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 40px rgba(138, 43, 226, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              {isEditingSceneName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>🖼️</span>
                  <input
                    type="text"
                    value={editingSceneNameValue}
                    onChange={(e) => setEditingSceneNameValue(e.target.value)}
                    className="text-input"
                    style={{ padding: '4px 8px', fontSize: '13px', width: '180px', margin: 0, height: '28px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '4px', color: '#fff' }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveSceneName();
                    }}
                  />
                  <button
                    onClick={handleSaveSceneName}
                    style={{ background: 'none', border: 'none', color: '#4caf50', cursor: 'pointer', fontSize: '15px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="保存"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setIsEditingSceneName(false)}
                    style={{ background: 'none', border: 'none', color: '#ff5252', cursor: 'pointer', fontSize: '15px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="取消"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🖼️ 背景场景: {previewScene.name}
                  {previewScene.id && (
                    <button
                      onClick={() => {
                        setEditingSceneNameValue(previewScene.name);
                        setIsEditingSceneName(true);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="修改名称"
                    >
                      ✎
                    </button>
                  )}
                </h3>
              )}
              <button
                onClick={() => setPreviewScene(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '4px',
                  lineHeight: '1',
                  transition: 'color 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                ×
              </button>
            </div>

            {/* Image Container */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
              background: '#0c0d12',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              maxWidth: '100%',
              maxHeight: '40vh',
              width: 'auto'
            }}>
              <img
                src={previewScene.src}
                alt={previewScene.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '40vh',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>

            {/* Prompt edit row for custom backgrounds */}
            {previewScene.id !== undefined && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', width: '100%' }}>
                  <textarea
                    value={sceneEditPrompt}
                    onChange={(e) => setSceneEditPrompt(e.target.value)}
                    placeholder="输入场景修改提示词（例如：改为秋天落叶风格、将光线调暗一些、增加复古家具...），留空则按原配置重新生成"
                    rows={2}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      padding: '8px 12px',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      outline: 'none',
                      lineHeight: '1.5'
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <button
                className="btn-secondary"
                onClick={() => setPreviewScene(null)}
                style={{ padding: '8px 20px', fontSize: '12px', cursor: 'pointer' }}
                disabled={isGeneratingAiScene}
              >
                关闭
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  applySceneBackground(previewScene.name, previewScene.src);
                  setPreviewScene(null);
                }}
                style={{
                  padding: '8px 20px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff'
                }}
                disabled={isGeneratingAiScene}
              >
                应用此背景
              </button>
              {previewScene.id !== undefined && (
                <button
                  className="btn-primary"
                  onClick={handleRegenerateScene}
                  style={{
                    padding: '8px 20px',
                    fontSize: '12px',
                    cursor: isGeneratingAiScene ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                    border: 'none',
                    boxShadow: '0 0 10px rgba(138, 43, 226, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: isGeneratingAiScene ? 0.7 : 1
                  }}
                  disabled={isGeneratingAiScene}
                >
                  {isGeneratingAiScene ? (
                    <>
                      <div style={{ border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', width: '10px', height: '10px', animation: 'spin 1s linear infinite' }} />
                      重新生成中...
                    </>
                  ) : (
                    <>🔄 {sceneEditPrompt.trim() ? '按提示词重新生成' : '重新生成背景'}</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* AI Model Preview Modal */}
      {previewModel && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 10, 15, 0.85)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.25s ease-out'
        }} onClick={() => setPreviewModel(null)}>
          <div style={{
            position: 'relative',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxSizing: 'border-box',
            background: 'rgba(20, 21, 31, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 40px rgba(138, 43, 226, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              {isEditingModelName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>👤</span>
                  <input
                    type="text"
                    value={editingModelNameValue}
                    onChange={(e) => setEditingModelNameValue(e.target.value)}
                    className="text-input"
                    style={{ padding: '4px 8px', fontSize: '13px', width: '180px', margin: 0, height: '28px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '4px', color: '#fff' }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveModelPreviewName();
                    }}
                  />
                  <button
                    onClick={handleSaveModelPreviewName}
                    style={{ background: 'none', border: 'none', color: '#4caf50', cursor: 'pointer', fontSize: '15px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="保存"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setIsEditingModelName(false)}
                    style={{ background: 'none', border: 'none', color: '#ff5252', cursor: 'pointer', fontSize: '15px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="取消"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  👤 模特预览: {previewModel.name}
                  {previewModel.id && (
                    <button
                      onClick={() => {
                        setEditingModelNameValue(previewModel.name);
                        setIsEditingModelName(true);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="修改名称"
                    >
                      ✎
                    </button>
                  )}
                </h3>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Sleek Download Button */}
                <button
                  onClick={() => handleDownloadImage(previewModel.src, previewModel.name || 'model_outfit_image')}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '4px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                    e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                  title="下载当前预览的图片"
                >
                  📥 下载
                </button>
                
                <button
                  onClick={() => setPreviewModel(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '20px',
                    padding: '4px',
                    lineHeight: '1',
                    transition: 'color 0.2s'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = '#ffffff')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Image Body with Navigation Arrows */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              width: '100%',
              position: 'relative'
            }}>
              {/* Left Arrow Button */}
              {previewModel.storyboardId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const idx = storyboards.findIndex(s => s.id === previewModel.storyboardId);
                    if (idx > 0) {
                      const prevSb = storyboards[idx - 1];
                      setPreviewModel({ src: prevSb.imageSrc, name: `${prevSb.name} (静态分镜)`, storyboardId: prevSb.id });
                    }
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    color: '#fff',
                    width: '36px',
                    height: '36px',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: storyboards.findIndex(s => s.id === previewModel.storyboardId) > 0 ? 1 : 0.2,
                    pointerEvents: storyboards.findIndex(s => s.id === previewModel.storyboardId) > 0 ? 'auto' : 'none',
                    transition: 'all 0.2s',
                    padding: 0,
                    lineHeight: '1'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.borderColor = 'var(--accent-purple)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  title="上一个分镜"
                  disabled={isRegeneratingShotId === previewModel.storyboardId}
                >
                  ‹
                </button>
              )}

              {/* Image Container */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                background: '#0c0d12',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                maxHeight: '50vh',
                minWidth: '320px',
                flex: 1,
                position: 'relative'
              }}>
                <img
                  src={previewModel.src}
                  alt={previewModel.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '50vh',
                    objectFit: 'contain',
                    display: 'block',
                    opacity: (previewModel.storyboardId && isRegeneratingShotId === previewModel.storyboardId) || (previewModel.src === modelOutfitImgUrl && isOutfitImgGenerating) ? 0.3 : 1,
                    transition: 'opacity 0.2s'
                  }}
                />
                {previewModel.storyboardId && isRegeneratingShotId === previewModel.storyboardId && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(0,0,0,0.4)', zIndex: 10 }}>
                    <div style={{ border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid var(--accent-purple)', borderRadius: '50%', width: '32px', height: '32px', animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '11px', color: 'var(--accent-purple)', fontWeight: 'bold' }}>正在努力重新生成，请稍候...</span>
                  </div>
                )}
                {previewModel.src === modelOutfitImgUrl && isOutfitImgGenerating && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(0,0,0,0.4)', zIndex: 10 }}>
                    <div style={{ border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid var(--accent-purple)', borderRadius: '50%', width: '32px', height: '32px', animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '11px', color: 'var(--accent-purple)', fontWeight: 'bold' }}>正在努力重新生成，请稍候...</span>
                  </div>
                )}
              </div>

              {/* Right Arrow Button */}
              {previewModel.storyboardId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const idx = storyboards.findIndex(s => s.id === previewModel.storyboardId);
                    if (idx >= 0 && idx < storyboards.length - 1) {
                      const nextSb = storyboards[idx + 1];
                      setPreviewModel({ src: nextSb.imageSrc, name: `${nextSb.name} (静态分镜)`, storyboardId: nextSb.id });
                    }
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    color: '#fff',
                    width: '36px',
                    height: '36px',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: storyboards.findIndex(s => s.id === previewModel.storyboardId) < storyboards.length - 1 ? 1 : 0.2,
                    pointerEvents: storyboards.findIndex(s => s.id === previewModel.storyboardId) < storyboards.length - 1 ? 'auto' : 'none',
                    transition: 'all 0.2s',
                    padding: 0,
                    lineHeight: '1'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.borderColor = 'var(--accent-purple)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  title="下一个分镜"
                  disabled={isRegeneratingShotId === previewModel.storyboardId}
                >
                  ›
                </button>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
              {previewModel.storyboardId ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                  {/* Prompt edit row */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', width: '100%' }}>
                    <textarea
                      value={storyboardEditPrompt}
                      onChange={(e) => setStoryboardEditPrompt(e.target.value)}
                      placeholder="输入修改/局部重绘提示词（例如：让模特正面微笑、更换特定背景、换个拍摄角度...），留空则按原分镜配置重新生成"
                      rows={2}
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                        padding: '8px 12px',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        outline: 'none',
                        lineHeight: '1.5'
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                      disabled={isRegeneratingShotId === previewModel.storyboardId}
                    />
                  </div>
                  {/* Scene reference image upload row */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', flexShrink: 0 }}>场景参考图：</span>
                    {storyboardRegenBgUrl ? (
                      <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                        <img
                          src={storyboardRegenBgUrl}
                          alt="场景参考"
                          style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(138,43,226,0.5)' }}
                        />
                        <button
                          onClick={() => setStoryboardRegenBgUrl(null)}
                          style={{
                            position: 'absolute', top: '-6px', right: '-6px',
                            width: '16px', height: '16px', borderRadius: '50%',
                            background: 'rgba(255,60,60,0.85)', border: 'none', color: '#fff',
                            fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1'
                          }}
                          title="移除场景参考图"
                        >✕</button>
                      </div>
                    ) : (
                      <label
                        htmlFor="storyboard-regen-bg-upload"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
                          background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.2)',
                          color: 'rgba(255,255,255,0.6)', fontSize: '11px',
                          transition: 'all 0.2s', whiteSpace: 'nowrap'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                        title="上传新的场景参考图，替换当前场景背景"
                      >
                        <span style={{ fontSize: '14px' }}>🖼️</span>
                        上传场景参考图
                        <input
                          id="storyboard-regen-bg-upload"
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          disabled={isRegeneratingShotId === previewModel.storyboardId}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const result = ev.target?.result as string;
                              if (result) setStoryboardRegenBgUrl(result);
                            };
                            reader.readAsDataURL(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                    {storyboardRegenBgUrl && (
                      <span style={{ fontSize: '10px', color: 'rgba(138,200,100,0.85)' }}>✓ 将使用此图作为场景参考</span>
                    )}
                  </div>
                  {/* Action buttons row */}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      className="btn-secondary"
                      onClick={() => setPreviewModel(null)}
                      style={{ padding: '8px 20px', fontSize: '12px', cursor: 'pointer' }}
                      disabled={isRegeneratingShotId === previewModel.storyboardId}
                    >
                      关闭
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => handleRegenerateStoryboard(previewModel.storyboardId!, storyboardEditPrompt, storyboardRegenBgUrl)}
                      style={{
                        padding: '8px 20px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                        border: 'none',
                        boxShadow: '0 0 10px rgba(138, 43, 226, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      disabled={isRegeneratingShotId === previewModel.storyboardId}
                    >
                      {isRegeneratingShotId === previewModel.storyboardId ? (
                        <>
                          <div style={{ border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', width: '10px', height: '10px', animation: 'spin 1s linear infinite' }} />
                          重新生成中...
                        </>
                      ) : (
                        <>🔄 重新生成此分镜</>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* If this is the standalone outfit image, show edit prompt + regenerate */}
                  {previewModel.storyboardId === undefined && (previewModel.src === modelOutfitImgUrl || modelOutfitImgUrls.includes(previewModel.src)) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                      {/* Prompt edit row with Pose Image Uploader */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                        <textarea
                          value={outfitEditPrompt}
                          onChange={(e) => setOutfitEditPrompt(e.target.value)}
                          placeholder="输入修改提示词（例如：将上衣换成黑色、改为休闲风格...），并可选择在右侧上传姿势参考图"
                          rows={2}
                          style={{
                            flex: 1,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '12px',
                            padding: '8px 12px',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            outline: 'none',
                            lineHeight: '1.5'
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                        />
                        
                        {/* Pose Reference Image Uploader */}
                        <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                          {outfitPoseImageUrl ? (
                            <div style={{ width: '100%', height: '100%', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', position: 'relative' }}>
                              <img src={outfitPoseImageUrl} alt="姿势参考" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <button
                                onClick={() => setOutfitPoseImageUrl(null)}
                                style={{
                                  position: 'absolute',
                                  top: '2px',
                                  right: '2px',
                                  width: '14px',
                                  height: '14px',
                                  borderRadius: '50%',
                                  background: 'rgba(0,0,0,0.6)',
                                  border: 'none',
                                  color: '#fff',
                                  fontSize: '9px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                                title="清除姿势参考图"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <label
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                height: '100%',
                                borderRadius: '6px',
                                border: '1px dashed rgba(255,255,255,0.2)',
                                background: 'rgba(255,255,255,0.02)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                color: 'var(--text-muted)'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = 'var(--accent-purple)';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                e.currentTarget.style.color = 'var(--text-muted)';
                              }}
                              title="上传模特动作姿势参考图"
                            >
                              <span style={{ fontSize: '14px', lineHeight: '1' }}>+</span>
                              <span style={{ fontSize: '9px', marginTop: '2px' }}>姿势参考</span>
                              <input type="file" accept="image/*" onChange={handlePoseRefUpload} style={{ display: 'none' }} />
                            </label>
                          )}
                        </div>
                      </div>
                      {/* Action buttons row */}
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => setPreviewModel(null)}
                          style={{ padding: '8px 20px', fontSize: '12px', cursor: 'pointer' }}
                          disabled={isOutfitImgGenerating}
                        >
                          关闭
                        </button>
                        <button
                          className="btn-primary"
                          onClick={() => { handleGenerateModelOutfit(); }}
                          style={{
                            padding: '8px 20px',
                            fontSize: '12px',
                            cursor: isOutfitImgGenerating ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                            border: 'none',
                            boxShadow: '0 0 10px rgba(138, 43, 226, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: isOutfitImgGenerating ? 0.7 : 1
                          }}
                          disabled={isOutfitImgGenerating}
                        >
                          {isOutfitImgGenerating ? (
                            <>
                              <div style={{ border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', width: '10px', height: '10px', animation: 'spin 1s linear infinite' }} />
                              重新生成中...
                            </>
                          ) : (
                            <>🔄 {outfitEditPrompt.trim() ? '按提示词重新生成' : '重新生成穿搭图'}</>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : previewModel.id !== undefined ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                      {/* Prompt edit row */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', width: '100%' }}>
                        <textarea
                          value={modelEditPrompt}
                          onChange={(e) => setModelEditPrompt(e.target.value)}
                          placeholder="输入修改提示词（例如：改变发型、让模特微笑、修改表情或脸部特征...），留空则按原配置重新生成"
                          rows={2}
                          style={{
                            flex: 1,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '12px',
                            padding: '8px 12px',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            outline: 'none',
                            lineHeight: '1.5'
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                        />
                      </div>
                      {/* Action buttons row */}
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => setPreviewModel(null)}
                          style={{ padding: '8px 20px', fontSize: '12px', cursor: 'pointer' }}
                          disabled={localModelSwapRunning}
                        >
                          关闭
                        </button>
                        <button
                          className="btn-primary"
                          onClick={() => {
                            applyModelFromLibrary(previewModel.src, previewModel.name);
                            setPreviewModel(null);
                          }}
                          style={{
                            padding: '8px 20px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#fff'
                          }}
                          disabled={localModelSwapRunning}
                        >
                          使用此模特
                        </button>
                        <button
                          className="btn-primary"
                          onClick={() => { handleCustomModelSwap(true); }}
                          style={{
                            padding: '8px 20px',
                            fontSize: '12px',
                            cursor: localModelSwapRunning ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                            border: 'none',
                            boxShadow: '0 0 10px rgba(138, 43, 226, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: localModelSwapRunning ? 0.7 : 1
                          }}
                          disabled={localModelSwapRunning}
                        >
                          {localModelSwapRunning ? (
                            <>
                              <div style={{ border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', width: '10px', height: '10px', animation: 'spin 1s linear infinite' }} />
                              重新生成中...
                            </>
                          ) : (
                            <>🔄 {modelEditPrompt.trim() ? '按提示词重新生成' : '重新生成模特'}</>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        className="btn-secondary"
                        onClick={() => setPreviewModel(null)}
                        style={{ padding: '8px 20px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        关闭
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => {
                          applyModelFromLibrary(previewModel.src, previewModel.name);
                          setPreviewModel(null);
                        }}
                        style={{
                          padding: '8px 20px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          background: 'var(--accent-purple)',
                          borderColor: 'var(--accent-purple)',
                          boxShadow: '0 0 10px var(--accent-purple-glow)'
                        }}
                      >
                        使用此模特
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Confirmation Dialog */}
      {confirmDialog && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 10, 15, 0.75)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 11000,
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setConfirmDialog(null)}>
          <div style={{
            width: '360px',
            background: 'rgba(20, 21, 31, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 15px 30px rgba(0,0,0,0.5), 0 0 20px rgba(138, 43, 226, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <span style={{ fontSize: '15px', fontWeight: '600' }}>{confirmDialog.title}</span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                className="btn-secondary"
                onClick={() => setConfirmDialog(null)}
                style={{ padding: '6px 14px', fontSize: '12px', cursor: 'pointer', margin: 0 }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  margin: 0,
                  background: '#ff5252',
                  borderColor: '#ff5252',
                  boxShadow: '0 0 10px rgba(255, 82, 82, 0.3)'
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Clothing Focus Selection Modal */}
      {clothingFocusModalOpen && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 10, 15, 0.85)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 11000,
          animation: 'fadeIn 0.25s ease-out'
        }} onClick={() => setClothingFocusModalOpen(false)}>
          <div style={{
            width: '420px',
            background: 'rgba(20, 21, 32, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(138, 43, 226, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🎯</span>
                <span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '0.01em' }}>选择分镜生成推广重点</span>
              </div>
               <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.4' }}>
                {referenceOutfitUrls && referenceOutfitUrls.length > 0
                  ? "检测到您当前仅上传了「穿搭参考图」，未提供分体服装图。请选择本次生成的推广重点，以自动调整分镜构图和拍摄细节："
                  : "检测到您当前未上传具体的分体衣服图层（上装/下装）。请选择本次分镜生成的推广重点，以自动调整构图与拍摄细节："}
              </span>
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { id: 'top', icon: '👕', title: '重点推广上装', desc: 'AI 分镜将聚焦上装细节、领口、剪裁和材质' },
                { id: 'bottom', icon: '👖', title: '重点推广下装', desc: 'AI 分镜将聚焦下装版型、裙摆/裤脚、垂坠感' },
                { id: 'both', icon: '👗', title: '两者同样重要 / 整体搭配', desc: '保持全身拍摄比例，兼顾整体服饰的协调与搭配展示' }
              ].map(opt => (
                <div
                  key={opt.id}
                  onClick={() => {
                    setClothingFocusModalOpen(false);
                    setClothingFocus(opt.id as any);
                    executeGenerateStoryboards(opt.id as any);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                    e.currentTarget.style.background = 'rgba(168, 85, 247, 0.04)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{opt.icon}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>{opt.title}</span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{opt.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cancel Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                className="btn-secondary"
                onClick={() => setClothingFocusModalOpen(false)}
                style={{ padding: '8px 20px', fontSize: '12px', cursor: 'pointer', margin: 0, borderRadius: '8px' }}
              >
                取消
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* AI Projects Management Dashboard Modal */}
      {isProjectsModalOpen && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 10, 15, 0.85)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{
            width: '680px',
            background: 'rgba(20, 21, 31, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(138, 43, 226, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📁 AI 创作项目管理看板
              </h3>
              <button
                onClick={() => setIsProjectsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px', transition: 'color 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
              >
                ×
              </button>
            </div>

            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                您当前共有 <strong style={{ color: 'var(--accent-purple)' }}>{projects.length}</strong> 个创作项目，支持在后台并行执行生成。
              </span>
              <button
                className="btn-primary"
                onClick={createNewProject}
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  margin: 0,
                  background: 'var(--accent-purple)',
                  borderColor: 'var(--accent-purple)'
                }}
              >
                ➕ 新建创作项目
              </button>
            </div>

            {/* Projects Table List */}
            <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>项目名称</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>创建时间</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>当前状态</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => {
                    const isCurrent = p.id === activeProjectId;
                    let statusColor = 'var(--text-muted)';
                    let statusBg = 'rgba(255,255,255,0.05)';
                    let statusDesc = '未开始';

                    if (p.isI2vGenerating) {
                      statusColor = 'var(--accent-cyan)';
                      statusBg = 'rgba(0, 242, 254, 0.1)';
                      const completed = p.storyboards.filter(s => s.progress === 100).length;
                      statusDesc = `生成视频中 (${completed}/${p.storyboards.length || 5})`;
                    } else if (p.isStoryboardGenerating) {
                      statusColor = 'var(--accent-purple)';
                      statusBg = 'rgba(138, 43, 226, 0.1)';
                      statusDesc = '生成分镜图中...';
                    } else if (p.isOutfitImgGenerating) {
                      statusColor = 'var(--accent-purple)';
                      statusBg = 'rgba(138, 43, 226, 0.1)';
                      statusDesc = '渲染穿搭图中...';
                    } else if (p.i2vStep === 'video_generated') {
                      statusColor = '#4caf50';
                      statusBg = 'rgba(76, 175, 80, 0.1)';
                      statusDesc = '已生成视频';
                    } else if (p.i2vStep === 'storyboard_generated') {
                      statusColor = 'var(--accent-purple)';
                      statusBg = 'rgba(138, 43, 226, 0.1)';
                      statusDesc = '已生成分镜图';
                    }

                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: isCurrent ? 'rgba(138, 43, 226, 0.04)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        {/* Name */}
                        <td style={{ padding: '12px 16px', fontWeight: isCurrent ? '600' : 'normal' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {p.name}
                            {isCurrent && <span style={{ fontSize: '10px', color: '#4caf50', background: 'rgba(76,175,80,0.15)', padding: '2px 6px', borderRadius: '4px' }}>当前</span>}
                          </span>
                        </td>
                        {/* Created At */}
                        <td style={{ padding: '12px 16px', color: '#9ca3af' }}>
                          {p.createdAt ? new Date(p.createdAt).toLocaleString('zh-CN', { hour12: false }) : '-'}
                        </td>
                        {/* Status */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ color: statusColor, background: statusBg, padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600', display: 'inline-block' }}>
                            {statusDesc}
                          </span>
                        </td>
                        {/* Actions */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {!isCurrent && (
                              <button
                                className="btn-primary"
                                onClick={() => {
                                  switchProject(p.id);
                                }}
                                style={{ padding: '4px 10px', fontSize: '10px', margin: 0, background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}
                              >
                                切换进入
                              </button>
                            )}
                            <button
                              className="btn-secondary"
                              onClick={() => {
                                const newName = prompt('修改项目名称：', p.name);
                                if (newName && newName.trim()) {
                                  setProjects(prev => prev.map(proj => proj.id === p.id ? { ...proj, name: newName.trim() } : proj));
                                }
                              }}
                              style={{ padding: '4px 8px', fontSize: '10px', margin: 0 }}
                            >
                              重命名
                            </button>
                            {projects.length > 1 && (
                              <button
                                className="btn-secondary"
                                onClick={() => deleteProject(p.id)}
                                style={{ padding: '4px 8px', fontSize: '10px', margin: 0, color: 'var(--accent-red)' }}
                              >
                                删除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                className="btn-primary"
                onClick={() => setIsProjectsModalOpen(false)}
                style={{ padding: '8px 24px', fontSize: '12px', cursor: 'pointer', margin: 0 }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Video Preview Modal */}
      {previewVideo && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 10, 15, 0.85)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.25s ease-out'
        }} onClick={() => setPreviewVideo(null)}>
          <div style={{
            position: 'relative',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxSizing: 'border-box',
            background: 'rgba(20, 21, 31, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 40px rgba(0, 242, 254, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎬 视频分镜预览: {previewVideo.name}
              </h3>
              <button
                onClick={() => setPreviewVideo(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '4px',
                  lineHeight: '1',
                  transition: 'color 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                ×
              </button>
            </div>

            {/* Video Body */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
              background: '#0c0d12',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              maxHeight: '50vh',
              width: '197px',
              height: '350px',
              position: 'relative'
            }}>
              {previewVideo.src ? (
                <video
                  src={previewVideo.src}
                  controls
                  autoPlay
                  loop
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                />
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '32px' }}>📽️</span>
                  <span>暂无视频</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>请点击下方按钮上传视频，或重新生成</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
              {previewVideo.id && (
                <>
                  <input
                    type="file"
                    accept="video/mp4,video/*"
                    id={`manual-video-upload-${previewVideo.id}`}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleManualVideoUpload(previewVideo.id, file);
                      }
                    }}
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      document.getElementById(`manual-video-upload-${previewVideo.id}`)?.click();
                    }}
                    style={{
                      padding: '8px 16px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '4px',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      height: '32px'
                    }}
                  >
                    📤 手动上传视频
                  </button>

                  {(() => {
                    const targetStoryboard = storyboards.find(s => s.id === previewVideo.id);
                    const hasTaskId = !!targetStoryboard?.videoTaskId;
                    if (!hasTaskId) return null;
                    return (
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          handleRedownloadVideo(previewVideo.id, targetStoryboard.videoTaskId!);
                        }}
                        style={{
                          padding: '8px 16px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          border: '1px solid var(--accent-cyan)',
                          borderRadius: '4px',
                          color: 'var(--accent-cyan)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'rgba(0, 242, 254, 0.05)',
                          height: '32px'
                        }}
                      >
                        📥 再次读取/下载视频
                      </button>
                    );
                  })()}

                  <button
                    className="ai-btn"
                    onClick={async () => {
                      const sbId = previewVideo.id;
                      setPreviewVideo(null);
                      await handleRegenerateStoryboardVideo(sbId);
                    }}
                    style={{
                      padding: '8px 16px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      height: '32px'
                    }}
                  >
                    🔄 重新生成此分镜视频
                  </button>
                </>
              )}
              <button
                className="btn-secondary"
                onClick={() => setPreviewVideo(null)}
                style={{ padding: '8px 20px', fontSize: '12px', cursor: 'pointer', height: '32px' }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* AI Background Generation Modal */}
      {showAiSceneModal && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 10, 15, 0.8)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => !isGeneratingAiScene && setShowAiSceneModal(false)}>
          <div style={{
            position: 'relative',
            width: '400px',
            background: 'rgba(20, 21, 31, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(138, 43, 226, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }} onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✨ AI 智能背景场景生成
              </h3>
              {!isGeneratingAiScene && (
                <button
                  onClick={() => setShowAiSceneModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '18px',
                    lineHeight: '1',
                    padding: '4px'
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Modal Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>请描述你期望的商用服装拍摄背景场景：</label>
              <textarea
                value={aiScenePrompt}
                onChange={(e) => setAiScenePrompt(e.target.value)}
                disabled={isGeneratingAiScene}
                placeholder="例如：极简水泥风现代建筑空间、阳光透过落地窗洒在大理石地面上、有绿植和暖色侧光氛围..."
                rows={3}
                className="text-input"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  resize: 'none',
                  outline: 'none'
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              />

              {/* Reference Image Input */}
              <div style={{ marginTop: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  🖼️ 上传场景参考图 (可选，引导构图/风格)：
                </label>

                {aiSceneRefImage ? (
                  <div style={{ position: 'relative', width: '80px', height: '80px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                    <img src={aiSceneRefImage} alt="Ref" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      disabled={isGeneratingAiScene}
                      onClick={() => setAiSceneRefImage(null)}
                      style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        background: 'rgba(0,0,0,0.7)',
                        border: 'none',
                        borderRadius: '50%',
                        color: '#ff5252',
                        width: '16px',
                        height: '16px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0
                      }}
                      title="移除参考图"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '80px',
                      height: '80px',
                      border: '1px dashed rgba(255,255,255,0.15)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.01)',
                      color: 'var(--text-muted)',
                      transition: 'border-color 0.2s, background-color 0.2s'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'; }}
                  >
                    <span style={{ fontSize: '20px', lineHeight: '1' }}>+</span>
                    <span style={{ fontSize: '9px', marginTop: '4px' }}>选择图片</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          setAiSceneRefImage(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Multi-view option */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', margin: '4px 0' }}>
                <input
                  type="checkbox"
                  checked={aiSceneMultiView}
                  onChange={(e) => setAiSceneMultiView(e.target.checked)}
                  disabled={isGeneratingAiScene}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '11px', color: '#fff', fontWeight: '500' }}>
                  🎬 生成多视角空间合图 (单张图内平铺多个空场景分镜)
                </span>
              </label>

              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                💡 生成的场景背景图片比例将被锁定为商用大片通用的 16:9 比例。
              </span>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                className="btn-secondary"
                onClick={() => setShowAiSceneModal(false)}
                disabled={isGeneratingAiScene}
                style={{ padding: '6px 14px', fontSize: '11px', cursor: 'pointer', margin: 0 }}
              >
                取消
              </button>
              <button
                className="ai-btn"
                onClick={handleGenerateAiScene}
                disabled={isGeneratingAiScene}
                style={{
                  padding: '6px 16px',
                  fontSize: '11px',
                  cursor: isGeneratingAiScene ? 'not-allowed' : 'pointer',
                  margin: 0,
                  background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                  borderColor: 'transparent',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isGeneratingAiScene ? (
                  <>
                    <div style={{ border: '1.5px solid #fff', borderTop: '1.5px solid transparent', borderRadius: '50%', width: '10px', height: '10px', animation: 'spin 1s linear infinite' }} />
                    正在绘制...
                  </>
                ) : (
                  <>✨ 立即生成</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 1. Model Selector Modal */}
      {isModelSelectorModalOpen && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 10, 15, 0.8)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setIsModelSelectorModalOpen(false)}>
          <div style={{
            position: 'relative',
            width: '480px',
            maxWidth: '90vw',
            background: 'rgba(20, 21, 31, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                👤 选择试衣参考模特
              </h3>
              <button
                onClick={() => setIsModelSelectorModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}
              >
                ×
              </button>
            </div>

            {/* Content Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                点击选择试衣参考模特肖像对齐参考：
              </span>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
                maxHeight: '360px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {/* Default Model */}
                {(() => {
                  const isActive = swapModelUrl === '/clothing_model.png';
                  return (
                    <div
                      onClick={() => {
                        setSwapModelUrl('/clothing_model.png');
                        setIsModelSelectorModalOpen(false);
                      }}
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        border: '2px solid ' + (isActive ? 'var(--accent-purple)' : 'rgba(255,255,255,0.08)'),
                        background: isActive ? 'rgba(138, 43, 226, 0.15)' : 'rgba(255,255,255,0.02)',
                        padding: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ width: '100%', aspectRatio: '1/1', background: 'url(/clothing_model.png) center/cover', borderRadius: '6px' }} />
                      <span style={{ fontSize: '10px', fontWeight: '500', color: isActive ? 'var(--accent-cyan)' : '#d1d5db', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        默认风衣模特
                      </span>
                    </div>
                  );
                })()}

                {/* Library Models */}
                {modelLibrary.map((model) => {
                  const isActive = swapModelUrl === model.src;
                  return (
                    <div
                      key={model.id}
                      onClick={() => {
                        setSwapModelUrl(model.src);
                        setIsModelSelectorModalOpen(false);
                      }}
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        border: '2px solid ' + (isActive ? 'var(--accent-purple)' : 'rgba(255,255,255,0.08)'),
                        background: isActive ? 'rgba(138, 43, 226, 0.15)' : 'rgba(255,255,255,0.02)',
                        padding: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ width: '100%', aspectRatio: '1/1', background: `url(${model.src}) center/cover`, borderRadius: '6px' }} />
                      <span style={{ fontSize: '10px', fontWeight: '500', color: isActive ? 'var(--accent-cyan)' : '#d1d5db', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={model.name}>
                        {model.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '4px' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setIsModelSelectorModalOpen(false);
                  setActiveTab('media');
                }}
                style={{ padding: '6px 12px', fontSize: '11px', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                ⚙️ 前往素材库管理模特
              </button>
              <button
                className="btn-secondary"
                onClick={() => setIsModelSelectorModalOpen(false)}
                style={{ padding: '6px 14px', fontSize: '11px', cursor: 'pointer', margin: 0 }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 2. Scene Selector Modal */}
      {isSceneSelectorModalOpen && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 10, 15, 0.8)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setIsSceneSelectorModalOpen(false)}>
          <div style={{
            position: 'relative',
            width: '560px',
            maxWidth: '90vw',
            background: 'rgba(20, 21, 31, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🖼️ 选择分镜背景场景
              </h3>
              <button
                onClick={() => setIsSceneSelectorModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}
              >
                ×
              </button>
            </div>

            {/* Content Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                选择智能生成场景参考的空间背景：
              </span>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                maxHeight: '360px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {/* Presets */}
                {[
                  { key: 'street', name: '🏙️ 摩登街头', src: SCENE_BACKGROUNDS.street },
                  { key: 'studio', name: '🧘 专业影棚', src: SCENE_BACKGROUNDS.studio },
                  { key: 'home', name: '🏡 温馨居家', src: SCENE_BACKGROUNDS.home },
                  { key: 'office', name: '💼 职场办公', src: SCENE_BACKGROUNDS.office },
                  { key: 'beach', name: '🏖️ 阳光海滩', src: SCENE_BACKGROUNDS.beach },
                  { key: 'runway', name: '👠 时尚秀场', src: SCENE_BACKGROUNDS.runway },
                  { key: 'minimalist', name: '🎨 极简侘寂', src: SCENE_BACKGROUNDS.minimalist }
                ].map((scene) => {
                  const isActive = modelScene === scene.key;
                  return (
                    <div
                      key={scene.key}
                      onClick={() => {
                        setModelScene(scene.key);
                        setIsSceneSelectorModalOpen(false);
                      }}
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        border: '2px solid ' + (isActive ? 'var(--accent-purple)' : 'rgba(255,255,255,0.08)'),
                        background: isActive ? 'rgba(138, 43, 226, 0.15)' : 'rgba(255,255,255,0.02)',
                        padding: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ width: '100%', aspectRatio: '16/10', background: `url(${scene.src}) center/cover`, borderRadius: '6px' }} />
                      <span style={{ fontSize: '10px', fontWeight: '500', color: isActive ? 'var(--accent-cyan)' : '#d1d5db', textAlign: 'center', width: '100%' }}>
                        {scene.name}
                      </span>
                    </div>
                  );
                })}

                {/* Custom Scenes */}
                {customScenes.map((scene) => {
                  const isActive = modelScene === scene.id;
                  return (
                    <div
                      key={scene.id}
                      onClick={() => {
                        setModelScene(scene.id);
                        setIsSceneSelectorModalOpen(false);
                      }}
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        border: '2px solid ' + (isActive ? 'var(--accent-purple)' : 'rgba(255,255,255,0.08)'),
                        background: isActive ? 'rgba(138, 43, 226, 0.15)' : 'rgba(255,255,255,0.02)',
                        padding: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ width: '100%', aspectRatio: '16/10', background: `url(${scene.src}) center/cover`, borderRadius: '6px' }} />
                      <span style={{ fontSize: '10px', fontWeight: '500', color: isActive ? 'var(--accent-cyan)' : '#d1d5db', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={scene.name}>
                        🖼️ {scene.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '4px' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setIsSceneSelectorModalOpen(false);
                  setActiveTab('media');
                }}
                style={{ padding: '6px 12px', fontSize: '11px', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                ⚙️ 前往素材库管理场景
              </button>
              <button
                className="btn-secondary"
                onClick={() => setIsSceneSelectorModalOpen(false)}
                style={{ padding: '6px 14px', fontSize: '11px', cursor: 'pointer', margin: 0 }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});
