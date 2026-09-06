import { useCallback } from 'react';

type Confirm = (title: string, message: string, onConfirm: () => void) => void;

interface LocalMediaActionsOptions {
  enabled: boolean;
  importLocalAudio: () => Promise<number>;
  importLocalVideos: () => Promise<number>;
  deleteLocalVideo: (id: string) => Promise<void>;
  showConfirm: Confirm;
}

export function useLocalMediaActions(options: LocalMediaActionsOptions) {
  const importAudio = useCallback(async () => {
    if (!options.enabled) return;
    try {
      const count = await options.importLocalAudio();
      if (count > 0) alert(`成功导入 ${count} 首本地音乐！`);
    } catch (error) {
      console.error('Failed to import local audio:', error);
      alert(`导入本地音频失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [options]);

  const importVideos = useCallback(async () => {
    if (!options.enabled) return;
    try {
      const count = await options.importLocalVideos();
      if (count > 0) alert(`成功导入 ${count} 个本地视频素材！`);
    } catch (error) {
      console.error('Failed to import local video:', error);
      alert(`导入本地视频失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [options]);

  const removeVideo = useCallback((event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    options.showConfirm('删除本地视频', '确定要从本地素材库中删除该视频吗？', () => {
      void options.deleteLocalVideo(id).catch(error => {
        console.error('Failed to delete local video:', error);
        alert(`删除失败: ${error instanceof Error ? error.message : String(error)}`);
      });
    });
  }, [options]);

  return { importAudio, importVideos, removeVideo };
}
