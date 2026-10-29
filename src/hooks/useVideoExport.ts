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
  exportAudioGainRef: MutableRefObject<number>;
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
    canvasRef, audioCtxRef, audioDestinationRef, exportAudioGainRef, videosCacheRef, isOfflineExportingRef, layers,
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
  const cancelRequestedRef = useRef(false);

  const revokeExportUrl = (result: (ExportResultInfo & { url: string }) | null) => {
    if (result?.url) URL.revokeObjectURL(result.url);
  };

  // Fallback MediaRecorder implementation
  const exportWithMediaRecorder = (
    canvas: HTMLCanvasElement,
    duration: number,
    targetFps = 30,
    targetBitrate = 8_500_000,
    exportW = width,
    exportH = height,
    includeAudio = true,
    rangeStart = 0
  ) => {
    try {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        void audioCtxRef.current.resume();
      }

      const recordCanvas = exportW === canvas.width && exportH === canvas.height
        ? canvas
        : Object.assign(document.createElement('canvas'), { width: exportW, height: exportH });
      const recordContext = recordCanvas === canvas ? null : recordCanvas.getContext('2d');
      if (recordCanvas !== canvas && !recordContext) throw new Error('无法创建兼容导出画布');

      const canvasStream = recordCanvas.captureStream(targetFps);
      const mixedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach(track => mixedStream.addTrack(track));

      if (includeAudio && audioDestinationRef.current) {
        audioDestinationRef.current.stream.getAudioTracks().forEach(track => mixedStream.addTrack(track));
      }

      const formatCandidates = [
        { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' as const },
        { mimeType: 'video/mp4', extension: 'mp4' as const },
        ...(includeAudio ? [{ mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' as const }, { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' as const }] : [{ mimeType: 'video/webm;codecs=vp9', extension: 'webm' as const }, { mimeType: 'video/webm;codecs=vp8', extension: 'webm' as const }]),
        { mimeType: 'video/webm', extension: 'webm' as const }
      ];
      const selectedFormat = formatCandidates.find(candidate => MediaRecorder.isTypeSupported(candidate.mimeType));
      const recorderOptions: MediaRecorderOptions = selectedFormat
        ? { mimeType: selectedFormat.mimeType, videoBitsPerSecond: targetBitrate, ...(includeAudio ? { audioBitsPerSecond: 192_000 } : {}) }
        : { videoBitsPerSecond: targetBitrate, ...(includeAudio ? { audioBitsPerSecond: 192_000 } : {}) };
      let fileType = selectedFormat?.mimeType || 'video/webm';
      let fileExtension = selectedFormat?.extension || 'webm';

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(mixedStream, recorderOptions);
      } catch {
        setExportLogs(prev => [...prev, '当前编码器不支持首选格式，已切换到 WebM 兼容格式']);
        fileType = 'video/webm';
        fileExtension = 'webm';
        recorder = new MediaRecorder(mixedStream, { ...(includeAudio ? { audioBitsPerSecond: 192_000 } : {}), videoBitsPerSecond: targetBitrate });
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
        recordingTimerRef.current = null;
        mediaRecorderRef.current = null;
        mixedStream.getTracks().forEach(track => track.stop());
        if (cancelRequestedRef.current) return;
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
          height: exportH,
          mimeType: fileType,
          fileExtension
        };
        setExportResult(result);
        toast.success(`视频导出成功（${fileExtension.toUpperCase()}）！`);
      };

      // Drive the fallback timeline from the export timer. The normal playback
      // loop would advance against the full project duration and fight the
      // selected export range.
      const mainContext = canvas.getContext('2d');
      if (!mainContext) throw new Error('无法获取 Canvas 渲染上下文');
      setIsPlaying(false);
      recorder.start();

      // Emulate progress
      let elapsed = 0;
      const interval = 100;
      const timer = setInterval(() => {
        elapsed += interval / 1000;
        const timelineTime = rangeStart + Math.min(duration, elapsed);
        try {
          drawFrame(mainContext, timelineTime);
          if (recordContext) {
            recordContext.clearRect(0, 0, exportW, exportH);
            recordContext.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, exportW, exportH);
          }
        } catch (error) {
          clearInterval(timer);
          cancelRequestedRef.current = true;
          if (recorder.state === 'recording') recorder.stop();
          setIsPlaying(false);
          setExporting(false);
          toast.error(`兼容导出失败: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }
        const progress = Math.min(99, Math.round((elapsed / duration) * 100));
        setExportProgress(progress);
        setCurrentFrame(Math.round(elapsed * targetFps));
        setTotalFrames(Math.round(duration * targetFps));
        setEstimatedSecondsRemaining(Math.max(0, Math.round(duration - elapsed)));

        if (elapsed >= duration) {
          clearInterval(timer);
          recordingTimerRef.current = null;
          if (recorder.state === 'recording') recorder.stop();
        }
        setCurrentTime(timelineTime);
      }, interval);
      recordingTimerRef.current = timer;
    } catch (error) {
      setIsPlaying(false);
      setExporting(false);
      setExportLogs(prev => [...prev, `❌ 兼容导出启动失败: ${error instanceof Error ? error.message : String(error)}`]);
      toast.error(`无法开始兼容导出: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    exportAudioGainRef.current = audioGain;

    const activeLayers = layers.filter(l => l.visible);
    const maxLayerEnd = activeLayers.reduce((max, l) => l.end > max ? l.end : max, 0);
    const rawTotalDuration = maxLayerEnd > 0 ? Math.min(15, maxLayerEnd) : 15;

    const rangeStart = Math.max(0, customConfig?.timeRange?.start ?? 0);
    const rangeEnd = Math.min(rawTotalDuration, customConfig?.timeRange?.end ?? rawTotalDuration);
    const duration = Math.max(0.5, rangeEnd - rangeStart);

    setIsPlaying(false);
    setCurrentTime(rangeStart);
    setExporting(true);
    cancelRequestedRef.current = false;
    setExportProgress(0);
    setExportResult(previous => {
      revokeExportUrl(previous);
      return null;
    });
    setExportFps(null);
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
    exportWithMediaRecorder(canvas, duration, targetFps, targetBitrate, targetWidth, targetHeight, includeAudio, rangeStart);
  };

  // Cancel Export handler
  const handleCancel = () => {
    cancelRequestedRef.current = true;
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
    setExportResult(previous => {
      revokeExportUrl(previous);
      return null;
    });
    setPreviewSnapshotUrl(null);
    toast.info('已取消当前视频导出');
  };

  const handleClose = () => {
    setExporting(false);
    setExportResult(previous => {
      revokeExportUrl(previous);
      return null;
    });
    setPreviewSnapshotUrl(null);
  };

  // Persist an export locally in a recoverable format. The callback name is
  // kept for compatibility with the existing overlay contract.
  const handleSaveCloud = async (result: ExportResultInfo) => {
    const key = `KEYVIDEO_CLOUD_VAULT_${Date.now()}`;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('无法读取成片数据'));
      reader.onerror = () => reject(reader.error || new Error('无法读取成片数据'));
      reader.readAsDataURL(result.blob);
    });
    const stored = await localDB.set(key, {
      createdAt: new Date().toISOString(),
      sizeBytes: result.sizeBytes,
      duration: result.duration,
      width: result.width,
      height: result.height,
      mimeType: result.mimeType || result.blob.type,
      fileExtension: result.fileExtension || 'mp4',
      dataUrl
    });
    if (!stored) throw new Error('本地归档写入失败');
    toast.success('已将成片保存到本地归档！');
  };

  return {
    handleExport,
    handleCancel,
    handleClose,
    handleSaveCloud,
    currentFrame,
    totalFrames,
    estimatedSecondsRemaining,
    estimatedSizeMb,
    previewSnapshotUrl,
    exportResult
  };
}
