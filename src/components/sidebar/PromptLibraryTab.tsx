import React, { useMemo, useState } from 'react';
import { PROMPT_LIBRARY, PROMPT_CATEGORIES } from '../../config/promptLibraryData';
import type { PromptItem } from '../../config/promptLibraryData';
import { toast } from '../toastStore';
import type { Layer } from '../VideoCanvas';
import {
  resolvePromptVariables,
  interpolatePromptVariables,
  extractPromptPlaceholders,
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

const CATEGORY_LABELS: Record<string, string> = {
  camera: '镜头运镜',
  lighting: '光影氛围',
  copy: '文案钩子',
  fabric: '面料版型'
};

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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [injectModalItem, setInjectModalItem] = useState<PromptItem | null>(null);

  const variables = useMemo(() => resolvePromptVariables(variableContext), [variableContext]);
  const variableMap = useMemo(
    () => Object.fromEntries(variables.map(variable => [variable.key, variable.value])),
    [variables]
  );

  const filteredItems = PROMPT_LIBRARY.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query
      || item.title.toLowerCase().includes(query)
      || item.description.toLowerCase().includes(query)
      || item.tags.some(tag => tag.toLowerCase().includes(query))
      || item.content.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const selectedItem = PROMPT_LIBRARY.find(item => item.id === selectedItemId) || null;

  const finalText = (item: PromptItem) => previewWithVariables && item.hasVariables
    ? interpolatePromptVariables(item.content, variableMap)
    : item.content;

  const copyItem = (item: PromptItem) => {
    void navigator.clipboard.writeText(finalText(item));
    toast.success(`已复制「${item.title}」提示词`);
  };

  const createTextLayer = (item: PromptItem) => {
    const text = finalText(item);
    if (onAddTextLayer) {
      onAddTextLayer(text);
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
          text,
          fontSize: 28,
          color: '#ffffff',
          animation: 'fade',
          bold: true,
          shadow: true
        }
      };
      setLayers(previous => [...previous, newLayer]);
      setSelectedLayerId?.(id);
      toast.success(`已在画板创建「${item.title}」文案图层`);
    }
  };

  const openInject = (item: PromptItem) => {
    if (onInjectToStoryboard) {
      setInjectModalItem(item);
      return;
    }
    if (onApplyPrompt) {
      onApplyPrompt(finalText(item));
      toast.success(`已应用「${item.title}」至分镜设定`);
      return;
    }
    copyItem(item);
  };

  return (
    <>
      <div className="drawer-header prompt-library-header">
        <div className="prompt-title-row">
          <div>
            <div className="drawer-title">提示词库</div>
            <div className="drawer-subtitle">可复用的镜头、光影与文案片段。变量会自动替换成当前项目信息，不再显示原始占位符。</div>
          </div>
          {onNavigateToStoryboard && (
            <button type="button" className="prompt-storyboard-link" onClick={onNavigateToStoryboard}>
              分镜向导 →
            </button>
          )}
        </div>
      </div>

      <div className="drawer-content prompt-library-content">
        <div className="prompt-search-row">
          <div className="prompt-search">
            <span>⌕</span>
            <input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="搜索：推镜头 / 侧逆光 / 前 3 秒钩子"
            />
          </div>
          <button
            type="button"
            className={`prompt-variable-toggle ${showVariableBar ? 'active' : ''}`}
            onClick={() => setShowVariableBar(previous => !previous)}
          >
            变量 {variables.length}
          </button>
        </div>

        {showVariableBar && (
          <div className="prompt-variable-panel">
            <div className="prompt-variable-head">
              <b>当前项目变量</b>
              <button type="button" onClick={() => setPreviewWithVariables(previous => !previous)}>
                {previewWithVariables ? '已填充' : '原始占位符'}
              </button>
            </div>
            <div className="prompt-variable-chips">
              {variables.map(variable => (
                <span key={variable.key} className="prompt-variable-chip" title={variable.value}>
                  <em>{variable.icon} {variable.label}</em>
                  <b>{variable.value}</b>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="prompt-category-chips">
          {PROMPT_CATEGORIES.map(category => (
            <button
              key={category.id}
              type="button"
              className={selectedCategory === category.id ? 'active' : ''}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>

        {selectedItem && (
          <div className="prompt-detail-card">
            <div className="prompt-detail-top">
              <div>
                <span className="prompt-detail-category">{CATEGORY_LABELS[selectedItem.category] || '提示词'}</span>
                <h4>{selectedItem.title}</h4>
              </div>
              <button type="button" className="prompt-detail-close" onClick={() => setSelectedItemId(null)}>✕</button>
            </div>
            <p>{selectedItem.description}</p>
            <div className="prompt-detail-text">{finalText(selectedItem)}</div>
            <div className="prompt-detail-chips">
              {extractPromptPlaceholders(selectedItem.content).map(key => (
                <span key={key} className={variableMap[key] ? 'resolved' : 'missing'}>
                  {variableMap[key] ? `${key}：${variableMap[key]}` : `缺少变量：${key}`}
                </span>
              ))}
            </div>
            <div className="prompt-detail-actions">
              <button type="button" onClick={() => copyItem(selectedItem)}>复制最终提示词</button>
              <button type="button" className="primary" onClick={() => openInject(selectedItem)}>注入当前分镜</button>
            </div>
          </div>
        )}

        <div className="prompt-list">
          {filteredItems.map(item => {
            const placeholders = extractPromptPlaceholders(item.content);
            return (
              <article
                key={item.id}
                className={`prompt-card ${selectedItemId === item.id ? 'selected' : ''}`}
                onClick={() => setSelectedItemId(item.id)}
              >
                <div className="prompt-card-head">
                  <div>
                    <b>{item.title}</b>
                    {item.recommendedShot && <span className="prompt-shot-badge">分镜 {item.recommendedShot.replace('shot-', '')}</span>}
                  </div>
                  <span className="prompt-category">{CATEGORY_LABELS[item.category]}</span>
                </div>
                <p>{item.description}</p>
                <div className="prompt-tags">
                  {item.tags.map(tag => <span key={tag}>{tag}</span>)}
                </div>
                <div className="prompt-card-footer">
                  <div className="prompt-card-vars">
                    {placeholders.length > 0 && (
                      <span className={placeholders.every(key => variableMap[key]) ? 'ready' : 'warn'}>
                        {placeholders.every(key => variableMap[key]) ? '● 变量已就绪' : '⚠ 缺少变量'}
                      </span>
                    )}
                  </div>
                  <div className="prompt-card-actions">
                    <button type="button" onClick={event => { event.stopPropagation(); copyItem(item); }}>复制</button>
                    <button type="button" className="primary" onClick={event => { event.stopPropagation(); openInject(item); }}>注入</button>
                  </div>
                </div>
                {item.targetType === 'both' && (
                  <button
                    type="button"
                    className="prompt-text-layer"
                    onClick={event => { event.stopPropagation(); createTextLayer(item); }}
                  >
                    ＋ 建文案图层
                  </button>
                )}
              </article>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="prompt-empty">
            <b>没有匹配的提示词</b>
            <span>换个关键词，或切回「全部」分类。</span>
          </div>
        )}
      </div>

      {injectModalItem && (
        <PromptInjectModal
          isOpen={!!injectModalItem}
          onClose={() => setInjectModalItem(null)}
          item={injectModalItem}
          variableContext={variableContext}
          currentMasterPrompt={currentMasterPrompt}
          onConfirmInject={params => {
            if (onInjectToStoryboard) onInjectToStoryboard(params);
          }}
        />
      )}
    </>
  );
};
