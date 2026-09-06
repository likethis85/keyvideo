import { createPortal } from 'react-dom';
import type { StoryboardItem } from '../../../types/aiProject';

export interface PreviewVideoState { id: string; src: string; name: string }

interface VideoPreviewModalProps {
  preview: PreviewVideoState | null;
  storyboards: StoryboardItem[];
  onClose: () => void;
  onUpload: (id: string, file: File) => void | Promise<void>;
  onRedownload: (id: string, taskId: string) => void | Promise<void>;
  onRegenerate: (id: string) => void | Promise<void>;
}

const actionStyle = { padding: '8px 16px', fontSize: '12px', borderRadius: '4px', color: '#fff', height: '32px' } as const;

export function VideoPreviewModal({ preview, storyboards, onClose, onUpload, onRedownload, onRegenerate }: VideoPreviewModalProps) {
  if (!preview) return null;
  const storyboard = storyboards.find(item => item.id === preview.id);
  const generating = !!storyboard?.isGeneratingVideo;
  const inputId = `manual-video-upload-${preview.id}`;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(9, 10, 15, 0.85)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, animation: 'fadeIn 0.25s ease-out' }} onClick={onClose}>
      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', background: 'rgba(20, 21, 31, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 40px rgba(0, 242, 254, 0.15)', display: 'flex', flexDirection: 'column', gap: '16px', color: '#fff' }} onClick={event => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>🎬 视频分镜预览: {preview.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', background: '#0c0d12', borderRadius: '8px', width: '197px', height: '350px', position: 'relative' }}>
          {generating ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center', color: 'var(--accent-cyan)', height: '100%', padding: '16px' }}>
              <div style={{ border: '3px solid rgba(255,255,255,0.2)', borderTop: '3px solid var(--accent-cyan)', borderRadius: '50%', width: '32px', height: '32px', animation: 'spin 1s linear infinite' }} />
              <strong>视频生成中... {storyboard?.progress}%</strong><small>请稍候，生成的视频将自动替换并播放</small>
            </div>
          ) : preview.src ? (
            <video key={preview.src} src={preview.src} controls autoPlay loop style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}><div style={{ fontSize: '32px' }}>📽️</div><div>暂无视频</div><small>请上传视频，或重新生成</small></div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <input id={inputId} type="file" accept="video/mp4,video/*" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void onUpload(preview.id, file); }} />
          <button className="btn-secondary" onClick={() => document.getElementById(inputId)?.click()} style={actionStyle}>📤 手动上传视频</button>
          {storyboard?.videoTaskId && <button className="btn-secondary" disabled={generating} onClick={() => void onRedownload(preview.id, storyboard.videoTaskId!)} style={{ ...actionStyle, color: 'var(--accent-cyan)', opacity: generating ? 0.6 : 1 }}>📥 再次读取/下载视频</button>}
          <button className="ai-btn" disabled={generating} onClick={() => void onRegenerate(preview.id)} style={{ ...actionStyle, opacity: generating ? 0.6 : 1 }}>{generating ? '⏳ 视频生成中...' : '🔄 重新生成此分镜视频'}</button>
          <button className="btn-secondary" onClick={onClose} style={{ ...actionStyle, padding: '8px 20px' }}>关闭</button>
        </div>
      </div>
    </div>, document.body
  );
}
