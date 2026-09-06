import React, { useRef } from 'react';
import type { Layer } from './VideoCanvas';
import { toast } from './toastStore';
import { LayerTypeControls } from './property-inspector/LayerTypeControls';

interface PropertyInspectorProps {
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  layers,
  setLayers,
  selectedLayerId,
  setSelectedLayerId,
  isCollapsed,
  onToggleCollapse,
}) => {
  const duplicateSequence = useRef(0);
  const activeLayer = layers.find((l) => l.id === selectedLayerId);

  const updateLayerProp = (updater: (properties: Layer['properties']) => void) => {
    setLayers(
      layers.map((l) => {
        if (l.id === selectedLayerId) {
          const updatedProps = { ...l.properties };
          updater(updatedProps);
          return { ...l, properties: updatedProps };
        }
        return l;
      })
    );
  };

  const updateBaseProp = (key: 'x' | 'y' | 'scale' | 'opacity' | 'start' | 'end', val: number) => {
    setLayers(
      layers.map((l) => {
        if (l.id === selectedLayerId) {
          return { ...l, [key]: val };
        }
        return l;
      })
    );
  };

  const deleteLayer = () => {
    if (selectedLayerId) {
      setLayers(layers.filter((l) => l.id !== selectedLayerId));
      setSelectedLayerId(null);
      toast.info('已删除所选图层');
    }
  };

  const duplicateLayer = () => {
    if (!activeLayer) return;
    duplicateSequence.current += 1;
    const clonedId = `${activeLayer.type}_${activeLayer.id}_copy_${duplicateSequence.current}`;
    const cloned: Layer = {
      ...JSON.parse(JSON.stringify(activeLayer)),
      id: clonedId,
      name: `${activeLayer.name} (副本)`,
      x: Math.min(88, activeLayer.x + 4),
      y: Math.min(88, activeLayer.y + 4)
    };
    setLayers(prev => [...prev, cloned]);
    setSelectedLayerId(clonedId);
    toast.success(`已复制图层「${cloned.name}」`);
  };

  const bringToFront = () => {
    if (!activeLayer) return;
    setLayers(prev => [...prev.filter(l => l.id !== activeLayer.id), activeLayer]);
    toast.success(`已将「${activeLayer.name}」置于最顶层`);
  };

  const sendToBack = () => {
    if (!activeLayer) return;
    setLayers(prev => [activeLayer, ...prev.filter(l => l.id !== activeLayer.id)]);
    toast.success(`已将「${activeLayer.name}」置于最底层`);
  };

  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        style={{
          position: 'absolute',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'var(--bg-surface-solid)',
          border: '1px solid var(--border-color)',
          borderRight: 'none',
          borderTopLeftRadius: '8px',
          borderBottomLeftRadius: '8px',
          padding: '12px 6px',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          zIndex: 20,
          boxShadow: 'var(--glass-shadow)',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.2s'
        }}
        title="展开右侧属性看板 (◀)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span style={{ writingMode: 'vertical-rl', letterSpacing: '2px', fontSize: '11px', fontWeight: '600' }}>属性看板</span>
      </button>
    );
  }

  if (!activeLayer) {
    const totalLayers = layers.length;
    const mediaCount = layers.filter(l => l.type === 'media').length;
    const textCount = layers.filter(l => l.type === 'text').length;
    const stickerCount = layers.filter(l => l.type === 'sticker').length;
    const audioCount = layers.filter(l => l.type === 'audio').length;
    const maxDuration = layers.length > 0 ? Math.max(...layers.map(l => l.end)) : 15;

    return (
      <div className="property-inspector">
        <div className="inspector-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="inspector-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            工程状态看板
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              title="收起右侧看板，放大预览"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>

        <div className="inspector-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Project Health Card */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📊 <span>当前项目概览</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: 'var(--bg-element)', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>图层总数</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-cyan)' }}>{totalLayers}</div>
              </div>
              <div style={{ background: 'var(--bg-element)', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>视频总时长</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-purple)' }}>{maxDuration.toFixed(1)}s</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🎬 画面/分镜素材:</span>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{mediaCount} 个</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>✍️ 营销卖点文案:</span>
                <span style={{ fontWeight: '600', color: '#f59e0b' }}>{textCount} 个</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🏷️ 活动促销贴纸:</span>
                <span style={{ fontWeight: '600', color: '#ec4899' }}>{stickerCount} 个</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🎵 背景卡点音轨:</span>
                <span style={{ fontWeight: '600', color: 'var(--accent-cyan)' }}>{audioCount} 个</span>
              </div>
            </div>
          </div>

          {/* Shortcut Cheatsheet Card */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⌨️ <span>专业剪辑快捷键</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>播放 / 暂停</span>
                <kbd style={{ background: 'var(--kbd-bg)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--mono)', color: 'var(--text-primary)', fontWeight: '600' }}>Space</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>删除选中图层</span>
                <kbd style={{ background: 'var(--kbd-bg)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--mono)', color: 'var(--text-primary)', fontWeight: '600' }}>Delete</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>撤销最近操作</span>
                <kbd style={{ background: 'var(--kbd-bg)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--mono)', color: 'var(--text-primary)', fontWeight: '600' }}>Ctrl + Z</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>重做操作</span>
                <kbd style={{ background: 'var(--kbd-bg)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--mono)', color: 'var(--text-primary)', fontWeight: '600' }}>Ctrl + Y</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>退出全屏预览</span>
                <kbd style={{ background: 'var(--kbd-bg)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--mono)', color: 'var(--text-primary)', fontWeight: '600' }}>Esc</kbd>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.6' }}>
            💡 提示：在画布中点击图层或在下方时间轴选中色块，即可在此处精细微调对齐与动效属性。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="property-inspector">
      <div className="inspector-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="inspector-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>{activeLayer.name} 属性</span>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            title="收起右侧属性栏，放大预览"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      <div className="inspector-content">
        {/* Layer Start/End Timing controls */}
        <div className="property-group">
          <span className="property-label">
            <span>开始时间</span>
            <span>{activeLayer.start.toFixed(1)}s</span>
          </span>
          <input
            type="range"
            min="0"
            max="14"
            step="0.5"
            value={activeLayer.start}
            onChange={(e) => updateBaseProp('start', parseFloat(e.target.value))}
            className="slider-input"
          />
        </div>

        <div className="property-group">
          <span className="property-label">
            <span>结束时间</span>
            <span>{activeLayer.end.toFixed(1)}s</span>
          </span>
          <input
            type="range"
            min="1"
            max="15"
            step="0.5"
            value={activeLayer.end}
            onChange={(e) => updateBaseProp('end', parseFloat(e.target.value))}
            className="slider-input"
          />
        </div>

        {/* Base transforms - Position & scale for visible canvas items */}
        {activeLayer.type !== 'audio' && (
          <>
            <div className="property-group">
              <span className="property-label">
                <span>位置 X (水平)</span>
                <span>{activeLayer.x.toFixed(0)}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={activeLayer.x}
                onChange={(e) => updateBaseProp('x', parseInt(e.target.value))}
                className="slider-input"
              />
            </div>

            <div className="property-group">
              <span className="property-label">
                <span>位置 Y (垂直)</span>
                <span>{activeLayer.y.toFixed(0)}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={activeLayer.y}
                onChange={(e) => updateBaseProp('y', parseInt(e.target.value))}
                className="slider-input"
              />
            </div>

            {/* Quick Alignment Matrix */}
            <div className="property-group">
              <span className="property-label">
                <span>一键智能对齐</span>
              </span>
              <div className="align-matrix-grid">
                <button
                  type="button"
                  className="align-grid-btn"
                  onClick={() => {
                    updateBaseProp('x', 50);
                    toast.success('已水平居中');
                  }}
                  title="水平居中 (x: 50%)"
                >
                  <span>↔️</span>
                  <span>水平居中</span>
                </button>
                <button
                  type="button"
                  className="align-grid-btn"
                  onClick={() => {
                    updateBaseProp('y', 50);
                    toast.success('已垂直居中');
                  }}
                  title="垂直居中 (y: 50%)"
                >
                  <span>↕️</span>
                  <span>垂直居中</span>
                </button>
                <button
                  type="button"
                  className="align-grid-btn"
                  onClick={() => {
                    updateBaseProp('x', 50);
                    updateBaseProp('y', 50);
                    toast.success('已全局居中对齐');
                  }}
                  title="全局正中心 (50%, 50%)"
                >
                  <span>🎯</span>
                  <span>正中心</span>
                </button>
                <button
                  type="button"
                  className="align-grid-btn"
                  onClick={() => {
                    updateBaseProp('x', 20);
                    toast.success('已靠左对齐');
                  }}
                  title="靠左对齐 (x: 20%)"
                >
                  <span>⬅️</span>
                  <span>靠左</span>
                </button>
                <button
                  type="button"
                  className="align-grid-btn"
                  onClick={() => {
                    updateBaseProp('x', 50);
                    updateBaseProp('y', 82);
                    toast.success('已贴合标准字幕位');
                  }}
                  title="底部标准卖点字幕位 (x: 50%, y: 82%)"
                >
                  <span>💬</span>
                  <span>字幕位</span>
                </button>
                <button
                  type="button"
                  className="align-grid-btn"
                  onClick={() => {
                    updateBaseProp('x', 82);
                    updateBaseProp('y', 18);
                    toast.success('已贴合右上促销位');
                  }}
                  title="右上角标促销位 (x: 82%, y: 18%)"
                >
                  <span>🏷️</span>
                  <span>促销位</span>
                </button>
              </div>
            </div>

            <div className="property-group">
              <span className="property-label">
                <span>缩放比例</span>
                <span>{activeLayer.scale.toFixed(2)}x</span>
              </span>
              <input
                type="range"
                min="0.3"
                max="2.5"
                step="0.05"
                value={activeLayer.scale}
                onChange={(e) => updateBaseProp('scale', parseFloat(e.target.value))}
                className="slider-input"
              />
            </div>

            <div className="property-group">
              <span className="property-label">
                <span>不透明度</span>
                <span>{Math.round(activeLayer.opacity * 100)}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={activeLayer.opacity}
                onChange={(e) => updateBaseProp('opacity', parseFloat(e.target.value))}
                className="slider-input"
              />
            </div>
          </>
        )}


        <LayerTypeControls layer={activeLayer} update={updateLayerProp} />

       {/* Layer Quick Actions & Delete */}
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={duplicateLayer}
              style={{ fontSize: '11px', padding: '6px 4px', justifyContent: 'center' }}
              title="复制生成同属性新图层"
            >
              📑 复制
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={bringToFront}
              style={{ fontSize: '11px', padding: '6px 4px', justifyContent: 'center' }}
              title="将图层移至最顶层渲染"
            >
              ⬆️ 置顶
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={sendToBack}
              style={{ fontSize: '11px', padding: '6px 4px', justifyContent: 'center' }}
              title="将图层移至最底层渲染"
            >
              ⬇️ 置底
            </button>
          </div>

          <button
            className="btn-secondary"
            onClick={deleteLayer}
            style={{ width: '100%', borderColor: 'rgba(255, 0, 127, 0.3)', color: 'var(--accent-pink)', justifyContent: 'center' }}
          >
            {/* Trash icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            删除该图层
          </button>
        </div>
      </div>
    </div>
  );
};
