import { createPortal } from 'react-dom';

interface AIModelGenerationModalProps {
  isOpen: boolean;
  referenceImage: string;
  gender: 'female' | 'male';
  region: 'east-asian' | 'western';
  prompt: string;
  onClose: () => void;
  onReferenceUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onReferenceClear: () => void;
  onGenderChange: (value: 'female' | 'male') => void;
  onRegionChange: (value: 'east-asian' | 'western') => void;
  onPromptChange: (value: string) => void;
  onGenerate: () => void | Promise<void>;
}

export function AIModelGenerationModal(props: AIModelGenerationModalProps) {
  if (!props.isOpen) return null;
  const inputId = 'modal-model-ref-upload-trigger';
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,10,15,.82)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ width: '460px', background: 'rgba(20,21,31,.95)', border: '1px solid rgba(255,255,255,.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: '12px' }}><h3 style={{ margin: 0, fontSize: '16px' }}>🧍 AI 智能模特参考卡生成</h3><button onClick={props.onClose}>×</button></div>
        <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>根据性别和肤色设定生成白底三视图模特卡，并自动保存至“我的 AI 模特库”。</p>
        <div className="property-group">
          <span className="property-label">上传肖像/姿态参考图（可选）</span>
          {props.referenceImage ? <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><img src={props.referenceImage} alt="模特参考" style={{ width: 48, height: 48, objectFit: 'contain' }} /><span style={{ flex: 1 }}>已关联模特参考图</span><button onClick={() => document.getElementById(inputId)?.click()}>重新上传</button><button onClick={props.onReferenceClear}>清除</button></div> : <button type="button" onClick={() => document.getElementById(inputId)?.click()} style={{ padding: '16px', border: '1px dashed var(--border-color)' }}>👤 点击上传模特参考图</button>}
          <input id={inputId} type="file" accept="image/*" onChange={props.onReferenceUpload} hidden />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <label>1. 模特性别<select value={props.gender} onChange={event => props.onGenderChange(event.target.value as 'female' | 'male')} className="text-input"><option value="female">女性</option><option value="male">男性</option></select></label>
          <label>2. 肤色地域<select value={props.region} onChange={event => props.onRegionChange(event.target.value as 'east-asian' | 'western')} className="text-input"><option value="east-asian">东亚模特</option><option value="western">欧美模特</option></select></label>
        </div>
        <label>3. 自定义特征 Prompt（可选）<textarea value={props.prompt} onChange={event => props.onPromptChange(event.target.value)} rows={3} className="text-input" placeholder="例如：发型、发色、身材特征" /></label>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}><button className="btn-secondary" onClick={props.onClose}>取消</button><button className="btn-primary" onClick={() => { props.onClose(); void props.onGenerate(); }}>一键生成参考模特卡</button></div>
      </div>
    </div>, document.body
  );
}
