import { useState, useEffect, useRef, useCallback } from 'react';
import type { StoryboardItem } from '../types/aiProject';
import type { Layer } from '../components/VideoCanvas';
import {
  submitBatchVideoTasks,
  fetchProjectVideoTasks,
  type BatchVideoShotItem,
} from '../services/videoBatchTaskService';
import { pollVideoTask } from '../utils/aiGateway';
import { parseFiveShotPrompt } from '../services/storyboardPromptParser';
import { toast } from '../components/toastStore';

export interface QueueShotTask {
  shotId: string;
  shotIndex: number;
  shotName: string;
  imageSrc: string;
  prompt: string;
  taskId: string | null;
  status: 'idle' | 'submitting' | 'processing' | 'completed' | 'failed';
  progress: number;
  resultUrl?: string;
  error?: string;
  createdAt?: number;
}

function normalizeQueueStatus(status?: string): QueueShotTask['status'] {
  if (status === 'pending' || status === 'processing') return 'processing';
  if (status === 'completed' || status === 'failed') return status;
  return 'idle';
}

interface UseBatchVideoQueueOptions {
  activeProjectId: string;
  storyboards: StoryboardItem[];
  setProjectStoryboards: (projectId: string, updater: StoryboardItem[] | ((prev: StoryboardItem[]) => StoryboardItem[])) => void;
  layers?: Layer[];
  setLayers?: React.Dispatch<React.SetStateAction<Layer[]>>;
  commitHistory?: (layers: Layer[], desc: string) => void;
}

export function useBatchVideoQueue(options: UseBatchVideoQueueOptions) {
  const { activeProjectId, storyboards, setProjectStoryboards, setLayers, commitHistory } = options;

  const [queueTasks, setQueueTasks] = useState<QueueShotTask[]>([]);
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const pollerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Synchronize / Initialize queue with storyboards or server history on project switch
  useEffect(() => {
    if (!activeProjectId) return;

    let isSubscribed = true;
    fetchProjectVideoTasks(activeProjectId).then(serverTasks => {
      if (!isSubscribed) return;

      const serverTaskByShot = new Map<string, typeof serverTasks[0]>();
      serverTasks.forEach(st => {
        if (st.shotId && !serverTaskByShot.has(st.shotId)) {
          serverTaskByShot.set(st.shotId, st);
        }
      });

      const initialQueue: QueueShotTask[] = storyboards.map((sb, idx) => {
        const matchingServerTask = serverTaskByShot.get(sb.id);
        const hasCompletedVideo = Boolean(sb.videoSrc || (matchingServerTask?.status === 'completed' && matchingServerTask.resultUrl));

        return {
          shotId: sb.id,
          shotIndex: idx + 1,
          shotName: sb.name || `分镜 ${idx + 1}`,
          imageSrc: sb.imageSrc,
          prompt: '',
          taskId: matchingServerTask?.taskId || sb.videoTaskId || null,
          status: hasCompletedVideo ? 'completed' : normalizeQueueStatus(matchingServerTask?.status),
          progress: hasCompletedVideo ? 100 : (matchingServerTask?.status === 'processing' ? 60 : 0),
          resultUrl: sb.videoSrc || matchingServerTask?.resultUrl,
          error: matchingServerTask?.error || undefined,
          createdAt: matchingServerTask?.createdAt
        };
      });

      setQueueTasks(initialQueue);
    });

    return () => {
      isSubscribed = false;
    };
  }, [activeProjectId, storyboards]);

  // 2. Active Polling Loop for In-Progress Tasks
  useEffect(() => {
    const hasActiveTasks = queueTasks.some(t => t.status === 'processing' || t.status === 'submitting');
    setIsBatchGenerating(hasActiveTasks);

    if (!hasActiveTasks) {
      if (pollerTimerRef.current) {
        clearInterval(pollerTimerRef.current);
        pollerTimerRef.current = null;
      }
      return;
    }

    if (!pollerTimerRef.current) {
      pollerTimerRef.current = setInterval(async () => {
        setQueueTasks(prevTasks => {
          const activeTasks = prevTasks.filter(t => (t.status === 'processing' || t.status === 'submitting') && t.taskId);
          if (activeTasks.length === 0) return prevTasks;

          // Poll each active task in parallel
          activeTasks.forEach(async (task) => {
            if (!task.taskId) return;
            try {
              const res = await pollVideoTask('', '', task.taskId);
              if (res.status === 'completed' && res.resultUrl) {
                const resultUrl = res.resultUrl;
                // Update local task state
                setQueueTasks(curr => curr.map(t => t.shotId === task.shotId ? {
                  ...t,
                  status: 'completed',
                  progress: 100,
                  resultUrl
                } : t));

                // Backfill to active storyboards
                setProjectStoryboards(activeProjectId, (prevSb) =>
                  prevSb.map(sb => sb.id === task.shotId ? {
                    ...sb,
                    videoSrc: resultUrl,
                    videoTaskId: task.taskId || undefined,
                    isGeneratingVideo: false,
                    progress: 100
                  } : sb)
                );

                toast.success(`🎉 「${task.shotName}」视频生成完成！`);
              } else if (res.status === 'failed') {
                setQueueTasks(curr => curr.map(t => t.shotId === task.shotId ? {
                  ...t,
                  status: 'failed',
                  error: res.error || '生成失败'
                } : t));
                toast.error(`⚠️ 「${task.shotName}」生成失败: ${res.error || '大模型渲染超时'}`);
              } else {
                // Advance progress gracefully
                setQueueTasks(curr => curr.map(t => t.shotId === task.shotId ? {
                  ...t,
                  progress: Math.min(95, t.progress + 6)
                } : t));
              }
            } catch (pollErr) {
              console.warn(`Polling task ${task.taskId} blip:`, pollErr);
            }
          });

          return prevTasks;
        });
      }, 3500);
    }

    return () => {
      if (pollerTimerRef.current) {
        clearInterval(pollerTimerRef.current);
        pollerTimerRef.current = null;
      }
    };
  }, [queueTasks, activeProjectId, setProjectStoryboards]);

  // 3. Trigger 5-Shot Batch Video Generation
  const startBatchGeneration = useCallback(async (
    targetStoryboards: StoryboardItem[],
    masterPrompt15s: string,
    config: {
      model?: string;
      duration?: '3s' | '15s';
      sceneDesc?: string;
      activeBackgroundUrl?: string;
    } = {}
  ) => {
    if (!activeProjectId || targetStoryboards.length === 0) {
      toast.warning('当前暂无可用的分镜画面');
      return;
    }

    const parsedPrompts = parseFiveShotPrompt(masterPrompt15s || '');
    const defaultPrompts = [
      '镜头一：模特正面全身站姿展示，面料垂坠柔顺，微风吹拂',
      '镜头二：45度优雅侧身漫步，回眸微笑，光影立体自然',
      '镜头三：领口与剪裁微距特写，高定质感与缝线细节毕现',
      '镜头四：背面走秀定格，廓形与版型优雅舒展',
      '镜头五：全身定点自信定格，商业级高级光影氛围'
    ];

    const batchShots: BatchVideoShotItem[] = targetStoryboards.map((sb, idx) => {
      const shotKey = (sb.shotType as keyof typeof parsedPrompts) || `shot-${idx + 1}`;
      const prompt = parsedPrompts[shotKey] || defaultPrompts[idx] || `${sb.name} 高级时尚电商模特走秀展示`;

      return {
        id: sb.id,
        name: sb.name || `分镜 ${idx + 1}`,
        prompt: `${prompt}。8k resolution, cinematic lighting, photorealistic fabric physics, smooth continuous camera movement.`,
        imageSrc: sb.imageSrc,
        seconds: (config.duration === '15s' || config.duration === '3s') ? 3 : 4
      };
    });

    // Mark all target tasks as submitting in UI
    setQueueTasks(() => {
      const shotMap = new Map(batchShots.map(s => [s.id, s]));
      return targetStoryboards.map((sb, idx) => ({
        shotId: sb.id,
        shotIndex: idx + 1,
        shotName: sb.name,
        imageSrc: sb.imageSrc,
        prompt: shotMap.get(sb.id)?.prompt || '',
        taskId: null,
        status: 'submitting',
        progress: 15
      }));
    });

    setIsBoardOpen(true);
    setIsBatchGenerating(true);
    toast.info(`🚀 已发起 5 幕分镜全并发生成队列...`);

    try {
      const results = await submitBatchVideoTasks({
        projectId: activeProjectId,
        shots: batchShots,
        model: config.model,
        seconds: 3
      });

      setQueueTasks(prev => prev.map(t => {
        const res = results.find(r => r.shotId === t.shotId);
        if (!res) return t;
        return {
          ...t,
          taskId: res.taskId,
          status: res.status === 'processing' ? 'processing' : 'failed',
          progress: res.status === 'processing' ? 30 : 0,
          error: res.error
        };
      }));

      // Update storyboards state to reflect generating status
      setProjectStoryboards(activeProjectId, prev => prev.map(sb => {
        const res = results.find(r => r.shotId === sb.id);
        return {
          ...sb,
          videoTaskId: res?.taskId || undefined,
          isGeneratingVideo: res?.status === 'processing',
          progress: res?.status === 'processing' ? 30 : 0
        };
      }));

      toast.success(`✓ 5 幕分镜任务已全部在后台并发运行中！可在任务看板查看`);
    } catch (err) {
      console.error('Batch generation failed:', err);
      toast.error(`批量提交失败: ${err instanceof Error ? err.message : String(err)}`);
      setQueueTasks(prev => prev.map(t => ({ ...t, status: 'failed', error: '提交失败' })));
    }
  }, [activeProjectId, setProjectStoryboards]);

  // 4. Retry single shot
  const retrySingleShot = useCallback(async (shotId: string, model?: string) => {
    const task = queueTasks.find(t => t.shotId === shotId);
    if (!task || !activeProjectId) return;

    setQueueTasks(curr => curr.map(t => t.shotId === shotId ? {
      ...t,
      status: 'submitting',
      progress: 15,
      error: undefined
    } : t));

    try {
      const results = await submitBatchVideoTasks({
        projectId: activeProjectId,
        shots: [{
          id: task.shotId,
          name: task.shotName,
          prompt: task.prompt || `${task.shotName} 高级电商模特展示`,
          imageSrc: task.imageSrc,
          seconds: 3
        }],
        model
      });

      const res = results[0];
      if (res && res.taskId) {
        setQueueTasks(curr => curr.map(t => t.shotId === shotId ? {
          ...t,
          taskId: res.taskId,
          status: 'processing',
          progress: 30
        } : t));
        toast.info(`已重新发起「${task.shotName}」生成任务`);
      } else {
        throw new Error(res?.error || '任务提交失败');
      }
    } catch (err) {
      setQueueTasks(curr => curr.map(t => t.shotId === shotId ? {
        ...t,
        status: 'failed',
        error: String(err)
      } : t));
      toast.error(`重试失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [queueTasks, activeProjectId]);

  // 5. Batch import completed video shots to timeline
  const applyAllCompletedToTimeline = useCallback(() => {
    if (!setLayers) {
      toast.warning('时间轴图层控制器未连接');
      return;
    }

    const readyTasks = queueTasks.filter(t => t.status === 'completed' && t.resultUrl);
    if (readyTasks.length === 0) {
      toast.warning('当前暂无已生成的成片可导入时间轴');
      return;
    }

    const shotDuration = 3;
    const newMediaLayers: Layer[] = readyTasks.map((t, idx) => ({
      id: `layer_batch_video_${Date.now()}_${idx}`,
      type: 'media',
      name: `分镜 ${t.shotIndex}: ${t.shotName}`,
      start: idx * shotDuration,
      end: (idx + 1) * shotDuration,
      visible: true,
      x: 50,
      y: 50,
      scale: 1,
      opacity: 1,
      properties: {
        src: t.resultUrl,
        isVideo: true,
        transitionType: idx > 0 ? 'fade' : 'none',
        transitionDuration: 0.5
      }
    }));

    setLayers(prev => {
      const nonMedia = prev.filter(l => l.type !== 'media');
      const merged = [...newMediaLayers, ...nonMedia];
      if (commitHistory) {
        commitHistory(merged, `批量导入 ${readyTasks.length} 个分镜视频至时间轴`);
      }
      return merged;
    });

    toast.success(`🎬 已成功将 ${readyTasks.length} 个分镜视频依序装配至时间轴画面轨！`);
    setIsBoardOpen(false);
  }, [queueTasks, setLayers, commitHistory]);

  const activeCount = queueTasks.filter(t => t.status === 'processing' || t.status === 'submitting').length;
  const completedCount = queueTasks.filter(t => t.status === 'completed').length;

  return {
    queueTasks,
    isBoardOpen,
    setIsBoardOpen,
    isBatchGenerating,
    activeCount,
    completedCount,
    startBatchGeneration,
    retrySingleShot,
    applyAllCompletedToTimeline
  };
}
