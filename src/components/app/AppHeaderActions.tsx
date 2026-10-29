import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  theme: 'dark' | 'light';
  userEmail?: string;
  variant?: 'library' | 'editor' | 'timeline' | 'canvas';
  onAddLayer: () => void;
  onExport: () => void;
  onPreview?: () => void;
  onOpenSettings: () => void;
  onReplayOnboarding?: () => void;
  onToggleTheme?: () => void;
  onSetTheme?: (theme: 'dark' | 'light') => void;
  onSignOut: () => void | Promise<void>;
  onToggleCopilot?: () => void;
  onOpenCustomApiModal?: () => void;
  onExportProjectPackage?: () => void;
  onImportProjectPackage?: (file: File) => void;
  onOpenProjects?: () => void;
  onCanvasAction?: (action: 'import' | 'fit' | 'run') => void;
}
export function AppHeaderActions(props: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const variant = props.variant ?? 'editor';

  useEffect(() => {
    const outside = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); setShortcutsOpen(false); } };
    document.addEventListener('mousedown', outside);
    window.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('mousedown', outside); window.removeEventListener('keydown', keyboard); };
  }, []);

  const action = (fn?: () => void) => { setMenuOpen(false); fn?.(); };
  const icon = (name: 'preview' | 'shortcut' | 'export' | 'import' | 'fit' | 'run' | 'recent' | 'settings') => {
    const paths: Record<typeof name, ReactNode> = {
      preview: <><path d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
      shortcut: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h2m3 0h2m3 0h0M7 13h6m3 0h1" /></>,
      export: <><path d="M12 16V3" /><path d="m7 8 5-5 5 5" /><path d="M4 14v5h16v-5" /></>,
      import: <><path d="M12 3v13" /><path d="m7 11 5 5 5-5" /><path d="M4 19h16" /></>,
      fit: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 4v4H5m10-4v4h4M9 20v-4H5m10 4v-4h4" /></>,
      run: <><path d="m8 5 11 7-11 7V5Z" /></>,
      recent: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
      settings: <><path d="M12 3.8 14 3l1.25 2.25 2.35.65 2.2-1.05 1.55 1.55-1.05 2.2.65 2.35 2.25 1.25-.8 2-2.5.2-1.45 1.95.25 2.5-2 1-1.8-1.75-2.35.65-1.45 2.05h-2l-1.25-2.25-2.35-.65-2.2 1.05-1.55-1.55 1.05-2.2-.65-2.35L2.8 12l.8-2 2.5-.2 1.45-1.95-.25-2.5 2-1 1.8 1.75 2.35-.65L12 3.8Z" /><circle cx="12" cy="12" r="3.2" /></>
    };
    return <svg className="studio-button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
  };
  return <div className="header-actions studio-header-actions">
    <input ref={fileInputRef} hidden type="file" accept=".json,.keyvideo.json" onChange={event => {
      const file = event.target.files?.[0];
      if (file) props.onImportProjectPackage?.(file);
      event.target.value = '';
    }} />
    {variant === 'library' ? props.onOpenProjects && <button className="studio-button header-action-button" onClick={props.onOpenProjects} title="打开最近项目与项目管理">{icon('recent')}<span>最近项目</span></button>
      : variant === 'canvas' ? <>
        <button className="studio-button header-action-button" onClick={() => props.onCanvasAction?.('import')} title="导入工程包或画布数据">{icon('import')}<span>导入</span></button>
        <button className="studio-button header-action-button" onClick={() => props.onCanvasAction?.('fit')} title="将所有节点缩放到可见范围">{icon('fit')}<span>适应画布</span></button>
        <button className="studio-button header-action-button primary" onClick={() => props.onCanvasAction?.('run')} title="按当前连线顺序运行全部节点">{icon('run')}<span>运行全部</span></button>
      </> : <>
        <button className="studio-button header-action-button" onClick={props.onPreview} title="全屏预览当前成片">{icon('preview')}<span>预览</span></button>
        <button className="studio-button header-action-button" onClick={() => setShortcutsOpen(true)} title="查看剪辑快捷键">{icon('shortcut')}<span>快捷键</span></button>
        <button className={`studio-button header-action-button ${variant === 'editor' ? 'primary' : ''}`} onClick={props.onExport} title="打开视频导出设置">{icon('export')}<span>导出</span></button>
      </>}
    {props.onOpenSettings && <button className="studio-button header-action-button header-settings-button" onClick={props.onOpenSettings} title="打开系统设置">{icon('settings')}<span>设置</span></button>}
    <div className="header-user-menu" ref={menuRef}>
      <button className="header-user-avatar" aria-label="账号与设置" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)} title={props.userEmail}>
        {(props.userEmail || 'K')[0].toUpperCase()}
      </button>
      {menuOpen && <div className="studio-account-menu">
        <div className="studio-account-label"><small>当前账号</small><strong>{props.userEmail}</strong></div>
        {props.onOpenProjects && <button onClick={() => action(props.onOpenProjects)}>▦ 项目管理</button>}
        <button onClick={() => action(props.onAddLayer)}>＋ 添加文本图层</button>
        <button onClick={() => action(() => fileInputRef.current?.click())}>⇣ 导入工程</button>
        <button onClick={() => action(props.onExportProjectPackage)}>↥ 导出工程包</button>
        <hr />
        <button onClick={() => action(props.onOpenCustomApiModal)}>⌘ 自定义接口</button>
        <button onClick={() => action(props.onReplayOnboarding)}>◷ 重新查看新手引导</button>
        <button onClick={() => action(() => props.onSetTheme?.(props.theme === 'dark' ? 'light' : 'dark'))}>{props.theme === 'dark' ? '☀ 浅色外观' : '☾ 深色外观'}</button>
        <hr /><button className="danger" onClick={() => { setMenuOpen(false); if (confirm('确定要退出登录吗？')) void props.onSignOut(); }}>↪ 退出登录</button>
      </div>}
    </div>
    {shortcutsOpen && createPortal(<div className="studio-modal-backdrop" onMouseDown={() => setShortcutsOpen(false)}>
      <section className="studio-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-title" onMouseDown={event => event.stopPropagation()}>
        <header><h2 id="shortcut-title">编辑快捷键</h2><button aria-label="关闭快捷键" onClick={() => setShortcutsOpen(false)}>×</button></header>
        <p>让每一次剪辑，都更顺手。</p>
        {([['播放 / 暂停', 'Space'], ['上一帧 / 下一帧', '← / →'], ['撤销', 'Ctrl / ⌘ + Z'], ['重做', 'Ctrl / ⌘ + Y'], ['分割选中片段', 'Ctrl / ⌘ + B'], ['删除选中图层', 'Delete'], ['退出预览', 'Esc']] as const).map(([label, key]) => <div className="studio-shortcut-row" key={label}><span>{label}</span><kbd>{key}</kbd></div>)}
        <button className="studio-button primary" autoFocus onClick={() => setShortcutsOpen(false)}>知道了</button>
      </section>
    </div>, document.body)}
  </div>;
}
