import React from 'react';
import type { Layer } from './VideoCanvas';
import { toast } from './toastStore';
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineTrackRow } from './timeline/TimelineTrackRow';
import { TimelineRuler } from './timeline/TimelineRuler';
import { TimelineTrackBlocks } from './timeline/TimelineTrackBlocks';
import { TRANSITION_CONFIGS, type TransitionType } from './timeline/timelineTransitions';
import { canSplitLayer, splitLayerInList } from '../services/timelineSplitService';

interface TimelineProps {
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  undo?: () => void;
  redo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  undoCount?: number;
  redoCount?: number;
  commitInstantHistory?: (newLayers: Layer[], actionDesc: string) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  layers,
  setLayers,
  currentTime,
  setCurrentTime,
  selectedLayerId,
  setSelectedLayerId,
  undo,
  redo,
  canUndo,
  canRedo,
  undoCount,
  redoCount,
  commitInstantHistory,
}) => {
  const rulerRef = React.useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [zoom, setZoom] = React.useState<number>(1); // Horizontal zoom scale, defaults to 1x
  const [snapLineTime, setSnapLineTime] = React.useState<number | null>(null);

  // Magnetic snapping toggle persisted in localStorage
  const [magneticSnapping, setMagneticSnapping] = React.useState<boolean>(() => {
    return localStorage.getItem('keyvideo_magnetic_snapping') !== 'false';
  });

  const toggleMagneticSnapping = React.useCallback(() => {
    setMagneticSnapping(prev => {
      const next = !prev;
      localStorage.setItem('keyvideo_magnetic_snapping', String(next));
      toast.info(`🧲 磁性吸附已${next ? '开启' : '关闭'}`);
      return next;
    });
  }, []);

  // Dynamic Timeline Height adjustment with localStorage persistence
  const [timelineHeight, setTimelineHeight] = React.useState<number>(() => {
    const saved = localStorage.getItem('keyvideo_timeline_height');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 120 && parsed <= 800) return parsed;
    }
    return 240; // Default comfortable multi-track height
  });

  const [isResizingHeight, setIsResizingHeight] = React.useState(false);
  const heightDragStartRef = React.useRef<{ startY: number; startHeight: number }>({ startY: 0, startHeight: 240 });

  // Handle vertical drag to resize timeline panel height
  React.useEffect(() => {
    if (!isResizingHeight) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - heightDragStartRef.current.startY;
      // Dragging UP (deltaY < 0) increases height
      const nextHeight = Math.round(
        Math.min(
          Math.max(140, heightDragStartRef.current.startHeight - deltaY),
          window.innerHeight * 0.75
        )
      );
      setTimelineHeight(nextHeight);
    };

    const handleMouseUp = () => {
      setIsResizingHeight(false);
      setTimelineHeight(current => {
        localStorage.setItem('keyvideo_timeline_height', current.toString());
        return current;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingHeight]);

  const handleHeightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingHeight(true);
    heightDragStartRef.current = {
      startY: e.clientY,
      startHeight: timelineHeight
    };
  };

  const handleToggleHeightPreset = () => {
    setTimelineHeight(prev => {
      const next = prev < 300 ? 380 : 180;
      localStorage.setItem('keyvideo_timeline_height', next.toString());
      toast.info(`时间轴已切换至 ${next}px ${next > 300 ? '舒适加高' : '标准'}模式`);
      return next;
    });
  };

  const handleSetHeight = (h: number) => {
    setTimelineHeight(h);
    localStorage.setItem('keyvideo_timeline_height', h.toString());
  };

  const activeLayers = React.useMemo(() => layers.filter(layer => layer.visible), [layers]);
  const maxLayerEnd = activeLayers.reduce((max, l) => l.end > max ? l.end : max, 0);
  const totalDuration = maxLayerEnd > 0 ? Math.min(15, maxLayerEnd) : 15;

  // Selected layer reference
  const selectedLayer = React.useMemo(() => {
    return layers.find(l => l.id === selectedLayerId);
  }, [layers, selectedLayerId]);

  // Split capability check
  const splitValidation = React.useMemo(() => {
    return canSplitLayer(selectedLayer, currentTime);
  }, [selectedLayer, currentTime]);

  // Resizing state
  const [resizing, setResizing] = React.useState<{
    layerId: string;
    edge: 'left' | 'right';
    initialStart: number;
    initialEnd: number;
    initialMouseX: number;
  } | null>(null);

  // Translating/moving block state
  const [draggingBlock, setDraggingBlock] = React.useState<{
    layerId: string;
    initialStart: number;
    initialEnd: number;
    initialMouseX: number;
  } | null>(null);

  const getTrackWidth = () => {
    if (rulerRef.current) {
      return rulerRef.current.getBoundingClientRect().width;
    }
    return 1;
  };

  // Generate ruler tick marks
  const renderTicks = () => {
    const ticks = [];
    const maxTick = Math.ceil(totalDuration);
    for (let i = 0; i <= maxTick; i++) {
      const pct = (i / totalDuration) * 100;
      ticks.push(
        <div key={i} className="timeline-ruler-mark" style={{ left: `${pct}%` }}>
          {i % 3 === 0 && (
            <span
              className="timeline-ruler-text"
              style={i === 0 ? { transform: 'translateX(2px)' } : i === maxTick ? { transform: 'translateX(-100%)' } : undefined}
            >
              {i}s
            </span>
          )}
        </div>
      );
    }
    return ticks;
  };

  const handleScrub = React.useCallback((clientX: number) => {
    if (rulerRef.current) {
      const rect = rulerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const pct = clickX / rect.width;
      const rawTargetTime = Math.max(0, Math.min(totalDuration, pct * totalDuration));

      if (!magneticSnapping) {
        setCurrentTime(Math.round(rawTargetTime * 100) / 100);
        setSnapLineTime(null);
        return;
      }

      const candidates: number[] = [0, totalDuration];
      for (let time = 0; time <= totalDuration; time += 0.5) {
        candidates.push(Math.round(time * 10) / 10);
      }
      activeLayers.forEach(layer => candidates.push(layer.start, layer.end));

      let snappedTime = rawTargetTime;
      let minimumDifference = Infinity;
      candidates.forEach(candidate => {
        const difference = Math.abs(rawTargetTime - candidate);
        if (difference < minimumDifference && difference <= 0.15) {
          minimumDifference = difference;
          snappedTime = candidate;
        }
      });
      const snapped = minimumDifference <= 0.15;
      setCurrentTime(snappedTime);
      setSnapLineTime(snapped ? snappedTime : null);
    }
  }, [activeLayers, magneticSnapping, setCurrentTime, totalDuration]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only drag with left click
    if (e.button !== 0) return;
    setIsDragging(true);
    handleScrub(e.clientX);
  };

  // Global useEffect for scrubbing playhead
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleScrub(e.clientX);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setSnapLineTime(null);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleScrub, isDragging]);

  // Global useEffect for resizing block duration with magnetic snapping
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing) {
        const trackWidth = getTrackWidth();
        const deltaX = e.clientX - resizing.initialMouseX;
        const deltaTime = (deltaX / trackWidth) * totalDuration;

        setLayers(prev => {
          const draggedLayer = prev.find(l => l.id === resizing.layerId);
          if (!draggedLayer) return prev;

          // Candidate snap points
          const snapPoints: number[] = [];
          if (magneticSnapping) {
            for (let t = 0; t <= totalDuration; t += 0.5) snapPoints.push(t);
            prev.filter(l => l.id !== resizing.layerId && l.visible).forEach(l => {
              snapPoints.push(l.start, l.end);
            });
          }

          return prev.map(layer => {
            if (layer.id === resizing.layerId) {
              if (resizing.edge === 'left') {
                let maxBeforeEnd = 0;
                if (draggedLayer.type === 'text' || draggedLayer.type === 'media') {
                  const siblings = prev.filter(l => l.id !== draggedLayer.id && l.type === draggedLayer.type && l.visible);
                  const siblingsBefore = siblings.filter(l => l.end <= resizing.initialStart);
                  maxBeforeEnd = siblingsBefore.length > 0 
                    ? Math.max(...siblingsBefore.map(l => l.end)) 
                    : 0;
                }
                let rawStart = Math.max(maxBeforeEnd, Math.min(resizing.initialEnd - 0.5, resizing.initialStart + deltaTime));

                // Snap if close
                if (magneticSnapping) {
                  for (const pt of snapPoints) {
                    if (Math.abs(rawStart - pt) <= 0.12 && pt >= maxBeforeEnd && pt <= resizing.initialEnd - 0.5) {
                      rawStart = pt;
                      break;
                    }
                  }
                }
                return { ...layer, start: Math.round(rawStart * 100) / 100 };
              } else {
                let minAfterStart = totalDuration;
                if (draggedLayer.type === 'text' || draggedLayer.type === 'media') {
                  const siblings = prev.filter(l => l.id !== draggedLayer.id && l.type === draggedLayer.type && l.visible);
                  const siblingsAfter = siblings.filter(l => l.start >= resizing.initialEnd);
                  minAfterStart = siblingsAfter.length > 0 
                    ? Math.min(...siblingsAfter.map(l => l.start)) 
                    : totalDuration;
                }
                let rawEnd = Math.max(resizing.initialStart + 0.5, Math.min(minAfterStart, resizing.initialEnd + deltaTime));

                // Snap if close
                if (magneticSnapping) {
                  for (const pt of snapPoints) {
                    if (Math.abs(rawEnd - pt) <= 0.12 && pt <= minAfterStart && pt >= resizing.initialStart + 0.5) {
                      rawEnd = pt;
                      break;
                    }
                  }
                }
                return { ...layer, end: Math.round(rawEnd * 100) / 100 };
              }
            }
            return layer;
          });
        });
      }
    };

    const handleMouseUp = () => {
      if (resizing) {
        setResizing(null);
      }
    };

    if (resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [magneticSnapping, resizing, setLayers, totalDuration]);

  // Global useEffect for dragging/translating block and swapping video clip order
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingBlock) {
        const trackWidth = getTrackWidth();
        const deltaX = e.clientX - draggingBlock.initialMouseX;
        const deltaTime = (deltaX / trackWidth) * totalDuration;
        const duration = draggingBlock.initialEnd - draggingBlock.initialStart;

        setLayers(prev => {
          const draggedLayer = prev.find(l => l.id === draggingBlock.layerId);
          if (!draggedLayer) return prev;

          let newStart = draggingBlock.initialStart + deltaTime;
          newStart = Math.max(0, Math.min(totalDuration - duration, newStart));

          // Snap start/end to neighbors or ruler
          if (magneticSnapping) {
            const snapPoints: number[] = [];
            for (let t = 0; t <= totalDuration; t += 0.5) snapPoints.push(t);
            prev.filter(l => l.id !== draggingBlock.layerId && l.visible).forEach(l => {
              snapPoints.push(l.start, l.end);
            });

            for (const pt of snapPoints) {
              if (Math.abs(newStart - pt) <= 0.12) {
                newStart = pt;
                break;
              }
              if (Math.abs((newStart + duration) - pt) <= 0.12) {
                newStart = pt - duration;
                break;
              }
            }
          }

          const newEnd = newStart + duration;

          return prev.map(layer => {
            if (layer.id === draggingBlock.layerId) {
              return {
                ...layer,
                start: Math.round(newStart * 100) / 100,
                end: Math.round(newEnd * 100) / 100
              };
            }
            return layer;
          });
        });
      }
    };

    const handleMouseUp = () => {
      if (draggingBlock) {
        // When mouse is released, automatically re-sort and pack video clips seamlessly (excluding LOGO & overlays)
        setLayers(prev => {
          const draggedLayer = prev.find(l => l.id === draggingBlock.layerId);
          if (!draggedLayer) return prev;

          // Helper to identify main video storyboards (excluding LOGO & static overlay images)
          const isVideoClip = (l: Layer) => {
            if (l.type !== 'media') return false;
            if (l.id.includes('logo') || l.name.includes('LOGO') || l.name.includes('Logo') || l.name.includes('贴纸')) {
              return false;
            }
            return true;
          };

          // If the dragged item is a LOGO or overlay, do not auto-pack main video clips
          if (!isVideoClip(draggedLayer)) {
            return prev;
          }

          const videoLayers = prev.filter(l => l.visible && isVideoClip(l));
          if (videoLayers.length <= 1) return prev;

          // Sort only main video layers by their updated start position
          const sortedVideo = [...videoLayers].sort((a, b) => a.start - b.start);

          // Re-pack main video layers back-to-back without gaps
          let cursor = 0;
          const packedMap = new Map<string, { start: number; end: number }>();
          sortedVideo.forEach(layer => {
            const dur = layer.end - layer.start;
            const s = cursor;
            const e = cursor + dur;
            packedMap.set(layer.id, {
              start: Math.round(s * 10) / 10,
              end: Math.round(e * 10) / 10
            });
            cursor = e;
          });

          return prev.map(layer => {
            if (packedMap.has(layer.id)) {
              const packed = packedMap.get(layer.id)!;
              return { ...layer, start: packed.start, end: packed.end };
            }
            return layer;
          });
        });
        setDraggingBlock(null);
      }
    };

    if (draggingBlock) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBlock, magneticSnapping, setLayers, totalDuration]);

  const handleResizeStart = (e: React.MouseEvent, layerId: string, edge: 'left' | 'right', currentStart: number, currentEnd: number) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedLayerId(layerId);
    setResizing({
      layerId,
      edge,
      initialStart: currentStart,
      initialEnd: currentEnd,
      initialMouseX: e.clientX,
    });
  };

  const handleBlockMouseDown = (e: React.MouseEvent, layer: Layer) => {
    e.stopPropagation();
    setSelectedLayerId(layer.id);
    if (e.button !== 0) return;
    setDraggingBlock({
      layerId: layer.id,
      initialStart: layer.start,
      initialEnd: layer.end,
      initialMouseX: e.clientX,
    });
  };

  // Split selected layer handler
  const handleSplitSelected = React.useCallback(() => {
    if (!selectedLayerId) return;
    const res = splitLayerInList(layers, selectedLayerId, currentTime);
    if (!res) {
      toast.warning('当前播放头位置无法分割此图层');
      return;
    }
    setLayers(res.newLayers);
    setSelectedLayerId(res.newLayerId);
    if (commitInstantHistory) {
      commitInstantHistory(res.newLayers, `分割图层「${res.splitLayer.name}」`);
    }
    toast.success(`✂️ 已在 ${currentTime.toFixed(2)}s 处分割图层！可按 Ctrl+Z 撤销`);
  }, [commitInstantHistory, currentTime, layers, selectedLayerId, setLayers, setSelectedLayerId]);

  // Split specific layer handler (e.g. from hover action)
  const handleSplitSpecificLayer = React.useCallback((layer: Layer) => {
    const res = splitLayerInList(layers, layer.id, currentTime);
    if (!res) {
      toast.warning('当前播放头位置无法分割此图层');
      return;
    }
    setLayers(res.newLayers);
    setSelectedLayerId(res.newLayerId);
    if (commitInstantHistory) {
      commitInstantHistory(res.newLayers, `分割图层「${layer.name}」`);
    }
    toast.success(`✂️ 已在 ${currentTime.toFixed(2)}s 处分割图层「${layer.name}」！`);
  }, [commitInstantHistory, currentTime, layers, setLayers, setSelectedLayerId]);

  // Quick Transition Change Handler
  const handleTransitionChange = React.useCallback((layerId: string, transitionType: TransitionType, duration = 0.5) => {
    setLayers(prev => {
      const updated = prev.map(l => {
        if (l.id === layerId) {
          return {
            ...l,
            properties: {
              ...l.properties,
              transitionType,
              transitionDuration: duration,
            }
          };
        }
        return l;
      });
      if (commitInstantHistory) {
        commitInstantHistory(updated, `设置转场效果为 ${TRANSITION_CONFIGS[transitionType].label}`);
      }
      return updated;
    });
    const cfg = TRANSITION_CONFIGS[transitionType];
    toast.info(`${cfg.icon} 已设置转场效果为「${cfg.label}」`);
  }, [commitInstantHistory, setLayers]);

  const getMediaLayers = () => layers.filter(layer => layer.type === 'media');
  const getTextLayers = () => layers.filter(layer => layer.type === 'text' || layer.type === 'sticker');
  const getAudioLayers = () => layers.filter(layer => layer.type === 'audio');

  const renderTrackBlocks = (trackLayers: Layer[], typeClass: 'media' | 'text' | 'audio') => (
    <TimelineTrackBlocks
      layers={trackLayers}
      typeClass={typeClass}
      totalDuration={totalDuration}
      currentTime={currentTime}
      selectedLayerId={selectedLayerId}
      draggingLayerId={draggingBlock?.layerId}
      onBlockMouseDown={handleBlockMouseDown}
      onResizeStart={(event, layer, edge) => handleResizeStart(event, layer.id, edge, layer.start, layer.end)}
      onToggleVisibility={layer => {
        const visible = !layer.visible;
        const updated = layers.map(item => item.id === layer.id ? { ...item, visible } : item);
        setLayers(updated);
        if (commitInstantHistory) {
          commitInstantHistory(updated, `${visible ? '显示' : '隐藏'}图层「${layer.name}」`);
        }
        toast.info(`${visible ? '已显示' : '已隐藏'}图层「${layer.name}」`);
      }}
      onDelete={layer => {
        const updated = layers.filter(item => item.id !== layer.id);
        setLayers(updated);
        if (selectedLayerId === layer.id) setSelectedLayerId(null);
        if (commitInstantHistory) {
          commitInstantHistory(updated, `删除图层「${layer.name}」`);
        }
        toast.success(`已删除图层「${layer.name}」，可按 Ctrl+Z 撤销`);
      }}
      onSplitLayer={handleSplitSpecificLayer}
      onTransitionChange={handleTransitionChange}
    />
  );

  return (
    <div
      className="timeline-panel"
      style={{
        height: `${timelineHeight}px`,
        transition: isResizingHeight ? 'none' : 'height 0.16s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Interactive Top Height Resizer Handle */}
      <div
        className={`timeline-resizer ${isResizingHeight ? 'is-dragging' : ''}`}
        onMouseDown={handleHeightResizeStart}
        onDoubleClick={handleToggleHeightPreset}
        title="按住鼠标上下拖拽可自由调整时间轴高度，双击快速切换标准/加高档位"
      >
        {isResizingHeight && (
          <div className="timeline-height-badge">
            ↕️ 时间轴高度: {timelineHeight}px
          </div>
        )}
      </div>

      <TimelineHeader
        zoom={zoom}
        onZoomChange={setZoom}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        undoCount={undoCount}
        redoCount={redoCount}
        magneticSnapping={magneticSnapping}
        onToggleMagneticSnapping={toggleMagneticSnapping}
        onSplit={handleSplitSelected}
        canSplit={splitValidation.canSplit}
        splitDisabledReason={splitValidation.reason}
        currentTime={currentTime}
        totalDuration={totalDuration}
        timelineHeight={timelineHeight}
        onHeightChange={handleSetHeight}
      />

      {/* Scrollable container for tracks & ruler */}
      <div className="timeline-scroll-container" style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>
        <div style={{ width: `${zoom * 100}%`, minWidth: zoom >= 1 ? '100%' : 'auto', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
          
          <TimelineRuler
            rulerRef={rulerRef}
            ticks={renderTicks()}
            currentTime={currentTime}
            totalDuration={totalDuration}
            snapLineTime={snapLineTime}
            onMouseDown={handleMouseDown}
          />

          {/* Tracks Container */}
          <div
            className="timeline-tracks"
            onMouseDown={handleMouseDown}
            style={{ flex: 1, position: 'relative', padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}
          >
            <TimelineTrackRow
              label="画面轨"
              accent="var(--accent-purple)"
              glow="var(--accent-purple-glow)"
              icon={<><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></>}
            >
              {renderTrackBlocks(getMediaLayers(), 'media')}
            </TimelineTrackRow>

            <TimelineTrackRow
              label="文案/贴纸"
              accent="#f59e0b"
              glow="rgba(245, 158, 11, 0.5)"
              icon={<><polyline points="4 7 4 4 20 4 20 7" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="9" y1="20" x2="15" y2="20" /></>}
            >
              {renderTrackBlocks(getTextLayers(), 'text')}
            </TimelineTrackRow>

            <TimelineTrackRow
              label="音频轨"
              accent="var(--accent-cyan)"
              glow="var(--accent-cyan-glow)"
              icon={<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>}
            >
              {renderTrackBlocks(getAudioLayers(), 'audio')}
            </TimelineTrackRow>
          </div>
        </div>
      </div>
    </div>
  );
};
