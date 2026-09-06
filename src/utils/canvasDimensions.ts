import type { AspectRatio } from './smartReflow';

const dimensions: Record<AspectRatio, { width: number; height: number }> = {
  '1-1': { width: 1080, height: 1080 },
  '3-4': { width: 1080, height: 1440 },
  '9-16': { width: 1080, height: 1920 },
  '16-9': { width: 1920, height: 1080 }
};

export const getCanvasDimensions = (ratio: AspectRatio) => dimensions[ratio];
