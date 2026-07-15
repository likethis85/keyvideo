import React from 'react';
import type { Layer } from './VideoCanvas';

interface PropertyInspectorProps {
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  layers,
  setLayers,
  selectedLayerId,
  setSelectedLayerId,
}) => {
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
    }
  };

  if (!activeLayer) {
    return (
      <div className="property-inspector">
        <div className="inspector-header">
          <div className="inspector-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            属性调整栏
          </div>
        </div>
        <div className="inspector-content" style={{ justifyContent: 'center', height: '100%', alignItems: 'center', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px' }}>
          <div>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚙️</div>
            未选中任何层。
            <br />
            请在画布上或下方时间轴中选中一个层进行编辑。
          </div>
        </div>
      </div>
    );
  }

  const colorPresets = [
    '#ffffff', // White
    '#00f2fe', // Cyan
    '#ff007f', // Hot Pink
    '#ffb703', // Gold
    '#8a2be2', // Neon Purple
    '#52ff52'  // Light Green
  ];

  return (
    <div className="property-inspector">
      <div className="inspector-header">
        <div className="inspector-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {activeLayer.name} 属性
        </div>
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


        {/* 2. TEXT LAYER ONLY CONTROLS */}
        {activeLayer.type === 'text' && (
          <>
            <div className="property-group">
              <span className="property-label">修改文本</span>
              <input
                type="text"
                value={activeLayer.properties.text || ''}
                onChange={(e) => updateLayerProp(p => { p.text = e.target.value; })}
                className="text-input"
              />
            </div>

            <div className="property-group">
              <span className="property-label">
                <span>字体大小</span>
                <span>{activeLayer.properties.fontSize}px</span>
              </span>
              <input
                type="range"
                min="18"
                max="72"
                value={activeLayer.properties.fontSize || 32}
                onChange={(e) => updateLayerProp(p => { p.fontSize = parseInt(e.target.value); })}
                className="slider-input"
              />
            </div>

            <div className="property-group">
              <span className="property-label">文本颜色</span>
              <div className="color-picker-grid">
                {colorPresets.map((preset) => (
                  <div
                    key={preset}
                    className={`color-option ${activeLayer.properties.color === preset ? 'active' : ''}`}
                    style={{ backgroundColor: preset }}
                    onClick={() => updateLayerProp(p => { p.color = preset; })}
                  />
                ))}
              </div>
            </div>

            <div className="property-group">
              <span className="property-label">出场动画</span>
              <select
                value={activeLayer.properties.animation || 'fade'}
                onChange={(e) => updateLayerProp(p => { p.animation = e.target.value as any; })}
                className="text-input"
                style={{ padding: '6px 10px' }}
              >
                <option value="fade">渐显入场 (Fade)</option>
                <option value="typewriter">逐字打印 (Typewriter)</option>
                <option value="zoom">弹性缩放 (Zoom)</option>
                <option value="slide">向上滑入 (Slide)</option>
              </select>
            </div>

            <div className="property-group">
              <span className="property-label">文本风格</span>
              <div style={{ display: 'flex', gap: '15px', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!activeLayer.properties.bold}
                    onChange={(e) => updateLayerProp(p => { p.bold = e.target.checked; })}
                  />
                  加粗
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!activeLayer.properties.shadow}
                    onChange={(e) => updateLayerProp(p => { p.shadow = e.target.checked; })}
                  />
                  描边阴影
                </label>
              </div>
            </div>
          </>
        )}

        {/* MEDIA LAYER ONLY CONTROLS */}
        {activeLayer.type === 'media' && (
          <>
            <div className="property-group">
              <span className="property-label">视频过渡效果</span>
              <select
                value={activeLayer.properties.transitionType || 'none'}
                onChange={(e) => updateLayerProp(p => { p.transitionType = e.target.value as any; })}
                className="text-input"
                style={{ padding: '6px 10px' }}
              >
                <option value="none">无过渡 (None)</option>
                <option value="fade">交叉渐变 (Fade)</option>
                <option value="slideLeft">向左滑动 (Slide Left)</option>
                <option value="slideRight">向右滑动 (Slide Right)</option>
                <option value="zoom">缩放过渡 (Zoom)</option>
                <option value="wipe">左右擦除 (Wipe)</option>
              </select>
            </div>

            {activeLayer.properties.transitionType && activeLayer.properties.transitionType !== 'none' && (
              <div className="property-group">
                <span className="property-label">
                  <span>过渡时长</span>
                  <span>{(activeLayer.properties.transitionDuration ?? 0.5).toFixed(1)}s</span>
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={activeLayer.properties.transitionDuration ?? 0.5}
                  onChange={(e) => updateLayerProp(p => { p.transitionDuration = parseFloat(e.target.value); })}
                  className="slider-input"
                />
              </div>
            )}

            <div className="property-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={!!activeLayer.properties.bgRemoved}
                  onChange={(e) => updateLayerProp(p => { p.bgRemoved = e.target.checked; })}
                />
                智能抠图 (去除白/米背景)
              </label>
            </div>
          </>
        )}

        {/* 3. STICKER LAYER ONLY CONTROLS */}
        {activeLayer.type === 'sticker' && (
          <>
            <div className="property-group">
              <span className="property-label">贴纸文案</span>
              <input
                type="text"
                value={activeLayer.properties.text || ''}
                onChange={(e) => updateLayerProp(p => { p.text = e.target.value; })}
                className="text-input"
              />
            </div>

            <div className="property-group">
              <span className="property-label">贴纸主题风格</span>
              <select
                value={activeLayer.properties.style || 'purple'}
                onChange={(e) => updateLayerProp(p => { p.style = e.target.value as any; })}
                className="text-input"
                style={{ padding: '6px 10px' }}
              >
                <option value="purple">时尚极光紫 (Purple)</option>
                <option value="cyan">潮流科技蓝 (Cyan)</option>
                <option value="gold">爆款温暖橙 (Gold)</option>
                <option value="red">心动警示红 (Red)</option>
                <option value="black">高级碳素黑 (Black)</option>
              </select>
            </div>
          </>
        )}

        {/* 4. AUDIO LAYER ONLY CONTROLS */}
        {activeLayer.type === 'audio' && (
          <div className="property-group">
            <span className="property-label">
              <span>音量大小</span>
              <span>{Math.round((activeLayer.properties.volume || 0.8) * 100)}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="1.0"
              step="0.05"
              value={activeLayer.properties.volume || 0.8}
              onChange={(e) => updateLayerProp(p => { p.volume = parseFloat(e.target.value); })}
              className="slider-input"
            />
          </div>
        )}

        {/* General Delete Action */}
        <div style={{ marginTop: '10px' }}>
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
