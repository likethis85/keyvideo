import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CanvasNodeData, CanvasNodeType, Position } from '../../types/canvas';
import type { AIProject } from '../../types/aiProject';
import type { Layer } from '../VideoCanvas';
import { useCanvasStore } from '../../hooks/useCanvasStore';
import { CanvasConnections } from './CanvasConnections';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasMinimap } from './CanvasMinimap';
import { ClothingNode } from './nodes/ClothingNode';
import { PromptNode } from './nodes/PromptNode';
import { ImageNode } from './nodes/ImageNode';
import { VideoNode } from './nodes/VideoNode';
import { WorkflowConfigNode } from './nodes/WorkflowConfigNode';
import { CanvasNodeMaskEditModal } from './dialogs/CanvasNodeMaskEditModal';
import { CanvasNodeCropModal } from './dialogs/CanvasNodeCropModal';
import { CanvasNodeUpscaleModal } from './dialogs/CanvasNodeUpscaleModal';
import { CanvasSpawnNodeMenu } from './dialogs/CanvasSpawnNodeMenu';
import { convertAiProjectToCanvas, injectCanvasAssetToTimeline } from '../../utils/canvasBridge';
import { executeCustomApi, getCustomApiConfig } from '../../utils/customApiRunner';
import { toast } from '../toastStore';
import './canvas.css';

interface InfiniteCanvasProps {
  projectId: string;
  activeProject?: AIProject;
  currentTime: number;
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  commitHistory: (layers: Layer[], desc: string) => void;
  onRegisterAutoLayout?: (fn: () => void) => void;
}

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  projectId,
  activeProject,
  currentTime,
  layers,
  setLayers,
  commitHistory,
  onRegisterAutoLayout
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    nodes,
    connections,
    selectedNodeIds,
    viewport,
    canUndo,
    canRedo,
    setSelectedNodeIds,
    setViewport,
    addNode,
    updateNode,
    updateNodePosition,
    commitPositionMove,
    deleteSelectedNodes,
    addConnection,
    removeConnection,
    undo,
    redo,
    loadTopology,
    autoLayout
  } = useCanvasStore(projectId);

  // Pan & Drag States
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; viewX: number; viewY: number }>({ x: 0, y: 0, viewX: 0, viewY: 0 });
  const isSpacePressedRef = useRef(false);

  // Node Dragging State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const nodeDragStartRef = useRef<{ mouseX: number; mouseY: number }>({ mouseX: 0, mouseY: 0 });

  // Port Connecting State
  const [connectingState, setConnectingState] = useState<{
    fromNodeId: string;
    fromHandle?: string;
    currentMousePos: Position;
  } | null>(null);

  // Marquee Selection Box
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [showMinimap, setShowMinimap] = useState(true);

  // Wire Release Contextual Spawn Menu State
  const [spawnMenuState, setSpawnMenuState] = useState<{
    sourceNode: CanvasNodeData;
    fromHandle: string;
    worldPos: Position;
    screenPos: { x: number; y: number };
  } | null>(null);
  const lastMousePosRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });

  // Route A: Image Modification Modal States
  const [maskModalNode, setMaskModalNode] = useState<CanvasNodeData | null>(null);
  const [cropModalNode, setCropModalNode] = useState<CanvasNodeData | null>(null);
  const [upscaleModalNode, setUpscaleModalNode] = useState<CanvasNodeData | null>(null);

  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateDims = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth || window.innerWidth,
          height: containerRef.current.clientHeight || window.innerHeight
        });
      }
    };
    updateDims();
    const ro = new ResizeObserver(updateDims);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Transform Screen Point to World Coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number): Position => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - viewport.x) / viewport.scale,
      y: (screenY - rect.top - viewport.y) / viewport.scale
    };
  }, [viewport]);

  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // Zoom at specific screen point (centers zoom around mouse)
  const zoomAtPoint = useCallback((deltaY: number, screenX: number, screenY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = screenX - rect.left;
    const mouseY = screenY - rect.top;

    const currentViewport = viewportRef.current;
    // deltaY < 0 means scrolling up (zoom in), deltaY > 0 means scrolling down (zoom out)
    const zoomFactor = deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.min(Math.max(Number((currentViewport.scale * zoomFactor).toFixed(3)), 0.15), 4);

    // Calculate new viewport offset so point under mouse stays pinned
    const worldX = (mouseX - currentViewport.x) / currentViewport.scale;
    const worldY = (mouseY - currentViewport.y) / currentViewport.scale;

    setViewport({
      scale: newScale,
      x: Math.round(mouseX - worldX * newScale),
      y: Math.round(mouseY - worldY * newScale)
    });
  }, [setViewport]);

  // Native non-passive Wheel Event listener to handle Ctrl + Wheel Zoom & Pan reliably
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // 1. Holding Ctrl (or Cmd on macOS) while scrolling: ZOOM in / out centered at cursor
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // Stop native browser window-level zoom!
        e.stopPropagation();
        zoomAtPoint(e.deltaY, e.clientX, e.clientY);
        return;
      }

      // 2. Normal wheel: PAN canvas (unless scrolling inside input / modal)
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.closest('.canvas-modal-overlay'))) {
        return;
      }

      e.preventDefault();
      setViewport(prev => ({
        ...prev,
        x: Math.round(prev.x - e.deltaX),
        y: Math.round(prev.y - e.deltaY)
      }));
    };

    const handleNativeMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    const handleNativeAuxClick = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    container.addEventListener('mousedown', handleNativeMouseDown);
    container.addEventListener('auxclick', handleNativeAuxClick);
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
      container.removeEventListener('mousedown', handleNativeMouseDown);
      container.removeEventListener('auxclick', handleNativeAuxClick);
    };
  }, [zoomAtPoint, setViewport]);

  // Global window listeners while panning so drag never stutters or gets lost
  useEffect(() => {
    if (!isPanning) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewport(prev => ({
        ...prev,
        x: Math.round(panStartRef.current.viewX + dx),
        y: Math.round(panStartRef.current.viewY + dy)
      }));
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (e.button === 1 || e.button === 0) {
        setIsPanning(false);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, setViewport]);

  // Mouse Down handler for Canvas background & Middle click panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // 1. Middle mouse button (button 1), Space+LeftClick, or Alt+LeftClick -> PAN anywhere
    if (e.button === 1 || isSpacePressedRef.current || (e.altKey && e.button === 0)) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        viewX: viewportRef.current.x,
        viewY: viewportRef.current.y
      };
      return;
    }

    // 2. Left click (button 0) on empty space: clear selection and start marquee select
    if (e.button === 0) {
      if (spawnMenuState) setSpawnMenuState(null);
      if (e.target !== containerRef.current && !(e.target as HTMLElement).classList.contains('canvas-grid-bg')) {
        return;
      }
      setSelectedNodeIds([]);
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setSelectionBox({
        startX: worldPos.x,
        startY: worldPos.y,
        currentX: worldPos.x,
        currentY: worldPos.y
      });
    }
  };

  // Global Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    lastMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };

    // 1. Panning canvas (handled by global listener, fallback for inline)
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewport(prev => ({
        ...prev,
        x: Math.round(panStartRef.current.viewX + dx),
        y: Math.round(panStartRef.current.viewY + dy)
      }));
      return;
    }

    // 2. Dragging node(s)
    if (draggingNodeId) {
      const deltaX = (e.clientX - nodeDragStartRef.current.mouseX) / viewport.scale;
      const deltaY = (e.clientY - nodeDragStartRef.current.mouseY) / viewport.scale;
      updateNodePosition(draggingNodeId, { dx: deltaX, dy: deltaY });
      nodeDragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY };
      return;
    }

    // 3. Drawing connection wire
    if (connectingState) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setConnectingState(prev => prev ? { ...prev, currentMousePos: worldPos } : null);
      return;
    }

    // 4. Marquee selection
    if (selectionBox) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setSelectionBox(prev => prev ? { ...prev, currentX: worldPos.x, currentY: worldPos.y } : null);

      // Check which nodes intersect with selection box
      const boxLeft = Math.min(selectionBox.startX, worldPos.x);
      const boxRight = Math.max(selectionBox.startX, worldPos.x);
      const boxTop = Math.min(selectionBox.startY, worldPos.y);
      const boxBottom = Math.max(selectionBox.startY, worldPos.y);

      const enclosedIds = nodes.filter(n => {
        const nRight = n.position.x + n.width;
        const nBottom = n.position.y + n.height;
        return (
          n.position.x < boxRight &&
          nRight > boxLeft &&
          n.position.y < boxBottom &&
          nBottom > boxTop
        );
      }).map(n => n.id);

      setSelectedNodeIds(enclosedIds);
    }
  };

  // Global Mouse Up
  const handleMouseUp = (e?: React.MouseEvent) => {
    if (isPanning) setIsPanning(false);
    if (draggingNodeId) {
      setDraggingNodeId(null);
      commitPositionMove();
    }
    if (connectingState) {
      // If pulled out from output port ('out') into open space
      if (connectingState.fromHandle === 'out') {
        const fromNode = nodes.find(n => n.id === connectingState.fromNodeId);
        if (fromNode) {
          const handleX = fromNode.position.x + fromNode.width;
          const handleY = fromNode.position.y + fromNode.height / 2;
          const dist = Math.hypot(
            connectingState.currentMousePos.x - handleX,
            connectingState.currentMousePos.y - handleY
          );

          if (dist > 35) {
            const containerRect = containerRef.current?.getBoundingClientRect();
            const clientX = e?.clientX ?? lastMousePosRef.current.clientX;
            const clientY = e?.clientY ?? lastMousePosRef.current.clientY;

            setSpawnMenuState({
              sourceNode: fromNode,
              fromHandle: connectingState.fromHandle || 'out',
              worldPos: { ...connectingState.currentMousePos },
              screenPos: {
                x: clientX - (containerRect?.left || 0),
                y: clientY - (containerRect?.top || 0)
              }
            });
          }
        }
      }
      setConnectingState(null);
    }
    if (selectionBox) setSelectionBox(null);
  };

  // Start dragging a node
  const handleNodeDragStart = (e: React.MouseEvent, nodeId: string) => {
    // Middle click on a node pans canvas rather than dragging the node
    if (e.button === 1 || isSpacePressedRef.current || e.altKey) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        viewX: viewportRef.current.x,
        viewY: viewportRef.current.y
      };
      return;
    }

    if (e.button !== 0) return; // Only left click drags a node

    if ((e.target as HTMLElement).closest('.node-handle') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('textarea') || (e.target as HTMLElement).closest('select') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    setDraggingNodeId(nodeId);
    nodeDragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY };
    if (!selectedNodeIds.includes(nodeId)) {
      if (e.shiftKey) {
        setSelectedNodeIds(prev => [...prev, nodeId]);
      } else {
        setSelectedNodeIds([nodeId]);
      }
    }
  };

  // Start dragging connection wire
  const handleStartConnect = (fromNodeId: string, fromHandle: string) => {
    const fromNode = nodes.find(n => n.id === fromNodeId);
    if (!fromNode) return;
    const initialPos = {
      x: fromNode.position.x + fromNode.width,
      y: fromNode.position.y + fromNode.height / 2
    };
    setConnectingState({
      fromNodeId,
      fromHandle,
      currentMousePos: initialPos
    });
  };

  // Complete connection on a target node
  const handleEndConnect = (toNodeId: string, toHandle: string) => {
    if (!connectingState) return;
    if (connectingState.fromNodeId === toNodeId) {
      setConnectingState(null);
      return;
    }
    addConnection(connectingState.fromNodeId, toNodeId, connectingState.fromHandle, toHandle);
    setConnectingState(null);
    toast.success('已建立节点连接！');
  };

  // Inject canvas node asset into timeline
  const handleAddToTimeline = (node: CanvasNodeData) => {
    try {
      const newLayer = injectCanvasAssetToTimeline({
        node,
        currentTime,
        layers,
        setLayers,
        commitHistory
      });
      toast.success(`已将「${newLayer.name}」导入剪辑时间轴！`);
    } catch (err) {
      toast.error(`导入时间轴失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Execute Workflow for a WorkflowConfigNode
  const handleExecuteWorkflow = async (workflowNode: CanvasNodeData) => {
    updateNode(workflowNode.id, { status: 'loading' });
    toast.info('正在读取上游原料，执行 AI 试衣与分镜生成流程...');

    // Find upstream nodes connected to this workflow
    const incomingConns = connections.filter(c => c.toNodeId === workflowNode.id);
    const upstreamNodes = nodes.filter(n => incomingConns.some(c => c.fromNodeId === n.id));

    const promptNode = upstreamNodes.find(n => n.type === 'prompt');
    const clothingNode = upstreamNodes.find(n => n.type === 'clothing');
    const promptText = promptNode?.metadata.text || workflowNode.metadata.modelScene || '高端电商服装大片，8k画质';
    const clothUrl = clothingNode?.metadata.imageSrc || '';

    const customConfig = getCustomApiConfig();

    // If Custom API is enabled, trigger real HTTP execution
    if (customConfig.enabled && customConfig.endpointUrl.trim()) {
      try {
        const generatedUrl = await executeCustomApi({
          prompt: promptText,
          imageUrl: clothUrl,
          gender: workflowNode.metadata.modelGender || 'female',
          region: workflowNode.metadata.modelRegion || 'east-asian',
          scene: workflowNode.metadata.modelScene,
          ratio: '9-16'
        });

        updateNode(workflowNode.id, { status: 'success' });
        const outgoingConns = connections.filter(c => c.fromNodeId === workflowNode.id);
        outgoingConns.forEach(c => {
          updateNode(c.toNodeId, {
            status: 'success',
            metadata: {
              ...nodes.find(n => n.id === c.toNodeId)?.metadata,
              imageSrc: generatedUrl
            }
          });
        });
        toast.success('自定义 AI 接口调用成功，下游成图已更新！');
        return;
      } catch (err) {
        console.warn('Custom API call failed, falling back to demonstration mode:', err);
        toast.info(`自定义接口提示: ${err instanceof Error ? err.message : String(err)}。为您以演示模式更新下游`);
      }
    }

    // Default fast demonstration mode
    setTimeout(() => {
      updateNode(workflowNode.id, { status: 'success' });
      const outgoingConns = connections.filter(c => c.fromNodeId === workflowNode.id);
      outgoingConns.forEach(c => {
        updateNode(c.toNodeId, {
          status: 'success',
          metadata: {
            ...nodes.find(n => n.id === c.toNodeId)?.metadata,
            imageSrc: clothUrl || upstreamNodes.find(u => u.metadata.imageSrc)?.metadata.imageSrc
          }
        });
      });
      toast.success('AI 工作流处理完成，下游节点已更新！');
    }, 1200);
  };

  // Import from Active AIProject
  const handleImportFromAiProject = () => {
    if (!activeProject) {
      toast.info('当前未选中任何 AI 试衣工程');
      return;
    }
    const { nodes: newNodes, connections: newConns } = convertAiProjectToCanvas(activeProject);
    loadTopology(newNodes, newConns);
    setViewport({ x: 60, y: 40, scale: 0.85 });
    toast.success(`已将工程「${activeProject.name}」的试衣与分镜全量导入画布！`);
  };

  // Smart Auto-Layout execution
  const handleAutoLayout = useCallback(() => {
    autoLayout();
    toast.success('✨ 已自动整理排布画布节点，彻底消除重叠！');
  }, [autoLayout]);

  useEffect(() => {
    if (onRegisterAutoLayout) {
      onRegisterAutoLayout(handleAutoLayout);
    }
  }, [onRegisterAutoLayout, handleAutoLayout]);

  // Route A: Create child derived image node and connect to parent (with collision avoidance)
  const handleCreateDerivedNode = (
    sourceNode: CanvasNodeData,
    newImageSrc: string,
    titleSuffix: string,
    extraMeta: Record<string, unknown> = {}
  ) => {
    const targetX = sourceNode.position.x + 360;
    let targetY = sourceNode.position.y;
    // Check if another node already occupies (targetX, targetY)
    while (nodes.some(n => Math.abs(n.position.x - targetX) < 260 && Math.abs(n.position.y - targetY) < 380)) {
      targetY += 460;
    }

    const newNode = addNode(
      'image',
      { x: targetX, y: targetY },
      {
        title: `${sourceNode.title} (${titleSuffix})`,
        metadata: {
          ...sourceNode.metadata,
          imageSrc: newImageSrc,
          ...extraMeta
        }
      }
    );
    if (newNode) {
      addConnection(sourceNode.id, newNode.id);
    }
    return newNode;
  };

  // Spawn next connected node chosen from wire release context menu
  const handleSpawnNextNode = (type: CanvasNodeType, defaultTitle?: string) => {
    if (!spawnMenuState) return;
    const fromNode = spawnMenuState.sourceNode;

    let nodeHeight = 300;
    if (type === 'video') nodeHeight = 340;
    else if (type === 'image') nodeHeight = 340;
    else if (type === 'prompt') nodeHeight = 210;
    else if (type === 'clothing') nodeHeight = 300;
    else if (type === 'workflow') nodeHeight = 280;

    const posX = Math.round(spawnMenuState.worldPos.x + 20);
    const posY = Math.round(spawnMenuState.worldPos.y - nodeHeight / 2);

    const initialMeta: Record<string, unknown> = {};
    if (fromNode.type === 'clothing' && type === 'image') {
      initialMeta.clothingType = fromNode.metadata.clothingType;
    } else if (fromNode.type === 'image' && type === 'video') {
      initialMeta.imageSrc = fromNode.metadata.imageSrc;
      initialMeta.shotType = fromNode.metadata.shotType;
    } else if (fromNode.type === 'prompt' && (type === 'image' || type === 'video')) {
      initialMeta.text = fromNode.metadata.text;
    }

    const newNode = addNode(
      type,
      { x: posX, y: posY },
      {
        title: defaultTitle || `${fromNode.title} ➔ 衍生`,
        metadata: initialMeta
      }
    );

    if (newNode) {
      addConnection(fromNode.id, newNode.id, spawnMenuState.fromHandle, 'in');
      toast.success(`✨ 已创建「${newNode.title}」并建立连线！`);
    }

    setSpawnMenuState(null);
  };

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when focused in an input/textarea
      if (e.code === 'Space') {
        isSpacePressedRef.current = true;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0) {
          e.preventDefault();
          deleteSelectedNodes();
          toast.info('已删除所选节点');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          zoomAtPoint(-100, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          zoomAtPoint(100, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setViewport({ x: 120, y: 80, scale: 1 });
      } else if (e.key === 'Escape') {
        setSelectedNodeIds([]);
        setConnectingState(null);
        setSpawnMenuState(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNodeIds, deleteSelectedNodes, undo, redo, setSelectedNodeIds, setViewport, zoomAtPoint]);

  return (
    <div
      ref={containerRef}
      className={`infinite-canvas-viewport ${isPanning ? 'is-panning' : ''}`}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Background Grid Pattern */}
      <div
        className="canvas-grid-bg"
        style={{
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          backgroundSize: `${30 * viewport.scale}px ${30 * viewport.scale}px`
        }}
      />

      {/* World Transform Layer */}
      <div
        className="canvas-world-layer"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0'
        }}
      >
        {/* SVG Connections Layer */}
        <CanvasConnections
          connections={connections}
          nodes={nodes}
          connectingState={
            connectingState ||
            (spawnMenuState
              ? {
                  fromNodeId: spawnMenuState.sourceNode.id,
                  fromHandle: spawnMenuState.fromHandle,
                  currentMousePos: spawnMenuState.worldPos
                }
              : null)
          }
          onRemoveConnection={removeConnection}
        />

        {/* Empty Canvas Guide */}
        {nodes.length === 0 && (
          <div
            className="canvas-empty-guide"
            style={{
              position: 'absolute',
              left: 400,
              top: 260,
              pointerEvents: 'auto'
            }}
          >
            <div className="empty-guide-icon">🎨</div>
            <h3>AI 无限创作画布</h3>
            <p>自由排布服装、模特、提示词与视频节点，通过连线组合多模态生成管线</p>
            <div className="empty-guide-actions">
              {activeProject && (
                <button
                  className="empty-action-btn primary"
                  onClick={handleImportFromAiProject}
                >
                  📥 一键载入当前「{activeProject.name}」工程节点
                </button>
              )}
              <button
                className="empty-action-btn secondary"
                onClick={() => {
                  const cloth = addNode('clothing', { x: 200, y: 160 }, { title: '上装参考' });
                  const prompt = addNode('prompt', { x: 200, y: 560 }, { title: '电商场景提示词' });
                  const tryon = addNode('image', { x: 560, y: 280 }, { title: 'AI试衣模特' });
                  if (cloth && tryon) addConnection(cloth.id, tryon.id);
                  if (prompt && tryon) addConnection(prompt.id, tryon.id);
                  toast.success('已生成试衣示例流程！');
                }}
              >
                ✨ 快速创建试衣模版流程
              </button>
            </div>
          </div>
        )}

        {/* Nodes Layer */}
        {nodes.map(node => {
          const isSelected = selectedNodeIds.includes(node.id);
          const nodeCommonProps = {
            key: node.id,
            node,
            isSelected,
            onSelect: (e: React.MouseEvent) => {
              e.stopPropagation();
              if (e.shiftKey) {
                setSelectedNodeIds(prev => prev.includes(node.id) ? prev.filter(id => id !== node.id) : [...prev, node.id]);
              } else {
                setSelectedNodeIds([node.id]);
              }
            },
            onDelete: () => {
              setSelectedNodeIds([node.id]);
              deleteSelectedNodes();
            },
            onUpdate: (patch: Partial<CanvasNodeData>) => updateNode(node.id, patch),
            onStartConnect: (fromHandle: string) => handleStartConnect(node.id, fromHandle),
            onEndConnect: (toHandle: string) => handleEndConnect(node.id, toHandle),
            onAddToTimeline: handleAddToTimeline
          };

          return (
            <div
              key={node.id}
              className="canvas-node-wrapper"
              onMouseDown={(e) => handleNodeDragStart(e, node.id)}
            >
              {node.type === 'clothing' && <ClothingNode {...nodeCommonProps} />}
              {node.type === 'prompt' && <PromptNode {...nodeCommonProps} />}
              {node.type === 'image' && (
                <ImageNode
                  {...nodeCommonProps}
                  onOpenMaskEdit={(n) => setMaskModalNode(n)}
                  onOpenCrop={(n) => setCropModalNode(n)}
                  onOpenUpscale={(n) => setUpscaleModalNode(n)}
                />
              )}
              {node.type === 'video' && <VideoNode {...nodeCommonProps} />}
              {node.type === 'workflow' && (
                <WorkflowConfigNode
                  {...nodeCommonProps}
                  onExecuteWorkflow={handleExecuteWorkflow}
                />
              )}
            </div>
          );
        })}

        {/* Marquee Selection Rectangle */}
        {selectionBox && (
          <div
            className="canvas-marquee-box"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.currentX),
              top: Math.min(selectionBox.startY, selectionBox.currentY),
              width: Math.abs(selectionBox.currentX - selectionBox.startX),
              height: Math.abs(selectionBox.currentY - selectionBox.startY)
            }}
          />
        )}
      </div>

      {/* Floating Toolbar */}
      <CanvasToolbar
        scale={viewport.scale}
        canUndo={canUndo}
        canRedo={canRedo}
        selectedCount={selectedNodeIds.length}
        showMinimap={showMinimap}
        onAddNode={(type: CanvasNodeType) => {
          const newNode = addNode(type);
          if (newNode) {
            toast.success(`已在画布中添加「${newNode.title}」节点`);
          }
        }}
        onImportFromAiProject={activeProject ? handleImportFromAiProject : undefined}
        onAutoLayout={handleAutoLayout}
        onZoomIn={() => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          zoomAtPoint(-100, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }}
        onZoomOut={() => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          zoomAtPoint(100, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }}
        onResetView={() => setViewport({ x: 120, y: 80, scale: 1 })}
        onUndo={undo}
        onRedo={redo}
        onDeleteSelected={deleteSelectedNodes}
        onToggleMinimap={() => setShowMinimap(!showMinimap)}
      />

      {/* Interactive Minimap */}
      {showMinimap && (
        <CanvasMinimap
          nodes={nodes}
          viewport={viewport}
          containerWidth={containerDimensions.width}
          containerHeight={containerDimensions.height}
          onPanTo={(worldX, worldY) => {
            setViewport(prev => ({
              ...prev,
              x: containerDimensions.width / 2 - worldX * prev.scale,
              y: containerDimensions.height / 2 - worldY * prev.scale
            }));
          }}
        />
      )}

      {/* Route A: Image Modification Modals */}
      <CanvasNodeMaskEditModal
        isOpen={!!maskModalNode}
        node={maskModalNode}
        onClose={() => setMaskModalNode(null)}
        onApply={(newImageSrc, createDerived, prompt) => {
          if (!maskModalNode) return;
          if (createDerived) {
            handleCreateDerivedNode(maskModalNode, newImageSrc, '局部重绘', { inpaintPrompt: prompt });
          } else {
            updateNode(maskModalNode.id, {
              metadata: { ...maskModalNode.metadata, imageSrc: newImageSrc, inpaintPrompt: prompt }
            });
          }
        }}
      />

      <CanvasNodeCropModal
        isOpen={!!cropModalNode}
        node={cropModalNode}
        onClose={() => setCropModalNode(null)}
        onApply={(newImageSrc, createDerived, ratio) => {
          if (!cropModalNode) return;
          if (createDerived) {
            handleCreateDerivedNode(cropModalNode, newImageSrc, `裁切 ${ratio}`, { aspectRatio: ratio });
          } else {
            updateNode(cropModalNode.id, {
              metadata: { ...cropModalNode.metadata, imageSrc: newImageSrc, aspectRatio: ratio }
            });
          }
        }}
      />

      <CanvasNodeUpscaleModal
        isOpen={!!upscaleModalNode}
        node={upscaleModalNode}
        onClose={() => setUpscaleModalNode(null)}
        onApply={(newImageSrc, createDerived, factor) => {
          if (!upscaleModalNode) return;
          if (createDerived) {
            handleCreateDerivedNode(upscaleModalNode, newImageSrc, `超清 ${factor}`, { upscale: factor });
          } else {
            updateNode(upscaleModalNode.id, {
              metadata: { ...upscaleModalNode.metadata, imageSrc: newImageSrc, upscale: factor }
            });
          }
        }}
      />

      {/* Contextual Next Node Spawn Menu from wire release */}
      {spawnMenuState && (
        <CanvasSpawnNodeMenu
          sourceNode={spawnMenuState.sourceNode}
          screenPos={spawnMenuState.screenPos}
          containerDimensions={containerDimensions}
          onSelect={handleSpawnNextNode}
          onClose={() => setSpawnMenuState(null)}
        />
      )}
    </div>
  );
};
