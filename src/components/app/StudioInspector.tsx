import { useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import type { Layer } from '../VideoCanvas';
import { LayerTypeControls } from '../property-inspector/LayerTypeControls';
import { formatStudioTimecode } from '../../utils/studioTimeline';

interface Props {
  mode: 'editor' | 'timeline';
  layers: Layer[];
  setLayers: Dispatch<SetStateAction<Layer[]>>;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="studio-property"><span>{label}</span>{children}</label>;
}

function AudioDebugControls({ layer, update }: { layer: Layer; update: (patch: Partial<Layer['properties']>) => void }) {
  const volume = layer.properties.volume ?? 0.8;
  const isMuted = volume <= 0;
  const isAudioLayer = layer.type === 'audio';
  return <div className="studio-audio-debug-controls">
    <div className="studio-audio-meter" aria-hidden="true"><span style={{ width: `${isAudioLayer ? Math.round(volume * 100) : 0}%` }} /></div>
    <label className="studio-slider-field">
      <span><b>音量</b><strong>{!isAudioLayer ? '需选择音频' : isMuted ? '静音' : `${Math.round(volume * 100)}%`}</strong></span>
      <input aria-label="音量" type="range" min="0" max="1" step="0.05" value={volume} disabled={!isAudioLayer} onChange={event => update({ volume: Number(event.target.value) })} />
    </label>
    <button type="button" className={`studio-mute-button ${isMuted ? 'active' : ''}`} disabled={!isAudioLayer} onClick={() => update({ volume: isMuted ? 0.8 : 0 })}>
      {isMuted ? '取消静音' : '静音'}
    </button>
  </div>;
}

export function StudioInspector({ mode, layers, setLayers, selectedLayerId, setSelectedLayerId, isCollapsed, onToggleCollapse }: Props) {
  const [tab, setTab] = useState('属性');
  const active = layers.find(layer => layer.id === selectedLayerId) ?? layers.find(layer => layer.type === 'media') ?? layers[0];
  const set = (patch: Partial<Layer>) => { if (active) setLayers(previous => previous.map(layer => layer.id === active.id ? { ...layer, ...patch } : layer)); };
  const properties = (patch: Partial<Layer['properties']>) => { if (active) set({ properties: { ...active.properties, ...patch } }); };
  const number = (label: string, value: number, update: (n: number) => void, min = 0, max = 100, step = 1, suffix = '') => <span className="studio-number"><input type="number" aria-label={label} value={Number(value.toFixed(3))} min={min} max={max} step={step} onChange={event => { if (event.target.value === '') return; const n = Number(event.target.value); if (Number.isFinite(n)) update(Math.min(max, Math.max(min, n))); }} /><span>{suffix}</span></span>;
  if (isCollapsed) return <button type="button" className="studio-inspector-expand" title="展开属性调试面板" aria-label="展开属性调试面板" onClick={onToggleCollapse}><span>›</span><b>属性</b></button>;
  return <aside className={`studio-inspector ${mode === 'timeline' ? 'clip-inspector' : ''}`} aria-label={mode === 'timeline' ? '片段设置' : '画面属性'}>
    <header className="studio-inspector-header">
      <div><b>{mode === 'timeline' ? '片段设置' : '属性调试'}</b><small>{active ? `正在编辑：${active.name}` : '请选择一个图层'}</small></div>
      <div className="studio-inspector-header-actions">
        {mode === 'timeline' && <button type="button" title="取消选中片段" aria-label="取消选中片段" onClick={() => setSelectedLayerId(null)}>×</button>}
        {onToggleCollapse && <button type="button" className="studio-inspector-collapse" title="收起属性调试面板" aria-label="收起属性调试面板" onClick={onToggleCollapse}>收起 <span>›</span></button>}
      </div>
    </header>
    {mode === 'editor' && <div className="studio-inspector-tabs" role="tablist" aria-label="属性调试页签">{['属性', '动画', '音频'].map(item => <button key={item} type="button" role="tab" aria-selected={tab === item} aria-controls={`inspector-panel-${item}`} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}<small>{item === '属性' ? '画面与时间' : item === '动画' ? '入场与过渡' : '音量与静音'}</small></button>)}</div>}
    {active ? <div className="studio-inspector-body">
      {mode === 'editor' && <div className="studio-inspector-target"><label htmlFor="studio-inspector-layer">当前图层</label><select id="studio-inspector-layer" value={active.id} onChange={event => setSelectedLayerId(event.target.value)}>{layers.map(layer => <option key={layer.id} value={layer.id}>{layer.name} · {layer.type === 'audio' ? '音频' : layer.type === 'media' ? '画面' : layer.type === 'text' ? '文字' : '贴纸'}</option>)}</select></div>}
      {mode === 'timeline' && <div className="studio-clip-summary"><div className="studio-clip-thumb" style={{ backgroundImage: active.properties.poster || (!active.properties.isVideo && active.properties.src) ? `url(${active.properties.poster || active.properties.src})` : undefined }} /><div><b>{active.name}</b><small>{formatStudioTimecode(active.start)}–{formatStudioTimecode(active.end)} · {(active.end - active.start).toFixed(1)}s</small><small>{active.type === 'media' ? '来自 AI 分镜 / 素材库' : '时间轴图层'}</small></div></div>}
      {(mode === 'timeline' || tab === '属性') && <>
        {mode === 'editor' && active.type !== 'audio' && <section><h4>变换</h4><div className="studio-property-grid"><label><span>X 位置</span>{number('X 位置', active.x, n => set({ x: n }), 0, 100, 1, '%')}</label><label><span>Y 位置</span>{number('Y 位置', active.y, n => set({ y: n }), 0, 100, 1, '%')}</label><label><span>缩放</span>{number('缩放', active.scale * 100, n => set({ scale: n / 100 }), 10, 300, 1, '%')}</label><label><span>旋转</span>{number('旋转', active.properties.rotation ?? 0, n => properties({ rotation: n }), -360, 360, 1, '°')}</label></div></section>}
        <section><h4>{mode === 'timeline' ? '时间' : '播放'}</h4>
          {mode === 'editor' && <Field label="当前片段"><span className="studio-value">{active.name}</span></Field>}
          <Field label="入点">{number('入点（秒）', active.start, n => set({ start: n }), 0, Math.max(0, active.end - 0.1), 0.1, 's')}</Field>
          <Field label="出点">{number('出点（秒）', active.end, n => set({ end: n }), active.start + 0.1, 3600, 0.1, 's')}</Field>
          {active.properties.isVideo && <Field label="变速"><span className="studio-value">{(active.properties.speed ?? 1).toFixed(1)}×</span></Field>}
          {active.type === 'audio' && <Field label="音量">{number('音量', (active.properties.volume ?? 0.8) * 100, n => properties({ volume: n / 100 }), 0, 100, 1, '%')}</Field>}
        </section>
        {active.type === 'media' && <section><h4>转场</h4><Field label="类型"><select aria-label="转场类型" value={active.properties.transitionType || 'none'} onChange={event => properties({ transitionType: event.target.value as Layer['properties']['transitionType'] })}><option value="none">无转场</option><option value="fade">交叉溶解</option><option value="slideLeft">向左滑动</option><option value="slideRight">向右滑动</option><option value="zoom">缩放</option><option value="wipe">擦除</option></select></Field><Field label="时长">{number('转场时长', active.properties.transitionDuration ?? 0.4, n => properties({ transitionDuration: n }), 0.1, 2, 0.1, 's')}</Field></section>}
        {active.type !== 'audio' && <section><h4>画面</h4><Field label="不透明度">{number('不透明度', active.opacity * 100, n => set({ opacity: n / 100 }), 0, 100, 1, '%')}</Field><Field label="混合模式"><select aria-label="混合模式" value={active.properties.blendMode || 'source-over'} onChange={event => properties({ blendMode: event.target.value as Layer['properties']['blendMode'] })}><option value="source-over">正常</option><option value="multiply">正片叠底</option><option value="screen">滤色</option></select></Field></section>}
      </>}
      {mode === 'editor' && tab === '动画' && <section id="inspector-panel-动画"><h4>入场与过渡</h4>{active.type === 'audio' ? <p className="studio-inspector-note">音频图层没有画面入场动画。请切换到“音频”页签调节音量，或选择画面/文字图层调试动画。</p> : <LayerTypeControls layer={active} update={updater => { const next = { ...active.properties }; updater(next); properties(next); }} />}</section>}
      {mode === 'editor' && tab === '音频' && <section id="inspector-panel-音频"><h4>音频调试</h4><AudioDebugControls layer={active} update={properties} />{active.type !== 'audio' && <p className="studio-inspector-note">当前图层不是独立音频。请在“当前图层”中选择人声或 BGM 图层后调节音量和静音。</p>}</section>}
      {(active.type === 'text' || active.type === 'sticker') && tab === '属性' && <section><h4>文字内容</h4><textarea aria-label="文字内容" value={active.properties.text || ''} onChange={event => properties({ text: event.target.value })} /></section>}
      <p className="studio-inspector-note">拖动时间轴上的片段调整节奏；拖动片段两侧可裁剪。点击画面或分镜卡片，选择需要编辑的内容。</p>
    </div> : <div className="studio-inspector-empty"><span>◫</span><b>选择一个片段</b><p>点击时间轴或画面中的内容，在这里精细调整。</p></div>}
  </aside>;
}
