import React from 'react';

interface TemplateTabProps {
  applyTemplate: (type: 'beat' | 'split' | 'detail' | 'transition_demo') => void;
}

export const TemplateTab: React.FC<TemplateTabProps> = ({ applyTemplate }) => {
  return (
    <>
      <div className="drawer-header">
        <div className="drawer-title">电商爆款视频模板</div>
        <div className="drawer-subtitle">专为服装类目剪裁，替换素材即可出片</div>
      </div>
      <div className="drawer-content">
        <div className="template-grid">
          <div className="template-card" onClick={() => applyTemplate('beat')}>
            <div className="template-thumb">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2">
                <path d="M12 2v20M17 5v14M7 9v6M22 10v4M2 10v4" />
              </svg>
            </div>
            <div className="template-name">时尚卡点卖点流</div>
          </div>
          <div className="template-card" onClick={() => applyTemplate('split')}>
            <div className="template-thumb">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
            </div>
            <div className="template-name">模特画报风</div>
          </div>
          <div className="template-card" onClick={() => applyTemplate('detail')}>
            <div className="template-thumb">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="template-name">简约细节大图款</div>
          </div>
          <div className="template-card" onClick={() => applyTemplate('transition_demo')}>
            <div className="template-thumb">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2">
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
            <div className="template-name">多片段过渡演示</div>
          </div>
        </div>
      </div>
    </>
  );
};
