import React, { useRef } from 'react';
import type { CanvasNodeData } from '../../../types/canvas';
import { BaseNode } from './BaseNode';

interface ClothingNodeProps {
  node: CanvasNodeData;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<CanvasNodeData>) => void;
  onStartConnect: (fromHandle: string) => void;
  onEndConnect: (toHandle: string) => void;
  onSpawnMultiModel?: (node: CanvasNodeData) => void;
  onSpawnBatchViews?: (node: CanvasNodeData) => void;
}

export const ClothingNode: React.FC<ClothingNodeProps> = ({
  node,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
  onStartConnect,
  onEndConnect,
  onSpawnMultiModel,
  onSpawnBatchViews
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdate({
        metadata: {
          ...node.metadata,
          imageSrc: reader.result as string
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const clothingType = node.metadata.clothingType || 'top';

  return (
    <BaseNode
      node={node}
      isSelected={isSelected}
      onSelect={onSelect}
      onDelete={onDelete}
      onStartConnect={onStartConnect}
      onEndConnect={onEndConnect}
      headerIcon={<span style={{ fontSize: '14px' }}>👗</span>}
    >
      <div className="clothing-node-content">
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleFileUpload}
        />

        {node.metadata.imageSrc ? (
          <div className="node-image-preview-container" onClick={() => fileInputRef.current?.click()}>
            <img
              src={node.metadata.imageSrc}
              alt={node.title}
              className="node-media-preview"
            />
            <div className="node-media-hover-overlay">
              <span>点击更换图片</span>
            </div>
          </div>
        ) : (
          <div className="node-upload-placeholder" onClick={() => fileInputRef.current?.click()}>
            <div className="upload-icon">⬆</div>
            <span>上传服装/款式图</span>
            <small>支持 JPG, PNG, WEBP</small>
          </div>
        )}

        <div className="node-property-row" style={{ marginTop: '8px' }}>
          <label>服装类型:</label>
          <select
            value={clothingType}
            onChange={(e) => onUpdate({
              title: e.target.value === 'top' ? '上装参考' : e.target.value === 'bottom' ? '下装参考' : '套装/参考图',
              metadata: {
                ...node.metadata,
                clothingType: e.target.value as 'top' | 'bottom' | 'reference' | 'custom'
              }
            })}
            className="node-mini-select"
          >
            <option value="top">上装 (Top)</option>
            <option value="bottom">下装 (Bottom)</option>
            <option value="reference">连身/套装 (Full)</option>
          </select>
        </div>

        {/* Quick Pipeline Actions */}
        <div className="node-pipeline-action-bar">
          {onSpawnMultiModel && (
            <button
              type="button"
              className="node-pipeline-btn primary-purple"
              onClick={(e) => {
                e.stopPropagation();
                onSpawnMultiModel(node);
              }}
              title="一键衍生东亚、欧美、极简先锋等多模特横向对比管线"
            >
              <span>👥</span>
              <span>多模特对比</span>
            </button>
          )}

          {onSpawnBatchViews && (
            <button
              type="button"
              className="node-pipeline-btn primary-cyan"
              onClick={(e) => {
                e.stopPropagation();
                onSpawnBatchViews(node);
              }}
              title="一键展开正面全身、45°半身、微距特写、背面剪裁 4 面图管线"
            >
              <span>✨</span>
              <span>4面图生成</span>
            </button>
          )}
        </div>
      </div>
    </BaseNode>
  );
};
