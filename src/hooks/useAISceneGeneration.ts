import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SceneAsset } from '../types/assets';
import { generateBackgroundImage } from '../utils/aiGateway';
import { uploadFileToOSS } from '../utils/ossClient';
import { supabase } from '../utils/supabaseClient';

const MULTI_VIEW_PREFIX = `A premium 16:9 architectural storyboard showing 3 different empty views of a luxury space, arranged side-by-side as a single horizontal comic strip with 3 equal panels. The panels are clearly separated by clean thin margins and showcase the empty backgrounds from different angles:`;

function buildScenePrompt(prompt: string, multiView: boolean): string {
  if (!multiView) return prompt.trim();
  const description = prompt.trim();
  return `${MULTI_VIEW_PREFIX}
- Panel 1 (Left): A wide-angle view of the empty space showing ${description} with curved minimalist architecture and soft diffused light.
- Panel 2 (Middle): A medium shot of the same space, showing ${description} with refined material textures under soft side lighting.
- Panel 3 (Right): A close-up or alternative perspective view of the same space, focusing on detailed architectural lines and elegant shadows.
All panels must depict clean, empty spaces with absolutely no people, no models, no mannequins, and no clothing. High-end photography, serene and luxurious editorial aesthetic, warm color palette, ultra-high resolution.
Strict rule: There must be absolutely no text, writing, labels, titles, numbers, panel names, annotations, signatures, watermarks, or captions on any part of the image.`;
}

async function uploadGeneratedScene(sourceUrl: string): Promise<string> {
  try {
    const blob = await fetch(sourceUrl).then(response => response.blob());
    const file = new File([blob], `custom_scene_${Date.now()}.png`, { type: blob.type || 'image/png' });
    return await uploadFileToOSS(file);
  } catch (error) {
    console.warn('Failed to upload regenerated scene to OSS:', error);
    return sourceUrl;
  }
}

interface AISceneGenerationOptions {
  gatewayUrl: string;
  gatewayToken: string;
  setCustomScenes: Dispatch<SetStateAction<SceneAsset[]>>;
  saveCustomScenes: (scenes: SceneAsset[]) => SceneAsset[];
  addScene: (name: string, sourceUrl: string) => Promise<SceneAsset | null>;
}

export function useAISceneGeneration({
  gatewayUrl,
  gatewayToken,
  setCustomScenes,
  saveCustomScenes,
  addScene
}: AISceneGenerationOptions) {
  const [isGeneratingAiScene, setIsGeneratingAiScene] = useState(false);

  const generateScene = useCallback(async ({
    prompt,
    referenceImage,
    multiView
  }: {
    prompt: string;
    referenceImage: string | null;
    multiView: boolean;
  }): Promise<SceneAsset> => {
    setIsGeneratingAiScene(true);
    try {
      const generatedUrl = await generateBackgroundImage({
        prompt: buildScenePrompt(prompt, multiView),
        ratio: '16-9',
        gatewayUrl,
        gatewayToken,
        refImageUrl: referenceImage || undefined
      });
      const name = prompt.trim().substring(0, 10) || 'AI 场景';
      const scene = await addScene(name, generatedUrl) || {
        id: `custom_scene_ai_${Date.now()}`,
        name,
        src: generatedUrl
      };
      setCustomScenes(previous => saveCustomScenes([scene, ...previous]));
      return scene;
    } finally {
      setIsGeneratingAiScene(false);
    }
  }, [addScene, gatewayToken, gatewayUrl, saveCustomScenes, setCustomScenes]);

  const regenerateScene = useCallback(async (scene: SceneAsset, editPrompt: string): Promise<SceneAsset> => {
    setIsGeneratingAiScene(true);
    try {
      const generatedUrl = await generateBackgroundImage({
        prompt: editPrompt.trim() || scene.name,
        ratio: '16-9',
        gatewayUrl,
        gatewayToken,
        refImageUrl: scene.src
      });
      const finalUrl = await uploadGeneratedScene(generatedUrl);
      const name = editPrompt.trim().substring(0, 10) || scene.name;
      const updated = { ...scene, src: finalUrl, name };

      const { error } = await supabase.from('model_assets').update({
        src: finalUrl,
        name: `[BG] ${name}`
      }).eq('id', scene.id);
      if (error) console.warn('Failed to update scene in Supabase:', error);

      setCustomScenes(previous => saveCustomScenes(
        previous.map(item => item.id === scene.id ? updated : item)
      ));
      return updated;
    } finally {
      setIsGeneratingAiScene(false);
    }
  }, [gatewayToken, gatewayUrl, saveCustomScenes, setCustomScenes]);

  return { isGeneratingAiScene, generateScene, regenerateScene };
}
