import React from 'react';
import { createPortal } from 'react-dom';
import { formatFileName } from '../../utils/formatUtils';

export interface ModelItem {
  id: string;
  src: string;
  name: string;
}

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  swapModelUrl: string;
  setSwapModelUrl: (url: string) => void;
  modelLibrary: ModelItem[];
  onGoToMedia: () => void;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  swapModelUrl,
  setSwapModelUrl,
  modelLibrary,
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
          width: '480px',
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
            👤 选择试衣参考模特
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
            点击选择试衣参考模特肖像对齐参考：
          </span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              maxHeight: '360px',
              overflowY: 'auto',
              padding: '4px'
            }}
          >
            {/* Default Model */}
            {(() => {
              const isActive = swapModelUrl === '/clothing_model.png';
              return (
                <div
                  onClick={() => {
                    setSwapModelUrl('/clothing_model.png');
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
                  <div style={{ width: '100%', aspectRatio: '1/1', background: 'url(/clothing_model.png) center/cover', borderRadius: '6px' }} />
                  <span style={{ fontSize: '10px', fontWeight: '500', color: isActive ? 'var(--accent-cyan)' : '#d1d5db', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    默认风衣模特
                  </span>
                </div>
              );
            })()}

            {/* Library Models */}
            {modelLibrary.map((model) => {
              const isActive = swapModelUrl === model.src;
              return (
                <div
                  key={model.id}
                  onClick={() => {
                    setSwapModelUrl(model.src);
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
                  <div style={{ width: '100%', aspectRatio: '1/1', background: `url(${model.src}) center/cover`, borderRadius: '6px' }} />
                  <span style={{ fontSize: '10px', fontWeight: '500', color: isActive ? 'var(--accent-cyan)' : '#d1d5db', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }} title={model.name}>
                    {formatFileName(model.name)}
                  </span>
                </div>
              );
            })}
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
            ⚙️ 前往素材库管理模特
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
