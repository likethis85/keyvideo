import { createPortal } from 'react-dom';

export interface PreviewSceneState { id?: string; src: string; name: string }

interface ScenePreviewModalProps {
  scene: PreviewSceneState | null;
  editingName: boolean;
  nameValue: string;
  editPrompt: string;
  isGenerating: boolean;
  onClose: () => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onNameChange: (value: string) => void;
  onSaveName: () => void | Promise<void>;
  onPromptChange: (value: string) => void;
  onApply: (name: string, src: string) => void;
  onRegenerate: () => void | Promise<void>;
}

export function ScenePreviewModal(props: ScenePreviewModalProps) {
  if (!props.scene) return null;
  const scene = props.scene;
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,10,15,.85)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }} onClick={props.onClose}>
      <div style={{ maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', background: 'rgba(20,21,31,.95)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', color: '#fff' }} onClick={event => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: '12px' }}>
          {props.editingName ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>🖼️</span>
              <input value={props.nameValue} onChange={event => props.onNameChange(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void props.onSaveName(); }} autoFocus className="text-input" style={{ width: '160px', height: '28px', padding: '0 8px' }} />
              <button className="icon-btn-micro project-confirm" onClick={() => void props.onSaveName()} title="保存">✓</button>
              <button className="icon-btn-micro project-cancel" onClick={props.onCancelRename} title="取消">×</button>
            </div>
          ) : (
            <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🖼️ 背景场景: {scene.name}
              {scene.id && <button className="icon-btn-micro project-action" onClick={props.onStartRename} title="修改名称">✎</button>}
            </h3>
          )}
          <button onClick={props.onClose} style={{ background: 'none', border: 0, color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', background: '#0c0d12', borderRadius: '8px', maxHeight: '40vh' }}><img src={scene.src} alt={scene.name} style={{ maxWidth: '100%', maxHeight: '40vh', objectFit: 'contain' }} /></div>
        {scene.id && <textarea value={props.editPrompt} onChange={event => props.onPromptChange(event.target.value)} placeholder="输入场景修改提示词，留空则按原配置重新生成" rows={2} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: '8px', color: '#fff', padding: '8px 12px' }} />}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={props.onClose} disabled={props.isGenerating}>关闭</button>
          <button className="btn-primary" onClick={() => { props.onApply(scene.name, scene.src); props.onClose(); }} disabled={props.isGenerating}>应用此背景</button>
          {scene.id && <button className="btn-primary" onClick={() => void props.onRegenerate()} disabled={props.isGenerating}>{props.isGenerating ? '⏳ 重新生成中...' : `🔄 ${props.editPrompt.trim() ? '按提示词重新生成' : '重新生成背景'}`}</button>}
        </div>
      </div>
    </div>, document.body
  );
}
