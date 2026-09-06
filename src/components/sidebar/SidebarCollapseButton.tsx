interface Props { collapsed: boolean; onToggle?: () => void; }

export function SidebarCollapseButton({ collapsed, onToggle }: Props) {
  return <button className="drawer-toggle-btn" onClick={onToggle} title={collapsed ? '展开侧边栏' : '收起侧边栏'}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>;
}
