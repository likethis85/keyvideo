export interface OutfitPreview {
  src: string;
  name: string;
  storyboardId?: string;
}

interface Props {
  imageUrls: string[];
  fallbackImageUrl: string | null;
  onPreview: (preview: OutfitPreview) => void;
  onDelete: (index: number) => void;
  onDeleteFallback: () => void;
}

export function OutfitResultsGallery({ imageUrls, fallbackImageUrl, onPreview, onDelete, onDeleteFallback }: Props) {
  if (imageUrls.length > 0) {
    return (
      <div className="outfit-results">
        <span>已生成穿搭图 ({imageUrls.length} 套)</span>
        <div className="outfit-results-grid">
          {imageUrls.map((src, index) => (
            <div className="outfit-result-card" key={src}>
              <button className="outfit-result-preview" onClick={() => onPreview({ src, name: `模特穿搭图 套${index + 1}` })}>
                <img src={src} alt={`outfit result ${index + 1}`} />
                <span>套 {index + 1}</span>
              </button>
              <button className="outfit-result-delete" onClick={() => { if (confirm(`确定要删除第 ${index + 1} 套已生成的模特穿搭图吗？`)) onDelete(index); }} title="删除此穿搭图">×</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!fallbackImageUrl) return null;
  return (
    <div className="outfit-result-fallback">
      <button className="outfit-fallback-preview" onClick={() => onPreview({ src: fallbackImageUrl, name: '模特服装穿搭效果图 (白底/灰底)' })}>
        <img src={fallbackImageUrl} alt="Outfit try-on" />
      </button>
      <div><strong>穿搭图已就绪</strong><span>纯色背景棚拍效果</span></div>
      <button className="outfit-fallback-delete" onClick={() => { if (confirm('确定要删除这套已生成的穿搭图吗？')) onDeleteFallback(); }}>🗑️ 删除</button>
    </div>
  );
}
