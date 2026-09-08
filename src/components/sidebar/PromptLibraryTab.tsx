import React, { useState, useMemo } from 'react';
import { PROMPT_LIBRARY, PROMPT_CATEGORIES } from '../../config/promptLibraryData';
import type { PromptItem } from '../../config/promptLibraryData';
import { toast } from '../toastStore';
import type { Layer } from '../VideoCanvas';
import {
  resolvePromptVariables,
  interpolatePromptVariables,
  type PromptVariableContext
} from '../../utils/promptVariableInterpolator';
import {
  PromptInjectModal,
  type InjectionTarget,
  type InjectionMode
} from './ai/PromptInjectModal';

interface PromptLibraryTabProps {
  onApplyPrompt?: (promptText: string) => void;
  onAddTextLayer?: (text: string) => void;
  layers?: Layer[];
  setLayers?: React.Dispatch<React.SetStateAction<Layer[]>>;
  setSelectedLayerId?: (id: string | null) => void;
  variableContext?: PromptVariableContext;
  currentMasterPrompt?: string;
  onInjectToStoryboard?: (params: {
    target: InjectionTarget;
    mode: InjectionMode;
    text: string;
    navigateToStoryboard?: boolean;
  }) => void;
  onNavigateToStoryboard?: () => void;
}

export const PromptLibraryTab: React.FC<PromptLibraryTabProps> = ({
  onApplyPrompt,
  onAddTextLayer,
  setLayers,
  setSelectedLayerId,
  variableContext = {},
  currentMasterPrompt = '',
  onInjectToStoryboard,
  onNavigateToStoryboard
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showVariableBar, setShowVariableBar] = useState(false);
  const [previewWithVariables, setPreviewWithVariables] = useState(true);
  const [injectModalItem, setInjectModalItem] = useState<PromptItem | null>(null);

  // Extract resolved variables from active project state
  const variables = useMemo(() => resolvePromptVariables(variableContext), [variableContext]);

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
    const textToCopy = previewWithVariables && item.hasVariables
      ? interpolatePromptVariables(item.content, variables)
      : item.content;
    navigator.clipboard.writeText(textToCopy);
    toast.success(`已复制「${item.title}」提示词`);
  };

  const handleCreateTextLayer = (item: PromptItem) => {
    const textToUse = previewWithVariables && item.hasVariables
      ? interpolatePromptVariables(item.content, variables)
      : item.content;

    if (onAddTextLayer) {
      onAddTextLayer(textToUse);
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
          text: textToUse,
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

  const handleOpenInjectModal = (item: PromptItem) => {
    if (onInjectToStoryboard) {
      setInjectModalItem(item);
    } else if (onApplyPrompt) {
      const textToUse = previewWithVariables && item.hasVariables
        ? interpolatePromptVariables(item.content, variables)
        : item.content;
      onApplyPrompt(textToUse);
      toast.success(`已应用「${item.title}」至分镜设定`);
    } else {
      handleCopy(item);
    }
  };

  return (
    <>
      {/* Standard App Drawer Header */}
      <div className="drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div className="drawer-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✨</span>
            <span>电商灵感与提示词库</span>
          </div>
          {onNavigateToStoryboard && (
            <button
              type="button"
              onClick={onNavigateToStoryboard}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(124, 58, 237, 0.15)',
                border: '1px solid rgba(124, 58, 237, 0.4)',
                color: '#c084fc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="跳转至 5 幕分镜故事板向导"
            >
              <span>🎬 分镜向导</span>
              <span>→</span>
            </button>
          )}
        </div>
        <div className="drawer-subtitle">
          沉淀镜头运镜、高级光影、前3秒吸睛钩子与面料质感，一键定向注入分镜。
        </div>
      </div>

      {/* Standard App Drawer Content */}
      <div className="drawer-content" style={{ padding: '16px', gap: '10px' }}>
        {/* Search Bar & Variable Preview Switch */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索运镜、光影、文案钩子..."
              className="text-input"
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                borderRadius: '8px',
                fontSize: '12px',
                boxSizing: 'border-box'
              }}
            />
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6, fontSize: '12px' }}>
              🔍
            </span>
          </div>

          {/* Toggle Dynamic Variable Bar */}
          <button
            type="button"
            onClick={() => setShowVariableBar(prev => !prev)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: showVariableBar ? '1px solid #00f2fe' : '1px solid var(--border-color)',
              background: showVariableBar ? 'rgba(0, 242, 254, 0.12)' : 'var(--bg-element)',
              color: showVariableBar ? '#00f2fe' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="查看并管理当前项目解析变量（模特、品类、光影、运镜）"
          >
            <span>⚡ 变量</span>
          </button>
        </div>

        {/* Dynamic Variables Chips Drawer */}
        {showVariableBar && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(20, 24, 40, 0.95), rgba(15, 17, 28, 0.95))',
              border: '1px solid rgba(0, 242, 254, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              animation: 'fadeIn 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>⚡ 当前项目智能变量解析</span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewWithVariables(prev => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: previewWithVariables ? '#c084fc' : '#94a3b8',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {previewWithVariables ? '● 词库显示已填充变量' : '○ 词库显示原始 {占位符}'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              {variables.map(v => (
                <div
                  key={v.key}
                  style={{
                    padding: '4px 6px',
                    borderRadius: '5px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8' }}>
                    <span>{v.icon}</span>
                    <span style={{ fontFamily: 'var(--mono, monospace)', color: '#00f2fe' }}>{`{${v.key}}`}</span>
                    <span>({v.label})</span>
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#e2e8f0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={v.value}
                  >
                    {v.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories Filter Tabs */}
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
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '2px' }}>
          {filteredItems.map(item => {
            const displayContent = previewWithVariables && item.hasVariables
              ? interpolatePromptVariables(item.content, variables)
              : item.content;

            return (
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
                {/* Header: Title & Recommended Target Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.4' }}>
                    {item.title}
                  </div>
                  {item.hasVariables && (
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: 'rgba(0, 242, 254, 0.12)',
                        border: '1px solid rgba(0, 242, 254, 0.3)',
                        color: '#00f2fe',
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                      }}
                      title="包含动态项目变量"
                    >
                      ⚡ 智能变量
                    </span>
                  )}
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
                  {item.recommendedShot && (
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-muted, #94a3b8)',
                        border: '1px solid var(--border-color)',
                        fontWeight: 500
                      }}
                    >
                      🎯 建议：{item.recommendedShot.replace('shot-', '分镜')}
                    </span>
                  )}
                </div>

                {/* Chinese Description */}
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {item.description}
                </p>

                {/* Prompt Snippet Box */}
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
                    maxHeight: '65px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    wordBreak: 'break-word'
                  }}
                  title={displayContent}
                >
                  {displayContent}
                </div>

                {/* Action buttons row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: item.targetType === 'both' ? 'auto auto 1fr' : 'auto 1fr',
                    gap: '6px',
                    marginTop: '2px',
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
                    title="复制提示词文本到剪贴板"
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
                    onClick={() => handleOpenInjectModal(item)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      margin: 0,
                      height: '28px',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      minWidth: 0,
                      background: 'linear-gradient(135deg, #7c3aed 0%, #00f2fe 100%)',
                      boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)'
                    }}
                    title="精准选择注入到具体分镜 (0-3s, 3-6s, 6-9s, 9-12s, 12-15s)"
                  >
                    <span>⚡</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      注入分镜
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Directed Injection Modal */}
      {injectModalItem && (
        <PromptInjectModal
          isOpen={!!injectModalItem}
          onClose={() => setInjectModalItem(null)}
          item={injectModalItem}
          variableContext={variableContext}
          currentMasterPrompt={currentMasterPrompt}
          onConfirmInject={params => {
            if (onInjectToStoryboard) {
              onInjectToStoryboard(params);
            }
          }}
        />
      )}
    </>
  );
};
