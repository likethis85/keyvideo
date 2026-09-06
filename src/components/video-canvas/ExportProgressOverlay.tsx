interface ExportProgressOverlayProps {
  visible: boolean;
  fps: number | null;
  engine: 'webcodecs' | 'mediarecorder';
  progress: number;
  logs: string[];
  onClose: () => void;
}

export function ExportProgressOverlay({ visible, fps, engine, progress, logs, onClose }: ExportProgressOverlayProps) {
  if (!visible) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '440px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '16px', margin: 0 }}>🎬 正在合成高清主图视频</h3>
          {fps !== null && <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>⚡ {fps} FPS</span>}
        </div>
        <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '14px' }}>
          {engine === 'webcodecs' ? '⚡ WebCodecs 硬件加速离屏渲染已启用。' : '💡 录制期间请保持当前标签页处于激活状态。'}
        </p>
        <div className="progress-container"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
        <div className="export-log">{logs.map((log, index) => <div key={`${index}-${log}`}>{`> ${log}`}</div>)}</div>
        {progress === 100 && <button className="btn-primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>完成</button>}
      </div>
    </div>
  );
}
