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

export const TemplateTab: React.FC<TemplateTabProps> = ({ onUseTemplate }) => {
  const [category, setCategory] = useState<'all' | ScriptTemplateCategory>('all');

  const visibleTemplates = useMemo(
    () => category === 'all'
      ? SCRIPT_TEMPLATES
      : SCRIPT_TEMPLATES.filter(template => template.category === category),
    [category]
  );

  return (
    <>
      <div className="drawer-header script-template-header">
        <div className="drawer-title">脚本模板</div>
        <div className="drawer-subtitle">
          不是滤镜，是一整套「口播/分镜提示词 + 镜头结构 + 字幕节奏」。先选目标，再替换素材。
        </div>
      </div>

      <div className="drawer-content script-template-content">
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
      </div>
    </>
  );
};
