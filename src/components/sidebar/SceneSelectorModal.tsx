import React from 'react';
import { createPortal } from 'react-dom';
import { formatFileName } from '../../utils/formatUtils';
import { AIIcon } from './ai/AIIcon';

export interface CustomSceneItem {
  id: string;
  name: string;
  src: string;
}

interface SceneSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelScene: string;
  setModelScene: (scene: string) => void;
  sceneBackgrounds?: Record<string, string>;
  customScenes: CustomSceneItem[];
  onGoToMedia: () => void;
}

export const SceneSelectorModal: React.FC<SceneSelectorModalProps> = ({
  isOpen,
  onClose,
  modelScene,
  setModelScene,
  customScenes,
  onGoToMedia
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="scene-selector-backdrop" onClick={onClose}>
      <section className="scene-selector-modal" role="dialog" aria-modal="true" aria-labelledby="scene-selector-title" onClick={event => event.stopPropagation()}>
        <header className="scene-selector-header">
          <div className="scene-selector-heading"><span className="scene-selector-mark"><AIIcon name="scene" size={21} /></span><div><h3 id="scene-selector-title">选择分镜背景场景</h3><p>为 AI 分镜选择可复用的空间背景</p></div></div>
          <button className="scene-selector-close" onClick={onClose} aria-label="关闭"><AIIcon name="close" size={20} /></button>
        </header>
        <div className="scene-selector-body">
          <div className="scene-selector-toolbar"><span>我的场景素材</span><small>{customScenes.length} 个可用场景</small></div>
          <div className="scene-selector-grid">
            {customScenes.length === 0 ? (
              <div className="scene-selector-empty"><span><AIIcon name="scene" size={28} /></span><strong>暂无自定义场景</strong><p>前往素材库上传或生成专属背景，完成后会出现在这里。</p></div>
            ) : (
              customScenes.map(scene => {
                const isActive = modelScene === scene.id;
                return <button className={`scene-selector-card ${isActive ? 'active' : ''}`} key={scene.id} onClick={() => { setModelScene(scene.id); onClose(); }}>
                  <span className="scene-selector-image" style={{ backgroundImage: `url(${scene.src})` }} />
                  <span className="scene-selector-card-copy"><strong title={scene.name}>{formatFileName(scene.name)}</strong><small>{isActive ? '当前已选择' : '点击应用到分镜'}</small></span>
                  {isActive && <span className="scene-selector-check"><AIIcon name="check" size={14} /></span>}
                </button>;
              })
            )}
          </div>
        </div>
        <footer className="scene-selector-footer">
          <button className="btn-secondary scene-selector-manage" onClick={() => { onClose(); onGoToMedia(); }}><AIIcon name="library" size={17} />前往素材库管理场景</button>
          <button className="btn-secondary scene-selector-cancel" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </div>, document.body
  );
};
