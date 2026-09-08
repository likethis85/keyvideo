import { useCallback, useState } from 'react';
import type { AIProject, StoryboardItem } from '../types/aiProject';
import type { SceneAsset } from '../types/assets';
import { generatePromptsFromSkill, polishSingleShotPrompt } from '../utils/aiGateway';
import { parseThreeShotPrompt, parseFiveShotPrompt, replaceSingleShotInMasterPrompt } from '../services/storyboardPromptParser';
import { toast } from '../components/toastStore';

type PromptRequest = Parameters<typeof generatePromptsFromSkill>[0];

interface StoryboardPromptGenerationOptions {
  activeProjectId: string;
  modelOutfitImgUrl: string | null;
  modelOutfitImgUrls: string[];
  storyboards: StoryboardItem[];
  swapModelUrl: string;
  videoDuration: '3s' | '15s';
  gatewayUrl: string;
  gatewayToken: string;
  matchingItemDesc: PromptRequest['matchingItemDesc'];
  shoesDesc: PromptRequest['shoesDesc'];
  accessoriesDesc: PromptRequest['accessoriesDesc'];
  modelScene: string;
  customScenes: SceneAsset[];
  activeBackgroundUrl: string | null;
  videoModel: string;
  storyboardMode: string;
  useSlowMotion: boolean;
  clothingFocus: PromptRequest['focus'];
  apparelStyle?: string;
  cameraStyle?: string;
  lightingMood?: string;
  i2vMasterPrompt15s?: string;
  setProjectI2vMasterPrompt15s: (projectId: string, prompt: string) => void;
  setProjectI2vPrompts: (projectId: string, prompts: AIProject['i2vPrompts']) => void;
}

export function useStoryboardPromptGeneration(options: StoryboardPromptGenerationOptions) {
  const [isGeneratingPromptsFromSkill, setIsGeneratingPromptsFromSkill] = useState(false);
  const [polishingShotIndex, setPolishingShotIndex] = useState<number | null>(null);

  const generateStoryboardPrompts = useCallback(async () => {
    const baseOutfitImg = options.modelOutfitImgUrls[0] || options.modelOutfitImgUrl;
    if (!options.activeProjectId || !baseOutfitImg) {
      if (!baseOutfitImg) toast.warning('请先在一键生成穿搭图生成穿搭参考图，才能基于此参考图进行分析生成分镜提示词！');
      return;
    }

    setIsGeneratingPromptsFromSkill(true);
    try {
      const responsePrompt = await generatePromptsFromSkill({
        modelOutfitImgUrl: baseOutfitImg,
        videoDuration: options.videoDuration,
        gatewayUrl: options.gatewayUrl,
        gatewayToken: options.gatewayToken,
        matchingItemDesc: options.matchingItemDesc,
        shoesDesc: options.shoesDesc,
        accessoriesDesc: options.accessoriesDesc,
        modelScene: options.modelScene,
        customScenes: options.customScenes,
        storyboardImgUrls: options.storyboards.map(item => item.imageSrc).filter(src => src && src !== options.swapModelUrl),
        backgroundImageUrl: options.activeBackgroundUrl || undefined,
        model: options.videoModel,
        storyboardMode: options.storyboardMode,
        useSlowMotion: options.useSlowMotion,
        focus: options.clothingFocus,
        apparelStyle: options.apparelStyle,
        cameraStyle: options.cameraStyle,
        lightingMood: options.lightingMood
      });

      if (options.videoDuration === '15s' || options.videoDuration === '3s') {
        options.setProjectI2vMasterPrompt15s(options.activeProjectId, responsePrompt);
      } else {
        options.setProjectI2vPrompts(options.activeProjectId, parseThreeShotPrompt(responsePrompt));
      }
      toast.success('🎉 5 幕连贯分镜视频提示词智能生成成功！已自动注入分镜脚本中。');
    } catch (error) {
      console.error(error);
      toast.error(`智能生成分镜提示词失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGeneratingPromptsFromSkill(false);
    }
  }, [options]);

  const polishSingleShot = useCallback(async (shotIndex: 1 | 2 | 3 | 4 | 5) => {
    const baseOutfitImg = options.modelOutfitImgUrls[0] || options.modelOutfitImgUrl;
    if (!options.activeProjectId || !baseOutfitImg) {
      toast.warning('请先生成穿搭参考图，再进行单分镜润色！');
      return;
    }

    const currentMaster = options.i2vMasterPrompt15s || '';
    const shotKey = `shot-${shotIndex}` as 'shot-1' | 'shot-2' | 'shot-3' | 'shot-4' | 'shot-5';
    const parsed = parseFiveShotPrompt(currentMaster);
    const currentShotText = parsed[shotKey];

    setPolishingShotIndex(shotIndex);
    try {
      const polishedContent = await polishSingleShotPrompt({
        modelOutfitImgUrl: baseOutfitImg,
        singleShotIndex: shotIndex,
        currentPrompt: currentShotText,
        apparelStyle: options.apparelStyle,
        cameraStyle: options.cameraStyle,
        lightingMood: options.lightingMood,
        modelScene: options.modelScene,
        focus: options.clothingFocus,
        useSlowMotion: options.useSlowMotion
      });

      const newMasterPrompt = replaceSingleShotInMasterPrompt(currentMaster, shotKey, polishedContent);
      options.setProjectI2vMasterPrompt15s(options.activeProjectId, newMasterPrompt);
      toast.success(`✨ 第 ${shotIndex} 幕分镜提示词已成功智能润色！`);
    } catch (error) {
      console.error(error);
      toast.error(`第 ${shotIndex} 幕润色失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPolishingShotIndex(null);
    }
  }, [options]);

  return { isGeneratingPromptsFromSkill, polishingShotIndex, generateStoryboardPrompts, polishSingleShot };
}

