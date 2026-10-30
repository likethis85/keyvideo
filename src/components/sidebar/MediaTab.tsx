import React, { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toast } from '../toastStore';
import { localDB } from '../../utils/db';
import { formatFileName } from '../../utils/formatUtils';
import { SCENE_BACKGROUNDS } from '../../config/sceneBackgrounds';
import { deleteSsoAsset, isSsoCloudSession } from '../../services/keyvideoCloudService';

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

function MediaSectionIcon({ type }: { type: MediaSection }) {
  if (type === 'models') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c.6-3.6 2.8-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="m18.2 4.2.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3Z" /></svg>;
  if (type === 'scenes') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m4 17 5-5 3.5 3 2.5-2.5L20 17" /><path d="M16 7h3" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16M16 4v16M3 9h5M16 9h5M3 15h5M16 15h5" /><path d="m10 10 5 2-5 2v-4Z" /></svg>;
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
  const [section, setSection] = useState<MediaSection>('models');

  const deleteModel = (model: { id: string; src: string; name: string }) => {
    showConfirm('删除模特', `确认从模特库中删除模特「${model.name}」吗？`, async () => {
      try {
        const deletedIds: string[] = (await localDB.get('deleted_model_ids')) || [];
        if (model.id && !deletedIds.includes(model.id)) deletedIds.push(model.id);
        if (model.src && !deletedIds.includes(model.src)) deletedIds.push(model.src);
        await localDB.set('deleted_model_ids', deletedIds);

        if (isSsoCloudSession()) {
          await deleteSsoAsset('model', model.id);
        } else {
          const { error: deleteError } = await supabase
            .from('model_assets')
            .delete()
            .eq('id', model.id);
          if (deleteError) {
            console.warn('Supabase delete error (handled via local tombstone):', deleteError);
          }
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

  const modelInputRef = React.useRef<HTMLInputElement>(null);
  const sceneInputRef = React.useRef<HTMLInputElement>(null);
  const builtInScenes: CustomSceneItem[] = [
    { id: 'street', name: '摩登街头', src: `${import.meta.env.BASE_URL}scenes/luxury_street_pure.png` },
    { id: 'studio', name: '专业影棚', src: `${import.meta.env.BASE_URL}scenes/studio_backdrop_pure.png` },
    { id: 'beach', name: '阳光海滩', src: `${import.meta.env.BASE_URL}scenes/luxury_beach_pure.png` },
    { id: 'home', name: '奢华客厅', src: `${import.meta.env.BASE_URL}scenes/luxury_home_pure.png` },
    { id: 'runway', name: '时装秀场', src: `${import.meta.env.BASE_URL}scenes/fashion_runway_pure.png` },
    { id: 'wabi-sabi', name: '侘寂暖居', src: `${import.meta.env.BASE_URL}scenes/wabi_sabi_pure.png` },
    { id: 'office', name: '城市办公室', src: SCENE_BACKGROUNDS.office },
    { id: 'minimalist', name: '极简白空间', src: SCENE_BACKGROUNDS.minimalist },
    { id: 'garden', name: '绿植庭院', src: SCENE_BACKGROUNDS.home },
    { id: 'coastline', name: '海岸远景', src: SCENE_BACKGROUNDS.beach },
    { id: 'night-street', name: '霓虹夜街', src: SCENE_BACKGROUNDS.street },
    { id: 'fashion-crowd', name: '秀场后台', src: SCENE_BACKGROUNDS.runway }
  ];
  const scenes = [...customScenes, ...builtInScenes];
  const currentModel = modelLibrary.find(model => model.src === swapModelUrl);
  const currentScene = scenes.find(scene => scene.id === modelScene);
  const sceneLabel = (scene: CustomSceneItem) => ({
    street: '都市街景 · 傍晚',
    studio: '专业影棚 · 暖光',
    beach: '海边度假 · 清晨',
    home: '奢华客厅 · 日光',
    runway: '时装秀场 · 聚光',
    'wabi-sabi': '侘寂暖居 · 柔光',
    office: '城市办公 · 自然光',
    minimalist: '极简空间 · 干净背景',
    garden: '绿植庭院 · 清新氛围',
    coastline: '海岸远景 · 通透日光',
    'night-street': '霓虹夜街 · 城市氛围',
    'fashion-crowd': '秀场后台 · 人群氛围'
  }[scene.id] || scene.name);

  return <div className="library-page asset-page">
    <input hidden ref={modelInputRef} type="file" accept="image/*" onChange={event => { handleModelUpload(event); event.target.value = ''; }} />
    <input hidden ref={sceneInputRef} type="file" accept="image/*" onChange={event => { handleSceneUpload(event); event.target.value = ''; }} />
    <header className="library-page-heading">
      <div><div className="library-eyebrow">REUSABLE ASSETS</div><h1>素材库</h1><p>模特、场景、本地视频分区管理。选中一个模特，后续试衣和分镜都会复用它。</p></div>
      <div className="library-heading-actions media-heading-actions">{section === 'videos' && <button className="studio-button media-import-button" onClick={handleImportLocalVideo} disabled={!isTauri} title={isTauri ? '从电脑选择本地视频' : '桌面端可导入本地视频'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 20h16" /></svg><span>{isTauri ? '导入本地视频' : '桌面端导入视频'}</span></button>}{section === 'models' && <button className="studio-button primary" onClick={() => setIsGenModelModalOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 10.7-10.7" /><path d="m13.2 6.8 4 4" /><path d="m14.8 5.2 1.4-1.4a2 2 0 0 1 2.8 2.8l-1.4 1.4" /><path d="m19 13 .65 1.85L21.5 15.5l-1.85.65L19 18l-.65-1.85-1.85-.65 1.85-.65L19 13Z" /></svg><span>AI 生成模特</span></button>}{section === 'scenes' && <button className="studio-button primary" onClick={() => setShowAiSceneModal(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m4 17 5-5 3.5 3 2.5-2.5L20 17" /><path d="M17 7v4m-2-2h4" /></svg><span>AI 生成场景</span></button>}</div>
    </header>
    <div className="asset-tabs" role="tablist" aria-label="素材分类">{([{ id: 'models', label: 'AI 模特', count: modelLibrary.length }, { id: 'scenes', label: '背景场景', count: scenes.length }, { id: 'videos', label: '本地视频', count: localVideos.length }] as const).map(item => <button key={item.id} role="tab" aria-selected={section === item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}><MediaSectionIcon type={item.id} /><span>{item.label}</span><em>{item.count}</em></button>)}</div>
    {section === 'models' && <section className="asset-section">
      <div className="asset-section-heading"><div><span className="asset-section-icon"><MediaSectionIcon type="models" /></span><div><h2>我的 AI 模特</h2><span>点击卡片切换当前模特</span></div></div>{currentModel && <span className="asset-current">当前：{currentModel.name}</span>}</div>
      <div className={`asset-model-grid ${modelLibrary.length === 0 ? 'is-empty' : ''}`}>
        {modelLibrary.map(model => <article key={model.id} className={`asset-model-card ${model.src === swapModelUrl ? 'active' : ''}`} role="button" tabIndex={0} aria-label={`选用模特 ${model.name}`} aria-pressed={model.src === swapModelUrl} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); applyModelFromLibrary(model.src, model.name); } }} onClick={() => applyModelFromLibrary(model.src, model.name)}>
          <div className="asset-model-photo"><img src={model.src} alt={model.name} loading="lazy" /><span className="asset-photo-badge">{model.src === swapModelUrl ? '当前使用' : 'AI 模特'}</span>{model.src === swapModelUrl && <span className="asset-selected-check">✓</span>}<div className="asset-card-tools"><button aria-label={`预览模特 ${model.name}`} onClick={event => { event.stopPropagation(); setPreviewModel(model); setEditingModelNameValue(model.name); setIsEditingModelName(false); }}>⤢</button><button aria-label={`删除模特 ${model.name}`} onClick={event => { event.stopPropagation(); deleteModel(model); }}>×</button></div></div>
          <div className="asset-model-meta"><b title={model.name}>{formatFileName(model.name)}</b><small>AI 模特 · {model.date || '最近添加'}</small></div>
        </article>)}
        <div className="asset-add-model"><b>添加 AI 模特</b><small>上传正面照片，或使用右上角 AI 生成创建模特</small><div><button onClick={() => modelInputRef.current?.click()}>上传照片</button></div></div>
      </div>
    </section>}
    {section === 'scenes' && <section className="asset-section scene-section">
      <div className="asset-section-heading"><div><span className="asset-section-icon cyan"><MediaSectionIcon type="scenes" /></span><div><h2>背景场景</h2><span>内置场景可直接使用，也可以上传或 AI 生成</span></div></div>{currentScene && <span className="asset-current purple">当前：{currentScene.name}</span>}</div>
      <div className="asset-scene-grid">
        {scenes.map(scene => <article key={scene.id} role="button" tabIndex={0} aria-label={`选用场景 ${scene.name}`} aria-pressed={modelScene === scene.id} className={`asset-scene-card ${modelScene === scene.id ? 'active' : ''}`} style={{ backgroundImage: `linear-gradient(180deg, rgba(9,11,18,.1),rgba(9,11,18,.7)),url(${scene.src})` }} onClick={() => applySceneBackground(scene.name, scene.src)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); applySceneBackground(scene.name, scene.src); } }}>
          <span className="asset-photo-badge">{modelScene === scene.id ? '当前使用' : customScenes.some(item => item.id === scene.id) ? '自定义' : scene.id === 'studio' ? '棚拍' : '自然'}</span><b>{sceneLabel(scene)}</b>
          <div className="asset-card-tools"><button aria-label={`预览场景 ${scene.name}`} onClick={event => { event.stopPropagation(); setPreviewScene(scene); setEditingSceneNameValue(scene.name); setIsEditingSceneName(false); }}>⤢</button>{customScenes.some(item => item.id === scene.id) && <button aria-label={`删除场景 ${scene.name}`} onClick={event => { event.stopPropagation(); deleteCustomScene(scene.id, event); }}>×</button>}</div>
        </article>)}
        <div className="asset-add-scene"><b>添加背景场景</b><small>上传图片，或使用右上角 AI 生成</small><div><button onClick={() => sceneInputRef.current?.click()}>上传场景</button></div></div>
      </div>
    </section>}
    {section === 'videos' && <section className="asset-section">
      <div className="asset-section-heading"><div><span className="asset-section-icon cyan"><MediaSectionIcon type="videos" /></span><div><h2>本地视频</h2><span>导入后点击预览即可加入时间轴</span></div></div></div>
      {!isTauri ? <div className="library-empty"><span>◫</span><h3>在桌面端导入本地视频</h3><p>打开 KeyVideo 桌面客户端，即可将电脑中的视频添加到素材库。</p></div> : <div className="asset-video-grid">{localVideos.map(video => <article className="asset-video-card" key={video.id}><button className="asset-video-preview" onClick={() => addLocalVideoLayer(video)} title="加入时间轴"><video src={video.src} muted preload="metadata" /><span>▶</span></button><b>{formatFileName(video.name)}</b><small>{video.duration ? `${video.duration.toFixed(1)}s` : '本地视频'}</small><button className="asset-video-remove" aria-label={`移除视频 ${video.name}`} onClick={event => handleDeleteLocalVideo(event, video.id)}>×</button></article>)}<button className="asset-add-model" onClick={handleImportLocalVideo}><span className="asset-add-icon">＋</span><b>导入视频</b><small>从电脑中选择视频素材</small></button></div>}
    </section>}
    <p className="asset-footnote">ⓘ <span>个人素材按当前账号保存，内置场景可直接复用。删除素材库条目不会移除时间轴上的片段。</span></p>
  </div>;
};
