import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Layer } from '../components/VideoCanvas';
import type { AudioAsset, LocalVideoAsset, ModelAsset, SceneAsset } from '../types/assets';
import { localDB } from '../utils/db';
import { supabase } from '../utils/supabaseClient';

const bundledAudioSources = new Set(['fashion_beat.mp3', 'jazz.mp3', 'tech_ambient.mp3']);

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isAssetRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function mapModels(rows: unknown[], deletedIds: string[]): ModelAsset[] {
  return rows.filter(isAssetRecord).filter(row => {
    const id = String(row.id || '');
    const src = String(row.src || '');
    const name = String(row.name || '');
    return !name.startsWith('[BG]') && !deletedIds.includes(id) && !deletedIds.includes(src);
  }).map(row => ({
    id: String(row.id || ''),
    src: String(row.src || ''),
    date: row.created_at ? new Date(String(row.created_at)).toLocaleDateString() : String(row.date || ''),
    name: String(row.name || '未命名模特')
  }));
}

function mapScenes(rows: unknown[], deletedIds: string[], fromCloud = false): SceneAsset[] {
  return rows.filter(isAssetRecord).filter(row => {
    const id = String(row.id || '');
    const src = String(row.src || '');
    const name = String(row.name || '');
    return (!fromCloud || name.startsWith('[BG]')) && !deletedIds.includes(id) && !deletedIds.includes(src);
  }).map(row => ({
    id: String(row.id || ''),
    name: String(row.name || '未命名场景').replace(/^\[BG\]\s*/, ''),
    src: String(row.src || '')
  }));
}

function mapAudio(rows: unknown[]): AudioAsset[] {
  return rows.filter(isAssetRecord).map(row => ({
    id: String(row.id || ''),
    name: String(row.name || '未命名音乐'),
    src: String(row.src || ''),
    desc: typeof row.desc === 'string' ? row.desc : undefined
  }));
}

async function loadLocalModelAssets(): Promise<unknown[]> {
  let models: unknown = await localDB.get('ai_model_library');
  if (!models) {
    try {
      const legacy = localStorage.getItem('ai_model_library');
      if (legacy) {
        models = JSON.parse(legacy) as unknown;
        await localDB.set('ai_model_library', models);
      }
    } catch (error) {
      console.error('Failed to migrate legacy model library:', error);
    }
  }
  return Array.isArray(models) ? models : [];
}

export function useAssetLibrary(setLayers: Dispatch<SetStateAction<Layer[]>>) {
  const [modelLibrary, setModelLibrary] = useState<ModelAsset[]>([]);
  const [customScenes, setCustomScenes] = useState<SceneAsset[]>([]);
  const [bgmLibrary, setBgmLibrary] = useState<AudioAsset[]>([]);
  const [localVideos, setLocalVideos] = useState<LocalVideoAsset[]>([]);

  useEffect(() => {
    let cancelled = false;

    const applyDefaultAudio = (audio: AudioAsset[]) => {
      if (audio.length === 0 || cancelled) return;
      setLayers(previous => previous.map(layer => {
        const source = layer.properties.src;
        if (layer.type !== 'audio' || typeof source !== 'string' || !bundledAudioSources.has(source)) return layer;
        return { ...layer, name: audio[0].name, properties: { ...layer.properties, src: audio[0].src } };
      }));
    };

    const load = async () => {
      const deletedModelIds = asStringArray(await localDB.get('deleted_model_ids'));
      const deletedSceneIds = asStringArray(await localDB.get('deleted_scene_ids'));

      try {
        const { data, error } = await supabase.from('model_assets').select('*').order('created_at', { ascending: false });
        if (error || !data) throw error || new Error('Model assets unavailable');
        const models = mapModels(data, deletedModelIds);
        const scenes = mapScenes(data, deletedSceneIds, true);
        if (!cancelled) {
          setModelLibrary(models);
          setCustomScenes(scenes);
        }
        await Promise.all([
          localDB.set('ai_model_library', models),
          localDB.set('ai_custom_scenes', scenes)
        ]);
      } catch (error) {
        console.error('Failed to load models from Supabase:', error);
        const [modelRows, sceneRows] = await Promise.all([
          loadLocalModelAssets(),
          localDB.get('ai_custom_scenes')
        ]);
        if (!cancelled) {
          setModelLibrary(mapModels(modelRows, deletedModelIds));
          setCustomScenes(mapScenes(Array.isArray(sceneRows) ? sceneRows : [], deletedSceneIds));
        }
      }

      try {
        const { data, error } = await supabase.from('audio_assets').select('*').order('created_at', { ascending: false });
        if (error || !data) throw error || new Error('Audio assets unavailable');
        const audio = mapAudio(data);
        if (!cancelled) setBgmLibrary(audio);
        applyDefaultAudio(audio);
      } catch (error) {
        console.error('Failed to load bgms from Supabase:', error);
        const rows: unknown = await localDB.get('ai_bgm_library');
        const audio = mapAudio(Array.isArray(rows) ? rows : []);
        if (!cancelled) setBgmLibrary(audio);
        applyDefaultAudio(audio);
      }

      const videos = await localDB.getLocalVideos();
      if (!cancelled && Array.isArray(videos)) setLocalVideos(videos as LocalVideoAsset[]);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [setLayers]);

  return {
    modelLibrary,
    setModelLibrary,
    customScenes,
    setCustomScenes,
    bgmLibrary,
    setBgmLibrary,
    localVideos,
    setLocalVideos
  };
}
