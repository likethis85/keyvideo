interface TimelineHeaderProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  undo?: () => void;
  redo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  undoCount?: number;
  redoCount?: number;
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
  return (
    <div className="timeline-header">
      <div className="timeline-header-main">
        <span className="timeline-title">多轨剪辑时间轴</span>
        {(props.undo || props.redo) && (
          <div className="timeline-history-controls">
            <HistoryButton direction="undo" action={props.undo} enabled={props.canUndo} count={props.undoCount} />
            <HistoryButton direction="redo" action={props.redo} enabled={props.canRedo} count={props.redoCount} />
          </div>
        )}
      </div>

      <div className="timeline-zoom-controller">
        <span>📊 轨道缩放:</span>
        <button onClick={() => props.onZoomChange(Math.max(0.25, props.zoom - 0.25))} disabled={props.zoom <= 0.25} title="缩小">−</button>
        <input type="range" min="0.25" max="5" step="0.25" value={props.zoom} onChange={event => props.onZoomChange(Number(event.target.value))} title={`当前缩放: ${props.zoom}x`} />
        <button onClick={() => props.onZoomChange(Math.min(5, props.zoom + 0.25))} disabled={props.zoom >= 5} title="放大">＋</button>
        <span className="timeline-zoom-value">{Math.round(props.zoom * 100)}%</span>
      </div>

      <div className="timeline-hint">💡 拖拽色块边缘调整时长，左右拖拽可调换分镜次序</div>
    </div>
  );
}
