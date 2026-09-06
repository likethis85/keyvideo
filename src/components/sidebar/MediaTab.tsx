import React from 'react';
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
  return (
    <>
      <div className="drawer-header">
        <div className="drawer-title">智能素材与场景库</div>
        <div className="drawer-subtitle">管理您的 AI 模特及自定义场景</div>
      </div>
      <div className="drawer-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 2. AI MODEL LIBRARY SECTION */}
        <div className="media-section-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="property-label" style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>🧍 我的 AI 模特库</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <label className="btn-primary" style={{ padding: '4px 10px', fontSize: '11px', cursor: 'pointer', margin: 0, borderRadius: '6px', height: 'auto', display: 'inline-flex', alignItems: 'center', fontWeight: '600' }}>
                上传模特
                <input type="file" accept="image/*" onChange={handleModelUpload} style={{ display: 'none' }} />
              </label>
              <button
                className="btn-secondary"
                onClick={() => setIsGenModelModalOpen(true)}
                style={{ padding: '4px 10px', fontSize: '11px', margin: 0, borderRadius: '6px', height: 'auto', display: 'inline-flex', alignItems: 'center', fontWeight: '600', background: 'var(--bg-surface-solid)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                生成模特
              </button>
            </div>
          </div>
          {modelLibrary.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-element)', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
              暂无已生成/上传的模特。点击「上传模特」或在「AI工具」中一键定制模特，即可保存至此。
            </div>
          ) : (
            <div className="media-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {modelLibrary.map(model => {
                const isActive = swapModelUrl === model.src;
                return (
                  <div
                    key={model.id}
                    onClick={() => applyModelFromLibrary(model.src, model.name)}
                    title="点击将此模特设为 AI 生成参考"
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      border: isActive ? '2px solid var(--border-accent)' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'var(--bg-surface-solid)',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: isActive ? '0 0 0 1px var(--border-accent)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      height: '62px',
                      width: '100%',
                      position: 'relative',
                      background: 'var(--bg-element)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}>
                      <img
                        src={model.src}
                        alt={model.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          objectPosition: 'top'
                        }}
                      />
                    </div>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      padding: '4px 4px',
                      background: 'var(--bg-surface-solid)',
                      borderTop: '1px solid var(--border-color)'
                    }} title={model.name}>
                      {formatFileName(model.name)}
                    </div>
                    {isActive && (
                      <div style={{ position: 'absolute', top: '4px', left: '4px', background: 'var(--border-accent)', color: '#ffffff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', zIndex: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                        ✓
                      </div>
                    )}
                    {/* Preview Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewModel({ id: model.id, src: model.src, name: model.name });
                        setEditingModelNameValue(model.name);
                        setIsEditingModelName(false);
                      }}
                      style={{ position: 'absolute', top: '4px', right: '22px', background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%', color: '#ffffff', width: '16px', height: '16px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                      title="预览"
                    >
                      👁
                    </button>
                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
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

                          setModelLibrary(prev => {
                            const updated = prev.filter(m => m.id !== model.id && m.src !== model.src);
                            saveModelLibrarySafely(updated);
                            return updated;
                          });
                          toast.success(`已从模特库中永久删除「${model.name}」`);
                        });
                      }}
                      style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%', color: '#ff6b6b', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                      title="删除"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. SCENE LIBRARY SECTION */}
        <div className="media-section-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="property-label" style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>🎨 背景场景库</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <label className="btn-primary" style={{ padding: '4px 10px', fontSize: '11px', cursor: 'pointer', margin: 0, borderRadius: '6px', height: 'auto', display: 'inline-flex', alignItems: 'center', fontWeight: '600' }}>
                上传场景
                <input type="file" accept="image/*" onChange={handleSceneUpload} style={{ display: 'none' }} />
              </label>
              <button
                onClick={() => setShowAiSceneModal(true)}
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '11px', margin: 0, borderRadius: '6px', height: 'auto', display: 'inline-flex', alignItems: 'center', fontWeight: '600', background: 'var(--bg-surface-solid)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                生成场景
              </button>
            </div>
          </div>

          {customScenes.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-element)', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
              暂无自定义背景场景。点击上方「上传场景」或「生成场景」添加您专属的商用背景。
            </div>
          ) : (
            <div className="media-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {/* Custom Scenes */}
              {customScenes.map(scene => {
                const isActive = modelScene === scene.id;
                return (
                  <div
                    key={scene.id}
                    onClick={() => applySceneBackground(scene.name, scene.src)}
                    title="点击将此场景设为 AI 生成参考"
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      border: isActive ? '2px solid var(--border-accent)' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'var(--bg-surface-solid)',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: isActive ? '0 0 0 1px var(--border-accent)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ height: '62px', width: '100%', background: `url(${scene.src}) center/cover`, backgroundColor: 'var(--bg-element)' }} />
                    <div style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      padding: '4px 4px',
                      background: 'var(--bg-surface-solid)',
                      borderTop: '1px solid var(--border-color)'
                    }} title={scene.name}>
                      🖼️ {formatFileName(scene.name)}
                    </div>
                    {isActive && (
                      <div style={{ position: 'absolute', top: '4px', left: '4px', background: 'var(--border-accent)', color: '#ffffff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', zIndex: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                        ✓
                      </div>
                    )}
                    {/* Preview Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewScene({ id: scene.id, src: scene.src, name: scene.name });
                        setEditingSceneNameValue(scene.name);
                        setIsEditingSceneName(false);
                      }}
                      style={{ position: 'absolute', top: '4px', right: '22px', background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%', color: '#ffffff', width: '16px', height: '16px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                      title="预览"
                    >
                      👁
                    </button>
                    {/* Delete Button */}
                    <button
                      onClick={(e) => deleteCustomScene(scene.id, e)}
                      style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%', color: '#ff6b6b', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                      title="删除"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. LOCAL VIDEO LIBRARY SECTION (Tauri Only or Fallback) */}
        <div className="media-section-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="property-label" style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>📼 本地视频素材库</span>
            {isTauri && (
              <button
                className="btn-primary"
                onClick={handleImportLocalVideo}
                style={{ padding: '4px 10px', fontSize: '11px', margin: 0, borderRadius: '6px', height: 'auto', display: 'inline-flex', alignItems: 'center', fontWeight: '600' }}
              >
                导入本地视频
              </button>
            )}
          </div>
          
          {!isTauri ? (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-element)', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
              提示：导入本地视频功能仅在桌面客户端中可用。
            </div>
          ) : localVideos.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-element)', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
              暂无导入的本地视频。点击「导入本地视频」直接选择本地 MP4 视频加入时间轴。
            </div>
          ) : (
            <div className="media-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {localVideos.map(video => (
                <div
                  key={video.id}
                  onClick={() => addLocalVideoLayer(video)}
                  title="双击或点击将此本地视频作为图层加入时间轴"
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: 'var(--bg-surface-solid)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{
                    height: '62px',
                    width: '100%',
                    position: 'relative',
                    background: 'var(--bg-element)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    <video
                      src={video.src}
                      muted
                      preload="metadata"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                      <span style={{ fontSize: '18px' }}>▶️</span>
                    </div>
                  </div>
                  <div style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    padding: '4px 4px',
                    background: 'var(--bg-surface-solid)',
                    borderTop: '1px solid var(--border-color)'
                  }} title={video.name}>
                    {formatFileName(video.name)}
                  </div>
                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteLocalVideo(e, video.id)}
                    style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', color: '#ff5252', width: '15px', height: '15px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                    title="从库中移除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
};
