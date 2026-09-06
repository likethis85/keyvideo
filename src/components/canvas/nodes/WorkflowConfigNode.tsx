import React from 'react';
import type { CanvasNodeData } from '../../../types/canvas';
import { BaseNode } from './BaseNode';

interface WorkflowConfigNodeProps {
  node: CanvasNodeData;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<CanvasNodeData>) => void;
  onStartConnect: (fromHandle: string) => void;
  onEndConnect: (toHandle: string) => void;
  onExecuteWorkflow?: (node: CanvasNodeData) => void;
}

export const WorkflowConfigNode: React.FC<WorkflowConfigNodeProps> = ({
  node,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
  onStartConnect,
  onEndConnect,
  onExecuteWorkflow
}) => {
  const gender = node.metadata.modelGender || 'female';
  const region = node.metadata.modelRegion || 'east-asian';
  const scene = node.metadata.modelScene || '高端极简电商影棚，自然柔光';

  return (
    <BaseNode
      node={node}
      isSelected={isSelected}
      onSelect={onSelect}
      onDelete={onDelete}
      onStartConnect={onStartConnect}
      onEndConnect={onEndConnect}
      headerIcon={<span style={{ fontSize: '14px' }}>⚡</span>}
      extraHeaderActions={
        onExecuteWorkflow ? (
          <button
            className="node-action-pill-btn run-btn"
            onClick={() => onExecuteWorkflow(node)}
            disabled={node.status === 'loading'}
            title="读取上游连接的原料与提示词，自动触发 AI 批量流水线"
          >
            {node.status === 'loading' ? '执行中...' : '🚀 运行流程'}
          </button>
        ) : null
      }
    >
      <div className="workflow-node-content" onClick={(e) => e.stopPropagation()}>
        <div className="node-property-row">
          <label>模特性别:</label>
          <select
            value={gender}
            onChange={(e) => onUpdate({
              metadata: {
                ...node.metadata,
                modelGender: e.target.value as 'female' | 'male'
              }
            })}
            className="node-mini-select"
          >
            <option value="female">女性模特 (Female)</option>
            <option value="male">男性模特 (Male)</option>
          </select>
        </div>

        <div className="node-property-row">
          <label>模特面容:</label>
          <select
            value={region}
            onChange={(e) => onUpdate({
              metadata: {
                ...node.metadata,
                modelRegion: e.target.value as 'east-asian' | 'western'
              }
            })}
            className="node-mini-select"
          >
            <option value="east-asian">东亚/国潮面容</option>
            <option value="western">欧美高级感面容</option>
          </select>
        </div>

        <div className="node-property-row vertical">
          <label>影棚与布光基调:</label>
          <input
            type="text"
            className="node-mini-input"
            value={scene}
            onChange={(e) => onUpdate({
              metadata: {
                ...node.metadata,
                modelScene: e.target.value
              }
            })}
            placeholder="输入场景基调..."
          />
        </div>

        <div className="workflow-inputs-hint">
          <small>
            💡 连接左侧 [服装节点] 与 [提示词节点]，向下游连接 [分镜或视频节点] 即可形成全自动试衣成片管道。
          </small>
        </div>
      </div>
    </BaseNode>
  );
};
