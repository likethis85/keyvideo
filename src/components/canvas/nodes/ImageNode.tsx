import React from 'react';
import type { CanvasNodeData } from '../../../types/canvas';
import { BaseNode } from './BaseNode';

interface ImageNodeProps {
  node: CanvasNodeData;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<CanvasNodeData>) => void;
  onStartConnect: (fromHandle: string) => void;
  onEndConnect: (toHandle: string) => void;
  onAddToTimeline?: (node: CanvasNodeData) => void;
  onOpenMaskEdit?: (node: CanvasNodeData) => void;
  onOpenCrop?: (node: CanvasNodeData) => void;
  onOpenUpscale?: (node: CanvasNodeData) => void;
}

export const ImageNode: React.FC<ImageNodeProps> = ({
  node,
  isSelected,
  onSelect,
  onDelete,
  onStartConnect,
  onEndConnect,
  onAddToTimeline,
  onOpenMaskEdit,
  onOpenCrop,
  onOpenUpscale
}) => {
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [node.metadata.imageSrc]);

  const hasValidImage = Boolean(node.metadata.imageSrc) && !imgError;

  return (
    <BaseNode
      node={node}
      isSelected={isSelected}
      onSelect={onSelect}
      onDelete={onDelete}
      onStartConnect={onStartConnect}
      onEndConnect={onEndConnect}
      headerIcon={<span style={{ fontSize: '14px' }}>🖼️</span>}
      extraHeaderActions={
        hasValidImage ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {onAddToTimeline && (
              <button
                className="node-action-pill-btn"
                onClick={() => onAddToTimeline(node)}
                title="将该图片直接作为图层加入时间线"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                + 时间轴
              </button>
            )}
          </div>
        ) : null
      }
    >
      <div className="image-node-content">
        {hasValidImage ? (
          <div className="node-image-preview-container" style={{ position: 'relative' }}>
            <img
              src={node.metadata.imageSrc}
              alt={node.title}
              className="node-media-preview"
              style={{ maxHeight: '220px', objectFit: 'contain' }}
              onError={() => setImgError(true)}
            />

            {/* Quick Action Toolbar on Image Node */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                marginTop: '8px',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}
            >
              {onOpenMaskEdit && (
                <button
                  type="button"
                  className="node-tool-btn"
                  onClick={() => onOpenMaskEdit(node)}
                  title="局部重绘 (Mask Inpaint) - 涂抹遮罩定向修改"
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    background: 'rgba(255, 45, 120, 0.15)',
                    border: '1px solid rgba(255, 45, 120, 0.35)',
                    color: '#ff7eb3',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>🖌️</span>
                  <span>重绘</span>
                </button>
              )}

              {onOpenCrop && (
                <button
                  type="button"
                  className="node-tool-btn"
                  onClick={() => onOpenCrop(node)}
                  title="智能裁切 (Smart Crop) - 切换 3:4/9:16/1:1 画幅"
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    background: 'rgba(0, 242, 254, 0.15)',
                    border: '1px solid rgba(0, 242, 254, 0.35)',
                    color: '#00f2fe',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>✂️</span>
                  <span>裁切</span>
                </button>
              )}

              {onOpenUpscale && (
                <button
                  type="button"
                  className="node-tool-btn"
                  onClick={() => onOpenUpscale(node)}
                  title="超分辨率增强 (AI Upscale) - 2x/4x 超清细节重建"
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    background: 'rgba(121, 40, 202, 0.2)',
                    border: '1px solid rgba(121, 40, 202, 0.45)',
                    color: '#c084fc',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>⚡</span>
                  <span>增强</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="node-upload-placeholder">
            <div className="upload-icon">{imgError ? '⚠️' : '✨'}</div>
            <span>{imgError ? '图片载入失败或已失效' : '等待生图结果'}</span>
            <small>{imgError ? '可在侧边栏向导中重新生成或上传' : '连接上游原料并触发工作流'}</small>
          </div>
        )}

        <div className="node-meta-chips" style={{ marginTop: '8px' }}>
          {node.metadata.aspectRatio && (
            <span className="node-chip">{node.metadata.aspectRatio}</span>
          )}
          {Boolean(node.metadata.upscale) && (
            <span className="node-chip" style={{ background: 'rgba(121, 40, 202, 0.3)', color: '#c084fc' }}>
              ✨ {String(node.metadata.upscale)}
            </span>
          )}
          {node.metadata.modelGender && (
            <span className="node-chip">
              {node.metadata.modelGender === 'female' ? '女性模特' : '男性模特'}
            </span>
          )}
          {node.metadata.modelRegion && (
            <span className="node-chip">
              {node.metadata.modelRegion === 'east-asian' ? '东亚面孔' : '欧美面孔'}
            </span>
          )}
        </div>
      </div>
    </BaseNode>
  );
};
