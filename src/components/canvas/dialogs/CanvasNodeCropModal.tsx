import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CanvasNodeData } from '../../../types/canvas';
import { toast } from '../../toastStore';
import { getCanvasSafeImageUrl } from '../../../utils/aiGateway';

interface CanvasNodeCropModalProps {
  isOpen: boolean;
  node: CanvasNodeData | null;
  onClose: () => void;
  onApply: (newImageSrc: string, createDerivedNode: boolean, ratio?: '1:1' | '3:4' | '9:16' | '16:9') => void;
}

type AspectRatioPreset = 'free' | '1:1' | '3:4' | '9:16' | '16:9';

export const CanvasNodeCropModal: React.FC<CanvasNodeCropModalProps> = ({
  isOpen,
  node,
  onClose,
  onApply
}) => {
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioPreset>('3:4');
  const [zoom, setZoom] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; startOffX: number; startOffY: number }>({ x: 0, y: 0, startOffX: 0, startOffY: 0 });

  const imageSrc = node?.metadata.imageSrc || '';
  const editableImageSrc = getCanvasSafeImageUrl(imageSrc);
  const effectiveZoom = Math.max(1, zoom);

  if (node && node.id !== activeNodeId) {
    setActiveNodeId(node.id);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  }

  if (!isOpen || !node) return null;

  // Compute crop box aspect ratio width & height
  const getCropBoxDimensions = () => {
    const baseW = 360;
    switch (selectedRatio) {
      case '1:1':
        return { width: baseW, height: baseW };
      case '3:4':
        return { width: 330, height: 440 };
      case '9:16':
        return { width: 270, height: 480 };
      case '16:9':
        return { width: 480, height: 270 };
      case 'free':
      default:
        return { width: 380, height: 380 };
    }
  };

  const cropDim = getCropBoxDimensions();

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startOffX: offsetX,
      startOffY: offsetY
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffsetX(dragStartRef.current.startOffX + dx);
    setOffsetY(dragStartRef.current.startOffY + dy);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleExecuteCrop = async (createDerived: boolean) => {
    if (!imageRef.current) return;
    setIsProcessing(true);

    try {
      const img = imageRef.current;
      const naturalW = img.naturalWidth || 800;
      const naturalH = img.naturalHeight || 800;

      // Determine target output resolution based on ratio preset
      let targetW = 1080;
      let targetH = 1440;
      if (selectedRatio === '1:1') {
        targetW = 1080;
        targetH = 1080;
      } else if (selectedRatio === '9:16') {
        targetW = 1080;
        targetH = 1920;
      } else if (selectedRatio === '16:9') {
        targetW = 1920;
        targetH = 1080;
      } else if (selectedRatio === '3:4') {
        targetW = 1080;
        targetH = 1440;
      } else {
        targetW = naturalW;
        targetH = naturalH;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot get canvas context');

      ctx.fillStyle = '#090a0f';
      ctx.fillRect(0, 0, targetW, targetH);

      // Calculate how image coordinates map to target canvas
      const scale = effectiveZoom * Math.max(targetW / naturalW, targetH / naturalH);
      const drawW = naturalW * scale;
      const drawH = naturalH * scale;

      const normOffX = (offsetX / cropDim.width) * targetW;
      const normOffY = (offsetY / cropDim.height) * targetH;

      const drawX = (targetW - drawW) / 2 + normOffX;
      const drawY = (targetH - drawH) / 2 + normOffY;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      toast.success(createDerived ? '已成功生成智能裁切衍生节点！' : '已成功裁切并替换当前节点！');
      const ratioParam = selectedRatio === 'free' ? undefined : selectedRatio;
      onApply(croppedDataUrl, createDerived, ratioParam);
      onClose();
    } catch (err) {
      toast.error(`裁切失败: ${err instanceof Error ? err.message : String(err)}`);
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
          width: '900px',
          maxWidth: '96vw',
          maxHeight: '90vh',
          boxSizing: 'border-box',
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
            <span style={{ fontSize: '20px' }}>✂️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                智能裁切 (Smart Crop) · 画幅重构
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary, #9ca3af)' }}>
                支持主流电商与短视频画幅比例预设，可拖拽缩放进行构图重排
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
          {/* Left Crop Frame Viewport */}
          <div
            style={{
              flex: 1,
              background: '#090a0f',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* The Crop Area Box */}
            <div
              style={{
                width: `${cropDim.width}px`,
                height: `${cropDim.height}px`,
                position: 'relative',
                border: '2px solid var(--accent-cyan, #00f2fe)',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.68)',
                overflow: 'hidden',
                borderRadius: '4px',
                zIndex: 10
              }}
            >
              {/* Rule of Thirds Guidelines */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  border: '1px dashed rgba(255, 255, 255, 0.25)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gridTemplateRows: '1fr 1fr 1fr'
                }}
              >
                <div style={{ borderRight: '1px dashed rgba(255,255,255,0.15)', borderBottom: '1px dashed rgba(255,255,255,0.15)' }} />
                <div style={{ borderRight: '1px dashed rgba(255,255,255,0.15)', borderBottom: '1px dashed rgba(255,255,255,0.15)' }} />
                <div style={{ borderBottom: '1px dashed rgba(255,255,255,0.15)' }} />
                <div style={{ borderRight: '1px dashed rgba(255,255,255,0.15)', borderBottom: '1px dashed rgba(255,255,255,0.15)' }} />
                <div style={{ borderRight: '1px dashed rgba(255,255,255,0.15)', borderBottom: '1px dashed rgba(255,255,255,0.15)' }} />
                <div style={{ borderBottom: '1px dashed rgba(255,255,255,0.15)' }} />
                <div style={{ borderRight: '1px dashed rgba(255,255,255,0.15)' }} />
                <div style={{ borderRight: '1px dashed rgba(255,255,255,0.15)' }} />
                <div />
              </div>

              {/* Cropped Image View */}
              {imageSrc && (
                <img
                  ref={imageRef}
                  src={editableImageSrc}
                  alt="Source"
                  crossOrigin="anonymous"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${effectiveZoom})`,
                    transformOrigin: 'center center',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none'
                  }}
                />
              )}
            </div>
          </div>

          {/* Right Control Sidebar */}
          <div
            style={{
              width: '320px',
              boxSizing: 'border-box',
              flexShrink: 0,
              borderLeft: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto'
            }}
          >
            {/* Ratio Presets */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                📐 画幅比例预设
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                <button
                  className={`btn-secondary ${selectedRatio === '3:4' ? 'primary' : ''}`}
                  onClick={() => setSelectedRatio('3:4')}
                  style={{
                    padding: '8px 10px',
                    fontSize: '12px',
                    background: selectedRatio === '3:4' ? 'var(--accent-purple, #7928ca)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'block',
                    minWidth: 0,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>3:4 主图</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>小红书 / 电商</div>
                </button>

                <button
                  className={`btn-secondary ${selectedRatio === '9:16' ? 'primary' : ''}`}
                  onClick={() => setSelectedRatio('9:16')}
                  style={{
                    padding: '8px 10px',
                    fontSize: '12px',
                    background: selectedRatio === '9:16' ? 'var(--accent-purple, #7928ca)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'block',
                    minWidth: 0,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>9:16 竖屏</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>抖音 / TikTok</div>
                </button>

                <button
                  className={`btn-secondary ${selectedRatio === '1:1' ? 'primary' : ''}`}
                  onClick={() => setSelectedRatio('1:1')}
                  style={{
                    padding: '8px 10px',
                    fontSize: '12px',
                    background: selectedRatio === '1:1' ? 'var(--accent-purple, #7928ca)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'block',
                    minWidth: 0,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>1:1 方形</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>商品橱窗 / Instagram</div>
                </button>

                <button
                  className={`btn-secondary ${selectedRatio === '16:9' ? 'primary' : ''}`}
                  onClick={() => setSelectedRatio('16:9')}
                  style={{
                    padding: '8px 10px',
                    fontSize: '12px',
                    background: selectedRatio === '16:9' ? 'var(--accent-purple, #7928ca)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'block',
                    minWidth: 0,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>16:9 横屏</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>影视 / 宽屏广告</div>
                </button>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '4px 0' }} />

            {/* Zoom Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary, #9ca3af)' }}>缩放构图 (Zoom)</span>
                <span style={{ fontSize: '12px', fontWeight: '600' }}>{Math.round(effectiveZoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="3.0"
                step="0.05"
                value={effectiveZoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* Position Reset */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setOffsetX(0);
                  setOffsetY(0);
                  setZoom(1);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary, #9ca3af)',
                  cursor: 'pointer'
                }}
              >
                🎯 居中重置位置
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="btn-primary"
                disabled={isProcessing}
                onClick={() => handleExecuteCrop(true)}
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
                {isProcessing ? '正在处理...' : '🌟 裁切并新建衍生节点 (推荐)'}
              </button>
              <button
                disabled={isProcessing}
                onClick={() => handleExecuteCrop(false)}
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
                直接替换当前节点
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
