import type { ChangeEvent } from 'react';
import type { CanvasNodeData } from '../../types/canvas';

interface CanvasNodeInspectorProps {
  node: CanvasNodeData | null;
  onUpdate: (patch: Partial<CanvasNodeData>) => void;
  onClose: () => void;
  onRegenerate?: () => void;
}

function statusLabel(status: CanvasNodeData['status']) {
  if (status === 'success') return '已完成';
  if (status === 'loading') return '执行中';
  if (status === 'error') return '执行失败';
  return '待执行';
}

function nodeIcon(node: CanvasNodeData) {
  if (node.type === 'clothing') return '▦';
  if (node.type === 'prompt') return '✎';
  if (node.type === 'image') return '✦';
  if (node.type === 'video') return '▶';
  return '✦';
}

export function CanvasNodeInspector({ node, onUpdate, onClose, onRegenerate }: CanvasNodeInspectorProps) {
  const updateMetadata = (key: string, value: unknown) => {
    if (!node) return;
    onUpdate({ metadata: { ...node.metadata, [key]: value } });
  };

  const updateText = (key: string) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    updateMetadata(key, event.target.value);
  };

  return (
    <aside className="canvas-node-inspector" aria-label="节点设置" onMouseDown={event => event.stopPropagation()}>
      <header className="canvas-inspector-header">
        <b>节点设置</b>
        <button type="button" aria-label="关闭节点设置" onClick={onClose}>×</button>
      </header>
      {node ? (
        <div className="canvas-inspector-scroll">
          <div className="canvas-inspector-node-card">
            <span className="canvas-inspector-node-icon">{nodeIcon(node)}</span>
            <div>
              <strong>{node.title}</strong>
              <small>输出 1 · {statusLabel(node.status)}</small>
            </div>
            <span className={`canvas-inspector-status ${node.status || 'idle'}`} />
          </div>

          <section className="canvas-inspector-section">
            <h4>输入</h4>
            <label className="canvas-inspector-field"><span>服装素材</span><input value={node.metadata.imageSrc ? '已绑定图片' : '未绑定素材'} readOnly /></label>
            <label className="canvas-inspector-field"><span>参考模特</span><input value={node.metadata.modelRegion === 'western' ? '欧美 · 高级感' : '东亚 · 通勤感'} onChange={updateText('modelRegion')} /></label>
            <label className="canvas-inspector-field"><span>场景基调</span><input value={node.metadata.modelScene || '都市街景'} onChange={updateText('modelScene')} /></label>
          </section>

          <section className="canvas-inspector-section">
            <h4>提示词</h4>
            <textarea
              value={node.metadata.text || node.metadata.inpaintPrompt || ''}
              placeholder="输入画面、姿态和运镜要求"
              rows={5}
              onChange={updateText('text')}
            />
          </section>

          <section className="canvas-inspector-section">
            <h4>输出</h4>
            <label className="canvas-inspector-field"><span>画幅</span><select value={node.metadata.aspectRatio || '9:16'} onChange={updateText('aspectRatio')}><option value="9:16">9:16 · 1K</option><option value="16:9">16:9 · 1K</option><option value="1:1">1:1 · 1K</option><option value="3:4">3:4 · 1K</option></select></label>
            <label className="canvas-inspector-field"><span>模型</span><select value={node.metadata.model || 'Nano Banana 2'} onChange={updateText('model')}><option>Nano Banana 2</option><option>Google Imagen 4</option><option>Kling 3.0</option></select></label>
            <label className="canvas-inspector-field"><span>使用下游</span><input value={node.type === 'workflow' ? '分镜 1–5' : '当前节点'} readOnly /></label>
          </section>

          {node.metadata.imageSrc && <div className="canvas-inspector-preview"><img src={node.metadata.imageSrc} alt="节点输入预览" /></div>}
          <button type="button" className="canvas-inspector-regenerate" onClick={onRegenerate} disabled={!onRegenerate || node.status === 'loading'}>↻ 重新生成此节点</button>
          <p className="canvas-inspector-note">节点完成后会自动更新下游连接；拖动节点或端点即可调整工作流。</p>
        </div>
      ) : (
        <div className="canvas-inspector-empty"><span>✦</span><strong>选择一个节点</strong><p>点击画布中的节点，在这里编辑输入、提示词和输出设置。</p></div>
      )}
    </aside>
  );
}
