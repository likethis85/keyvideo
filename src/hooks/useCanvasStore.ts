import { useState, useCallback, useEffect, useRef } from 'react';
import type { CanvasNodeData, CanvasConnection, CanvasViewport, CanvasNodeType } from '../types/canvas';
import { localDB } from '../utils/db';
import { resolveNodeOverlaps, autoLayoutCanvasNodes } from '../utils/canvasLayout';

interface CanvasHistorySnapshot {
  nodes: CanvasNodeData[];
  connections: CanvasConnection[];
}

export function useCanvasStore(projectId: string) {
  const [nodes, setNodes] = useState<CanvasNodeData[]>([]);
  const [connections, setConnections] = useState<CanvasConnection[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [viewport, setViewport] = useState<CanvasViewport>({ x: 40, y: 30, scale: 0.8 });
  const [isLoaded, setIsLoaded] = useState(false);

  // History stack for canvas Undo / Redo
  const [history, setHistory] = useState<CanvasHistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isNavigatingHistory = useRef(false);

  const storageKey = `KEYVIDEO_CANVAS_DATA_${projectId || 'default'}`;

  // Record history snapshot
  const pushHistory = useCallback((newNodes: CanvasNodeData[], newConnections: CanvasConnection[]) => {
    if (isNavigatingHistory.current) return;
    setHistory(prev => {
      const nextStack = prev.slice(0, historyIndex + 1);
      return [...nextStack, { nodes: JSON.parse(JSON.stringify(newNodes)), connections: JSON.parse(JSON.stringify(newConnections)) }].slice(-30);
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Load from database on mount / projectId change
  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoaded(false);
      try {
        const saved = await localDB.get<{
          nodes: CanvasNodeData[];
          connections: CanvasConnection[];
          viewport: CanvasViewport;
        }>(storageKey);

        if (active && saved) {
          const rawNodes = saved.nodes || [];
          const cleanNodes = resolveNodeOverlaps(rawNodes, 48);
          setNodes(cleanNodes);
          setConnections(saved.connections || []);
          if (saved.viewport) setViewport(saved.viewport);
          setHistory([{ nodes: cleanNodes, connections: saved.connections || [] }]);
          setHistoryIndex(0);
        } else if (active) {
          // Initialize empty defaults
          setNodes([]);
          setConnections([]);
          setViewport({ x: 120, y: 80, scale: 1 });
          setHistory([]);
          setHistoryIndex(-1);
        }
      } catch (err) {
        console.error('Failed to load canvas data from localDB:', err);
      } finally {
        if (active) setIsLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [storageKey]);

  // Auto-save debounced to localDB
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      localDB.set(storageKey, {
        nodes,
        connections,
        viewport
      }).catch((err: unknown) => console.error('Failed to auto-save canvas data:', err));
    }, 500);

    return () => clearTimeout(timer);
  }, [nodes, connections, viewport, storageKey, isLoaded]);

  // Node CRUD operations
  const addNode = useCallback((type: CanvasNodeType, position?: { x: number; y: number }, initialData?: Partial<CanvasNodeData>) => {
    const id = `node_${type}_${Date.now()}`;
    const defaultPos = position || {
      x: Math.round((window.innerWidth / 2 - viewport.x) / viewport.scale - 140),
      y: Math.round((window.innerHeight / 2 - viewport.y) / viewport.scale - 160)
    };

    const typeTitles: Record<CanvasNodeType, string> = {
      clothing: '服装参考',
      image: 'AI 试衣图',
      prompt: '营销提示词',
      video: '分镜视频',
      workflow: '工作流配置',
      group: '分组'
    };

    // 如果目标位置已有节点，自动偏移 40px 防止完全叠底
    const finalPos = { ...defaultPos };
    while (nodes.some(n => Math.abs(n.position.x - finalPos.x) < 32 && Math.abs(n.position.y - finalPos.y) < 32)) {
      finalPos.x += 40;
      finalPos.y += 40;
    }

    const newNode: CanvasNodeData = {
      id,
      type,
      title: initialData?.title || typeTitles[type] || '新节点',
      position: finalPos,
      width: type === 'prompt' ? 280 : 300,
      height: type === 'prompt' ? 210 : type === 'video' ? 340 : type === 'image' ? 340 : 300,
      status: 'idle',
      metadata: {
        ...(initialData?.metadata || {})
      },
      ...initialData
    };

    setNodes(prev => {
      const next = [...prev, newNode];
      pushHistory(next, connections);
      return next;
    });
    setSelectedNodeIds([id]);
    return newNode;
  }, [viewport, connections, pushHistory, nodes]);

  const updateNode = useCallback((id: string, patch: Partial<CanvasNodeData> | ((prev: CanvasNodeData) => CanvasNodeData)) => {
    setNodes(prev => {
      const next = prev.map(node => {
        if (node.id !== id) return node;
        if (typeof patch === 'function') return patch(node);
        return {
          ...node,
          ...patch,
          metadata: { ...node.metadata, ...(patch.metadata || {}) }
        };
      });
      pushHistory(next, connections);
      return next;
    });
  }, [connections, pushHistory]);

  const updateNodePosition = useCallback((id: string, delta: { dx: number; dy: number }) => {
    setNodes(prev => prev.map(node => {
      if (node.id === id || (selectedNodeIds.includes(node.id) && selectedNodeIds.includes(id))) {
        return {
          ...node,
          position: {
            x: Math.round(node.position.x + delta.dx),
            y: Math.round(node.position.y + delta.dy)
          }
        };
      }
      return node;
    }));
  }, [selectedNodeIds]);

  const commitPositionMove = useCallback(() => {
    setNodes(currNodes => {
      pushHistory(currNodes, connections);
      return currNodes;
    });
  }, [connections, pushHistory]);

  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    setNodes(prev => {
      const next = prev.filter(n => !selectedNodeIds.includes(n.id));
      setConnections(currConns => {
        const nextConns = currConns.filter(c => !selectedNodeIds.includes(c.fromNodeId) && !selectedNodeIds.includes(c.toNodeId));
        pushHistory(next, nextConns);
        return nextConns;
      });
      return next;
    });
    setSelectedNodeIds([]);
  }, [selectedNodeIds, pushHistory]);

  // Connection operations
  const addConnection = useCallback((fromNodeId: string, toNodeId: string, fromHandle?: string, toHandle?: string, label?: string) => {
    if (fromNodeId === toNodeId) return;
    // Prevent duplicates
    setConnections(prev => {
      const exists = prev.some(c => c.fromNodeId === fromNodeId && c.toNodeId === toNodeId);
      if (exists) return prev;
      const newConn: CanvasConnection = {
        id: `conn_${fromNodeId}_${toNodeId}_${Date.now()}`,
        fromNodeId,
        toNodeId,
        fromHandle,
        toHandle,
        label
      };
      const next = [...prev, newConn];
      pushHistory(nodes, next);
      return next;
    });
  }, [nodes, pushHistory]);

  const removeConnection = useCallback((connectionId: string) => {
    setConnections(prev => {
      const next = prev.filter(c => c.id !== connectionId);
      pushHistory(nodes, next);
      return next;
    });
  }, [nodes, pushHistory]);

  // Undo / Redo
  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    isNavigatingHistory.current = true;
    const targetSnapshot = history[historyIndex - 1];
    setNodes(targetSnapshot.nodes);
    setConnections(targetSnapshot.connections);
    setHistoryIndex(prev => prev - 1);
    setTimeout(() => { isNavigatingHistory.current = false; }, 50);
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    isNavigatingHistory.current = true;
    const targetSnapshot = history[historyIndex + 1];
    setNodes(targetSnapshot.nodes);
    setConnections(targetSnapshot.connections);
    setHistoryIndex(prev => prev + 1);
    setTimeout(() => { isNavigatingHistory.current = false; }, 50);
  }, [historyIndex, history]);

  // Batch load replacement (e.g. from convertAiProjectToCanvas)
  const loadTopology = useCallback((newNodes: CanvasNodeData[], newConnections: CanvasConnection[]) => {
    const cleanNodes = resolveNodeOverlaps(newNodes, 48);
    setNodes(cleanNodes);
    setConnections(newConnections);
    setSelectedNodeIds([]);
    pushHistory(cleanNodes, newConnections);
  }, [pushHistory]);

  // Topological / Non-overlapping Auto Layout
  const autoLayout = useCallback(() => {
    setNodes(currNodes => {
      const layouted = autoLayoutCanvasNodes(currNodes, connections);
      pushHistory(layouted, connections);
      return layouted;
    });
  }, [connections, pushHistory]);

  return {
    nodes,
    connections,
    selectedNodeIds,
    viewport,
    isLoaded,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
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
  };
}
