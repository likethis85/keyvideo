import React, { useState, useRef, useEffect } from 'react';
import type { CanvasNodeType } from '../../types/canvas';

interface CanvasToolbarProps {
  scale: number;
  canUndo: boolean;
  canRedo: boolean;
  selectedCount: number;
  showMinimap: boolean;
  onAddNode: (type: CanvasNodeType) => void;
  onImportFromAiProject?: () => void;
  onAutoLayout?: () => void;
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

  const nodeOptions: Array<{ type: CanvasNodeType; label: string; icon: string; desc: string }> = [
    { type: 'prompt', label: '营销提示词', icon: '✍️', desc: '画面与运镜描述' },
    { type: 'clothing', label: '服装原料参考', icon: '👗', desc: '款式与原料底图' },
    { type: 'image', label: 'AI试衣/图像', icon: '🖼️', desc: '模特生成基底图' },
    { type: 'video', label: '分镜视频生成', icon: '🎬', desc: '电商高清动态镜头' },
    { type: 'workflow', label: '流程中继节点', icon: '⚡', desc: '多分支编排与聚合' }
  ];

  return (
    <div
      className="canvas-floating-toolbar"
      style={{ whiteSpace: 'nowrap', flexWrap: 'nowrap' }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Add node menu */}
      <div
        className="toolbar-dropdown-wrapper"
        ref={dropdownRef}
        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        <button
          type="button"
          className="toolbar-pill-btn primary"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            setIsAddMenuOpen(prev => !prev);
          }}
          title="点击选择要添加的节点类型（服装、提示词、生图、分镜视频等）"
        >
          <span className="btn-icon" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>+</span>
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>添加节点</span>
          <span style={{ fontSize: '9px', marginLeft: '4px', opacity: 0.85 }}>{isAddMenuOpen ? '▲' : '▼'}</span>
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
                <span className="item-icon">{opt.icon}</span>
                <div className="item-text-group">
                  <span className="item-label">{opt.label}</span>
                  <span className="item-desc">{opt.desc}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {onImportFromAiProject && (
        <button
          className="toolbar-pill-btn secondary"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={onImportFromAiProject}
          title="将当前项目向导中的试衣与5幕分镜导入为画布连线图"
        >
          <span className="btn-icon" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>📥</span>
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>从向导导入工程</span>
        </button>
      )}

      {onAutoLayout && (
        <button
          className="toolbar-pill-btn secondary"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={onAutoLayout}
          title="智能拓扑自动整理与对齐，彻底消除所有节点重叠"
        >
          <span className="btn-icon" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>📐</span>
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>自动整理</span>
        </button>
      )}

      <div className="toolbar-divider" />

      {/* Undo / Redo */}
      <button
        className="toolbar-icon-btn"
        disabled={!canUndo}
        onClick={onUndo}
        title="撤销 (Ctrl+Z)"
      >
        ↩
      </button>
      <button
        className="toolbar-icon-btn"
        disabled={!canRedo}
        onClick={onRedo}
        title="重做 (Ctrl+Y)"
      >
        ↪
      </button>

      <div className="toolbar-divider" />

      {/* Zoom controls */}
      <button className="toolbar-icon-btn" onClick={onZoomOut} title="缩小 (-)">
        －
      </button>
      <span className="toolbar-zoom-text" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={onResetView} title="点击重置缩放">
        {Math.round(scale * 100)}%
      </span>
      <button className="toolbar-icon-btn" onClick={onZoomIn} title="放大 (+)">
        ＋
      </button>
      <button className="toolbar-icon-btn" onClick={onResetView} title="居中还原视口">
        ⛶
      </button>

      <div className="toolbar-divider" />

      {/* Delete selected */}
      {selectedCount > 0 && (
        <button
          className="toolbar-pill-btn danger"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={onDeleteSelected}
          title="删除所选节点 (Delete)"
        >
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>删除 ({selectedCount})</span>
        </button>
      )}

      {/* Minimap toggle */}
      <button
        className={`toolbar-icon-btn ${showMinimap ? 'active' : ''}`}
        onClick={onToggleMinimap}
        title="切换小地图显示"
      >
        🗺️
      </button>
    </div>
  );
};
