import { useEffect, useRef, useState } from 'react';

interface Props {
  theme: 'dark' | 'light';
  userEmail?: string;
  onAddLayer: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onSignOut: () => void | Promise<void>;
  onToggleCopilot?: () => void;
  onOpenCustomApiModal?: () => void;
  onExportProjectPackage?: () => void;
  onImportProjectPackage?: (file: File) => void;
}

export function AppHeaderActions(props: Props) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuOpen && !userMenuRef.current?.contains(target)) {
        setUserMenuOpen(false);
      }
      if (settingsMenuOpen && !settingsMenuRef.current?.contains(target)) {
        setSettingsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
        setSettingsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen, settingsMenuOpen]);

  return (
    <div className="header-actions">
      {/* Hidden file input for importing project packages */}
      {props.onImportProjectPackage && (
        <input
          type="file"
          ref={fileInputRef}
          accept=".json,.keyvideo.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) props.onImportProjectPackage?.(file);
            e.target.value = '';
          }}
        />
      )}

      {/* Primary Action Buttons */}
      <button className="btn-secondary" onClick={props.onAddLayer}>
        ＋ <span className="action-btn-text">添加图层</span>
      </button>

      <button className="btn-primary" onClick={props.onExport}>
        ⇩ <span className="action-btn-text">一键导出</span>
      </button>

      {/* AI Copilot shortcut */}
      {props.onToggleCopilot && (
        <button
          className="btn-secondary header-action-button"
          onClick={props.onToggleCopilot}
          title="唤出 AI 剪辑助理"
        >
          🤖 <span className="action-btn-text">AI 助理</span>
        </button>
      )}

      {/* Settings Dropdown Menu: includes 导入工程, 导出工程, 服务配置, API 脚本 */}
      <div style={{ position: 'relative' }} ref={settingsMenuRef}>
        <button
          className={`btn-secondary header-action-button ${settingsMenuOpen ? 'active' : ''}`}
          onClick={() => setSettingsMenuOpen(open => !open)}
          title="系统与工程设置"
          style={{
            borderColor: settingsMenuOpen ? 'var(--accent-purple, #8a2be2)' : undefined,
            background: settingsMenuOpen ? 'var(--bg-element-hover, rgba(255,255,255,0.08))' : undefined,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ⚙️ <span className="action-btn-text">设置</span>
          <span
            style={{
              fontSize: '10px',
              opacity: 0.7,
              display: 'inline-block',
              transform: settingsMenuOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}
          >
            ▾
          </span>
        </button>

        {settingsMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '230px',
              background: 'var(--modal-bg, #14151f)',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
              borderRadius: '12px',
              boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border-color, rgba(255, 255, 255, 0.05))',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              zIndex: 1000,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            {/* Group 1: Project Package Management */}
            <div
              style={{
                padding: '6px 10px 4px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted, #6b7280)',
                letterSpacing: '0.04em'
              }}
            >
              工程文件管理
            </div>

            {props.onImportProjectPackage && (
              <button
                type="button"
                onClick={() => {
                  setSettingsMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary, #ffffff)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'var(--bg-element-hover, rgba(255,255,255,0.06))';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: '15px' }}>📥</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>导入工程</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #9ca3af)' }}>载入 .keyvideo.json</span>
                </div>
              </button>
            )}

            {props.onExportProjectPackage && (
              <button
                type="button"
                onClick={() => {
                  setSettingsMenuOpen(false);
                  props.onExportProjectPackage?.();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary, #ffffff)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'var(--bg-element-hover, rgba(255,255,255,0.06))';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: '15px' }}>📦</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>导出工程</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #9ca3af)' }}>导出离线源工程包</span>
                </div>
              </button>
            )}

            {/* Subtle Divider */}
            <div
              style={{
                height: '1px',
                background: 'var(--border-color, rgba(255,255,255,0.08))',
                margin: '4px 6px'
              }}
            />

            {/* Group 2: System and API Config */}
            <div
              style={{
                padding: '6px 10px 4px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted, #6b7280)',
                letterSpacing: '0.04em'
              }}
            >
              服务与接口配置
            </div>

            <button
              type="button"
              onClick={() => {
                setSettingsMenuOpen(false);
                props.onOpenSettings();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary, #ffffff)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'var(--bg-element-hover, rgba(255,255,255,0.06))';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: '15px' }}>⚙️</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>服务配置</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary, #9ca3af)' }}>后端服务地址与连通性</span>
              </div>
            </button>

            {props.onOpenCustomApiModal && (
              <button
                type="button"
                onClick={() => {
                  setSettingsMenuOpen(false);
                  props.onOpenCustomApiModal?.();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary, #ffffff)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'var(--bg-element-hover, rgba(255,255,255,0.06))';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: '15px' }}>⚡</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>API 脚本</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #9ca3af)' }}>自定义模型调度与脚本 (BYOK)</span>
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Theme Toggle */}
      <button
        className="btn-secondary header-action-button"
        onClick={props.onToggleTheme}
        title={props.theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      >
        {props.theme === 'dark' ? '☀️' : '🌙'}{' '}
        <span className="action-btn-text">{props.theme === 'dark' ? '浅色' : '深色'}</span>
      </button>

      {/* User Account Popover */}
      {props.userEmail && (
        <>
          <span className="header-action-divider" />
          <div className="header-user-menu" ref={userMenuRef}>
            <button
              className="header-user-avatar"
              onClick={() => setUserMenuOpen(open => !open)}
              title={props.userEmail}
            >
              {props.userEmail[0]?.toUpperCase()}
            </button>
            {userMenuOpen && (
              <div className="header-user-popover">
                <div>
                  <small>当前登录</small>
                  <span title={props.userEmail}>{props.userEmail}</span>
                </div>
                <button
                  onClick={async () => {
                    setUserMenuOpen(false);
                    if (confirm('确定要退出登录吗？')) await props.onSignOut();
                  }}
                >
                  🚪 退出登录
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
