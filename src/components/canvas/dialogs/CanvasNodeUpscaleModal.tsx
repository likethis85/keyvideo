import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CanvasNodeData } from '../../../types/canvas';
import { toast } from '../../toastStore';
import { generateUpscaleImage, getCanvasSafeImageUrl } from '../../../utils/aiGateway';

interface CanvasNodeUpscaleModalProps {
  isOpen: boolean;
  node: CanvasNodeData | null;
  onClose: () => void;
  onStart: (sourceNode: CanvasNodeData, createDerivedNode: boolean, upscaleFactor: '2x' | '4x') => string | null;
  onApply: (newImageSrc: string, pendingNodeId: string, sourceNode: CanvasNodeData, createDerivedNode: boolean, upscaleFactor: '2x' | '4x') => void;
  onError: (pendingNodeId: string, sourceNode: CanvasNodeData, error: string) => void;
}

export const CanvasNodeUpscaleModal: React.FC<CanvasNodeUpscaleModalProps> = ({
  isOpen,
  node,
  onClose,
  onStart,
  onApply,
  onError
}) => {
  const [scaleFactor, setScaleFactor] = useState<'2x' | '4x'>('2x');
  const [mode, setMode] = useState<'fashion' | 'portrait' | 'general'>('fashion');
  const [denoise, setDenoise] = useState<number>(30);
  const [sharpen, setSharpen] = useState<number>(50);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const imageSrc = node?.metadata.imageSrc || '';
  const editableImageSrc = getCanvasSafeImageUrl(imageSrc);

  if (!isOpen || !node) return null;

  const handleExecuteUpscale = async (createDerived: boolean) => {
    if (!imageRef.current) return;
    setIsProcessing(true);
    const sourceNode = node;
    let pendingNodeId: string | null = null;

    try {
      pendingNodeId = onStart(sourceNode, createDerived, scaleFactor);
      if (!pendingNodeId) throw new Error('无法创建高清增强任务节点');
      onClose();
      toast.info(`Google ${scaleFactor === '4x' ? '4K' : '2K'} 高清增强任务已提交，可在画布节点查看进度`);

      const upscaledDataUrl = await generateUpscaleImage({
        imageUrl: imageSrc,
        scaleFactor,
        mode,
        denoise,
        sharpen,
        aspectRatio: node.metadata.aspectRatio
      });
      toast.success(createDerived ? `已成功生成 ${scaleFactor} 超分辨率增强节点！` : `已完成 ${scaleFactor} 增强并覆盖当前节点！`);
      onApply(upscaledDataUrl, pendingNodeId, sourceNode, createDerived, scaleFactor);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (pendingNodeId) onError(pendingNodeId, sourceNode, message);
      toast.error(`画质增强失败: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 7, 14, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface, #12141c)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          width: '860px',
          maxWidth: '96vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary, #f3f4f6)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>⚡</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                超分辨率画质增强 (AI Upscale)
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary, #9ca3af)' }}>
                重构服装面料微距纹理与面部五官，提升至 2K / 4K 商业级印刷与高清成片标准
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #9ca3af)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '6px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left Preview */}
          <div
            style={{
              flex: 1,
              background: '#090a0f',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              overflow: 'hidden'
            }}
          >
            {imageSrc ? (
              <div style={{ position: 'relative', maxHeight: '460px', maxWidth: '460px', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
                <img
                  ref={imageRef}
                  src={editableImageSrc}
                  alt="Original"
                  crossOrigin="anonymous"
                  style={{
                    display: 'block',
                    maxHeight: '440px',
                    maxWidth: '440px',
                    objectFit: 'contain',
                    borderRadius: '8px'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '10px',
                    background: 'rgba(0, 0, 0, 0.75)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: 'var(--accent-cyan, #00f2fe)',
                    border: '1px solid rgba(0, 242, 254, 0.3)'
                  }}
                >
                  目标画质: {scaleFactor} ({scaleFactor === '4x' ? '4K 级超清' : '2K 级高清'})
                </div>
              </div>
            ) : null}
          </div>

          {/* Right Controls */}
          <div
            style={{
              width: '320px',
              borderLeft: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto'
            }}
          >
            {/* Scale Factors */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                🚀 放大倍率
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`btn-secondary ${scaleFactor === '2x' ? 'primary' : ''}`}
                  onClick={() => setScaleFactor('2x')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    background: scaleFactor === '2x' ? 'var(--accent-purple, #7928ca)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  2x 高清增强
                </button>
                <button
                  className={`btn-secondary ${scaleFactor === '4x' ? 'primary' : ''}`}
                  onClick={() => setScaleFactor('4x')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    background: scaleFactor === '4x' ? 'var(--accent-purple, #7928ca)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  4x 超清 4K
                </button>
              </div>
            </div>

            {/* Mode selection */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                🎯 增强专长领域
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { id: 'fashion', label: '👗 服装面料材质增强', desc: '精细还原针织、真丝、牛仔等面料微距质感' },
                  { id: 'portrait', label: '👤 模特面部人像微调', desc: '提亮眼神、抚平瑕疵、保持东亚面孔五官立体度' },
                  { id: 'general', label: '🌄 全局综合清晰化', desc: '平衡背景场景光影与整体图像锐利感' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setMode(item.id as 'fashion' | 'portrait' | 'general')}
                    style={{
                      padding: '8px 10px',
                      background: mode === item.id ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${mode === item.id ? 'var(--accent-cyan, #00f2fe)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '8px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#fff'
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: '600' }}>{item.label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary, #9ca3af)', marginTop: '2px' }}>{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '4px 0' }} />

            {/* Denoise and Sharpen Sliders */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary, #9ca3af)' }}>降噪平滑 (Denoise)</span>
                <span style={{ fontSize: '12px', fontWeight: '600' }}>{denoise}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={denoise}
                onChange={(e) => setDenoise(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', marginBottom: '10px' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary, #9ca3af)' }}>锐化微调 (Sharpen)</span>
                <span style={{ fontSize: '12px', fontWeight: '600' }}>{sharpen}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={sharpen}
                onChange={(e) => setSharpen(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* Actions */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="btn-primary"
                disabled={isProcessing}
                onClick={() => handleExecuteUpscale(true)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                  color: '#000'
                }}
              >
                {isProcessing ? '正在增强中...' : '🌟 生成超清衍生节点 (推荐)'}
              </button>
              <button
                disabled={isProcessing}
                onClick={() => handleExecuteUpscale(false)}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  fontSize: '12px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--text-secondary, #9ca3af)',
                  borderRadius: '8px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer'
                }}
              >
                直接覆盖当前节点
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
