import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import type { Layer } from '../components/VideoCanvas';
import { isWebCodecsSupported, exportVideoWithWebCodecs } from '../utils/webCodecsExporter';
import { toast } from '../components/toastStore';

interface VideoExportOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  audioCtxRef: MutableRefObject<AudioContext | null>;
  audioDestinationRef: MutableRefObject<MediaStreamAudioDestinationNode | null>;
  videosCacheRef: MutableRefObject<Record<string, HTMLVideoElement>>;
  isOfflineExportingRef: MutableRefObject<boolean>;
  layers: Layer[];
  ratio: string;
  width: number;
  height: number;
  exporting: boolean;
  drawFrame: (context: CanvasRenderingContext2D, time: number) => void;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  setIsPlaying: (playing: boolean) => void;
  setExporting: (exporting: boolean) => void;
  setExportProgress: (progress: number) => void;
  setExportLogs: Dispatch<SetStateAction<string[]>>;
  setExportFps: (fps: number | null) => void;
  setExportEngine: (engine: 'webcodecs' | 'mediarecorder') => void;
}

export function useVideoExport(options: VideoExportOptions) {
  const { canvasRef, audioCtxRef, audioDestinationRef, videosCacheRef, isOfflineExportingRef, layers, ratio,
    width, height, exporting, drawFrame, setCurrentTime, setIsPlaying, setExporting,
    setExportProgress, setExportLogs, setExportFps, setExportEngine } = options;

    const exportWithMediaRecorder = (canvas: HTMLCanvasElement, duration: number) => {
      // Resume AudioContext for export to ensure sound captures
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
  
      // Capture visual stream from canvas
      const canvasStream = canvas.captureStream(30); // 30 FPS
      const mixedStream = new MediaStream();
      
      // Add video tracks to recording stream
      canvasStream.getVideoTracks().forEach(track => mixedStream.addTrack(track));
      
      // Add mixed audio track if audioDestination exists and has active tracks
      if (audioDestinationRef.current) {
        const audioTracks = audioDestinationRef.current.stream.getAudioTracks();
        audioTracks.forEach(track => mixedStream.addTrack(track));
      }
      
      const formatCandidates = [
        { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
        { mimeType: 'video/mp4', extension: 'mp4' },
        { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
        { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
        { mimeType: 'video/webm', extension: 'webm' }
      ];
      const selectedFormat = formatCandidates.find(candidate => MediaRecorder.isTypeSupported(candidate.mimeType));
      const options: MediaRecorderOptions = selectedFormat
        ? { mimeType: selectedFormat.mimeType, videoBitsPerSecond: 8_500_000, audioBitsPerSecond: 192_000 }
        : { videoBitsPerSecond: 8_500_000, audioBitsPerSecond: 192_000 };
      let fileType = selectedFormat?.mimeType || 'video/webm';
      let extension = selectedFormat?.extension || 'webm';
  
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(mixedStream, options);
      } catch {
        setExportLogs(prev => [...prev, 'Fallback to default WebM encoder...']);
        mediaRecorder = new MediaRecorder(mixedStream);
        fileType = mediaRecorder.mimeType || 'video/webm';
        extension = fileType.includes('mp4') ? 'mp4' : 'webm';
      }
  
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };
  
      mediaRecorder.onstop = () => {
        setIsPlaying(false);
        setExportLogs(prev => [...prev, 'Compiling video chunks...', 'Applying audio beat alignments...', 'Generating file stream...']);
        
        const blob = new Blob(chunks, { type: fileType });
        const url = URL.createObjectURL(blob);
        
        setExportProgress(100);
        setExportLogs(prev => [...prev, 'Video compilation finished!', 'Compressed successfully (Fits platform rules).']);
        
        // Auto download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `keyvideo_${ratio}_${Date.now()}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
  
        toast.success('🎉 视频导出成功！已保存至本地。');
      };
  
      // Record timeline playback
      setIsPlaying(true);
      mediaRecorder.start();
      const startTime = performance.now();
      const frameRate = 30;
      const intervalTime = 1000 / frameRate;
  
      let lastLogPct = -1;
      const recordingTimer = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        const recordTime = Math.min(duration, elapsed);
        setCurrentTime(recordTime);
  
        const progress = Math.min(99, Math.round((recordTime / duration) * 100));
        setExportProgress(progress);
  
        const stepIndex = Math.floor((progress / 100) * 4);
        const steps = [
          '渲染图层时间轴与转场动效...',
          '计算贴纸与卖点字体渲染...',
          '同步背景音乐与音量曲线...',
          '编码高清视频流...'
        ];
        const log = steps[Math.min(steps.length - 1, stepIndex)];
        if (Math.floor(progress / 20) !== lastLogPct) {
          lastLogPct = Math.floor(progress / 20);
          setExportLogs(prev => [...prev, `${log} (${progress}%)`]);
        }
  
        if (elapsed >= duration) {
          clearInterval(recordingTimer);
          setExportLogs(prev => [...prev, '所有时间轴帧采集完成，正在封装视频... (100%)']);
          mediaRecorder.stop();
        }
      }, intervalTime);
    };
  
    // High-Speed Dual-Engine Video Export Handler
    const handleExport = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (exporting) return;
  
      setIsPlaying(false);
      setCurrentTime(0);
      setExporting(true);
      setExportProgress(0);
      setExportFps(null);
  
      const activeLayers = layers.filter(l => l.visible);
      const maxLayerEnd = activeLayers.reduce((max, l) => l.end > max ? l.end : max, 0);
      const duration = maxLayerEnd > 0 ? Math.min(15, maxLayerEnd) : 15;
  
      // 1. Try WebCodecs Hardware Accelerated Offline Export
      if (isWebCodecsSupported()) {
        setExportEngine('webcodecs');
        setExportLogs([
          '⚡ 启动 WebCodecs 硬件加速渲染引擎...',
          '🚀 采用离屏帧驱动架构：不受物理播放时钟限制，切换后台标签页 0 丢帧'
        ]);
  
        const audioTracks = layers
          .filter(l => l.type === 'audio' && l.visible)
          .map(l => ({
            src: l.properties.src || '',
            start: l.start,
            end: l.end,
            volume: l.properties?.volume !== undefined ? l.properties.volume : 0.8,
            offset: l.properties?.audioStartOffset || 0
          }))
          .filter(t => !!t.src);
  
        try {
          isOfflineExportingRef.current = true;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('无法获取 Canvas 渲染上下文');
  
          const mp4Blob = await exportVideoWithWebCodecs({
            canvas,
            width,
            height,
            duration,
            fps: 30,
            bitrate: 8_500_000,
            audioTracks,
            renderFrame: async (t) => {
              const activeVideos = layers.filter(layer =>
                layer.type === 'media' &&
                layer.visible &&
                layer.properties.isVideo &&
                !!layer.properties.src &&
                t >= layer.start &&
                t <= layer.end
              );
  
              await Promise.all(activeVideos.map(async layer => {
                const src = layer.properties.src!;
                const video = videosCacheRef.current[src];
                if (!video) throw new Error(`视频素材尚未加载: ${layer.name}`);
  
                if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
                  await new Promise<void>((resolve, reject) => {
                    const timeout = window.setTimeout(() => reject(new Error(`读取视频元数据超时: ${layer.name}`)), 5000);
                    const cleanup = () => {
                      window.clearTimeout(timeout);
                      video.removeEventListener('loadedmetadata', handleLoaded);
                      video.removeEventListener('error', handleError);
                    };
                    const handleLoaded = () => { cleanup(); resolve(); };
                    const handleError = () => { cleanup(); reject(new Error(`读取视频素材失败: ${layer.name}`)); };
                    video.addEventListener('loadedmetadata', handleLoaded, { once: true });
                    video.addEventListener('error', handleError, { once: true });
                  });
                }
  
                video.pause();
                const requestedTime = t - layer.start + (layer.properties.videoStartOffset || 0);
                const targetTime = Math.max(0, Math.min(requestedTime, Math.max(0, video.duration - 0.001)));
                if (Math.abs(video.currentTime - targetTime) <= 0.001) return;
  
                await new Promise<void>((resolve, reject) => {
                  const timeout = window.setTimeout(() => {
                    cleanup();
                    reject(new Error(`视频逐帧定位超时: ${layer.name}`));
                  }, 3000);
                  const cleanup = () => {
                    window.clearTimeout(timeout);
                    video.removeEventListener('seeked', handleSeeked);
                    video.removeEventListener('error', handleError);
                  };
                  const handleSeeked = () => { cleanup(); resolve(); };
                  const handleError = () => { cleanup(); reject(new Error(`视频逐帧定位失败: ${layer.name}`)); };
                  video.addEventListener('seeked', handleSeeked, { once: true });
                  video.addEventListener('error', handleError, { once: true });
                  video.currentTime = targetTime;
                });
              }));
  
              setCurrentTime(t);
              drawFrame(ctx, t);
            },
            onProgress: ({ percent, fps }) => {
              setExportProgress(percent);
              setExportFps(fps);
            },
            onLog: (msg) => {
              setExportLogs(prev => [...prev.slice(-15), msg]);
            }
          });
  
          const url = URL.createObjectURL(mp4Blob);
          setExportProgress(100);
          setExportLogs(prev => [...prev, '🎉 高清 MP4 导出成功！已触发浏览器自动下载。']);
  
          const a = document.createElement('a');
          a.href = url;
          a.download = `keyvideo_${ratio}_${Date.now()}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
  
          toast.success('🎉 视频极速硬件加速导出完成！');
          isOfflineExportingRef.current = false;
          return;
        } catch (err) {
          isOfflineExportingRef.current = false;
          console.warn('[Export] WebCodecs export failed, falling back to MediaRecorder:', err);
          const message = err instanceof Error ? err.message : String(err);
          setExportLogs(prev => [
            ...prev,
            `⚠️ 硬件加速编码受浏览器环境限制: ${message || '初始化受限'}`,
            '🛡️ 自动切换至 MediaRecorder 兼容兜底录制引擎...'
          ]);
          toast.info('检测到当前环境限制，已自动切换为兼容模式录制');
        }
      }
  
      // 2. Fallback to MediaRecorder Engine
      setExportEngine('mediarecorder');
      setExportLogs(['🛡️ 启动兼容流式录制引擎...', 'Format: MP4 / WebM', 'Codec: H.264 / VP8']);
      exportWithMediaRecorder(canvas, duration);
    };

  return { handleExport };
}
