export type ResolutionPreset = '720p' | '1080p' | '2k' | '4k' | 'native';
export type FramerateOption = 24 | 30 | 60;
export type BitratePreset = 'compact' | 'recommended' | 'master' | 'ultra';

export interface VideoExportConfig {
  preset: ResolutionPreset;
  width: number;
  height: number;
  fps: FramerateOption;
  bitrateBps: number;
  timeRange: {
    start: number;
    end: number;
  };
  includeAudio: boolean;
  audioGain: number; // 1.0 = standard, 1.2 = boost
}

export const BITRATE_PRESETS: Record<BitratePreset, { label: string; bps: number; desc: string }> = {
  compact: { label: '省流轻量 (4 Mbps)', bps: 4_000_000, desc: '文件体积小，极速传输分享' },
  recommended: { label: '高清推荐 (8.5 Mbps)', bps: 8_500_000, desc: '商业标配，画质与体积黄金平衡' },
  master: { label: '无损母带 (16 Mbps)', bps: 16_000_000, desc: '极高细节还原，大屏或精细剪辑首选' },
  ultra: { label: '极限极清 (25 Mbps)', bps: 25_000_000, desc: '4K 专用高码率，保留微观发丝与面料' }
};

export const FRAMERATE_OPTIONS: Array<{ fps: FramerateOption; label: string; desc: string }> = [
  { fps: 24, label: '24 FPS', desc: '电影胶片感' },
  { fps: 30, label: '30 FPS', desc: '标准网络流媒体 (推荐)' },
  { fps: 60, label: '60 FPS', desc: '高刷丝滑动态走秀' }
];

export function normalizeRatioKey(ratio: string): '9-16' | '16-9' | '1-1' | '3-4' {
  const clean = ratio.replace(':', '-');
  if (clean === '16-9' || clean === '1-1' || clean === '3-4') return clean;
  return '9-16';
}

export function calculateExportDimensions(
  ratio: string,
  preset: ResolutionPreset,
  nativeWidth = 1080,
  nativeHeight = 1920
): { width: number; height: number } {
  const norm = normalizeRatioKey(ratio);

  if (preset === 'native') {
    return {
      width: Math.round(nativeWidth / 2) * 2,
      height: Math.round(nativeHeight / 2) * 2
    };
  }

  const RESOLUTION_MAP: Record<ResolutionPreset, Record<string, { width: number; height: number }>> = {
    '720p': {
      '9-16': { width: 720, height: 1280 },
      '16-9': { width: 1280, height: 720 },
      '1-1': { width: 720, height: 720 },
      '3-4': { width: 720, height: 960 }
    },
    '1080p': {
      '9-16': { width: 1080, height: 1920 },
      '16-9': { width: 1920, height: 1080 },
      '1-1': { width: 1080, height: 1080 },
      '3-4': { width: 1080, height: 1440 }
    },
    '2k': {
      '9-16': { width: 1440, height: 2560 },
      '16-9': { width: 2560, height: 1440 },
      '1-1': { width: 1440, height: 1440 },
      '3-4': { width: 1440, height: 1920 }
    },
    '4k': {
      '9-16': { width: 2160, height: 3840 },
      '16-9': { width: 3840, height: 2160 },
      '1-1': { width: 2160, height: 2160 },
      '3-4': { width: 2160, height: 2880 }
    },
    'native': {
      '9-16': { width: 1080, height: 1920 },
      '16-9': { width: 1920, height: 1080 },
      '1-1': { width: 1080, height: 1080 },
      '3-4': { width: 1080, height: 1440 }
    }
  };

  const matched = RESOLUTION_MAP[preset]?.[norm] || RESOLUTION_MAP['1080p']['9-16'];
  return {
    width: Math.round(matched.width / 2) * 2,
    height: Math.round(matched.height / 2) * 2
  };
}

/**
 * Estimate video file size in Megabytes based on bitrate, duration, and audio track
 */
export function estimateExportFileSizeMb(
  durationSec: number,
  bitrateBps: number,
  includeAudio = true
): string {
  if (durationSec <= 0) return '0.0';
  const videoBytes = (bitrateBps * durationSec) / 8;
  const audioBytes = includeAudio ? (192_000 * durationSec) / 8 : 0;
  const totalMb = (videoBytes + audioBytes) / (1024 * 1024);
  return totalMb.toFixed(1);
}

const STORAGE_KEY = 'keyvideo_export_config';

export function loadSavedExportConfig(
  ratio: string,
  totalDuration: number,
  nativeWidth = 1080,
  nativeHeight = 1920
): VideoExportConfig {
  const defaultDimensions = calculateExportDimensions(ratio, '1080p', nativeWidth, nativeHeight);
  const defaultConfig: VideoExportConfig = {
    preset: '1080p',
    width: defaultDimensions.width,
    height: defaultDimensions.height,
    fps: 30,
    bitrateBps: 8_500_000,
    timeRange: { start: 0, end: Math.max(1, totalDuration) },
    includeAudio: true,
    audioGain: 1.0
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig;
    const parsed = JSON.parse(raw);
    const preset = parsed.preset || '1080p';
    const dims = calculateExportDimensions(ratio, preset, nativeWidth, nativeHeight);

    return {
      preset,
      width: dims.width,
      height: dims.height,
      fps: parsed.fps === 24 || parsed.fps === 60 ? parsed.fps : 30,
      bitrateBps: typeof parsed.bitrateBps === 'number' ? parsed.bitrateBps : 8_500_000,
      timeRange: {
        start: 0,
        end: Math.max(1, totalDuration)
      },
      includeAudio: parsed.includeAudio !== false,
      audioGain: typeof parsed.audioGain === 'number' ? parsed.audioGain : 1.0
    };
  } catch {
    return defaultConfig;
  }
}

export function saveExportConfig(config: Partial<VideoExportConfig>): void {
  try {
    const payload = {
      preset: config.preset,
      fps: config.fps,
      bitrateBps: config.bitrateBps,
      includeAudio: config.includeAudio,
      audioGain: config.audioGain
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to save export preferences:', error);
  }
}
