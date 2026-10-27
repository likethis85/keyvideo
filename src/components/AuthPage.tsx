import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { getSsoStatus, startSsoLogin } from '../services/ssoAuth';

interface AuthPageProps {
  initialError?: string | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoStatus, setSsoStatus] = useState<{ checking: boolean; configured: boolean; reachable: boolean }>({
    checking: true,
    configured: false,
    reachable: false
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError || null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSsoStatus().then((status) => {
      if (!active) return;
      setSsoStatus({ checking: false, configured: status.configured, reachable: status.reachable });
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSsoLogin = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSsoLoading(true);
    try {
      startSsoLogin();
    } catch (err: unknown) {
      setSsoLoading(false);
      setErrorMsg(err instanceof Error ? err.message : '无法发起统一登录，请稍后重试');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('请填写完整的邮箱与密码');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('密码长度不能少于 6 位');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      setSuccessMsg('登录成功！正在载入您的编辑器...');
    } catch (err: unknown) {
      console.error('Auth error:', err);
      // Simplify error messages for standard Supabase codes
      let msg = err instanceof Error ? err.message : '操作失败，请重试';
      if (msg.includes('Invalid login credentials')) {
        msg = '邮箱或密码不正确';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #1a1c29 0%, #08090f 100%)',
      fontFamily: "'Outfit', sans-serif",
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Premium background ambient light blobs */}
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'rgba(0, 242, 254, 0.12)',
        borderRadius: '50%',
        filter: 'blur(100px)',
        top: '10%',
        left: '20%',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        background: 'rgba(138, 43, 226, 0.12)',
        borderRadius: '50%',
        filter: 'blur(120px)',
        bottom: '10%',
        right: '15%',
        pointerEvents: 'none'
      }} />

      {/* Main Card Container */}
      <div style={{
        width: '420px',
        padding: '40px',
        borderRadius: '16px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* App Logo Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent-cyan, #00f2fe), var(--accent-purple, #8a2be2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(0, 242, 254, 0.25)'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#090a0f" strokeWidth="2.5">
              <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 5.2l-1.4 1.4M7.6 15.4l-1.4 1.4M20.2 12.2l-1.4-1.4M6.2 6.2l1.4 1.4" />
            </svg>
          </div>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff', marginTop: '8px' }}>KeyVideo 智能剪辑</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted, #9ca3af)' }}>
            使用企业统一登录，或邮箱密码进入工作台
          </span>
        </div>

        {/* Unified SSO entry. Credentials and code exchange stay on the backend. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={handleSsoLogin}
            disabled={ssoLoading || ssoStatus.checking || !ssoStatus.configured}
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent-cyan, #00f2fe), var(--accent-purple, #8a2be2))',
              border: 'none',
              color: '#090a0f',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: ssoLoading || ssoStatus.checking || !ssoStatus.configured ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: ssoStatus.checking || !ssoStatus.configured ? 0.55 : 1,
              boxShadow: ssoStatus.configured ? '0 4px 14px rgba(0, 242, 254, 0.2)' : 'none',
              transition: 'transform 0.1s, opacity 0.2s'
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            <span>
              {ssoStatus.checking
                ? '正在检查统一登录...'
                : ssoStatus.configured
                  ? (ssoLoading ? '正在跳转...' : '使用统一登录')
                  : ssoStatus.reachable
                    ? '统一登录尚未配置'
                    : '统一登录服务暂不可用'}
            </span>
          </button>
          {!ssoStatus.checking && !ssoStatus.configured && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #9ca3af)', textAlign: 'center', lineHeight: 1.5 }}>
              {ssoStatus.reachable
                ? (isSupabaseConfigured
                    ? '请联系管理员配置统一登录，或使用下方邮箱密码登录'
                    : '请联系管理员配置统一登录')
                : (isSupabaseConfigured
                    ? '无法连接后端统一登录接口，请检查后端地址或使用邮箱密码登录'
                    : '无法连接后端统一登录接口，请检查后端地址')}
            </span>
          )}
        </div>

        {/* Form Error / Success Alerts */}
        {errorMsg && (
          <div style={{
            background: 'rgba(255, 82, 82, 0.1)',
            border: '1px solid rgba(255, 82, 82, 0.2)',
            padding: '10px 14px',
            borderRadius: '6px',
            color: '#ff5252',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div style={{
            background: 'rgba(0, 242, 254, 0.1)',
            border: '1px solid rgba(0, 242, 254, 0.2)',
            padding: '10px 14px',
            borderRadius: '6px',
            color: '#00f2fe',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>🟢</span>
            <span>{successMsg}</span>
          </div>
        )}

        {isSupabaseConfigured ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
              <span style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)' }}>或使用邮箱账号登录</span>
              <span style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary, #d1d5db)', fontWeight: '600' }}>电子邮箱</label>
            <input
              type="email"
              placeholder="请输入您的邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              className="auth-input"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary, #d1d5db)', fontWeight: '600' }}>密码</label>
            <input
              type="password"
              placeholder="请输入密码 (至少 6 位)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              className="auth-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '10px',
              padding: '12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent-cyan, #00f2fe), var(--accent-purple, #8a2be2))',
              border: 'none',
              color: '#090a0f',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
              transition: 'transform 0.1s, opacity 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? '登录中...' : '邮箱安全登录'}
          </button>
            </form>
          </>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '12px 14px',
            color: 'var(--text-muted, #9ca3af)',
            fontSize: '12px',
            lineHeight: 1.6,
            textAlign: 'center'
          }}>
            邮箱密码登录尚未配置，请使用上方的企业统一登录。
          </div>
        )}
      </div>
    </div>
  );
};
