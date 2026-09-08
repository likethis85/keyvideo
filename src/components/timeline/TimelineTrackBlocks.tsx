import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent } from 'react';
import type { Layer } from '../VideoCanvas';
import { AudioWaveformCanvas } from '../AudioWaveformCanvas';
import { TRANSITION_CONFIGS, type TransitionType } from './timelineTransitions';

interface Props {
  layers: Layer[];
  typeClass: 'media' | 'text' | 'audio';
  totalDuration: number;
  currentTime?: number;
  selectedLayerId: string | null;
  draggingLayerId?: string;
  onBlockMouseDown: (event: MouseEvent, layer: Layer) => void;
  onResizeStart: (event: MouseEvent, layer: Layer, edge: 'left' | 'right') => void;
  onToggleVisibility: (layer: Layer) => void;
  onDelete: (layer: Layer) => void;
  onSplitLayer?: (layer: Layer) => void;
  onTransitionChange?: (layerId: string, transitionType: TransitionType, duration?: number) => void;
}

export function TimelineTrackBlocks(props: Props) {
  const [menuAnchor, setMenuAnchor] = useState<{ layerId: string; rect: DOMRect } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close popover when clicking outside or when timeline/page scrolls or resizes
  useEffect(() => {
    if (!menuAnchor) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setMenuAnchor(null);
      }
    };

    const handleScrollOrResize = () => {
      setMenuAnchor(null);
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [menuAnchor]);

  const sorted = [...props.layers].sort((a, b) => a.start - b.start);
  const laneEnds: number[] = [];
  const blockLanes: Record<string, number> = {};
  sorted.forEach(layer => {
    let lane = laneEnds.findIndex(end => layer.start >= end - 0.01);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(layer.end); } else laneEnds[lane] = layer.end;
    blockLanes[layer.id] = lane;
  });
  const rowHeight = 38;

  return (
    <div className="track-lane-container" style={{ height: Math.max(1, laneEnds.length) * rowHeight }}>
      {sorted.map(layer => {
        const active = props.selectedLayerId === layer.id;
        const blockType = layer.type === 'sticker' ? 'sticker' : props.typeClass;
        const curTime = props.currentTime ?? -1;
        const canSplitThisBlock = curTime > layer.start + 0.1 && curTime < layer.end - 0.1;
        const transition = (layer.properties.transitionType as TransitionType) || 'none';
        const hasTransition = layer.type === 'media' && transition !== 'none';
        const transitionCfg = TRANSITION_CONFIGS[transition] || TRANSITION_CONFIGS.none;
        const isMenuOpen = menuAnchor?.layerId === layer.id;

        return (
          <div
            key={layer.id}
            className={`timeline-block ${blockType} ${active ? 'active' : ''} ${hasTransition ? 'has-transition' : ''}`}
            style={{
              left: `${(layer.start / props.totalDuration) * 100}%`,
              width: `${((layer.end - layer.start) / props.totalDuration) * 100}%`,
              top: blockLanes[layer.id] * rowHeight + 3,
              height: rowHeight - 6,
              paddingInline: active ? 12 : 10,
              cursor: props.draggingLayerId === layer.id ? 'grabbing' : 'grab',
              opacity: layer.visible ? 1 : 0.45,
            }}
            title="↔️ 按住鼠标左右拖拽可调换视频分镜次序"
            onMouseDown={event => props.onBlockMouseDown(event, layer)}
          >
            {/* Left Resize Handle */}
            {active && (
              <div
                className="resize-handle left-handle"
                onMouseDown={event => props.onResizeStart(event, layer, 'left')}
                title="拖拽修改起点"
              />
            )}

            {/* Audio Waveform Canvas */}
            {layer.type === 'audio' && layer.properties.src && (
              <AudioWaveformCanvas src={layer.properties.src} height={rowHeight - 8} />
            )}

            {/* Transition Badge (Visible for media layers with transition) */}
            {hasTransition && (
              <button
                type="button"
                className={`timeline-transition-badge ${isMenuOpen ? 'active' : ''}`}
                title={`转场效果: ${transitionCfg.label} (${(layer.properties.transitionDuration ?? 0.5).toFixed(1)}s)，点击切换`}
                onClick={e => {
                  e.stopPropagation();
                  const target = e.currentTarget as HTMLElement;
                  const rect = target.getBoundingClientRect();
                  setMenuAnchor(prev => prev?.layerId === layer.id ? null : { layerId: layer.id, rect });
                }}
              >
                <span className="trans-icon">{transitionCfg.icon}</span>
                <span className="trans-text">{transitionCfg.short}</span>
              </button>
            )}

            {/* Block Name */}
            <span className="timeline-block-name">
              {layer.properties.isVideo && !layer.name.startsWith('🎬') && '🎬'}
              {layer.type === 'audio' && !layer.name.startsWith('🎵') && '🎵'}
              {layer.type === 'sticker' && !layer.name.startsWith('🏷️') && '🏷️'}
              {layer.name}
            </span>

            {/* Hover Actions: Quick Split, Quick Transition, Toggle Visibility, Delete */}
            <div className="block-hover-actions" onClick={event => event.stopPropagation()}>
              {/* Quick Transition Button for media */}
              {layer.type === 'media' && (
                <button
                  type="button"
                  className={`block-action-btn ${hasTransition ? 'has-trans' : ''}`}
                  onClick={e => {
                    e.stopPropagation();
                    const target = e.currentTarget as HTMLElement;
                    const rect = target.getBoundingClientRect();
                    setMenuAnchor(prev => prev?.layerId === layer.id ? null : { layerId: layer.id, rect });
                  }}
                  title={hasTransition ? '修改转场效果' : '添加转场效果'}
                >
                  {hasTransition ? transitionCfg.icon : '✨'}
                </button>
              )}

              {/* Quick Split Button if playhead aligns within this block */}
              {canSplitThisBlock && props.onSplitLayer && (
                <button
                  type="button"
                  className="block-action-btn split-action"
                  onClick={() => props.onSplitLayer?.(layer)}
                  title="✂️ 在当前播放头位置分割此图层 (Ctrl+B)"
                >
                  ✂️
                </button>
              )}

              {/* Visibility Toggle */}
              <button
                type="button"
                className="block-action-btn"
                onClick={() => props.onToggleVisibility(layer)}
                title={layer.visible ? '点击隐藏图层' : '点击显示图层'}
              >
                {layer.visible ? '👁️' : '🙈'}
              </button>

              {/* Delete Layer */}
              <button
                type="button"
                className="block-action-btn delete-action"
                onClick={() => props.onDelete(layer)}
                title="快速删除图层"
              >
                ✕
              </button>
            </div>

            {/* Right Resize Handle */}
            {active && (
              <div
                className="resize-handle right-handle"
                onMouseDown={event => props.onResizeStart(event, layer, 'right')}
                title="拖拽修改终点"
              />
            )}
          </div>
        );
      })}

      {/* Quick Transition Picker Popover rendered via Portal on document.body */}
      {menuAnchor && (() => {
        const activeLayer = props.layers.find(l => l.id === menuAnchor.layerId);
        if (!activeLayer) return null;

        const transition = (activeLayer.properties.transitionType as TransitionType) || 'none';
        const rect = menuAnchor.rect;
        const popoverHeight = 250;
        const spaceBelow = window.innerHeight - rect.bottom;
        // If closer to bottom of window, flip upwards above the badge
        const openUpwards = spaceBelow < popoverHeight && rect.top > popoverHeight;
        const top = openUpwards
          ? Math.max(10, rect.top - popoverHeight - 6)
          : Math.min(rect.bottom + 6, window.innerHeight - popoverHeight - 10);
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - 190));

        return createPortal(
          <div
            ref={popoverRef}
            className="timeline-transition-popover fixed-portal"
            style={{
              position: 'fixed',
              top: `${top}px`,
              left: `${left}px`,
              zIndex: 99999
            }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="trans-popover-header">
              <span>🎬 选择片段入场转场</span>
              <button
                type="button"
                className="trans-popover-close"
                onClick={() => setMenuAnchor(null)}
              >
                ✕
              </button>
            </div>
            <div className="trans-popover-options">
              {(Object.keys(TRANSITION_CONFIGS) as TransitionType[]).map(tType => {
                const cfg = TRANSITION_CONFIGS[tType];
                const isSelected = transition === tType;
                return (
                  <button
                    key={tType}
                    type="button"
                    className={`trans-option-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      props.onTransitionChange?.(activeLayer.id, tType);
                      setMenuAnchor(null);
                    }}
                  >
                    <span className="trans-opt-icon">{cfg.icon}</span>
                    <span className="trans-opt-name">{cfg.label}</span>
                    {isSelected && <span className="trans-opt-check">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
