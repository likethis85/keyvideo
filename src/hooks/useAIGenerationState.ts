import { useState } from 'react';
import type { StoryboardItem } from '../types/aiProject';
import { DEFAULT_I2V_PROMPTS, DEFAULT_MASTER_PROMPT } from '../utils/aiProjectFactory';

export function useAIGenerationState() {
  const [modelGender, setModelGender] = useState<'female' | 'male'>('female');
  const [modelRegion, setModelRegion] = useState<'east-asian' | 'western'>('east-asian');
  const [modelScene, setModelScene] = useState('street');
  const [swapModelUrl, setSwapModelUrl] = useState('/clothing_model.png');
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [batchClothingUrl] = useState('');
  const [topClothingUrl, setTopClothingUrl] = useState('');
  const [bottomClothingUrl, setBottomClothingUrl] = useState('');
  const [referenceOutfitUrl, setReferenceOutfitUrl] = useState('');
  const [referenceOutfitUrls, setReferenceOutfitUrls] = useState<string[]>([]);
  const [storyboards, setStoryboards] = useState<StoryboardItem[]>([]);
  const [i2vStep, setI2vStep] = useState<'idle' | 'storyboard_generated' | 'video_generated'>('idle');
  const [i2vPrompts, setI2vPrompts] = useState(() => ({ ...DEFAULT_I2V_PROMPTS }));
  const [videoDuration, setVideoDuration] = useState<'3s' | '15s'>('15s');
  const [i2vMasterPrompt15s, setI2vMasterPrompt15s] = useState(DEFAULT_MASTER_PROMPT);
  const [videoModel, setVideoModel] = useState(() => localStorage.getItem('ai_video_model') || 'viduq2');
  const [includeI2VSubtitles, setIncludeI2VSubtitles] = useState(false);
  const [includeI2VStickers, setIncludeI2VStickers] = useState(false);
  const [useSlowMotion, setUseSlowMotion] = useState(() => localStorage.getItem('ai_use_slow_motion') === 'true');
  const [modelOutfitImgUrl, setModelOutfitImgUrl] = useState<string | null>(null);
  const [modelOutfitImgUrls, setModelOutfitImgUrls] = useState<string[]>([]);
  const [clothingFocus, setClothingFocus] = useState<'top' | 'bottom' | 'both'>(() => {
    const saved = localStorage.getItem('ai_clothing_focus');
    return saved === 'top' || saved === 'bottom' ? saved : 'both';
  });
  const [isOutfitImgGenerating, setIsOutfitImgGenerating] = useState(false);
  const [outfitGenInterrupted, setOutfitGenInterrupted] = useState(false);
  const [clothingFocusModalOpen, setClothingFocusModalOpen] = useState(false);
  const [isI2vGenerating, setIsI2vGenerating] = useState(false);
  const [isRegeneratingShotId, setIsRegeneratingShotId] = useState<string | null>(null);
  const [isStoryboardGenerating, setIsStoryboardGenerating] = useState(false);
  const [storyboardMode, setStoryboardMode] = useState<'individual' | 'composite_slice' | 'composite_no_slice'>(() => {
    const saved = localStorage.getItem('ai_storyboard_mode');
    if (saved === 'composite_slice' || saved === 'composite_no_slice' || saved === 'individual') return saved;
    return localStorage.getItem('ai_generate_on_single_image') === 'true' ? 'composite_slice' : 'individual';
  });
  const [apparelStyle, setApparelStyle] = useState<'dress' | 'suit' | 'street' | 'neo_chinese' | 'overcoat' | 'knitwear' | 'general'>(() => {
    const saved = localStorage.getItem('ai_apparel_style');
    return saved === 'dress' || saved === 'suit' || saved === 'street' || saved === 'neo_chinese' || saved === 'overcoat' || saved === 'knitwear' ? saved : 'general';
  });
  const [cameraStyle, setCameraStyle] = useState<'cinematic_dolly' | 'orbit_360' | 'macro_rack' | 'low_angle' | 'default'>(() => {
    const saved = localStorage.getItem('ai_camera_style');
    return saved === 'orbit_360' || saved === 'macro_rack' || saved === 'low_angle' || saved === 'default' ? saved : 'cinematic_dolly';
  });
  const [lightingMood, setLightingMood] = useState<'editorial_soft' | 'golden_hour' | 'wabi_sabi' | 'cyber_night' | 'default'>(() => {
    const saved = localStorage.getItem('ai_lighting_mood');
    return saved === 'golden_hour' || saved === 'wabi_sabi' || saved === 'cyber_night' || saved === 'default' ? saved : 'editorial_soft';
  });
  return {
    modelGender, setModelGender, modelRegion, setModelRegion, modelScene, setModelScene, swapModelUrl, setSwapModelUrl,
    isConfigLoaded, setIsConfigLoaded, batchClothingUrl, topClothingUrl, setTopClothingUrl, bottomClothingUrl, setBottomClothingUrl,
    referenceOutfitUrl, setReferenceOutfitUrl, referenceOutfitUrls, setReferenceOutfitUrls, storyboards, setStoryboards,
    i2vStep, setI2vStep, i2vPrompts, setI2vPrompts, videoDuration, setVideoDuration, i2vMasterPrompt15s, setI2vMasterPrompt15s,
    videoModel, setVideoModel, includeI2VSubtitles, setIncludeI2VSubtitles, includeI2VStickers, setIncludeI2VStickers,
    useSlowMotion, setUseSlowMotion, modelOutfitImgUrl, setModelOutfitImgUrl, modelOutfitImgUrls, setModelOutfitImgUrls,
    clothingFocus, setClothingFocus, isOutfitImgGenerating, setIsOutfitImgGenerating, outfitGenInterrupted, setOutfitGenInterrupted,
    clothingFocusModalOpen, setClothingFocusModalOpen, isI2vGenerating, setIsI2vGenerating, isRegeneratingShotId,
    setIsRegeneratingShotId, isStoryboardGenerating, setIsStoryboardGenerating, storyboardMode, setStoryboardMode,
    apparelStyle, setApparelStyle, cameraStyle, setCameraStyle, lightingMood, setLightingMood
  };
}
