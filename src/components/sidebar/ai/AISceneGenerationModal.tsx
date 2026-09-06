import { createPortal } from 'react-dom';

interface AISceneGenerationModalProps {
  isOpen: boolean;
  isGenerating: boolean;
  prompt: string;
  referenceImage: string | null;
  multiView: boolean;
  onClose: () => void;
  onPromptChange: (value: string) => void;
  onReferenceImageChange: (value: string | null) => void;
  onMultiViewChange: (value: boolean) => void;
  onGenerate: () => void | Promise<void>;
}

export function AISceneGenerationModal(props: AISceneGenerationModalProps) {
  if (!props.isOpen) return null;
  const close = () => { if (!props.isGenerating) props.onClose(); };
  const loadImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => props.onReferenceImageChange(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(9, 10, 15, 0.8)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }} onClick={close}>
      <div style={{ width: '400px', background: 'rgba(20, 21, 31, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '16px', color: '#fff' }} onClick={event => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>✨ AI 智能背景场景生成</h3>
          {!props.isGenerating && <button onClick={close} style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>×</button>}
        </div>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>请描述你期望的商用服装拍摄背景场景：</label>
        <textarea value={props.prompt} onChange={event => props.onPromptChange(event.target.value)} disabled={props.isGenerating} placeholder="例如：极简水泥风现代建筑空间、阳光透过落地窗洒在大理石地面上..." rows={3} className="text-input" style={{ width: '100%', padding: '10px', fontSize: '12px', borderRadius: '6px', resize: 'none' }} />
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>🖼️ 上传场景参考图（可选）：</label>
          {props.referenceImage ? (
            <div style={{ position: 'relative', width: '80px', height: '80px' }}><img src={props.referenceImage} alt="场景参考" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} /><button disabled={props.isGenerating} onClick={() => props.onReferenceImageChange(null)} style={{ position: 'absolute', top: 2, right: 2, borderRadius: '50%', border: 0, background: 'rgba(0,0,0,.7)', color: '#ff5252' }}>×</button></div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', border: '1px dashed rgba(255,255,255,.2)', borderRadius: '6px', cursor: 'pointer' }}>+ 选择图片<input type="file" accept="image/*" hidden onChange={event => loadImage(event.target.files?.[0])} /></label>
          )}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}><input type="checkbox" checked={props.multiView} onChange={event => props.onMultiViewChange(event.target.checked)} disabled={props.isGenerating} />🎬 生成多视角空间合图</label>
        <small style={{ color: 'var(--text-muted)' }}>💡 场景背景图片比例将锁定为 16:9。</small>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={close} disabled={props.isGenerating}>取消</button>
          <button className="ai-btn" onClick={() => void props.onGenerate()} disabled={props.isGenerating}>{props.isGenerating ? '⏳ 正在绘制...' : '✨ 立即生成'}</button>
        </div>
      </div>
    </div>, document.body
  );
}
