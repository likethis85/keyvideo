import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { Layer } from '../components/VideoCanvas';

interface Options {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  layers: Layer[];
  setLayers: Dispatch<SetStateAction<Layer[]>>;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  width: number;
  height: number;
  currentTime: number;
  getMediaLayerSize: (layer: Layer, customScale?: number) => { w: number; h: number };
}

export function useCanvasLayerInteraction(options: Options) {
  const { canvasRef, layers, setLayers, selectedLayerId, setSelectedLayerId, width, height, currentTime, getMediaLayerSize } = options;

    const [canvasCursor, setCanvasCursor] = useState<'default' | 'move' | 'nwse-resize' | 'nesw-resize'>('default');
  
    const [isDraggingLayer, setIsDraggingLayer] = useState(false);
    const draggedLayerIdRef = useRef<string | null>(null);
    const initialMousePosRef = useRef({ x: 0, y: 0 });
    const initialLayerPosRef = useRef({ x: 0, y: 0 });
  
    const [isResizingLayer, setIsResizingLayer] = useState(false);
    const resizedLayerIdRef = useRef<string | null>(null);
    const activeHandleRef = useRef<'nw' | 'ne' | 'sw' | 'se' | null>(null);
    const initialScaleRef = useRef<number>(1);
    const initialLogicalCenterRef = useRef({ x: 0, y: 0 });
  
    // Click & Drag Layer on Canvas
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return; // Only left click
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      
      const logicalClickX = ((e.clientX - rect.left) / rect.width) * width;
      const logicalClickY = ((e.clientY - rect.top) / rect.height) * height;
  
      // Check if clicked on a corner handle of the selected layer
      if (selectedLayerId) {
        const activeLayer = layers.find(l => l.id === selectedLayerId);
        if (activeLayer && activeLayer.visible && currentTime >= activeLayer.start && currentTime <= activeLayer.end) {
          const pxX = (activeLayer.x / 100) * width;
          const pxY = (activeLayer.y / 100) * height;
          
          let boxW = 0;
          let boxH = 0;
  
          if (activeLayer.type === 'media') {
            const { w: activeW, h: activeH } = getMediaLayerSize(activeLayer);
            boxW = activeW;
            boxH = activeH;
          } else if (activeLayer.type === 'text') {
            boxW = 240;
            boxH = 40;
          } else if (activeLayer.type === 'sticker') {
            boxW = 160;
            boxH = 50;
          }
  
          const corners = [
            { name: 'nw' as const, x: pxX - boxW / 2 - 4, y: pxY - boxH / 2 - 4 },
            { name: 'ne' as const, x: pxX + boxW / 2 + 4, y: pxY - boxH / 2 - 4 },
            { name: 'sw' as const, x: pxX - boxW / 2 - 4, y: pxY + boxH / 2 + 4 },
            { name: 'se' as const, x: pxX + boxW / 2 + 4, y: pxY + boxH / 2 + 4 }
          ];
  
          let clickedHandle = null;
          for (const corner of corners) {
            const dist = Math.sqrt(Math.pow(corner.x - logicalClickX, 2) + Math.pow(corner.y - logicalClickY, 2));
            if (dist < 12) {
              clickedHandle = corner.name;
              break;
            }
          }
  
          if (clickedHandle) {
            setIsResizingLayer(true);
            resizedLayerIdRef.current = activeLayer.id;
            activeHandleRef.current = clickedHandle;
            initialScaleRef.current = activeLayer.scale;
            initialMousePosRef.current = { x: e.clientX, y: e.clientY };
            initialLogicalCenterRef.current = { x: pxX, y: pxY };
            if (clickedHandle === 'nw' || clickedHandle === 'se') {
              setCanvasCursor('nwse-resize');
            } else {
              setCanvasCursor('nesw-resize');
            }
            return;
          }
        }
      }
  
      // Find layer near click (normal body dragging, checking exact bounding boxes)
      let foundLayer: Layer | null = null;
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        if (!layer.visible || currentTime < layer.start || currentTime > layer.end) continue;
        
        const pxX = (layer.x / 100) * width;
        const pxY = (layer.y / 100) * height;
        let isInside = false;
  
        if (layer.type === 'media') {
          const { w: boxW, h: boxH } = getMediaLayerSize(layer);
          isInside = (
            logicalClickX >= pxX - boxW / 2 &&
            logicalClickX <= pxX + boxW / 2 &&
            logicalClickY >= pxY - boxH / 2 &&
            logicalClickY <= pxY + boxH / 2
          );
        } else if (layer.type === 'text') {
          const boxW = 240 * layer.scale;
          const boxH = 40 * layer.scale;
          isInside = (
            logicalClickX >= pxX - boxW / 2 &&
            logicalClickX <= pxX + boxW / 2 &&
            logicalClickY >= pxY - boxH / 2 &&
            logicalClickY <= pxY + boxH / 2
          );
        } else if (layer.type === 'sticker') {
          const boxW = 160 * layer.scale;
          const boxH = 50 * layer.scale;
          isInside = (
            logicalClickX >= pxX - boxW / 2 &&
            logicalClickX <= pxX + boxW / 2 &&
            logicalClickY >= pxY - boxH / 2 &&
            logicalClickY <= pxY + boxH / 2
          );
        }
  
        if (isInside) {
          foundLayer = layer;
          break;
        }
      }
  
      if (foundLayer) {
        setSelectedLayerId(foundLayer.id);
        draggedLayerIdRef.current = foundLayer.id;
        initialMousePosRef.current = { x: e.clientX, y: e.clientY };
        initialLayerPosRef.current = { x: foundLayer.x, y: foundLayer.y };
        setIsDraggingLayer(true);
        setCanvasCursor('move');
      } else {
        setSelectedLayerId(null);
        setCanvasCursor('default');
      }
    };
  
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
  
        if (isDraggingLayer && draggedLayerIdRef.current) {
          const dx = e.clientX - initialMousePosRef.current.x;
          const dy = e.clientY - initialMousePosRef.current.y;
          
          const percentDx = (dx / rect.width) * 100;
          const percentDy = (dy / rect.height) * 100;
          
          const newX = Math.max(0, Math.min(100, initialLayerPosRef.current.x + percentDx));
          const newY = Math.max(0, Math.min(100, initialLayerPosRef.current.y + percentDy));
          
          setLayers(prev => prev.map(l => l.id === draggedLayerIdRef.current ? { ...l, x: newX, y: newY } : l));
        } 
        else if (isResizingLayer && resizedLayerIdRef.current) {
          const dx = e.clientX - initialMousePosRef.current.x;
          const dy = e.clientY - initialMousePosRef.current.y;
  
          const logicalDx = (dx / rect.width) * width;
          const logicalDy = (dy / rect.height) * height;
  
          const activeLayer = layers.find(l => l.id === resizedLayerIdRef.current);
          if (!activeLayer) return;
  
          let boxW = 0;
          let boxH = 0;
          if (activeLayer.type === 'media') {
            const { w: activeW, h: activeH } = getMediaLayerSize(activeLayer, initialScaleRef.current);
            boxW = activeW;
            boxH = activeH;
          } else if (activeLayer.type === 'text') {
            boxW = 240;
            boxH = 40;
          } else if (activeLayer.type === 'sticker') {
            boxW = 160;
            boxH = 50;
          }
  
          const distInitial = Math.sqrt(Math.pow(boxW / 2 + 4, 2) + Math.pow(boxH / 2 + 4, 2));
  
          const initialClickX = ((initialMousePosRef.current.x - rect.left) / rect.width) * width;
          const initialClickY = ((initialMousePosRef.current.y - rect.top) / rect.height) * height;
  
          const center = initialLogicalCenterRef.current;
          const currentMouseX = initialClickX + logicalDx;
          const currentMouseY = initialClickY + logicalDy;
  
          const distCurrent = Math.sqrt(Math.pow(currentMouseX - center.x, 2) + Math.pow(currentMouseY - center.y, 2));
  
          const scaleFactor = distCurrent / distInitial;
  
          const newScale = Math.max(0.15, Math.min(3.5, initialScaleRef.current * scaleFactor));
  
          setLayers(prev => prev.map(l => l.id === resizedLayerIdRef.current ? { ...l, scale: newScale } : l));
        }
      };
  
      const handleMouseUp = () => {
        if (isDraggingLayer) {
          setIsDraggingLayer(false);
          draggedLayerIdRef.current = null;
        }
        if (isResizingLayer) {
          setIsResizingLayer(false);
          resizedLayerIdRef.current = null;
          activeHandleRef.current = null;
        }
        setCanvasCursor('default');
      };
  
      if (isDraggingLayer || isResizingLayer) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
      }
  
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isDraggingLayer, isResizingLayer, layers, setLayers, width, height, canvasRef, getMediaLayerSize]);
  
    // Hover effect to update canvas cursor dynamically
    const handleMouseMoveCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDraggingLayer) {
        setCanvasCursor('move');
        return;
      }
      if (isResizingLayer) {
        if (activeHandleRef.current === 'nw' || activeHandleRef.current === 'se') {
          setCanvasCursor('nwse-resize');
        } else {
          setCanvasCursor('nesw-resize');
        }
        return;
      }
  
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      
      const logicalClickX = ((e.clientX - rect.left) / rect.width) * width;
      const logicalClickY = ((e.clientY - rect.top) / rect.height) * height;
  
      if (selectedLayerId) {
        const activeLayer = layers.find(l => l.id === selectedLayerId);
        if (activeLayer && activeLayer.visible && currentTime >= activeLayer.start && currentTime <= activeLayer.end) {
          const pxX = (activeLayer.x / 100) * width;
          const pxY = (activeLayer.y / 100) * height;
          
          let boxW = 0;
          let boxH = 0;
  
          if (activeLayer.type === 'media') {
            const { w: activeW, h: activeH } = getMediaLayerSize(activeLayer);
            boxW = activeW;
            boxH = activeH;
          } else if (activeLayer.type === 'text') {
            boxW = 240;
            boxH = 40;
          } else if (activeLayer.type === 'sticker') {
            boxW = 160;
            boxH = 50;
          }
  
          const corners = [
            { name: 'nw' as const, x: pxX - boxW / 2 - 4, y: pxY - boxH / 2 - 4 },
            { name: 'ne' as const, x: pxX + boxW / 2 + 4, y: pxY - boxH / 2 - 4 },
            { name: 'sw' as const, x: pxX - boxW / 2 - 4, y: pxY + boxH / 2 + 4 },
            { name: 'se' as const, x: pxX + boxW / 2 + 4, y: pxY + boxH / 2 + 4 }
          ];
  
          for (const corner of corners) {
            const dist = Math.sqrt(Math.pow(corner.x - logicalClickX, 2) + Math.pow(corner.y - logicalClickY, 2));
            if (dist < 12) {
              if (corner.name === 'nw' || corner.name === 'se') {
                setCanvasCursor('nwse-resize');
              } else {
                setCanvasCursor('nesw-resize');
              }
              return;
            }
          }
        }
      }
  
      // Check if hovering over any layer body (checking exact bounding boxes)
      let foundLayer = null;
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        if (!layer.visible || currentTime < layer.start || currentTime > layer.end) continue;
        
        const pxX = (layer.x / 100) * width;
        const pxY = (layer.y / 100) * height;
        let isInside = false;
  
        if (layer.type === 'media') {
          const { w: boxW, h: boxH } = getMediaLayerSize(layer);
          isInside = (
            logicalClickX >= pxX - boxW / 2 &&
            logicalClickX <= pxX + boxW / 2 &&
            logicalClickY >= pxY - boxH / 2 &&
            logicalClickY <= pxY + boxH / 2
          );
        } else if (layer.type === 'text') {
          const boxW = 240 * layer.scale;
          const boxH = 40 * layer.scale;
          isInside = (
            logicalClickX >= pxX - boxW / 2 &&
            logicalClickX <= pxX + boxW / 2 &&
            logicalClickY >= pxY - boxH / 2 &&
            logicalClickY <= pxY + boxH / 2
          );
        } else if (layer.type === 'sticker') {
          const boxW = 160 * layer.scale;
          const boxH = 50 * layer.scale;
          isInside = (
            logicalClickX >= pxX - boxW / 2 &&
            logicalClickX <= pxX + boxW / 2 &&
            logicalClickY >= pxY - boxH / 2 &&
            logicalClickY <= pxY + boxH / 2
          );
        }
  
        if (isInside) {
          foundLayer = layer;
          break;
        }
      }
  
      if (foundLayer) {
        setCanvasCursor('move');
      } else {
        setCanvasCursor('default');
      }
    };
  
    // Fallback MediaRecorder Real-time Recording Engine

  return { canvasCursor, handleMouseDown, handleMouseMoveCanvas };
}
