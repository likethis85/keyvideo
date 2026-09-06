import React from 'react';
import { createPortal } from 'react-dom';
import { formatFileName } from '../../utils/formatUtils';

export interface CustomSceneItem {
  id: string;
  name: string;
  src: string;
}

interface SceneSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelScene: string;
  setModelScene: (scene: string) => void;
  sceneBackgrounds?: Record<string, string>;
  customScenes: CustomSceneItem[];
  onGoToMedia: () => void;
}

export const SceneSelectorModal: React.FC<SceneSelectorModalProps> = ({
  isOpen,
  onClose,
  modelScene,
  setModelScene,
  customScenes,
  onGoToMedia
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(9, 10, 15, 0.8)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          width: '560px',
          maxWidth: '90vw',
          background: 'rgba(20, 21, 31, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🖼️ 选择分镜背景场景
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}
          >
            ×
          </button>
        </div>

        {/* Content Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            选择智能生成场景参考的空间背景：
          </span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              maxHeight: '360px',
              overflowY: 'auto',
              padding: '4px'
            }}
          >
            {/* Custom Scenes */}
            {customScenes.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '32px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                暂无自定义场景。请在「素材」面板中上传或生成专属背景。
              </div>
            ) : (
              customScenes.map((scene) => {
                const isActive = modelScene === scene.id;
                return (
                  <div
                    key={scene.id}
                    onClick={() => {
                      setModelScene(scene.id);
                      onClose();
                    }}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      border: '2px solid ' + (isActive ? 'var(--accent-purple)' : 'rgba(255,255,255,0.08)'),
                      background: isActive ? 'rgba(138, 43, 226, 0.15)' : 'rgba(255,255,255,0.02)',
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ width: '100%', aspectRatio: '16/10', background: `url(${scene.src}) center/cover`, borderRadius: '6px' }} />
                    <span style={{ fontSize: '10px', fontWeight: '500', color: isActive ? 'var(--accent-cyan)' : '#d1d5db', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }} title={scene.name}>
                      🖼️ {formatFileName(scene.name)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '4px' }}>
          <button
            className="btn-secondary"
            onClick={() => {
              onClose();
              onGoToMedia();
            }}
            style={{ padding: '6px 12px', fontSize: '11px', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            ⚙️ 前往素材库管理场景
          </button>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '6px 14px', fontSize: '11px', cursor: 'pointer', margin: 0 }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
