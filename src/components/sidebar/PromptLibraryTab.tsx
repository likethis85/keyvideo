import React, { useEffect, useMemo, useState } from 'react';
import { PROMPT_LIBRARY, PROMPT_CATEGORIES } from '../../config/promptLibraryData';
import type { PromptItem } from '../../config/promptLibraryData';
import { toast } from '../toastStore';
import type { Layer } from '../VideoCanvas';
import { generateVideoCopy } from '../../utils/aiGateway';
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
  fabric: '面料版型',
  story: '节奏结构',
  style: '色彩风格'
};

const CATEGORY_ICONS: Record<string, string> = {
  camera: '🎥',
  lighting: '💡',
  copy: '✍️',
  fabric: '👗',
  story: '🧩',
  style: '🎨'
};

const CATEGORY_TONES: Record<string, string> = {
  camera: 'cyan',
  lighting: 'gold',
  copy: 'pink',
  fabric: 'violet',
  story: 'green',
  style: 'blue'
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
  const [variableOverrides, setVariableOverrides] = useState<Record<string, string>>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [injectModalItem, setInjectModalItem] = useState<PromptItem | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem('keyvideo.prompt-library.favorites');
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [customItems, setCustomItems] = useState<PromptItem[]>(() => {
    try {
      const saved = window.localStorage.getItem('keyvideo.prompt-library.custom-items');
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((item): item is PromptItem => Boolean(item && typeof item === 'object' && typeof (item as PromptItem).id === 'string' && typeof (item as PromptItem).content === 'string')) : [];
    } catch {
      return [];
    }
  });
  const [showCreator, setShowCreator] = useState(false);
  const [creatorMode, setCreatorMode] = useState<'custom' | 'ai'>('custom');
  const [creatorTitle, setCreatorTitle] = useState('');
  const [creatorContent, setCreatorContent] = useState('');
  const [creatorCategory, setCreatorCategory] = useState<PromptItem['category']>('camera');
  const [creatorTags, setCreatorTags] = useState('');
  const [creatorBrief, setCreatorBrief] = useState('');
  const [generatingIdeas, setGeneratingIdeas] = useState(false);

  const variables = useMemo(() => resolvePromptVariables({ ...variableContext, customOverrides: variableOverrides }), [variableContext, variableOverrides]);
  const variableMap = useMemo(
    () => Object.fromEntries(variables.map(variable => [variable.key, variable.value])),
    [variables]
  );
  const variableLabelMap = useMemo(
    () => Object.fromEntries(variables.map(variable => [variable.key, variable.label])),
    [variables]
  );

  const allItems = useMemo(() => [...customItems, ...PROMPT_LIBRARY], [customItems]);
  const filteredItems = allItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesFavorites = !showFavoritesOnly || favoriteIds.includes(item.id);
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query
      || item.title.toLowerCase().includes(query)
      || item.description.toLowerCase().includes(query)
      || item.tags.some(tag => tag.toLowerCase().includes(query))
      || item.content.toLowerCase().includes(query);
    return matchesCategory && matchesFavorites && matchesSearch;
  });

  const selectedItem = allItems.find(item => item.id === selectedItemId) || null;

  useEffect(() => {
    if (!selectedItemId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedItemId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedItemId]);

  useEffect(() => {
    try {
      window.localStorage.setItem('keyvideo.prompt-library.favorites', JSON.stringify(favoriteIds));
    } catch {
      // Favorites remain usable for the current session when storage is unavailable.
    }
  }, [favoriteIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem('keyvideo.prompt-library.custom-items', JSON.stringify(customItems));
    } catch {
      // Custom inspirations remain available for the current session.
    }
  }, [customItems]);

  const openDetail = (item: PromptItem) => setSelectedItemId(item.id);
  const toggleFavorite = (item: PromptItem) => setFavoriteIds(previous => previous.includes(item.id) ? previous.filter(id => id !== item.id) : [...previous, item.id]);
  const targetLabel = (target: PromptItem['targetType']) => target === 'both' ? '提示词 + 文案' : target === 'text_layer' ? '文案图层' : '提示词';

  const saveCustomItem = () => {
    const title = creatorTitle.trim();
    const content = creatorContent.trim();
    if (!title || !content) {
      toast.info('请填写灵感名称和提示词内容');
      return;
    }
    const item: PromptItem = {
      id: `custom_prompt_${Date.now()}`,
      category: creatorCategory,
      title,
      tags: creatorTags.split(/[，,\s]+/).map(tag => tag.trim()).filter(Boolean).slice(0, 6),
      content,
      description: '用户自定义灵感，可继续编辑并注入当前分镜。',
      targetType: 'prompt',
      recommendedShot: 'all',
      hasVariables: extractPromptPlaceholders(content).length > 0
    };
    setCustomItems(previous => [item, ...previous]);
    setCreatorTitle('');
    setCreatorContent('');
    setCreatorTags('');
    setShowCreator(false);
    toast.success('已保存自定义灵感');
  };

  const generateIdeas = async () => {
    if (!creatorBrief.trim()) {
      toast.info('先写下想生成的画面主题');
      return;
    }
    setGeneratingIdeas(true);
    try {
      const generated = await generateVideoCopy({ brief: `请生成适合视频创作提示词库的画面灵感：${creatorBrief}`, platform: 'AI 视频提示词', tone: '画面感强、专业、具体', goal: '生成可直接用于分镜的提示词' });
      const items: PromptItem[] = generated.slice(0, 8).map((content, index) => ({
        id: `ai_prompt_${Date.now()}_${index}`,
        category: creatorCategory,
        title: `${creatorBrief.trim().slice(0, 14)} · AI 灵感 ${index + 1}`,
        tags: ['AI生成', CATEGORY_LABELS[creatorCategory]],
        content,
        description: '由 AI 根据当前主题生成，可编辑后注入分镜。',
        targetType: 'prompt',
        recommendedShot: 'all',
        hasVariables: extractPromptPlaceholders(content).length > 0
      }));
      if (!items.length) {
        toast.warning('AI 没有返回可用灵感，请换个主题重试');
        return;
      }
      setCustomItems(previous => [...items, ...previous]);
      setShowCreator(false);
      setCreatorBrief('');
      toast.success(`已生成 ${items.length} 条 AI 灵感`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI 灵感生成失败，请检查服务连接');
    } finally {
      setGeneratingIdeas(false);
    }
  };

  const recommendedShotLabel = (shot?: PromptItem['recommendedShot']) => {
    if (shot === 'all') return '适用全部分镜';
    if (shot === 'text_layer') return '适用于文案图层';
    return shot ? `推荐分镜 ${shot.replace('shot-', '')}` : '通用提示词';
  };

  const finalText = (item: PromptItem) => previewWithVariables && item.hasVariables
    ? interpolatePromptVariables(item.content, variableMap)
    : item.content;

  const copyItem = async (item: PromptItem) => {
    try {
      await navigator.clipboard.writeText(finalText(item));
      toast.success(`已复制「${item.title}」提示词`);
    } catch {
      toast.error('复制失败，请检查浏览器剪贴板权限');
    }
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
      <div className="library-page prompt-page">
          <header className="library-page-heading prompt-heading">
          <div>
            <div className="library-eyebrow">PROMPT SNIPPETS</div>
            <h1>提示词库</h1>
            <p>从镜头、光影、文案和节奏灵感中快速挑选，点击卡片打开大尺寸编辑抽屉，再一键注入当前分镜。</p>
          </div><div className="prompt-heading-actions"><button type="button" className={showCreator && creatorMode === 'custom' ? 'active' : ''} onClick={() => { setCreatorMode('custom'); setShowCreator(true); }}>＋ 自定义灵感</button><button type="button" className={showCreator && creatorMode === 'ai' ? 'active ai' : 'ai'} onClick={() => { setCreatorMode('ai'); setShowCreator(true); }}>✦ AI 生成灵感</button></div>
        </header>
          {showCreator && <section className="prompt-creator-panel">
            <div className="prompt-creator-head"><div><b>{creatorMode === 'custom' ? '创建自己的灵感' : 'AI 灵感生成器'}</b><small>{creatorMode === 'custom' ? '保存后会出现在当前提示词库，可搜索、收藏和注入。' : '输入主题，生成多条可继续编辑的分镜提示词。'}</small></div><button type="button" onClick={() => setShowCreator(false)} aria-label="关闭创建面板">×</button></div>
            <div className="prompt-creator-grid">
              {creatorMode === 'custom' ? <><label><span>灵感名称</span><input value={creatorTitle} onChange={event => setCreatorTitle(event.target.value)} placeholder="例如：城市夜景慢推" /></label><label><span>分类</span><select value={creatorCategory} onChange={event => setCreatorCategory(event.target.value as PromptItem['category'])}>{PROMPT_CATEGORIES.filter(category => category.id !== 'all').map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><label className="wide"><span>提示词内容</span><textarea value={creatorContent} onChange={event => setCreatorContent(event.target.value)} placeholder="支持 {model}、{clothing}、{scene} 等变量，注入时会自动替换。" rows={3} /></label><label><span>标签</span><input value={creatorTags} onChange={event => setCreatorTags(event.target.value)} placeholder="例如：夜景，慢推，氛围" /></label><button type="button" className="prompt-creator-submit" onClick={saveCustomItem}>保存灵感</button></> : <><label className="wide"><span>想生成什么灵感？</span><textarea value={creatorBrief} onChange={event => setCreatorBrief(event.target.value)} placeholder="例如：春季通勤衬衫，城市街头，轻快推镜，突出面料质感" rows={3} /></label><label><span>归类到</span><select value={creatorCategory} onChange={event => setCreatorCategory(event.target.value as PromptItem['category'])}>{PROMPT_CATEGORIES.filter(category => category.id !== 'all').map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><button type="button" className="prompt-creator-submit ai" disabled={generatingIdeas} onClick={() => void generateIdeas()}>{generatingIdeas ? '正在生成…' : '✦ 生成并保存'}</button></>}
            </div>
          </section>}
        <div className="prompt-main">
          <div className="prompt-main-left">
            <div className="prompt-search-row">
              <label className="prompt-search">
                <span>⌕</span>
                <input aria-label="搜索提示词" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="搜索：推镜头 / 侧逆光 / 前 3 秒钩子" />
              </label>
              <button type="button" className={`prompt-variable-toggle ${showVariableBar ? 'active' : ''}`} onClick={() => setShowVariableBar(previous => !previous)}>⚡ 变量 {variables.length}</button>
            </div>
            {showVariableBar && <div className="prompt-variable-panel">
              <div className="prompt-variable-head"><div><b>当前项目变量</b><small>编辑后会实时替换提示词中的 {'{变量名}'}</small></div><div className="prompt-variable-head-actions"><button type="button" onClick={() => setVariableOverrides({})}>恢复默认</button><button type="button" onClick={() => setPreviewWithVariables(previous => !previous)}>{previewWithVariables ? '已填充' : '原始占位符'}</button></div></div>
              <div className="prompt-variable-chips">{variables.map(variable => <label key={variable.key} className="prompt-variable-chip" title={`变量占位符：{${variable.key}}`}><em>{variable.icon} {variable.label}</em><input value={variable.value} onChange={event => setVariableOverrides(previous => ({ ...previous, [variable.key]: event.target.value }))} /></label>)}</div>
            </div>}
            <div className="prompt-library-toolbar"><div className="prompt-category-chips">{PROMPT_CATEGORIES.map(category => <button key={category.id} type="button" className={selectedCategory === category.id ? 'active' : ''} onClick={() => setSelectedCategory(category.id)}><span>{category.icon}</span>{category.label}</button>)}</div><div className="prompt-library-tools"><button type="button" className={`prompt-favorites-filter ${showFavoritesOnly ? 'active' : ''}`} onClick={() => setShowFavoritesOnly(previous => !previous)} aria-pressed={showFavoritesOnly}>★ 收藏灵感 {favoriteIds.length}</button><span className="prompt-result-count">{filteredItems.length} 条灵感</span></div></div>
            <div className="prompt-list">
              {filteredItems.map(item => {
                const placeholders = extractPromptPlaceholders(item.content);
                const ready = placeholders.length === 0 || placeholders.every(key => variableMap[key]);
                return <article key={item.id} className={`prompt-card tone-${CATEGORY_TONES[item.category] || 'cyan'} ${selectedItemId === item.id ? 'selected' : ''}`} onClick={() => openDetail(item)}>
                  <div className="prompt-card-head"><div className="prompt-card-title-row"><span className="prompt-card-icon">{CATEGORY_ICONS[item.category] || '✨'}</span><button type="button" className="prompt-card-open" onClick={() => openDetail(item)}><b>{item.title}</b><span className="prompt-card-type">{targetLabel(item.targetType)}</span></button></div><button type="button" className={`prompt-favorite ${favoriteIds.includes(item.id) ? 'active' : ''}`} aria-label={favoriteIds.includes(item.id) ? `取消收藏 ${item.title}` : `收藏 ${item.title}`} onClick={event => { event.stopPropagation(); toggleFavorite(item); }}>{favoriteIds.includes(item.id) ? '★' : '☆'}</button></div>
                  <div className="prompt-card-meta"><span className="prompt-category">{CATEGORY_LABELS[item.category]}</span>{item.recommendedShot && <span className="prompt-shot-badge">{recommendedShotLabel(item.recommendedShot)}</span>}</div>
                  <p>{item.description}</p>
                  <div className="prompt-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
                  <div className="prompt-card-footer"><div className="prompt-card-vars">{placeholders.length > 0 ? <span className={ready ? 'ready' : 'warn'}>{ready ? '● 变量已就绪' : '⚠ 需要补充变量'}</span> : <span className="prompt-ready-static">● 可直接使用</span>}</div><div className="prompt-card-actions"><button type="button" onClick={event => { event.stopPropagation(); copyItem(item); }}>复制</button><button type="button" className="primary" onClick={event => { event.stopPropagation(); openInject(item); }}>注入</button></div></div>
                  {item.targetType === 'both' && <button type="button" className="prompt-text-layer" onClick={event => { event.stopPropagation(); createTextLayer(item); }}>＋ 建文案图层</button>}
                </article>;
              })}
            </div>
            {filteredItems.length === 0 && <div className="prompt-empty"><b>{showFavoritesOnly && favoriteIds.length === 0 ? '还没有收藏灵感' : '没有匹配的提示词'}</b><span>{showFavoritesOnly && favoriteIds.length === 0 ? '点亮卡片右上角的星标，常用提示词会收集在这里。' : '换个关键词、分类，或关闭收藏筛选。'}</span></div>}
          </div>
          {selectedItem && <div className="prompt-detail-overlay" onMouseDown={() => setSelectedItemId(null)}><aside className="prompt-detail-panel" role="dialog" aria-modal="true" aria-labelledby="prompt-detail-title" onMouseDown={event => event.stopPropagation()}>
            <div className="prompt-detail-top"><div><span className="prompt-detail-category">{CATEGORY_LABELS[selectedItem.category]} · {recommendedShotLabel(selectedItem.recommendedShot)}</span><h4 id="prompt-detail-title">{selectedItem.title}</h4><small className="prompt-detail-description">{CATEGORY_LABELS[selectedItem.category]} · 可调整内容后注入分镜</small></div><button type="button" className="prompt-detail-close" aria-label="关闭详情" onClick={() => setSelectedItemId(null)}>✕</button></div>
            <div className="prompt-detail-body">
              <div className="prompt-detail-label">已自动填入的变量</div>
              <div className="prompt-variable-chips">{extractPromptPlaceholders(selectedItem.content).map(key => <span key={key} className={`prompt-variable-chip ${variableMap[key] ? '' : 'missing'}`}><em>{variableLabelMap[key] || key}</em><b>{variableMap[key] || '未设置'}</b></span>)}</div>
              <p className="prompt-detail-description">变量来自当前项目，不会把占位符写入最终提示词。</p>
              <div className="prompt-detail-label">最终提示词</div>
              <div className="prompt-detail-text">{finalText(selectedItem)}</div>
              <div className="prompt-detail-label">注入位置</div>
              <div className="prompt-detail-chips"><span className="resolved">{recommendedShotLabel(selectedItem.recommendedShot)}</span><span>主提示词</span></div>
              <div className="prompt-detail-actions"><button type="button" className="primary" onClick={() => openInject(selectedItem)}>⚡ 编辑并注入分镜</button><button type="button" onClick={() => copyItem(selectedItem)}>复制最终提示词</button></div>
              {onNavigateToStoryboard && <button type="button" className="prompt-text-layer" onClick={onNavigateToStoryboard}>打开分镜向导 →</button>}
            </div>
          </aside></div>}
        </div>
      </div>
      {injectModalItem && <PromptInjectModal isOpen={!!injectModalItem} onClose={() => setInjectModalItem(null)} item={injectModalItem} variableContext={{ ...variableContext, customOverrides: variableOverrides }} currentMasterPrompt={currentMasterPrompt} onConfirmInject={params => { onInjectToStoryboard?.(params); setInjectModalItem(null); }} />}
    </>
  );
};
