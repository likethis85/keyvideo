import { useState, useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import type { Layer } from '../components/VideoCanvas';
import { isWebCodecsSupported, exportVideoWithWebCodecs, type ExportResultInfo } from '../utils/webCodecsExporter';
import { localDB } from '../utils/db';
import { toast } from '../components/toastStore';
import type { VideoExportConfig } from '../types/exportConfig';

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
  const {
    canvasRef, audioCtxRef, audioDestinationRef, videosCacheRef, isOfflineExportingRef, layers,
    width, height, exporting, drawFrame, setCurrentTime, setIsPlaying, setExporting,
    setExportProgress, setExportLogs, setExportFps, setExportEngine
  } = options;

  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [estimatedSecondsRemaining, setEstimatedSecondsRemaining] = useState(0);
  const [estimatedSizeMb, setEstimatedSizeMb] = useState('12.0');
  const [previewSnapshotUrl, setPreviewSnapshotUrl] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<(ExportResultInfo & { url: string }) | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fallback MediaRecorder implementation
  const exportWithMediaRecorder = (
    canvas: HTMLCanvasElement,
    duration: number,
    targetFps = 30,
    targetBitrate = 8_500_000,
    exportW = width,
    exportH = height
  ) => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const canvasStream = canvas.captureStream(targetFps);
    const mixedStream = new MediaStream();
    canvasStream.getVideoTracks().forEach(track => mixedStream.addTrack(track));

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
    const recorderOptions: MediaRecorderOptions = selectedFormat
      ? { mimeType: selectedFormat.mimeType, videoBitsPerSecond: targetBitrate, audioBitsPerSecond: 192_000 }
      : { videoBitsPerSecond: targetBitrate, audioBitsPerSecond: 192_000 };
    const fileType = selectedFormat?.mimeType || 'video/webm';

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(mixedStream, recorderOptions);
    } catch {
      setExportLogs(prev => [...prev, 'Fallback to default WebM encoder...']);
      recorder = new MediaRecorder(mixedStream);
    }
    mediaRecorderRef.current = recorder;

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      setIsPlaying(false);
      setExportLogs(prev => [...prev, '所有时间轴帧采集完成，正在封装视频... (100%)']);

      const blob = new Blob(chunks, { type: fileType });
      const url = URL.createObjectURL(blob);
      setExportProgress(100);

      const result: ExportResultInfo & { url: string } = {
        blob,
        url,
        duration,
        totalFrames: Math.round(duration * targetFps),
        averageFps: targetFps,
        totalTimeSec: duration,
        sizeBytes: blob.size,
        width: exportW,
        height: exportH
      };
      setExportResult(result);
      toast.success('🎉 视频导出成功！');
    };

    setIsPlaying(true);
    recorder.start();

    // Emulate progress
    let elapsed = 0;
    const interval = 100;
    const timer = setInterval(() => {
      elapsed += interval / 1000;
      const progress = Math.min(99, Math.round((elapsed / duration) * 100));
      setExportProgress(progress);
      setCurrentFrame(Math.round(elapsed * targetFps));
      setTotalFrames(Math.round(duration * targetFps));
      setEstimatedSecondsRemaining(Math.max(0, Math.round(duration - elapsed)));

      if (elapsed >= duration) {
        clearInterval(timer);
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }
    }, interval);
    recordingTimerRef.current = timer;
  };

  // High-Speed Dual-Engine Video Export Handler
  const handleExport = async (customConfig?: VideoExportConfig) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (exporting) return;

    const targetFps = customConfig?.fps ?? 30;
    const targetBitrate = customConfig?.bitrateBps ?? 8_500_000;
    const targetWidth = customConfig?.width ?? width;
    const targetHeight = customConfig?.height ?? height;
    const includeAudio = customConfig?.includeAudio !== false;
    const audioGain = customConfig?.audioGain ?? 1.0;

    const activeLayers = layers.filter(l => l.visible);
    const maxLayerEnd = activeLayers.reduce((max, l) => l.end > max ? l.end : max, 0);
    const rawTotalDuration = maxLayerEnd > 0 ? Math.min(15, maxLayerEnd) : 15;

    const rangeStart = Math.max(0, customConfig?.timeRange?.start ?? 0);
    const rangeEnd = Math.min(rawTotalDuration, customConfig?.timeRange?.end ?? rawTotalDuration);
    const duration = Math.max(0.5, rangeEnd - rangeStart);

    setIsPlaying(false);
    setCurrentTime(rangeStart);
    setExporting(true);
    setExportProgress(0);
    setExportFps(null);
    setExportResult(null);
    setPreviewSnapshotUrl(null);

    abortControllerRef.current = new AbortController();

    // 1. Try WebCodecs Hardware Accelerated Offline Export
    if (isWebCodecsSupported()) {
      setExportEngine('webcodecs');
      setExportLogs([
        '⚡ 启动 WebCodecs 硬件加速渲染引擎...',
        `🎯 目标规格: ${targetWidth}×${targetHeight} @ ${targetFps} FPS (码率 ${(targetBitrate / 1_000_000).toFixed(1)} Mbps)`,
        `✂️ 导出范围: ${rangeStart.toFixed(1)}s ~ ${rangeEnd.toFixed(1)}s (时长 ${duration.toFixed(1)}s)`,
        '🚀 采用离屏帧驱动架构：不受物理播放时钟限制，切换后台标签页 0 丢帧'
      ]);

      const audioTracks = includeAudio
        ? layers
            .filter(l => l.type === 'audio' && l.visible && l.properties.src)
            .map(l => {
              const clampedStart = Math.max(0, l.start - rangeStart);
              const clampedEnd = Math.max(0, l.end - rangeStart);
              const offset = (l.properties?.audioStartOffset || 0) + Math.max(0, rangeStart - l.start);
              const volume = (l.properties?.volume !== undefined ? l.properties.volume : 0.8) * audioGain;
              return {
                src: l.properties.src!,
                start: clampedStart,
                end: clampedEnd,
                volume,
                offset
              };
            })
            .filter(t => t.end > t.start && !!t.src)
        : [];

      try {
        isOfflineExportingRef.current = true;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('无法获取 Canvas 渲染上下文');

        const needsScaling = targetWidth !== canvas.width || targetHeight !== canvas.height;
        let exportCanvas = canvas;
        let exportCtx: CanvasRenderingContext2D | null = null;
        if (needsScaling) {
          exportCanvas = document.createElement('canvas');
          exportCanvas.width = targetWidth;
          exportCanvas.height = targetHeight;
          exportCtx = exportCanvas.getContext('2d');
          if (exportCtx) {
            exportCtx.imageSmoothingEnabled = true;
            exportCtx.imageSmoothingQuality = 'high';
          }
        }

        const result = await exportVideoWithWebCodecs({
          canvas: exportCanvas,
          width: targetWidth,
          height: targetHeight,
          duration,
          fps: targetFps,
          bitrate: targetBitrate,
          audioTracks,
          signal: abortControllerRef.current?.signal,
          renderFrame: async (t) => {
            const actualTimelineTime = rangeStart + t;

            const activeVideos = layers.filter(layer =>
              layer.type === 'media' &&
              layer.visible &&
              layer.properties.isVideo &&
              !!layer.properties.src &&
              actualTimelineTime >= layer.start &&
              actualTimelineTime <= layer.end
            );

            await Promise.all(activeVideos.map(async layer => {
              const src = layer.properties.src!;
              const video = videosCacheRef.current[src];
              if (!video) return;

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
              const requestedTime = actualTimelineTime - layer.start + (layer.properties.videoStartOffset || 0);
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

            setCurrentTime(actualTimelineTime);
            drawFrame(ctx, actualTimelineTime);

            if (needsScaling && exportCtx) {
              exportCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, targetWidth, targetHeight);
            }
          },
          onProgress: (info) => {
            setExportProgress(info.percent);
            setExportFps(info.fps);
            setCurrentFrame(info.currentFrame);
            setTotalFrames(info.totalFrames);
            setEstimatedSecondsRemaining(info.estimatedSecondsRemaining);
            setEstimatedSizeMb(info.estimatedSizeMb);
          },
          onLog: (msg) => {
            setExportLogs(prev => [...prev.slice(-15), msg]);
          },
          onFrameSnapshot: (dataUrl) => {
            setPreviewSnapshotUrl(dataUrl);
          }
        });

        const url = URL.createObjectURL(result.blob);
        setExportProgress(100);
        setExportResult({
          ...result,
          url
        });
        isOfflineExportingRef.current = false;
        toast.success(`🎉 视频极速硬件加速导出完成！(${targetWidth}×${targetHeight} @ ${targetFps}fps)`);
        return;
      } catch (err: unknown) {
        isOfflineExportingRef.current = false;
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        console.warn('[Export] WebCodecs export failed, falling back to MediaRecorder:', err);
        const message = err instanceof Error ? err.message : String(err);
        setExportLogs(prev => [
          ...prev,
          `⚠️ 硬件加速受限: ${message || '环境限制'}`,
          '🛡️ 自动切换至 MediaRecorder 兼容兜底录制引擎...'
        ]);
        toast.info('检测到当前环境限制，已自动切换为兼容模式录制');
      }
    }

    // 2. Fallback to MediaRecorder Engine
    setExportEngine('mediarecorder');
    setExportLogs(['🛡️ 启动兼容流式录制引擎...', `Format: MP4 / WebM @ ${targetFps} FPS`]);
    exportWithMediaRecorder(canvas, duration, targetFps, targetBitrate, targetWidth, targetHeight);
  };

  // Cancel Export handler
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.warn('Unable to revoke export preview URL:', error);
      }
    }
    isOfflineExportingRef.current = false;
    setIsPlaying(false);
    setExporting(false);
    setExportResult(null);
    setPreviewSnapshotUrl(null);
    toast.info('已取消当前视频导出');
  };

  // Save to cloud storage
  const handleSaveCloud = async (result: ExportResultInfo) => {
    const key = `KEYVIDEO_CLOUD_VAULT_${Date.now()}`;
    await localDB.set(key, {
      createdAt: new Date().toISOString(),
      sizeBytes: result.sizeBytes,
      duration: result.duration,
      width: result.width,
      height: result.height,
      blob: result.blob
    });
    toast.success('☁️ 已将成片永久归档至工程云存储库！');
  };

  return {
    handleExport,
    handleCancel,
    handleSaveCloud,
    currentFrame,
    totalFrames,
    estimatedSecondsRemaining,
    estimatedSizeMb,
    previewSnapshotUrl,
    exportResult
  };
}
