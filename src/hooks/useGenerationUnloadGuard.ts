import { useEffect } from 'react';

export function useGenerationUnloadGuard(isGenerating: boolean) {
  useEffect(() => {
    if (!isGenerating) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '生成任务正在进行中，关闭页面将中断任务。确定要离开吗？';
      return event.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isGenerating]);
}
