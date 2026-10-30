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

const MODEL_PRESETS = [
  { label: '高级通勤', value: '自然妆容，利落中长发，身材比例自然，气质专业，适合城市通勤服装展示' },
  { label: '时尚大片', value: '精致妆容，时尚短发，姿态自信，面部轮廓清晰，具有高端广告大片气质' },
  { label: '清新自然', value: '自然妆容，柔和长发，亲和笑容，气质清爽，肤质真实细腻' },
  { label: '极简模特', value: '干净妆容，简约发型，身材比例匀称，表情克制，适合电商白底展示' }
];

export function AIModelGenerationModal(props: AIModelGenerationModalProps) {
  if (!props.isOpen) return null;
  const inputId = 'modal-model-ref-upload-trigger';
  const appendPreset = (value: string) => props.onPromptChange(props.prompt.trim() ? `${props.prompt.trim()}，${value}` : value);

  return createPortal(
    <div className="ai-model-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
      <section className="ai-model-modal" role="dialog" aria-modal="true" aria-labelledby="ai-model-title">
        <header className="ai-model-modal-header"><div className="ai-model-modal-heading"><span className="ai-model-modal-mark">♙</span><div><h2 id="ai-model-title">AI 智能模特生成</h2><p>生成可复用的白底三视图模特卡，自动保存到“我的 AI 模特”</p></div></div><button type="button" className="ai-model-modal-close" onClick={props.onClose} aria-label="关闭">×</button></header>
        <div className="ai-model-modal-body">
          <div className="ai-model-main-column">
            <section className="ai-model-panel"><div className="ai-model-section-title"><span>01</span><div><b>参考图与人物设定</b><small>可上传照片控制脸型、发型和姿态</small></div></div><label className={`ai-model-reference ${props.referenceImage ? 'has-image' : ''}`}>{props.referenceImage ? <><img src={props.referenceImage} alt="模特参考" /><span>已添加参考图</span><button type="button" onClick={event => { event.preventDefault(); props.onReferenceClear(); }}>移除</button></> : <><span className="ai-model-upload-mark">＋</span><b>上传模特参考图</b><small>可选 · JPG / PNG</small></>}<input id={inputId} type="file" accept="image/*" onChange={props.onReferenceUpload} hidden /></label></section>
            <section className="ai-model-panel"><div className="ai-model-section-title"><span>02</span><div><b>基础属性</b><small>用于保持人物在后续镜头中的一致性</small></div></div><div className="ai-model-fields"><label><span>模特性别</span><select value={props.gender} onChange={event => props.onGenderChange(event.target.value as 'female' | 'male')}><option value="female">女性</option><option value="male">男性</option></select></label><label><span>肤色地域</span><select value={props.region} onChange={event => props.onRegionChange(event.target.value as 'east-asian' | 'western')}><option value="east-asian">东亚模特</option><option value="western">欧美模特</option></select></label></div></section>
            <section className="ai-model-panel"><div className="ai-model-section-title"><span>03</span><div><b>人物特征 Prompt</b><small>补充发型、年龄、气质和身材等细节</small></div><span className="ai-model-count">{props.prompt.length}/300</span></div><textarea value={props.prompt} onChange={event => props.onPromptChange(event.target.value)} rows={4} placeholder="例如：黑色齐肩短发，25岁左右，身材高挑，表情自然，气质干练" /><div className="ai-model-presets"><span>快速套用</span>{MODEL_PRESETS.map(preset => <button type="button" key={preset.label} onClick={() => appendPreset(preset.value)}>{preset.label}</button>)}</div></section>
          </div>
          <aside className="ai-model-preview-panel"><div className="ai-model-preview-label">生成预览</div><div className="ai-model-preview-card"><div className="ai-model-silhouette">♙</div><span>白底三视图模特卡</span><small>{props.gender === 'female' ? '女性' : '男性'} · {props.region === 'east-asian' ? '东亚' : '欧美'}</small></div><div className="ai-model-output-list"><b>将自动生成</b><span>✓ 正面全身视图</span><span>✓ 侧面全身视图</span><span>✓ 背面全身视图</span><span>✓ 统一光线与白底</span></div><div className="ai-model-tip"><b>使用建议</b><p>生成后可在模特库中预览、重命名和切换，并会同步到试衣和分镜流程。</p></div></aside>
        </div>
        <footer className="ai-model-modal-footer"><span>生成结果会自动加入当前账号的模特库</span><div><button type="button" className="ai-model-cancel" onClick={props.onClose}>取消</button><button type="button" className="ai-model-generate" onClick={() => { props.onClose(); void props.onGenerate(); }}>✦ 一键生成模特卡</button></div></footer>
      </section>
    </div>, document.body
  );
}
