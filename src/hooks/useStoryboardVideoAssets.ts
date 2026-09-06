import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AIProject, StoryboardItem } from '../types/aiProject';
import { getVideoContent } from '../utils/aiGateway';
import { syncProjectToSupabase } from '../services/aiProjectSyncService';

type PreviewVideo = { id: string; src: string; name: string } | null;

interface StoryboardVideoAssetsOptions {
  activeProjectId: string;
  gatewayVideoUrl: string;
  gatewayVideoToken: string;
  setShowConfig: (show: boolean) => void;
  setProjects: Dispatch<SetStateAction<AIProject[]>>;
  setStoryboards: Dispatch<SetStateAction<StoryboardItem[]>>;
  setPreviewVideo: Dispatch<SetStateAction<PreviewVideo>>;
}

export function useStoryboardVideoAssets(options: StoryboardVideoAssetsOptions) {
  const saveVideo = useCallback((storyboardId: string, blob: Blob, taskId?: string) => {
    const videoUrl = URL.createObjectURL(blob);
    const update = (items: StoryboardItem[]) => items.map(item => item.id === storyboardId
      ? { ...item, videoSrc: videoUrl, videoBlob: blob, ...(taskId ? { videoTaskId: taskId } : {}) }
      : item);

    options.setProjects(previous => previous.map(project => {
      if (project.id !== options.activeProjectId) return project;
      const updatedProject = { ...project, storyboards: update(project.storyboards) };
      void syncProjectToSupabase(updatedProject);
      return updatedProject;
    }));
    options.setStoryboards(update);
    options.setPreviewVideo(previous => previous?.id === storyboardId ? { ...previous, src: videoUrl } : previous);
  }, [options]);

  const redownloadVideo = useCallback(async (storyboardId: string, taskId: string) => {
    if (!options.activeProjectId) return;
    if (!options.gatewayVideoUrl.trim() || !options.gatewayVideoToken.trim()) {
      alert('请先在底部的「AI 网关配置」中输入您的视频网关地址与 Token！');
      options.setShowConfig(true);
      return;
    }

    try {
      alert('开始从服务器重新拉取视频，请稍候...');
      const blob = await getVideoContent(options.gatewayVideoUrl, options.gatewayVideoToken, taskId);
      saveVideo(storyboardId, blob, taskId);
      alert('视频拉取并下载成功！已替换当前分镜视频。');
    } catch (error) {
      console.error('Failed to redownload video:', error);
      alert(`拉取视频失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [options, saveVideo]);

  const uploadVideo = useCallback(async (storyboardId: string, file: File) => {
    if (!options.activeProjectId || !file) return;
    try {
      saveVideo(storyboardId, file);
      alert('本地视频上传替换成功！');
    } catch (error) {
      console.error('Failed to manually upload video:', error);
      alert(`替换视频失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [options.activeProjectId, saveVideo]);

  return { redownloadVideo, uploadVideo };
}
