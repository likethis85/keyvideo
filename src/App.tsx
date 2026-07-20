import { useState, useEffect, useRef } from 'react';
import { VideoCanvas } from './components/VideoCanvas';
import type { Layer } from './components/VideoCanvas';
import { Timeline } from './components/Timeline';
import { SidebarDrawer } from './components/SidebarDrawer';
import type { AIProject, SidebarDrawerRef } from './components/SidebarDrawer';
import { PropertyInspector } from './components/PropertyInspector';
import { localDB } from './utils/db';
import { supabase } from './utils/supabaseClient';
import { AuthPage } from './components/AuthPage';
import './App.css';

function App() {
  // History Undo/Redo states
  const [historyState, setHistoryState] = useState<{
    stack: Layer[][];
    index: number;
  }>({
    stack: [],
    index: -1
  });
  const isNavigatingRef = useRef(false);

  const historyStateRef = useRef(historyState);
  useEffect(() => {
    historyStateRef.current = historyState;
  }, [historyState]);

  const selectedLayerIdRef = useRef<string | null>(null);

  const [session, setSession] = useState<any>(null);
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

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Ratio size setup: 1-1, 3-4, 9-16
  const [ratio, setRatio] = useState<'1-1' | '3-4' | '9-16'>('3-4');

  // 2. Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // 3. Tab navigation state
  const [activeTab, setActiveTab] = useState<'template' | 'media' | 'text' | 'sticker' | 'ai' | 'audio'>('template');

  // AI Project Management States
  const [projects, setProjects] = useState<AIProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [isEditingProjName, setIsEditingProjName] = useState(false);
  const [editingProjNameValue, setEditingProjNameValue] = useState('');
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const sidebarRef = useRef<SidebarDrawerRef | null>(null);

  // User profile dropdown states
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);

  // 4. Initial Default Layers (Ready-to-use template for gorgeous first impression)
  const [layers, setLayers] = useState<Layer[]>([
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
      end: 6.5,
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
      start: 7,
      end: 13,
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
      name: '动感时尚卡点音轨',
      start: 0,
      end: 15,
      visible: true,
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      properties: { src: 'fashion_beat.mp3', volume: 0.8 }
    },
    {
      id: 'logo_layer',
      type: 'media',
      name: '品牌 LOGO',
      start: 0,
      end: 1,
      visible: true,
      x: 50,
      y: 50,
      scale: 1.5,
      opacity: 1,
      properties: { src: '/logo.png', bgRemoved: false }
    }
  ]);

  // 5. Selected Layer state
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>('media_1');

  useEffect(() => {
    selectedLayerIdRef.current = selectedLayerId;
  }, [selectedLayerId]);

  const layersRef = useRef(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  // Handle keyboard Delete / Backspace to remove selected layer, and Space to toggle play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerIdRef.current) {
          const layerIdToDelete = selectedLayerIdRef.current;
          const currentLayers = layersRef.current;
          const targetLayer = currentLayers.find(l => l.id === layerIdToDelete);
          const layerName = targetLayer ? targetLayer.name : '元素';

          const confirmDelete = window.confirm(`是否确认删除选中的 "${layerName}"？`);
          if (confirmDelete) {
            setLayers(prev => prev.filter(l => l.id !== layerIdToDelete));
            setSelectedLayerId(null);
          }
        }
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault(); // Prevent standard page scrolling action
        setIsPlaying(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedLayerId, setLayers, setIsPlaying]);

  // Load saved state from database on mount
  useEffect(() => {
    const loadState = async () => {
      const savedRatio = await localDB.get('keyvideo_ratio');
      if (savedRatio) {
        setRatio(savedRatio);
      }

      const savedLayers = await localDB.get('keyvideo_layers');
      const savedStoryboards = await localDB.get('ai_storyboards');

      let initialLayers = layers;

      if (savedLayers) {
        const updatedLayers = savedLayers.map((layer: any) => {
          if (layer.type === 'media' && layer.properties.isVideo) {
            let sbIndex = -1;
            if (layer.id.startsWith('media_i2v_0_')) sbIndex = 0;
            else if (layer.id.startsWith('media_i2v_1_')) sbIndex = 1;
            else if (layer.id.startsWith('media_i2v_2_')) sbIndex = 2;

            if (sbIndex !== -1 && savedStoryboards && savedStoryboards[sbIndex]) {
              const sb = savedStoryboards[sbIndex];
              if (sb.videoBlob) {
                if (!(window as any)._videoBlobUrls) {
                  (window as any)._videoBlobUrls = {};
                }
                const cacheKey = sb.id;
                if (!(window as any)._videoBlobUrls[cacheKey]) {
                  (window as any)._videoBlobUrls[cacheKey] = URL.createObjectURL(sb.videoBlob);
                }
                layer.properties.src = (window as any)._videoBlobUrls[cacheKey];
              }
            }
          }
          return layer;
        });
        initialLayers = updatedLayers;
        setLayers(updatedLayers);
      }

      setHistoryState({
        stack: [initialLayers],
        index: 0
      });
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

  // Track layer modifications with a 500ms debounce
  useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }
    // Only record when history has been initialized
    if (historyState.index === -1) return;

    const timer = setTimeout(() => {
      setHistoryState(prev => {
        // Discard any forward history (redo path) if we are making a new edit
        const nextStack = prev.stack.slice(0, prev.index + 1);
        const lastCommit = nextStack[nextStack.length - 1];
        // Avoid duplicate commits if the current state is identical to the last commit
        if (lastCommit && JSON.stringify(lastCommit) === JSON.stringify(layers)) {
          return prev;
        }
        return {
          stack: [...nextStack, layers],
          index: nextStack.length
        };
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [layers]);

  const undo = () => {
    if (historyState.index > 0) {
      const newIndex = historyState.index - 1;
      const targetLayers = historyState.stack[newIndex];
      isNavigatingRef.current = true;
      setLayers(targetLayers);
      setHistoryState(prev => ({ ...prev, index: newIndex }));

      if (selectedLayerId && !targetLayers.some(l => l.id === selectedLayerId)) {
        setSelectedLayerId(null);
      }
    }
  };

  const redo = () => {
    if (historyState.index < historyState.stack.length - 1) {
      const newIndex = historyState.index + 1;
      const targetLayers = historyState.stack[newIndex];
      isNavigatingRef.current = true;
      setLayers(targetLayers);
      setHistoryState(prev => ({ ...prev, index: newIndex }));

      if (selectedLayerId && !targetLayers.some(l => l.id === selectedLayerId)) {
        setSelectedLayerId(null);
      }
    }
  };

  // Keyboard hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            // Redo: Cmd+Shift+Z
            const current = historyStateRef.current;
            if (current.index < current.stack.length - 1) {
              const newIndex = current.index + 1;
              const targetLayers = current.stack[newIndex];
              isNavigatingRef.current = true;
              setLayers(targetLayers);
              setHistoryState(prev => ({ ...prev, index: newIndex }));
              if (selectedLayerIdRef.current && !targetLayers.some(l => l.id === selectedLayerIdRef.current)) {
                setSelectedLayerId(null);
              }
            }
          } else {
            // Undo: Cmd+Z
            const current = historyStateRef.current;
            if (current.index > 0) {
              const newIndex = current.index - 1;
              const targetLayers = current.stack[newIndex];
              isNavigatingRef.current = true;
              setLayers(targetLayers);
              setHistoryState(prev => ({ ...prev, index: newIndex }));
              if (selectedLayerIdRef.current && !targetLayers.some(l => l.id === selectedLayerIdRef.current)) {
                setSelectedLayerId(null);
              }
            }
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          // Redo: Cmd+Y / Ctrl+Y
          const current = historyStateRef.current;
          if (current.index < current.stack.length - 1) {
            const newIndex = current.index + 1;
            const targetLayers = current.stack[newIndex];
            isNavigatingRef.current = true;
            setLayers(targetLayers);
            setHistoryState(prev => ({ ...prev, index: newIndex }));
            if (selectedLayerIdRef.current && !targetLayers.some(l => l.id === selectedLayerIdRef.current)) {
              setSelectedLayerId(null);
            }
          }
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

  if (loadingSession) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #1a1c29 0%, #08090f 100%)',
        color: '#ffffff',
        fontFamily: "'Outfit', sans-serif",
        fontSize: '16px',
        fontWeight: 'bold',
        gap: '12px'
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: 'var(--accent-cyan, #00f2fe)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <span>系统初始化中...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <>
      {/* Header bar */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>
          <div className="logo-section">
            <div className="logo-icon">
              {/* SVG wand icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 5.2l-1.4 1.4M7.6 15.4l-1.4 1.4M20.2 12.2l-1.4-1.4M6.2 6.2l1.4 1.4" />
              </svg>
            </div>
            <span className="logo-text">KeyVideo <span className="logo-subtext">服装视频智剪</span></span>
          </div>

          {/* Project Selector Block */}
          <div className="header-project-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: '8px', marginLeft: '12px', flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>
            {isEditingProjName ? (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 1, minWidth: 0 }}>
                <input
                  type="text"
                  value={editingProjNameValue}
                  onChange={(e) => setEditingProjNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sidebarRef.current?.saveProjectName();
                    if (e.key === 'Escape') setIsEditingProjName(false);
                  }}
                  autoFocus
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--accent-purple)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '12px',
                    padding: '2px 8px',
                    outline: 'none',
                    height: '24px',
                    width: '120px',
                    flexShrink: 1,
                    minWidth: 0
                  }}
                />
                <button onClick={() => sidebarRef.current?.saveProjectName()} style={{ background: 'transparent', border: 'none', color: '#4caf50', cursor: 'pointer', padding: '0 4px', fontSize: '12px', flexShrink: 0 }} title="保存">💾</button>
                <button onClick={() => setIsEditingProjName(false)} style={{ background: 'transparent', border: 'none', color: '#ff5252', cursor: 'pointer', padding: '0 4px', fontSize: '12px', flexShrink: 0 }} title="取消">❌</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>📁</span>
                <select
                  value={activeProjectId}
                  onChange={(e) => sidebarRef.current?.switchProject(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '600',
                    outline: 'none',
                    cursor: 'pointer',
                    paddingRight: '12px',
                    maxWidth: '120px',
                    flexShrink: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {projects.map(p => {
                    let statusText = '';
                    if (p.isI2vGenerating) statusText = ' (生视频中)';
                    else if (p.isOutfitImgGenerating) statusText = ' (生穿搭中)';
                    else if (p.i2vStep === 'video_generated') statusText = ' (已生视频)';
                    return (
                      <option key={p.id} value={p.id} style={{ background: '#14151f', color: '#fff' }}>
                        {p.name}{statusText}
                      </option>
                    );
                  })}
                </select>
                
                {/* Action buttons */}
                <button onClick={() => sidebarRef.current?.createNewProject()} style={{ background: 'none', border: 'none', color: 'var(--accent-purple)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', padding: '0 4px', flexShrink: 0 }} title="新建项目">➕</button>
                <button onClick={() => sidebarRef.current?.startRenameProject()} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', padding: '0 4px', flexShrink: 0 }} title="重命名项目">✏️</button>
                {projects.length > 1 && (
                  <button onClick={() => sidebarRef.current?.deleteProject(activeProjectId)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', padding: '0 4px', flexShrink: 0 }} title="删除项目">🗑️</button>
                )}
                <button onClick={() => setIsProjectsModalOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', padding: '0 4px', flexShrink: 0 }} title="项目管理大屏看板">📊</button>
              </div>
            )}
          </div>
        </div>

        {/* Ratio dimensions selectors */}
        <div className="ratio-selector">
          <button
            className={`ratio-btn ${ratio === '1-1' ? 'active' : ''}`}
            onClick={() => setRatio('1-1')}
          >
            {/* SVG 1:1 box */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="10" height="10" stroke="currentColor" fill="none" strokeWidth="1.5" />
            </svg>
            1:1
          </button>
          <button
            className={`ratio-btn ${ratio === '3-4' ? 'active' : ''}`}
            onClick={() => setRatio('3-4')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2.5" y="1" width="9" height="12" stroke="currentColor" fill="none" strokeWidth="1.5" />
            </svg>
            3:4
          </button>
          <button
            className={`ratio-btn ${ratio === '9-16' ? 'active' : ''}`}
            onClick={() => setRatio('9-16')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="3" y="0" width="8" height="14" stroke="currentColor" fill="none" strokeWidth="1.5" />
            </svg>
            9:16
          </button>
        </div>

        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={undo}
            disabled={historyState.index <= 0}
            title="撤销 (Cmd+Z / Ctrl+Z)"
            style={{ 
              opacity: historyState.index <= 0 ? 0.4 : 1, 
              cursor: historyState.index <= 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 12px'
            }}
          >
            ↩️ <span className="action-btn-text">撤销</span>
          </button>
          <button
            className="btn-secondary"
            onClick={redo}
            disabled={historyState.index >= historyState.stack.length - 1}
            title="重做 (Cmd+Shift+Z / Ctrl+Y)"
            style={{ 
              opacity: historyState.index >= historyState.stack.length - 1 ? 0.4 : 1, 
              cursor: historyState.index >= historyState.stack.length - 1 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 12px'
            }}
          >
            ↪️ <span className="action-btn-text">重做</span>
          </button>
          <div style={{ width: '1px', height: '16px', background: 'var(--border-color)', margin: '0 8px' }} />
          <button
            className="btn-secondary"
            onClick={() => {
              // Add a default slogan
              const id = `text_${Date.now()}`;
              setLayers([...layers, {
                id,
                type: 'text',
                name: '新段落字幕',
                start: 3,
                end: 9,
                visible: true,
                x: 50,
                y: 60,
                scale: 1,
                opacity: 1,
                properties: { text: '双击修改卖点文字', fontSize: 28, color: '#ffffff', animation: 'fade' }
              }]);
              setSelectedLayerId(id);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="action-btn-text">添加图层</span>
          </button>
          <button
            className="btn-primary"
            onClick={triggerExport}
          >
            {/* Download icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span className="action-btn-text">一键导出 MP4</span>
          </button>

          {session?.user && (
            <>
              <div style={{ width: '1px', height: '16px', background: 'var(--border-color)', margin: '0 8px', flexShrink: 0 }} />
              
              {/* Profile Avatar Clickable Container */}
              <div ref={userDropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-cyan, #00f2fe), var(--accent-purple, #8a2be2))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#090a0f',
                    boxShadow: '0 2px 8px rgba(0, 242, 254, 0.15)',
                    flexShrink: 0,
                    cursor: 'pointer',
                    userSelect: 'none',
                    border: '1.5px solid rgba(255,255,255,0.15)',
                    transition: 'transform 0.15s, border-color 0.15s'
                  }}
                  title={session.user.email}
                  onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.4)'; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                >
                  {session.user.email?.[0].toUpperCase()}
                </div>

                {/* Dropdown Menu */}
                {isUserDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '8px',
                      background: '#14151f',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '8px 0',
                      minWidth: '160px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                      zIndex: 1000,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    {/* User Info Header */}
                    <div style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#9ca3af' }}>当前登录</span>
                      <span style={{ fontSize: '11px', color: '#d1d5db', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={session.user.email}>
                        {session.user.email}
                      </span>
                    </div>

                    {/* Action: Sign Out */}
                    <button
                      onClick={async () => {
                        setIsUserDropdownOpen(false);
                        if (confirm('确定要退出登录吗？')) {
                          await supabase.auth.signOut();
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-red, #ff5252)',
                        padding: '8px 12px',
                        fontSize: '12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        width: '100%',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,82,82,0.08)'; }}
                      onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      🚪 <span>退出登录</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Editor Body Workspace */}
      <div className="editor-container">
        {/* Left side tabs nav */}
        <nav className="editor-sidebar">
          <button
            className={`nav-tab ${activeTab === 'template' ? 'active' : ''}`}
            onClick={() => setActiveTab('template')}
          >
            <span style={{ fontSize: '18px' }}>📋</span>
            <span>模板</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveTab('media')}
          >
            <span style={{ fontSize: '18px' }}>🖼️</span>
            <span>素材</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            <span style={{ fontSize: '18px' }}>✍️</span>
            <span>文本</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'sticker' ? 'active' : ''}`}
            onClick={() => setActiveTab('sticker')}
          >
            <span style={{ fontSize: '18px' }}>🏷️</span>
            <span>贴纸</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <span style={{ fontSize: '18px' }}>🤖</span>
            <span>AI 工具</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'audio' ? 'active' : ''}`}
            onClick={() => setActiveTab('audio')}
          >
            <span style={{ fontSize: '18px' }}>🎵</span>
            <span>音乐</span>
          </button>
        </nav>

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
        />

        {/* Right side settings column */}
        <PropertyInspector
          layers={layers}
          setLayers={setLayers}
          selectedLayerId={selectedLayerId}
          setSelectedLayerId={setSelectedLayerId}
        />
      </div>

      {/* Bottom timeline track scrubbers */}
      <Timeline
        layers={layers}
        setLayers={setLayers}
        currentTime={currentTime}
        setCurrentTime={setCurrentTime}
        selectedLayerId={selectedLayerId}
        setSelectedLayerId={setSelectedLayerId}
      />
    </>
  );
}

export default App;
