import React from 'react';

export type WorkspaceViewMode = 'editor' | 'timeline' | 'canvas';

interface ViewModeSwitchProps {
  mode: WorkspaceViewMode;
  onChange: (mode: WorkspaceViewMode) => void;
}

export const ViewModeSwitch: React.FC<ViewModeSwitchProps> = ({ mode, onChange }) => {
  return (
    <div className="workspace-view-mode-switch" role="group" aria-label="工作台模式切换">
      <button
        type="button"
        className={`mode-switch-btn ${mode === 'editor' ? 'active' : ''}`}
        onClick={() => onChange('editor')}
        title="切换到时间线剪辑工作台（支持图层变换、音频卡点与导出）"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mode-btn-svg"
        >
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
          <line x1="7" y1="2" x2="7" y2="22" />
          <line x1="17" y1="2" x2="17" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="2" y1="7" x2="7" y2="7" />
          <line x1="2" y1="17" x2="7" y2="17" />
          <line x1="17" y1="17" x2="22" y2="17" />
          <line x1="17" y1="7" x2="22" y2="7" />
        </svg>
        <span>剪辑</span>
      </button>

      <button
        type="button"
        className={`mode-switch-btn ${mode === 'timeline' ? 'active' : ''}`}
        onClick={() => onChange('timeline')}
        title="进入独立全屏时间轴工作区"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mode-btn-svg">
          <rect x="3" y="5" width="18" height="4" rx="1" />
          <rect x="3" y="11" width="11" height="4" rx="1" />
          <rect x="7" y="17" width="14" height="3" rx="1" />
          <path d="M7 3v18" />
        </svg>
        <span>时间轴</span>
      </button>

      <button
        type="button"
        className={`mode-switch-btn ${mode === 'canvas' ? 'active' : ''}`}
        onClick={() => onChange('canvas')}
        title="切换到 AI 视觉无限画布（支持节点连线、试衣发散与批量分镜）"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mode-btn-svg"
        >
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <path d="M10 6.5h4" />
          <path d="M6.5 10v4" />
          <path d="M17.5 10v4" />
        </svg>
        <span>AI 无限画布</span>
      </button>
    </div>
  );
};
