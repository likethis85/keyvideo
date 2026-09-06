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
}

export const ClothingNode: React.FC<ClothingNodeProps> = ({
  node,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
  onStartConnect,
  onEndConnect
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
      </div>
    </BaseNode>
  );
};
