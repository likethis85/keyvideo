import type { StoryboardItem } from './StoryboardStep';

export interface StoryboardPreview {
  src: string;
  name: string;
  storyboardId: string;
}

interface Props {
  storyboards: StoryboardItem[];
  generating: boolean;
  fetchingRecent: boolean;
  regeneratingId: string | null;
  draggedIndex: number | null;
  onGenerate: () => void;
  onFetchRecent: () => void;
  onDraggedIndexChange: (index: number | null) => void;
  onReorder: (from: number, to: number) => void;
  onPreview: (preview: StoryboardPreview) => void;
}

const shotLabels: Record<string, string> = {
  'full-body': '全身展示', medium: '半身中景', 'close-up': '细节特写',
  'shot-1': '分镜一 (0-3s)', 'shot-2': '分镜二 (3-5s)', 'shot-3': '分镜三 (5-8s)',
  'shot-4': '分镜四 (8-12s)', 'shot-5': '分镜五 (12-15s)'
};

export function StoryboardGenerationPanel(props: Props) {
  return (
    <div className="storyboard-generation-panel">
      <div className="storyboard-generation-actions">
        <button className={`btn-primary ${props.generating ? 'is-stopping' : ''}`} onClick={props.onGenerate}>
          {props.generating ? '■ 停止生成 (点击中断)' : '🎬 一键生成模特场景分镜图'}
        </button>
        <button className="btn-secondary" onClick={props.onFetchRecent} disabled={props.fetchingRecent} title="若上次生成网络中断或超时，点击直接从服务器拉取最新生成的图片">
          ⇩ {props.fetchingRecent ? '拉取中...' : '补发/恢复结果'}
        </button>
      </div>

      {props.storyboards.length > 0 && (
        <div className="storyboard-card-grid">
          {props.storyboards.map((storyboard, index) => {
            const busy = storyboard.isGeneratingImage || props.regeneratingId === storyboard.id;
            return (
              <div
                className={`storyboard-card ${props.draggedIndex === index ? 'dragging' : ''}`}
                key={storyboard.id}
                draggable
                onDragStart={() => props.onDraggedIndexChange(index)}
                onDragOver={event => event.preventDefault()}
                onDrop={() => { if (props.draggedIndex !== null) props.onReorder(props.draggedIndex, index); props.onDraggedIndexChange(null); }}
                title="按住鼠标可拖拽调换分镜位置次序"
              >
                <div className="storyboard-thumbnail">
                  <img src={storyboard.imageSrc} alt={storyboard.name} />
                  {busy ? (
                    <div className="storyboard-busy"><span className="storyboard-spinner" /><span>{props.regeneratingId === storyboard.id ? '重做中...' : '生成中...'}</span></div>
                  ) : (
                    <button className="storyboard-preview-button" onClick={() => props.onPreview({ src: storyboard.imageSrc, name: `${storyboard.name} (静态分镜)`, storyboardId: storyboard.id })} title="预览图片">👁️</button>
                  )}
                </div>
                <span className="storyboard-card-label" title={storyboard.name}>{shotLabels[storyboard.shotType || ''] || '分镜五 (12-15s)'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
