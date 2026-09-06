import type { MouseEvent } from 'react';
import type { Layer } from '../VideoCanvas';
import { AudioWaveformCanvas } from '../AudioWaveformCanvas';

interface Props {
  layers: Layer[];
  typeClass: 'media' | 'text' | 'audio';
  totalDuration: number;
  selectedLayerId: string | null;
  draggingLayerId?: string;
  onBlockMouseDown: (event: MouseEvent, layer: Layer) => void;
  onResizeStart: (event: MouseEvent, layer: Layer, edge: 'left' | 'right') => void;
  onToggleVisibility: (layer: Layer) => void;
  onDelete: (layer: Layer) => void;
}

export function TimelineTrackBlocks(props: Props) {
  const sorted = [...props.layers].sort((a, b) => a.start - b.start);
  const laneEnds: number[] = [];
  const blockLanes: Record<string, number> = {};
  sorted.forEach(layer => {
    let lane = laneEnds.findIndex(end => layer.start >= end - 0.01);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(layer.end); } else laneEnds[lane] = layer.end;
    blockLanes[layer.id] = lane;
  });
  const rowHeight = 38;

  return <div className="track-lane-container" style={{ height: Math.max(1, laneEnds.length) * rowHeight }}>
    {sorted.map(layer => {
      const active = props.selectedLayerId === layer.id;
      const blockType = layer.type === 'sticker' ? 'sticker' : props.typeClass;
      return <div
        key={layer.id}
        className={`timeline-block ${blockType} ${active ? 'active' : ''}`}
        style={{ left: `${layer.start / props.totalDuration * 100}%`, width: `${(layer.end - layer.start) / props.totalDuration * 100}%`, top: blockLanes[layer.id] * rowHeight + 3, height: rowHeight - 6, paddingInline: active ? 12 : 10, cursor: props.draggingLayerId === layer.id ? 'grabbing' : 'grab', opacity: layer.visible ? 1 : 0.45 }}
        title="↔️ 按住鼠标左右拖拽可调换视频分镜次序"
        onMouseDown={event => props.onBlockMouseDown(event, layer)}
      >
        {active && <div className="resize-handle left-handle" onMouseDown={event => props.onResizeStart(event, layer, 'left')} />}
        {layer.type === 'audio' && layer.properties.src && <AudioWaveformCanvas src={layer.properties.src} height={rowHeight - 8} />}
        <span className="timeline-block-name">{layer.properties.isVideo && !layer.name.startsWith('🎬') && '🎬'}{layer.type === 'audio' && !layer.name.startsWith('🎵') && '🎵'}{layer.type === 'sticker' && !layer.name.startsWith('🏷️') && '🏷️'}{layer.name}</span>
        <div className="block-hover-actions" onClick={event => event.stopPropagation()}><button className="block-action-btn" onClick={() => props.onToggleVisibility(layer)} title={layer.visible ? '点击隐藏图层' : '点击显示图层'}>{layer.visible ? '👁️' : '🙈'}</button><button className="block-action-btn" onClick={() => props.onDelete(layer)} title="快速删除图层">✕</button></div>
        {active && <div className="resize-handle right-handle" onMouseDown={event => props.onResizeStart(event, layer, 'right')} />}
      </div>;
    })}
  </div>;
}
