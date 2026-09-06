import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AudioAsset, ModelAsset, SceneAsset } from '../types/assets';
import { supabase } from '../utils/supabaseClient';
import { uploadAudioToOSS } from '../utils/ossClient';
import { toast } from '../components/toastStore';

type PreviewScene = { id?: string; src: string; name: string } | null;
type PreviewModel = { id?: string; src: string; name: string; storyboardId?: string } | null;
type Confirm = (title: string, message: string, onConfirm: () => void) => void;

interface AssetPanelActionsOptions {
  customScenes: SceneAsset[];
  setCustomScenes: Dispatch<SetStateAction<SceneAsset[]>>;
  setBgmLibrary: Dispatch<SetStateAction<AudioAsset[]>>;
  addModelToLibrary: (name: string, src: string) => Promise<ModelAsset | null>;
  addSceneToLibrary: (name: string, src: string) => Promise<SceneAsset | null>;
  saveCustomScenesSafely: (items: SceneAsset[]) => SceneAsset[];
  saveBgmLibrarySafely: (items: AudioAsset[]) => AudioAsset[];
  deleteScene: (scene: SceneAsset) => Promise<void>;
  deleteBgm: (id: string) => Promise<boolean>;
  renameScene: (id: string, name: string) => Promise<unknown>;
  renameModel: (id: string, name: string) => Promise<unknown>;
  previewScene: PreviewScene;
  setPreviewScene: Dispatch<SetStateAction<PreviewScene>>;
  previewModel: PreviewModel;
  setPreviewModel: Dispatch<SetStateAction<PreviewModel>>;
  editingSceneName: string;
  editingModelName: string;
  setIsEditingSceneName: (editing: boolean) => void;
  setIsEditingModelName: (editing: boolean) => void;
  setModelRefImageUrl: (url: string) => void;
  setOutfitPoseImageUrl: (url: string) => void;
  showConfirm: Confirm;
}

const readDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
  reader.onload = () => resolve(String(reader.result || ''));
  reader.readAsDataURL(file);
});

export function useAssetPanelActions(options: AssetPanelActionsOptions) {
  const uploadModel = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const name = file.name.split('.')[0] || '上传模特';
    const added = await options.addModelToLibrary(name, await readDataUrl(file));
    alert(added ? `模特「${name}」上传并保存至云端模特库成功！` : `模特「${name}」上传失败，请检查网络或服务配置。`);
  }, [options]);

  const loadReference = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = event.target.files?.[0];
    if (file) setter(await readDataUrl(file));
  }, []);

  const uploadScene = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const src = await readDataUrl(file);
    const name = file.name.split('.')[0] || '自定义场景';
    const saved = await options.addSceneToLibrary(name, src) || { id: `custom_scene_${Date.now()}`, name, src };
    options.setCustomScenes(previous => options.saveCustomScenesSafely([saved, ...previous]));
  }, [options]);

  const removeScene = useCallback((id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const scene = options.customScenes.find(item => item.id === id);
    options.showConfirm('删除自定义场景', '确认删除该自定义场景吗？', () => {
      if (scene) void options.deleteScene(scene).then(() => toast.success('已删除自定义场景'));
    });
  }, [options]);

  const saveSceneName = useCallback(async () => {
    if (!options.previewScene?.id) return;
    const name = options.editingSceneName.trim();
    if (!name) return alert('名称不能为空！');
    await options.renameScene(options.previewScene.id, name);
    options.setPreviewScene(previous => previous ? { ...previous, name } : null);
    options.setIsEditingSceneName(false);
  }, [options]);

  const saveModelName = useCallback(async () => {
    if (!options.previewModel?.id) return;
    const name = options.editingModelName.trim();
    if (!name) return alert('名称不能为空！');
    await options.renameModel(options.previewModel.id, name);
    options.setPreviewModel(previous => previous ? { ...previous, name } : null);
    options.setIsEditingModelName(false);
  }, [options]);

  const uploadBgm = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return alert('音频文件过大，为保证流畅度，请上传小于 20MB 的背景音乐！');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const src = await uploadAudioToOSS(file);
      const name = file.name.replace(/\.[^/.]+$/, '');
      const desc = `${(file.size / 1024 / 1024).toFixed(2)}MB • 云端存储`;
      const { data, error } = await supabase.from('audio_assets').insert({ name, src, desc, user_id: session?.user?.id || null }).select();
      if (error) throw error;
      const item = { id: data?.[0]?.id || `custom_bgm_${Date.now()}`, name, src, desc };
      options.setBgmLibrary(previous => options.saveBgmLibrarySafely([...previous, item]));
      alert(`音频「${name}」已成功上传至 OSS 并保存至云数据库！`);
    } catch (error) {
      console.error('BGM upload failed:', error);
      alert(`音频上传失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [options]);

  const removeBgm = useCallback((event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    options.showConfirm('删除背景音乐', '确定要从云端及背景音乐库中删除该音乐吗？', () => {
      void options.deleteBgm(id).then(deleted => alert(deleted ? '该背景音乐已成功从云端删除！' : '云端删除失败，已同步从本地列表移除。'));
    });
  }, [options]);

  return {
    handleModelUpload: uploadModel,
    handleModelRefUpload: (event: React.ChangeEvent<HTMLInputElement>) => void loadReference(event, options.setModelRefImageUrl),
    handlePoseRefUpload: (event: React.ChangeEvent<HTMLInputElement>) => void loadReference(event, options.setOutfitPoseImageUrl),
    handleSceneUpload: uploadScene,
    deleteCustomScene: removeScene,
    handleSaveSceneName: saveSceneName,
    handleSaveModelPreviewName: saveModelName,
    handleBgmUpload: uploadBgm,
    handleBgmDelete: removeBgm
  };
}
