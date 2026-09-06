import type { Layer } from '../VideoCanvas';

interface Props {
  layer: Layer;
  update: (updater: (properties: Layer['properties']) => void) => void;
}

const colors = ['#ffffff', '#00f2fe', '#ff007f', '#ffb703', '#8a2be2', '#52ff52'];

export function LayerTypeControls({ layer, update }: Props) {
  const set = <K extends keyof Layer['properties']>(key: K, value: Layer['properties'][K]) => update(properties => { properties[key] = value; });

  if (layer.type === 'text') return <>
    <div className="property-group"><span className="property-label">修改文本</span><input className="text-input" value={layer.properties.text || ''} onChange={e => set('text', e.target.value)} /></div>
    <div className="property-group"><span className="property-label"><span>字体大小</span><span>{layer.properties.fontSize}px</span></span><input className="slider-input" type="range" min="18" max="72" value={layer.properties.fontSize || 32} onChange={e => set('fontSize', Number(e.target.value))} /></div>
    <div className="property-group"><span className="property-label">文本颜色</span><div className="color-picker-grid">{colors.map(color => <button key={color} className={`color-option ${layer.properties.color === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => set('color', color)} aria-label={`选择颜色 ${color}`} />)}</div></div>
    <div className="property-group"><span className="property-label">出场动画</span><select className="text-input" value={layer.properties.animation || 'fade'} onChange={e => set('animation', e.target.value as NonNullable<Layer['properties']['animation']>)}><option value="fade">渐显入场 (Fade)</option><option value="typewriter">逐字打印 (Typewriter)</option><option value="zoom">弹性缩放 (Zoom)</option><option value="slide">向上滑入 (Slide)</option></select></div>
    <div className="property-group"><span className="property-label">文本风格</span><div className="property-checkbox-row"><label><input type="checkbox" checked={!!layer.properties.bold} onChange={e => set('bold', e.target.checked)} />加粗</label><label><input type="checkbox" checked={!!layer.properties.shadow} onChange={e => set('shadow', e.target.checked)} />描边阴影</label></div></div>
  </>;

  if (layer.type === 'media') return <>
    <div className="property-group"><span className="property-label">视频过渡效果</span><select className="text-input" value={layer.properties.transitionType || 'none'} onChange={e => set('transitionType', e.target.value as NonNullable<Layer['properties']['transitionType']>)}><option value="none">无过渡 (None)</option><option value="fade">交叉渐变 (Fade)</option><option value="slideLeft">向左滑动</option><option value="slideRight">向右滑动</option><option value="zoom">缩放过渡</option><option value="wipe">左右擦除</option></select></div>
    {layer.properties.transitionType && layer.properties.transitionType !== 'none' && <div className="property-group"><span className="property-label"><span>过渡时长</span><span>{(layer.properties.transitionDuration ?? 0.5).toFixed(1)}s</span></span><input className="slider-input" type="range" min="0.1" max="2" step="0.1" value={layer.properties.transitionDuration ?? 0.5} onChange={e => set('transitionDuration', Number(e.target.value))} /></div>}
    <div className="property-group property-checkbox-row"><label><input type="checkbox" checked={!!layer.properties.bgRemoved} onChange={e => set('bgRemoved', e.target.checked)} />智能抠图 (去除白/米背景)</label></div>
  </>;

  if (layer.type === 'sticker') return <>
    <div className="property-group"><span className="property-label">贴纸文案</span><input className="text-input" value={layer.properties.text || ''} onChange={e => set('text', e.target.value)} /></div>
    <div className="property-group"><span className="property-label">贴纸主题风格</span><select className="text-input" value={layer.properties.style || 'purple'} onChange={e => set('style', e.target.value as NonNullable<Layer['properties']['style']>)}><option value="purple">时尚极光紫</option><option value="cyan">潮流科技蓝</option><option value="gold">爆款温暖橙</option><option value="red">心动警示红</option><option value="black">高级碳素黑</option></select></div>
  </>;

  if (layer.type === 'audio') {
    const volume = layer.properties.volume ?? 0.8;
    return <div className="property-group"><span className="property-label"><span>音量大小</span><span>{Math.round(volume * 100)}%</span></span><input className="slider-input" type="range" min="0" max="1" step="0.05" value={volume} onChange={e => set('volume', Number(e.target.value))} /></div>;
  }
  return null;
}
