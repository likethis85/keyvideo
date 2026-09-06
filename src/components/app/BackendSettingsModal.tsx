import { useState, useEffect, useCallback } from 'react';
import { toast } from '../toastStore';

interface BackendSettingsModalProps {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  theme?: 'dark' | 'light';
  onThemeChange?: (theme: 'dark' | 'light') => void;
}

const PRESETS = [
  { label: '本地默认 (localhost)', url: 'http://localhost:3001' },
  { label: '环回地址 (127.0.0.1)', url: 'http://127.0.0.1:3001' }
];

export function BackendSettingsModal({
  isOpen,
  value,
  onChange,
  onClose,
  theme = 'dark',
  onThemeChange
}: BackendSettingsModalProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'success' | 'error';
    message?: string;
    latency?: number;
  }>({ status: 'idle' });

  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setTestResult({ status: 'idle' });
    }
  }

  const save = useCallback(() => {
    const url = value.trim().replace(/\/$/, '');
    localStorage.setItem('KEYVIDEO_BACKEND_URL', url);
    onClose();
    toast.success(`已成功配置后端地址为: ${url || '默认值 (http://localhost:3001)'}`);
    window.setTimeout(() => window.location.reload(), 600);
  }, [value, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, save]);

  const testConnection = useCallback(async (targetUrl?: string) => {
    const urlToTest = (targetUrl ?? value).trim().replace(/\/$/, '') || 'http://localhost:3001';
    setTesting(true);
    setTestResult({ status: 'idle' });
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(`${urlToTest}/api/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);
      if (resp.ok) {
        setTestResult({ status: 'success', message: `服务连通正常 (${latency}ms)`, latency });
      } else {
        setTestResult({ status: 'error', message: `响应异常 HTTP ${resp.status}` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error && err.name === 'AbortError' 
        ? '请求超时 (3.5s)' 
        : '无法连通服务，请确认后端已启动';
      setTestResult({ status: 'error', message: msg });
    } finally {
      setTesting(false);
    }
  }, [value]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 6, 12, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '520px',
          maxWidth: '92vw',
          background: 'var(--modal-bg, #14151f)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          color: 'var(--text-primary, #ffffff)',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border-color, rgba(255, 255, 255, 0.05))',
          position: 'relative'
        }}
        onClick={event => event.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.2), rgba(0, 242, 254, 0.15))',
                border: '1px solid rgba(138, 43, 226, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}
            >
              ⚙️
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary, #ffffff)', letterSpacing: '-0.01em' }}>
                系统设置与服务配置
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #9ca3af)', marginTop: '2px' }}>
                自定义外观主题偏好、微服务网关通信地址与服务连通性
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #9ca3af)',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'all 0.15s ease',
              padding: 0
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'var(--bg-element-hover, rgba(255,255,255,0.08))';
              e.currentTarget.style.color = 'var(--text-primary, #ffffff)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary, #9ca3af)';
            }}
            title="关闭 (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Section 1: Appearance & Theme Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
              界面主题外观 (Theme)
            </label>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)' }}>
              即时生效并持久化
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Dark Theme Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onThemeChange?.('dark')}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onThemeChange?.('dark'); }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '12px',
                cursor: 'pointer',
                background: theme === 'dark'
                  ? 'rgba(138, 43, 226, 0.14)'
                  : 'var(--bg-element, rgba(255, 255, 255, 0.04))',
                border: theme === 'dark'
                  ? '1.5px solid var(--accent-purple, #8a2be2)'
                  : '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                boxShadow: theme === 'dark'
                  ? '0 0 16px rgba(138, 43, 226, 0.22)'
                  : 'none',
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0
                }}
              >
                🌙
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
                    暗黑科技
                  </span>
                  {theme === 'dark' && (
                    <span style={{ fontSize: '10px', color: '#a855f7', fontWeight: 600, background: 'rgba(168, 85, 247, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                      当前生效
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary, #9ca3af)', lineHeight: '1.4' }}>
                  影视级深色调色与暗光工作流
                </span>
              </div>
            </div>

            {/* Light Theme Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onThemeChange?.('light')}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onThemeChange?.('light'); }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '12px',
                cursor: 'pointer',
                background: theme === 'light'
                  ? 'rgba(2, 132, 199, 0.14)'
                  : 'var(--bg-element, rgba(255, 255, 255, 0.04))',
                border: theme === 'light'
                  ? '1.5px solid var(--accent-cyan, #0284c7)'
                  : '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                boxShadow: theme === 'light'
                  ? '0 0 16px rgba(2, 132, 199, 0.22)'
                  : 'none',
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0
                }}
              >
                ☀️
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
                    现代明亮
                  </span>
                  {theme === 'light' && (
                    <span style={{ fontSize: '10px', color: '#0284c7', fontWeight: 600, background: 'rgba(2, 132, 199, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                      当前生效
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary, #9ca3af)', lineHeight: '1.4' }}>
                  现代采光影棚与高对比度美学
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border-color, rgba(255, 255, 255, 0.08))' }} />

        {/* Input Field Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
              后端基础 URL (BACKEND_BASE_URL)
            </label>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', fontFamily: 'var(--mono, monospace)' }}>
              端口 :3001
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={value}
              onChange={event => {
                onChange(event.target.value);
                setTestResult({ status: 'idle' });
              }}
              placeholder="例如 http://localhost:3001"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 14px',
                fontSize: '13px',
                fontFamily: 'var(--mono, monospace)',
                background: 'var(--bg-element, rgba(255, 255, 255, 0.05))',
                color: 'var(--text-primary, #ffffff)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                borderRadius: '10px',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2)'
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--accent-purple, #8a2be2)';
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-purple-glow, rgba(138, 43, 226, 0.25))';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border-color, rgba(255, 255, 255, 0.12))';
                e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0, 0, 0, 0.2)';
              }}
            />
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted, #6b7280)' }}>快速预设:</span>
            {PRESETS.map(p => {
              const isActive = value.trim().replace(/\/$/, '') === p.url;
              return (
                <button
                  key={p.url}
                  type="button"
                  onClick={() => {
                    onChange(p.url);
                    testConnection(p.url);
                  }}
                  style={{
                    background: isActive ? 'rgba(138, 43, 226, 0.18)' : 'var(--bg-element, rgba(255,255,255,0.04))',
                    border: `1px solid ${isActive ? 'var(--accent-purple, #8a2be2)' : 'var(--border-color, rgba(255,255,255,0.08))'}`,
                    color: isActive ? 'var(--accent-purple, #a855f7)' : 'var(--text-secondary, #9ca3af)',
                    fontSize: '11px',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontWeight: isActive ? 600 : 400
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Connectivity Status Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 12px',
            background: 'var(--card-bg, rgba(255,255,255,0.02))',
            border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            borderRadius: '10px',
            fontSize: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                display: 'inline-block',
                background:
                  testResult.status === 'success'
                    ? '#10b981'
                    : testResult.status === 'error'
                    ? '#ef4444'
                    : '#6b7280',
                boxShadow:
                  testResult.status === 'success'
                    ? '0 0 8px #10b981'
                    : testResult.status === 'error'
                    ? '0 0 8px #ef4444'
                    : 'none',
                transition: 'all 0.2s'
              }}
            />
            <span
              style={{
                color:
                  testResult.status === 'success'
                    ? '#10b981'
                    : testResult.status === 'error'
                    ? '#ef4444'
                    : 'var(--text-secondary, #9ca3af)'
              }}
            >
              {testResult.status === 'idle' ? '未检测服务连通性' : testResult.message}
            </span>
          </div>
          <button
            type="button"
            onClick={() => testConnection()}
            disabled={testing}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
              color: 'var(--text-primary, #ffffff)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              cursor: testing ? 'not-allowed' : 'pointer',
              opacity: testing ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={e => {
              if (!testing) e.currentTarget.style.borderColor = 'var(--accent-purple, #8a2be2)';
            }}
            onMouseOut={e => {
              if (!testing) e.currentTarget.style.borderColor = 'var(--border-color, rgba(255,255,255,0.15))';
            }}
          >
            {testing ? '⏳ 测试中...' : '⚡ 测试连通性'}
          </button>
        </div>

        {/* Tip & Documentation Card */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(0, 242, 254, 0.04)',
            border: '1px solid rgba(0, 242, 254, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '12px',
            lineHeight: '1.6',
            color: 'var(--text-secondary, #9ca3af)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan, #00f2fe)', fontWeight: 600 }}>
            <span>💡</span>
            <span>配置说明</span>
          </div>
          <div>• <strong>本地运行</strong>：默认值即为本地开发微服务端口 <code>http://localhost:3001</code>。</div>
          <div>• <strong>远程/局域网</strong>：跨设备或局域网联调时，请填写真机/服务器 IP（如 <code>http://192.168.1.10:3001</code>）。</div>
          <div>• 点击「保存并应用」将自动持久化至浏览器 LocalStorage 并重载生效。</div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            保存并应用
          </button>
        </div>
      </div>
    </div>
  );
}
