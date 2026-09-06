import React from 'react';

interface StickerTabProps {
  addStickerLayer: (text: string, style: 'purple' | 'gold' | 'cyan' | 'red') => void;
  addBrandLogoStickerLayer: () => void;
}

export const StickerTab: React.FC<StickerTabProps> = ({ addStickerLayer, addBrandLogoStickerLayer }) => {
  return (
    <>
      <div className="drawer-header">
        <div className="drawer-title">电商氛围贴纸</div>
        <div className="drawer-subtitle">内置服装大促常用角标贴纸</div>
      </div>
      <div className="drawer-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="sticker-item" style={{ background: 'linear-gradient(to right, #8a2be2, #ff007f)' }} onClick={() => addStickerLayer('新品推荐', 'purple')}>新品推荐 🟣</div>
        <div className="sticker-item" style={{ background: 'linear-gradient(to right, #ffb703, #fb8500)', color: '#090a0f' }} onClick={() => addStickerLayer('爆款直降', 'gold')}>爆款直降 🟡</div>
        <div className="sticker-item" style={{ background: 'linear-gradient(to right, #00f2fe, #4facfe)', color: '#090a0f' }} onClick={() => addStickerLayer('极速发货', 'cyan')}>极速发货 🔵</div>
        <div className="sticker-item" style={{ background: 'linear-gradient(to right, #ff007f, #ff5252)' }} onClick={() => addStickerLayer('限时立减', 'red')}>限时立减 🔴</div>
        <div className="sticker-item" style={{ background: 'linear-gradient(to right, #243b55, #141e30)', border: '1px solid rgba(255, 255, 255, 0.1)' }} onClick={() => addBrandLogoStickerLayer()}>品牌 LOGO 🏷️</div>
      </div>
    </>
  );
};
