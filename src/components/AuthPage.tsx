import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export const AuthPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    } catch (err: any) {
      console.error('Auth error:', err);
      // Simplify error messages for standard Supabase codes
      let msg = err.message || '操作失败，请重试';
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
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff', marginTop: '8px' }}>KeyVideo 服装视频智剪</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted, #9ca3af)' }}>
            邮箱安全登录进入工作台
          </span>
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
      </div>
    </div>
  );
};
