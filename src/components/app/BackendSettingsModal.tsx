import { toast } from '../toastStore';

interface BackendSettingsModalProps {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

export function BackendSettingsModal({ isOpen, value, onChange, onClose }: BackendSettingsModalProps) {
  if (!isOpen) return null;
  const save = () => {
    const url = value.trim().replace(/\/$/, '');
    localStorage.setItem('KEYVIDEO_BACKEND_URL', url);
    onClose();
    toast.success(`已成功配置后端地址为: ${url || '默认值 (http://localhost:3001)'}`);
    window.setTimeout(() => window.location.reload(), 600);
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,6,10,.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ width: '450px', background: 'var(--modal-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }} onClick={event => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>⚙️ 后端服务地址配置</h3><button onClick={onClose}>✕</button></div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>后端基础 URL (BACKEND_BASE_URL)<input value={value} onChange={event => onChange(event.target.value)} placeholder="例如 http://localhost:3001" /><small>* 默认值为 http://localhost:3001；生产环境请填写服务器公网地址。</small></label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}><button className="btn-secondary" onClick={onClose}>取消</button><button className="btn-primary" onClick={save}>保存并应用</button></div>
      </div>
    </div>
  );
}
