import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  type ResolutionPreset,
  type BitratePreset,
  type VideoExportConfig,
  BITRATE_PRESETS,
  FRAMERATE_OPTIONS,
  calculateExportDimensions,
  estimateExportFileSizeMb,
  loadSavedExportConfig,
  saveExportConfig
} from '../../types/exportConfig';
import { isWebCodecsSupported } from '../../utils/webCodecsExporter';

export interface ExportSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExport: (config: VideoExportConfig) => void;
  ratio: string;
  totalDuration: number;
  nativeWidth?: number;
  nativeHeight?: number;
}

export const ExportSettingsModal: React.FC<ExportSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfirmExport,
  ratio,
  totalDuration,
  nativeWidth = 1080,
  nativeHeight = 1920
}) => {
  const [config, setConfig] = useState<VideoExportConfig>(() =>
    loadSavedExportConfig(ratio, totalDuration, nativeWidth, nativeHeight)
  );
  const [isRangeCustom, setIsRangeCustom] = useState(false);
  const [rememberPreference, setRememberPreference] = useState(true);

  // Sync dimensions when ratio or preset changes
  useEffect(() => {
    const dims = calculateExportDimensions(ratio, config.preset, nativeWidth, nativeHeight);
    setConfig(prev => ({
      ...prev,
      width: dims.width,
      height: dims.height,
      timeRange: {
        start: isRangeCustom ? prev.timeRange.start : 0,
        end: isRangeCustom ? Math.min(totalDuration, prev.timeRange.end) : Math.max(1, totalDuration)
      }
    }));
  }, [ratio, config.preset, totalDuration, nativeWidth, nativeHeight, isRangeCustom]);

  const activeDuration = Math.max(0.5, config.timeRange.end - config.timeRange.start);
  const totalFrames = Math.max(1, Math.round(activeDuration * config.fps));
  const estimatedSizeMb = useMemo(() => {
    return estimateExportFileSizeMb(activeDuration, config.bitrateBps, config.includeAudio);
  }, [activeDuration, config.bitrateBps, config.includeAudio]);

  const webCodecsAvailable = useMemo(() => isWebCodecsSupported(), []);

  if (!isOpen) return null;

  const handleStartRender = () => {
    if (rememberPreference) {
      saveExportConfig(config);
    }
    onConfirmExport(config);
    onClose();
  };

  const setQuickRange = (start: number, end: number) => {
    setIsRangeCustom(true);
    setConfig(prev => ({
      ...prev,
      timeRange: {
        start: Math.max(0, start),
        end: Math.min(totalDuration, end)
      }
    }));
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '640px',
          maxWidth: '95vw',
          maxHeight: '92vh',
          background: 'linear-gradient(135deg, #141724 0%, #0d0e17 100%)',
          border: '1px solid rgba(138, 43, 226, 0.45)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(124, 58, 237, 0.25)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #00f2fe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                boxShadow: '0 2px 10px rgba(124, 58, 237, 0.4)'
              }}
            >
              🎬
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.3px' }}>
                视频硬件加速导出中心 (Export Hub)
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                自由配置成片分辨率、高刷帧率、母带码率与片段选区
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '20px 22px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {/* 1. Resolution Preset Matrix */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>
                🖥️ 输出分辨率 (画板比例 {ratio})
              </span>
              <span style={{ fontSize: '11px', color: '#00f2fe', fontFamily: 'var(--mono, monospace)', fontWeight: 600 }}>
                {config.width} × {config.height} px
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {(
                [
                  { preset: '720p', label: '720P 标清', sub: '极速流畅', tag: '轻量' },
                  { preset: '1080p', label: '1080P 全高清', sub: '商业推荐', tag: '推荐' },
                  { preset: '2k', label: '2K 超清', sub: '发烧画质', tag: '细腻' },
                  { preset: '4k', label: '4K 母带级', sub: '影院级极致', tag: '高精' }
                ] as Array<{ preset: ResolutionPreset; label: string; sub: string; tag: string }>
              ).map(item => {
                const isSelected = config.preset === item.preset;
                const dims = calculateExportDimensions(ratio, item.preset, nativeWidth, nativeHeight);

                return (
                  <button
                    key={item.preset}
                    type="button"
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        preset: item.preset,
                        width: dims.width,
                        height: dims.height
                      }));
                    }}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.08)',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(124, 58, 237, 0.2) 100%)'
                        : 'rgba(255, 255, 255, 0.03)',
                      color: isSelected ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '3px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                        {item.label}
                      </span>
                    </div>
                    <span style={{ fontSize: '9px', color: isSelected ? '#00f2fe' : '#64748b', fontFamily: 'var(--mono, monospace)' }}>
                      {dims.width}×{dims.height}
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: isSelected ? 'rgba(0, 242, 254, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                        color: isSelected ? '#00f2fe' : '#94a3b8',
                        marginTop: '2px'
                      }}
                    >
                      {item.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Framerate (FPS) and Bitrate (Mbps) in 2 Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '14px' }}>
            {/* FPS Selector */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '8px' }}>
                ⏱️ 渲染帧率 (FPS)
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {FRAMERATE_OPTIONS.map(opt => {
                  const isSelected = config.fps === opt.fps;
                  return (
                    <button
                      key={opt.fps}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, fps: opt.fps }))}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid #7c3aed' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: isSelected ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                        color: isSelected ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                        {opt.label}
                      </span>
                      <span style={{ fontSize: '9px', color: isSelected ? '#c084fc' : '#64748b' }}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bitrate Selector */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '8px' }}>
                🎚️ 视频码率 (比特率)
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(Object.entries(BITRATE_PRESETS) as Array<[BitratePreset, { label: string; bps: number; desc: string }]>).map(
                  ([key, val]) => {
                    const isSelected = config.bitrateBps === val.bps;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, bitrateBps: val.bps }))}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: isSelected ? '1px solid #7c3aed' : '1px solid rgba(255, 255, 255, 0.08)',
                          background: isSelected ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                          color: isSelected ? '#ffffff' : '#94a3b8',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                          {val.label}
                        </span>
                        <span style={{ fontSize: '9px', color: isSelected ? '#c084fc' : '#64748b' }}>
                          {val.desc.slice(0, 10)}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          {/* 3. Export Time Range */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>
                ✂️ 导出时间范围 (总片长 {totalDuration.toFixed(1)}s)
              </span>
              <span style={{ fontSize: '11px', color: '#00f2fe', fontFamily: 'var(--mono, monospace)' }}>
                导出长度: {activeDuration.toFixed(1)} 秒
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsRangeCustom(false);
                  setConfig(prev => ({
                    ...prev,
                    timeRange: { start: 0, end: totalDuration }
                  }));
                }}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: !isRangeCustom ? '1px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: !isRangeCustom ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: !isRangeCustom ? '#ffffff' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🎬 全片导出 (0.0s - {totalDuration.toFixed(1)}s)
              </button>

              <button
                type="button"
                onClick={() => setIsRangeCustom(true)}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: isRangeCustom ? '1px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isRangeCustom ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: isRangeCustom ? '#ffffff' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ⏱️ 自定义片段选区
              </button>
            </div>

            {/* Custom Range Inputs & Quick Snippets */}
            {isRangeCustom && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px dashed rgba(0, 242, 254, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>起始时间:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={Math.max(0, config.timeRange.end - 0.5)}
                      value={config.timeRange.start}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setConfig(prev => ({
                          ...prev,
                          timeRange: { ...prev.timeRange, start: Math.max(0, Math.min(val, prev.timeRange.end - 0.5)) }
                        }));
                      }}
                      style={{
                        width: '70px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: '#0d0e17',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontFamily: 'var(--mono, monospace)'
                      }}
                    />
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>秒</span>
                  </div>

                  <span style={{ color: '#64748b' }}>~</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>结束时间:</span>
                    <input
                      type="number"
                      step="0.1"
                      min={config.timeRange.start + 0.5}
                      max={totalDuration}
                      value={config.timeRange.end}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || totalDuration;
                        setConfig(prev => ({
                          ...prev,
                          timeRange: { ...prev.timeRange, end: Math.min(totalDuration, Math.max(val, prev.timeRange.start + 0.5)) }
                        }));
                      }}
                      style={{
                        width: '70px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: '#0d0e17',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontFamily: 'var(--mono, monospace)'
                      }}
                    />
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>秒</span>
                  </div>
                </div>

                {/* Quick Range Presets */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setQuickRange(0, 3)}
                    style={{
                      fontSize: '9px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: 'rgba(124, 58, 237, 0.15)',
                      border: '1px solid rgba(124, 58, 237, 0.3)',
                      color: '#c084fc',
                      cursor: 'pointer'
                    }}
                  >
                    前 3 秒黄金吸睛钩子 (0-3s)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickRange(3, 9)}
                    style={{
                      fontSize: '9px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: 'rgba(0, 242, 254, 0.12)',
                      border: '1px solid rgba(0, 242, 254, 0.3)',
                      color: '#00f2fe',
                      cursor: 'pointer'
                    }}
                  >
                    中段细节与走秀展示 (3-9s)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickRange(9, 15)}
                    style={{
                      fontSize: '9px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#cbd5e1',
                      cursor: 'pointer'
                    }}
                  >
                    后段定格与促单 (9-15s)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Audio Mixing Controls */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.includeAudio}
                onChange={e => setConfig(prev => ({ ...prev, includeAudio: e.target.checked }))}
                style={{ accentColor: '#7c3aed', width: '15px', height: '15px' }}
              />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>
                🎵 包含时间轴音频音轨 (BGM + 拟音 Foley)
              </span>
            </label>

            {config.includeAudio && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>响度增益:</span>
                <select
                  value={config.audioGain}
                  onChange={e => setConfig(prev => ({ ...prev, audioGain: parseFloat(e.target.value) || 1.0 }))}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '4px',
                    background: '#0d0e17',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '10px'
                  }}
                >
                  <option value="1.0">100% (标准保真)</option>
                  <option value="1.2">120% (适度饱满)</option>
                  <option value="1.5">150% (人声高响度)</option>
                </select>
              </div>
            )}
          </div>

          {/* 5. Live Estimation Card Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(0, 242, 254, 0.04)',
              border: '1px dashed rgba(0, 242, 254, 0.25)'
            }}
          >
            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>预估成片体积</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#00f2fe', fontFamily: 'var(--mono, monospace)', marginTop: '2px' }}>
                ~{estimatedSizeMb} MB
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>离屏渲染总帧数</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--mono, monospace)', marginTop: '2px' }}>
                {totalFrames} 帧
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>成片规格</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#c084fc', fontFamily: 'var(--mono, monospace)', marginTop: '2px' }}>
                {config.fps} FPS MP4
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>加速引擎</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: webCodecsAvailable ? '#4ade80' : '#f59e0b', marginTop: '3px' }}>
                {webCodecsAvailable ? '⚡ GPU 硬件加速' : '🎞️ 标准编码器'}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rememberPreference}
              onChange={e => setRememberPreference(e.target.checked)}
              style={{ accentColor: '#7c3aed' }}
            />
            <span>记住我的导出偏好设置</span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ padding: '6px 14px', fontSize: '12px', margin: 0 }}
            >
              取消
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleStartRender}
              style={{
                padding: '7px 20px',
                fontSize: '12px',
                fontWeight: 700,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #00f2fe 100%)',
                boxShadow: '0 4px 15px rgba(124, 58, 237, 0.4)'
              }}
            >
              <span>🚀 开始硬件加速渲染</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
