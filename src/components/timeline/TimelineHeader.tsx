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
      className="icon-btn-micro timeline-history-button"
      title={enabled ? `${isUndo ? '撤销' : '重做'}操作 (${isUndo ? 'Ctrl+Z' : 'Ctrl+Y'})` : `暂无${isUndo ? '撤销' : '重做'}历史`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={isUndo ? '9 14 4 9 9 4' : '15 14 20 9 15 4'} />
        <path d={isUndo ? 'M20 20v-7a4 4 0 0 0-4-4H4' : 'M4 20v-7a4 4 0 0 1 4-4h12'} />
      </svg>
      <span>{isUndo ? '撤销' : '重做'}</span>
      {(count ?? 0) > 0 && <span className="timeline-history-count">{count}</span>}
    </button>
  );
}

export function TimelineHeader(props: TimelineHeaderProps) {
  const curTime = props.currentTime ?? 0;
  const totDuration = props.totalDuration ?? 15;

  return (
    <div className="timeline-header">
      <div className="timeline-header-main">
        <span className="timeline-title">多轨剪辑时间轴</span>
        
        {/* Playhead Time Code Readout */}
        <div className="timeline-timecode-badge" title="当前播放头时间 / 项目总时长">
          <span className="timeline-timecode-cur">{curTime.toFixed(2)}s</span>
          <span className="timeline-timecode-sep">/</span>
          <span className="timeline-timecode-total">{totDuration.toFixed(1)}s</span>
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
              className={`timeline-tool-btn split-btn ${props.canSplit ? 'active-ready' : ''}`}
              title={props.canSplit 
                ? '在当前播放头位置分割选中图层 (快捷键: Ctrl+B / ⌘+B)' 
                : props.splitDisabledReason || '请先选定图层并将播放头移动至图层中间 (Ctrl+B)'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
              <span>分割</span>
              <span className="timeline-tool-keyhint">Ctrl+B</span>
            </button>
          )}

          {props.onToggleMagneticSnapping && (
            <button
              onClick={props.onToggleMagneticSnapping}
              className={`timeline-tool-btn snap-btn ${props.magneticSnapping ? 'snap-active' : 'snap-inactive'}`}
              title={props.magneticSnapping 
                ? '磁性吸附已开启：播放头与图层边缘将自动对齐标尺刻度与相邻图层（点击关闭）' 
                : '磁性吸附已关闭：自由拖拽无吸附对齐（点击开启）'}
            >
              <span className="snap-icon">🧲</span>
              <span>磁吸{props.magneticSnapping ? '开' : '关'}</span>
              <span className={`snap-indicator-dot ${props.magneticSnapping ? 'on' : 'off'}`} />
            </button>
          )}
        </div>
      </div>

      <div className="timeline-zoom-controller">
        <span>📊 缩放:</span>
        <button onClick={() => props.onZoomChange(Math.max(0.25, props.zoom - 0.25))} disabled={props.zoom <= 0.25} title="缩小">−</button>
        <input type="range" min="0.25" max="5" step="0.25" value={props.zoom} onChange={event => props.onZoomChange(Number(event.target.value))} title={`当前缩放: ${props.zoom}x`} />
        <button onClick={() => props.onZoomChange(Math.min(5, props.zoom + 0.25))} disabled={props.zoom >= 5} title="放大">＋</button>
        <span className="timeline-zoom-value">{Math.round(props.zoom * 100)}%</span>

        {props.onHeightChange && (
          <div className="timeline-height-presets" title="时间轴高度档位切换 (亦可向上拖拽顶边缘自由调整)">
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '4px' }}>↕️ 高度:</span>
            <button
              type="button"
              className={`timeline-height-btn ${(props.timelineHeight ?? 220) <= 200 ? 'active' : ''}`}
              onClick={() => props.onHeightChange!(180)}
              title="标准紧凑高度 (180px)"
            >
              标准
            </button>
            <button
              type="button"
              className={`timeline-height-btn ${(props.timelineHeight ?? 220) > 200 && (props.timelineHeight ?? 220) <= 350 ? 'active' : ''}`}
              onClick={() => props.onHeightChange!(320)}
              title="舒适多轨高度 (320px)"
            >
              舒适
            </button>
            <button
              type="button"
              className={`timeline-height-btn ${(props.timelineHeight ?? 220) > 350 ? 'active' : ''}`}
              onClick={() => props.onHeightChange!(480)}
              title="专业大屏沉浸 (480px)"
            >
              加高
            </button>
          </div>
        )}
      </div>

      <div className="timeline-hint">💡 按住左右拖拽可调换次序，选中图层按 Ctrl+B 可快速剪切分割</div>
    </div>
  );
}
