import React from 'react';
import type { CanvasNodeData } from '../../../types/canvas';

interface BaseNodeProps {
  node: CanvasNodeData;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onStartConnect: (fromHandle: string) => void;
  onEndConnect: (toHandle: string) => void;
  children: React.ReactNode;
  headerIcon?: React.ReactNode;
  extraHeaderActions?: React.ReactNode;
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  node,
  isSelected,
  onSelect,
  onDelete,
  onStartConnect,
  onEndConnect,
  children,
  headerIcon,
  extraHeaderActions
}) => {
  return (
    <div
      className={`canvas-node-card ${isSelected ? 'selected' : ''} ${node.status ? `status-${node.status}` : ''}`}
      style={{
        position: 'absolute',
        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
        width: node.width || 300,
        height: 'auto',
        zIndex: isSelected ? 30 : 10
      }}
      onClick={onSelect}
    >
      {/* Left Input Handle */}
      <div
        className="node-handle node-handle-input"
        title="连接输入端点"
        onMouseUp={(e) => {
          e.stopPropagation();
          onEndConnect('in');
        }}
      >
        <div className="handle-dot" />
      </div>

      {/* Right Output Handle */}
      <div
        className="node-handle node-handle-output"
        title="拖拽拉出连接线"
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect('out');
        }}
      >
        <div className="handle-dot" />
      </div>

      {/* Node Header */}
      <div className="canvas-node-header">
        <div className="node-header-title">
          {headerIcon && <span className="node-type-icon">{headerIcon}</span>}
          <span className="node-title-text" title={node.title}>{node.title}</span>
        </div>

        <div className="node-header-actions" onClick={e => e.stopPropagation()}>
          {extraHeaderActions}
          {node.status === 'loading' && (
            <span className="node-status-badge loading" title="AI 生成中...">
              <span className="status-spinner" />
            </span>
          )}
          {node.status === 'success' && (
            <span className="node-status-badge success" title="生成完成">✓</span>
          )}
          {node.status === 'error' && (
            <span className="node-status-badge error" title={node.errorMessage || '生成失败'}>!</span>
          )}
          <button
            className="node-delete-btn"
            onClick={onDelete}
            title="删除节点"
          >
            ×
          </button>
        </div>
      </div>

      {/* Node Body Content */}
      <div className="canvas-node-body">
        {children}
      </div>

      {/* Tags footer if any (for video nodes, duration & shotType chips are already rendered inside body) */}
      {node.type !== 'video' && node.metadata.tags && node.metadata.tags.length > 0 && (
        <div className="canvas-node-footer">
          {node.metadata.tags.map(tag => (
            <span key={tag} className="node-tag-badge">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
};
