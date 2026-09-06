import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Layer } from '../components/VideoCanvas';
import type { AIProject, StoryboardItem } from '../types/aiProject';
import type { SceneAsset } from '../types/assets';
import { generateTryOnImage } from '../utils/aiGateway';
import { parseFiveShotPrompt } from '../services/storyboardPromptParser';
import { slicePanoramicBackground, sliceStoryboardImage } from '../services/storyboardImageService';
import { SCENE_PROMPT_DESCRIPTIONS } from '../services/storyboardSceneService';

type PreviewModel = { id?: string; src: string; name: string; storyboardId?: string } | null;
type StoryboardUpdater = StoryboardItem[] | ((previous: StoryboardItem[]) => StoryboardItem[]);

interface StoryboardImageGenerationOptions {
  activeProjectId: string;
  projects: AIProject[];
  storyboards: StoryboardItem[];
  layers: Layer[];
  selectedLayerId: string | null;
  batchClothingUrl: string;
  topClothingUrl: string;
  bottomClothingUrl: string;
  referenceOutfitUrl: string;
  referenceOutfitUrls: string[];
  modelOutfitImgUrl: string | null;
  modelOutfitImgUrls: string[];
  swapModelUrl: string;
  modelGender: 'female' | 'male';
  modelRegion: 'east-asian' | 'western';
  matchingItemDesc: string;
  shoesDesc: string;
  accessoriesDesc: string;
  modelScene: string;
  customScenes: SceneAsset[];
  activeBackgroundUrl: string | null;
  videoDuration: '3s' | '15s';
  storyboardMode: string;
  i2vMasterPrompt15s: string;
  i2vPrompts: AIProject['i2vPrompts'];
  gatewayUrl: string;
  gatewayToken: string;
  ratio: string;
  cancelledProjectsRef: MutableRefObject<Record<string, boolean>>;
  setProjectStoryboards: (projectId: string, updater: StoryboardUpdater) => void;
  setProjectI2vStep: (projectId: string, step: AIProject['i2vStep']) => void;
  setProjectIsStoryboardGenerating: (projectId: string, generating: boolean) => void;
  setModelSwapRunning: (running: boolean) => void;
  setIsRegeneratingShotId: (id: string | null) => void;
  setPreviewModel: Dispatch<SetStateAction<PreviewModel>>;
  setClothingFocusModalOpen: (open: boolean) => void;
}

export function useStoryboardImageGeneration(options: StoryboardImageGenerationOptions) {
  const {
    activeProjectId, projects, storyboards, layers, selectedLayerId, batchClothingUrl, topClothingUrl, bottomClothingUrl,
    referenceOutfitUrl, referenceOutfitUrls, modelOutfitImgUrl, modelOutfitImgUrls, swapModelUrl, modelGender, modelRegion,
    matchingItemDesc, shoesDesc, accessoriesDesc, modelScene, customScenes, activeBackgroundUrl, videoDuration,
    storyboardMode, i2vMasterPrompt15s, i2vPrompts, gatewayUrl, gatewayToken, ratio, cancelledProjectsRef,
    setProjectStoryboards, setProjectI2vStep, setProjectIsStoryboardGenerating, setModelSwapRunning,
    setIsRegeneratingShotId, setPreviewModel, setClothingFocusModalOpen
  } = options;

    const getOutfitIndexForShot = (shotIndex: number, totalShots: number, totalOutfits: number): number => {
      if (totalOutfits <= 1) return 0;
      if (totalOutfits === 2) {
        if (totalShots === 5) {
          return shotIndex < 3 ? 0 : 1;
        } else {
          return shotIndex < 2 ? 0 : 1;
        }
      }
      if (totalOutfits === 3) {
        if (totalShots === 5) {
          if (shotIndex < 2) return 0;
          if (shotIndex < 4) return 1;
          return 2;
        } else {
          return shotIndex;
        }
      }
      return 0;
    };
  
    const handleRegenerateStoryboard = async (shotId: string, customPromptOverride?: string, bgOverrideUrl?: string | null) => {
      const currentProjId = activeProjectId;
      if (!currentProjId) return;
  
      let shotIndex = storyboards.findIndex(s => s.id === shotId);
      // Parse index from ID if possible (e.g. storyboard_shot_2_...)
      const idParts = shotId.split('_');
      const shotIndexPart = idParts.find((part, idx) => part === 'shot' && idParts[idx + 1] !== undefined);
      if (shotIndexPart) {
        const idxFromId = parseInt(idParts[idParts.indexOf('shot') + 1], 10);
        if (!isNaN(idxFromId)) {
          shotIndex = idxFromId;
        }
      }
      const shot = storyboards.find(s => s.id === shotId);
      if (!shot) return;
  
      const outfitIndex = getOutfitIndexForShot(shotIndex, storyboards.length, referenceOutfitUrls.length);
      const currentModelOutfitImg = modelOutfitImgUrls[outfitIndex];
      const currentReferenceOutfit = referenceOutfitUrls[outfitIndex];
      const mainClothing = currentReferenceOutfit || topClothingUrl || bottomClothingUrl || '';
      const bottomClothing = currentReferenceOutfit ? undefined : (topClothingUrl ? bottomClothingUrl : undefined);
  
      if (!mainClothing) {
        alert('请先上传「服装白底图」或「模特穿搭参考图」，或在时间轴中选中一个衣服图层！');
        return;
      }
  
      let clothingUrlPayload;
      let modelUrlPayload;
      let bottomUrlPayload;
  
      if (currentModelOutfitImg) {
        clothingUrlPayload = currentModelOutfitImg;
        modelUrlPayload = undefined; // Already contains the target model
        bottomUrlPayload = undefined;
      } else {
        clothingUrlPayload = mainClothing;
        modelUrlPayload = swapModelUrl;
        bottomUrlPayload = bottomClothing || undefined;
      }
  
      setIsRegeneratingShotId(shotId);
      try {
        const customSceneObj = customScenes.find(s => s.id === modelScene);
        const initialSceneDesc = SCENE_PROMPT_DESCRIPTIONS[modelScene as keyof typeof SCENE_PROMPT_DESCRIPTIONS]
          || (customSceneObj ? `posing in a custom scene: ${customSceneObj.name}` : 'posing in a matching catalog studio setting');
  
        const isNoSlice = storyboardMode === 'composite_no_slice';
        const numPanels = storyboards.length;
        
        let basePrompt = '';
        if (isNoSlice) {
          const parsedPrompts = parseFiveShotPrompt(i2vMasterPrompt15s);
          const shotsConfig = (videoDuration === '15s' || videoDuration === '3s') ? [
            { type: 'shot-1' as const, name: '分镜一：全身走秀出场 (0-3s)', prompt: parsedPrompts['shot-1'] },
            { type: 'shot-2' as const, name: '分镜二：下半身聚焦 (3-6s)', prompt: parsedPrompts['shot-2'] },
            { type: 'shot-3' as const, name: '分镜三：手部捏褶细节 (6-9s)', prompt: parsedPrompts['shot-3'] },
            { type: 'shot-4' as const, name: '分镜四：特写回拉全身 (9-12s)', prompt: parsedPrompts['shot-4'] },
            { type: 'shot-5' as const, name: '分镜五：换景全身定格 (12-15s)', prompt: parsedPrompts['shot-5'] }
          ] : [
            { type: 'full-body' as const, name: '分镜一：全身展示 (0-4s)', prompt: i2vPrompts['full-body'] },
            { type: 'medium' as const, name: '分镜二：半身中景 (4-8s)', prompt: i2vPrompts['medium'] },
            { type: 'close-up' as const, name: '分镜三：细节特写 (8-12s)', prompt: i2vPrompts['close-up'] }
          ];
  
          const panelsPromptList = shotsConfig.map((s, idx) => `Panel ${idx + 1} (${s.name}): ${s.prompt}`).join('. ');
          basePrompt = `A premium quality 16:9 multi-panel fashion storyboard, arranged side-by-side as a single horizontal comic strip with exactly ${numPanels} equal columns/panels. The panels must be clearly separated and show different views of the same model and outfit in a consistent setting: ${initialSceneDesc}. Here are the descriptions for each panel from left to right: ${panelsPromptList}`;
        } else {
          const parsedPrompts = parseFiveShotPrompt(i2vMasterPrompt15s);
          basePrompt = (videoDuration === '15s' || videoDuration === '3s')
            ? `${parsedPrompts[shot.shotType as keyof typeof parsedPrompts] || ''}`
            : `${i2vPrompts[shot.shotType as keyof typeof i2vPrompts] || ''}`;
        }
  
        const effectivePromptText = customPromptOverride && customPromptOverride.trim()
          ? `${basePrompt}. Additional instructions: ${customPromptOverride.trim()}`
          : basePrompt;
  
        // Use the per-shot uploaded override background first, fall back to global active background
        const effectiveBgSource = bgOverrideUrl || activeBackgroundUrl || undefined;
        let currentBackgroundUrl = effectiveBgSource;
        if (effectiveBgSource) {
          try {
            const sliced = await slicePanoramicBackground(effectiveBgSource);
            if (sliced && sliced.length === 3) {
              currentBackgroundUrl = sliced[shotIndex % 3];
              console.log('Successfully used sliced background panel', shotIndex % 3, 'for regeneration. (Override:', !!bgOverrideUrl, ')');
            }
          } catch (err) {
            console.warn('Failed to slice background during regeneration, using original:', err);
          }
        }
  
        const clothingsCount = 1 + (bottomUrlPayload ? 1 : 0);
        const modelsCount = modelUrlPayload ? 1 : 0;
        const bgIndex = clothingsCount + modelsCount + 1;
        const panelPositions = ['left panel (the first scene view)', 'middle panel (the second scene view)', 'right panel (the third scene view)'];
        const panelPosText = panelPositions[shotIndex % 3];
  
        const sceneDesc = currentBackgroundUrl
          ? `the specific scene shown in the ${panelPosText} of the background reference image (图${bgIndex})`
          : (SCENE_PROMPT_DESCRIPTIONS[modelScene as keyof typeof SCENE_PROMPT_DESCRIPTIONS] || (customSceneObj ? `posing in a custom scene: ${customSceneObj.name}` : 'posing in a matching catalog studio setting'));
  
        const isFullBody = shot.shotType === 'full-body' || shot.shotType === 'shot-1';
        let stylingInfo = '';
        if (matchingItemDesc.trim()) stylingInfo += ` Outfit styling match: ${matchingItemDesc.trim()}.`;
        if (shoesDesc.trim()) stylingInfo += ` Footwear styling: ${shoesDesc.trim()}.`;
        if (isFullBody && accessoriesDesc.trim()) {
          stylingInfo += ` Accessories/bags: ${accessoriesDesc.trim()}. The model should carry or wear the accessory naturally if the pose permits.`;
        } else if (!isFullBody) {
          stylingInfo += ` No bags or handbags should be visible in this view.`;
        }
  
        const clothingRefTags = bottomUrlPayload ? '图1 and 图2' : '图1';
  
        const taskText = currentModelOutfitImg
          ? `Task: Place the dressed model from ${clothingRefTags} into the new background scene.`
          : `Task: Generate a premium fashion portrait shot by transferring the outfit from ${clothingRefTags} onto the model from 图${bgIndex - 1}.`;
  
        const modelStrict = currentModelOutfitImg
          ? `Model (Strict): 100% exact face, hair, skin tone, and body from the dressed model in ${clothingRefTags}. Maintain perfect character consistency with ${clothingRefTags}.`
          : `Model (Strict): 100% exact face, hair, skin tone, and body of 图${bgIndex - 1}. Do NOT retain any facial features from ${clothingRefTags}.`;
  
        const outfitStrict = currentModelOutfitImg 
          ? `Outfit (Strict): Replicate the complete outfit exactly as shown on the model in ${clothingRefTags}.`
          : `Outfit (Strict): Identical clothing from ${clothingRefTags} (fabric, drapery, and fit). The model's outfit must remain strictly consistent across all angles.`;
  
        const customPromptText = `${taskText}
  ${modelStrict}
  ${outfitStrict}
  Style & Setting: High-resolution cinematic portrait shot, detailed skin, natural lighting, posing in: ${sceneDesc}. Shot details: ${effectivePromptText}.${stylingInfo}
  Background (Strict): The background must strictly and exactly match the ${panelPosText} of the provided background reference image (图${bgIndex}) in every pixel, detail, color, furniture, layout, texture, and structure. Seamlessly integrate the model into this specific background view.
  Negative constraints: Clean image, strictly NO text, logos, watermarks, tags, signatures, duplicate limbs, extra hands, floating fingers, or split/multiple panels.`;
  
        let generatedUrl = '';
        if (gatewayUrl && gatewayToken) {
          generatedUrl = await generateTryOnImage({
            clothingUrl: clothingUrlPayload,
            clothingBottomUrl: bottomUrlPayload,
            modelUrl: modelUrlPayload,
            gender: modelGender,
            region: modelRegion,
            scene: (modelScene === 'street' || modelScene === 'studio' || modelScene === 'home' || modelScene === 'office' || modelScene === 'beach' || modelScene === 'runway' || modelScene === 'minimalist') ? (modelScene as Parameters<typeof generateTryOnImage>[0]['scene']) : 'studio',
            ratio: isNoSlice ? '16-9' : ratio,
            gatewayUrl,
            gatewayToken,
            customPrompt: customPromptText,
            backgroundImageUrl: currentBackgroundUrl
          });
        } else {
          await new Promise(resolve => setTimeout(resolve, 1500));
          generatedUrl = currentModelOutfitImg || swapModelUrl;
        }
  
        setProjectStoryboards(currentProjId, prev => prev.map(s => s.id === shotId ? { ...s, imageSrc: generatedUrl, videoSrc: null, progress: 0 } : s));
        setPreviewModel(prev => prev && prev.storyboardId === shotId ? { ...prev, src: generatedUrl } : prev);
        alert(`分镜「${shot.name}」静态画面重新生成成功！`);
      } catch (error) {
        console.error(error);
        alert(`分镜重新生成失败: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsRegeneratingShotId(null);
      }
    };
  
    const executeGenerateStoryboards = async (focus: 'top' | 'bottom' | 'both') => {
      const currentProjId = activeProjectId;
      if (!currentProjId) return;
  
      let currentSrc = '';
      if (batchClothingUrl) {
        currentSrc = batchClothingUrl;
      } else {
        const activeLayer = layers.find(l => l.id === selectedLayerId);
        if (activeLayer && activeLayer.type === 'media') {
          currentSrc = activeLayer.properties.src || '';
        }
      }
  
      const hasUnrenderedOutfit = referenceOutfitUrls.some((_, idx) => !modelOutfitImgUrls[idx]);
      if (referenceOutfitUrls.length > 0 && hasUnrenderedOutfit) {
        alert('检测到您已上传模特穿搭参考图，请先点击上方「一键生成模特服装穿搭图」渲染目标模特效果，再进行分镜生成！');
        return;
      }
  
      const mainClothing = referenceOutfitUrls[0] || referenceOutfitUrl || topClothingUrl || bottomClothingUrl || currentSrc || '';
      const bottomClothing = (referenceOutfitUrls.length > 0 || referenceOutfitUrl) ? undefined : (topClothingUrl ? bottomClothingUrl : undefined);
  
      if (!mainClothing) {
        alert('请先上传「服装白底图」或「模特穿搭参考图」，或在时间轴中选中一个衣服图层！');
        return;
      }
  
      let focusPrompt = '';
      if (focus === 'top') {
        focusPrompt = ' The generation must emphasize and highlight the design, silhouette, texture, and details of the outermost upper garment (outer top / jacket / coat / vest / outer layer). Make this outermost upper clothing layer the clear focal point of the visual composition, showcasing its texture, seams, and overall fit over any inner layers.';
      } else if (focus === 'bottom') {
        focusPrompt = ' The generation must emphasize and highlight the drape, legs silhouette, texture, and details of the lower garment (pants / trousers / skirt). Make the bottom clothing the focal point of the visual composition.';
      }
  
      setModelSwapRunning(true);
      setProjectI2vStep(currentProjId, 'idle');
      setProjectIsStoryboardGenerating(currentProjId, true);
      cancelledProjectsRef.current[currentProjId] = false;
  
      try {
        const customSceneObj = customScenes.find(s => s.id === modelScene);
        const sceneDesc = SCENE_PROMPT_DESCRIPTIONS[modelScene as keyof typeof SCENE_PROMPT_DESCRIPTIONS]
          || (customSceneObj ? `posing in a custom scene: ${customSceneObj.name}` : 'posing in a matching catalog studio setting');
  
        const parsedPrompts = parseFiveShotPrompt(i2vMasterPrompt15s);
        let shotsConfig = [];
        if (videoDuration === '15s' || videoDuration === '3s') {
          if (focus === 'top') {
            shotsConfig = [
              { type: 'shot-1' as const, name: '分镜一：全身展示与上装轮廓 (0-3s)', prompt: `${parsedPrompts['shot-1']}, ${sceneDesc}. Focus on showing the overall silhouette of the top outerwear.` },
              { type: 'shot-2' as const, name: '分镜二：上半身领口剪裁特写 (3-6s)', prompt: `${parsedPrompts['shot-2'] || '聚焦于上衣的领口、肩膀与上半身细节'}, ${sceneDesc}. Extreme close-up focusing on the collar, neckline, chest and upper body of the top garment.` },
              { type: 'shot-3' as const, name: '分镜三：衣服袖口与材质细节 (6-9s)', prompt: `${parsedPrompts['shot-3'] || '聚焦于服装的材质材质与做工细节'}, ${sceneDesc}. Close-up of the fabric texture, stitching, seams, or sleeve cuffs of the top outerwear.` },
              { type: 'shot-4' as const, name: '分镜四：侧面半身活动特写 (9-12s)', prompt: `${parsedPrompts['shot-4']}, ${sceneDesc}. Medium shot focusing on the upper body and top garment fit.` },
              { type: 'shot-5' as const, name: '分镜五：正面半身搭配定格 (12-15s)', prompt: `${parsedPrompts['shot-5']}, ${sceneDesc}. Front view focusing on the upper body and top garment details.` }
            ];
          } else if (focus === 'bottom') {
            shotsConfig = [
              { type: 'shot-1' as const, name: '分镜一：全身展示与下装版型 (0-3s)', prompt: `${parsedPrompts['shot-1']}, ${sceneDesc}. Focus on showing the overall layout and silhouette of the pants/skirt.` },
              { type: 'shot-2' as const, name: '分镜二：下半身聚焦展示 (3-6s)', prompt: `${parsedPrompts['shot-2'] || '镜头向下推聚焦于下半身服饰'}, ${sceneDesc}. Medium shot focusing on the legs, waistline, and overall fit of the bottom pants/skirt.` },
              { type: 'shot-3' as const, name: '分镜三：口袋与裤腰剪裁特写 (6-9s)', prompt: `${parsedPrompts['shot-3'] || '聚焦于裤边或裙摆的线脚细节'}, ${sceneDesc}. Close-up of the waist, pockets, hem, or seams of the bottom pants/skirt.` },
              { type: 'shot-4' as const, name: '分镜四：腿部走动垂坠感特写 (9-12s)', prompt: `${parsedPrompts['shot-4']}, ${sceneDesc}. Medium close-up of the bottom pants/skirt showing drape and movement.` },
              { type: 'shot-5' as const, name: '分镜五：全身定格聚焦下半截 (12-15s)', prompt: `${parsedPrompts['shot-5']}, ${sceneDesc}. Focus on the lower body showing the bottom pants/skirt.` }
            ];
          } else {
            shotsConfig = [
              { type: 'shot-1' as const, name: '分镜一：全身走秀出场 (0-3s)', prompt: `${parsedPrompts['shot-1']}, ${sceneDesc}` },
              { type: 'shot-2' as const, name: '分镜二：下半身聚焦 (3-6s)', prompt: `${parsedPrompts['shot-2']}, ${sceneDesc}` },
              { type: 'shot-3' as const, name: '分镜三：手部捏褶细节 (6-9s)', prompt: `${parsedPrompts['shot-3']}, ${sceneDesc}` },
              { type: 'shot-4' as const, name: '分镜四：特写回拉全身 (9-12s)', prompt: `${parsedPrompts['shot-4']}, ${sceneDesc}` },
              { type: 'shot-5' as const, name: '分镜五：换景全身定格 (12-15s)', prompt: `${parsedPrompts['shot-5']}, ${sceneDesc}` }
            ];
          }
        } else {
          if (focus === 'top') {
            shotsConfig = [
              { type: 'full-body' as const, name: '分镜一：全身展示 (0-4s)', prompt: `${i2vPrompts['full-body']}, ${sceneDesc}. Showcasing the model wearing the top clothing.` },
              { type: 'medium' as const, name: '分镜二：上半身中景 (4-8s)', prompt: `${i2vPrompts['medium']}, ${sceneDesc}. Focus on the upper body and design of the top clothing.` },
              { type: 'close-up' as const, name: '分镜三：领口/材质特写 (8-12s)', prompt: `${i2vPrompts['close-up']}, ${sceneDesc}. Extreme close-up of the top fabric texture, seams, and details.` }
            ];
          } else if (focus === 'bottom') {
            shotsConfig = [
              { type: 'full-body' as const, name: '分镜一：全身展示 (0-4s)', prompt: `${i2vPrompts['full-body']}, ${sceneDesc}. Showcasing the model wearing the bottom pants/skirt.` },
              { type: 'medium' as const, name: '分镜二：下半身聚焦 (4-8s)', prompt: `${i2vPrompts['medium']}, ${sceneDesc}. Focus on the lower body and layout of the bottom pants/skirt.` },
              { type: 'close-up' as const, name: '分镜三：裤边/裙脚特写 (8-12s)', prompt: `${i2vPrompts['close-up']}, ${sceneDesc}. Extreme close-up of the bottom pants/skirt stitching, texture, and hem.` }
            ];
          } else {
            shotsConfig = [
              { type: 'full-body' as const, name: '分镜一：全身展示 (0-4s)', prompt: `${i2vPrompts['full-body']}, ${sceneDesc}` },
              { type: 'medium' as const, name: '分镜二：半身中景 (4-8s)', prompt: `${i2vPrompts['medium']}, ${sceneDesc}` },
              { type: 'close-up' as const, name: '分镜三：细节特写 (8-12s)', prompt: `${i2vPrompts['close-up']}, ${sceneDesc}` }
            ];
          }
        }
  
        let stylingInfo = '';
        if (matchingItemDesc.trim()) stylingInfo += ` Outfit styling match: ${matchingItemDesc.trim()}.`;
        if (shoesDesc.trim()) stylingInfo += ` Footwear styling: ${shoesDesc.trim()}.`;
        if (accessoriesDesc.trim()) {
          stylingInfo += ` Accessories/bags: ${accessoriesDesc.trim()}. Note: Only show the accessory/bag in the full-body panel (Panel 1); other panels (Panel 2, 3, 4, 5) which are medium or close-up views must not show any bag or handbag.`;
        }
  
        let isSpatialBackground = false;
        let slicedBackgrounds: string[] = [];
        if (activeBackgroundUrl) {
          try {
            const sliced = await slicePanoramicBackground(activeBackgroundUrl);
            if (sliced && sliced.length === 3) {
              isSpatialBackground = true;
              slicedBackgrounds = shotsConfig.map((_, idx) => sliced[idx % 3]);
              console.log('Successfully pre-sliced background image into 3 panels for parallel mode');
            }
          } catch (err) {
            console.warn('Failed to pre-slice spatial background:', err);
          }
        }
  
        const isSlice = storyboardMode === 'composite_slice';
        const isNoSlice = storyboardMode === 'composite_no_slice';
        const isComposite = (isSlice || isNoSlice) && !isSpatialBackground;
  
        if (isSpatialBackground && (isSlice || isNoSlice)) {
          alert('💡 检测到您选用了包含 3 个画面的空间场景模板。\n为了保证分镜背景不错位，系统已自动采用【多图并行生成模式】（依次为各个分镜分配对应的子场景画面）。');
        }
  
        const effectiveModelUrl = modelOutfitImgUrls[0] || modelOutfitImgUrl || swapModelUrl;
        const outfitRefNote = (modelOutfitImgUrls.length > 0 || modelOutfitImgUrl)
          ? ' IMPORTANT: The model reference image(s) provided show the complete character wearing the outfits in different views/poses. Use the character appearance, face, body proportions, and complete outfits exactly as shown in the model reference image(s) to guarantee strict consistency across the storyboard panels.'
          : '';
  
        if (isNoSlice) {
          const initialStoryboards = [{
            id: `storyboard_shot_composite_${Date.now()}`,
            name: `${videoDuration === '15s' || videoDuration === '3s' ? '15秒' : '12秒'} 分镜合集 (16:9整图)`,
            shotType: 'shot-1' as const,
            imageSrc: effectiveModelUrl,
            videoSrc: null,
            isGeneratingVideo: false,
            progress: 0,
            isGeneratingImage: true
          }];
          setProjectStoryboards(currentProjId, initialStoryboards);
        } else {
          const initialStoryboards = shotsConfig.map((shot, idx) => {
            const outfitIndex = getOutfitIndexForShot(idx, shotsConfig.length, referenceOutfitUrls.length);
            const initialImg = modelOutfitImgUrls[outfitIndex] || referenceOutfitUrls[outfitIndex] || swapModelUrl;
            return {
              id: `storyboard_shot_${idx}_${Date.now()}`,
              name: shot.name,
              shotType: shot.type,
              imageSrc: initialImg,
              videoSrc: null,
              isGeneratingVideo: false,
              progress: 0,
              isGeneratingImage: true
            };
          });
          setProjectStoryboards(currentProjId, initialStoryboards);
        }
  
        const generatedImages: string[] = [];
  
        if (gatewayUrl && gatewayToken) {
          if (isComposite) {
            const numPanels = shotsConfig.length;
            const panelsPromptList = shotsConfig.map((shot, idx) => `Panel ${idx + 1}: ${shot.prompt}`).join('. ');
            const compositePromptText = `A premium quality ${isNoSlice ? '16:9' : 'multi-panel'} fashion storyboard, arranged side-by-side as a single horizontal comic strip with exactly ${numPanels} equal columns/panels. The panels must be clearly separated and show different views of the same model and outfit in a consistent setting: ${sceneDesc}.
            Here are the descriptions for each panel from left to right:
            ${panelsPromptList}
            High-fidelity garment texture transfer, realistic drapery, correct drapery and fit. Detailed skin, natural lighting.${stylingInfo}${outfitRefNote} Strict Outfit Consistency Rule: The model's complete outfit combination (including bottom pants/shorts/skirt, footwear, and any accessories) must remain strictly identical, consistent, and completely unchanged across all views, crops, and angles. The entire outfit must be a single, cohesive, identical set. No text or captions. There must be absolutely no text, writing, labels, titles, annotations, letters, numbers, panel names, or captions on any part of the image. Strict Anatomy & Border Integrity Rule: Each panel must be an independent, clean shot of the model. Strictly prevent duplicate limbs, extra hands, floating fingers, or overlapping arms. Each individual panel must depict exactly one model with anatomically correct posture and exactly two hands. Do not allow any body parts, hands, arms, or accessories to cross, bleed, or overlap across the vertical borders separating the panels. Keep the panel margins and borders clean, sharp, and empty.${focusPrompt}`;
  
            const modelUrls = modelOutfitImgUrls.length > 0 
              ? modelOutfitImgUrls 
              : (modelOutfitImgUrl ? [modelOutfitImgUrl] : [swapModelUrl]);
  
            let generatedCompositeUrl = '';
            try {
              if (cancelledProjectsRef.current[currentProjId]) {
                throw new Error('USER_CANCELLED');
              }
              generatedCompositeUrl = await generateTryOnImage({
                clothingUrl: mainClothing,
                clothingBottomUrl: bottomClothing || undefined,
                modelUrl: modelUrls,
                gender: modelGender,
                region: modelRegion,
                scene: (modelScene === 'street' || modelScene === 'studio' || modelScene === 'home' || modelScene === 'office' || modelScene === 'beach' || modelScene === 'runway' || modelScene === 'minimalist') ? (modelScene as Parameters<typeof generateTryOnImage>[0]['scene']) : 'studio',
                ratio: isNoSlice ? '16-9' : '1-1',
                gatewayUrl,
                gatewayToken,
                customPrompt: compositePromptText,
                backgroundImageUrl: activeBackgroundUrl || undefined
              });
              if (cancelledProjectsRef.current[currentProjId]) {
                throw new Error('USER_CANCELLED');
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              if (message === 'USER_CANCELLED') throw err;
              console.error('Failed to generate composite storyboard image:', err);
              throw new Error(`生成分镜合集图失败: ${message}`, { cause: err });
            }
  
            if (isNoSlice) {
              setProjectStoryboards(currentProjId, [{
                id: `storyboard_shot_composite_${Date.now()}`,
                name: `${videoDuration === '15s' || videoDuration === '3s' ? '15秒' : '12秒'} 分镜合集 (16:9整图)`,
                shotType: 'shot-1' as const,
                imageSrc: generatedCompositeUrl,
                videoSrc: null,
                isGeneratingVideo: false,
                progress: 0,
                isGeneratingImage: false
              }]);
            } else {
              let slicedUrls: string[] = [];
              try {
                slicedUrls = await sliceStoryboardImage(generatedCompositeUrl, numPanels, 'horizontal');
              } catch (sliceErr) {
                console.warn('Failed to slice composite storyboard image, falling back to cloning:', sliceErr);
                slicedUrls = shotsConfig.map(() => generatedCompositeUrl);
              }
  
              if (cancelledProjectsRef.current[currentProjId]) {
                throw new Error('USER_CANCELLED');
              }
  
              setProjectStoryboards(currentProjId, prev =>
                prev.map((s, idx) => ({
                  ...s,
                  imageSrc: slicedUrls[idx] || generatedCompositeUrl,
                  isGeneratingImage: false
                }))
              );
            }
          } else {
            // Parallel Multi-Image Mode
            if (activeBackgroundUrl && slicedBackgrounds.length === 0) {
              try {
                const sliced = await slicePanoramicBackground(activeBackgroundUrl);
                if (sliced && sliced.length === 3) {
                  slicedBackgrounds = shotsConfig.map((_, idx) => sliced[idx % 3]);
                  console.log('Successfully sliced background image into 3 panels and mapped to shots');
                }
              } catch (err) {
                console.warn('Failed to slice background image, using original background:', err);
              }
            }
  
            const generationPromises = shotsConfig.map(async (shot, i) => {
              if (cancelledProjectsRef.current[currentProjId]) {
                throw new Error('USER_CANCELLED');
              }
  
              const outfitIndex = getOutfitIndexForShot(i, shotsConfig.length, referenceOutfitUrls.length);
              const currentModelOutfitImg = modelOutfitImgUrls[outfitIndex];
              const currentReferenceOutfit = referenceOutfitUrls[outfitIndex];
  
              const currentMainClothing = currentReferenceOutfit || topClothingUrl || bottomClothingUrl || currentSrc || '';
              const currentBottomClothing = currentReferenceOutfit ? undefined : (topClothingUrl ? bottomClothingUrl : undefined);
              const currentBackgroundUrl = slicedBackgrounds[i] || activeBackgroundUrl || undefined;
  
              let clothingUrlPayload;
              let modelUrlPayload;
              let bottomUrlPayload;
  
              if (currentModelOutfitImg) {
                clothingUrlPayload = currentModelOutfitImg;
                modelUrlPayload = undefined; // Already contains the target model
                bottomUrlPayload = undefined;
              } else {
                clothingUrlPayload = currentMainClothing;
                modelUrlPayload = swapModelUrl;
                bottomUrlPayload = currentBottomClothing || undefined;
              }
  
              const clothingsCount = 1 + (bottomUrlPayload ? 1 : 0);
              const modelsCount = modelUrlPayload ? 1 : 0;
              const bgIndex = clothingsCount + modelsCount + 1;
              const clothingRefTags = bottomUrlPayload ? '图1 and 图2' : '图1';
  
              const taskText = currentModelOutfitImg
                ? `Task: Place the dressed model from ${clothingRefTags} into the new background scene.`
                : `Task: Generate a premium fashion portrait shot by transferring the outfit from ${clothingRefTags} onto the model from 图${bgIndex - 1}.`;
  
              const modelStrict = currentModelOutfitImg
                ? `Model (Strict): 100% exact face, hair, skin tone, and body from the dressed model in ${clothingRefTags}. Maintain perfect character consistency with ${clothingRefTags}.`
                : `Model (Strict): 100% exact face, hair, skin tone, and body of 图${bgIndex - 1}. Do NOT retain any facial features from ${clothingRefTags}.`;
  
              const outfitStrict = currentModelOutfitImg 
                ? `Outfit (Strict): Replicate the complete outfit exactly as shown on the model in ${clothingRefTags}.`
                : `Outfit (Strict): Identical clothing from ${clothingRefTags} (fabric, drapery, and fit). The model's outfit must remain strictly consistent across all angles.`;
  
              const panelPositions = ['left panel (the first scene view)', 'middle panel (the second scene view)', 'right panel (the third scene view)'];
              const panelPosText = panelPositions[i % 3];
  
              const currentSceneDesc = currentBackgroundUrl
                ? `the specific scene shown in the ${panelPosText} of the background reference image (图${bgIndex})`
                : sceneDesc;
  
              const isFullBody = shot.type === 'full-body' || shot.type === 'shot-1';
              let currentStylingInfo = '';
              if (matchingItemDesc.trim()) currentStylingInfo += ` Outfit styling match: ${matchingItemDesc.trim()}.`;
              if (shoesDesc.trim()) currentStylingInfo += ` Footwear styling: ${shoesDesc.trim()}.`;
              if (isFullBody && accessoriesDesc.trim()) {
                currentStylingInfo += ` Accessories/bags: ${accessoriesDesc.trim()}. The model should carry or wear the accessory naturally if the pose permits.`;
              } else if (!isFullBody) {
                currentStylingInfo += ` No bags or handbags should be visible in this view.`;
              }
  
              const customPromptText = `${taskText}
  ${modelStrict}
  ${outfitStrict}
  Style & Setting: High-resolution cinematic portrait shot, detailed skin, natural lighting, posing in: ${currentSceneDesc}. Shot details: ${shot.prompt}.${currentStylingInfo}
  Background (Strict): The background must strictly and exactly match the ${panelPosText} of the provided background reference image (图${bgIndex}) in every pixel, detail, color, furniture, layout, texture, and structure. Seamlessly integrate the model into this specific background view.
  Negative constraints: Clean image, strictly NO text, logos, watermarks, tags, signatures, duplicate limbs, extra hands, floating fingers, or split/multiple panels.${focusPrompt}`;
  
              let imgUrl = currentModelOutfitImg || swapModelUrl;
              try {
                imgUrl = await generateTryOnImage({
                  clothingUrl: clothingUrlPayload,
                  clothingBottomUrl: bottomUrlPayload,
                  modelUrl: modelUrlPayload,
                  gender: modelGender,
                  region: modelRegion,
                  scene: (modelScene === 'street' || modelScene === 'studio' || modelScene === 'home' || modelScene === 'office' || modelScene === 'beach' || modelScene === 'runway' || modelScene === 'minimalist') ? (modelScene as Parameters<typeof generateTryOnImage>[0]['scene']) : 'studio',
                  ratio,
                  gatewayUrl,
                  gatewayToken,
                  customPrompt: customPromptText,
                  backgroundImageUrl: currentBackgroundUrl
                });
              } catch (err) {
                if ((err instanceof Error ? err.message : String(err)) === 'USER_CANCELLED') throw err;
                console.warn(`Gateway call failed in I2V storyboard generation for ${shot.name}, falling back:`, err);
              }
  
              if (cancelledProjectsRef.current[currentProjId]) {
                throw new Error('USER_CANCELLED');
              }
  
              setProjectStoryboards(currentProjId, prev =>
                prev.map((s, idx) => idx === i ? { ...s, imageSrc: imgUrl, isGeneratingImage: false } : s)
              );
              generatedImages.push(imgUrl);
            });
  
            await Promise.all(generationPromises);
          }
        } else {
          // Mockup mode
          if (isNoSlice) {
            if (cancelledProjectsRef.current[currentProjId]) {
              throw new Error('USER_CANCELLED');
            }
            await new Promise(resolve => setTimeout(resolve, 800));
            if (cancelledProjectsRef.current[currentProjId]) {
              throw new Error('USER_CANCELLED');
            }
            setProjectStoryboards(currentProjId, prev =>
              prev.map(s => ({ ...s, isGeneratingImage: false }))
            );
          } else {
            for (let i = 0; i < shotsConfig.length; i++) {
              if (cancelledProjectsRef.current[currentProjId]) {
                throw new Error('USER_CANCELLED');
              }
              await new Promise(resolve => setTimeout(resolve, 800));
              if (cancelledProjectsRef.current[currentProjId]) {
                throw new Error('USER_CANCELLED');
              }
              setProjectStoryboards(currentProjId, prev =>
                prev.map((s, idx) => idx === i ? { ...s, isGeneratingImage: false } : s)
              );
            }
          }
        }
  
        setProjectI2vStep(currentProjId, 'storyboard_generated');
        setProjectIsStoryboardGenerating(currentProjId, false);
        setModelSwapRunning(false);
        alert('分镜故事板静态画面生成成功！下一步请调用「图生视频大模型」进行动态分镜渲染。');
      } catch (error) {
        setProjectIsStoryboardGenerating(currentProjId, false);
        setModelSwapRunning(false);
        setProjectStoryboards(currentProjId, prev => prev.map(s => ({ ...s, isGeneratingImage: false })));
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'USER_CANCELLED') {
          console.log('Storyboard generation was cancelled by the user.');
          return;
        }
        console.error(error);
        alert(`分镜静态画面生成失败: ${message}`);
      }
    };
  
    const handleGenerateStoryboards = async () => {
      const currentProjId = activeProjectId;
      if (!currentProjId) return;
  
      const projectObj = projects.find(p => p.id === currentProjId);
      if (projectObj && projectObj.isStoryboardGenerating) {
        cancelledProjectsRef.current[currentProjId] = true;
        setProjectIsStoryboardGenerating(currentProjId, false);
        setModelSwapRunning(false);
        setProjectStoryboards(currentProjId, prev => prev.map(s => ({ ...s, isGeneratingImage: false })));
        return;
      }
  
      if (!topClothingUrl && !bottomClothingUrl) {
        setClothingFocusModalOpen(true);
      } else {
        let autoFocus: 'top' | 'bottom' | 'both' = 'both';
        if (topClothingUrl && !bottomClothingUrl) {
          autoFocus = 'top';
        } else if (!topClothingUrl && bottomClothingUrl) {
          autoFocus = 'bottom';
        }
        executeGenerateStoryboards(autoFocus);
      }
    };
  
  return { handleRegenerateStoryboard, executeGenerateStoryboards, handleGenerateStoryboards };
}
