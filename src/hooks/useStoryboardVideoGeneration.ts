import type { MutableRefObject } from 'react';
import type { AIProject, StoryboardItem } from '../types/aiProject';
import type { SceneAsset } from '../types/assets';
import { AiTaskCancelledError } from '../utils/aiTaskStateMachine';
import { generateVideoTask, getVideoContent, waitForVideoTask } from '../utils/aiGateway';
import { parseFiveShotPrompt } from '../services/storyboardPromptParser';
import { SCENE_PROMPT_DESCRIPTIONS } from '../services/storyboardSceneService';

type StoryboardUpdater = StoryboardItem[] | ((previous: StoryboardItem[]) => StoryboardItem[]);

interface StoryboardVideoGenerationOptions {
  activeProjectId: string;
  projects: AIProject[];
  gatewayVideoUrl: string;
  gatewayVideoToken: string;
  setShowConfig: (show: boolean) => void;
  setProjectStoryboards: (projectId: string, updater: StoryboardUpdater) => void;
  setProjectIsI2vGenerating: (projectId: string, generating: boolean) => void;
  setProjectI2vStep: (projectId: string, step: AIProject['i2vStep']) => void;
  videoModel: string;
  videoDuration: '3s' | '15s';
  storyboardMode: string;
  customScenes: SceneAsset[];
  modelScene: string;
  i2vMasterPrompt15s: string;
  i2vPrompts: AIProject['i2vPrompts'];
  activeBackgroundUrl: string | null;
  ratio: string;
  modelOutfitImgUrl: string | null;
  swapModelUrl: string;
  cancelledProjectsRef: MutableRefObject<Record<string, boolean>>;
}

export function useStoryboardVideoGeneration(options: StoryboardVideoGenerationOptions) {
  const {
    activeProjectId, projects, gatewayVideoUrl, gatewayVideoToken, setShowConfig, setProjectStoryboards,
    setProjectIsI2vGenerating, setProjectI2vStep, videoModel, videoDuration, storyboardMode,
    customScenes, modelScene, i2vMasterPrompt15s, i2vPrompts, activeBackgroundUrl, ratio,
    modelOutfitImgUrl, swapModelUrl, cancelledProjectsRef
  } = options;

  const generateStoryboardVideos = async () => {
      const currentProjId = activeProjectId;
      if (!currentProjId) return;
  
      const projectObj = projects.find(p => p.id === currentProjId);
      if (!projectObj) return;
  
      if (projectObj.isI2vGenerating) {
        cancelledProjectsRef.current[currentProjId] = true;
        setProjectIsI2vGenerating(currentProjId, false);
        return;
      }
  
      const projectStoryboards = projectObj.storyboards;
      if (projectStoryboards.length === 0) {
        alert('请先完成步骤 1，生成分镜故事板！');
        return;
      }
  
      if (!gatewayVideoUrl.trim()) {
        alert('请先在底部的「AI 网关配置」中输入您的 AI 视频生成网关地址！');
        setShowConfig(true);
        return;
      }
      if (!gatewayVideoToken.trim()) {
        alert('请先在底部的「AI 网关配置」中输入您的视频网关 API Token！');
        setShowConfig(true);
        return;
      }
  
      setProjectIsI2vGenerating(currentProjId, true);
      cancelledProjectsRef.current[currentProjId] = false;
      try {
        const activeStoryboards = projectStoryboards;
  
        if (videoModel === 'kling-v3-omni' && (videoDuration === '15s' || videoDuration === '3s') && storyboardMode !== 'individual') {
          // ----------------------------------------------------
          // Kling-v3-omni 15s/3s Mode: Single Task with 6 images
          // ----------------------------------------------------
          setProjectStoryboards(currentProjId, prev => prev.map(s => ({ ...s, isGeneratingVideo: true, progress: 5 })));
  
          const sizeStr = '720p';
          const customSceneObj = customScenes.find(s => s.id === modelScene);
          const sceneDesc = SCENE_PROMPT_DESCRIPTIONS[modelScene as keyof typeof SCENE_PROMPT_DESCRIPTIONS]
            || (customSceneObj ? `posing in a custom scene: ${customSceneObj.name}` : 'posing in a matching catalog studio setting');
  
          const secondsNum = videoDuration === '15s' ? 15 : 3;
          const apiAspectRatio = ratio === '9-16' ? '9:16' : ratio === '3-4' ? '3:4' : '1:1';
  
          let promptText = '';
          if (secondsNum === 15) {
            promptText = `Referencing 图1 (outfit model) as the strict character consistency reference. Referencing 图2, 图3, 图4, 图5, and 图6 as the storyboard sequence references for each respective shot.`;
            if (activeBackgroundUrl) {
              promptText += ` Referencing 图7 (scene template) to lock background scene consistency.`;
            }
          } else {
            // 3s composite mode: only outfit model, composite image, and scene background are sent (3 images)
            promptText = `Referencing 图1 (outfit model) as the strict character consistency reference, and referencing 图2 (16:9 composite storyboard image) as the layout and pose references for each frame.`;
            if (activeBackgroundUrl) {
              promptText += ` Referencing 图3 (scene template) to lock background scene consistency.`;
            }
          }
  
          promptText += ` ${i2vMasterPrompt15s}。The background scene environment is: ${sceneDesc}. A high-end cinematic fashion commercial blockbuster style. The camera performs slow-motion elegant operations like dolly zoom, slow panning, or orbital rotation. The model performs high-fashion micro-movements with subtle elegant posture adjustments, keeping action amplitude small and natural. Premium Vogue-style chiaroscuro studio lighting, highly detailed skin textures, realistic fabric folds, smooth continuous motion, 8k resolution, cinematic color grading.`;
  
          if (activeBackgroundUrl) {
            if (secondsNum === 15) {
              promptText += ` The background scene, environment layout, colors, and lighting of the generated video must remain strictly identical and consistent with the provided scene reference image (图7). Keep the background completely stable and unchanged.`;
            } else {
              promptText += ` The background scene, environment layout, colors, and lighting of the generated video must remain strictly identical and consistent with the provided scene reference image (图3). Keep the background completely stable and unchanged.`;
            }
          }
  
          console.log(`[Video Task Triggered] Composite Mode, Duration: ${videoDuration}`);
          console.log(`[Video Task Payload]`, {
            model: videoModel,
            prompt: promptText,
            imageSrc: activeStoryboards[0].imageSrc,
            modelOutfitImgUrl: modelOutfitImgUrl || swapModelUrl || undefined,
            storyboardImgUrls: activeStoryboards.map(s => s.imageSrc),
            sceneImgUrl: activeBackgroundUrl || undefined,
            seconds: secondsNum,
            size: sizeStr,
            aspectRatio: apiAspectRatio
          });
  
          const taskId = await generateVideoTask({
            model: videoModel,
            prompt: promptText,
            imageSrc: activeStoryboards[0].imageSrc,
            modelOutfitImgUrl: modelOutfitImgUrl || swapModelUrl || undefined,
            storyboardImgUrls: activeStoryboards.map(s => s.imageSrc),
            sceneImgUrl: activeBackgroundUrl || undefined,
            seconds: secondsNum,
            size: sizeStr,
            aspectRatio: apiAspectRatio,
            gatewayUrl: gatewayVideoUrl,
            gatewayToken: gatewayVideoToken,
            projectId: currentProjId
          });
  
          setProjectStoryboards(currentProjId, prev => prev.map(s => ({ ...s, videoTaskId: taskId })));
  
          await waitForVideoTask({
            taskId,
            intervalMs: 4000,
            maxAttempts: 300,
            estimatedAttempts: 100,
            isCancelled: () => !!cancelledProjectsRef.current[currentProjId],
            onProgress: progress => {
              setProjectStoryboards(currentProjId, prev => prev.map(s => ({
                ...s,
                progress: Math.min(progress, 95)
              })));
            }
          });
  
          if (cancelledProjectsRef.current[currentProjId]) {
            throw new Error('user_cancelled');
          }
  
          const videoBlob = await getVideoContent(gatewayVideoUrl, gatewayVideoToken, taskId);
          const localVideoUrl = URL.createObjectURL(videoBlob);
  
          setProjectStoryboards(currentProjId, prev => prev.map(s => ({
            ...s,
            isGeneratingVideo: false,
            progress: 100,
            videoSrc: localVideoUrl,
            videoBlob: videoBlob
          })));
        } else {
          // ----------------------------------------------------
          // Standard Multi-Task Stitching Parallel Mode (Veo/MiniMax/Vidu/4s)
          // ----------------------------------------------------
          const tasks = activeStoryboards.map(async (shot) => {
            const shotId = shot.id;
            setProjectStoryboards(currentProjId, prev => prev.map(s => s.id === shotId ? { ...s, isGeneratingVideo: true, progress: 5 } : s));
  
            const sizeStr = videoModel.includes('MiniMax')
              ? '768P'
              : videoModel.includes('sora') ? '1280x720' : '720p';
  
            const customSceneObj = customScenes.find(s => s.id === modelScene);
            const sceneDesc = SCENE_PROMPT_DESCRIPTIONS[modelScene as keyof typeof SCENE_PROMPT_DESCRIPTIONS]
              || (customSceneObj ? `posing in a custom scene: ${customSceneObj.name}` : 'posing in a matching catalog studio setting');
            const parsedPrompts = parseFiveShotPrompt(i2vMasterPrompt15s);
            const userPrompt = (videoDuration === '15s' || videoDuration === '3s')
              ? (parsedPrompts[shot.shotType as keyof typeof parsedPrompts] || '')
              : (i2vPrompts[shot.shotType as keyof typeof i2vPrompts] || '');
  
            let rewrittenUserPrompt = userPrompt;
            rewrittenUserPrompt = rewrittenUserPrompt.replace(/图[2-6]/g, '图2').replace(/Image\s*[2-6]/gi, 'Image 2');
            rewrittenUserPrompt = rewrittenUserPrompt.replace(/图7/g, '图3').replace(/Image\s*7/gi, 'Image 3');
  
            let promptText: string;
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
  
            const apiAspectRatio = ratio === '9-16' ? '9:16' : ratio === '3-4' ? '3:4' : '1:1';
  
            const secondsNum = (videoDuration === '15s' || videoDuration === '3s') ? 3 : 4;
  
            console.log(`[Video Task Triggered] Individual Shot Mode, Shot: ${shot.name}, Duration: ${videoDuration}`);
            console.log(`[Video Task Payload]`, {
              model: videoModel,
              prompt: promptText,
              imageSrc: shot.imageSrc,
              modelOutfitImgUrl: modelOutfitImgUrl || swapModelUrl || undefined,
              sceneImgUrl: activeBackgroundUrl || undefined,
              seconds: secondsNum,
              size: sizeStr,
              aspectRatio: apiAspectRatio
            });
  
            const taskId = await generateVideoTask({
              model: videoModel,
              prompt: promptText,
              imageSrc: shot.imageSrc,
              modelOutfitImgUrl: modelOutfitImgUrl || swapModelUrl || undefined,
              sceneImgUrl: activeBackgroundUrl || undefined,
              seconds: secondsNum,
              size: sizeStr,
              aspectRatio: apiAspectRatio,
              gatewayUrl: gatewayVideoUrl,
              gatewayToken: gatewayVideoToken,
              projectId: currentProjId
            });
  
            setProjectStoryboards(currentProjId, prev => prev.map(s => s.id === shotId ? { ...s, videoTaskId: taskId } : s));
  
            const pollIntervalMs = videoModel.includes('veo') ? 4000 : 3000;
            const maxPolls = (videoDuration === '15s' || videoDuration === '3s') ? 300 : (videoModel.includes('veo') ? 150 : 200);
            const estimatedAttempts = videoDuration === '15s' ? 100 : (videoModel.includes('veo') ? 60 : 20);
  
            await waitForVideoTask({
              taskId,
              intervalMs: pollIntervalMs,
              maxAttempts: maxPolls,
              estimatedAttempts,
              isCancelled: () => !!cancelledProjectsRef.current[currentProjId],
              onProgress: progress => {
                setProjectStoryboards(currentProjId, prev => prev.map(s =>
                  s.id === shotId ? { ...s, progress: Math.min(progress, 95) } : s
                ));
              }
            });
  
            if (cancelledProjectsRef.current[currentProjId]) {
              throw new Error('user_cancelled');
            }
  
            const videoBlob = await getVideoContent(gatewayVideoUrl, gatewayVideoToken, taskId);
            const localVideoUrl = URL.createObjectURL(videoBlob);
  
            setProjectStoryboards(currentProjId, prev => prev.map(s => s.id === shotId ? { ...s, isGeneratingVideo: false, progress: 100, videoSrc: localVideoUrl, videoBlob: videoBlob } : s));
          });
  
          await Promise.all(tasks);
        }
  
        setProjectI2vStep(currentProjId, 'video_generated');
        alert((videoDuration === '15s' || videoDuration === '3s')
          ? '15s分镜拼接视频生成成功！已为 5 段镜头生成动态视频片段，请点击步骤 3 拼装导入时间轴播放。'
          : '图生视频模型调用成功！已为所有分镜生成动态视频片段，请点击步骤 3 拼装导入时间轴播放。');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof AiTaskCancelledError || message === 'user_cancelled') {
          alert('视频生成已成功中断。');
        } else {
          console.error(err);
          alert(`图生视频失败: ${message}`);
        }
        setProjectStoryboards(currentProjId, prev => prev.map(s => s.isGeneratingVideo ? { ...s, isGeneratingVideo: false, progress: 0 } : s));
      } finally {
        setProjectIsI2vGenerating(currentProjId, false);
        cancelledProjectsRef.current[currentProjId] = false;
      }
  };

  return generateStoryboardVideos;
}
