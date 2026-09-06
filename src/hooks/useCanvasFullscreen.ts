import { useCallback, useEffect, useState } from 'react';

interface Options {
  controlledValue?: boolean;
  onControlledChange?: (value: boolean) => void;
  isPlaying: boolean;
  setIsPlaying: (value: boolean) => void;
}

export function useCanvasFullscreen({ controlledValue, onControlledChange, isPlaying, setIsPlaying }: Options) {
  const [localValue, setLocalValue] = useState(false);
  const isFullscreen = controlledValue ?? localValue;
  const setFullscreen = onControlledChange ?? setLocalValue;
  const enterFullscreen = useCallback(() => {
    setFullscreen(true);
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, [setFullscreen]);
  const exitFullscreen = useCallback(() => {
    setFullscreen(false);
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
  }, [setFullscreen]);
  useEffect(() => {
    const sync = () => { if (!document.fullscreenElement && isFullscreen) setFullscreen(false); };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [isFullscreen, setFullscreen]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!isFullscreen) return;
      if (event.key === 'Escape') exitFullscreen();
      const target = event.target as HTMLElement;
      if (event.code === 'Space' && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') { event.preventDefault(); setIsPlaying(!isPlaying); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [exitFullscreen, isFullscreen, isPlaying, setIsPlaying]);
  return { isFullscreen, enterFullscreen, exitFullscreen };
}
