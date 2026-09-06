import type { AIProject } from '../types/aiProject';
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

async function ensurePublicAssetUrl(sourceUrl: string, prefix: string): Promise<string> {
  if (!sourceUrl) return '';
  const isExpiringUrl = sourceUrl.includes('Expires=')
    || sourceUrl.includes('OSSAccessKeyId=')
    || sourceUrl.includes('dashscope-result')
    || sourceUrl.includes('x-oss-expires');
  const requiresUpload = sourceUrl.startsWith('data:')
    || sourceUrl.startsWith('blob:')
    || sourceUrl.startsWith('http://localhost')
    || sourceUrl.startsWith('https://localhost')
    || isExpiringUrl;
  if (!requiresUpload) return sourceUrl;

  try {
    const blob = sourceUrl.startsWith('data:')
      ? dataUrlToBlob(sourceUrl)
      : await fetch(sourceUrl).then(response => response.blob());
    const extension = blob.type.split('/')[1] || 'png';
    const file = new File([blob], `${prefix}_${Date.now()}.${extension}`, {
      type: blob.type || 'image/png'
    });
    return await uploadFileToOSS(file);
  } catch (error) {
    console.warn('Failed to upload project asset to OSS:', error);
    return sourceUrl;
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

export async function syncProjectToSupabase(project: AIProject): Promise<void> {
  try {
    const { data: userSession } = await supabase.auth.getSession();
    const userId = userSession?.session?.user?.id;
    if (!userId) return;

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
    if (error) console.error('Failed to sync project to Supabase:', error);
  } catch (error) {
    console.error('Error during Supabase project sync:', error);
  }
}
