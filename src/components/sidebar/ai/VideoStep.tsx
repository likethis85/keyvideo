import React from 'react';
import type { StoryboardItem } from '../../SidebarDrawer';

export interface VideoStepProps {
  storyboards: StoryboardItem[];
  setPreviewVideo: (video: { id: string; src: string; name: string }) => void;
  videoModel: string;
  setVideoModel: (model: string) => void;
  handleGenerateI2V: () => void;
  isI2vGenerating: boolean;
  i2vStep: string;
  handleApplyI2VToTimeline: () => void;
  setAiWizardStep: (step: 1 | 2 | 3) => void;
}

export const VideoStep: React.FC<VideoStepProps> = ({
  storyboards,
  setPreviewVideo,
  videoModel,
  setVideoModel,
  handleGenerateI2V,
  isI2vGenerating,
  i2vStep,
  handleApplyI2VToTimeline,
  setAiWizardStep
}) => {
  return (
    <>
      <div className="property-group" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span className="property-label" style={{ marginBottom: '4px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
          🎥 AI 视频生成与合成
        </span>

        {/* Generated Videos / Status Grid */}
        {storyboards.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-element)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>
              🎬 各分镜视频生成与预览
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {storyboards.map((sb) => (
                <div key={sb.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  <div
                    onMouseOver={(e) => {
                      const overlay = e.currentTarget.querySelector('.storyboard-video-overlay') as HTMLElement;
                      if (overlay) overlay.style.opacity = '1';
                    }}
                    onMouseOut={(e) => {
                      const overlay = e.currentTarget.querySelector('.storyboard-video-overlay') as HTMLElement;
                      if (overlay) overlay.style.opacity = '0';
                    }}
                    style={{
                      width: '100%',
                      height: '56px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid ' + (sb.videoSrc ? 'var(--border-accent)' : 'var(--border-color)'),
                      position: 'relative',
                      background: 'var(--bg-surface-solid)',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setPreviewVideo({ id: sb.id, src: sb.videoSrc || '', name: sb.name });
                    }}
                  >
                    <img src={sb.imageSrc} alt={sb.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: sb.videoSrc ? 0.95 : 0.4 }} />

                    {/* Generating Video Progress Spinner */}
                    {sb.isGeneratingVideo && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', zIndex: 10 }}>
                        <div style={{ border: '2px solid #fff', borderTop: '2px solid var(--accent-cyan)', borderRadius: '50%', width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: '8px', color: '#fff', fontWeight: 'bold' }}>{sb.progress}%</span>
                      </div>
                    )}

                    {/* Play Icon Hover Overlay */}
                    {sb.videoSrc && !sb.isGeneratingVideo && (
                      <div
                        className="storyboard-video-overlay"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          zIndex: 5
                        }}
                      >
                        <span style={{ fontSize: '18px', color: '#fff' }}>▶</span>
                      </div>
                    )}

                    {/* Dynamic Video Badge */}
                    {sb.videoSrc && (
                      <div style={{ position: 'absolute', bottom: '3px', right: '3px', background: '#0f172a', color: '#ffffff', borderRadius: '4px', padding: '1px 5px', fontSize: '9px', fontWeight: '700', zIndex: 2, display: 'flex', alignItems: 'center', gap: '2px', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                        <span style={{ fontSize: '8px' }}>▶</span> 播放
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-primary)', marginTop: '4px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', fontWeight: '700' }} title={sb.name}>
                    {sb.shotType === 'full-body' ? '分镜一' : sb.shotType === 'medium' ? '分镜二' : sb.shotType === 'close-up' ? '分镜三' : sb.shotType === 'shot-1' ? '分镜一' : sb.shotType === 'shot-2' ? '分镜二' : sb.shotType === 'shot-3' ? '分镜三' : sb.shotType === 'shot-4' ? '分镜四' : '分镜五'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Video Model Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>选择图生视频大模型</span>
          <select
            value={videoModel}
            onChange={(e) => {
              setVideoModel(e.target.value);
              localStorage.setItem('ai_video_model', e.target.value);
            }}
            className="text-input"
            style={{ padding: '8px 12px', fontSize: '12px', width: '100%', background: 'var(--bg-surface-solid)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px' }}
          >
            <option value="kling-v3-omni">🎥 kling-v3-omni (快手可灵 v3.0)</option>
            <option value="viduq2">🎥 viduq2 (Vidu 2.0 - 极速推荐)</option>
            <option value="veo-3.1-fast-generate-001">🎥 veo-3.1-fast-generate-001 (Google Veo)</option>
            <option value="MiniMax-Hailuo-2.3">🎥 MiniMax-Hailuo-2.3 (海螺 AI)</option>
          </select>
        </div>

        {/* Video Generation Trigger */}
        <button
          className="btn-primary"
          onClick={handleGenerateI2V}
          style={{
            background: isI2vGenerating ? '#dc2626' : '#0f172a',
            color: '#ffffff',
            border: isI2vGenerating ? '1px solid #dc2626' : '1px solid #0f172a',
            boxShadow: isI2vGenerating ? '0 0 12px rgba(220, 38, 38, 0.4)' : '0 2px 8px rgba(15, 23, 42, 0.18)',
            marginTop: '8px',
            justifyContent: 'center',
            padding: '11px 16px',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            cursor: 'pointer'
          }}
        >
          {isI2vGenerating ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '7px', flexShrink: 0 }}>
              <rect x="4" y="4" width="16" height="16" rx="3" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '7px', flexShrink: 0 }}>
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          )}
          {isI2vGenerating ? '停止生成 (点击中断)' : '一键调用图生视频模型'}
        </button>

        {/* Apply to Timeline */}
        {i2vStep === 'video_generated' && (
          <button
            className="btn-primary"
            onClick={handleApplyI2VToTimeline}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              border: '1px solid #0284c7',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
              fontWeight: '700',
              justifyContent: 'center',
              marginTop: '8px',
              padding: '11px 16px',
              fontSize: '13px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              cursor: 'pointer'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '7px', flexShrink: 0 }}>
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m4 4 3 4" />
              <path d="m9 4 3 4" />
              <path d="m14 4 3 4" />
              <path d="m19 4 3 4" />
              <path d="M2 8h20" />
              <polygon points="10 12 15 15 10 18 10 12" fill="currentColor" stroke="none" />
            </svg>
            一键拼接导入时间轴播放
          </button>
        )}
      </div>

      {/* Next/Prev Navigation */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start', marginTop: '4px' }}>
        <button
          className="btn-secondary"
          onClick={() => setAiWizardStep(2)}
          style={{
            padding: '9px 16px',
            fontSize: '12px',
            cursor: 'pointer',
            borderRadius: '8px',
            width: '100%',
            margin: 0,
            fontWeight: '600',
            background: 'var(--bg-surface-solid)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          上一步：返回场景分镜
        </button>
      </div>
    </>
  );
};
