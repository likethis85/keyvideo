import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Layer } from '../VideoCanvas';
import type { AspectRatio } from '../../utils/smartReflow';
import { generateVideoCopy } from '../../utils/aiGateway';
import { toast } from '../toastStore';

interface TextTabProps {
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  ratio: AspectRatio;
  productName?: string;
}

type StudioAssetKind = 'text' | 'sticker';
type StickerPreset = {
  group: string;
  title: string;
  text: string;
  style: 'purple' | 'gold' | 'cyan' | 'red' | 'black';
  icon: string;
};

const PRESETS = [
  { group: '开场钩子', title: '痛点直击', text: '穿搭显臃肿？试试这一件', color: '#fff7ed', size: 38, animation: 'zoom' as const },
  { group: '开场钩子', title: '提问留人', text: '你的衣柜还缺这一件', color: '#ffffff', size: 36, animation: 'slide' as const },
  { group: '开场钩子', title: '结果先行', text: '一套穿出松弛高级感', color: '#ffe7a3', size: 37, animation: 'fade' as const },
  { group: '核心卖点', title: '面料质感', text: '亲肤柔软 · 细腻有质感', color: '#d9fbff', size: 31, animation: 'fade' as const },
  { group: '核心卖点', title: '版型优势', text: '利落剪裁 修饰身形', color: '#f2eaff', size: 34, animation: 'slide' as const },
  { group: '核心卖点', title: '穿着体验', text: '轻松自在 一整天都舒服', color: '#e0ffeb', size: 31, animation: 'zoom' as const },
  { group: '穿搭场景', title: '通勤日常', text: '从早会到下班 一套轻松切换', color: '#ffffff', size: 29, animation: 'slide' as const },
  { group: '穿搭场景', title: '周末出行', text: '周末出门 不用费心搭配', color: '#effff5', size: 30, animation: 'fade' as const },
  { group: '穿搭场景', title: '旅行穿搭', text: '轻装出发 每一帧都好看', color: '#e4fbff', size: 31, animation: 'zoom' as const },
  { group: '促销转化', title: '限时活动', text: '限时好价 · 趁现在入手', color: '#ffffff', size: 35, animation: 'zoom' as const },
  { group: '促销转化', title: '行动引导', text: '喜欢就带走 立即选购', color: '#ffffff', size: 33, animation: 'slide' as const },
  { group: '品牌收尾', title: '品牌态度', text: '把日常 穿成自己的风格', color: '#fff0c7', size: 32, animation: 'fade' as const },
  { group: '清爽字幕', title: '简洁白字幕', text: '轻盈亲肤，日常穿着也自在', color: '#ffffff', size: 28, animation: 'fade' as const },
  { group: '清爽字幕', title: '重点词强调', text: '显瘦版型 · 自在不束缚', color: '#ffe28a', size: 30, animation: 'typewriter' as const },
  { group: '清爽字幕', title: '两行说明', text: '舒适面料\n从容应对每个日常', color: '#ffffff', size: 29, animation: 'fade' as const }
];

const STICKER_PRESETS: StickerPreset[] = [
  { group: '促销醒目', title: '新品推荐', text: '新品推荐', style: 'purple', icon: '✦' },
  { group: '促销醒目', title: '爆款直降', text: '爆款直降', style: 'gold', icon: '↘' },
  { group: '物流服务', title: '极速发货', text: '极速发货', style: 'cyan', icon: '⚡' },
  { group: '促销醒目', title: '限时立减', text: '限时立减', style: 'red', icon: '⏱' },
  { group: '信任背书', title: '品质保证', text: '品质保证', style: 'black', icon: '✓' },
  { group: '互动引导', title: '收藏加购', text: '收藏加购', style: 'purple', icon: '♡' },
  { group: '互动引导', title: '评论区见', text: '评论区见', style: 'cyan', icon: '☷' },
  { group: '品牌表达', title: '品牌精选', text: '品牌精选', style: 'gold', icon: '◆' },
  { group: '场景表达', title: '通勤必备', text: '通勤必备', style: 'red', icon: '⌁' },
  { group: '场景表达', title: '周末出行', text: '周末出行', style: 'cyan', icon: '✈' }
];

const GROUPS = ['全部样式', ...new Set(PRESETS.map(item => item.group))];
const STICKER_GROUPS = ['全部贴纸', ...new Set(STICKER_PRESETS.map(item => item.group))];
const SWATCHES = ['#ffffff', '#e8f3ff', '#a9f0ff', '#ffda7a', '#ff99bb', '#d2aaff', '#9be8b2', '#171923'];
const FONT_OPTIONS = [
  { value: 'Outfit', label: '现代无衬线' },
  { value: 'Microsoft YaHei', label: '微软雅黑' },
  { value: 'SimHei', label: '黑体' },
  { value: 'Georgia', label: '时尚衬线' }
];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function getTextAnimationState(layer: Layer, currentTime: number) {
  const animation = layer.properties.animation || 'fade';
  const progress = clamp((currentTime - layer.start) / 0.5, 0, 1);
  let opacity = 1;
  let scale = 1;
  let offsetY = 0;
  let text = layer.properties.text || '';

  if (currentTime - layer.start < 0.5) {
    if (animation === 'fade') {
      opacity = progress;
    } else if (animation === 'zoom') {
      scale = 0.5 + 0.5 * progress;
      opacity = progress;
    } else if (animation === 'slide') {
      offsetY = 30 * (1 - progress);
      opacity = progress;
    } else if (animation === 'typewriter') {
      const charCount = Math.floor(text.length * progress);
      text = text.slice(0, Math.max(1, charCount));
    }
  }

  return { opacity, scale, offsetY, text };
}

function newTextLayer(text: string, name: string, start: number, end: number, preset?: typeof PRESETS[number]): Layer {
  return {
    id: 'text_' + (crypto.randomUUID?.() || Date.now()),
    type: 'text',
    name,
    start,
    end,
    visible: true,
    x: 50,
    y: 80,
    scale: 1,
    opacity: 1,
    properties: {
      text,
      fontSize: preset?.size ?? 32,
      fontFamily: 'Outfit',
      textAlign: 'center',
      color: preset?.color ?? '#ffffff',
      outlineColor: '#111318',
      outlineWidth: 3,
      backgroundColor: '#101318',
      backgroundOpacity: 0,
      padding: 12,
      animation: preset?.animation ?? 'fade',
      bold: true,
      italic: false,
      shadow: true
    }
  };
}

function newStickerLayer(text: string, name: string, start: number, end: number, style: StickerPreset['style'] = 'purple'): Layer {
  return {
    id: 'sticker_' + (crypto.randomUUID?.() || Date.now()),
    type: 'sticker',
    name,
    start,
    end,
    visible: true,
    x: 50,
    y: 24,
    scale: 1,
    opacity: 1,
    properties: { text, style, animation: 'zoom', shadow: true }
  };
}

export const TextTab: React.FC<TextTabProps> = ({
  layers, setLayers, selectedLayerId, setSelectedLayerId, currentTime, setCurrentTime,
  isPlaying, setIsPlaying, ratio, productName = ''
}) => {
  const [assetKind, setAssetKind] = useState<StudioAssetKind>('text');
  const [group, setGroup] = useState('全部样式');
  const [search, setSearch] = useState('');
  const [brief, setBrief] = useState('');
  const [tone, setTone] = useState('高级自然');
  const [goal, setGoal] = useState('突出核心卖点');
  const [platform, setPlatform] = useState('短视频');
  const [results, setResults] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [secondsPerLine, setSecondsPerLine] = useState(3);
  const [selectedPreset, setSelectedPreset] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; layerX: number; layerY: number } | null>(null);
  const textLayers = useMemo(() => layers.filter(layer => layer.type === 'text'), [layers]);
  const stickerLayers = useMemo(() => layers.filter(layer => layer.type === 'sticker'), [layers]);
  const visualLayers = useMemo(() => layers.filter(layer => layer.type === 'text' || layer.type === 'sticker'), [layers]);
  const selectedAsset = visualLayers.find(layer => layer.id === selectedLayerId) ?? null;
  const selectedText = selectedAsset;
  const media = useMemo(() => {
    const candidates = layers.filter(layer => layer.type === 'media' && layer.visible && layer.properties.src);
    const active = candidates.find(layer => currentTime >= layer.start && currentTime <= layer.end);
    return active ?? candidates.find(layer => layer.properties.isVideo) ?? candidates[0] ?? null;
  }, [currentTime, layers]);
  const duration = Math.max(15, ...layers.map(layer => layer.end));
  const visibleLayers = visualLayers.filter(layer => layer.visible && currentTime >= layer.start && currentTime <= layer.end);
  const filteredPresets = (assetKind === 'text' ? PRESETS : STICKER_PRESETS).filter(item => {
    const matchesGroup = assetKind === 'text'
      ? group === '全部样式' || item.group === group
      : group === '全部贴纸' || item.group === group;
    const query = search.trim().toLowerCase();
    return matchesGroup && (!query || (item.title + item.text + item.group).toLowerCase().includes(query));
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media?.properties.isVideo) return;
    const target = clamp(currentTime - media.start + (media.properties.videoStartOffset ?? 0), 0, video.duration || 0);
    if (Number.isFinite(target) && Math.abs(video.currentTime - target) > 0.15) video.currentTime = target;
    if (isPlaying && currentTime >= media.start && currentTime <= media.end) void video.play().catch(() => undefined);
    else video.pause();
  }, [currentTime, isPlaying, media]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setCurrentTime(previous => previous >= duration ? 0 : Math.min(duration, previous + 1 / 30));
    }, 1000 / 30);
    return () => window.clearInterval(timer);
  }, [duration, isPlaying, setCurrentTime]);

  const patchLayer = (id: string, patch: Partial<Layer>) => {
    setLayers(previous => previous.map(layer => layer.id === id ? { ...layer, ...patch } : layer));
  };

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      const stage = previewStageRef.current;
      if (!drag || !stage || event.pointerId !== drag.pointerId) return;
      const rect = stage.getBoundingClientRect();
      const x = clamp(drag.layerX + (event.clientX - drag.startX) / rect.width * 100, 0, 100);
      const y = clamp(drag.layerY + (event.clientY - drag.startY) / rect.height * 100, 0, 100);
      setLayers(previous => previous.map(layer => layer.id === drag.id ? { ...layer, x, y } : layer));
    };
    const finish = (event: PointerEvent) => {
      if (dragStateRef.current?.pointerId === event.pointerId) dragStateRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [setLayers]);
  const patchProperties = (patch: Partial<Layer['properties']>) => {
    if (!selectedAsset) return;
    patchLayer(selectedAsset.id, { properties: { ...selectedAsset.properties, ...patch } });
  };
  const addText = (text: string, name = '新建文字', preset?: typeof PRESETS[number]) => {
    const start = clamp(currentTime, 0, Math.max(0, duration - 0.2));
    const layer = newTextLayer(text, name, start, Math.min(duration, start + secondsPerLine), preset);
    setLayers(previous => [...previous, layer]);
    setSelectedLayerId(layer.id);
    setIsPlaying(false);
    toast.success('文字已加入时间轴，可在右侧继续编辑');
  };
  const addSticker = (text: string, name = '新建贴纸', style: StickerPreset['style'] = 'purple') => {
    const start = clamp(currentTime, 0, Math.max(0, duration - 0.2));
    const layer = newStickerLayer(text, name, start, Math.min(duration, start + secondsPerLine), style);
    setLayers(previous => [...previous, layer]);
    setSelectedLayerId(layer.id);
    setIsPlaying(false);
    toast.success('贴纸已加入时间轴，可在预览中拖动调整');
  };
  const generateCopy = async () => {
    if (!brief.trim()) return toast.info('先写下产品特点或想表达的主题');
    setGenerating(true);
    try {
      const copy = await generateVideoCopy({ brief, product: productName, platform, tone, goal });
      setResults(copy);
      if (copy.length) toast.success('AI 已生成 ' + copy.length + (assetKind === 'text' ? ' 条文案' : ' 个贴纸短句'));
      else toast.warning('暂时没有生成可用内容，请补充主题后重试');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI 文案生成失败，请检查服务连接');
    } finally {
      setGenerating(false);
    }
  };
  const addAsset = (item: typeof PRESETS[number] | StickerPreset) => {
    if (assetKind === 'text') {
      const preset = item as typeof PRESETS[number];
      setSelectedPreset(preset.title);
      addText(preset.text, preset.title, preset);
    } else {
      const preset = item as StickerPreset;
      setSelectedPreset(preset.title);
      addSticker(preset.text, preset.title, preset.style);
    }
  };
  const addSequence = (text: string, index: number) => {
    const start = Math.min(duration - 0.1, currentTime + index * secondsPerLine);
    const layer = assetKind === 'text'
      ? newTextLayer(text, 'AI 文案 ' + (index + 1), start, Math.min(duration, start + secondsPerLine))
      : newStickerLayer(text, 'AI 贴纸 ' + (index + 1), start, Math.min(duration, start + secondsPerLine), ['purple', 'gold', 'cyan', 'red'][index % 4] as StickerPreset['style']);
    if (assetKind === 'text') layer.properties.backgroundOpacity = 0.2;
    setLayers(previous => [...previous, layer]);
    setSelectedLayerId(layer.id);
    toast.success('文案已排入字幕轨道');
  };
  const duplicate = () => {
    if (!selectedAsset) return;
    const clone = { ...selectedAsset, id: selectedAsset.type + '_' + (crypto.randomUUID?.() || Date.now()), name: selectedAsset.name + ' 副本', start: Math.min(duration - 0.1, selectedAsset.start + 0.25), end: Math.min(duration, selectedAsset.end + 0.25), properties: { ...selectedAsset.properties } };
    setLayers(previous => [...previous, clone]);
    setSelectedLayerId(clone.id);
  };
  const remove = () => {
    if (!selectedAsset) return;
    setLayers(previous => previous.filter(layer => layer.id !== selectedAsset.id));
    setSelectedLayerId(null);
    toast.success('已删除当前片段');
  };
  const addSequenceGroup = () => {
    results.forEach((text, index) => {
      const start = Math.min(duration - 0.1, currentTime + index * secondsPerLine);
      const layer = assetKind === 'text'
        ? newTextLayer(text, 'AI 文案 ' + (index + 1), start, Math.min(duration, start + secondsPerLine))
        : newStickerLayer(text, 'AI 贴纸 ' + (index + 1), start, Math.min(duration, start + secondsPerLine), ['purple', 'gold', 'cyan', 'red'][index % 4] as StickerPreset['style']);
      if (assetKind === 'text') layer.properties.backgroundOpacity = 0.2;
      setLayers(previous => [...previous, layer]);
      if (index === 0) setSelectedLayerId(layer.id);
    });
    toast.success('已将生成文案按间隔排入时间轴');
  };

  return <main className="text-studio-page">
    <header className="text-studio-heading">
      <div><span className="text-studio-eyebrow">TEXT & CAPTIONS</span><h1>文本工作台</h1><p>文案与贴纸在同一张画布完成设计，预览、属性和剪辑时间轴实时联动。</p></div>
      <div className="text-studio-heading-actions"><span className="text-studio-sync"><i /> 实时同步剪辑</span><button type="button" className="text-studio-add-button" onClick={() => assetKind === 'text' ? addText('双击编辑你的文字', '新建标题') : addSticker('新品推荐', '新建贴纸')}>{assetKind === 'text' ? '＋ 添加文字' : '＋ 添加贴纸'}</button></div>
    </header>
    <div className="text-studio-layout">
      <aside className="text-studio-library">
        <div className="text-studio-kind-tabs" role="tablist" aria-label="内容类型"><button type="button" className={assetKind === 'text' ? 'active' : ''} onClick={() => { setAssetKind('text'); setGroup('全部样式'); setSearch(''); }}>文案</button><button type="button" className={assetKind === 'sticker' ? 'active' : ''} onClick={() => { setAssetKind('sticker'); setGroup('全部贴纸'); setSearch(''); }}>贴纸</button></div>
        <section className="text-ai-panel text-ai-panel-top">
          <div className="text-ai-title"><span>{assetKind === 'text' ? '✦' : '✧'}</span><div><b>{assetKind === 'text' ? 'AI 文案工坊' : 'AI 贴纸工坊'}</b><small>{assetKind === 'text' ? '生成适合叠加在画面上的短句' : '根据主题生成可直接使用的贴纸短句'}</small></div></div>
          <label className="text-ai-field"><span>主题或产品卖点</span><textarea value={brief} onChange={event => setBrief(event.target.value)} placeholder="例如：春季通勤亚麻衬衫，突出透气和好搭配" rows={3} /></label>
          <div className="text-ai-options"><label><span>表达风格</span><select value={tone} onChange={event => setTone(event.target.value)}><option>高级自然</option><option>轻松口语</option><option>温柔治愈</option><option>活力年轻</option><option>简洁专业</option></select></label><label><span>文案目标</span><select value={goal} onChange={event => setGoal(event.target.value)}><option>突出核心卖点</option><option>吸引开场停留</option><option>促进评论互动</option><option>引导用户选购</option><option>强调品牌氛围</option></select></label><label><span>发布平台</span><select value={platform} onChange={event => setPlatform(event.target.value)}><option>短视频</option><option>抖音</option><option>小红书</option><option>视频号</option><option>商品详情视频</option></select></label></div>
          <button type="button" className="text-ai-generate" disabled={generating || !brief.trim()} onClick={() => void generateCopy()}>{generating ? '正在生成…' : assetKind === 'text' ? '✦ 生成 5 条文案' : '✧ 生成 5 个贴纸'}</button>
          {results.length > 0 && <div className="text-ai-results"><div className="text-ai-results-head"><b>生成结果</b><button type="button" onClick={addSequenceGroup}>全部排入轨道</button></div>{results.map((text, index) => <div className="text-ai-result" key={text + index}><p>{text}</p><button type="button" onClick={() => assetKind === 'text' ? addText(text, 'AI 文案 ' + (index + 1)) : addSticker(text, 'AI 贴纸 ' + (index + 1), ['purple', 'gold', 'cyan', 'red'][index % 4] as StickerPreset['style'])}>添加</button><button type="button" onClick={() => addSequence(text, index)}>排入</button></div>)}</div>}
        </section>
        <div className="text-studio-section-title"><div><b>{assetKind === 'text' ? '文案样式' : '贴纸素材'}</b><small>{assetKind === 'text' ? '选择一款加入当前时间点' : '可搜索、AI 生成并直接加入画面'}</small></div><span>{assetKind === 'text' ? PRESETS.length + ' 款' : STICKER_PRESETS.length + ' 款'}</span></div>
        <label className="text-studio-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={assetKind === 'text' ? '搜索样式或文案' : '搜索贴纸名称或用途'} /></label>
        <div className="text-studio-groups">{(assetKind === 'text' ? GROUPS : STICKER_GROUPS).map(item => <button key={item} type="button" className={group === item ? 'active' : ''} onClick={() => setGroup(item)}>{item}</button>)}</div>
        <div className="text-studio-preset-list">
          {filteredPresets.map((preset, index) => <button key={preset.title} type="button" className={'text-preset-card tone-' + (index % 5) + (assetKind === 'sticker' ? ' sticker-preset-card' : '') + (selectedPreset === preset.title ? ' active' : '')} onClick={() => addAsset(preset)}>
            {assetKind === 'text' ? <><span className="text-preset-preview" style={{ color: (preset as typeof PRESETS[number]).color, fontSize: Math.max(12, (preset as typeof PRESETS[number]).size * 0.46), fontWeight: 800 }}>{preset.text.split('\n')[0]}</span>{preset.text.includes('\n') && <span className="text-preset-second">{preset.text.split('\n')[1]}</span>}</> : <span className={'sticker-preset-glyph style-' + (preset as StickerPreset).style}>{(preset as StickerPreset).icon}</span>}
            <span className="text-preset-meta"><b>{preset.title}</b><small>{preset.group} · {assetKind === 'text' ? ((preset as typeof PRESETS[number]).animation === 'fade' ? '淡入' : (preset as typeof PRESETS[number]).animation === 'zoom' ? '缩放' : (preset as typeof PRESETS[number]).animation === 'slide' ? '滑入' : '打字') : '点击添加'}</small></span><span className="text-preset-plus">＋</span>
          </button>)}
          {filteredPresets.length === 0 && <div className="text-studio-empty">没有匹配样式，试试其他关键词。</div>}
        </div>
      </aside>

      <section className="text-studio-preview-column">
        <div className="text-preview-toolbar"><div><span className="text-preview-live-dot" /><b>画面预览</b><small>点击字幕选中 · 双击定位</small></div><div className="text-preview-toolbar-actions"><button type="button" onClick={() => setCurrentTime(0)} title="回到开头">⏮</button><button type="button" className="text-preview-play" onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? 'Ⅱ 暂停' : '▶ 播放'}</button><button type="button" onClick={() => setCurrentTime(duration)} title="跳到结尾">⏭</button><span>{ratio.replace('-', ':')}</span></div></div>
        <div ref={previewStageRef} className={'text-preview-stage ratio-' + ratio}>
          {media?.properties.src ? media.properties.isVideo
            ? <video ref={videoRef} className="text-preview-media" src={media.properties.src} muted playsInline onEnded={() => setIsPlaying(false)} />
            : <img className="text-preview-media" src={media.properties.src} alt="当前剪辑画面" />
            : <div className="text-preview-placeholder"><span>▧</span><b>当前还没有画面素材</b><small>加入商品图或视频后，能在这里检查字幕构图。</small></div>}
          <div className="text-preview-vignette" />
          {visibleLayers.map(layer => {
            const animation = getTextAnimationState(layer, currentTime);
            const layerX = layer.x ?? 50;
            const layerY = layer.y ?? 80;
            const layerScale = layer.scale ?? 1;
            const layerOpacity = layer.opacity ?? 1;
            const isSticker = layer.type === 'sticker';
            return <div key={layer.id} className={'text-preview-overlay' + (isSticker ? ' text-preview-sticker style-' + (layer.properties.style || 'purple') : '') + (layer.id === selectedLayerId ? ' selected' : '')} style={{
            left: layerX + '%', top: layerY + '%', opacity: layerOpacity * animation.opacity,
            transform: 'translate(-50%, calc(-50% + ' + animation.offsetY + 'px)) rotate(' + (layer.properties.rotation ?? 0) + 'deg) scale(' + (layerScale * animation.scale) + ')',
            color: isSticker ? undefined : layer.properties.color || '#fff',
            fontFamily: "'" + (layer.properties.fontFamily || 'Outfit') + "', sans-serif",
            fontSize: isSticker ? undefined : ((layer.properties.fontSize || 32) * 0.72) + 'px',
            fontWeight: layer.properties.bold === false ? 500 : 800,
            fontStyle: layer.properties.italic ? 'italic' : 'normal',
            textAlign: layer.properties.textAlign || 'center',
            textShadow: layer.properties.shadow ? '0 2px 8px rgba(0,0,0,.85)' : 'none',
            WebkitTextStroke: layer.properties.outlineWidth ? Math.max(0.5, layer.properties.outlineWidth * 0.35) + 'px ' + (layer.properties.outlineColor || '#101318') : undefined,
            background: isSticker ? undefined : layer.properties.backgroundColor && (layer.properties.backgroundOpacity ?? 0) > 0
              ? layer.properties.backgroundColor + Math.round((layer.properties.backgroundOpacity ?? 0) * 255).toString(16).padStart(2, '0') : 'transparent',
            padding: isSticker ? undefined : layer.properties.backgroundColor ? ((layer.properties.padding ?? 12) * 0.45) + 'px' : 0
          }} onPointerDown={event => {
            event.stopPropagation();
            setSelectedLayerId(layer.id);
            setIsPlaying(false);
            dragStateRef.current = { id: layer.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, layerX, layerY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }} onDoubleClick={() => setCurrentTime(layer.start)}>{isSticker ? <><span className="text-preview-sticker-icon">✦</span>{animation.text || '贴纸'}</> : animation.text || '空文字图层'}</div>;
          })}
          {visibleLayers.length === 0 && <div className="text-preview-safe-guides"><span>安全字幕区</span></div>}
          <div className="text-preview-timecode">{currentTime.toFixed(2)}s / {duration.toFixed(1)}s</div>
        </div>
        <div className="text-preview-transport"><button type="button" title="回到开头" onClick={() => { setIsPlaying(false); setCurrentTime(0); }}>⏮</button><button type="button" className="text-preview-transport-play" onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? 'Ⅱ' : '▶'}</button><button type="button" title="前一帧" onClick={() => { setIsPlaying(false); setCurrentTime(previous => Math.max(0, previous - 1 / 30)); }}>‹|</button><button type="button" title="后一帧" onClick={() => { setIsPlaying(false); setCurrentTime(previous => Math.min(duration, previous + 1 / 30)); }}>|›</button><input aria-label="预览播放进度" type="range" min="0" max={duration} step="0.01" value={Math.min(currentTime, duration)} onChange={event => { setIsPlaying(false); setCurrentTime(Number(event.target.value)); }} /><output>{currentTime.toFixed(2)}s</output></div>
        <div className="text-studio-timeline"><div className="text-timeline-head"><div><b>内容轨道</b><span>{visualLayers.length} 个片段 · 文案 {textLayers.length} · 贴纸 {stickerLayers.length}</span></div><label>默认时长<select value={secondsPerLine} onChange={event => setSecondsPerLine(Number(event.target.value))}><option value={2}>2 秒</option><option value={3}>3 秒</option><option value={4}>4 秒</option><option value={5}>5 秒</option><option value={6}>6 秒</option></select></label></div><div className="text-mini-ruler"><span>00:00</span><span>00:{String(Math.round(duration / 2)).padStart(2, '0')}</span><span>00:{String(Math.round(duration)).padStart(2, '0')}</span></div><div className="text-mini-tracks">{visualLayers.length === 0 ? <button type="button" className="text-timeline-empty" onClick={() => assetKind === 'text' ? addText('输入你的标题文字', '新建标题') : addSticker('新品推荐', '新建贴纸')}>＋ 添加第一条{assetKind === 'text' ? '文字' : '贴纸'}轨道</button> : visualLayers.map(layer => <div key={layer.id} className={'text-mini-track-row' + (layer.id === selectedLayerId ? ' active' : '')}><button type="button" className="text-mini-track-name" onClick={() => { setSelectedLayerId(layer.id); setCurrentTime(layer.start); }}>{layer.type === 'sticker' ? '✦' : layer.visible ? 'T' : '⊘'} <span>{layer.name}</span></button><button type="button" className={'text-mini-clip ' + (layer.type === 'sticker' ? 'sticker-clip ' : '') + (layer.id === selectedLayerId ? 'active' : '')} style={{ left: layer.start / duration * 100 + '%', width: Math.max(3, (layer.end - layer.start) / duration * 100) + '%' }} onClick={() => { setSelectedLayerId(layer.id); setCurrentTime(layer.start); }} title={(layer.properties.text || '内容片段') + ' · ' + layer.start.toFixed(1) + '-' + layer.end.toFixed(1) + ' 秒'}>{layer.properties.text || '内容片段'}</button></div>)}</div></div>
      </section>

      <aside className="text-studio-inspector">
        <div className="text-studio-section-title"><div><b>{selectedText?.type === 'sticker' ? '贴纸属性' : '文字属性'}</b><small>{selectedText ? selectedText.name : '选择文案或贴纸以调整'}</small></div><div className="text-inspector-tools"><button type="button" disabled={!selectedText} onClick={duplicate}>复制</button><button type="button" disabled={!selectedText} onClick={remove}>删除</button></div></div>
        {selectedText ? <div className="text-inspector-content">
          <label className="text-inspector-field text-inspector-content-field"><span>{selectedText.type === 'sticker' ? '贴纸文字' : '画面文案'}</span><textarea value={selectedText.properties.text || ''} onChange={event => patchProperties({ text: event.target.value })} rows={4} maxLength={180} placeholder={selectedText.type === 'sticker' ? '输入贴纸短句' : '输入字幕或标题'} /><small>{(selectedText.properties.text || '').length}/180</small></label>
          {selectedText.type === 'sticker' && <section className="text-inspector-section"><h3>贴纸样式</h3><label className="text-inspector-field"><span>配色风格</span><select value={selectedText.properties.style || 'purple'} onChange={event => patchProperties({ style: event.target.value as Layer['properties']['style'] })}><option value="purple">霓虹紫粉</option><option value="gold">活力金橙</option><option value="cyan">清爽青蓝</option><option value="red">热力红粉</option><option value="black">质感黑金</option></select></label><p className="text-inspector-hint">贴纸会在预览和成片中以高亮徽章呈现，可拖动到任意位置。</p></section>}
          <section className="text-inspector-section"><h3>字体与排版</h3><label className="text-inspector-field"><span>字体</span><select value={selectedText.properties.fontFamily || 'Outfit'} onChange={event => patchProperties({ fontFamily: event.target.value })}>{FONT_OPTIONS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}</select></label><div className="text-inspector-format"><div>{[['bold', 'B'], ['italic', 'I']].map(([key, label]) => <button type="button" key={key} className={selectedText.properties[key as 'bold' | 'italic'] ? 'active' : ''} onClick={() => patchProperties({ [key]: !selectedText.properties[key as 'bold' | 'italic'] })}><span>{label}</span></button>)}</div><div>{(['left', 'center', 'right'] as const).map((align, index) => <button type="button" key={align} className={(selectedText.properties.textAlign || 'center') === align ? 'active' : ''} onClick={() => patchProperties({ textAlign: align })} aria-label={align + ' 对齐'}>{['≡', '☰', '≡'][index]}</button>)}</div></div><label className="text-inspector-slider"><span>字号 <b>{selectedText.properties.fontSize ?? 32}px</b></span><input type="range" min="12" max="110" value={selectedText.properties.fontSize ?? 32} onChange={event => patchProperties({ fontSize: Number(event.target.value) })} /></label><label className="text-inspector-field"><span>文字颜色</span><div className="text-color-control"><input type="color" value={selectedText.properties.color || '#ffffff'} onChange={event => patchProperties({ color: event.target.value })} aria-label="选择文字颜色" /><div className="text-color-swatches">{SWATCHES.map(color => <button type="button" key={color} className={(selectedText.properties.color || '#ffffff').toLowerCase() === color ? 'active' : ''} style={{ background: color }} onClick={() => patchProperties({ color })} aria-label={'文字颜色 ' + color} />)}</div></div></label></section>
          <section className="text-inspector-section"><h3>画面位置</h3><label className="text-inspector-slider"><span>大小 <b>{Math.round((selectedText.scale ?? 1) * 100)}%</b></span><input type="range" min="25" max="250" value={Math.round((selectedText.scale ?? 1) * 100)} onChange={event => patchLayer(selectedText.id, { scale: Number(event.target.value) / 100 })} /></label><label className="text-inspector-slider"><span>旋转 <b>{selectedText.properties.rotation ?? 0}°</b></span><input type="range" min="-180" max="180" value={selectedText.properties.rotation ?? 0} onChange={event => patchProperties({ rotation: Number(event.target.value) })} /></label><label className="text-inspector-slider"><span>水平位置 <b>{Math.round(selectedText.x ?? 50)}%</b></span><input type="range" min="0" max="100" value={selectedText.x ?? 50} onChange={event => patchLayer(selectedText.id, { x: Number(event.target.value) })} /></label><label className="text-inspector-slider"><span>垂直位置 <b>{Math.round(selectedText.y ?? 80)}%</b></span><input type="range" min="0" max="100" value={selectedText.y ?? 80} onChange={event => patchLayer(selectedText.id, { y: Number(event.target.value) })} /></label><label className="text-inspector-slider"><span>不透明度 <b>{Math.round((selectedText.opacity ?? 1) * 100)}%</b></span><input type="range" min="10" max="100" value={Math.round((selectedText.opacity ?? 1) * 100)} onChange={event => patchLayer(selectedText.id, { opacity: Number(event.target.value) / 100 })} /></label><button type="button" className="text-safe-area-button" onClick={() => { patchLayer(selectedText.id, { x: 50, y: 80, scale: 1 }); patchProperties({ textAlign: 'center' }); toast.success('已将字幕放入画面安全区'); }}>⌖ 放入安全字幕区</button></section>
          <section className="text-inspector-section"><h3>描边与底板</h3><label className="text-inspector-slider"><span>描边粗细 <b>{selectedText.properties.outlineWidth ?? 0}px</b></span><input type="range" min="0" max="12" value={selectedText.properties.outlineWidth ?? 0} onChange={event => patchProperties({ outlineWidth: Number(event.target.value) })} /></label><label className="text-inspector-field"><span>底板颜色</span><div className="text-color-control"><input type="color" value={selectedText.properties.backgroundColor || '#101318'} onChange={event => patchProperties({ backgroundColor: event.target.value })} aria-label="选择底板颜色" /><label className="text-inspector-inline-toggle"><input type="checkbox" checked={(selectedText.properties.backgroundOpacity ?? 0) > 0} onChange={event => patchProperties({ backgroundColor: selectedText.properties.backgroundColor || '#101318', backgroundOpacity: event.target.checked ? 0.65 : 0 })} />显示底板</label></div></label>{(selectedText.properties.backgroundOpacity ?? 0) > 0 && <label className="text-inspector-slider"><span>底板透明度 <b>{Math.round((selectedText.properties.backgroundOpacity ?? 0) * 100)}%</b></span><input type="range" min="10" max="95" value={Math.round((selectedText.properties.backgroundOpacity ?? 0) * 100)} onChange={event => patchProperties({ backgroundOpacity: Number(event.target.value) / 100 })} /></label>}<label className="text-inspector-inline-toggle"><input type="checkbox" checked={!!selectedText.properties.shadow} onChange={event => patchProperties({ shadow: event.target.checked })} />文字阴影</label></section>
          <section className="text-inspector-section"><h3>动画与时长</h3><label className="text-inspector-field"><span>入场动画</span><select value={selectedText.properties.animation || 'fade'} onChange={event => patchProperties({ animation: event.target.value as Layer['properties']['animation'] })}><option value="fade">淡入</option><option value="zoom">轻柔缩放</option><option value="slide">向上滑入</option><option value="typewriter">逐字显示</option></select></label><div className="text-inspector-time-grid"><label><span>开始（秒）</span><input type="number" min="0" max={selectedText.end - 0.1} step="0.1" value={selectedText.start} onChange={event => patchLayer(selectedText.id, { start: clamp(Number(event.target.value), 0, selectedText.end - 0.1) })} /></label><label><span>结束（秒）</span><input type="number" min={selectedText.start + 0.1} max={duration} step="0.1" value={selectedText.end} onChange={event => patchLayer(selectedText.id, { end: clamp(Number(event.target.value), selectedText.start + 0.1, duration) })} /></label></div><label className="text-inspector-slider"><span>片段时长 <b>{(selectedText.end - selectedText.start).toFixed(1)}s</b></span><input type="range" min="0.5" max={Math.max(0.5, duration - selectedText.start)} step="0.1" value={Math.max(0.5, selectedText.end - selectedText.start)} onChange={event => patchLayer(selectedText.id, { end: Math.min(duration, selectedText.start + Number(event.target.value)) })} /></label></section>
          <label className="text-inspector-inline-toggle text-layer-visible"><input type="checkbox" checked={selectedText.visible !== false} onChange={event => patchLayer(selectedText.id, { visible: event.target.checked })} />在预览与成片中显示</label>
        </div> : <div className="text-inspector-empty"><span>{assetKind === 'sticker' ? '✦' : 'T'}</span><b>选择一条{assetKind === 'sticker' ? '贴纸' : '内容'}片段</b><p>从左侧插入内容，再调整大小、位置、角度、动画和显示时长。</p><button type="button" onClick={() => assetKind === 'text' ? addText('双击编辑你的文字', '新建标题') : addSticker('新品推荐', '新建贴纸')}>＋ 新建{assetKind === 'text' ? '文字' : '贴纸'}片段</button></div>}
      </aside>
    </div>
  </main>;
};
