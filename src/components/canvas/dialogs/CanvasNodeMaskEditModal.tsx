import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { CanvasNodeData } from '../../../types/canvas';
import { toast } from '../../toastStore';
import { generateInpaintImage, getCanvasSafeImageUrl } from '../../../utils/aiGateway';

interface CanvasNodeMaskEditModalProps {
  isOpen: boolean;
  node: CanvasNodeData | null;
  onClose: () => void;
  onStart: (sourceNode: CanvasNodeData, createDerivedNode: boolean, prompt: string) => string | null;
  onApply: (newImageSrc: string, pendingNodeId: string, sourceNode: CanvasNodeData, createDerivedNode: boolean, prompt: string) => void;
  onError: (pendingNodeId: string, sourceNode: CanvasNodeData, error: string) => void;
}

export const CanvasNodeMaskEditModal: React.FC<CanvasNodeMaskEditModalProps> = ({
  isOpen,
  node,
  onClose,
  onStart,
  onApply,
  onError
}) => {
  const [brushSize, setBrushSize] = useState<number>(25);
  const [brushMode, setBrushMode] = useState<'paint' | 'erase'>('paint');
  const [inpaintPrompt, setInpaintPrompt] = useState<string>('');
  const [denoiseStrength, setDenoiseStrength] = useState<number>(0.75);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);

  const imageSrc = node?.metadata.imageSrc || '';
  const editableImageSrc = getCanvasSafeImageUrl(imageSrc);

  // Initialize Canvas when image loads or modal opens
  const initCanvas = useCallback(() => {
    if (!canvasRef.current || !editableImageSrc) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = editableImageSrc;
    img.onload = () => {
      imageRef.current = img;
      // Set canvas dimension matching natural image ratio capped at preview area
      const maxW = 560;
      const maxH = 500;
      const w = img.width || 400;
      const h = img.height || 400;

      const scale = Math.min(maxW / w, maxH / h, 1);
      canvas.width = w * scale;
      canvas.height = h * scale;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [editableImageSrc]);

  useEffect(() => {
    if (isOpen) {
      initCanvas();
    }
  }, [isOpen, initCanvas]);

  if (!isOpen || !node) return null;

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const drawStroke = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (brushMode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255, 45, 120, 0.65)';
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const { x, y } = getCanvasCoords(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = brushMode === 'erase' ? 'rgba(0,0,0,1)' : 'rgba(255, 45, 120, 0.65)';
      if (brushMode === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
      drawStroke(x, y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const { x, y } = getCanvasCoords(e);
    drawStroke(x, y);
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) ctx.beginPath();
  };

  const handleClearMask = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleGenerateInpaint = async (createDerived: boolean) => {
    if (!canvasRef.current || !imageRef.current) return;

    const maskPreviewContext = canvasRef.current.getContext('2d');
    if (!maskPreviewContext) return;
    const maskPixels = maskPreviewContext.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height).data;
    let hasMask = false;
    for (let i = 3; i < maskPixels.length; i += 4) {
      if (maskPixels[i] > 0) {
        hasMask = true;
        break;
      }
    }
    if (!hasMask) {
      toast.info('请先在图片上涂抹需要重绘的区域');
      return;
    }
    if (!inpaintPrompt.trim()) {
      toast.info('请输入重绘目标提示词');
      return;
    }

    setIsProcessing(true);
    const sourceNode = node;
    const prompt = inpaintPrompt.trim();
    let pendingNodeId: string | null = null;
    try {
      const maskCanvas = canvasRef.current;
      const outputMask = document.createElement('canvas');
      outputMask.width = imageRef.current.width;
      outputMask.height = imageRef.current.height;
      const outputMaskContext = outputMask.getContext('2d');
      if (!outputMaskContext) throw new Error('Failed to create mask image');
      outputMaskContext.drawImage(maskCanvas, 0, 0, outputMask.width, outputMask.height);
      const scaledMask = outputMaskContext.getImageData(0, 0, outputMask.width, outputMask.height);
      for (let i = 0; i < scaledMask.data.length; i += 4) {
        const selected = scaledMask.data[i + 3] > 0;
        scaledMask.data[i] = selected ? 255 : 0;
        scaledMask.data[i + 1] = selected ? 255 : 0;
        scaledMask.data[i + 2] = selected ? 255 : 0;
        scaledMask.data[i + 3] = 255;
      }
      outputMaskContext.putImageData(scaledMask, 0, 0);

      pendingNodeId = onStart(sourceNode, createDerived, prompt);
      if (!pendingNodeId) throw new Error('无法创建重绘任务节点');
      onClose();
      toast.info('Google 重绘任务已提交，可在画布节点查看生成进度');

      const resultDataUrl = await generateInpaintImage({
        imageUrl: imageSrc,
        maskUrl: outputMask.toDataURL('image/png'),
        prompt,
        strength: denoiseStrength,
        aspectRatio: node.metadata.aspectRatio
      });

      toast.success(createDerived ? '已成功局部重绘，并生成衍生节点！' : '已成功局部重绘并覆盖当前节点！');
      onApply(resultDataUrl, pendingNodeId, sourceNode, createDerived, prompt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (pendingNodeId) onError(pendingNodeId, sourceNode, message);
      toast.error(`局部重绘失败: ${message}`);
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
          width: '940px',
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
            <span style={{ fontSize: '20px' }}>🖌️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                局部重绘 (Mask Inpaint) · 遮罩涂抹
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary, #9ca3af)' }}>
                在需要修改的服装或人物区域涂抹粉色遮罩，输入重绘描述进行定向 AI 生成
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
          {/* Left Canvas Paint Area */}
          <div
            style={{
              flex: 1,
              background: '#090a0f',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              overflow: 'auto'
            }}
          >
            <div style={{ position: 'relative', display: 'inline-block', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
              {imageSrc && (
                <img
                  src={editableImageSrc}
                  alt="Base"
                  style={{
                    display: 'block',
                    maxHeight: '480px',
                    maxWidth: '540px',
                    userSelect: 'none',
                    pointerEvents: 'none',
                    borderRadius: '8px'
                  }}
                />
              )}
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  cursor: brushMode === 'paint' ? 'crosshair' : 'cell',
                  borderRadius: '8px'
                }}
              />
            </div>
          </div>

          {/* Right Control Sidebar */}
          <div
            style={{
              width: '340px',
              borderLeft: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto'
            }}
          >
            {/* Brush Controls */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                🖌️ 画笔模式与尺寸
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                  className={`btn-secondary ${brushMode === 'paint' ? 'primary' : ''}`}
                  onClick={() => setBrushMode('paint')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: '12px',
                    background: brushMode === 'paint' ? 'var(--accent-purple, #7928ca)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  🖌️ 涂抹遮罩
                </button>
                <button
                  className={`btn-secondary ${brushMode === 'erase' ? 'primary' : ''}`}
                  onClick={() => setBrushMode('erase')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: '12px',
                    background: brushMode === 'erase' ? 'var(--accent-purple, #7928ca)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  🧽 橡皮擦
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary, #9ca3af)' }}>笔刷粗细</span>
                <span style={{ fontSize: '12px', fontWeight: '600' }}>{brushSize}px</span>
              </div>
              <input
                type="range"
                min="5"
                max="80"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  onClick={handleClearMask}
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: 'var(--text-secondary, #9ca3af)',
                    cursor: 'pointer'
                  }}
                >
                  清空遮罩
                </button>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '4px 0' }} />

            {/* Inpaint Prompt */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'block' }}>
                ✨ 重绘目标提示词 (Prompt)
              </label>
              <textarea
                rows={4}
                value={inpaintPrompt}
                onChange={(e) => setInpaintPrompt(e.target.value)}
                placeholder="例如：将衣领更换为复古法式翻领、增加金色纽扣细节、修改面料为粗花呢质感..."
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                  borderRadius: '8px',
                  padding: '10px',
                  color: '#fff',
                  fontSize: '12px',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Denoise Strength */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary, #9ca3af)' }}>重绘强度 (Denoise)</span>
                <span style={{ fontSize: '12px', fontWeight: '600' }}>{Math.round(denoiseStrength * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={denoiseStrength}
                onChange={(e) => setDenoiseStrength(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="btn-primary"
                disabled={isProcessing}
                onClick={() => handleGenerateInpaint(true)}
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
                {isProcessing ? '正在生成...' : '🌟 重绘并新建衍生节点 (推荐)'}
              </button>
              <button
                disabled={isProcessing}
                onClick={() => handleGenerateInpaint(false)}
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
