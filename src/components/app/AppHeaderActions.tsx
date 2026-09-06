import { useEffect, useRef, useState } from 'react';

interface Props {
  theme: 'dark' | 'light';
  userEmail?: string;
  onAddLayer: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onSignOut: () => void | Promise<void>;
}

export function AppHeaderActions(props: Props) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!userMenuOpen) return;
    const close = (event: MouseEvent) => { if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [userMenuOpen]);

  return <div className="header-actions">
    <button className="btn-secondary" onClick={props.onAddLayer}>＋ <span className="action-btn-text">添加图层</span></button>
    <button className="btn-primary" onClick={props.onExport}>⇩ <span className="action-btn-text">一键导出</span></button>
    <button className="btn-secondary header-action-button" onClick={props.onOpenSettings} title="后端服务器配置">⚙️ <span className="action-btn-text">服务配置</span></button>
    <button className="btn-secondary header-action-button" onClick={props.onToggleTheme} title={props.theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}>{props.theme === 'dark' ? '☀️' : '🌙'} <span className="action-btn-text">{props.theme === 'dark' ? '浅色' : '深色'}</span></button>
    {props.userEmail && <><span className="header-action-divider" /><div className="header-user-menu" ref={userMenuRef}>
      <button className="header-user-avatar" onClick={() => setUserMenuOpen(open => !open)} title={props.userEmail}>{props.userEmail[0]?.toUpperCase()}</button>
      {userMenuOpen && <div className="header-user-popover"><div><small>当前登录</small><span title={props.userEmail}>{props.userEmail}</span></div><button onClick={async () => { setUserMenuOpen(false); if (confirm('确定要退出登录吗？')) await props.onSignOut(); }}>🚪 退出登录</button></div>}
    </div></>}
  </div>;
}
