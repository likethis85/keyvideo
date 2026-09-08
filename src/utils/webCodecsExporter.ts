import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export interface AudioTrackInput {
  src: string;
  start: number;
  end: number;
  volume?: number;
  offset?: number;
}

export interface ExportProgressInfo {
  currentFrame: number;
  totalFrames: number;
  percent: number;
  fps: number;
  estimatedSecondsRemaining: number;
  estimatedSizeMb: string;
}

export interface ExportResultInfo {
  blob: Blob;
  duration: number;
  totalFrames: number;
  averageFps: number;
  totalTimeSec: number;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface WebCodecsExportOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  duration: number;
  fps?: number;
  bitrate?: number;
  audioTracks?: AudioTrackInput[];
  signal?: AbortSignal;
  renderFrame: (time: number) => Promise<void> | void;
  onProgress: (info: ExportProgressInfo) => void;
  onLog: (message: string) => void;
  onFrameSnapshot?: (dataUrl: string) => void;
}

/**
 * Check if the current browser environment supports WebCodecs hardware video encoding
 */
export function isWebCodecsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'VideoEncoder' in window &&
    'VideoFrame' in window
  );
}

/**
 * Render and mix all audio tracks offline at ultra-high speed using OfflineAudioContext
 */
async function renderOfflineAudioBuffer(
  audioTracks: AudioTrackInput[],
  duration: number,
  sampleRate = 44100
): Promise<AudioBuffer | null> {
  if (!audioTracks || audioTracks.length === 0 || duration <= 0) return null;

  try {
    const totalSamples = Math.max(1, Math.ceil(duration * sampleRate));
    const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

    let hasValidTrack = false;

    for (const track of audioTracks) {
      if (!track.src) continue;
      try {
        const resp = await fetch(track.src);
        if (!resp.ok) continue;
        const arrayBuf = await resp.arrayBuffer();
        const decodedBuf = await offlineCtx.decodeAudioData(arrayBuf);

        const sourceNode = offlineCtx.createBufferSource();
        sourceNode.buffer = decodedBuf;

        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = track.volume !== undefined ? track.volume : 0.8;

        sourceNode.connect(gainNode);
        gainNode.connect(offlineCtx.destination);

        const offset = Math.max(0, track.offset || 0);
        const availableDuration = Math.max(0, decodedBuf.duration - offset);
        const trackDuration = Math.min(Math.max(0, track.end - track.start), availableDuration);
        if (trackDuration <= 0) continue;
        sourceNode.start(Math.max(0, track.start), offset, trackDuration);
        hasValidTrack = true;
      } catch (err) {
        console.warn('[WebCodecsExporter] Failed to load audio track:', track.src, err);
      }
    }

    if (!hasValidTrack) return null;
    return await offlineCtx.startRendering();
  } catch (err) {
    console.warn('[WebCodecsExporter] OfflineAudioContext rendering failed:', err);
    return null;
  }
}

/**
 * Export high-bitrate MP4 with hardware accelerated WebCodecs
 */
export async function exportVideoWithWebCodecs(options: WebCodecsExportOptions): Promise<ExportResultInfo> {
  const {
    canvas,
    width,
    height,
    duration,
    fps = 30,
    bitrate = 8_500_000,
    audioTracks = [],
    signal,
    renderFrame,
    onProgress,
    onLog,
    onFrameSnapshot
  } = options;

  if (!isWebCodecsSupported()) {
    throw new Error('当前浏览器环境不支持 WebCodecs 硬件加速');
  }

  if (signal?.aborted) {
    throw new DOMException('导出已被用户取消', 'AbortError');
  }

  onLog('⚡ 启动 WebCodecs 硬件加速渲染引擎...');

  // 1. Prepare offline audio if present
  let renderedAudioBuffer: AudioBuffer | null = null;
  const hasAudio = audioTracks && audioTracks.length > 0;
  if (hasAudio) {
    onLog('🎵 离屏混音中：预混合背景音轨与音频音量曲线...');
    try {
      renderedAudioBuffer = await renderOfflineAudioBuffer(audioTracks, duration, 44100);
      if (!renderedAudioBuffer) {
        onLog('⚠️ 未检测到有效音频素材，将自适应转为纯画面 MP4 封装');
      } else if (!('AudioEncoder' in window)) {
        onLog('⚠️ 当前环境暂不支持 AAC 硬件编码，将转为纯画面 MP4 封装');
        renderedAudioBuffer = null;
      }
    } catch {
      onLog('⚠️ 音频解码异常，已平滑容错为纯画面 MP4 封装');
      renderedAudioBuffer = null;
    }
  }

  if (signal?.aborted) {
    throw new DOMException('导出已被用户取消', 'AbortError');
  }

  // 2. Initialize MP4 Muxer with FastStart for instant Web streaming
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height
    },
    audio: renderedAudioBuffer && 'AudioEncoder' in window ? {
      codec: 'aac',
      numberOfChannels: 2,
      sampleRate: 44100
    } : undefined,
    fastStart: 'in-memory'
  });

  // 3. Initialize VideoEncoder
  let videoEncoderError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      console.error('[WebCodecs VideoEncoder Error]', e);
      videoEncoderError = e;
    }
  });

  // Prefer AVC (H.264 High Profile 4.2)
  const videoConfig: VideoEncoderConfig = {
    codec: 'avc1.64002a', // H.264 High Profile Level 4.2
    width,
    height,
    bitrate,
    framerate: fps,
    hardwareAcceleration: 'prefer-hardware'
  };

  const isConfigSupported = await VideoEncoder.isConfigSupported(videoConfig);
  if (!isConfigSupported.supported) {
    // Fallback to Main Profile Level 4.0
    videoConfig.codec = 'avc1.4d0028';
  }
  videoEncoder.configure(videoConfig);

  // 4. Initialize AudioEncoder if audio buffer rendered
  let audioEncoder: AudioEncoder | null = null;
  if (renderedAudioBuffer && 'AudioEncoder' in window) {
    try {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          muxer.addAudioChunk(chunk, meta);
        },
        error: (e) => console.warn('[WebCodecs AudioEncoder Warning]', e)
      });

      const audioConfig: AudioEncoderConfig = {
        codec: 'mp4a.40.2', // AAC-LC
        numberOfChannels: 2,
        sampleRate: 44100,
        bitrate: 192_000
      };

      const audioSupported = await AudioEncoder.isConfigSupported(audioConfig);
      if (audioSupported.supported) {
        audioEncoder.configure(audioConfig);
      } else {
        audioEncoder = null;
      }
    } catch (e) {
      console.warn('[WebCodecs] AudioEncoder setup failed:', e);
      audioEncoder = null;
    }
  }

  // 5. Feed audio samples into AudioEncoder if active
  if (audioEncoder && renderedAudioBuffer) {
    onLog('🔊 硬件编码 AAC 音频流...');
    const sampleRate = renderedAudioBuffer.sampleRate;
    const channel0 = renderedAudioBuffer.getChannelData(0);
    const channel1 = renderedAudioBuffer.numberOfChannels > 1
      ? renderedAudioBuffer.getChannelData(1)
      : channel0;

    const blockSize = 1024;
    const totalSamples = channel0.length;

    for (let offset = 0; offset < totalSamples; offset += blockSize) {
      if (signal?.aborted) {
        throw new DOMException('导出已被用户取消', 'AbortError');
      }

      const currentBlock = Math.min(blockSize, totalSamples - offset);
      const planarBuffer = new Float32Array(currentBlock * 2);

      planarBuffer.set(channel0.subarray(offset, offset + currentBlock), 0);
      planarBuffer.set(channel1.subarray(offset, offset + currentBlock), currentBlock);

      const timestampMicroseconds = Math.round((offset / sampleRate) * 1_000_000);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: currentBlock,
        numberOfChannels: 2,
        timestamp: timestampMicroseconds,
        data: planarBuffer
      });

      audioEncoder.encode(audioData);
      audioData.close();
    }
    await audioEncoder.flush();
  }

  // 6. Frame-driven Video Rendering Loop
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameIntervalSec = 1 / fps;
  const loopStartTime = performance.now();
  let lastReportTime = loopStartTime;
  let lastReportFrames = 0;

  onLog(`🚀 开始极速离屏渲染（总计 ${totalFrames} 帧 @ ${fps} FPS）...`);

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    if (signal?.aborted) {
      try { videoEncoder.close(); } catch (error) { console.warn('Unable to close video encoder:', error); }
      if (audioEncoder) { try { audioEncoder.close(); } catch (error) { console.warn('Unable to close audio encoder:', error); } }
      throw new DOMException('导出已被用户取消', 'AbortError');
    }

    if (videoEncoderError) {
      throw videoEncoderError;
    }

    const currentTime = frameIndex * frameIntervalSec;

    // Render precise frame on canvas
    await renderFrame(currentTime);

    // Snapshot thumbnail for real-time live preview (every 8 frames)
    if (onFrameSnapshot && frameIndex % 8 === 0) {
      try {
        onFrameSnapshot(canvas.toDataURL('image/jpeg', 0.55));
      } catch (error) {
        console.warn('Unable to capture export preview frame:', error);
      }
    }

    // Create VideoFrame directly from canvas
    const timestampMicroseconds = Math.round(currentTime * 1_000_000);
    const durationMicroseconds = Math.round(frameIntervalSec * 1_000_000);

    const videoFrame = new VideoFrame(canvas, {
      timestamp: timestampMicroseconds,
      duration: durationMicroseconds
    });

    // Keyframe every 2 seconds
    const isKeyFrame = frameIndex % (fps * 2) === 0;
    videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
    videoFrame.close();

    // Calculate real-time FPS & progress
    const now = performance.now();
    if (now - lastReportTime >= 200 || frameIndex === totalFrames - 1) {
      const deltaSec = (now - lastReportTime) / 1000;
      const deltaFrames = frameIndex - lastReportFrames;
      const currentFps = deltaSec > 0 ? Math.round(deltaFrames / deltaSec) : fps;
      const percent = Math.min(99, Math.round(((frameIndex + 1) / totalFrames) * 100));

      // Calculate ETA
      const totalElapsedSec = (now - loopStartTime) / 1000;
      const avgSpeed = (frameIndex + 1) / Math.max(0.01, totalElapsedSec);
      const remainingFrames = totalFrames - (frameIndex + 1);
      const estimatedSecondsRemaining = Math.max(0, Math.round(remainingFrames / Math.max(1, avgSpeed)));

      // Estimate Size
      const estimatedTotalBytes = (bitrate / 8) * duration;
      const estimatedSizeMb = (estimatedTotalBytes / (1024 * 1024)).toFixed(1);

      lastReportTime = now;
      lastReportFrames = frameIndex;

      onProgress({
        currentFrame: frameIndex + 1,
        totalFrames,
        percent,
        fps: currentFps,
        estimatedSecondsRemaining,
        estimatedSizeMb
      });

      if (frameIndex % (fps * 2) === 0 || frameIndex === totalFrames - 1) {
        onLog(`⚡ 硬件渲染进度：帧 ${frameIndex + 1}/${totalFrames} (${percent}%) · 速率 ${currentFps} FPS · 预估剩余 ${estimatedSecondsRemaining}s`);
      }
    }

    // Yield macro-task every 8 frames to keep UI responsive and allow VideoEncoder internal queue processing
    if (frameIndex % 8 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // 7. Finalize Encoding and Muxing
  onLog('📦 正在等待硬件编码器输出并封装 MP4 文件容器...');
  await videoEncoder.flush();
  videoEncoder.close();

  if (audioEncoder) {
    audioEncoder.close();
  }

  muxer.finalize();

  const totalTimeTakenSec = Math.max(0.1, (performance.now() - loopStartTime) / 1000);
  const averageFps = Math.round(totalFrames / totalTimeTakenSec);
  const { buffer } = muxer.target;
  const blob = new Blob([buffer], { type: 'video/mp4' });
  const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);

  onLog(`✨ 极速硬件导出完成！耗时 ${totalTimeTakenSec.toFixed(1)} 秒（平均 ${averageFps} FPS，体积 ${sizeMb} MB）！`);

  return {
    blob,
    duration,
    totalFrames,
    averageFps,
    totalTimeSec: parseFloat(totalTimeTakenSec.toFixed(1)),
    sizeBytes: blob.size,
    width,
    height
  };
}
