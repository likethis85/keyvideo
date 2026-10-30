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

const scenePresets = [
  { label: '极简影棚', prompt: '极简高级感服装影棚，浅灰色无缝背景，柔和大面积侧光，干净留白，适合电商服装展示' },
  { label: '城市街景', prompt: '现代城市商业街傍晚，建筑立面与橱窗灯光，湿润路面反光，时尚商业大片氛围，画面干净无人' },
  { label: '海边度假', prompt: '阳光海岸度假空间，浅色沙滩、海水与棕榈树，清晨通透自然光，轻松高级的商业服装拍摄背景' },
  { label: '奢华客厅', prompt: '现代奢华客厅，大面积落地窗、浅色石材与暖色家具，日光穿过空间，精致但不喧宾夺主' },
  { label: '自然庭院', prompt: '带绿植与建筑框景的现代庭院，清晨柔光、自然材质和浅色墙面，清新高级，适合穿搭展示' }
];

const stylePresets = [
  { label: '高级写实', value: '高端商业摄影，真实材质，细腻光影' },
  { label: '电影质感', value: '电影感构图，层次丰富，柔和戏剧光' },
  { label: '明亮清新', value: '明亮通透，自然色彩，轻盈干净' }
];

export function AISceneGenerationModal(props: AISceneGenerationModalProps) {
  if (!props.isOpen) return null;

  const close = () => { if (!props.isGenerating) props.onClose(); };
  const loadImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => props.onReferenceImageChange(String(reader.result || ''));
    reader.readAsDataURL(file);
  };
  const addStyle = (value: string) => {
    const current = props.prompt.trim();
    if (!current) {
      props.onPromptChange(value);
      return;
    }
    if (!current.includes(value)) props.onPromptChange(`${current}，${value}`);
  };

  return createPortal(
    <div className="ai-scene-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="ai-scene-modal" role="dialog" aria-modal="true" aria-labelledby="ai-scene-title">
        <header className="ai-scene-modal-header">
          <div className="ai-scene-modal-title"><span className="ai-scene-modal-mark">✦</span><div><h2 id="ai-scene-title">AI 智能场景生成</h2><p>描述空间氛围，生成可直接复用的 16:9 背景素材</p></div></div>
          {!props.isGenerating && <button type="button" className="ai-scene-modal-close" onClick={close} aria-label="关闭"><span>×</span></button>}
        </header>

        <div className="ai-scene-modal-body">
          <div className="ai-scene-prompt-panel">
            <div className="ai-scene-section-heading"><span>01</span><div><b>场景描述</b><small>越具体，生成结果越稳定</small></div></div>
            <textarea value={props.prompt} onChange={event => props.onPromptChange(event.target.value)} disabled={props.isGenerating} placeholder="例如：极简水泥风现代建筑空间，阳光透过落地窗洒在大理石地面上，画面干净无人物..." rows={5} />
            <div className="ai-scene-prompt-footer"><span>{props.prompt.length}/500</span><button type="button" onClick={() => props.onPromptChange('')} disabled={props.isGenerating || !props.prompt}>清空</button></div>
            <div className="ai-scene-presets"><span>快速开始</span>{scenePresets.map(preset => <button key={preset.label} type="button" onClick={() => props.onPromptChange(preset.prompt)} disabled={props.isGenerating}>{preset.label}</button>)}</div>
            <div className="ai-scene-presets style"><span>画面风格</span>{stylePresets.map(preset => <button key={preset.label} type="button" onClick={() => addStyle(preset.value)} disabled={props.isGenerating}>{preset.label}</button>)}</div>
          </div>

          <aside className="ai-scene-options-panel">
            <div className="ai-scene-section-heading"><span>02</span><div><b>参考与构图</b><small>可选，用于控制画面方向</small></div></div>
            <label className={`ai-scene-reference ${props.referenceImage ? 'has-image' : ''}`}>
              {props.referenceImage ? <><img src={props.referenceImage} alt="场景参考图" /><button type="button" onClick={event => { event.preventDefault(); props.onReferenceImageChange(null); }} disabled={props.isGenerating} aria-label="移除参考图">×</button></> : <><span className="ai-scene-upload-icon">＋</span><b>上传参考图</b><small>支持 JPG、PNG</small></>}
              {!props.referenceImage && <input type="file" accept="image/*" hidden onChange={event => loadImage(event.target.files?.[0])} />}
            </label>
            <label className={`ai-scene-toggle ${props.multiView ? 'active' : ''}`}><input type="checkbox" checked={props.multiView} onChange={event => props.onMultiViewChange(event.target.checked)} disabled={props.isGenerating} /><span className="ai-scene-toggle-ui" /><span><b>生成多视角空间合图</b><small>一次生成远景、中景和细节视角</small></span></label>
            <div className="ai-scene-ratio"><span>输出规格</span><b>16:9 横版场景</b><small>适合视频画布和时间轴使用</small></div>
            <div className="ai-scene-tips"><b>生成建议</b><span>✓ 描述空间、光线和材质</span><span>✓ 避免加入人物、文字和品牌标识</span><span>✓ 可上传参考图保持风格一致</span></div>
          </aside>
        </div>

        {props.isGenerating && <div className="ai-scene-generating"><i /><span>正在生成场景，请稍候...</span><small>完成后会自动加入背景场景库</small></div>}
        <footer className="ai-scene-modal-footer"><span className="ai-scene-footer-status">{props.referenceImage ? '已添加参考图' : '未添加参考图'} · 输出比例 16:9</span><div><button type="button" className="ai-scene-cancel" onClick={close} disabled={props.isGenerating}>取消</button><button type="button" className="ai-scene-generate" onClick={() => void props.onGenerate()} disabled={props.isGenerating || (!props.prompt.trim() && !props.referenceImage)}>{props.isGenerating ? '生成中...' : '✦ 立即生成'}</button></div></footer>
      </section>
    </div>, document.body
  );
}
