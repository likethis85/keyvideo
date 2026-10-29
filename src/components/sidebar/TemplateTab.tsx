import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { SCRIPT_TEMPLATE_CATEGORIES, SCRIPT_TEMPLATES, type ScriptTemplate, type ScriptTemplateCategory } from '../../config/scriptTemplates';
import { localDB } from '../../utils/db';
import { toast } from '../toastStore';

interface TemplateTabProps {
  onUseTemplate?: (template: ScriptTemplate) => void;
}

function TemplateIcon({ template }: { template: ScriptTemplate }) {
  const icon = template.id === 'talking-head-3'
    ? <><path d="M8 10a4 4 0 0 1 8 0v2a4 4 0 0 1-8 0Z" /><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3M8 21h8" /></>
    : template.id === 'outfit-transition-5'
      ? <><path d="M9 4h6l1 4 4 2-2 4-3-1v7H9v-7l-3 1-2-4 4-2 1-4Z" /><path d="M9 4a3 3 0 0 0 6 0" /></>
      : template.id === 'product-detail-4'
        ? <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 5 5" /><path d="M8.5 10.5h4M10.5 8.5v4" /></>
        : template.id === 'store-visit-3'
          ? <><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>
          : null;
  return icon ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg> : <span aria-hidden="true">{template.icon}</span>;
}

export function TemplateTab({ onUseTemplate }: TemplateTabProps) {
  const PAGE_SIZE = 6;
  const [category, setCategory] = useState<'all' | ScriptTemplateCategory>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [customTemplates, setCustomTemplates] = useState<ScriptTemplate[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [templateCategory, setTemplateCategory] = useState<string>('口播');
  const [duration, setDuration] = useState('15 秒');
  const [shots, setShots] = useState('5 镜');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [structure, setStructure] = useState('');
  const [accent, setAccent] = useState('#58e6ff');
  const accentOptions = ['#58e6ff', '#a78bfa', '#f7b955', '#ff7d9c', '#55d99a', '#7ca8ff'];
  useEffect(() => {
    let active = true;
    void localDB.get<ScriptTemplate[]>('ui_script_templates').then(items => { if (active && Array.isArray(items)) setCustomTemplates(items); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!creating) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setCreating(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [creating]);
  const filtered = useMemo(() => [...SCRIPT_TEMPLATES, ...customTemplates].filter(template => {
    const search = query.trim().toLowerCase();
    return (category === 'all' || template.category === category) && (!search || [template.title, template.description, ...template.tags].join(' ').toLowerCase().includes(search));
  }), [category, query, customTemplates]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, pages - 1);

  const createTemplate = async () => {
    if (!name.trim() || !prompt.trim()) return;
    const cleanTags = tags.split(/[,，、\s]+/).map(tag => tag.trim()).filter(Boolean).slice(0, 5);
    const cleanStructure = structure.trim() || '开场钩子 → 核心卖点 → 细节证明 → 行动收口';
    const template: ScriptTemplate = {
      ...SCRIPT_TEMPLATES[0],
      id: crypto.randomUUID(),
      title: name.trim(),
      subtitle: `${templateCategory.toUpperCase()} · ${duration.replace(' 秒', 'S')}`,
      category: templateCategory.trim() as ScriptTemplateCategory,
      duration,
      shots,
      icon: '✦',
      accent,
      description: description.trim() || '我的创意脚本，随时复用并继续完善。',
      tags: ['我的模板', ...cleanTags, ...(cleanTags.length ? [] : ['创意脚本'])].slice(0, 5),
      sample: cleanStructure,
      prefill: '将预填 自定义主提示词与镜头结构',
      masterPrompt: prompt.trim()
    };
    const next = [...customTemplates, template];
    try {
      if (!await localDB.set('ui_script_templates', next)) throw new Error('本地存储不可用');
      setCustomTemplates(next); setCreating(false); setName(''); setPrompt(''); setDescription(''); setTags(''); setStructure(''); setTemplateCategory('口播'); setDuration('15 秒'); setShots('5 镜'); setAccent('#58e6ff'); setCategory('all'); setPage(Math.floor((SCRIPT_TEMPLATES.length + next.length - 1) / PAGE_SIZE));
      toast.success('脚本模板已保存');
    } catch { toast.error('模板保存失败，请重试'); }
  };

  return <div className="library-page script-page">
    <header className="library-page-heading">
      <div><div className="library-eyebrow">CREATE WITH A SCRIPT</div><h1>按内容目标选模板</h1><p>模板不是滤镜，而是一整套「口播/分镜提示词 + 镜头结构 + 字幕节奏」。<br />选一个目标，先把脚本骨架搭好，再替换你的素材。</p></div>
      <div className="script-heading-actions"><label className="library-search script-search"><span aria-hidden="true">⌕</span><input aria-label="搜索脚本模板" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="搜索：口播 / 转场 / 产品细节" /></label><button className="script-create script-create-top studio-button primary" onClick={() => setCreating(true)}><span className="script-create-spark" aria-hidden="true">✦</span><span>创建自己的脚本模板</span></button></div>
    </header>
    <div className="library-filter-row">
      <div className="library-filter-chips">{SCRIPT_TEMPLATE_CATEGORIES.map(item => <button key={item.id} className={category === item.id ? 'active' : ''} onClick={() => { setCategory(item.id); setPage(0); }}>{item.id === '活动探店' ? '活动/探店' : item.label}</button>)}</div>
      <span className="script-count">共 <b>{filtered.length}</b> 个脚本模板</span>
    </div>
    <div className="script-card-grid">
      {filtered.slice(activePage * PAGE_SIZE, activePage * PAGE_SIZE + PAGE_SIZE).map((template, index) => <article className="script-card" key={template.id} style={{ '--template-accent': template.accent } as CSSProperties}>
        <div className="script-card-heading"><span className="script-type-icon"><TemplateIcon template={template} /></span><div><h2>{template.title}</h2><small>{template.subtitle}</small></div><span className="script-duration">{template.duration} · {template.shots}</span></div>
        <p className="script-description">{template.description}</p>
        <div className="script-tags">{template.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
        <div className="script-sample"><small>{index === 1 ? '镜头结构' : index === 2 ? '示例镜头' : index === 3 ? '模板说明' : '示例开场'}</small><p>{template.sample}</p></div>
        <div className="script-card-footer"><span>{template.prefill.split(' ')[0]} <b>{template.prefill.split(' ').slice(1).join(' ')}</b></span><button className={index < 2 ? 'studio-button primary' : 'studio-button cyan'} onClick={() => onUseTemplate?.(template)}>使用模板 →</button></div>
      </article>)}
    </div>
    {!filtered.length && <div className="library-empty"><span>⌕</span><h3>没有找到相关模板</h3><p>试试其他关键词，或选择「全部」。</p><button className="studio-button" onClick={() => { setQuery(''); setCategory('all'); }}>重置筛选</button></div>}
    <footer className="script-page-footer"><span>模板会写入 <b>主提示词 / 分镜提示词</b>，之后可继续调整素材与剪辑。</span><div className="script-pagination">{pages > 1 && <><button className="script-page-button" aria-label="上一页模板" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg><span>上一页</span></button><span className="script-page-number">{activePage + 1} / {pages}</span><button className="script-page-button" aria-label="下一页模板" disabled={activePage + 1 === pages} onClick={() => setPage(activePage + 1)}><span>下一页</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button></>}</div></footer>
    {creating && createPortal(<div className="studio-modal-backdrop template-modal-backdrop" onMouseDown={() => setCreating(false)}><form className="studio-dialog template-builder" role="dialog" aria-modal="true" aria-labelledby="template-create-title" onMouseDown={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); void createTemplate(); }}>
      <header className="template-builder-header"><div><span className="template-builder-eyebrow">CREATIVE TEMPLATE BUILDER</span><h2 id="template-create-title">创建你的脚本模板</h2><p>把你的创意、镜头节奏和视觉方向保存成一套可复用的创作方法。</p></div><button type="button" className="template-builder-close" aria-label="关闭创建脚本模板" onClick={() => setCreating(false)}>×</button></header>
      <div className="template-builder-layout">
        <div className="template-builder-fields">
          <section className="template-builder-section"><div className="template-builder-section-title"><span>01</span><div><b>先定义创意主题</b><small>让模板一眼传达你想做的内容</small></div></div>
            <label className="template-builder-label">模板名称<input autoFocus required maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="例如：秋冬新品 · 三段口播" /></label>
            <div className="template-builder-grid"><label className="template-builder-label">内容分类<span className="template-builder-hint">可输入自定义分类，也可以从候选中选择</span><input list="template-category-options" value={templateCategory} onChange={event => setTemplateCategory(event.target.value)} placeholder="例如：直播切片" /></label><label className="template-builder-label">视频时长<span className="template-builder-hint">可输入任意时长，例如 90 秒</span><input list="template-duration-options" value={duration} onChange={event => setDuration(event.target.value)} placeholder="例如：15 秒" /></label><label className="template-builder-label">镜头数量<span className="template-builder-hint">可输入任意镜头数，例如 10 镜</span><input list="template-shot-options" value={shots} onChange={event => setShots(event.target.value)} placeholder="例如：5 镜" /></label></div><datalist id="template-category-options">{SCRIPT_TEMPLATE_CATEGORIES.filter(item => item.id !== 'all').map(item => <option key={item.id} value={item.label} />)}</datalist><datalist id="template-duration-options"><option value="10 秒" /><option value="15 秒" /><option value="20 秒" /><option value="30 秒" /><option value="45 秒" /><option value="60 秒" /></datalist><datalist id="template-shot-options"><option value="3 镜" /><option value="4 镜" /><option value="5 镜" /><option value="6 镜" /><option value="8 镜" /></datalist>
            <label className="template-builder-label">一句话创意说明<span className="template-builder-hint">用一句话说清楚这套模板最适合拍什么</span><input maxLength={140} value={description} onChange={event => setDescription(event.target.value)} placeholder="例如：用真实通勤场景展示一件外套的三种穿法" /></label>
          </section>
          <section className="template-builder-section"><div className="template-builder-section-title"><span>02</span><div><b>设计镜头节奏</b><small>把脑海里的分镜顺序变成可执行结构</small></div></div>
            <label className="template-builder-label">镜头结构<span className="template-builder-hint">用箭头分隔镜头，例如：悬念开场 → 细节特写 → 行动收口</span><input value={structure} onChange={event => setStructure(event.target.value)} placeholder="开场钩子 → 核心卖点 → 细节证明 → 行动收口" /></label>
            <div className="template-structure-presets"><span>快速灵感</span><button type="button" onClick={() => setStructure('反常识钩子 → 卖点拆解 → 上身证明 → 评论互动')}>种草转化</button><button type="button" onClick={() => setStructure('环境建立 → 人物入镜 → 细节特写 → 氛围收尾')}>氛围叙事</button><button type="button" onClick={() => setStructure('悬念局部 → 完整亮相 → 三个卖点 → 首发行动')}>新品发布</button><button type="button" onClick={() => setStructure('问题引入 → 三步演示 → 注意事项 → 前后对比')}>教程拆解</button></div>
            <label className="template-builder-label">创意标签<span className="template-builder-hint">用逗号分隔，最多保存 5 个标签</span><input value={tags} onChange={event => setTags(event.target.value)} placeholder="例如：通勤、反差转场、字幕高亮" /></label>
            <label className="template-builder-label">主提示词<textarea required maxLength={12000} rows={8} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="写下画面风格、人物状态、镜头运动、口播节奏和必须保持的视觉一致性…" /></label>
          </section>
          <section className="template-builder-section"><div className="template-builder-section-title"><span>03</span><div><b>选择视觉主题</b><small>颜色会成为模板卡片和创作时的识别标记</small></div></div><div className="template-accent-picker" role="radiogroup" aria-label="模板主题色">{accentOptions.map(color => <button key={color} type="button" className={accent === color ? 'active' : ''} style={{ '--accent-option': color } as CSSProperties} onClick={() => setAccent(color)} aria-label={`选择主题色 ${color}`} aria-pressed={accent === color}><span /></button>)}</div></section>
        </div>
        <aside className="template-builder-preview" style={{ '--template-accent': accent } as CSSProperties}><div className="template-preview-label">实时预览</div><div className="template-preview-icon"><span>✦</span></div><div className="template-preview-category">{templateCategory || '未分类'} · {duration || '未设置时长'} · {shots || '未设置镜头'}</div><h3>{name.trim() || '你的创意模板'}</h3><p>{description.trim() || '一句话介绍你的创意方向，保存后会显示在模板卡片上。'}</p><div className="template-preview-structure"><small>镜头结构</small><strong>{structure.trim() || '开场钩子 → 核心卖点 → 行动收口'}</strong></div><div className="template-preview-tags">{(tags.split(/[,，、\s]+/).filter(Boolean).slice(0, 4).length ? tags.split(/[,，、\s]+/).filter(Boolean).slice(0, 4) : ['创意脚本', '可复用']).map(tag => <span key={tag}>#{tag}</span>)}</div><div className="template-preview-footer"><i style={{ background: accent }} title="模板主题色" aria-label="模板主题色" /></div></aside>
      </div>
      <footer className="template-builder-footer"><span>保存后可在模板库中搜索、筛选并一键应用。</span><div><button type="button" className="studio-button" onClick={() => setCreating(false)}>先不保存</button><button type="submit" className="studio-button primary" disabled={!name.trim() || !prompt.trim()}>保存我的创意模板</button></div></footer>
    </form></div>, document.body)}
  </div>;
}
