import React from 'react';
import type { CanvasNodeData } from '../../../types/canvas';
import { BaseNode } from './BaseNode';

interface PromptNodeProps {
  node: CanvasNodeData;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<CanvasNodeData>) => void;
  onStartConnect: (fromHandle: string) => void;
  onEndConnect: (toHandle: string) => void;
}

export const PromptNode: React.FC<PromptNodeProps> = ({
  node,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
  onStartConnect,
  onEndConnect
}) => {
  const textValue = node.metadata.text || '';

  const quickPrompts = [
    '法式复古街头，自然暖光，8k高画质',
    '现代极简高奢影棚，柔焦轮廓光',
    '都市快节奏运镜，大片景深感',
    '特写面料纹理，高级垂坠光泽'
  ];

  return (
    <BaseNode
      node={node}
      isSelected={isSelected}
      onSelect={onSelect}
      onDelete={onDelete}
      onStartConnect={onStartConnect}
      onEndConnect={onEndConnect}
      headerIcon={<span style={{ fontSize: '14px' }}>✍️</span>}
    >
      <div className="prompt-node-content">
        <textarea
          className="node-prompt-textarea"
          value={textValue}
          placeholder="输入画面风格描述、运镜提示词或分镜卖点..."
          rows={4}
          onChange={(e) => onUpdate({
            metadata: {
              ...node.metadata,
              text: e.target.value
            }
          })}
          onClick={(e) => e.stopPropagation()}
        />

        <div className="prompt-quick-tags" onClick={(e) => e.stopPropagation()}>
          <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
            常用电商风格预设:
          </small>
          <div className="tag-chips-wrapper">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                className="quick-tag-chip"
                onClick={() => onUpdate({
                  metadata: {
                    ...node.metadata,
                    text: textValue ? `${textValue}，${p}` : p
                  }
                })}
              >
                + {p.slice(0, 8)}...
              </button>
            ))}
          </div>
        </div>
      </div>
    </BaseNode>
  );
};
