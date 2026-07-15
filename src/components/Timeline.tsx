import React from 'react';
import type { Layer } from './VideoCanvas';

interface TimelineProps {
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  layers,
  setLayers,
  currentTime,
  setCurrentTime,
  selectedLayerId,
  setSelectedLayerId,
}) => {
  const rulerRef = React.useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [zoom, setZoom] = React.useState<number>(1); // Horizontal zoom scale, defaults to 1x

  const activeLayers = layers.filter(l => l.visible);
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
            <span className="timeline-ruler-text">{i}s</span>
          )}
        </div>
      );
    }
    return ticks;
  };

  const handleScrub = (clientX: number) => {
    if (rulerRef.current) {
      const rect = rulerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const pct = clickX / rect.width;
      const targetTime = Math.max(0, Math.min(totalDuration, pct * totalDuration));
      setCurrentTime(targetTime);
    }
  };

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
  }, [isDragging]);

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
  }, [resizing]);

  // Global useEffect for dragging/translating block
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
          let newEnd = draggingBlock.initialEnd + deltaTime;

          if (draggedLayer.type === 'text' || draggedLayer.type === 'media') {
            const siblings = prev.filter(l => l.id !== draggedLayer.id && l.type === draggedLayer.type && l.visible);
            
            const siblingsBefore = siblings.filter(l => l.end <= draggingBlock.initialStart);
            const maxBeforeEnd = siblingsBefore.length > 0 
              ? Math.max(...siblingsBefore.map(l => l.end)) 
              : 0;

            const siblingsAfter = siblings.filter(l => l.start >= draggingBlock.initialEnd);
            const minAfterStart = siblingsAfter.length > 0 
              ? Math.min(...siblingsAfter.map(l => l.start)) 
              : totalDuration;

            newStart = Math.max(maxBeforeEnd, Math.min(minAfterStart - duration, newStart));
            newEnd = newStart + duration;
          } else {
            if (newStart < 0) {
              newStart = 0;
              newEnd = duration;
            } else if (newEnd > totalDuration) {
              newEnd = totalDuration;
              newStart = totalDuration - duration;
            }
          }

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
  }, [draggingBlock]);

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

  const getMediaLayers = () => layers.filter((l) => l.type === 'media');
  const getTextLayers = () => layers.filter((l) => l.type === 'text' || l.type === 'sticker');
  const getAudioLayers = () => layers.filter((l) => l.type === 'audio');

  const renderTrackBlocks = (trackLayers: Layer[], typeClass: 'media' | 'text' | 'audio') => {
    // Sort by start time first to assign lanes deterministically
    const sorted = [...trackLayers].sort((a, b) => a.start - b.start);
    const lanes: number[] = []; // end times of each lane
    const blockLanes: { [id: string]: number } = {};

    sorted.forEach(layer => {
      let assignedLane = -1;
      for (let i = 0; i < lanes.length; i++) {
        // Use a tiny buffer of 0.01s to avoid floating point precision issues
        if (layer.start >= lanes[i] - 0.01) {
          assignedLane = i;
          lanes[i] = layer.end;
          break;
        }
      }
      if (assignedLane === -1) {
        assignedLane = lanes.length;
        lanes.push(layer.end);
      }
      blockLanes[layer.id] = assignedLane;
    });

    const totalLanes = Math.max(1, lanes.length);
    const rowHeight = 38; // height in pixels of each lane including gaps

    return (
      <div className="track-lane-container" style={{ position: 'relative', height: `${totalLanes * rowHeight}px`, width: '100%' }}>
        {sorted.map((layer) => {
          const left = (layer.start / totalDuration) * 100;
          const width = ((layer.end - layer.start) / totalDuration) * 100;
          const isActive = selectedLayerId === layer.id;
          const laneIndex = blockLanes[layer.id] || 0;
          const top = laneIndex * rowHeight + 3; // 3px gap from top

          return (
            <div
              key={layer.id}
              className={`timeline-block ${typeClass} ${isActive ? 'active' : ''}`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top: `${top}px`,
                height: `${rowHeight - 6}px`, // 32px height for block
                position: 'absolute',
                paddingLeft: isActive ? '12px' : '10px',
                paddingRight: isActive ? '12px' : '10px'
              }}
              onMouseDown={(e) => handleBlockMouseDown(e, layer)}
            >
              {/* Left resize handle - Render only when active */}
              {isActive && (
                <div
                  className="resize-handle left-handle"
                  onMouseDown={(e) => handleResizeStart(e, layer.id, 'left', layer.start, layer.end)}
                />
              )}

              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {layer.properties.isVideo && <span>🎬</span>}
                {layer.name}
              </span>

              {/* Right resize handle - Render only when active */}
              {isActive && (
                <div
                  className="resize-handle right-handle"
                  onMouseDown={(e) => handleResizeStart(e, layer.id, 'right', layer.start, layer.end)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="timeline-panel">
      {/* Header controls */}
      <div className="timeline-header">
        <span className="timeline-title">多轨剪辑时间轴</span>
        
        {/* Zoom controller */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border-color)', margin: '0 15px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            📊 轨道缩放:
          </span>
          <button 
            onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} 
            style={{
              background: 'none',
              border: 'none',
              color: zoom <= 0.25 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: zoom <= 0.25 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              padding: '0 4px',
              lineHeight: 1
            }}
            disabled={zoom <= 0.25}
            title="缩小"
          >
            -
          </button>
          <input 
            type="range" 
            min="0.25" 
            max="5" 
            step="0.25" 
            value={zoom} 
            onChange={(e) => setZoom(parseFloat(e.target.value))} 
            style={{ 
              width: '80px', 
              height: '4px', 
              accentColor: 'var(--accent-purple)',
              cursor: 'pointer'
            }} 
            title={`当前缩放: ${zoom}x`}
          />
          <button 
            onClick={() => setZoom(z => Math.min(5, z + 0.25))} 
            style={{
              background: 'none',
              border: 'none',
              color: zoom >= 5 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: zoom >= 5 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              padding: '0 4px',
              lineHeight: 1
            }}
            disabled={zoom >= 5}
            title="放大"
          >
            +
          </button>
          <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', minWidth: '24px', textAlign: 'right', fontWeight: '600' }}>
            {zoom.toFixed(1)}x
          </span>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          提示：拖曳轨道块边缘可调整时长，拖曳中间可平移时间；点击刻度尺可跳转指针；选中后右侧调属性
        </div>
      </div>

      {/* Scrollable container for tracks & ruler */}
      <div className="timeline-scroll-container" style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>
        <div style={{ width: `${zoom * 100}%`, minWidth: zoom >= 1 ? '100%' : 'auto', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
          
          {/* Ruler */}
          <div
            className="timeline-ruler"
            style={{ display: 'flex', height: '24px', background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
          >
            {/* Sticky ruler label / spacer */}
            <div 
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                width: '100px',
                minWidth: '100px',
                height: '100%',
                position: 'sticky',
                left: 0,
                zIndex: 12,
                background: 'rgba(13, 14, 21, 0.95)',
                borderRight: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '20px',
                fontSize: '11px',
                color: 'var(--text-muted)'
              }}
            >
              时间轴
            </div>

            {/* Ticks area */}
            <div 
              ref={rulerRef}
              className="timeline-ruler-ticks"
              onMouseDown={handleMouseDown}
              style={{ flex: 1, position: 'relative', height: '100%', cursor: 'ew-resize' }}
            >
              {renderTicks()}
              {/* Playhead line hanging down across the tracks */}
              <div
                className="timeline-playhead"
                style={{ 
                  left: `${(Math.min(currentTime, totalDuration) / totalDuration) * 100}%`, 
                  bottom: 'auto', 
                  height: '240px', 
                  zIndex: 9, 
                  pointerEvents: 'none' 
                }}
              >
                <div className="timeline-playhead-cap" />
              </div>
            </div>
          </div>

          {/* Tracks Container */}
          <div
            className="timeline-tracks"
            onMouseDown={handleMouseDown}
            style={{ flex: 1, position: 'relative', padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}
          >
            {/* Track 1: Media */}
            <div className="timeline-track">
              <div 
                className="track-label"
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  width: '100px',
                  minWidth: '100px',
                  position: 'sticky',
                  left: 0,
                  zIndex: 11,
                  background: 'rgba(13, 14, 21, 0.95)',
                  borderRight: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  paddingLeft: '20px'
                }}
              >
                {/* SVG Video icon */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                画面轨
              </div>
              <div className="track-content" style={{ flex: 1, margin: 0, overflow: 'visible', background: 'rgba(0, 0, 0, 0.25)', position: 'relative' }}>
                {renderTrackBlocks(getMediaLayers(), 'media')}
              </div>
            </div>

            {/* Track 2: Text / Stickers */}
            <div className="timeline-track">
              <div 
                className="track-label"
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  width: '100px',
                  minWidth: '100px',
                  position: 'sticky',
                  left: 0,
                  zIndex: 11,
                  background: 'rgba(13, 14, 21, 0.95)',
                  borderRight: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  paddingLeft: '20px'
                }}
              >
                {/* SVG Text icon */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line x1="9" y1="20" x2="15" y2="20" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
                字幕轨
              </div>
              <div className="track-content" style={{ flex: 1, margin: 0, overflow: 'visible', background: 'rgba(0, 0, 0, 0.25)', position: 'relative' }}>
                {renderTrackBlocks(getTextLayers(), 'text')}
              </div>
            </div>

            {/* Track 3: Audio */}
            <div className="timeline-track">
              <div 
                className="track-label"
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  width: '100px',
                  minWidth: '100px',
                  position: 'sticky',
                  left: 0,
                  zIndex: 11,
                  background: 'rgba(13, 14, 21, 0.95)',
                  borderRight: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  paddingLeft: '20px'
                }}
              >
                {/* SVG Audio icon */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                音轨
              </div>
              <div className="track-content" style={{ flex: 1, margin: 0, overflow: 'visible', background: 'rgba(0, 0, 0, 0.25)', position: 'relative' }}>
                {renderTrackBlocks(getAudioLayers(), 'audio')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
