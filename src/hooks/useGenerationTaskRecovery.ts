import { useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { AIProject, StoryboardItem } from '../types/aiProject';
import { getRecentTasks, getTaskStatus, getVideoContent, waitForVideoTask } from '../utils/aiGateway';
import { toast } from '../components/toastStore';

interface TaskRecoveryOptions {
  isConfigLoaded: boolean;
  projects: AIProject[];
  setProjects: Dispatch<SetStateAction<AIProject[]>>;
  activeProjectIdRef: MutableRefObject<string>;
  setModelOutfitImgUrl: (url: string | null) => void;
  setModelOutfitImgUrls: Dispatch<SetStateAction<string[]>>;
  setIsOutfitImgGenerating: (generating: boolean) => void;
  videoModel: string;
  videoDuration: '3s' | '15s';
  gatewayVideoUrl: string;
  gatewayVideoToken: string;
  cancelledProjectsRef: MutableRefObject<Record<string, boolean>>;
  setStoryboards: Dispatch<SetStateAction<StoryboardItem[]>>;
  setI2vStep: (step: AIProject['i2vStep']) => void;
  setIsI2vGenerating: (generating: boolean) => void;
}

export function useGenerationTaskRecovery(options: TaskRecoveryOptions) {
  const {
    isConfigLoaded, projects, setProjects, activeProjectIdRef, setModelOutfitImgUrl, setModelOutfitImgUrls,
    setIsOutfitImgGenerating, videoModel, videoDuration, gatewayVideoUrl, gatewayVideoToken,
    cancelledProjectsRef, setStoryboards, setI2vStep, setIsI2vGenerating
  } = options;

    const activePollingOutfitTasksRef = useRef<{ [taskId: string]: boolean }>({});
  
    const pollPendingOutfitTask = async (projId: string, taskId: string) => {
      console.log(`[Outfit Recovery] Polling pending outfit task ${taskId} for project ${projId}`);
      setProjects(prev => prev.map(p => p.id === projId ? { ...p, isOutfitImgGenerating: true } : p));
      if (projId === activeProjectIdRef.current) setIsOutfitImgGenerating(true);
  
      let attempts = 0;
      const maxAttempts = 120;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 3000));
        attempts++;
        try {
          const statusRes = await getTaskStatus(taskId);
          if (statusRes.status === 'completed' && statusRes.resultUrl) {
            console.log(`[Outfit Recovery] Pending task ${taskId} completed! Result: ${statusRes.resultUrl}`);
            setProjects(prev => prev.map(p => {
              if (p.id !== projId) return p;
              const newUrls = p.modelOutfitImgUrls && p.modelOutfitImgUrls.length > 0
                ? [statusRes.resultUrl!, ...p.modelOutfitImgUrls.slice(1)]
                : [statusRes.resultUrl!];
              return {
                ...p,
                modelOutfitImgUrl: statusRes.resultUrl!,
                modelOutfitImgUrls: newUrls,
                isOutfitImgGenerating: false
              };
            }));
            if (projId === activeProjectIdRef.current) {
              setModelOutfitImgUrl(statusRes.resultUrl);
              setModelOutfitImgUrls(prev => prev.length > 0 ? [statusRes.resultUrl!, ...prev.slice(1)] : [statusRes.resultUrl!]);
              setIsOutfitImgGenerating(false);
            }
            toast.success('🎉 成功恢复后台生成的 AI 试衣效果！');
            delete activePollingOutfitTasksRef.current[taskId];
            break;
          } else if (statusRes.status === 'failed') {
            console.warn(`[Outfit Recovery] Task ${taskId} failed: ${statusRes.error}`);
            setProjects(prev => prev.map(p => p.id === projId ? { ...p, isOutfitImgGenerating: false } : p));
            if (projId === activeProjectIdRef.current) setIsOutfitImgGenerating(false);
            delete activePollingOutfitTasksRef.current[taskId];
            break;
          }
        } catch (err) {
          console.warn(`[Outfit Recovery] Network error checking task ${taskId}:`, err);
        }
      }
    };
  
    useEffect(() => {
      if (!isConfigLoaded || projects.length === 0) return;
  
      const recoverOutfitTasks = async () => {
        try {
          const recentTasks = await getRecentTasks();
          if (!recentTasks || recentTasks.length === 0) return;
  
          for (const t of recentTasks) {
            const targetProj = t.projectId
              ? projects.find(p => p.id === t.projectId)
              : projects.find(p => !p.modelOutfitImgUrl || p.isOutfitImgGenerating);
            if (!targetProj) continue;
  
            if (t.status === 'completed' && t.resultUrl) {
              if (!targetProj.modelOutfitImgUrl || targetProj.isOutfitImgGenerating) {
                console.log(`[Outfit Recovery] Restoring completed outfit task ${t.taskId} for project ${targetProj.id}`);
                setProjects(prev => prev.map(p => {
                  if (p.id !== targetProj.id) return p;
                  const newUrls = p.modelOutfitImgUrls && p.modelOutfitImgUrls.length > 0
                    ? [t.resultUrl!, ...p.modelOutfitImgUrls.slice(1)]
                    : [t.resultUrl!];
                  return {
                    ...p,
                    modelOutfitImgUrl: t.resultUrl!,
                    modelOutfitImgUrls: newUrls,
                    isOutfitImgGenerating: false
                  };
                }));
                if (targetProj.id === activeProjectIdRef.current) {
                  setModelOutfitImgUrl(t.resultUrl);
                  setModelOutfitImgUrls(prev => prev.length > 0 ? [t.resultUrl!, ...prev.slice(1)] : [t.resultUrl!]);
                  setIsOutfitImgGenerating(false);
                }
                toast.success('🎉 已自动恢复后台已完成的 AI 试衣效果！');
              }
            } else if ((t.status === 'pending' || t.status === 'processing') && t.taskId) {
              if (!activePollingOutfitTasksRef.current[t.taskId]) {
                activePollingOutfitTasksRef.current[t.taskId] = true;
                toast.info('⏳ 检测到正在运行的 AI 试衣任务，已自动接管后台轮询');
                pollPendingOutfitTask(targetProj.id, t.taskId);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to recover recent outfit tasks:', e);
        }
      };
  
      recoverOutfitTasks();
    // Recovery is intentionally triggered once after persisted configuration loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConfigLoaded]);
  
    const activePollingTasksRef = useRef<{ [storyboardId: string]: boolean }>({});
  
    const resumeStoryboardVideoPolling = async (projId: string, sbId: string, taskId: string) => {
      activePollingTasksRef.current[sbId] = true;
      console.log(`[Resume Polling] Starting polling loop for storyboard ${sbId}, task ID: ${taskId}`);
  
      try {
        const currentVideoModel = videoModel || 'Kling-V3-omni';
        const pollIntervalMs = currentVideoModel.includes('veo') ? 4000 : 3000;
        const maxPolls = (videoDuration === '15s' || videoDuration === '3s') ? 300 : (currentVideoModel.includes('veo') ? 150 : 200);
        const estimatedAttempts = (videoDuration === '15s' || videoDuration === '3s') ? 100 : (currentVideoModel.includes('veo') ? 60 : 20);
  
        await waitForVideoTask({
          taskId,
          intervalMs: pollIntervalMs,
          maxAttempts: maxPolls,
          estimatedAttempts,
          recovering: true,
          isCancelled: () => !!cancelledProjectsRef.current[projId],
          onProgress: progress => {
            const visibleProgress = Math.min(progress, 90);
            setProjects(prev => prev.map(p => p.id !== projId ? p : {
              ...p,
              storyboards: p.storyboards.map(s => s.id === sbId ? { ...s, progress: visibleProgress } : s)
            }));
            if (projId === activeProjectIdRef.current) {
              setStoryboards(prev => prev.map(s => s.id === sbId ? { ...s, progress: visibleProgress } : s));
            }
          }
        });
  
        const videoBlob = await getVideoContent(gatewayVideoUrl, gatewayVideoToken, taskId);
        const localVideoUrl = URL.createObjectURL(videoBlob);
  
        setProjects(prev => prev.map(p => p.id !== projId ? p : {
          ...p,
          storyboards: p.storyboards.map(s => s.id === sbId ? {
            ...s,
            videoSrc: localVideoUrl,
            videoBlob,
            isGeneratingVideo: false,
            progress: 100,
            videoTaskId: taskId
          } : s)
        }));
  
        if (projId === activeProjectIdRef.current) {
          setStoryboards(prev => prev.map(s => s.id === sbId ? {
            ...s,
            videoSrc: localVideoUrl,
            videoBlob,
            isGeneratingVideo: false,
            progress: 100,
            videoTaskId: taskId
          } : s));
        }
  
        toast.success('🎉 分镜视频片段已生成完成并恢复！');
  
        setProjects(prev => {
          const proj = prev.find(p => p.id === projId);
          if (proj && !proj.storyboards.some(s => s.id !== sbId && s.isGeneratingVideo)) {
            return prev.map(p => p.id === projId ? { ...p, i2vStep: 'video_generated' as const, isI2vGenerating: false } : p);
          }
          return prev;
        });
  
        if (projId === activeProjectIdRef.current) {
          setI2vStep('video_generated');
          setIsI2vGenerating(false);
        }
  
      } catch (err) {
        console.error(`[Resume Polling Error] Storyboard ${sbId} failed:`, err);
        
        setProjects(prev => prev.map(p => {
          if (p.id !== projId) return p;
          return {
            ...p,
            storyboards: p.storyboards.map(s => s.id === sbId ? {
              ...s,
              isGeneratingVideo: false,
              progress: 0,
              videoTaskId: taskId
            } : s)
          };
        }));
  
        if (projId === activeProjectIdRef.current) {
          setStoryboards(prev => prev.map(s => s.id === sbId ? {
            ...s,
            isGeneratingVideo: false,
            progress: 0,
            videoTaskId: taskId
          } : s));
        }
  
        // Check if this was the last pending one to clean up isI2vGenerating status
        setProjects(prev => {
          const proj = prev.find(p => p.id === projId);
          if (proj) {
            const stillGenerating = proj.storyboards.some(s => s.isGeneratingVideo);
            if (!stillGenerating) {
              return prev.map(p => p.id === projId ? {
                ...p,
                isI2vGenerating: false
              } : p);
            }
          }
          return prev;
        });
  
        if (projId === activeProjectIdRef.current) {
          setIsI2vGenerating(false);
        }
      } finally {
        delete activePollingTasksRef.current[sbId];
      }
    };
  
    useEffect(() => {
      if (!isConfigLoaded || projects.length === 0) return;
  
      let restoredCount = 0;
      // Check all storyboards across all projects to resume polling or recover completed videos
      projects.forEach(proj => {
        proj.storyboards.forEach(sb => {
          if (sb.videoTaskId && !sb.videoSrc && !activePollingTasksRef.current[sb.id]) {
            restoredCount++;
            resumeStoryboardVideoPolling(proj.id, sb.id, sb.videoTaskId);
          }
        });
      });
  
      if (restoredCount > 0) {
        toast.info(`⏳ 检测到 ${restoredCount} 个正在生成或待接收的视频分镜，已自动接管后台轮询`);
      }
    // Project changes are the recovery scan trigger; the polling function uses the latest render snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConfigLoaded, projects]);
}
