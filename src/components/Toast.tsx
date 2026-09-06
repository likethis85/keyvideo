import React, { useState, useEffect } from 'react';
import { toastListeners } from './toastStore';
import type { ToastItem } from './toastStore';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToast = (newToast: ToastItem) => {
      setToasts(prev => [...prev.slice(-4), newToast]); // Keep up to 5 at once
    };
    toastListeners.push(handleToast);
    return () => {
      const idx = toastListeners.indexOf(handleToast);
      if (idx !== -1) toastListeners.splice(idx, 1);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
        maxWidth: '420px'
      }}
    >
      {toasts.map(t => (
        <ToastMessage key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
};

const ToastMessage: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast: item, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, item.duration || 3500);
    return () => clearTimeout(timer);
  }, [item, onClose]);

  const typeConfig = {
    success: {
      icon: '✅',
      borderColor: 'rgba(52, 211, 153, 0.4)',
      glowColor: 'rgba(52, 211, 153, 0.15)',
      badgeBg: 'rgba(52, 211, 153, 0.2)',
      badgeColor: '#34d399'
    },
    error: {
      icon: '⚠️',
      borderColor: 'rgba(239, 68, 68, 0.4)',
      glowColor: 'rgba(239, 68, 68, 0.15)',
      badgeBg: 'rgba(239, 68, 68, 0.2)',
      badgeColor: '#ef4444'
    },
    warning: {
      icon: '🔔',
      borderColor: 'rgba(245, 158, 11, 0.4)',
      glowColor: 'rgba(245, 158, 11, 0.15)',
      badgeBg: 'rgba(245, 158, 11, 0.2)',
      badgeColor: '#f59e0b'
    },
    info: {
      icon: 'ℹ️',
      borderColor: 'rgba(0, 242, 254, 0.4)',
      glowColor: 'rgba(0, 242, 254, 0.15)',
      badgeBg: 'rgba(0, 242, 254, 0.2)',
      badgeColor: '#00f2fe'
    }
  }[item.type];

  return (
    <div
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '10px',
        background: 'rgba(16, 18, 27, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${typeConfig.borderColor}`,
        boxShadow: `0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px ${typeConfig.glowColor}`,
        color: '#ffffff',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '13px',
        lineHeight: '1.4',
        animation: 'toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        minWidth: '280px',
        cursor: 'default'
      }}
    >
      <span style={{ fontSize: '15px', flexShrink: 0 }}>{typeConfig.icon}</span>
      <div style={{ flex: 1, wordBreak: 'break-word', color: '#e5e7eb' }}>
        {item.message}
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: '#9ca3af',
          cursor: 'pointer',
          padding: '2px 4px',
          fontSize: '14px',
          lineHeight: '1',
          transition: 'color 0.15s'
        }}
        onMouseOver={e => (e.currentTarget.style.color = '#ffffff')}
        onMouseOut={e => (e.currentTarget.style.color = '#9ca3af')}
        title="关闭"
      >
        ✕
      </button>
      <style>{`
        @keyframes toastSlideIn {
          from {
            transform: translateX(100%) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
