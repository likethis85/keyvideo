import React, { useRef, useState } from 'react';
import type { CanvasNodeData } from '../../../types/canvas';
import { BaseNode } from './BaseNode';

interface VideoNodeProps {
  node: CanvasNodeData;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<CanvasNodeData>) => void;
  onStartConnect: (fromHandle: string) => void;
  onEndConnect: (toHandle: string) => void;
  onAddToTimeline?: (node: CanvasNodeData) => void;
}

export const VideoNode: React.FC<VideoNodeProps> = ({
  node,
  isSelected,
  onSelect,
  onDelete,
  onStartConnect,
  onEndConnect,
  onAddToTimeline
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const videoSrc = node.metadata.videoSrc;
  const imageSrc = node.metadata.imageSrc;

  return (
    <>
      <BaseNode
        node={node}
        isSelected={isSelected}
        onSelect={onSelect}
        onDelete={onDelete}
        onStartConnect={onStartConnect}
        onEndConnect={onEndConnect}
        headerIcon={<span style={{ fontSize: '14px' }}>🎬</span>}
        extraHeaderActions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {videoSrc && (
              <button
                className="node-tool-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPreviewModalOpen(true);
                }}
                title="全屏大图预览视频"
                style={{
                  padding: '2px 6px',
                  fontSize: '11px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                🔍 全览
              </button>
            )}
            {videoSrc && onAddToTimeline && (
              <button
                className="node-action-pill-btn"
                onClick={() => onAddToTimeline(node)}
                title="将该视频片段作为图层插入当前时间轴"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                + 时间轴
              </button>
            )}
          </div>
        }
      >
        <div className="video-node-content">
          {videoSrc ? (
            <div className="node-video-container" onClick={togglePlay} style={{ position: 'relative', background: '#000' }}>
              <video
                ref={videoRef}
                src={videoSrc}
                className="node-media-preview"
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                loop
                muted
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              <div className="node-video-play-overlay">
                <span>{isPlaying ? '⏸' : '▶'}</span>
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: '6px',
                  left: '6px',
                  fontSize: '9px',
                  background: 'rgba(0, 0, 0, 0.65)',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  color: '#00f2fe',
                  border: '1px solid rgba(0, 242, 254, 0.3)',
                  pointerEvents: 'none'
                }}
              >
                ⛶ 完整画幅
              </div>
            </div>
          ) : imageSrc ? (
            <div className="node-image-preview-container" style={{ position: 'relative', background: '#000' }}>
              <img
                src={imageSrc}
                alt="首帧分镜"
                className="node-media-preview"
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
              />
              <div className="node-video-pending-badge">
                <span>分镜底图就绪</span>
              </div>
            </div>
          ) : (
            <div className="node-upload-placeholder">
              <div className="upload-icon">🎥</div>
              <span>等待生成视频</span>
              <small>连接上游分镜或图片节点</small>
            </div>
          )}

          <div className="node-meta-chips" style={{ marginTop: '8px' }}>
            <span className="node-chip duration">
              ⏱ {node.metadata.duration || '3s'}
            </span>
            {node.metadata.shotType && (
              <span className="node-chip shot">
                {node.metadata.shotType}
              </span>
            )}
          </div>
        </div>
      </BaseNode>

      {/* Full Preview Lightbox Modal */}
      {isPreviewModalOpen && videoSrc && (
        <div
          className="canvas-modal-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setIsPreviewModalOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '85vh',
              background: '#12141c',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '12px', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, color: '#fff', fontSize: '15px' }}>
                🎬 {node.title} · 100% 完整原画预览
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: '22px',
                  cursor: 'pointer',
                  padding: '0 6px',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <video
              src={videoSrc}
              controls
              autoPlay
              loop
              playsInline
              style={{
                maxWidth: '80vw',
                maxHeight: '70vh',
                borderRadius: '8px',
                objectFit: 'contain',
                background: '#000'
              }}
            />

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              {onAddToTimeline && (
                <button
                  className="node-action-pill-btn"
                  onClick={() => {
                    onAddToTimeline(node);
                    setIsPreviewModalOpen(false);
                  }}
                  style={{ padding: '6px 16px', fontSize: '13px' }}
                >
                  + 将该片段加入时间轴
                </button>
              )}
              <a
                href={videoSrc}
                download={`${node.title || 'video'}.mp4`}
                className="toolbar-pill-btn secondary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 14px' }}
              >
                ⬇ 下载原视频
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
