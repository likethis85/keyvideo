import { useState, type ReactNode } from 'react';

export type EditorToolTab = 'template' | 'media' | 'text' | 'sticker' | 'ai' | 'audio' | 'prompt';

interface ToolNavigationProps {
  activeTab: EditorToolTab;
  isDrawerCollapsed: boolean;
  onSelectTab: (tab: EditorToolTab) => void;
  onSelectWorkspace: () => void;
}

const tools: Array<{
  id: EditorToolTab;
  label: string;
  title: string;
  icon: ReactNode;
  tone: string;
}> = [
  {
    id: 'template',
    label: '脚本模板',
    title: '脚本模板库',
    tone: 'violet',
    icon: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>
  },
  {
    id: 'media',
    label: '素材库',
    title: '模特与素材库',
    tone: 'cyan',
    icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>
  },
  {
    id: 'prompt',
    label: '提示词库',
    title: '提示词与运镜库',
    tone: 'amber',
    icon: <><path d="M5 4.5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-4 2v-14a2 2 0 0 1 2-2Z" /><path d="M9 9.2c.4-.7 1.1-1.1 2-1.1 1.2 0 2 .7 2 1.7 0 1.5-1.8 1.7-1.8 3.1M11.2 16.1h.01" /><path d="m17 7 .55 1.45L19 9l-1.45.55L17 11l-.55-1.45L15 9l1.45-.55L17 7Z" /></>
  },
  {
    id: 'text',
    label: '文本',
    title: '营销卖点文案',
    tone: 'blue',
    icon: <><polyline points="4 7 4 4 20 4 20 7" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="9" y1="20" x2="15" y2="20" /></>
  },
  {
    id: 'ai',
    label: 'AI 创作',
    title: 'AI 试衣与图生视频',
    tone: 'teal',
    icon: <><path d="m4 20 10.7-10.7" /><path d="m13.2 6.8 4 4" /><path d="m14.8 5.2 1.4-1.4a2 2 0 0 1 2.8 2.8l-1.4 1.4" /><path d="m6.2 17.8-2 2" /><path d="m19 13 .65 1.85L21.5 15.5l-1.85.65L19 18l-.65-1.85-1.85-.65 1.85-.65L19 13Z" /><path d="m7 3 .5 1.5L9 5l-1.5.5L7 7l-.5-1.5L5 5l1.5-.5L7 3Z" /></>
  },
  {
    id: 'audio',
    label: '音乐',
    title: '时尚卡点 BGM',
    tone: 'green',
    icon: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>
  }
];

function ToolIcon({ children }: { children: ReactNode }) {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

export function ToolNavigation({ activeTab, isDrawerCollapsed, onSelectTab, onSelectWorkspace }: ToolNavigationProps) {
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  return (
    <nav className={`editor-sidebar ${isNavCollapsed ? 'nav-drawer-collapsed' : 'nav-drawer-open'}`} aria-label="创作工具栏">
      <div className="nav-drawer-header">
        <div className="nav-drawer-title"><span className="nav-drawer-mark" aria-hidden="true">✦</span><span><strong>创作工具</strong><small>项目工作区</small></span></div>
        <button className="nav-drawer-toggle" type="button" onClick={() => setIsNavCollapsed(value => !value)} title={isNavCollapsed ? '展开工具抽屉' : '收起工具抽屉'} aria-label={isNavCollapsed ? '展开工具抽屉' : '收起工具抽屉'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={isNavCollapsed ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} /></svg>
        </button>
      </div>
      <button
        className={`nav-tab workspace-tab ${isDrawerCollapsed ? 'active' : ''}`}
        onClick={onSelectWorkspace}
        data-tooltip="工作台：收起工具面板，专注预览与时间轴"
        title="工作台：收起工具面板，专注预览与时间轴"
      >
        <span className="nav-icon-shell workspace-icon"><ToolIcon>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </ToolIcon></span><span>工作台</span><small>预览与时间轴</small>
      </button>

      {tools.map(tool => (
        <button
          key={tool.id}
          className={`nav-tab tool-nav-tab tone-${tool.tone} ${activeTab === tool.id && !isDrawerCollapsed ? 'active' : ''}`}
          onClick={() => onSelectTab(tool.id)}
          data-tooltip={tool.title}
          title={tool.title}
        >
          <span className="nav-icon-shell"><ToolIcon>{tool.icon}</ToolIcon></span>
          <span>{tool.label}</span>
          <small>{tool.id === 'template' ? '灵感与结构' : tool.id === 'media' ? '模特与场景' : tool.id === 'prompt' ? '镜头与风格' : tool.title.replace(/库|营销卖点|促销活动|时尚卡点|AI /g, '')}</small>
        </button>
      ))}
      <div className="nav-drawer-footer"><span>当前工具</span><b>{isDrawerCollapsed ? '工作台' : tools.find(tool => tool.id === activeTab)?.label || '工作台'}</b></div>
    </nav>
  );
}
