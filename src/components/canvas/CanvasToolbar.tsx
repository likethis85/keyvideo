import React, { useState, useRef, useEffect } from 'react';
import type { CanvasNodeType } from '../../types/canvas';
import { CanvasIcon, type CanvasIconName } from './CanvasIcon';

interface CanvasToolbarProps {
  scale: number;
  canUndo: boolean;
  canRedo: boolean;
  selectedCount: number;
  showMinimap: boolean;
  onAddNode: (type: CanvasNodeType) => void;
  onImportFromAiProject?: () => void;
  onAutoLayout?: () => void;
  onExecutePipeline?: () => void;
  isExecutingPipeline?: boolean;
  onBatchSyncTimeline?: () => void;
  onSpawnMultiModel?: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  onToggleMinimap: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  scale,
  canUndo,
  canRedo,
  selectedCount,
  showMinimap,
  onAddNode,
  onImportFromAiProject,
  onAutoLayout,
  onExecutePipeline,
  isExecutingPipeline,
  onBatchSyncTimeline,
  onSpawnMultiModel,
  onZoomIn,
  onZoomOut,
  onResetView,
  onUndo,
  onRedo,
  onDeleteSelected,
  onToggleMinimap
}) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    if (!isAddMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddMenuOpen]);

  const nodeOptions: Array<{ type: CanvasNodeType; label: string; icon: CanvasIconName; desc: string }> = [
    { type: 'prompt', label: '营销提示词', icon: 'draw', desc: '画面与运镜描述' },
    { type: 'clothing', label: '服装原料参考', icon: 'layers', desc: '款式与原料底图' },
    { type: 'image', label: 'AI试衣/图像', icon: 'grid', desc: '模特生成基底图' },
    { type: 'video', label: '分镜视频生成', icon: 'play', desc: '电商高清动态镜头' },
    { type: 'workflow', label: '流程中继节点', icon: 'connect', desc: '多分支编排与聚合' }
  ];

  return (
    <div
      className="canvas-floating-toolbar"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Add node menu */}
      <div
        className="toolbar-dropdown-wrapper"
        ref={dropdownRef}
      >
        <button
          type="button"
          className="toolbar-pill-btn primary"
          onClick={(e) => {
            e.stopPropagation();
            setIsAddMenuOpen(prev => !prev);
          }}
          title="点击选择要添加的节点类型（服装、提示词、生图、分镜视频等）"
        >
          <span className="btn-icon"><CanvasIcon name="add" size={19} /></span>
          <span className="toolbar-label">添加节点</span>
          <span className="toolbar-chevron"><CanvasIcon name={isAddMenuOpen ? 'chevronUp' : 'chevronDown'} size={14} /></span>
        </button>

        {isAddMenuOpen && (
          <div
            className="toolbar-menu-dropdown"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="toolbar-menu-header">
              <span>选择要添加的节点类型</span>
            </div>
            {nodeOptions.map(opt => (
              <button
                key={opt.type}
                type="button"
                className="toolbar-menu-item"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNode(opt.type);
                  setIsAddMenuOpen(false);
                }}
              >
                <span className="item-icon"><CanvasIcon name={opt.icon} size={19} /></span>
                <div className="item-text-group">
                  <span className="item-label">{opt.label}</span>
                  <span className="item-desc">{opt.desc}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Multi-Model Comparison Spawner */}
      {onSpawnMultiModel && (
        <button
          className="toolbar-pill-btn secondary"
          onClick={onSpawnMultiModel}
          title="一键衍生东亚、欧美、先锋冷灰等多模特横向对比分支"
        >
          <span className="btn-icon"><CanvasIcon name="users" size={18} /></span>
          <span className="toolbar-label">多模特对比管线</span>
        </button>
      )}

      {/* Execute Pipeline DAG */}
      {onExecutePipeline && (
        <button
          className={`toolbar-pill-btn primary-run ${isExecutingPipeline ? 'running' : ''}`}
          onClick={onExecutePipeline}
          disabled={isExecutingPipeline}
          title="按拓扑流自底向上执行全画布/选中节点的批量生图与视频渲染"
        >
          <span className="btn-icon">
            {isExecutingPipeline ? '…' : <CanvasIcon name="play" size={18} />}
          </span>
          <span className="toolbar-label">
            {isExecutingPipeline ? '管线执行中...' : '批量执行管线'}
          </span>
        </button>
      )}

      {/* Batch Sync to Timeline */}
      {onBatchSyncTimeline && (
        <button
          className="toolbar-pill-btn secondary"
          onClick={onBatchSyncTimeline}
          title="将画布中所有已生成的图片/视频片段一键平铺注入底部剪辑时间轴"
        >
          <span className="btn-icon"><CanvasIcon name="layers" size={18} /></span>
          <span className="toolbar-label">批量同步时间轴</span>
        </button>
      )}

      {/* Import from AI Project */}
      {onImportFromAiProject && (
        <button
          className="toolbar-pill-btn secondary"
          onClick={onImportFromAiProject}
          title="将当前项目向导中的试衣与5幕分镜导入为画布连线图"
        >
          <span className="btn-icon"><CanvasIcon name="import" size={18} /></span>
          <span className="toolbar-label">从向导导入工程</span>
        </button>
      )}

      {/* Auto-Layout */}
      {onAutoLayout && (
        <button
          className="toolbar-pill-btn secondary"
          onClick={onAutoLayout}
          title="智能拓扑自动整理与对齐，彻底消除所有节点重叠"
        >
          <span className="btn-icon"><CanvasIcon name="layout" size={18} /></span>
          <span className="toolbar-label">自动整理</span>
        </button>
      )}

      <div className="toolbar-divider" />

      {/* Undo / Redo */}
      <button
        className="toolbar-icon-btn"
        disabled={!canUndo}
        onClick={onUndo}
        title="撤销上一步操作 (Ctrl+Z)"
        aria-label="撤销上一步操作"
        data-tooltip="撤销"
      >
        <CanvasIcon name="undo" size={20} />
      </button>
      <button
        className="toolbar-icon-btn"
        disabled={!canRedo}
        onClick={onRedo}
        title="重做刚刚撤销的操作 (Ctrl+Y)"
        aria-label="重做刚刚撤销的操作"
        data-tooltip="重做"
      >
        <CanvasIcon name="redo" size={20} />
      </button>

      <div className="toolbar-divider" />

      {/* Zoom controls */}
      <button className="toolbar-icon-btn" onClick={onZoomOut} title="缩小画布 (-)" aria-label="缩小画布" data-tooltip="缩小画布">
        <CanvasIcon name="zoomOut" size={20} />
      </button>
      <button type="button" className="toolbar-zoom-text" onClick={onResetView} title="点击重置缩放到 100%" aria-label="重置缩放">
        {Math.round(scale * 100)}%
      </button>
      <button className="toolbar-icon-btn" onClick={onZoomIn} title="放大画布 (+)" aria-label="放大画布" data-tooltip="放大画布">
        <CanvasIcon name="zoomIn" size={20} />
      </button>
      <button className="toolbar-icon-btn" onClick={onResetView} title="适应画布并回到中心" aria-label="适应画布" data-tooltip="适应画布">
        <CanvasIcon name="fit" size={20} />
      </button>

      <div className="toolbar-divider" />

      {/* Delete selected */}
      {selectedCount > 0 && (
        <button
          className="toolbar-pill-btn danger"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={onDeleteSelected}
          title="删除所选节点 (Delete)"
          aria-label={`删除所选节点，共 ${selectedCount} 个`}
        >
          <span className="btn-icon"><CanvasIcon name="trash" size={17} /></span>
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>删除 ({selectedCount})</span>
        </button>
      )}

      {/* Minimap toggle */}
      <button
        className={`toolbar-icon-btn ${showMinimap ? 'active' : ''}`}
        onClick={onToggleMinimap}
        title={`${showMinimap ? '隐藏' : '显示'}画布小地图`}
        aria-label={`${showMinimap ? '隐藏' : '显示'}画布小地图`}
        data-tooltip={`${showMinimap ? '隐藏' : '显示'}小地图`}
      >
        <CanvasIcon name="map" size={20} />
      </button>
    </div>
  );
};
