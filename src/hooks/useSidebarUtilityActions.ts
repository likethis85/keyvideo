import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Layer } from '../components/VideoCanvas';
import type { StoryboardItem } from '../types/aiProject';
import type { AudioAsset, SceneAsset } from '../types/assets';
import { applyI2VToTimeline } from '../services/i2vTimelineService';
import { createTimelineTemplate, type TimelineTemplateType } from '../services/timelineTemplateFactory';

interface Options {
  activeProjectId: string;
  setProjectStoryboards: (id: string, update: SetStateAction<StoryboardItem[]>) => void;
  storyboards: StoryboardItem[];
  bgmLibrary: AudioAsset[];
  videoDuration: '3s' | '15s';
  videoModel: string;
  storyboardMode: string;
  includeI2VStickers: boolean;
  includeI2VSubtitles: boolean;
  setLayers: Dispatch<SetStateAction<Layer[]>>;
  setSelectedLayerId: (id: string | null) => void;
  customScenes: SceneAsset[];
  setSwapModelUrl: (url: string) => void;
  setModelScene: (scene: string) => void;
  setActiveTab: (tab: 'ai') => void;
}

export function useSidebarUtilityActions(options: Options) {
  const downloadImage = useCallback(async (url: string, filename: string) => {
    try {
      const blobUrl = URL.createObjectURL(await fetch(url).then(response => response.blob()));
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename.endsWith('.png') ? filename : `${filename}.png`;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Failed to download image, falling back to direct tab open:', error);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.target = '_blank';
      anchor.click();
    }
  }, []);

  const reorderStoryboards = useCallback((from: number, to: number) => {
    if (!options.activeProjectId || from === to) return;
    options.setProjectStoryboards(options.activeProjectId, previous => {
      const next = [...previous];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, [options]);

  const applyVideoToTimeline = useCallback(() => applyI2VToTimeline({
    storyboards: options.storyboards, bgmLibrary: options.bgmLibrary, videoDuration: options.videoDuration,
    videoModel: options.videoModel, storyboardMode: options.storyboardMode,
    includeI2VStickers: options.includeI2VStickers, includeI2VSubtitles: options.includeI2VSubtitles,
    setLayers: options.setLayers, setSelectedLayerId: options.setSelectedLayerId
  }), [options]);

  const applyTemplate = useCallback((template: TimelineTemplateType) => {
    const layers = createTimelineTemplate(template, options.bgmLibrary[0]);
    options.setLayers(layers);
    options.setSelectedLayerId(layers[0].id);
  }, [options]);

  const applyModel = useCallback((src: string, name: string) => {
    options.setSwapModelUrl(src);
    options.setActiveTab('ai');
    alert(`已选定模特「${name}」作为生成参考模特，已为您自动切换至「AI工具」面板。`);
  }, [options]);

  const applyScene = useCallback((name: string, src: string) => {
    const builtIn: Record<string, string> = { 摩登街头: 'street', 专业影棚: 'studio', 温馨居家: 'home', 职场办公: 'office', 阳光海滩: 'beach', 时尚秀场: 'runway', 极简侘寂: 'minimalist' };
    const scene = builtIn[name] || options.customScenes.find(item => item.src === src || item.name === name)?.id;
    if (!scene) return alert('未找到该场景，请在 AI 面板中手动选择。');
    options.setModelScene(scene);
    options.setActiveTab('ai');
    alert(`已选定场景「${name}」作为生成参考背景，已为您自动切换至「AI工具」面板。`);
  }, [options]);

  return { downloadImage, reorderStoryboards, applyVideoToTimeline, applyTemplate, applyModel, applyScene };
}
