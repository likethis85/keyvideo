import { useCallback, useState } from 'react';
import type { StoryboardItem } from '../types/aiProject';
import { getRecentTasks } from '../utils/aiGateway';

type StoryboardUpdater = StoryboardItem[] | ((previous: StoryboardItem[]) => StoryboardItem[]);

interface RecentStoryboardRecoveryOptions {
  activeProjectId: string;
  setProjectStoryboards: (projectId: string, updater: StoryboardUpdater) => void;
  setProjectIsStoryboardGenerating: (projectId: string, generating: boolean) => void;
}

export function useRecentStoryboardRecovery(options: RecentStoryboardRecoveryOptions) {
  const [isFetchingRecent, setIsFetchingRecent] = useState(false);

  const fetchRecentTasks = useCallback(async () => {
    if (!options.activeProjectId) return;
    setIsFetchingRecent(true);
    try {
      const recentTasks = await getRecentTasks(options.activeProjectId);
      const completed = recentTasks.filter(task => task.type !== 'video' && task.status === 'completed' && task.resultUrl);
      if (completed.length === 0) {
        alert('ℹ️ 服务器后台未查找到已完成的生成记录，若任务刚提交请稍等片刻再点击。');
        return;
      }

      options.setProjectStoryboards(options.activeProjectId, previous => previous.length === 0
        ? completed.slice(0, 5).map((task, index): StoryboardItem => ({
          id: `storyboard_recovered_${task.taskId || index}`,
          name: `分镜 ${index + 1} (恢复生成)`,
          shotType: `shot-${Math.min(index + 1, 5)}` as StoryboardItem['shotType'],
          imageSrc: task.resultUrl || '',
          videoSrc: null,
          isGeneratingVideo: false,
          progress: 0,
          isGeneratingImage: false
        }))
        : previous.map((storyboard, index) => ({
          ...storyboard,
          imageSrc: (completed[index] || completed[0]).resultUrl || storyboard.imageSrc,
          isGeneratingImage: false
        })));
      options.setProjectIsStoryboardGenerating(options.activeProjectId, false);
      alert('🎉 已成功从服务器后台拉取并接收生成好的图片！');
    } catch (error) {
      alert(`拉取后台结果失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFetchingRecent(false);
    }
  }, [options]);

  return { isFetchingRecent, fetchRecentTasks };
}
