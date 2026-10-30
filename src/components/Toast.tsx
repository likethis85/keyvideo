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
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        pointerEvents: 'none',
        padding: '24px',
        maxWidth: 'none'
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

  const isInteractive = Boolean(item.onClick || item.action);

  const handleCardClick = () => {
    if (item.onClick) {
      item.onClick();
      onClose();
    } else if (item.action) {
      item.action.onClick();
      onClose();
    }
  };

  return (
    <div
      onClick={isInteractive ? handleCardClick : undefined}
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        borderRadius: '14px',
        background: 'rgba(16, 18, 27, 0.97)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${typeConfig.borderColor}`,
        boxShadow: `0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px ${typeConfig.glowColor}`,
        color: '#ffffff',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '15px',
        fontWeight: 650,
        lineHeight: '1.4',
        animation: 'toastCenterIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        minWidth: 'min(360px, calc(100vw - 48px))',
        maxWidth: 'min(620px, calc(100vw - 48px))',
        cursor: isInteractive ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, border-color 0.15s ease, filter 0.15s ease'
      }}
      onMouseOver={e => {
        if (isInteractive) {
          e.currentTarget.style.filter = 'brightness(1.1)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseOut={e => {
        if (isInteractive) {
          e.currentTarget.style.filter = 'none';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      <span style={{ fontSize: '15px', flexShrink: 0 }}>{typeConfig.icon}</span>
      <div style={{ flex: 1, wordBreak: 'break-word', color: '#e5e7eb' }}>
        {item.message}
      </div>

      {item.action && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            item.action?.onClick();
            onClose();
          }}
          style={{
            flexShrink: 0,
            padding: '4px 10px',
            borderRadius: '6px',
            background: typeConfig.badgeBg,
            border: `1px solid ${typeConfig.borderColor}`,
            color: typeConfig.badgeColor,
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          onMouseOver={e => {
            e.stopPropagation();
            e.currentTarget.style.filter = 'brightness(1.25)';
            e.currentTarget.style.transform = 'scale(1.04)';
          }}
          onMouseOut={e => {
            e.stopPropagation();
            e.currentTarget.style.filter = 'none';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {item.action.label}
        </button>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          background: 'none',
          border: 'none',
          color: '#9ca3af',
          cursor: 'pointer',
          padding: '2px 4px',
          fontSize: '14px',
          lineHeight: '1',
          transition: 'color 0.15s',
          flexShrink: 0
        }}
        onMouseOver={e => (e.currentTarget.style.color = '#ffffff')}
        onMouseOut={e => (e.currentTarget.style.color = '#9ca3af')}
        title="关闭"
      >
        ✕
      </button>
      <style>{`
        @keyframes toastCenterIn {
          from {
            transform: translateY(12px) scale(0.92);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
