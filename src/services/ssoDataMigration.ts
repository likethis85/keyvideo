import type { AIProject } from '../types/aiProject';
import type { AudioAsset, ModelAsset, SceneAsset } from '../types/assets';
import { uploadFileToOSS } from '../utils/ossClient';
import { localDB } from '../utils/db';
import {
  createSsoAsset,
  isSsoCloudSession,
  loadSsoAssets,
  type SsoCloudAsset
} from './keyvideoCloudService';
import { syncProjectToSupabase } from './aiProjectSyncService';

const MIGRATION_KEY = 'keyvideo_sso_data_migration_v1';
const MIGRATION_VERSION = 1;

export interface SsoMigrationReport {
  projects: number;
  models: number;
  scenes: number;
  audio: number;
  skipped: number;
}

interface MigrationMarker {
  version: number;
  completedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname === '::1'
    || hostname === '[::1]';
}

/**
 * Return an address that another browser can use. Local desktop paths and
 * app-internal URLs are deliberately skipped because uploading them would
 * create a cloud row that no other machine could actually open.
 */
async function prepareAssetSource(source: string, prefix: string): Promise<string | null> {
  const value = source.trim();
  if (!value || value.startsWith('file:') || value.startsWith('asset:')) return null;

  if (value.startsWith('data:') || value.startsWith('blob:')) {
    try {
      const response = await fetch(value);
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.size) return null;
      const extension = blob.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin';
      return await uploadFileToOSS(new File([blob], `${prefix}_${Date.now()}.${extension}`, {
        type: blob.type || 'application/octet-stream'
      }));
    } catch (error) {
      console.warn(`Failed to upload local ${prefix} during SSO migration:`, error);
      return null;
    }
  }

  const isExpiringUrl = value.includes('Expires=')
    || value.includes('OSSAccessKeyId=')
    || value.includes('dashscope-result')
    || value.includes('x-oss-expires');
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (isLocalHost(parsed.hostname)) return null;
    if (isExpiringUrl) {
      const response = await fetch(parsed.toString());
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.size) return null;
      const extension = blob.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin';
      return await uploadFileToOSS(new File([blob], `${prefix}_${Date.now()}.${extension}`, {
        type: blob.type || 'application/octet-stream'
      }));
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function sourceKey(source: string): string {
  return source.trim();
}

function cloudSourceSet(rows: SsoCloudAsset[] | null): Set<string> {
  return new Set((rows || []).map(item => sourceKey(item.src)).filter(Boolean));
}

async function migrateAssets(report: SsoMigrationReport): Promise<boolean> {
  let complete = true;
  const [cloudModels, cloudAudio, localModels, localScenes, localAudio] = await Promise.all([
    loadSsoAssets('model'),
    loadSsoAssets('audio'),
    localDB.get<unknown>('ai_model_library'),
    localDB.get<unknown>('ai_custom_scenes'),
    localDB.get<unknown>('ai_bgm_library')
  ]);
  const modelSources = cloudSourceSet(cloudModels);
  const audioSources = cloudSourceSet(cloudAudio);

  const migrateModel = async (item: unknown, isScene: boolean) => {
    if (!isRecord(item)) {
      report.skipped += 1;
      return;
    }
    const name = stringValue(item.name) || (isScene ? '自定义场景' : 'AI 模特');
    const rawSource = stringValue(item.src);
    const source = await prepareAssetSource(rawSource, isScene ? 'custom_scene' : 'ai_model');
    if (!source) {
      report.skipped += 1;
      return;
    }
    const key = sourceKey(source);
    if (modelSources.has(key)) return;
    try {
      const inserted = await createSsoAsset('model', { name, src: source, is_scene: isScene });
      if (!inserted) throw new Error('cloud asset response was empty');
      modelSources.add(key);
      if (isScene) report.scenes += 1;
      else report.models += 1;
    } catch (error) {
      complete = false;
      console.warn(`Failed to migrate ${isScene ? 'scene' : 'model'} to SSO cloud:`, error);
    }
  };

  const migrateAudio = async (item: unknown) => {
    if (!isRecord(item)) {
      report.skipped += 1;
      return;
    }
    const name = stringValue(item.name) || '未命名音乐';
    const source = await prepareAssetSource(stringValue(item.src), 'audio');
    if (!source) {
      report.skipped += 1;
      return;
    }
    const key = sourceKey(source);
    if (audioSources.has(key)) return;
    try {
      const inserted = await createSsoAsset('audio', {
        name,
        src: source,
        desc: stringValue(item.desc) || 'SSO 账号素材'
      });
      if (!inserted) throw new Error('cloud asset response was empty');
      audioSources.add(key);
      report.audio += 1;
    } catch (error) {
      complete = false;
      console.warn('Failed to migrate audio to SSO cloud:', error);
    }
  };

  for (const item of Array.isArray(localModels) ? localModels : []) await migrateModel(item as ModelAsset, false);
  for (const item of Array.isArray(localScenes) ? localScenes : []) await migrateModel(item as SceneAsset, true);
  for (const item of Array.isArray(localAudio) ? localAudio : []) await migrateAudio(item as AudioAsset);
  return complete;
}

export async function migrateLocalDataToSsoCloud(): Promise<SsoMigrationReport | null> {
  if (!isSsoCloudSession()) return null;
  const marker = await localDB.get<MigrationMarker>(MIGRATION_KEY);
  if (marker?.version === MIGRATION_VERSION) return null;

  const report: SsoMigrationReport = { projects: 0, models: 0, scenes: 0, audio: 0, skipped: 0 };
  let complete = true;
  try {
    if (!await migrateAssets(report)) complete = false;
    const localProjects = await localDB.get<unknown>('ai_projects');
    if (Array.isArray(localProjects)) {
      for (const project of localProjects) {
        if (!isRecord(project) || !stringValue(project.id)) {
          report.skipped += 1;
          continue;
        }
        try {
          await syncProjectToSupabase(project as unknown as AIProject, { throwOnError: true });
          report.projects += 1;
        } catch (error) {
          complete = false;
          console.warn('Failed to migrate project to SSO cloud:', error);
        }
      }
    }
  } catch (error) {
    complete = false;
    console.warn('SSO local data migration failed:', error);
  }

  if (complete) {
    await localDB.set(MIGRATION_KEY, { version: MIGRATION_VERSION, completedAt: new Date().toISOString() });
  }
  return report;
}

