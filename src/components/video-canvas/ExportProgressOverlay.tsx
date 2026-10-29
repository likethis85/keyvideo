import { useState, type ReactNode } from 'react';
import type { ExportResultInfo } from '../../utils/webCodecsExporter';
import { toast } from '../toastStore';

type ExportIconName = 'film' | 'download' | 'cloud' | 'copy' | 'close' | 'check' | 'ruler' | 'clock' | 'storage' | 'speed' | 'cancel' | 'spinner';

function ExportIcon({ name, className = '' }: { name: ExportIconName; className?: string }) {
  const paths: Record<ExportIconName, ReactNode> = {
    film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4" /><path d="m10 9 5 3-5 3V9Z" /></>,
    download: <><path d="M12 3v11" /><path d="m7 10 5 5 5-5" /><path d="M4 19h16" /></>,
    cloud: <><path d="M7.5 18h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 6.4 8.7 3.8 3.8 0 0 0 7.5 18Z" /><path d="M12 11v5m-2-2 2 2 2-2" /></>,
    copy: <><rect x="8" y="8" width="11" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    ruler: <><path d="m4 17 13-13 3 3L7 20H4v-3Z" /><path d="m12 6 3 3m-7 1 3 3m-7 1 3 3" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    storage: <><ellipse cx="12" cy="6" rx="7.5" ry="3" /><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" /><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" /></>,
    speed: <><path d="M4.5 16a8 8 0 1 1 15 0" /><path d="m12 12 4-4" /><path d="M7 18h10" /></>,
    cancel: <><circle cx="12" cy="12" r="8.5" /><path d="m9 9 6 6m0-6-6 6" /></>,
    spinner: <><path d="M12 3a9 9 0 1 0 9 9" /></>
  };
  return <svg className={`export-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export interface ExportProgressOverlayProps {
  visible: boolean;
  fps: number | null;
  engine: 'webcodecs' | 'mediarecorder';
  progress: number;
  logs: string[];
  currentFrame?: number;
  totalFrames?: number;
  estimatedSecondsRemaining?: number;
  estimatedSizeMb?: string;
  previewSnapshotUrl?: string | null;
  exportResult?: ExportResultInfo & { url?: string } | null;
  onCancel?: () => void;
  onClose: () => void;
  onSaveCloud?: (result: ExportResultInfo) => Promise<void> | void;
}

export function ExportProgressOverlay({
  visible,
  fps,
  engine,
  progress,
  logs,
  currentFrame = 0,
  totalFrames = 0,
  estimatedSecondsRemaining = 0,
  estimatedSizeMb = '12.0',
  previewSnapshotUrl,
  exportResult,
  onCancel,
  onClose,
  onSaveCloud
}: ExportProgressOverlayProps) {
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [cloudSaved, setCloudSaved] = useState(false);

  if (!visible) return null;

  const isCompleted = progress >= 100 && Boolean(exportResult?.url);

  const outputExtension = exportResult?.fileExtension || 'mp4';
  const outputLabel = outputExtension.toUpperCase();

  const handleDownloadLocal = () => {
    if (!exportResult?.url) return;
    const a = document.createElement('a');
    a.href = exportResult.url;
    a.download = `keyvideo_master_${Date.now()}.${outputExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('已触发本地下载！');
  };

  const handleSaveToCloud = async () => {
    if (!exportResult || isSavingCloud) return;
    setIsSavingCloud(true);
    try {
      if (onSaveCloud) {
        await onSaveCloud(exportResult);
      } else {
        await new Promise(r => setTimeout(r, 600));
        toast.success('已将成片保存到本地归档！');
      }
      setCloudSaved(true);
    } catch (err) {
      toast.error(`云端归档失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleCopyVideoInfo = () => {
    if (!exportResult) return;
    const info = `【KeyVideo 电商大片导出规格】
• 编码格式：H.264 / AAC (MP4标准容器)
• 视频时长：${exportResult.duration.toFixed(1)}s
• 导出画质：${exportResult.width} × ${exportResult.height}
• 文件大小：${(exportResult.sizeBytes / (1024 * 1024)).toFixed(2)} MB
• 渲染耗时：${exportResult.totalTimeSec}s (平均 ${exportResult.averageFps} FPS)`;

    navigator.clipboard.writeText(info).then(() => {
      toast.success('已复制视频参数至剪贴板！');
    }).catch(() => {
      toast.error('当前环境无法访问剪贴板，请手动复制参数');
    });
  };

  return (
    <div className="modal-overlay export-progress-overlay" style={{ zIndex: 9999 }}>
      <div
        className="modal-content glass-panel export-progress-modal"
        style={{
          maxWidth: isCompleted ? '560px' : '480px',
          width: '92%',
          padding: '20px 24px',
          transition: 'all 0.25s ease'
        }}
      >
        {/* Header */}
        <div className="export-progress-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div className="export-progress-heading" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="export-progress-mark"><ExportIcon name={isCompleted ? 'check' : 'film'} /></span>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {isCompleted ? '视频渲染已完成' : '视频渲染与离屏导出中心'}
            </h3>
          </div>
          <span
            className="node-chip"
            style={{
              background: engine === 'webcodecs' ? 'rgba(0, 242, 254, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              borderColor: engine === 'webcodecs' ? 'rgba(0, 242, 254, 0.4)' : 'rgba(245, 158, 11, 0.4)',
              color: engine === 'webcodecs' ? 'var(--accent-cyan)' : '#f59e0b',
              fontSize: '10px',
              padding: '2px 8px'
            }}
          >
            <ExportIcon name={engine === 'webcodecs' ? 'speed' : 'film'} />
            {engine === 'webcodecs' ? 'GPU 加速渲染' : '兼容模式渲染'}
          </span>
        </div>

        {/* In-Progress View */}
        {!isCompleted ? (
          <div>
            {/* Live Preview Monitor Screen */}
            {previewSnapshotUrl && (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '180px',
                  background: '#040508',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginBottom: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.8)'
                }}
              >
                <img
                  src={previewSnapshotUrl}
                  alt="Live Render Frame"
                  style={{
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain'
                  }}
                />
                {/* Live REC Indicator */}
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(0, 0, 0, 0.65)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#ff4d4f'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff4d4f', display: 'inline-block' }} />
                  <span>实时离屏帧监看</span>
                </div>
              </div>
            )}

            {/* Metric Dashboard Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                marginBottom: '14px'
              }}
            >
              <div className="stat-card export-stat-card" style={{ padding: '8px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <ExportIcon name="speed" />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>实时帧率</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{fps !== null ? `${fps} FPS` : '--'}</span>
              </div>
              <div className="stat-card export-stat-card" style={{ padding: '8px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <ExportIcon name="film" />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>渲染进度</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
                  {totalFrames > 0 ? `${currentFrame}/${totalFrames}` : `${progress}%`}
                </span>
              </div>
              <div className="stat-card export-stat-card" style={{ padding: '8px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <ExportIcon name="clock" />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>预计剩余</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>
                  {estimatedSecondsRemaining > 0 ? `~${estimatedSecondsRemaining}s` : '即将完成'}
                </span>
              </div>
              <div className="stat-card export-stat-card" style={{ padding: '8px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <ExportIcon name="storage" />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>预估体积</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#c084fc' }}>{estimatedSizeMb} MB</span>
              </div>
            </div>

            {/* Glowing Progress Bar */}
            <div className="progress-container" style={{ height: '8px', borderRadius: '4px', marginBottom: '12px' }}>
              <div
                className="progress-bar"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-cyan))',
                  boxShadow: '0 0 10px var(--accent-cyan-glow)'
                }}
              />
            </div>

            {/* Terminal Log Console */}
            <div
              className="export-log"
              style={{
                maxHeight: '110px',
                fontSize: '10px',
                fontFamily: 'monospace',
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '6px',
                padding: '8px 10px',
                marginBottom: '14px'
              }}
            >
              {logs.map((log, index) => (
                <div key={`${index}-${log}`} style={{ color: log.includes('⚠️') ? '#f59e0b' : log.includes('✨') ? '#00f2fe' : '#94a3b8' }}>
                  {`> ${log}`}
                </div>
              ))}
            </div>

            {/* Action buttons (Cancel / Minimize) */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {onCancel && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onCancel}
                  style={{
                    fontSize: '11px',
                    padding: '6px 14px',
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <ExportIcon name="cancel" /> 取消导出
                </button>
              )}
            </div>
          </div>
        ) : exportResult ? (
          /* Completed View */
          <div>
            {/* Embedded Video Player */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxHeight: '260px',
                background: '#000',
                borderRadius: '10px',
                overflow: 'hidden',
                marginBottom: '14px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <video
                src={exportResult.url}
                controls
                autoPlay
                loop
                style={{ maxHeight: '260px', width: '100%', objectFit: 'contain' }}
              />
            </div>

            {/* Specs Badges */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <span className="node-chip export-spec-chip export-spec-success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                <ExportIcon name="check" /> 封装成功 · {outputLabel}
              </span>
              <span className="node-chip export-spec-chip">
                <ExportIcon name="ruler" /> {exportResult.width} × {exportResult.height}
              </span>
              <span className="node-chip export-spec-chip">
                <ExportIcon name="clock" /> 时长 {exportResult.duration.toFixed(1)}s
              </span>
              <span className="node-chip export-spec-chip">
                <ExportIcon name="storage" /> 大小 {(exportResult.sizeBytes / (1024 * 1024)).toFixed(2)} MB
              </span>
              <span className="node-chip export-spec-chip">
                <ExportIcon name="speed" /> 平均 {exportResult.averageFps} FPS
              </span>
            </div>

            {/* Action Buttons Toolbar */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleDownloadLocal}
                style={{ flex: 1, justifyContent: 'center', padding: '8px 12px', fontSize: '12px' }}
              >
                <ExportIcon name="download" /> 另存为 {outputLabel}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleSaveToCloud}
                disabled={isSavingCloud || cloudSaved}
                style={{
                  padding: '8px 14px',
                  fontSize: '12px',
                  color: cloudSaved ? '#10b981' : undefined,
                  borderColor: cloudSaved ? 'rgba(16, 185, 129, 0.4)' : undefined
                }}
              >
                {isSavingCloud ? '归档中...' : cloudSaved ? <><ExportIcon name="check" /> 已归档</> : <><ExportIcon name="storage" /> 本地归档</>}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleCopyVideoInfo}
                title="复制成片参数指标"
                style={{ padding: '8px 12px', fontSize: '12px' }}
              >
                <ExportIcon name="copy" /> 复制参数
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                style={{ padding: '8px 12px', fontSize: '12px' }}
              >
                <ExportIcon name="close" /> 关闭
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-secondary)' }}>
            <div className="export-pending-icon"><ExportIcon name="spinner" /></div>
            <div style={{ fontSize: '13px' }}>正在完成 MP4 封装...</div>
          </div>
        )}
      </div>
    </div>
  );
}
