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
  icon: React.ReactNode;
}> = [
  {
    id: 'template',
    label: '脚本模板',
    title: '脚本模板库',
    icon: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>
  },
  {
    id: 'media',
    label: '素材库',
    title: '模特与素材库',
    icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>
  },
  {
    id: 'prompt',
    label: '提示词库',
    title: '提示词与运镜库',
    icon: <><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></>
  },
  {
    id: 'text',
    label: '文本',
    title: '营销卖点文案',
    icon: <><polyline points="4 7 4 4 20 4 20 7" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="9" y1="20" x2="15" y2="20" /></>
  },
  {
    id: 'sticker',
    label: '贴纸',
    title: '促销活动贴纸',
    icon: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  },
  {
    id: 'ai',
    label: 'AI 创作',
    title: 'AI 试衣与图生视频',
    icon: <><path d="M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2 2.1 2.1M6.3 17.7l2.1-2.1m7.2-7.2 2.1-2.1" /><circle cx="12" cy="12" r="4" /></>
  },
  {
    id: 'audio',
    label: '音乐',
    title: '时尚卡点 BGM',
    icon: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>
  }
];

export function ToolNavigation({ activeTab, isDrawerCollapsed, onSelectTab, onSelectWorkspace }: ToolNavigationProps) {
  return (
    <nav className="editor-sidebar">
      <div className="sidebar-brand" title="KeyVideo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#071018" strokeWidth="2.3" strokeLinecap="round">
          <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 5.2l-1.4 1.4M7.6 15.4l-1.4 1.4M20.2 12.2l-1.4-1.4M6.2 6.2l1.4 1.4" />
        </svg>
      </div>
      <button
        className={`nav-tab workspace-tab ${isDrawerCollapsed ? 'active' : ''}`}
        onClick={onSelectWorkspace}
        title="工作台：收起工具面板，专注预览与时间轴"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
        <span>工作台</span>
      </button>

      {tools.map(tool => (
        <button
          key={tool.id}
          className={`nav-tab ${activeTab === tool.id && !isDrawerCollapsed ? 'active' : ''}`}
          onClick={() => onSelectTab(tool.id)}
          title={tool.title}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tool.id === 'text' ? 2.2 : 2} strokeLinecap="round" strokeLinejoin="round">
            {tool.icon}
          </svg>
          <span>{tool.label}</span>
        </button>
      ))}
    </nav>
  );
}
