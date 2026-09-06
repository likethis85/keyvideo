import type { Layer } from '../components/VideoCanvas';

export type AspectRatio = '1-1' | '3-4' | '9-16' | '16-9';

export interface RatioConfig {
  id: AspectRatio;
  label: string;
  name: string;
  width: number;
  height: number;
  platform: string;
  safeMargin: {
    top: number;    // in percentage (0 - 100)
    bottom: number;
    left: number;
    right: number;
  };
}

export const RATIO_CONFIGS: Record<AspectRatio, RatioConfig> = {
  '9-16': {
    id: '9-16',
    label: '9:16',
    name: '竖版带货',
    width: 1080,
    height: 1920,
    platform: '抖音 / TikTok / 视频号 / Reels',
    safeMargin: { top: 12, bottom: 12, left: 8, right: 8 }
  },
  '3-4': {
    id: '3-4',
    label: '3:4',
    name: '种草笔记',
    width: 1080,
    height: 1440,
    platform: '小红书穿搭图文 / 种草视频',
    safeMargin: { top: 10, bottom: 10, left: 8, right: 8 }
  },
  '1-1': {
    id: '1-1',
    label: '1:1',
    name: '主图方版',
    width: 1080,
    height: 1080,
    platform: '淘宝 / 天猫 / 拼多多主图视频',
    safeMargin: { top: 10, bottom: 10, left: 10, right: 10 }
  },
  '16-9': {
    id: '16-9',
    label: '16:9',
    name: '横屏大片',
    width: 1920,
    height: 1080,
    platform: '天猫旗舰店轮播 / 官网横屏大屏',
    safeMargin: { top: 10, bottom: 12, left: 16, right: 16 }
  }
};

/**
 * Intelligent Layout Reflow Algorithm
 * Adjusts layer coordinates, scale, and safe boundaries when changing aspect ratios.
 */
export function reflowLayersForRatio(
  layers: Layer[],
  fromRatio: AspectRatio,
  toRatio: AspectRatio
): Layer[] {
  if (fromRatio === toRatio) return layers;

  const toConfig = RATIO_CONFIGS[toRatio];
  const fromConfig = RATIO_CONFIGS[fromRatio];

  const fromAspect = fromConfig.width / fromConfig.height;
  const toAspect = toConfig.width / toConfig.height;

  return layers.map(layer => {
    // 1. Audio layers don't have visual positions
    if (layer.type === 'audio') return layer;

    const newLayer = { ...layer, properties: { ...layer.properties } };

    // 2. Media layers (Model, Clothing, Background video)
    if (layer.type === 'media') {
      // If switching from tall (9:16/3:4) to wide (16:9)
      if (fromAspect < 1 && toAspect > 1.2) {
        // In 16:9 landscape, vertical height is much smaller.
        // Scale down tall model subject slightly to fit in frame, and center horizontally
        newLayer.x = 50; // Keep centered
        newLayer.y = 50;
        // Keep scale reasonable (around 0.7 - 0.85 so model isn't cropped)
        newLayer.scale = Math.min(layer.scale, 0.82);
      } else if (fromAspect > 1.2 && toAspect < 1) {
        // From 16:9 landscape to vertical (9:16 / 3:4)
        newLayer.x = 50;
        newLayer.y = 45;
        newLayer.scale = Math.max(layer.scale, 0.95);
      } else if (toRatio === '1-1') {
        // Square mode: center nicely
        newLayer.x = 50;
        newLayer.y = 48;
        newLayer.scale = Math.min(layer.scale, 0.88);
      }
      return newLayer;
    }

    // 3. Text and Subtitle layers
    if (layer.type === 'text') {
      const margin = toConfig.safeMargin;
      let newX = layer.x;
      let newY = layer.y;

      // In 16:9 wide mode, adjust title placement
      if (toRatio === '16-9') {
        // Subtitle near bottom in 9:16 (y ~ 78) should be lifted to avoid bottom cropping
        if (layer.y > 65) {
          newY = 82; // Safe bottom in landscape
        } else if (layer.y < 35) {
          newY = 16; // Safe top in landscape
        }
        // Clamp X between left and right safe margins
        newX = Math.max(margin.left, Math.min(100 - margin.right, newX));
      } else if (toRatio === '1-1') {
        if (layer.y > 70) {
          newY = 82;
        } else if (layer.y < 25) {
          newY = 18;
        }
        newX = Math.max(margin.left, Math.min(100 - margin.right, newX));
      } else {
        // Clamp within margins for 9:16 / 3:4
        newX = Math.max(margin.left, Math.min(100 - margin.right, newX));
        newY = Math.max(margin.top, Math.min(100 - margin.bottom, newY));
      }

      newLayer.x = Math.round(newX * 10) / 10;
      newLayer.y = Math.round(newY * 10) / 10;
      return newLayer;
    }

    // 4. Sticker layers (badges, promo tags)
    if (layer.type === 'sticker') {
      const margin = toConfig.safeMargin;
      let newX = layer.x;
      let newY = layer.y;

      // Ensure stickers don't float outside the new canvas bounds
      newX = Math.max(margin.left + 5, Math.min(100 - margin.right - 5, newX));
      newY = Math.max(margin.top + 4, Math.min(100 - margin.bottom - 4, newY));

      newLayer.x = Math.round(newX * 10) / 10;
      newLayer.y = Math.round(newY * 10) / 10;
      return newLayer;
    }

    return newLayer;
  });
}
