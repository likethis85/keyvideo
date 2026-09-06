import { formatFileName } from '../../../utils/formatUtils';

interface LibraryItem { id: string; src: string; name: string; }
interface Props {
  modelUrl: string;
  models: LibraryItem[];
  sceneId: string;
  sceneBackgrounds: Record<string, string>;
  customScenes: LibraryItem[];
  onOpenModels: () => void;
  onOpenScenes: () => void;
}

const sceneNames: Record<string, string> = {
  street: '🏙️ 摩登街头', studio: '🧘 专业影棚', home: '🏡 温馨居家', office: '💼 职场办公',
  beach: '🏖️ 阳光海滩', runway: '👠 时尚秀场', minimalist: '🎨 极简侘寂'
};

function SelectorRow({ label, src, name, hint, onClick }: { label: string; src: string; name: string; hint: string; onClick: () => void }) {
  return <div className="try-on-selector-group"><span>{label}</span><button className="try-on-selector-row" onClick={onClick}>{src ? <img src={src} alt={name} /> : <span className="try-on-selector-placeholder">🖼️</span>}<span className="try-on-selector-copy"><strong title={name}>{formatFileName(name)}</strong><small>{hint}</small></span><span>➔</span></button></div>;
}

export function TryOnModelSceneSelector(props: Props) {
  const modelName = props.modelUrl === '/clothing_model.png' ? '默认模特 (风衣模特)' : props.models.find(item => item.src === props.modelUrl)?.name || '库内模特';
  const customScene = props.customScenes.find(item => item.id === props.sceneId);
  const sceneSrc = props.sceneBackgrounds[props.sceneId] || customScene?.src || '';
  const sceneName = sceneNames[props.sceneId] || customScene?.name || '自定义场景';
  return (
    <div className="property-group try-on-model-scene-selector">
      <span className="property-label">👤 模特与场景配置</span>
      <SelectorRow label="选择试衣模特" src={props.modelUrl} name={modelName} hint="点击打开模特库选择" onClick={props.onOpenModels} />
      <SelectorRow label="选择分镜背景场景" src={sceneSrc} name={sceneName} hint="点击打开场景库选择" onClick={props.onOpenScenes} />
    </div>
  );
}
