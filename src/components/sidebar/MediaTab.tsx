import React, { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toast } from '../toastStore';
import { localDB } from '../../utils/db';
import { formatFileName } from '../../utils/formatUtils';

export interface ModelItem {
  id: string;
  name: string;
  src: string;
  date?: string;
}

export interface CustomSceneItem {
  id: string;
  name: string;
  src: string;
}

export interface LocalVideoItem {
  id: string;
  name: string;
  src: string;
  desc?: string;
  duration?: number;
}

interface MediaTabProps {
  handleModelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setIsGenModelModalOpen: (open: boolean) => void;
  modelLibrary: Array<{ id: string; src: string; date: string; name: string }>;
  swapModelUrl: string;
  applyModelFromLibrary: (src: string, name: string) => void;
  setPreviewModel: (model: { id: string; src: string; name: string } | null) => void;
  setEditingModelNameValue: (val: string) => void;
  setIsEditingModelName: (editing: boolean) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  supabase: SupabaseClient;
  setModelLibrary: React.Dispatch<React.SetStateAction<Array<{ id: string; src: string; date: string; name: string }>>>;
  saveModelLibrarySafely: (lib: Array<{ id: string; src: string; date: string; name: string }>) => void;
  handleSceneUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setShowAiSceneModal: (show: boolean) => void;
  modelScene: string;
  applySceneBackground: (name: string, src: string) => void;
  setPreviewScene: (scene: { id?: string; src: string; name: string } | null) => void;
  customScenes: CustomSceneItem[];
  setEditingSceneNameValue: (val: string) => void;
  setIsEditingSceneName: (editing: boolean) => void;
  deleteCustomScene: (id: string, e: React.MouseEvent) => void;
  isTauri: boolean;
  handleImportLocalVideo: () => void;
  localVideos: LocalVideoItem[];
  addLocalVideoLayer: (video: LocalVideoItem) => void;
  handleDeleteLocalVideo: (e: React.MouseEvent, id: string) => void;
}

type MediaSection = 'models' | 'scenes' | 'videos';

export const MediaTab: React.FC<MediaTabProps> = ({
  handleModelUpload,
  setIsGenModelModalOpen,
  modelLibrary,
  swapModelUrl,
  applyModelFromLibrary,
  setPreviewModel,
  setEditingModelNameValue,
  setIsEditingModelName,
  showConfirm,
  supabase,
  setModelLibrary,
  saveModelLibrarySafely,
  handleSceneUpload,
  setShowAiSceneModal,
  modelScene,
  applySceneBackground,
  setPreviewScene,
  customScenes,
  setEditingSceneNameValue,
  setIsEditingSceneName,
  deleteCustomScene,
  isTauri,
  handleImportLocalVideo,
  localVideos,
  addLocalVideoLayer,
  handleDeleteLocalVideo
}) => {
  const [section, setSection] = useState<MediaSection>('models');

  const deleteModel = (model: { id: string; src: string; name: string }) => {
    showConfirm('删除模特', `确认从模特库中删除模特「${model.name}」吗？`, async () => {
      try {
        const deletedIds: string[] = (await localDB.get('deleted_model_ids')) || [];
        if (model.id && !deletedIds.includes(model.id)) deletedIds.push(model.id);
        if (model.src && !deletedIds.includes(model.src)) deletedIds.push(model.src);
        await localDB.set('deleted_model_ids', deletedIds);

        const { error: deleteError } = await supabase
          .from('model_assets')
          .delete()
          .eq('id', model.id);

        if (deleteError) {
          console.warn('Supabase delete error (handled via local tombstone):', deleteError);
        }
      } catch (err: unknown) {
        console.warn('Failed to delete model from Supabase:', err);
      }

      setModelLibrary(previous => {
        const updated = previous.filter(item => item.id !== model.id && item.src !== model.src);
        saveModelLibrarySafely(updated);
        return updated;
      });
      toast.success(`已从模特库中永久删除「${model.name}」`);
    });
  };

  return (
    <>
      <div className="drawer-header media-tab-header">
        <div className="drawer-title">素材库</div>
        <div className="drawer-subtitle">模特、场景、本地视频分区管理。选中一个模特，后续试衣和分镜都会复用它。</div>
      </div>

      <div className="drawer-content media-tab-content">
        <div className="media-tabs">
          <button type="button" className={`media-tab ${section === 'models' ? 'active' : ''}`} onClick={() => setSection('models')}>
            AI 模特 <span>{modelLibrary.length}</span>
          </button>
          <button type="button" className={`media-tab ${section === 'scenes' ? 'active' : ''}`} onClick={() => setSection('scenes')}>
            背景场景 <span>{customScenes.length}</span>
          </button>
          <button type="button" className={`media-tab ${section === 'videos' ? 'active' : ''}`} onClick={() => setSection('videos')}>
            本地视频 <span>{localVideos.length}</span>
          </button>
        </div>

        {section === 'models' && (
          <div className="media-section">
            <div className="media-section-head">
              <div>
                <b>我的 AI 模特</b>
                <span>点击卡片切换当前模特</span>
              </div>
              <div className="media-head-actions">
                <label className="media-action secondary">
                  ↑ 上传
                  <input type="file" accept="image/*" onChange={handleModelUpload} />
                </label>
                <button type="button" className="media-action primary" onClick={() => setIsGenModelModalOpen(true)}>＋ 生成模特</button>
              </div>
            </div>

            <div className="media-grid">
              {modelLibrary.map(model => {
                const active = swapModelUrl === model.src;
                return (
                  <div
                    key={model.id}
                    className={`media-card model-card ${active ? 'active' : ''}`}
                    onClick={() => applyModelFromLibrary(model.src, model.name)}
                    title="点击将此模特设为 AI 生成参考"
                  >
                    <div className="media-card-media">
                      <img src={model.src} alt={model.name} />
                      {active && <span className="media-selected-badge">当前使用</span>}
                      <div className="media-card-actions">
                        <button
                          type="button"
                          title="预览"
                          onClick={event => {
                            event.stopPropagation();
                            setPreviewModel({ id: model.id, src: model.src, name: model.name });
                            setEditingModelNameValue(model.name);
                            setIsEditingModelName(false);
                          }}
                        >👁</button>
                        <button
                          type="button"
                          title="删除"
                          onClick={event => {
                            event.stopPropagation();
                            deleteModel(model);
                          }}
                        >×</button>
                      </div>
                    </div>
                    <div className="media-card-body">
                      <b title={model.name}>{formatFileName(model.name)}</b>
                      <small>{model.date || '最近添加'}</small>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="media-add-card" onClick={() => setIsGenModelModalOpen(true)}>
                <span>＋</span>
                <b>添加模特</b>
                <small>上传一张正面照，或用 AI 生成</small>
              </button>
            </div>
          </div>
        )}

        {section === 'scenes' && (
          <div className="media-section">
            <div className="media-section-head">
              <div>
                <b>背景场景</b>
                <span>用于锁定分镜环境</span>
              </div>
              <div className="media-head-actions">
                <label className="media-action secondary">
                  ↑ 上传
                  <input type="file" accept="image/*" onChange={handleSceneUpload} />
                </label>
                <button type="button" className="media-action primary" onClick={() => setShowAiSceneModal(true)}>＋ 生成场景</button>
              </div>
            </div>

            <div className="media-grid">
              {customScenes.map(scene => {
                const active = modelScene === scene.id;
                return (
                  <div
                    key={scene.id}
                    className={`media-card scene-card ${active ? 'active' : ''}`}
                    onClick={() => applySceneBackground(scene.name, scene.src)}
                    title="点击将此场景设为 AI 生成参考"
                  >
                    <div className="media-card-media" style={{ backgroundImage: `url(${scene.src})` }}>
                      {active && <span className="media-selected-badge">当前使用</span>}
                      <div className="media-card-actions">
                        <button
                          type="button"
                          title="预览"
                          onClick={event => {
                            event.stopPropagation();
                            setPreviewScene({ id: scene.id, src: scene.src, name: scene.name });
                            setEditingSceneNameValue(scene.name);
                            setIsEditingSceneName(false);
                          }}
                        >👁</button>
                        <button
                          type="button"
                          title="删除"
                          onClick={event => {
                            event.stopPropagation();
                            deleteCustomScene(scene.id, event);
                          }}
                        >×</button>
                      </div>
                    </div>
                    <div className="media-card-body">
                      <b title={scene.name}>{formatFileName(scene.name)}</b>
                      <small>自定义场景</small>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="media-add-card" onClick={() => setShowAiSceneModal(true)}>
                <span>＋</span>
                <b>添加场景</b>
                <small>上传背景图，或用 AI 生成</small>
              </button>
            </div>
          </div>
        )}

        {section === 'videos' && (
          <div className="media-section">
            <div className="media-section-head">
              <div>
                <b>本地视频</b>
                <span>导入后可直接加入时间轴</span>
              </div>
              {isTauri && (
                <div className="media-head-actions">
                  <button type="button" className="media-action primary" onClick={handleImportLocalVideo}>＋ 导入视频</button>
                </div>
              )}
            </div>

            {!isTauri ? (
              <div className="media-empty">
                <b>桌面端可用</b>
                <span>本地视频导入仅支持桌面客户端，浏览器内请使用「AI 模特」或「背景场景」。</span>
              </div>
            ) : (
              <div className="media-grid">
                {localVideos.map(video => (
                  <div
                    key={video.id}
                    className="media-card video-card"
                    onClick={() => addLocalVideoLayer(video)}
                    title="点击将此本地视频作为图层加入时间轴"
                  >
                    <div className="media-card-media">
                      <video src={video.src} muted preload="metadata" />
                      <span className="media-video-play">▶</span>
                      <div className="media-card-actions">
                        <button
                          type="button"
                          title="从库中移除"
                          onClick={event => {
                            event.stopPropagation();
                            handleDeleteLocalVideo(event, video.id);
                          }}
                        >×</button>
                      </div>
                    </div>
                    <div className="media-card-body">
                      <b title={video.name}>{formatFileName(video.name)}</b>
                      <small>{video.duration ? `${video.duration.toFixed(1)}s` : '本地视频'}</small>
                    </div>
                  </div>
                ))}
                <button type="button" className="media-add-card" onClick={handleImportLocalVideo}>
                  <span>＋</span>
                  <b>导入视频</b>
                  <small>支持本地 MP4，加入时间轴</small>
                </button>
              </div>
            )}
          </div>
        )}

        <p className="media-footnote">ℹ️ 本批素材仅在当前账号可见，删除素材不会影响已经放入时间轴的文件。</p>
      </div>
    </>
  );
};
