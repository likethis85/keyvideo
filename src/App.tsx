import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Layer } from './components/VideoCanvas';
import { BackendSettingsModal } from './components/app/BackendSettingsModal';
import { AICopilotDrawer } from './components/app/AICopilotDrawer';
import { CustomApiScriptModal } from './components/app/CustomApiScriptModal';
import { exportProjectPackage, importProjectPackage } from './utils/projectPackageExporter';
import { ToolNavigation } from './components/app/ToolNavigation';
import type { EditorToolTab } from './components/app/ToolNavigation';
import { ProjectSelector } from './components/app/ProjectSelector';
import { AspectRatioSelector } from './components/app/AspectRatioSelector';
import { AppHeaderActions } from './components/app/AppHeaderActions';
import { AppLoadingScreen } from './components/app/AppLoadingScreen';
import { AppBrand } from './components/app/AppBrand';
import type { AIProject, StoryboardItem } from './types/aiProject';
import type { SidebarDrawerRef } from './components/sidebar/sidebarTypes';
import { localDB } from './utils/db';
import { supabase } from './utils/supabaseClient';
import { AuthPage } from './components/AuthPage';
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
import './App.css';

const SidebarDrawer = lazy(() => import('./components/SidebarDrawer').then((module) => ({
  default: module.SidebarDrawer
})));
const VideoCanvas = lazy(() => import('./components/VideoCanvas').then((module) => ({
  default: module.VideoCanvas
})));
const PropertyInspector = lazy(() => import('./components/PropertyInspector').then((module) => ({
  default: module.PropertyInspector
})));
const Timeline = lazy(() => import('./components/Timeline').then((module) => ({
  default: module.Timeline
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

  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Check active session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  // 3. Tab navigation state
  const [activeTab, setActiveTab] = useState<EditorToolTab>('template');
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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



  // Load saved state from database on mount
  useEffect(() => {
    const loadState = async () => {
      const savedRatio = await localDB.get('keyvideo_ratio') as AspectRatio | null;
      if (savedRatio) {
        setRatio(savedRatio);
      }

      const savedLayers = await localDB.get('keyvideo_layers') as Layer[] | null;
      const savedStoryboards = await localDB.get('ai_storyboards') as StoryboardItem[] | null;

      let initialLayers = createDefaultLayers();

      if (savedLayers) {
        const updatedLayers = savedLayers.map((layer) => {
          if (layer.type === 'media' && layer.properties.isVideo) {
            let sbIndex = -1;
            if (layer.id.startsWith('media_i2v_0_')) sbIndex = 0;
            else if (layer.id.startsWith('media_i2v_1_')) sbIndex = 1;
            else if (layer.id.startsWith('media_i2v_2_')) sbIndex = 2;

            if (sbIndex !== -1 && savedStoryboards && savedStoryboards[sbIndex]) {
              const sb = savedStoryboards[sbIndex];
              if (sb.videoBlob) {
                const cacheKey = sb.id;
                if (!videoBlobUrls.has(cacheKey)) {
                  videoBlobUrls.set(cacheKey, URL.createObjectURL(sb.videoBlob));
                }
                layer.properties.src = videoBlobUrls.get(cacheKey);
              }
            }
          }
          return layer;
        });
        initialLayers = updatedLayers;
        setLayers(updatedLayers);
      }

      setHistoryState(createInitialHistory(initialLayers, '加载工程模板'));
    };

    loadState();
  }, []);

  // Save layers and ratio to localDB when they change
  useEffect(() => {
    if (layers.length > 0 && historyState.index >= 0) {
      localDB.set('keyvideo_layers', layers);
    }
  }, [layers, historyState.index]);

  useEffect(() => {
    localDB.set('keyvideo_ratio', ratio);
  }, [ratio]);

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

  if (loadingSession) {
    return <AppLoadingScreen />;
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <Suspense fallback={<AppLoadingScreen />}>
      {/* Header bar */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: '10px' }}>
          <AppBrand />

          <ProjectSelector
            projects={projects}
            activeProjectId={activeProjectId}
            isEditing={isEditingProjName}
            editingName={editingProjNameValue}
            theme={theme}
            onEditingNameChange={setEditingProjNameValue}
            onCancelEditing={() => setIsEditingProjName(false)}
            onSaveName={() => sidebarRef.current?.saveProjectName()}
            onSwitchProject={(id) => sidebarRef.current?.switchProject(id)}
            onCreateProject={() => sidebarRef.current?.createNewProject()}
            onStartRename={() => sidebarRef.current?.startRenameProject()}
            onDeleteProject={(id) => sidebarRef.current?.deleteProject(id)}
            onOpenDashboard={() => setIsProjectsModalOpen(true)}
          />
        </div>

        <AspectRatioSelector
          ratio={ratio}
          onRatioChange={handleRatioChange}
          onSmartReflow={handleSmartReflow}
        />

        <AppHeaderActions
          theme={theme}
          userEmail={session.user.email}
          onAddLayer={addDefaultTextLayer}
          onExport={triggerExport}
          onToggleCopilot={() => setIsCopilotOpen(prev => !prev)}
          onOpenCustomApiModal={() => setIsCustomApiModalOpen(true)}
          onExportProjectPackage={() => {
            const curProj = projects.find(p => p.id === activeProjectId);
            exportProjectPackage({ project: curProj, ratio, layers });
            toast.success('已导出当前工程包 (.keyvideo.json)！');
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
              toast.success(`已恢复工程「${pkg.project?.name || '导入工程'}」的全量配置！`);
            } catch (err) {
              toast.error(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
          onOpenSettings={() => {
            setBackendUrlInput(localStorage.getItem('KEYVIDEO_BACKEND_URL') || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001');
            setIsSettingsModalOpen(true);
          }}
          onToggleTheme={toggleTheme}
          onSignOut={async () => { await supabase.auth.signOut(); }}
        />
     </header>

      {/* Editor Body Workspace */}
      <div className="editor-container">
        <ToolNavigation
          activeTab={activeTab}
          isDrawerCollapsed={isDrawerCollapsed}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setIsDrawerCollapsed(false);
          }}
          onReopenDrawer={() => setIsDrawerCollapsed(false)}
        />

        <SidebarDrawer
          ref={sidebarRef}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          layers={layers}
          setLayers={setLayers}
          selectedLayerId={selectedLayerId}
          setSelectedLayerId={setSelectedLayerId}
          setModelSwapRunning={setModelSwapRunning}
          ratio={ratio}
          session={session}
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
        />

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

        {/* Right side settings column */}
        <PropertyInspector
          layers={layers}
          setLayers={setLayers}
          selectedLayerId={selectedLayerId}
          setSelectedLayerId={setSelectedLayerId}
          isCollapsed={isInspectorCollapsed}
          onToggleCollapse={() => setIsInspectorCollapsed(!isInspectorCollapsed)}
        />
      </div>

      {/* Bottom timeline track scrubbers (Hidden during fullscreen preview) */}
      {!isFullscreen && (
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
        />
      )}

      <BackendSettingsModal
        isOpen={isSettingsModalOpen}
        value={backendUrlInput}
        onChange={setBackendUrlInput}
        onClose={() => setIsSettingsModalOpen(false)}
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
          triggerExport
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
