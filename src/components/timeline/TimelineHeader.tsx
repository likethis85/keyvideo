import type { ReactNode } from 'react';
import { formatStudioTimecode } from '../../utils/studioTimeline';

interface TimelineHeaderProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  undo?: () => void;
  redo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  undoCount?: number;
  redoCount?: number;
  magneticSnapping?: boolean;
  onToggleMagneticSnapping?: () => void;
  onSplit?: () => void;
  canSplit?: boolean;
  splitDisabledReason?: string;
  currentTime?: number;
  totalDuration?: number;
  timelineHeight?: number;
  onHeightChange?: (height: number) => void;
  onToggleCollapsed?: () => void;
  fullPage?: boolean;
}

type TimelineIconName = 'undo' | 'redo' | 'split' | 'snap' | 'zoomOut' | 'zoomIn' | 'height' | 'collapse' | 'expand';

function TimelineIcon({ name, size = 18 }: { name: TimelineIconName; size?: number }) {
  const paths: Record<TimelineIconName, ReactNode> = {
    undo: <><path d="M9 7 4 12l5 5" /><path d="M5 12h9a6 6 0 0 1 6 6" /></>,
    redo: <><path d="m15 7 5 5-5 5" /><path d="M19 12h-9a6 6 0 0 0-6 6" /></>,
    split: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="m20 4-9 9M14 14l6 6M11 11l3 3" /></>,
    snap: <><path d="M8 3v4M16 3v4M8 17v4M16 17v4M3 8h4M17 8h4M3 16h4M17 16h4" /><rect x="8" y="8" width="8" height="8" rx="1.5" /></>,
    zoomOut: <><circle cx="10.5" cy="10.5" r="6" /><path d="M6 10.5h9M15 15l5 5" /></>,
    zoomIn: <><circle cx="10.5" cy="10.5" r="6" /><path d="M6 10.5h9M10.5 6v9M15 15l5 5" /></>,
    height: <><path d="M5 4v16M19 4v16M8 7l-3-3-3 3M16 17l3 3 3-3" /><path d="M9 8h6M9 12h6M9 16h6" /></>,
    collapse: <><path d="m6 9 6 6 6-6" /><path d="M4 20h16" /></>,
    expand: <><path d="m6 15 6-6 6 6" /><path d="M4 4h16" /></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function HistoryButton({ direction, action, enabled, count }: {
  direction: 'undo' | 'redo';
  action?: () => void;
  enabled?: boolean;
  count?: number;
}) {
  const isUndo = direction === 'undo';
  return (
    <button
      onClick={action}
      disabled={!enabled}
      className="icon-btn-micro timeline-history-button timeline-action-button"
      title={enabled ? `${isUndo ? '撤销' : '重做'}操作 (${isUndo ? 'Ctrl+Z' : 'Ctrl+Y'})` : `暂无${isUndo ? '撤销' : '重做'}历史`}
      data-tooltip={enabled ? `${isUndo ? '撤销' : '重做'}操作` : `暂无${isUndo ? '撤销' : '重做'}历史`}
      aria-label={isUndo ? '撤销操作' : '重做操作'}
    >
      <TimelineIcon name={isUndo ? 'undo' : 'redo'} />
      <span className="timeline-action-label">{isUndo ? '撤销' : '重做'}</span>
      {(count ?? 0) > 0 && <span className="timeline-history-count">{count}</span>}
    </button>
  );
}

export function TimelineHeader(props: TimelineHeaderProps) {
  const curTime = props.currentTime ?? 0;
  const totDuration = props.totalDuration ?? 15;
  const currentLabel = props.fullPage
    ? formatStudioTimecode(curTime)
    : `${curTime.toFixed(2)}s`;
  const totalLabel = props.fullPage
    ? formatStudioTimecode(totDuration)
    : `${totDuration.toFixed(1)}s`;

  return (
    <div className="timeline-header">
      <div className="timeline-header-main">
        <div className="timeline-title-group">
          <span className="timeline-title">剪辑时间轴</span>
          <span className="timeline-subtitle">多轨编辑</span>
        </div>
        
        {/* Playhead Time Code Readout */}
        <div className="timeline-timecode-badge" title="当前播放头时间 / 项目总时长" aria-label={`当前时间 ${currentLabel}，总时长 ${totalLabel}`}>
          <span className="timeline-timecode-label">播放头</span>
          <span className="timeline-timecode-cur">{currentLabel}</span>
          <span className="timeline-timecode-sep">/</span>
          <span className="timeline-timecode-total">{totalLabel}</span>
        </div>

        {/* Undo / Redo controls */}
        {(props.undo || props.redo) && (
          <div className="timeline-history-controls">
            <HistoryButton direction="undo" action={props.undo} enabled={props.canUndo} count={props.undoCount} />
            <HistoryButton direction="redo" action={props.redo} enabled={props.canRedo} count={props.redoCount} />
          </div>
        )}

        {/* Quick Tools: Split & Magnetic Snapping */}
        <div className="timeline-tools-cluster">
          {props.onSplit && (
            <button
              onClick={props.onSplit}
              disabled={!props.canSplit}
              className={`timeline-tool-btn split-btn timeline-action-button ${props.canSplit ? 'active-ready' : ''}`}
              title={props.canSplit 
                ? '在当前播放头位置分割选中图层 (快捷键: Ctrl+B / ⌘+B)' 
                : props.splitDisabledReason || '请先选定图层并将播放头移动至图层中间 (Ctrl+B)'}
              data-tooltip={props.canSplit ? '在播放头位置分割片段' : props.splitDisabledReason || '先选择片段并把播放头放到片段中间'}
              aria-label="分割片段"
            >
              <TimelineIcon name="split" />
              <span className="timeline-action-label">分割片段</span>
              <span className="timeline-tool-keyhint">Ctrl+B</span>
            </button>
          )}

          {props.onToggleMagneticSnapping && (
            <button
              onClick={props.onToggleMagneticSnapping}
              className={`timeline-tool-btn snap-btn timeline-action-button ${props.magneticSnapping ? 'snap-active' : 'snap-inactive'}`}
              title={props.magneticSnapping 
                ? '磁性吸附已开启：播放头与图层边缘将自动对齐标尺刻度与相邻图层（点击关闭）' 
                : '磁性吸附已关闭：自由拖拽无吸附对齐（点击开启）'}
              data-tooltip={props.magneticSnapping ? '关闭磁性吸附' : '开启磁性吸附'}
              aria-label={props.magneticSnapping ? '关闭磁性吸附' : '开启磁性吸附'}
            >
              <TimelineIcon name="snap" />
              <span className="timeline-action-label">磁性吸附</span>
              <span className="snap-state-label">{props.magneticSnapping ? '开启' : '关闭'}</span>
              <span className={`snap-indicator-dot ${props.magneticSnapping ? 'on' : 'off'}`} />
            </button>
          )}
        </div>
      </div>

      <div className="timeline-view-controls">
      <div className="timeline-zoom-controller" aria-label="时间轴缩放">
        <span className="timeline-control-label"><TimelineIcon name="zoomIn" size={16} />缩放</span>
        <button className="timeline-stepper-button" onClick={() => props.onZoomChange(Math.max(0.25, props.zoom - 0.25))} disabled={props.zoom <= 0.25} title="缩小时间轴视图" data-tooltip="缩小时间轴" aria-label="缩小时间轴"><TimelineIcon name="zoomOut" size={16} /></button>
        <input type="range" min="0.25" max="5" step="0.25" value={props.zoom} onChange={event => props.onZoomChange(Number(event.target.value))} title={`当前缩放: ${props.zoom}x`} aria-label="时间轴缩放比例" />
        <button className="timeline-stepper-button" onClick={() => props.onZoomChange(Math.min(5, props.zoom + 0.25))} disabled={props.zoom >= 5} title="放大时间轴视图" data-tooltip="放大时间轴" aria-label="放大时间轴"><TimelineIcon name="zoomIn" size={16} /></button>
        <span className="timeline-zoom-value">{Math.round(props.zoom * 100)}%</span>

        {props.onHeightChange && !props.fullPage && (
          <div className="timeline-height-presets" title="时间轴高度档位切换 (亦可向上拖拽顶边缘自由调整)">
            <span className="timeline-control-label"><TimelineIcon name="height" size={16} />轨道高度</span>
            <button
              type="button"
              className={`timeline-height-btn ${(props.timelineHeight ?? 220) <= 200 ? 'active' : ''}`}
              onClick={() => props.onHeightChange!(180)}
              title="标准轨道高度：适合快速剪辑"
              data-tooltip="标准轨道高度"
            >
              标准
            </button>
            <button
              type="button"
              className={`timeline-height-btn ${(props.timelineHeight ?? 220) > 200 && (props.timelineHeight ?? 220) <= 350 ? 'active' : ''}`}
              onClick={() => props.onHeightChange!(320)}
              title="舒适轨道高度：适合多轨编辑"
              data-tooltip="舒适轨道高度"
            >
              舒适
            </button>
            <button
              type="button"
              className={`timeline-height-btn ${(props.timelineHeight ?? 220) > 350 ? 'active' : ''}`}
              onClick={() => props.onHeightChange!(480)}
              title="加高轨道高度：适合精细调节"
              data-tooltip="加高轨道高度"
            >
              加高
            </button>
          </div>
        )}

        {props.onToggleCollapsed && (
          <button
            type="button"
            className="timeline-collapse-btn"
            onClick={props.onToggleCollapsed}
            title="收起时间轴，给预览和 AI 创作留出空间"
            data-tooltip="收起时间轴"
            aria-label="收起时间轴"
          >
            <TimelineIcon name="collapse" size={17} />
            <span>收起时间轴</span>
          </button>
        )}
      </div>

      </div>
      <div className="timeline-hint"><span className="timeline-hint-mark">提示</span>拖动片段调整节奏 · 拖动边缘裁剪 · 选择片段后按 Ctrl+B 分割</div>
    </div>
  );
}
