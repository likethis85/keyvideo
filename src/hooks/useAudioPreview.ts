import { useCallback, useEffect, useRef, useState } from 'react';

export function useAudioPreview(resetKey: string) {
  const [previewAudioSrc, setPreviewAudioSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPreviewAudioSrc(null);
  }, []);

  const togglePreviewAudio = useCallback((event: React.MouseEvent, src: string) => {
    event.stopPropagation();
    if (previewAudioSrc === src) {
      stop();
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.onended = stop;
    void audio.play().catch(error => console.error('Audio preview failed:', error));
    audioRef.current = audio;
    setPreviewAudioSrc(src);
  }, [previewAudioSrc, stop]);

  useEffect(() => stop, [resetKey, stop]);

  return { previewAudioSrc, togglePreviewAudio };
}
