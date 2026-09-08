import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { QueueShotTask } from '../../../hooks/useBatchVideoQueue';

interface VideoTaskBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: QueueShotTask[];
  onRetryShot: (shotId: string) => void;
  onApplyAllToTimeline: () => void;
  isBatchGenerating: boolean;
}

export const VideoTaskBoardModal: React.FC<VideoTaskBoardModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onRetryShot,
  onApplyAllToTimeline,
  isBatchGenerating,
}) => {
  const [previewingVideoUrl, setPreviewingVideoUrl] = useState<{ name: string; url: string } | null>(null);

  if (!isOpen) return null;

  const total = tasks.length || 5;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const processing = tasks.filter(t => t.status === 'processing' || t.status === 'submitting').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const progressPercent = Math.round((completed / total) * 100);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 13, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          backgroundColor: '#0d101d',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(168, 85, 247, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.08), transparent)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🚀</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                5幕分镜后台批量生成看板
                {isBatchGenerating ? (
                  <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', background: 'rgba(0, 242, 254, 0.12)', border: '1px solid rgba(0, 242, 254, 0.3)', padding: '2px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-cyan)', animation: 'pulse 1.5s infinite' }} />
                    {processing} 幕并发渲染中
                  </span>
                ) : completed === total && total > 0 ? (
                  <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '2px 8px', borderRadius: '12px' }}>
                    ✓ 5幕已全部就绪
                  </span>
                ) : null}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                服务端低频守护轮询中，断网或刷新仍持续追踪成片结果
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: '#94a3b8',
              fontSize: '14px',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '8px',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={e => (e.currentTarget.style.color = '#fff')}
            onMouseOut={e => (e.currentTarget.style.color = '#94a3b8')}
          >
            ✕
          </button>
        </div>

        {/* Global Stats & Quick Timeline Action */}
        <div
          style={{
            padding: '12px 22px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <span>队列综合完成度: {completed} / {total} 幕 ({progressPercent}%)</span>
              {failed > 0 && <span style={{ color: '#ef4444' }}>{failed} 幕生成异常</span>}
            </div>
            <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, var(--accent-cyan), #a855f7)',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease-out'
                }}
              />
            </div>
          </div>

          {completed > 0 && (
            <button
              type="button"
              className="btn-primary"
              onClick={onApplyAllToTimeline}
              style={{
                fontSize: '12px',
                padding: '8px 16px',
                borderRadius: '8px',
                gap: '6px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              🎬 一键导入 {completed} 个成片至时间轴
            </button>
          )}
        </div>

        {/* Tasks List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tasks.map((task) => {
            const isDone = task.status === 'completed' && Boolean(task.resultUrl);
            const isRunning = task.status === 'processing' || task.status === 'submitting';
            const isError = task.status === 'failed';

            return (
              <div
                key={task.shotId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  background: isDone
                    ? 'rgba(16, 185, 129, 0.04)'
                    : isRunning
                    ? 'rgba(0, 242, 254, 0.04)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: isDone
                    ? '1px solid rgba(16, 185, 129, 0.25)'
                    : isRunning
                    ? '1px solid rgba(0, 242, 254, 0.3)'
                    : isError
                    ? '1px solid rgba(239, 68, 68, 0.3)'
                    : '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Shot Number Badge */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: isDone
                      ? 'rgba(16, 185, 129, 0.2)'
                      : isRunning
                      ? 'rgba(0, 242, 254, 0.2)'
                      : 'rgba(255, 255, 255, 0.08)',
                    color: isDone ? '#10b981' : isRunning ? 'var(--accent-cyan)' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0
                  }}
                >
                  0{task.shotIndex}
                </div>

                {/* Thumbnail */}
                <div
                  style={{
                    width: '64px',
                    height: '48px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    background: '#04050a',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    position: 'relative',
                    flexShrink: 0,
                    cursor: isDone ? 'pointer' : 'default'
                  }}
                  onClick={() => {
                    if (isDone && task.resultUrl) {
                      setPreviewingVideoUrl({ name: task.shotName, url: task.resultUrl });
                    }
                  }}
                >
                  {task.imageSrc ? (
                    <img src={task.imageSrc} alt={task.shotName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', fontSize: '16px' }}>
                      🎬
                    </div>
                  )}

                  {isDone && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '14px'
                      }}
                    >
                      ▶
                    </div>
                  )}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                      {task.shotName}
                    </span>
                    {task.taskId && (
                      <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                        #{task.taskId.slice(-8)}
                      </span>
                    )}
                  </div>

                  {/* Status & Progress */}
                  {isRunning ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--accent-cyan)', marginBottom: '3px' }}>
                        <span>⚡ Kling 3.0 深度合成中...</span>
                        <span>{task.progress}%</span>
                      </div>
                      <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${task.progress}%`,
                            background: 'var(--accent-cyan)',
                            borderRadius: '2px',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                  ) : isDone ? (
                    <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>✓</span> 视频生成完成，随时可导入播放
                    </div>
                  ) : isError ? (
                    <div style={{ fontSize: '11px', color: '#ef4444' }}>
                      ⚠️ {task.error || '生成失败，可点击右侧重试'}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      待生成（准备就绪）
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {isDone && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setPreviewingVideoUrl({ name: task.shotName, url: task.resultUrl! })}
                      style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px' }}
                    >
                      ▶ 试看
                    </button>
                  )}

                  {(isError || isDone) && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => onRetryShot(task.shotId)}
                      title="重新生成当前镜头"
                      style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px' }}
                    >
                      🔄 重试
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Inline Video Preview Player Modal */}
        {previewingVideoUrl && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.92)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '520px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                🎬 预览: {previewingVideoUrl.name}
              </span>
              <button
                type="button"
                onClick={() => setPreviewingVideoUrl(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>
            <div style={{ width: '100%', maxWidth: '520px', maxHeight: '360px', background: '#000', borderRadius: '10px', overflow: 'hidden' }}>
              <video src={previewingVideoUrl.url} controls autoPlay loop style={{ width: '100%', height: '100%', maxHeight: '360px', objectFit: 'contain' }} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.2)'
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            💡 提示：视频在后台服务中持久化生成，即使离开当前页面亦不会中断。
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ fontSize: '12px', padding: '6px 16px', borderRadius: '6px' }}
          >
            关闭看板
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
