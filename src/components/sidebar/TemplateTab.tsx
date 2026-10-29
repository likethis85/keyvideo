import React, { useMemo, useState } from 'react';
import {
  SCRIPT_TEMPLATE_CATEGORIES,
  SCRIPT_TEMPLATES,
  type ScriptTemplate,
  type ScriptTemplateCategory
} from '../../config/scriptTemplates';

interface TemplateTabProps {
  applyTemplate?: (type: 'beat' | 'split' | 'detail' | 'transition_demo') => void;
  onUseTemplate?: (template: ScriptTemplate) => void;
}

export const TemplateTab: React.FC<TemplateTabProps> = ({ applyTemplate, onUseTemplate }) => {
  const [category, setCategory] = useState<'all' | ScriptTemplateCategory>('all');
  const [query, setQuery] = useState('');

  const visibleTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return SCRIPT_TEMPLATES.filter(template => {
      const matchesCategory = category === 'all' || template.category === category;
      const matchesQuery = !normalizedQuery
        || template.title.toLowerCase().includes(normalizedQuery)
        || template.description.toLowerCase().includes(normalizedQuery)
        || template.tags.some(tag => tag.toLowerCase().includes(normalizedQuery));
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  return (
    <>
      <div className="drawer-header script-template-header">
        <div className="drawer-title">脚本模板</div>
        <div className="drawer-subtitle">
          不是滤镜，是一整套「口播/分镜提示词 + 镜头结构 + 字幕节奏」。先选目标，再替换素材。
        </div>
      </div>

      <div className="drawer-content script-template-content">
        <div className="script-template-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="搜索：口播 / 转场 / 产品细节"
          />
        </div>
        <div className="script-template-categories">
          {SCRIPT_TEMPLATE_CATEGORIES.map(item => (
            <button
              key={item.id}
              className={`script-template-category ${category === item.id ? 'active' : ''}`}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="script-template-count">共 {visibleTemplates.length} 个内容脚本 · 选中后会预填主提示词和分镜</div>

        <div className="script-template-list">
          {visibleTemplates.map(template => (
            <article
              key={template.id}
              className="script-template-card"
              style={{ '--template-accent': template.accent } as React.CSSProperties}
            >
              <div className="script-template-card-top">
                <div className="script-template-icon">{template.icon}</div>
                <div className="script-template-heading">
                  <div className="script-template-name">{template.title}</div>
                  <div className="script-template-subtitle">{template.subtitle}</div>
                </div>
                <div className="script-template-meta">{template.duration} · {template.shots}</div>
              </div>

              <p className="script-template-desc">{template.description}</p>

              <div className="script-template-tags">
                {template.tags.map(tag => <span key={tag}>{tag}</span>)}
              </div>

              <div className="script-template-sample">
                <span>示例开场</span>
                <p>{template.sample}</p>
              </div>

              <div className="script-template-footer">
                <span>{template.prefill}</span>
                <button
                  type="button"
                  className="script-template-use"
                  onClick={() => onUseTemplate?.(template)}
                >
                  使用模板 →
                </button>
              </div>
            </article>
          ))}
        </div>

        <button
          type="button"
          className="script-template-custom"
          onClick={() => window.alert('自定义脚本模板即将开放：保存后可在项目里复用你自己的口播结构和镜头提示词。')}
        >
          ＋ 创建自己的脚本模板
        </button>

        <details className="script-quick-layout">
          <summary>快速时间轴排版（旧版模板）</summary>
          <p>只调整时间轴图层的节奏和转场，不改变脚本提示词。</p>
          <div className="script-quick-layout-grid">
            <button type="button" onClick={() => applyTemplate?.('beat')}>时尚卡点卖点流</button>
            <button type="button" onClick={() => applyTemplate?.('split')}>模特画报风</button>
            <button type="button" onClick={() => applyTemplate?.('detail')}>简约细节大图款</button>
            <button type="button" onClick={() => applyTemplate?.('transition_demo')}>多片段过渡演示</button>
          </div>
        </details>
      </div>
    </>
  );
};
