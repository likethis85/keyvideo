import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { AIProject, StoryboardItem } from '../types/aiProject';
import type { SceneAsset } from '../types/assets';
import { AiTaskCancelledError } from '../utils/aiTaskStateMachine';
import { generateVideoTask, getVideoContent, waitForVideoTask } from '../utils/aiGateway';
import { parseFiveShotPrompt } from '../services/storyboardPromptParser';
import { slicePanoramicBackground } from '../services/storyboardImageService';
import { syncProjectToSupabase } from '../services/aiProjectSyncService';
import { SCENE_PROMPT_DESCRIPTIONS } from '../services/storyboardSceneService';

type PreviewVideo = { id: string; src: string; name: string } | null;
type StoryboardUpdater = StoryboardItem[] | ((previous: StoryboardItem[]) => StoryboardItem[]);

interface StoryboardVideoRegenerationOptions {
  activeProjectId: string;
  projects: AIProject[];
  gatewayVideoUrl: string;
  gatewayVideoToken: string;
  setShowConfig: (show: boolean) => void;
  setProjectStoryboards: (projectId: string, updater: StoryboardUpdater) => void;
  videoModel: string;
  customScenes: SceneAsset[];
  modelScene: string;
  i2vMasterPrompt15s: string;
  videoDuration: '3s' | '15s';
  i2vPrompts: AIProject['i2vPrompts'];
  activeBackgroundUrl: string | null;
  ratio: string;
  modelOutfitImgUrl: string | null;
  swapModelUrl: string;
  cancelledProjectsRef: MutableRefObject<Record<string, boolean>>;
  setPreviewVideo: Dispatch<SetStateAction<PreviewVideo>>;
}

export function useStoryboardVideoRegeneration(options: StoryboardVideoRegenerationOptions) {
  const {
    activeProjectId, projects, gatewayVideoUrl, gatewayVideoToken, setShowConfig, setProjectStoryboards,
    videoModel, customScenes, modelScene, i2vMasterPrompt15s, videoDuration, i2vPrompts,
    activeBackgroundUrl, ratio, modelOutfitImgUrl, swapModelUrl, cancelledProjectsRef, setPreviewVideo
  } = options;

  const regenerateStoryboardVideo = async (sbId: string) => {
      const currentProjId = activeProjectId;
      if (!currentProjId) return;
  
      const projectObj = projects.find(p => p.id === currentProjId);
      if (!projectObj) return;
  
      const sb = projectObj.storyboards.find(s => s.id === sbId);
      if (!sb) return;
  
      if (!gatewayVideoUrl.trim() || !gatewayVideoToken.trim()) {
        alert('请先在底部的「AI 网关配置」中输入您的视频网关地址与 Token！');
        setShowConfig(true);
        return;
      }
  
      // Set generating state for this specific storyboard card
      setProjectStoryboards(currentProjId, prev =>
        prev.map(s => s.id === sbId ? { ...s, isGeneratingVideo: true, progress: 5 } : s)
      );
  
      try {
        let sizeStr = '720p';
        if (videoModel.includes('MiniMax')) {
          sizeStr = '768P';
        } else if (videoModel.includes('sora')) {
          sizeStr = '1280x720';
        } else if (videoModel.includes('veo')) {
          sizeStr = '720p';
        }
  
        const customSceneObj = customScenes.find(s => s.id === modelScene);
        const sceneDesc = SCENE_PROMPT_DESCRIPTIONS[modelScene as keyof typeof SCENE_PROMPT_DESCRIPTIONS]
          || (customSceneObj ? `posing in a custom scene: ${customSceneObj.name}` : 'posing in a matching catalog studio setting');
  
        const parsedPrompts = parseFiveShotPrompt(i2vMasterPrompt15s);
        const userPrompt = (videoDuration === '15s' || videoDuration === '3s')
          ? (parsedPrompts[sb.shotType as keyof typeof parsedPrompts] || '')
          : (i2vPrompts[sb.shotType as keyof typeof i2vPrompts] || '');
  
        let rewrittenUserPrompt = userPrompt;
        rewrittenUserPrompt = rewrittenUserPrompt.replace(/图[2-6]/g, '图2').replace(/Image\s*[2-6]/gi, 'Image 2');
        rewrittenUserPrompt = rewrittenUserPrompt.replace(/图7/g, '图3').replace(/Image\s*7/gi, 'Image 3');
  
        let promptText = '';
        if (videoModel.includes('veo')) {
          promptText = `${rewrittenUserPrompt}，背景场景环境为：${sceneDesc}，高端商业时装大片电影质感。采用极其缓慢优雅的推近、拉远或轨道环绕等电影级运镜。模特采取高级微动态（如肩膀微调、眼神微转、深呼吸），动作幅度小而极具张力，展示衣服材质纹理与垂坠感。明暗对比强烈的高级影棚光，画面高清稳定，质感高级。`;
          if (activeBackgroundUrl) {
            promptText += ` 生成的视频背景和环境光影必须与提供的场景参考图完全一致，保持背景静止与稳定。`;
          }
        } else {
          promptText = `Referencing 图1 (outfit model) as the strict character consistency reference, and referencing 图2 (storyboard frame) as the first-frame layout and pose.`;
          if (activeBackgroundUrl) {
            promptText += ` Referencing 图3 (scene template) to lock background scene consistency.`;
          }
          promptText += ` ${rewrittenUserPrompt}。The background scene environment is: ${sceneDesc}. A high-end cinematic fashion commercial blockbuster style. The camera performs slow-motion elegant operations like dolly zoom, slow panning, or orbital rotation. The model performs high-fashion micro-movements with subtle elegant posture adjustments, keeping action amplitude small and natural. Premium Vogue-style chiaroscuro studio lighting, highly detailed skin textures, realistic fabric folds, smooth continuous motion, 8k resolution, cinematic color grading.`;
          
          if (activeBackgroundUrl) {
            promptText += ` The background scene, environment layout, colors, and lighting of the generated video clip must strictly match and remain consistent with the provided scene background reference image (图3). Keep the background stable.`;
          }
        }
  
        // Check if we have sliced background
        let currentBackgroundUrl = activeBackgroundUrl || undefined;
        if (activeBackgroundUrl) {
          try {
            const index = projectObj.storyboards.findIndex(s => s.id === sbId);
            const sliced = await slicePanoramicBackground(activeBackgroundUrl);
            if (sliced && sliced.length === 3 && index !== -1) {
              currentBackgroundUrl = sliced[index % 3];
            }
          } catch (err) {
            console.warn('Failed to slice background during single video regeneration:', err);
          }
        }
  
        const apiAspectRatio = ratio === '9-16' ? '9:16' : ratio === '3-4' ? '3:4' : '1:1';
        const secondsNum = (videoDuration === '15s' || videoDuration === '3s') ? 3 : 4;
  
        console.log(`[Single Video Task Triggered] Shot: ${sb.name}, Duration: ${videoDuration}`);
        console.log(`[Single Video Task Payload]`, {
          model: videoModel,
          prompt: promptText,
          imageSrc: sb.imageSrc,
          modelOutfitImgUrl: modelOutfitImgUrl || swapModelUrl || undefined,
          sceneImgUrl: currentBackgroundUrl,
          seconds: secondsNum,
          size: sizeStr,
          aspectRatio: apiAspectRatio
        });
  
        const taskId = await generateVideoTask({
          model: videoModel,
          prompt: promptText,
          imageSrc: sb.imageSrc,
          modelOutfitImgUrl: modelOutfitImgUrl || swapModelUrl || undefined,
          sceneImgUrl: currentBackgroundUrl,
          seconds: secondsNum,
          size: sizeStr,
          aspectRatio: apiAspectRatio,
          gatewayUrl: gatewayVideoUrl,
          gatewayToken: gatewayVideoToken,
          projectId: currentProjId
        });
  
        // Update state with taskId
        setProjectStoryboards(currentProjId, prev =>
          prev.map(s => s.id === sbId ? { ...s, videoTaskId: taskId } : s)
        );
  
        // Poll task status through the shared state machine.
        const pollIntervalMs = videoModel.includes('veo') ? 4000 : 3000;
        const maxPolls = (videoDuration === '15s' || videoDuration === '3s') ? 300 : (videoModel.includes('veo') ? 150 : 200);
  
        await waitForVideoTask({
          taskId,
          intervalMs: pollIntervalMs,
          maxAttempts: maxPolls,
          estimatedAttempts: 100,
          isCancelled: () => !!cancelledProjectsRef.current[currentProjId],
          onProgress: progress => {
            setProjectStoryboards(currentProjId, prev =>
              prev.map(s => s.id === sbId ? { ...s, progress: Math.min(progress, 95) } : s)
            );
          }
        });
  
        const videoBlob = await getVideoContent(gatewayVideoUrl, gatewayVideoToken, taskId);
        const localVideoUrl = URL.createObjectURL(videoBlob);
        setProjectStoryboards(currentProjId, prev => {
          const next = prev.map(s => s.id === sbId ? { ...s, videoSrc: localVideoUrl, videoBlob, videoTaskId: taskId, isGeneratingVideo: false, progress: 100 } : s);
          const targetProj = projects.find(p => p.id === currentProjId);
          if (targetProj) syncProjectToSupabase({ ...targetProj, storyboards: next });
          return next;
        });
        setPreviewVideo(prev => prev && prev.id === sbId ? { ...prev, src: localVideoUrl } : prev);
  
        alert(`分镜「${sb.name}」视频重新生成成功！`);
      } catch (error) {
        console.error(error);
        setProjectStoryboards(currentProjId, prev =>
          prev.map(s => s.id === sbId ? { ...s, isGeneratingVideo: false, progress: 0 } : s)
        );
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof AiTaskCancelledError || message === 'user_cancelled') {
          alert('视频重新生成已被用户中断。');
        } else {
          alert(`分镜视频重新生成失败: ${message}`);
        }
      }
  };

  return regenerateStoryboardVideo;
}
