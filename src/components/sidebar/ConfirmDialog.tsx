import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  dialog: { title: string; message: string; onConfirm: () => void } | null;
  onClose: () => void;
}

export function ConfirmDialog({ dialog, onClose }: ConfirmDialogProps) {
  if (!dialog) return null;
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(9, 10, 15, 0.85)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        className="modal-content glass-panel"
        style={{
          width: '380px', maxWidth: '90vw', background: 'rgba(20, 21, 31, 0.96)',
          border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '16px', padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column',
          gap: '16px', color: '#ffffff'
        }}
        onClick={event => event.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{dialog.title}</h3>
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{dialog.message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '6px 14px', fontSize: '12px' }}>取消</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => { const confirm = dialog.onConfirm; onClose(); confirm(); }}
            style={{ padding: '6px 16px', fontSize: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
          >
            确认删除
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
