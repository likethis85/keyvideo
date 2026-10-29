import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Layer } from './components/VideoCanvas';
import { BackendSettingsModal } from './components/app/BackendSettingsModal';
import { AICopilotDrawer } from './components/app/AICopilotDrawer';
import { AICopilotLauncher } from './components/app/AICopilotLauncher';
import { CustomApiScriptModal } from './components/app/CustomApiScriptModal';
import { ProjectsModal } from './components/sidebar/ProjectsModal';
import { createAIProject } from './utils/aiProjectFactory';
import { exportProjectPackage, importProjectPackage } from './utils/projectPackageExporter';
import { ToolNavigation } from './components/app/ToolNavigation';
import type { EditorToolTab } from './components/app/ToolNavigation';
import { ProjectSelector } from './components/app/ProjectSelector';
import { AspectRatioSelector } from './components/app/AspectRatioSelector';
import { AppHeaderActions } from './components/app/AppHeaderActions';
import { AppLoadingScreen } from './components/app/AppLoadingScreen';
import { OnboardingWizard, type OnboardingResult } from './components/onboarding/OnboardingWizard';
import type { AIProject, StoryboardItem } from './types/aiProject';
import type { SidebarDrawerRef } from './components/sidebar/sidebarTypes';
import { localDB } from './utils/db';
import { supabase } from './utils/supabaseClient';
import { AuthPage } from './components/AuthPage';
import {
  clearSsoParams,
  describeSsoError,
  exchangeSsoTicketOnce,
  loadSsoSession,
  logoutSso,
  readSsoError,
  readSsoTicket,
  refreshSsoUser
} from './services/ssoAuth';
import type { AppUser } from './services/ssoAuth';
import { ToastContainer } from './components/Toast';
import { toast } from './components/toastStore';
import { reflowLayersForRatio, RATIO_CONFIGS } from './utils/smartReflow';
import type { AspectRatio } from './utils/smartReflow';
import {
  createInitialHistory,
  pushHistorySnapshot,
  undoHistory,
  redoHistory
} from './utils/historyManager';
import type { HistoryState } from './utils/historyManager';
import { createDefaultLayers } from './config/defaultLayers';
import { ViewModeSwitch } from './components/app/ViewModeSwitch';
import { StudioBrand } from './components/app/StudioBrand';
import { StudioInspector } from './components/app/StudioInspector';
import type { WorkspaceViewMode } from './components/app/ViewModeSwitch';
import type { CanvasNodeData, CanvasConnection, CanvasViewport } from './types/canvas';
import { generateCanvasPipeline, saveCanvasTopologyToLocalDB, convertAiProjectToCanvas } from './utils/canvasBridge';
import { splitLayerInList } from './services/timelineSplitService';
import { projectStorageKey } from './utils/projectStorage';
import './App.css';
import './studio.css';

const SidebarDrawer = lazy(() => import('./components/SidebarDrawer').then((module) => ({
  default: module.SidebarDrawer
})));
const VideoCanvas = lazy(() => import('./components/VideoCanvas').then((module) => ({
  default: module.VideoCanvas
})));
const Timeline = lazy(() => import('./components/Timeline').then((module) => ({
  default: module.Timeline
})));
const InfiniteCanvas = lazy(() => import('./components/canvas/InfiniteCanvas').then((module) => ({
  default: module.InfiniteCanvas
})));
const videoBlobUrls = new Map<string, string>();

function App() {
  // History Undo/Redo states
  const [historyState, setHistoryState] = useState<HistoryState>({
    stack: [],
    index: -1
  });
  const isNavigatingRef = useRef(false);

  const historyStateRef = useRef(historyState);
  useEffect(() => {
    historyStateRef.current = historyState;
  }, [historyState]);

  const selectedLayerIdRef = useRef<string | null>(null);
  const currentTimeRef = useRef<number>(0);

  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [ssoUser, setSsoUser] = useState<AppUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadedLocalStateUserId, setLoadedLocalStateUserId] = useState<string | null>(null);
  const [loadedEditorProjectId, setLoadedEditorProjectId] = useState<string | null>(null);
  const legacyTimelineProjectIdRef = useRef<string | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Restore either an SSO session or the legacy Supabase session. The SSO ticket
  // (if present) is consumed exactly once through our backend.
  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const ssoError = readSsoError();
      if (ssoError) {
        setAuthError(describeSsoError(ssoError));
        clearSsoParams();
      }

      const ticket = readSsoTicket();
      if (ticket) {
        try {
          const session = await exchangeSsoTicketOnce(ticket);
          if (active) {
            setSsoUser(session.user);
            setAuthError(null);
          }
        } catch (error) {
          if (active) {
            setAuthError(error instanceof Error ? error.message : '统一登录失败，请重试');
          }
        } finally {
          clearSsoParams();
        }
      } else {
        const stored = loadSsoSession();
        if (stored) {
          const user = await refreshSsoUser(stored);
          if (active && user) setSsoUser(user);
        }
      }

      try {
        const { data } = await supabase.auth.getSession();
        if (active) setSupabaseSession(data.session);
      } catch (error) {
        console.warn('Failed to read the Supabase session:', error);
      } finally {
        if (active) setLoadingSession(false);
      }
    };

    void bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const authUser: AppUser | null = ssoUser ?? (supabaseSession?.user
    ? {
        id: supabaseSession.user.id,
        email: supabaseSession.user.email ?? null,
        displayName: (supabaseSession.user.user_metadata?.display_name as string | undefined)
          || (supabaseSession.user.user_metadata?.full_name as string | undefined)
          || null,
        provider: 'supabase',
        avatarUrl: null
      }
    : null);

  // Keep browser/desktop local project storage isolated per authenticated user.
  localDB.setScope(authUser?.id ?? null);

  // Object URLs are process-global; never let a new user reuse the previous user's videos.
  useEffect(() => {
    for (const url of videoBlobUrls.values()) URL.revokeObjectURL(url);
    videoBlobUrls.clear();
  }, [authUser?.id]);

  // Show the 3-step onboarding once per authenticated user.
  useEffect(() => {
    if (!authUser?.id || loadedLocalStateUserId !== authUser.id) return;
    const key = `KEYVIDEO_ONBOARDING_DONE_V1_${authUser.id}`;
    const timer = window.setTimeout(() => {
      setIsOnboardingOpen(!localStorage.getItem(key));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authUser?.id, loadedLocalStateUserId]);

  // Bridge window.alert to modern toast system
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg?: unknown) => {
      toast.info(String(msg));
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  // 1. Ratio size setup: 1-1, 3-4, 9-16, 16-9
  const [ratio, setRatio] = useState<AspectRatio>('9-16');

  // Instant commit helper for discrete actions (delete, add, template, ratio)
  const commitInstantHistory = (newLayers: Layer[], actionDesc: string) => {
    setHistoryState(prev => pushHistorySnapshot(prev, newLayers, actionDesc));
  };

  const handleRatioChange = (newRatio: AspectRatio) => {
    if (newRatio === ratio) return;
    const reflowed = reflowLayersForRatio(layers, ratio, newRatio);
    const cfg = RATIO_CONFIGS[newRatio];
    setLayers(reflowed);
    setRatio(newRatio);
    commitInstantHistory(reflowed, `切换画幅至 ${cfg.label}`);
    toast.success(`已切换至 ${cfg.label}（${cfg.name}），图层安全边距与模特比例已自适应重排！`);
  };

  const handleSmartReflow = () => {
    const reflowed = reflowLayersForRatio(layers, ratio, ratio);
    setLayers(reflowed);
    commitInstantHistory(reflowed, '智能安全排版');
    toast.success(`已依据当前 ${RATIO_CONFIGS[ratio].label} 画幅安全边距优化图层排版`);
  };

  // 2. Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // 3. Tab navigation state
  const [activeTab, setActiveTab] = useState<EditorToolTab>('template');
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(true);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('editor');
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(true);

  // Keep the timeline collapsed for library tools and open it for AI creation.
  const handleActiveTabChange = useCallback((tab: EditorToolTab) => {
    setActiveTab(tab);
    setIsTimelineCollapsed(tab !== 'ai');
  }, [setActiveTab, setIsTimelineCollapsed]);

  // AI Project Management States
  const [projects, setProjects] = useState<AIProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [isEditingProjName, setIsEditingProjName] = useState(false);
  const [editingProjNameValue, setEditingProjNameValue] = useState('');
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isCustomApiModalOpen, setIsCustomApiModalOpen] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState(
    localStorage.getItem('KEYVIDEO_BACKEND_URL') || import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3001'
  );
  const sidebarRef = useRef<SidebarDrawerRef | null>(null);
  const canvasAutoLayoutRef = useRef<(() => void) | null>(null);
  const canvasActionsRef = useRef<{
    importProject: () => void;
    fitViewport: () => void;
    runPipeline: () => void;
  } | null>(null);

  // Theme state ('dark' | 'light')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('keyvideo_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('keyvideo_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    toast.info(`已切换至 ${nextTheme === 'dark' ? '🌙 暗黑主题' : '☀️ 浅色主题'}`);
  };

  // 4. Initial Default Layers (Ready-to-use template for gorgeous first impression)
  const [layers, setLayers] = useState<Layer[]>(createDefaultLayers);

  // 5. Selected Layer state
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  useEffect(() => {
    selectedLayerIdRef.current = selectedLayerId;
  }, [selectedLayerId]);

  const layersRef = useRef(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);



  // Load saved state from database on mount. Timeline state is project-scoped;
  // the old account-wide keys are read once for a backwards-compatible migration.
  useEffect(() => {
    const userId = authUser?.id;
    if (!userId) return;

    let cancelled = false;
    const loadState = async () => {
      const storedActiveProjectId = await localDB.get('ai_active_project_id');
      const storedProjects = await localDB.get<AIProject[]>('ai_projects');
      const projectId = typeof storedActiveProjectId === 'string' && storedProjects?.some(project => project.id === storedActiveProjectId)
        ? storedActiveProjectId
        : Array.isArray(storedProjects) && storedProjects.length > 0 ? storedProjects[0].id : null;
      const scopedRatio = projectId ? await localDB.get(projectStorageKey(projectId, 'ratio')) as AspectRatio | null : null;
      const scopedLayers = projectId ? await localDB.get(projectStorageKey(projectId, 'layers')) as Layer[] | null : null;
      const scopedStoryboards = projectId ? await localDB.get(projectStorageKey(projectId, 'storyboards')) as StoryboardItem[] | null : null;
      const savedRatio = scopedRatio ?? (projectId ? await localDB.get('keyvideo_ratio') as AspectRatio | null : null);
      if (cancelled) return;
      setRatio(savedRatio && ['1-1', '3-4', '9-16', '16-9'].includes(savedRatio) ? savedRatio : '9-16');

      const savedLayers = scopedLayers ?? (projectId ? await localDB.get('keyvideo_layers') as Layer[] | null : null);
      const savedStoryboards = scopedStoryboards ?? (projectId ? await localDB.get('ai_storyboards') as StoryboardItem[] | null : null);
      if (cancelled) return;

      let initialLayers = createDefaultLayers();

      if (Array.isArray(savedLayers)) {
        const storyboardList = Array.isArray(savedStoryboards) ? savedStoryboards : [];
        const updatedLayers = savedLayers.map((layer) => {
          if (!layer || typeof layer !== 'object' || !layer.properties) return layer;
          if (layer.type !== 'media' || !layer.properties.isVideo) return layer;

          const match = /^media_i2v_(\d+)_/.exec(layer.id);
          const sbIndex = match ? Number(match[1]) : -1;
          const sb = sbIndex !== -1 ? storyboardList[sbIndex] : null;
          if (!sb) return layer;

          if (typeof Blob !== 'undefined' && sb.videoBlob instanceof Blob) {
            const cacheKey = sb.id;
            if (!videoBlobUrls.has(cacheKey)) {
              videoBlobUrls.set(cacheKey, URL.createObjectURL(sb.videoBlob));
            }
            return {
              ...layer,
              properties: { ...layer.properties, src: videoBlobUrls.get(cacheKey) || '' }
            };
          }

          // A blob URL from a previous page load is always dead. Keep a real
          // remote URL, otherwise let recovery re-fetch the video by task ID.
          if ((layer.properties.src || '').startsWith('blob:')) {
            return {
              ...layer,
              properties: {
                ...layer.properties,
                src: sb.videoSrc && !sb.videoSrc.startsWith('blob:') ? sb.videoSrc : ''
              }
            };
          }
          return layer;
        });
        initialLayers = updatedLayers;
      }

      setLayers(initialLayers);
      setHistoryState(createInitialHistory(initialLayers, '加载工程模板'));
      setLoadedEditorProjectId(projectId);
      legacyTimelineProjectIdRef.current = projectId && (!scopedLayers || !scopedRatio) ? projectId : null;
      if (projectId && !scopedLayers && Array.isArray(savedLayers)) {
        await localDB.set(projectStorageKey(projectId, 'layers'), savedLayers);
      }
      if (projectId && !scopedRatio && savedRatio) {
        await localDB.set(projectStorageKey(projectId, 'ratio'), savedRatio);
      }
      if (projectId && !scopedStoryboards && Array.isArray(savedStoryboards)) {
        await localDB.set(projectStorageKey(projectId, 'storyboards'), savedStoryboards);
      }
      setLoadedLocalStateUserId(userId);
    };

    void loadState();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  // A project switch must load its own timeline before autosave is allowed to
  // run, otherwise the previous project's layers can overwrite the new one.
  useEffect(() => {
    if (!authUser?.id || loadedLocalStateUserId !== authUser.id || !activeProjectId) return;
    if (loadedEditorProjectId === activeProjectId) return;

    let cancelled = false;
    const loadProjectEditorState = async () => {
      const scopedLayers = await localDB.get<Layer[]>(projectStorageKey(activeProjectId, 'layers'));
      const scopedRatio = await localDB.get<AspectRatio>(projectStorageKey(activeProjectId, 'ratio'));
      if (cancelled) return;

      const canMigrateLegacy = legacyTimelineProjectIdRef.current === activeProjectId;
      const legacyLayers = canMigrateLegacy && !scopedLayers ? await localDB.get<Layer[]>('keyvideo_layers') : null;
      const legacyRatio = canMigrateLegacy && !scopedRatio ? await localDB.get<AspectRatio>('keyvideo_ratio') : null;
      const nextLayers = Array.isArray(scopedLayers) ? scopedLayers : Array.isArray(legacyLayers) ? legacyLayers : createDefaultLayers();
      const nextRatio = (scopedRatio || legacyRatio) && ['1-1', '3-4', '9-16', '16-9'].includes((scopedRatio || legacyRatio) as string)
        ? (scopedRatio || legacyRatio) as AspectRatio
        : '9-16';

      setIsPlaying(false);
      setCurrentTime(0);
      setSelectedLayerId(null);
      setLayers(nextLayers);
      setRatio(nextRatio);
      setHistoryState(createInitialHistory(nextLayers, '切换工程并加载时间轴'));
      setLoadedEditorProjectId(activeProjectId);
      if (!scopedLayers && legacyLayers) await localDB.set(projectStorageKey(activeProjectId, 'layers'), legacyLayers);
      if (!scopedRatio && legacyRatio) await localDB.set(projectStorageKey(activeProjectId, 'ratio'), legacyRatio);
    };

    void loadProjectEditorState();
    return () => { cancelled = true; };
  }, [activeProjectId, authUser?.id, loadedEditorProjectId, loadedLocalStateUserId]);

  // Save layers and ratio to the active project only after its state is loaded.
  useEffect(() => {
    if (!authUser?.id || loadedLocalStateUserId !== authUser.id || !activeProjectId || loadedEditorProjectId !== activeProjectId) return;
    if (layers.length > 0 && historyState.index >= 0) {
      void localDB.set(projectStorageKey(activeProjectId, 'layers'), layers);
    }
  }, [activeProjectId, authUser?.id, loadedEditorProjectId, loadedLocalStateUserId, layers, historyState.index]);

  useEffect(() => {
    if (!authUser?.id || loadedLocalStateUserId !== authUser.id || !activeProjectId || loadedEditorProjectId !== activeProjectId) return;
    void localDB.set(projectStorageKey(activeProjectId, 'ratio'), ratio);
  }, [activeProjectId, authUser?.id, loadedEditorProjectId, loadedLocalStateUserId, ratio]);

  // Track continuous layer modifications with a 400ms debounce
  useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }
    // Only record when history has been initialized
    if (historyStateRef.current.index === -1) return;

    const timer = setTimeout(() => {
      setHistoryState(prev => pushHistorySnapshot(prev, layers, '编辑图层属性'));
    }, 400);

    return () => clearTimeout(timer);
  }, [layers]);

  const undo = () => {
    const result = undoHistory(historyStateRef.current);
    if (result) {
      isNavigatingRef.current = true;
      setLayers(result.restoredLayers);
      setHistoryState(result.state);
      toast.info(`↩️ 已撤销：${result.actionDesc}`);

      if (selectedLayerIdRef.current && !result.restoredLayers.some(l => l.id === selectedLayerIdRef.current)) {
        setSelectedLayerId(null);
      }
    }
  };

  const redo = () => {
    const result = redoHistory(historyStateRef.current);
    if (result) {
      isNavigatingRef.current = true;
      setLayers(result.restoredLayers);
      setHistoryState(result.state);
      toast.info(`↪️ 已重做：${result.actionDesc}`);

      if (selectedLayerIdRef.current && !result.restoredLayers.some(l => l.id === selectedLayerIdRef.current)) {
        setSelectedLayerId(null);
      }
    }
  };

  // Unified Professional Keyboard hotkeys with input guard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard: when typing in text input, textarea or select, leave shortcuts to browser native text editing!
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable) {
          return;
        }
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        } else if (e.key.toLowerCase() === 'b') {
          e.preventDefault();
          if (selectedLayerIdRef.current) {
            const res = splitLayerInList(layersRef.current, selectedLayerIdRef.current, currentTimeRef.current);
            if (res) {
              setLayers(res.newLayers);
              setSelectedLayerId(res.newLayerId);
              commitInstantHistory(res.newLayers, `分割图层「${res.splitLayer.name}」`);
              toast.success(`✂️ 已在 ${currentTimeRef.current.toFixed(2)}s 处分割图层！可按 Ctrl+Z 撤销`);
            } else {
              toast.warning('当前播放头位置无法分割选中的图层（播放头需在图层中间）');
            }
          } else {
            toast.info('💡 请先选定要分割的图层 (快捷键: Ctrl+B)');
          }
        }
      } else if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerIdRef.current) {
          const idToDelete = selectedLayerIdRef.current;
          setLayers(prev => {
            const targetLayer = prev.find(l => l.id === idToDelete);
            if (!targetLayer) return prev;
            const updated = prev.filter(l => l.id !== idToDelete);
            commitInstantHistory(updated, `删除图层「${targetLayer.name}」`);
            toast.info(`已删除「${targetLayer.name}」，可按 Ctrl+Z 撤销`);
            return updated;
          });
          setSelectedLayerId(null);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 0.1;
        setCurrentTime(prev => Math.max(0, parseFloat((prev - step).toFixed(2))));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 0.1;
        setCurrentTime(prev => Math.min(15, parseFloat((prev + step).toFixed(2))));
      } else if (e.key === 'Escape') {
        if (selectedLayerIdRef.current) {
          setSelectedLayerId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 6. AI processing mock triggers
  const [modelSwapRunning, setModelSwapRunning] = useState(false);

  // 7. Video export triggers
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportLogs, setExportLogs] = useState<string[]>([]);

  // Trigger click on DOM element to run export
  const triggerExport = () => {
    const trigger = document.getElementById('export-trigger');
    if (trigger) {
      trigger.click();
    }
  };

  // Route C: Handle deep linking from Sidebar AI wizard directly into Infinite Canvas
  const handleOpenInCanvas = async (options?: {
    type?: 'outfit' | 'storyboard' | 'image' | 'project';
    src?: string;
    title?: string;
    prompt?: string;
  }) => {
    const currentProj = projects.find(p => p.id === activeProjectId);
    if (currentProj) {
      const topology = convertAiProjectToCanvas(currentProj);
      if (options?.type === 'image' && options.src) {
        topology.nodes.push({
          id: `node_preview_${Date.now()}`,
          type: 'image',
          title: options.title || '模特穿搭预览',
          position: { x: 740, y: 300 },
          width: 280,
          height: 380,
          status: 'success',
          metadata: { imageSrc: options.src }
        });
      }
      await saveCanvasTopologyToLocalDB(activeProjectId, topology.nodes, topology.connections);
    }
    setViewMode('canvas');
    toast.success('已切换至无限画布，并为您载入当前方案节点拓扑！');
  };

  const addDefaultTextLayer = () => {
    const id = `text_${Date.now()}`;
    const newLayers: Layer[] = [...layers, {
      id, type: 'text', name: '营销文案', start: currentTime, end: Math.min(15, currentTime + 4),
      visible: true, x: 50, y: 50, scale: 1, opacity: 1,
      properties: { text: '点击编辑营销卖点', fontSize: 32, color: '#ffffff', animation: 'zoom', bold: true, shadow: true }
    }];
    setLayers(newLayers);
    setSelectedLayerId(id);
    commitInstantHistory(newLayers, '添加文案图层');
    toast.success('已添加文案图层');
  };

  const handleSwitchProject = (projectId: string) => {
    setActiveProjectId(projectId);
    if (sidebarRef.current) {
      sidebarRef.current.switchProject(projectId);
    }
  };

  const handleCreateNewProject = () => {
    if (sidebarRef.current) {
      sidebarRef.current.createNewProject();
    } else {
      const defaultName = `项目_${projects.length + 1}`;
      const input = prompt('请输入新项目名称：', defaultName);
      if (input === null) return;
      const id = crypto.randomUUID?.() || `proj_${Date.now()}`;
      const project = createAIProject({ id, name: input.trim() || defaultName, withDefaultPrompts: true });
      setProjects(prev => [...prev, project]);
      setActiveProjectId(project.id);
      toast.success(`已创建并切换至新项目「${project.name}」！`);
    }
  };

  const handleOnboardingComplete = (result: OnboardingResult) => {
    const created = sidebarRef.current?.createProjectWithTemplate({
      name: result.name,
      masterPrompt: result.template.masterPrompt,
      prompts: result.template.prompts
    });

    if (!created) {
      const id = crypto.randomUUID?.() || `proj_${Date.now()}`;
      const project = createAIProject({ id, name: result.name, withDefaultPrompts: true });
      const projectWithTemplate: AIProject = {
        ...project,
        i2vMasterPrompt15s: result.template.masterPrompt,
        i2vPrompts: { ...project.i2vPrompts, ...result.template.prompts }
      };
      setProjects(previous => [...previous, projectWithTemplate]);
      setActiveProjectId(projectWithTemplate.id);
    }

    setRatio(result.ratio);
    setViewMode('editor');
    handleActiveTabChange('media');
    setIsDrawerCollapsed(false);
    if (authUser?.id) {
      localStorage.setItem(`KEYVIDEO_ONBOARDING_DONE_V1_${authUser.id}`, '1');
    }
    setIsOnboardingOpen(false);
    toast.success(`项目「${result.name}」已创建，先去素材库导入素材`);
  };

  const handleOnboardingSkip = () => {
    if (authUser?.id) {
      localStorage.setItem(`KEYVIDEO_ONBOARDING_DONE_V1_${authUser.id}`, '1');
    }
    setIsOnboardingOpen(false);
  };

  const handleStartRenameProject = () => {
    if (sidebarRef.current) {
      sidebarRef.current.startRenameProject();
    } else {
      const cur = projects.find(p => p.id === activeProjectId);
      if (cur) {
        setEditingProjNameValue(cur.name);
        setIsEditingProjName(true);
      }
    }
  };

  const handleSaveProjectName = () => {
    if (sidebarRef.current) {
      sidebarRef.current.saveProjectName();
    } else {
      const name = editingProjNameValue.trim();
      if (!name) {
        toast.error('项目名称不能为空！');
        return;
      }
      setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, name } : p));
      setIsEditingProjName(false);
      toast.success('项目名称已更新！');
    }
  };

  const handleDeleteProject = (projectId: string) => {
    if (projects.length <= 1) {
      toast.warning('至少需要保留一个项目！');
      return;
    }
    if (sidebarRef.current) {
      sidebarRef.current.deleteProject(projectId);
    } else {
      const target = projects.find(p => p.id === projectId);
      if (!confirm(`确认要删除项目「${target?.name || '当前项目'}」吗？`)) return;
      const remaining = projects.filter(p => p.id !== projectId);
      setProjects(remaining);
      setActiveProjectId(remaining[0].id);
      toast.info(`已删除项目「${target?.name || ''}」`);
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user?.id) return supabase.from('ai_video_projects').delete().eq('id', projectId);
        return undefined;
      }).catch(error => console.warn('Failed to delete project from Supabase:', error));
    }
  };

  const isLibraryWorkspace = viewMode === 'editor'
    && !isDrawerCollapsed
    && (activeTab === 'template' || activeTab === 'media' || activeTab === 'prompt' || activeTab === 'text' || activeTab === 'audio');
  const activeProject = projects.find(project => project.id === activeProjectId);
  const libraryTitle = activeTab === 'template' ? '脚本模板' : activeTab === 'media' ? '素材库' : activeTab === 'text' ? '文本工作台' : activeTab === 'audio' ? '音乐工作台' : '提示词库';

  const renderTimeline = (fullPage = false) => (
    <Timeline
      layers={layers}
      setLayers={setLayers}
      currentTime={currentTime}
      setCurrentTime={setCurrentTime}
      selectedLayerId={selectedLayerId}
      setSelectedLayerId={setSelectedLayerId}
      undo={undo}
      redo={redo}
      canUndo={historyState.index > 0}
      canRedo={historyState.index < historyState.stack.length - 1}
      undoCount={historyState.index}
      redoCount={historyState.stack.length - 1 - historyState.index}
      commitInstantHistory={commitInstantHistory}
      storyboards={projects.find(p => p.id === activeProjectId)?.storyboards ?? []}
      isCollapsed={fullPage ? false : isTimelineCollapsed}
      onToggleCollapsed={fullPage ? undefined : () => setIsTimelineCollapsed(previous => !previous)}
      fullPage={fullPage}
    />
  );

  if (loadingSession) {
    return <AppLoadingScreen />;
  }

  if (authUser && loadedLocalStateUserId !== authUser.id) {
    return <AppLoadingScreen />;
  }

  if (!authUser) {
    return <AuthPage initialError={authError} />;
  }

  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <div className={`studio-app ${isLibraryWorkspace ? 'studio-library' : `studio-${viewMode}`} ${isFullscreen ? 'studio-fullscreen' : ''}`}>
      {/* Header bar */}
      <header className="app-header">
        {!isLibraryWorkspace && <button className="studio-home" onClick={() => { setViewMode('editor'); setIsDrawerCollapsed(true); }} aria-label="KeyVideo 工作台"><StudioBrand /></button>}
        {isLibraryWorkspace ? <div className="studio-breadcrumb"><button onClick={() => setIsDrawerCollapsed(true)}>工作台</button><span>/</span><b>{libraryTitle}</b></div> : <div className="studio-project-context">
          <ProjectSelector
            projects={projects}
            activeProjectId={activeProjectId}
            isEditing={isEditingProjName}
            editingName={editingProjNameValue}
            theme={theme}
            onEditingNameChange={setEditingProjNameValue}
            onCancelEditing={() => setIsEditingProjName(false)}
            onSaveName={handleSaveProjectName}
            onSwitchProject={handleSwitchProject}
            onCreateProject={handleCreateNewProject}
            onStartRename={handleStartRenameProject}
            onDeleteProject={handleDeleteProject}
            onOpenDashboard={() => setIsProjectsModalOpen(true)}
          />
          <span className="studio-project-view">
            <span className="studio-context-divider">/</span>
            <span>{viewMode === 'canvas' ? '无限画布' : viewMode === 'timeline' ? '时间轴' : '剪辑工作台'}</span>
          </span>
        </div>}

        {!isLibraryWorkspace && viewMode === 'editor' && <div className="studio-header-history" aria-label="历史操作">
          <button className="studio-button history-button" disabled={historyState.index <= 0} onClick={undo} title="撤销最近一次编辑（Ctrl/⌘ + Z）">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h9a7 7 0 1 1 0 14h-2" /></svg><span>撤销</span>
          </button>
          <button className="studio-button history-button" disabled={historyState.index >= historyState.stack.length - 1} onClick={redo} title="重做刚刚撤销的编辑（Ctrl/⌘ + Y）">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5" /><path d="M20 9h-9a7 7 0 1 0 0 14h2" /></svg><span>重做</span>
          </button>
        </div>}

        <AppHeaderActions
          variant={isLibraryWorkspace ? 'library' : viewMode}
          theme={theme}
          onOpenProjects={isLibraryWorkspace && activeTab !== 'template' ? undefined : () => setIsProjectsModalOpen(true)}
          onPreview={() => { setViewMode('editor'); setIsDrawerCollapsed(true); setIsFullscreen(true); }}
           onCanvasAction={action => {
             const handlers = canvasActionsRef.current;
             if (!handlers) {
               toast.info('画布尚未准备好，请稍后再试');
               return;
             }
             if (action === 'import') handlers.importProject();
             if (action === 'fit') handlers.fitViewport();
             if (action === 'run') handlers.runPipeline();
           }}
          userEmail={authUser.email || authUser.displayName || authUser.id}
          onAddLayer={addDefaultTextLayer}
          onExport={triggerExport}
          onToggleCopilot={() => setIsCopilotOpen(prev => !prev)}
          onOpenCustomApiModal={() => setIsCustomApiModalOpen(true)}
          onExportProjectPackage={async () => {
            const curProj = projects.find(p => p.id === activeProjectId);
            const canvasData = await localDB.get<{
              nodes: CanvasNodeData[];
              connections: CanvasConnection[];
              viewport?: CanvasViewport;
            }>(`KEYVIDEO_CANVAS_DATA_${activeProjectId || 'default'}`);
            exportProjectPackage({
              project: curProj,
              ratio,
              layers,
              infiniteCanvas: canvasData || undefined,
              storyboards: curProj?.storyboards,
              modelOutfitImgUrl: curProj?.modelOutfitImgUrl,
              referenceOutfitUrls: curProj?.referenceOutfitUrls,
              modelScene: curProj?.modelScene,
              customPrompt: curProj?.i2vMasterPrompt15s
            });
            toast.success('已导出当前工程包（包含时间轴与无限画布数据）！');
          }}
          onImportProjectPackage={async (file) => {
            try {
              const pkg = await importProjectPackage(file);
              if (pkg.canvas?.layers) {
                setLayers(pkg.canvas.layers);
              }
              if (pkg.canvas?.ratio) {
                setRatio(pkg.canvas.ratio);
              }
              if (pkg.aiState) {
                setProjects(previous => previous.map(project => project.id === activeProjectId ? {
                  ...project,
                  name: pkg.project?.name || project.name,
                  storyboards: pkg.aiState?.storyboards || project.storyboards,
                  modelOutfitImgUrl: pkg.aiState?.modelOutfitImgUrl ?? project.modelOutfitImgUrl,
                  modelOutfitImgUrls: pkg.aiState?.modelOutfitImgUrl ? [pkg.aiState.modelOutfitImgUrl] : project.modelOutfitImgUrls,
                  referenceOutfitUrl: pkg.aiState?.referenceOutfitUrls?.[0] || project.referenceOutfitUrl,
                  referenceOutfitUrls: pkg.aiState?.referenceOutfitUrls || project.referenceOutfitUrls,
                  modelScene: pkg.aiState?.modelScene || project.modelScene,
                  i2vMasterPrompt15s: pkg.aiState?.customPrompt || project.i2vMasterPrompt15s
                } : project));
                window.setTimeout(() => sidebarRef.current?.switchProject(activeProjectId), 0);
              }
              if (pkg.infiniteCanvas) {
                await localDB.set(`KEYVIDEO_CANVAS_DATA_${activeProjectId || 'default'}`, pkg.infiniteCanvas);
              }
              toast.success(`已恢复工程「${pkg.project?.name || '导入工程'}」的全量配置与画布！`);
            } catch (err) {
              toast.error(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
          onOpenSettings={() => {
            setBackendUrlInput(localStorage.getItem('KEYVIDEO_BACKEND_URL') || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001');
            setIsSettingsModalOpen(true);
          }}
          onReplayOnboarding={() => setIsOnboardingOpen(true)}
          onToggleTheme={toggleTheme}
          onSetTheme={(newTheme) => {
            setTheme(newTheme);
            toast.info(`已切换至 ${newTheme === 'dark' ? '🌙 暗黑主题' : '☀️ 浅色主题'}`);
          }}
          onSignOut={async () => {
            setSsoUser(null);
            setSupabaseSession(null);
            await logoutSso();
            try {
              await supabase.auth.signOut();
            } catch (error) {
              console.warn('Failed to sign out of Supabase:', error);
            }
          }}
        />
     </header>

      {!isLibraryWorkspace && viewMode !== 'canvas' && <div className="studio-modebar">
        <div className="studio-mode-label"><span>编辑模式</span><b>{viewMode === 'timeline' ? '时间轴' : '剪辑工作台'}</b></div>
        <ViewModeSwitch mode={viewMode} onChange={mode => { setViewMode(mode); setIsDrawerCollapsed(true); }} />
        {viewMode === 'editor' && <AspectRatioSelector ratio={ratio} onRatioChange={handleRatioChange} onSmartReflow={handleSmartReflow} />}
         <div className="studio-mode-meta" aria-label="项目状态">
           <span className="studio-save-status"><i aria-hidden="true" />已自动保存</span>
           <span className="studio-meta-divider" aria-hidden="true" />
           <span>片段 <b>{layers.filter(layer => layer.type === 'media').length}</b></span>
           <span>时长 <b>{Math.max(0, ...layers.map(layer => layer.end)).toFixed(1)}s</b></span>
         </div>
      </div>}

      {/* Editor Body Workspace */}
      <div className={`editor-container ${isLibraryWorkspace ? 'library-workspace' : ''}`}>
        {viewMode === 'timeline' ? (
          <div className="canvas-workspace-shell timeline-workspace">
            <div className="timeline-fullpage-shell">
              <div className="timeline-fullpage-main">
                {renderTimeline(true)}
              </div>
              <StudioInspector
                mode="timeline"
                layers={layers}
                setLayers={setLayers}
                selectedLayerId={selectedLayerId}
                setSelectedLayerId={setSelectedLayerId}
              />
            </div>
          </div>
        ) : viewMode === 'canvas' ? (
          <div className="canvas-workspace-shell">
            <Suspense fallback={<AppLoadingScreen />}>
              <InfiniteCanvas
                projectId={activeProjectId}
                activeProject={projects.find(p => p.id === activeProjectId)}
                currentTime={currentTime}
                layers={layers}
                setLayers={setLayers}
                commitHistory={commitInstantHistory}
                onRegisterAutoLayout={(fn) => { canvasAutoLayoutRef.current = fn; }}
                onRegisterActions={(actions) => { canvasActionsRef.current = actions; }}
                onOpenEditor={() => {
                  setViewMode('editor');
                  setIsDrawerCollapsed(true);
                  setIsTimelineCollapsed(false);
                }}
                onOpenTimeline={() => {
                  setViewMode('timeline');
                  setIsDrawerCollapsed(true);
                }}
              />
            </Suspense>
          </div>
        ) : (
          <>
            <ToolNavigation
              activeTab={activeTab}
              isDrawerCollapsed={isDrawerCollapsed}
              onSelectTab={(tab) => {
                handleActiveTabChange(tab);
                setIsDrawerCollapsed(false);
                setIsTimelineCollapsed(tab !== 'ai');
              }}
              onSelectWorkspace={() => setIsDrawerCollapsed(true)}
            />

            <SidebarDrawer
              ref={sidebarRef}
              activeTab={activeTab}
              setActiveTab={handleActiveTabChange}
              layers={layers}
              setLayers={setLayers}
              selectedLayerId={selectedLayerId}
              setSelectedLayerId={setSelectedLayerId}
              currentTime={currentTime}
              setCurrentTime={setCurrentTime}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              setModelSwapRunning={setModelSwapRunning}
              ratio={ratio}
              session={authUser.id}
              projects={projects}
              setProjects={setProjects}
              activeProjectId={activeProjectId}
              setActiveProjectId={setActiveProjectId}
              isEditingProjName={isEditingProjName}
              setIsEditingProjName={setIsEditingProjName}
              editingProjNameValue={editingProjNameValue}
              setEditingProjNameValue={setEditingProjNameValue}
              isProjectsModalOpen={isProjectsModalOpen}
              setIsProjectsModalOpen={setIsProjectsModalOpen}
              isCollapsed={isDrawerCollapsed}
              onToggleCollapse={() => setIsDrawerCollapsed(!isDrawerCollapsed)}
              onOpenInCanvas={handleOpenInCanvas}
            />

            {!isLibraryWorkspace && (
              <VideoCanvas
                ratio={ratio}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                layers={layers}
                setLayers={setLayers}
                selectedLayerId={selectedLayerId}
                setSelectedLayerId={setSelectedLayerId}
                modelSwapRunning={modelSwapRunning}
                exporting={exporting}
                setExporting={setExporting}
                exportProgress={exportProgress}
                setExportProgress={setExportProgress}
                exportLogs={exportLogs}
                setExportLogs={setExportLogs}
                isFullscreen={isFullscreen}
                setIsFullscreen={setIsFullscreen}
              />
            )}

            {!isLibraryWorkspace && (
              <StudioInspector
                mode="editor"
                layers={layers}
                setLayers={setLayers}
                selectedLayerId={selectedLayerId}
                setSelectedLayerId={setSelectedLayerId}
                isCollapsed={isInspectorCollapsed}
                onToggleCollapse={() => setIsInspectorCollapsed(!isInspectorCollapsed)}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom timeline track scrubbers (Hidden during fullscreen preview or canvas mode) */}
      {!isFullscreen && viewMode === 'editor' && !isLibraryWorkspace && renderTimeline(false)}
      {!isLibraryWorkspace && <footer className="studio-statusbar">
        <span className="studio-status-ok"><i aria-hidden="true" />服务正常</span>
        <span className="studio-status-summary"><b>{Math.max(0, ...layers.map(layer => layer.end)).toFixed(1)}s</b><span>·</span><b>{layers.filter(layer => layer.visible).length}</b> 个图层</span>
        <span className="studio-status-right"><strong>{activeProject?.name || '当前工程'}</strong><span>拖动片段调整节奏</span></span>
      </footer>}
      </div>

      {!isFullscreen && !isCopilotOpen && <AICopilotLauncher onClick={() => setIsCopilotOpen(true)} />}

      {isOnboardingOpen && (
        <OnboardingWizard
          isOpen={isOnboardingOpen}
          onSkip={handleOnboardingSkip}
          onComplete={handleOnboardingComplete}
        />
      )}

      <BackendSettingsModal
        isOpen={isSettingsModalOpen}
        value={backendUrlInput}
        onChange={setBackendUrlInput}
        onClose={() => setIsSettingsModalOpen(false)}
        theme={theme}
        onThemeChange={(newTheme) => {
          setTheme(newTheme);
          toast.info(`已切换至 ${newTheme === 'dark' ? '🌙 暗黑主题' : '☀️ 浅色主题'}`);
        }}
      />

      {/* AI Copilot & Custom API Modals */}
      <AICopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        context={{
          layers,
          setLayers,
          ratio,
          onRatioChange: handleRatioChange,
          onSmartReflow: handleSmartReflow,
          currentTime,
          setCurrentTime,
          isPlaying,
          setIsPlaying,
          selectedLayerId,
          setSelectedLayerId,
          triggerExport,
          viewMode: viewMode === 'canvas' ? 'canvas' : 'editor',
          setViewMode,
          onCanvasGeneratePipeline: async (theme?: string) => {
            const currentProj = projects.find(p => p.id === activeProjectId);
            const pipeline = generateCanvasPipeline(theme || currentProj?.name || '法式复古小黑裙通勤穿搭', currentProj?.topClothingUrl);
            await saveCanvasTopologyToLocalDB(activeProjectId, pipeline.nodes, pipeline.connections);
            setViewMode('canvas');
            toast.success(`已为「${theme || '当前项目'}」在无限画布中生成完整分镜管线！`);
          },
          onCanvasAddNode: (type, title) => {
            setViewMode('canvas');
            toast.info(`已切换至画布模式，请点击上方工具栏或快捷键添加「${title || type}」节点`);
          },
          onCanvasAutoLayout: () => {
            if (canvasAutoLayoutRef.current) {
              canvasAutoLayoutRef.current();
            } else {
              setViewMode('canvas');
              setTimeout(() => {
                canvasAutoLayoutRef.current?.();
              }, 100);
            }
          }
        }}
      />

      {/* Global AI Projects Management Dashboard Modal */}
      <ProjectsModal
        isOpen={isProjectsModalOpen}
        onClose={() => setIsProjectsModalOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        createNewProject={handleCreateNewProject}
        switchProject={handleSwitchProject}
        setProjects={setProjects}
        deleteProject={handleDeleteProject}
        onExportPackage={async () => {
          const curProj = projects.find(p => p.id === activeProjectId);
          const canvasData = await localDB.get<{
            nodes: CanvasNodeData[];
            connections: CanvasConnection[];
            viewport?: CanvasViewport;
          }>(`KEYVIDEO_CANVAS_DATA_${activeProjectId || 'default'}`);
          exportProjectPackage({
            project: curProj,
            ratio,
            layers,
            infiniteCanvas: canvasData || undefined,
            storyboards: curProj?.storyboards,
            modelOutfitImgUrl: curProj?.modelOutfitImgUrl,
            referenceOutfitUrls: curProj?.referenceOutfitUrls,
            modelScene: curProj?.modelScene,
            customPrompt: curProj?.i2vMasterPrompt15s
          });
          toast.success('已成功导出完整工程包 (.keyvideo.json)！');
        }}
        onImportPackage={async (pkg) => {
          try {
            if (pkg.canvas?.layers) {
              setLayers(pkg.canvas.layers);
            }
            if (pkg.canvas?.ratio) {
              setRatio(pkg.canvas.ratio);
            }
            if (pkg.aiState) {
              setProjects(previous => previous.map(project => project.id === activeProjectId ? {
                ...project,
                name: pkg.project?.name || project.name,
                storyboards: pkg.aiState?.storyboards || project.storyboards,
                modelOutfitImgUrl: pkg.aiState?.modelOutfitImgUrl ?? project.modelOutfitImgUrl,
                modelOutfitImgUrls: pkg.aiState?.modelOutfitImgUrl ? [pkg.aiState.modelOutfitImgUrl] : project.modelOutfitImgUrls,
                referenceOutfitUrl: pkg.aiState?.referenceOutfitUrls?.[0] || project.referenceOutfitUrl,
                referenceOutfitUrls: pkg.aiState?.referenceOutfitUrls || project.referenceOutfitUrls,
                modelScene: pkg.aiState?.modelScene || project.modelScene,
                i2vMasterPrompt15s: pkg.aiState?.customPrompt || project.i2vMasterPrompt15s
              } : project));
              window.setTimeout(() => sidebarRef.current?.switchProject(activeProjectId), 0);
            }
            if (pkg.infiniteCanvas) {
              await localDB.set(`KEYVIDEO_CANVAS_DATA_${activeProjectId || 'default'}`, pkg.infiniteCanvas);
            }
            setIsProjectsModalOpen(false);
            toast.success(`已恢复工程「${pkg.project?.name || '导入工程'}」的全量配置与画布！`);
          } catch (err) {
            toast.error(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
          }
        }}
      />

      <CustomApiScriptModal
        isOpen={isCustomApiModalOpen}
        onClose={() => setIsCustomApiModalOpen(false)}
      />

      {/* Global modern toast notifications */}
      <ToastContainer />
    </Suspense>
  );
}

export default App;
