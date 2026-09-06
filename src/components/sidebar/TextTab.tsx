import React from 'react';

interface TextTabProps {
  addTextLayer: (text: string) => void;
}

export const TextTab: React.FC<TextTabProps> = ({ addTextLayer }) => {
  return (
    <>
      <div className="drawer-header">
        <div className="drawer-title">卖点动态字幕</div>
        <div className="drawer-subtitle">选择样式并添加到时间轴</div>
      </div>
      <div className="drawer-content">
        <button className="btn-secondary" onClick={() => addTextLayer('100% 极软新疆棉')} style={{ justifyContent: 'flex-start' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', marginRight: '8px' }}>T</span>
          主标题 - 材质卖点 (纯棉)
        </button>
        <button className="btn-secondary" onClick={() => addTextLayer('显瘦版型 不挑身材')} style={{ justifyContent: 'flex-start' }}>
          <span style={{ fontSize: '16px', marginRight: '8px' }}>T</span>
          主标题 - 版型卖点 (显瘦)
        </button>
        <button className="btn-secondary" onClick={() => addTextLayer('限时大促 立减￥50')} style={{ justifyContent: 'flex-start' }}>
          <span style={{ fontSize: '14px', color: 'var(--accent-cyan)', marginRight: '8px' }}>T</span>
          营销文案 - 促销量级
        </button>
      </div>
    </>
  );
};
