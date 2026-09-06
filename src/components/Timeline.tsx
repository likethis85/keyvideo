import React from 'react';
import type { Layer } from './VideoCanvas';
import { toast } from './toastStore';
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineTrackRow } from './timeline/TimelineTrackRow';
import { TimelineRuler } from './timeline/TimelineRuler';
import { TimelineTrackBlocks } from './timeline/TimelineTrackBlocks';

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
}) => {
  const rulerRef = React.useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [zoom, setZoom] = React.useState<number>(1); // Horizontal zoom scale, defaults to 1x
  const [snapLineTime, setSnapLineTime] = React.useState<number | null>(null);

  const activeLayers = React.useMemo(() => layers.filter(layer => layer.visible), [layers]);
  const maxLayerEnd = activeLayers.reduce((max, l) => l.end > max ? l.end : max, 0);
  const totalDuration = maxLayerEnd > 0 ? Math.min(15, maxLayerEnd) : 15;

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
  }, [activeLayers, setCurrentTime, totalDuration]);

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

  // Global useEffect for resizing block duration
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing) {
        const trackWidth = getTrackWidth();
        const deltaX = e.clientX - resizing.initialMouseX;
        const deltaTime = (deltaX / trackWidth) * totalDuration;

        setLayers(prev => {
          const draggedLayer = prev.find(l => l.id === resizing.layerId);
          if (!draggedLayer) return prev;

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
                const newStart = Math.max(maxBeforeEnd, Math.min(resizing.initialEnd - 0.5, resizing.initialStart + deltaTime));
                return { ...layer, start: Math.round(newStart * 10) / 10 };
              } else {
                let minAfterStart = totalDuration;
                if (draggedLayer.type === 'text' || draggedLayer.type === 'media') {
                  const siblings = prev.filter(l => l.id !== draggedLayer.id && l.type === draggedLayer.type && l.visible);
                  const siblingsAfter = siblings.filter(l => l.start >= resizing.initialEnd);
                  minAfterStart = siblingsAfter.length > 0 
                    ? Math.min(...siblingsAfter.map(l => l.start)) 
                    : totalDuration;
                }
                const newEnd = Math.max(resizing.initialStart + 0.5, Math.min(minAfterStart, resizing.initialEnd + deltaTime));
                return { ...layer, end: Math.round(newEnd * 10) / 10 };
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
  }, [resizing, setLayers, totalDuration]);

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
          const newEnd = newStart + duration;

          return prev.map(layer => {
            if (layer.id === draggingBlock.layerId) {
              return {
                ...layer,
                start: Math.round(newStart * 10) / 10,
                end: Math.round(newEnd * 10) / 10
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
  }, [draggingBlock, setLayers, totalDuration]);

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

  const getMediaLayers = () => layers.filter(layer => layer.type === 'media');
  const getTextLayers = () => layers.filter(layer => layer.type === 'text' || layer.type === 'sticker');
  const getAudioLayers = () => layers.filter(layer => layer.type === 'audio');

  const renderTrackBlocks = (trackLayers: Layer[], typeClass: 'media' | 'text' | 'audio') => (
    <TimelineTrackBlocks
      layers={trackLayers}
      typeClass={typeClass}
      totalDuration={totalDuration}
      selectedLayerId={selectedLayerId}
      draggingLayerId={draggingBlock?.layerId}
      onBlockMouseDown={handleBlockMouseDown}
      onResizeStart={(event, layer, edge) => handleResizeStart(event, layer.id, edge, layer.start, layer.end)}
      onToggleVisibility={layer => {
        const visible = !layer.visible;
        setLayers(layers.map(item => item.id === layer.id ? { ...item, visible } : item));
        toast.info(`${visible ? '已显示' : '已隐藏'}图层「${layer.name}」`);
      }}
      onDelete={layer => {
        setLayers(layers.filter(item => item.id !== layer.id));
        if (selectedLayerId === layer.id) setSelectedLayerId(null);
        toast.success(`已删除图层「${layer.name}」`);
      }}
    />
  );

 return (
    <div className="timeline-panel">
      <TimelineHeader
        zoom={zoom}
        onZoomChange={setZoom}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        undoCount={undoCount}
        redoCount={redoCount}
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
