import type { AIProject } from '../types/aiProject';
import { uploadFileToOSS } from '../utils/ossClient';
import { supabase } from '../utils/supabaseClient';
import { isSsoCloudSession, syncProjectToSsoCloud } from './keyvideoCloudService';

function dataUrlToBlob(dataUrl: string): Blob {
  const [metadata, encoded = ''] = dataUrl.split(';base64,');
  const contentType = metadata.split(':')[1] || 'application/octet-stream';
  const raw = window.atob(encoded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return new Blob([bytes], { type: contentType });
}

async function ensurePublicAssetUrl(sourceUrl: string, prefix: string): Promise<string> {
  if (!sourceUrl) return '';
  const trimmedSource = sourceUrl.trim();
  if (!trimmedSource) return '';
  // Relative paths, file:// URLs and app-internal asset:// URLs are only valid
  // on the current machine and must never be persisted as cloud media URLs.
  if (!/^https?:\/\//i.test(trimmedSource) && !trimmedSource.startsWith('data:') && !trimmedSource.startsWith('blob:')) {
    return '';
  }
  try {
    const parsed = new URL(trimmedSource);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(parsed.hostname)) return '';
  } catch {
    return '';
  }
  const isExpiringUrl = trimmedSource.includes('Expires=')
    || trimmedSource.includes('OSSAccessKeyId=')
    || trimmedSource.includes('dashscope-result')
    || trimmedSource.includes('x-oss-expires');
  const requiresUpload = trimmedSource.startsWith('data:')
    || trimmedSource.startsWith('blob:')
    || isExpiringUrl;
  if (!requiresUpload) return trimmedSource;

  try {
    const blob = trimmedSource.startsWith('data:')
      ? dataUrlToBlob(trimmedSource)
      : await fetch(trimmedSource).then(response => response.blob());
    const extension = blob.type.split('/')[1] || 'png';
    const file = new File([blob], `${prefix}_${Date.now()}.${extension}`, {
      type: blob.type || 'image/png'
    });
    return await uploadFileToOSS(file);
  } catch (error) {
    console.warn('Failed to upload project asset to OSS:', error);
    // A data/blob/expiring URL cannot be replayed by another browser after a
    // failed upload, so leave that field empty rather than writing dead data.
    return '';
  }
}

function getProjectStatus(project: AIProject): string {
  if (project.isI2vGenerating) return 'generating_video';
  if (project.isStoryboardGenerating) return 'generating_storyboard';
  if (project.isOutfitImgGenerating) return 'generating_outfit';
  if (project.i2vStep === 'video_generated') return 'video_generated';
  if (project.i2vStep === 'storyboard_generated') return 'storyboard_generated';
  return 'idle';
}

export async function syncProjectToSupabase(
  project: AIProject,
  options: { throwOnError?: boolean } = {}
): Promise<void> {
  try {
    const [topUrl, bottomUrl, referenceUrls, outfitUrls, storyboards] = await Promise.all([
      ensurePublicAssetUrl(project.topClothingUrl, 'top_clothing'),
      ensurePublicAssetUrl(project.bottomClothingUrl, 'bottom_clothing'),
      Promise.all((project.referenceOutfitUrls || (project.referenceOutfitUrl ? [project.referenceOutfitUrl] : []))
        .map((url, index) => ensurePublicAssetUrl(url, `reference_outfit_${index}`))),
      Promise.all((project.modelOutfitImgUrls || (project.modelOutfitImgUrl ? [project.modelOutfitImgUrl] : []))
        .map((url, index) => ensurePublicAssetUrl(url, `model_outfit_${index}`))),
      Promise.all(project.storyboards.map(async storyboard => ({
        id: storyboard.id,
        name: storyboard.name,
        shotType: storyboard.shotType,
        imageSrc: await ensurePublicAssetUrl(storyboard.imageSrc, `storyboard_img_${storyboard.id}`),
        videoSrc: storyboard.videoSrc
          ? await ensurePublicAssetUrl(storyboard.videoSrc, `storyboard_video_${storyboard.id}`)
          : null,
        isGeneratingVideo: storyboard.isGeneratingVideo,
        progress: storyboard.progress,
        videoTaskId: storyboard.videoTaskId || null
      })))
    ]);

    if (isSsoCloudSession()) {
      await syncProjectToSsoCloud(project, { topUrl, bottomUrl, referenceUrls, outfitUrls, storyboards });
      return;
    }

    const { data: userSession } = await supabase.auth.getSession();
    const userId = userSession?.session?.user?.id;
    if (!userId) return;

    const { error } = await supabase.from('ai_video_projects').upsert({
      id: project.id,
      name: project.name,
      user_id: userId,
      top_clothing_url: topUrl || null,
      bottom_clothing_url: bottomUrl || null,
      reference_outfit_url: referenceUrls.length ? JSON.stringify(referenceUrls) : null,
      model_outfit_img_url: outfitUrls.length ? JSON.stringify(outfitUrls) : null,
      model_gender: project.modelGender || 'female',
      model_region: project.modelRegion || 'east-asian',
      model_scene: project.modelScene || 'street',
      i2v_master_prompt_15s: project.i2vMasterPrompt15s || null,
      i2v_prompts: project.i2vPrompts || {},
      storyboards,
      i2v_step: project.i2vStep || 'idle',
      status: getProjectStatus(project),
      video_duration: project.videoDuration || '15s'
    });
    if (error) {
      if (options.throwOnError) throw error;
      console.error('Failed to sync project to Supabase:', error);
      return;
    }
  } catch (error) {
    if (options.throwOnError) throw error;
    console.error('Error during Supabase project sync:', error);
  }
}
