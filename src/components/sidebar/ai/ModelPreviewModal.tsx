import { createPortal } from 'react-dom';
import type { StoryboardItem } from '../../../types/aiProject';

export interface PreviewModelState { id?: string; src: string; name: string; storyboardId?: string }

interface ModelPreviewModalProps {
  preview: PreviewModelState | null;
  storyboards: StoryboardItem[];
  editingName: boolean;
  nameValue: string;
  storyboardPrompt: string;
  storyboardBackground: string | null;
  outfitPrompt: string;
  poseImage: string | null;
  usePoseCameraFraming: boolean;
  modelPrompt: string;
  regeneratingStoryboardId: string | null;
  outfitGenerating: boolean;
  modelGenerating: boolean;
  isOutfitPreview: boolean;
  onClose: () => void;
  onPreviewChange: (preview: PreviewModelState) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onNameChange: (value: string) => void;
  onSaveName: () => void | Promise<void>;
  onDownload: (url: string, name: string) => void | Promise<void>;
  onStoryboardPromptChange: (value: string) => void;
  onStoryboardBackgroundChange: (value: string | null) => void;
  onRegenerateStoryboard: (id: string, prompt: string, background: string | null) => void | Promise<void>;
  onOutfitPromptChange: (value: string) => void;
  onPoseUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPoseImageClear: () => void;
  onPoseCameraFramingChange: (value: boolean) => void;
  onGenerateOutfit: () => void | Promise<void>;
  onModelPromptChange: (value: string) => void;
  onEditModel: () => void | Promise<void>;
  onApplyModel: (src: string, name: string) => void;
}

const buttonStyle = { padding: '8px 20px', fontSize: '12px' } as const;

export function ModelPreviewModal(props: ModelPreviewModalProps) {
  if (!props.preview) return null;
  const preview = props.preview;
  const storyboardIndex = preview.storyboardId ? props.storyboards.findIndex(item => item.id === preview.storyboardId) : -1;
  const storyboardLoading = !!preview.storyboardId && props.regeneratingStoryboardId === preview.storyboardId;
  const loading = storyboardLoading || (!preview.storyboardId && props.outfitGenerating);
  const navigate = (offset: number) => {
    const item = props.storyboards[storyboardIndex + offset];
    if (item) props.onPreviewChange({ src: item.imageSrc, name: `${item.name} (静态分镜)`, storyboardId: item.id });
  };
  const loadBackground = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => props.onStoryboardBackgroundChange(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,10,15,.85)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }} onClick={props.onClose}>
      <div style={{ maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', background: 'rgba(20,21,31,.95)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', color: '#fff' }} onClick={event => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: '12px' }}>
          {props.editingName ? <div><input value={props.nameValue} onChange={event => props.onNameChange(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void props.onSaveName(); }} autoFocus /><button onClick={() => void props.onSaveName()}>✓</button><button onClick={props.onCancelRename}>×</button></div> : <h3 style={{ margin: 0 }}>👤 模特预览: {preview.name} {preview.id && <button onClick={props.onStartRename}>✎</button>}</h3>}
          <div><button onClick={() => void props.onDownload(preview.src, preview.name || 'model_outfit_image')}>📥 下载</button><button onClick={props.onClose}>×</button></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {preview.storyboardId && <button disabled={storyboardIndex <= 0 || storyboardLoading} onClick={() => navigate(-1)}>‹</button>}
          <div style={{ position: 'relative', minWidth: '320px', maxHeight: '50vh', background: '#0c0d12', borderRadius: '8px' }}><img src={preview.src} alt={preview.name} style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain', opacity: loading ? .3 : 1 }} />{loading && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>⏳ 正在重新生成，请稍候...</div>}</div>
          {preview.storyboardId && <button disabled={storyboardIndex < 0 || storyboardIndex >= props.storyboards.length - 1 || storyboardLoading} onClick={() => navigate(1)}>›</button>}
        </div>
        {preview.storyboardId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <textarea value={props.storyboardPrompt} onChange={event => props.onStoryboardPromptChange(event.target.value)} placeholder="输入修改/局部重绘提示词" rows={2} />
            <div>场景参考图：{props.storyboardBackground ? <><img src={props.storyboardBackground} alt="场景参考" style={{ width: 56, height: 56, objectFit: 'cover' }} /><button onClick={() => props.onStoryboardBackgroundChange(null)}>移除</button></> : <label>上传图片<input type="file" accept="image/*" hidden onChange={event => loadBackground(event.target.files?.[0])} /></label>}</div>
            <div style={{ textAlign: 'right' }}><button onClick={props.onClose} style={buttonStyle}>关闭</button><button disabled={storyboardLoading} onClick={() => void props.onRegenerateStoryboard(preview.storyboardId!, props.storyboardPrompt, props.storyboardBackground)} style={buttonStyle}>{storyboardLoading ? '⏳ 重新生成中...' : '🔄 重新生成此分镜'}</button></div>
          </div>
        ) : props.isOutfitPreview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}><textarea value={props.outfitPrompt} onChange={event => props.onOutfitPromptChange(event.target.value)} placeholder="输入穿搭图修改提示词" rows={2} /><div>{props.poseImage ? <><img src={props.poseImage} alt="姿势参考" style={{ width: 56, height: 56, objectFit: 'cover' }} /><button onClick={props.onPoseImageClear}>移除姿势图</button></> : <label>上传姿势参考<input type="file" accept="image/*" hidden onChange={props.onPoseUpload} /></label>}</div>{props.poseImage && <label><input type="checkbox" checked={props.usePoseCameraFraming} onChange={event => props.onPoseCameraFramingChange(event.target.checked)} />同时参考镜头画面与景别构图</label>}<div style={{ textAlign: 'right' }}><button onClick={props.onClose}>关闭</button><button disabled={props.outfitGenerating} onClick={() => void props.onGenerateOutfit()}>{props.outfitGenerating ? '⏳ 重新生成中...' : '🔄 重新生成穿搭图'}</button></div></div>
        ) : preview.id ? (
          <div><textarea value={props.modelPrompt} onChange={event => props.onModelPromptChange(event.target.value)} placeholder="输入模特修改提示词" rows={2} /><div style={{ textAlign: 'right' }}><button onClick={props.onClose}>关闭</button><button onClick={() => { props.onApplyModel(preview.src, preview.name); props.onClose(); }}>使用此模特</button><button disabled={props.modelGenerating} onClick={() => void props.onEditModel()}>{props.modelGenerating ? '⏳ 重新生成中...' : '🔄 重新生成模特'}</button></div></div>
        ) : <div style={{ textAlign: 'right' }}><button onClick={props.onClose}>关闭</button><button onClick={() => { props.onApplyModel(preview.src, preview.name); props.onClose(); }}>使用此模特</button></div>}
      </div>
    </div>, document.body
  );
}
