import React, { useState } from 'react';
import { PROMPT_LIBRARY, PROMPT_CATEGORIES } from '../../config/promptLibraryData';
import type { PromptItem } from '../../config/promptLibraryData';
import { toast } from '../toastStore';
import type { Layer } from '../VideoCanvas';

interface PromptLibraryTabProps {
  onApplyPrompt?: (promptText: string) => void;
  onAddTextLayer?: (text: string) => void;
  layers?: Layer[];
  setLayers?: React.Dispatch<React.SetStateAction<Layer[]>>;
  setSelectedLayerId?: (id: string | null) => void;
}

export const PromptLibraryTab: React.FC<PromptLibraryTabProps> = ({
  onApplyPrompt,
  onAddTextLayer,
  setLayers,
  setSelectedLayerId
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = PROMPT_LIBRARY.filter(item => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleCopy = (item: PromptItem) => {
    navigator.clipboard.writeText(item.content);
    toast.success(`已复制「${item.title}」提示词`);
  };

  const handleApplyToPrompt = (item: PromptItem) => {
    if (onApplyPrompt) {
      onApplyPrompt(item.content);
      toast.success(`已将「${item.title}」追加到当前提示词`);
    } else {
      handleCopy(item);
    }
  };

  const handleCreateTextLayer = (item: PromptItem) => {
    if (onAddTextLayer) {
      onAddTextLayer(item.content);
      toast.success(`已新建文案图层：「${item.title}」`);
      return;
    }

    if (setLayers) {
      const id = `text_${Date.now()}`;
      const newLayer: Layer = {
        id,
        type: 'text',
        name: item.title,
        start: 0,
        end: 5,
        visible: true,
        x: 50,
        y: 80,
        scale: 1,
        opacity: 1,
        properties: {
          text: item.content,
          fontSize: 28,
          color: '#ffffff',
          animation: 'fade',
          bold: true,
          shadow: true
        }
      };
      setLayers(prev => [...prev, newLayer]);
      if (setSelectedLayerId) setSelectedLayerId(id);
      toast.success(`已在画板创建「${item.title}」文案图层`);
    }
  };

  return (
    <>

      {/* Standard App Drawer Header */}
      <div className="drawer-header">
        <div className="drawer-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>✨</span>
          <span>电商灵感与提示词库</span>
        </div>
        <div className="drawer-subtitle">
          沉淀镜头运镜、高级光影、前3秒吸睛钩子与面料质感，一键直达创作。
        </div>
      </div>

      {/* Standard App Drawer Content */}
      <div className="drawer-content" style={{ padding: '16px', gap: '12px' }}>
        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索运镜、光影、文案钩子..."
            className="text-input"
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: '8px',
              fontSize: '12px',
              boxSizing: 'border-box'
            }}
          />
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6, fontSize: '13px' }}>
            🔍
          </span>
        </div>

        {/* Categories Filter Tabs (Multi-line wrap so all tabs are 100% visible) */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            paddingBottom: '2px'
          }}
        >
          {PROMPT_CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--accent-purple)' : 'var(--border-color)',
                  background: isActive ? 'var(--accent-purple)' : 'var(--bg-element)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 2px 8px rgba(124, 58, 237, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Prompts Cards List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '2px' }}>
          {filteredItems.map(item => (
            <div
              key={item.id}
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--bg-surface-solid, var(--card-bg))',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--glass-shadow, 0 2px 8px rgba(0, 0, 0, 0.08))',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'border-color 0.2s ease, transform 0.15s ease'
              }}
            >
              {/* Title on top line - full width to never wrap awkwardly */}
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.4' }}>
                {item.title}
              </div>

              {/* Tags row */}
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {item.tags.map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '10px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: 'rgba(138, 43, 226, 0.15)',
                      color: 'var(--accent-purple, #a855f7)',
                      border: '1px solid rgba(138, 43, 226, 0.3)',
                      fontWeight: 500
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Chinese Description */}
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {item.description}
              </p>

              {/* English Prompt snippet box - super crisp & legible in both light and dark modes */}
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-element)',
                  border: '1px solid var(--border-color)',
                  fontSize: '11px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--mono, monospace)',
                  lineHeight: '1.5',
                  maxHeight: '56px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  wordBreak: 'break-word'
                }}
              >
                {item.content}
              </div>

              {/* Action buttons row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: item.targetType === 'both' ? 'auto auto 1fr' : 'auto 1fr',
                  gap: '6px',
                  marginTop: '4px',
                  alignItems: 'center'
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleCopy(item)}
                  style={{
                    padding: '4px 9px',
                    fontSize: '11px',
                    fontWeight: 500,
                    margin: 0,
                    height: '28px',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  title="复制文案内容到剪贴板"
                >
                  <span>📋</span>
                  <span>复制</span>
                </button>

                {item.targetType === 'both' && (
                  <button
                    type="button"
                    onClick={() => handleCreateTextLayer(item)}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '8px',
                      border: '1px solid rgba(2, 132, 199, 0.35)',
                      background: 'rgba(2, 132, 199, 0.12)',
                      color: 'var(--accent-cyan, #0284c7)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      height: '28px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.background = 'rgba(2, 132, 199, 0.22)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = 'rgba(2, 132, 199, 0.12)';
                    }}
                    title="添加此文案为画布卖点文字图层"
                  >
                    <span>📝</span>
                    <span>文字层</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleApplyToPrompt(item)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    margin: 0,
                    height: '28px',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title="填入当前分镜提示词输入框"
                >
                  <span>⚡</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.targetType === 'both' ? '应用' : '应用到提示词'}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
