import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AudioAsset, LocalVideoAsset, ModelAsset, SceneAsset } from '../types/assets';
import { localDB } from '../utils/db';
import { uploadFileToOSS } from '../utils/ossClient';
import { supabase } from '../utils/supabaseClient';

function dataUrlToBlob(dataUrl: string): Blob {
  const [metadata, encoded = ''] = dataUrl.split(';base64,');
  const contentType = metadata.split(':')[1] || 'application/octet-stream';
  const raw = window.atob(encoded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return new Blob([bytes], { type: contentType });
}

async function uploadImageSource(sourceUrl: string, filenamePrefix: string): Promise<string> {
  const shouldUpload = sourceUrl.startsWith('data:') || sourceUrl.startsWith('blob:') || sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://');
  if (!shouldUpload) return sourceUrl;

  try {
    const blob = sourceUrl.startsWith('data:')
      ? dataUrlToBlob(sourceUrl)
      : await fetch(sourceUrl).then(response => response.blob());
    const file = new File([blob], `${filenamePrefix}_${Date.now()}.png`, { type: blob.type || 'image/png' });
    return await uploadFileToOSS(file);
  } catch (error) {
    console.warn(`Failed to upload ${filenamePrefix} to OSS, using source URL:`, error);
    return sourceUrl;
  }
}

function createLocalAssetId(prefix: string): string {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  return `${prefix}_${suffix}`;
}

interface AssetLibraryActionsOptions {
  setModelLibrary: Dispatch<SetStateAction<ModelAsset[]>>;
  setCustomScenes: Dispatch<SetStateAction<SceneAsset[]>>;
  setBgmLibrary: Dispatch<SetStateAction<AudioAsset[]>>;
  setLocalVideos: Dispatch<SetStateAction<LocalVideoAsset[]>>;
}

export function useAssetLibraryActions({
  setModelLibrary,
  setCustomScenes,
  setBgmLibrary,
  setLocalVideos
}: AssetLibraryActionsOptions) {
  const saveModelLibrarySafely = useCallback((updated: ModelAsset[]) => {
    void localDB.set('ai_model_library', updated).catch(error => {
      console.error('Failed to save model library to IndexedDB:', error);
    });
    return updated;
  }, []);

  const saveCustomScenesSafely = useCallback((updated: SceneAsset[]) => {
    void localDB.set('ai_custom_scenes', updated).catch(error => {
      console.error('Failed to save custom scenes to IndexedDB:', error);
    });
    return updated;
  }, []);

  const saveBgmLibrarySafely = useCallback((updated: AudioAsset[]) => {
    void localDB.set('ai_bgm_library', updated).catch(error => {
      console.error('Failed to save bgm library to IndexedDB:', error);
    });
    return updated;
  }, []);

  const addModelToLibrary = useCallback(async (name: string, srcUrl: string): Promise<ModelAsset | null> => {
    try {
      const finalUrl = await uploadImageSource(srcUrl, 'ai_model');
      const { data: userSession } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('model_assets').insert([{
        name,
        src: finalUrl,
        user_id: userSession?.session?.user?.id || null
      }]).select();
      if (error) throw error;

      const inserted = data?.[0];
      if (!inserted) return null;
      const localItem: ModelAsset = {
        id: inserted.id,
        src: inserted.src,
        date: new Date(inserted.created_at).toLocaleDateString(),
        name: inserted.name
      };
      setModelLibrary(previous => saveModelLibrarySafely([localItem, ...previous]));
      return localItem;
    } catch (error) {
      console.error('Failed to add model to library:', error);
      return null;
    }
  }, [saveModelLibrarySafely, setModelLibrary]);

  const addSceneToLibrary = useCallback(async (name: string, srcUrl: string): Promise<SceneAsset | null> => {
    try {
      const finalUrl = await uploadImageSource(srcUrl, 'custom_scene');
      const { data: userSession } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('model_assets').insert([{
        name: `[BG] ${name}`,
        src: finalUrl,
        user_id: userSession?.session?.user?.id || null
      }]).select();
      if (error) throw error;

      const inserted = data?.[0];
      return inserted ? {
        id: inserted.id,
        name: inserted.name.replace(/^\[BG\]\s*/, ''),
        src: inserted.src
      } : null;
    } catch (error) {
      console.error('Failed to add scene to library:', error);
      return null;
    }
  }, []);

  const deleteScene = useCallback(async (scene: SceneAsset) => {
    try {
      const storedIds: unknown = await localDB.get('deleted_scene_ids');
      const deletedIds = Array.isArray(storedIds)
        ? storedIds.filter((value): value is string => typeof value === 'string')
        : [];
      if (!deletedIds.includes(scene.id)) deletedIds.push(scene.id);
      if (scene.src && !deletedIds.includes(scene.src)) deletedIds.push(scene.src);
      await localDB.set('deleted_scene_ids', deletedIds);
      const { error } = await supabase.from('model_assets').delete().eq('id', scene.id);
      if (error) throw error;
    } catch (error) {
      console.warn('Failed to delete scene from Supabase:', error);
    }
    setCustomScenes(previous => saveCustomScenesSafely(previous.filter(item => item.id !== scene.id)));
  }, [saveCustomScenesSafely, setCustomScenes]);

  const renameScene = useCallback(async (id: string, name: string) => {
    try {
      const { error } = await supabase.from('model_assets').update({ name: `[BG] ${name}` }).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Failed to update scene name in Supabase:', error);
    }
    setCustomScenes(previous => saveCustomScenesSafely(
      previous.map(scene => scene.id === id ? { ...scene, name } : scene)
    ));
  }, [saveCustomScenesSafely, setCustomScenes]);

  const renameModel = useCallback(async (id: string, name: string): Promise<boolean> => {
    let cloudUpdated = true;
    try {
      const { error } = await supabase.from('model_assets').update({ name }).eq('id', id);
      if (error) throw error;
    } catch (error) {
      cloudUpdated = false;
      console.error('Failed to rename model in Supabase:', error);
    }
    setModelLibrary(previous => saveModelLibrarySafely(
      previous.map(model => model.id === id ? { ...model, name } : model)
    ));
    return cloudUpdated;
  }, [saveModelLibrarySafely, setModelLibrary]);

  const deleteBgm = useCallback(async (id: string): Promise<boolean> => {
    let cloudDeleted = true;
    try {
      const { error } = await supabase.from('audio_assets').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      cloudDeleted = false;
      console.error('BGM delete failed:', error);
    }
    setBgmLibrary(previous => saveBgmLibrarySafely(previous.filter(audio => audio.id !== id)));
    return cloudDeleted;
  }, [saveBgmLibrarySafely, setBgmLibrary]);

  const deleteLocalVideo = useCallback(async (id: string) => {
    await localDB.deleteLocalVideo(id);
    setLocalVideos(previous => previous.filter(video => video.id !== id));
  }, [setLocalVideos]);

  const importLocalAudio = useCallback(async (): Promise<number> => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    const selected = await open({
      multiple: true,
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] }]
    });
    if (!selected) return 0;

    const paths = Array.isArray(selected) ? selected : [selected];
    const audioAssets: AudioAsset[] = paths.map(path => {
      const filename = path.split(/[/\\]/).pop() || '本地音频';
      return {
        id: createLocalAssetId('local_bgm'),
        name: filename.replace(/\.[^/.]+$/, ''),
        src: convertFileSrc(path),
        desc: `本地音频 • ${path}`
      };
    });

    if (audioAssets.length > 0) {
      setBgmLibrary(previous => saveBgmLibrarySafely([...previous, ...audioAssets]));
    }
    return audioAssets.length;
  }, [saveBgmLibrarySafely, setBgmLibrary]);

  const importLocalVideos = useCallback(async (): Promise<number> => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    const selected = await open({
      multiple: true,
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] }]
    });
    if (!selected) return 0;

    const paths = Array.isArray(selected) ? selected : [selected];
    const videos: LocalVideoAsset[] = paths.map(path => {
      const filename = path.split(/[/\\]/).pop() || '本地视频';
      return {
        id: createLocalAssetId('local_video'),
        name: filename.replace(/\.[^/.]+$/, ''),
        src: convertFileSrc(path),
        desc: `本地视频 • ${path}`,
        duration: 0
      };
    });

    await Promise.all(videos.map(video => localDB.saveLocalVideo(video)));
    if (videos.length > 0) setLocalVideos(previous => [...previous, ...videos]);
    return videos.length;
  }, [setLocalVideos]);

  return {
    saveModelLibrarySafely,
    saveCustomScenesSafely,
    saveBgmLibrarySafely,
    addModelToLibrary,
    addSceneToLibrary,
    deleteScene,
    renameScene,
    renameModel,
    deleteBgm,
    deleteLocalVideo,
    importLocalAudio,
    importLocalVideos
  };
}
