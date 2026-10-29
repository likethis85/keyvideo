export const MAX_KEYING_PIXELS = 4_000_000;

export interface KeyingDimensions {
  width: number;
  height: number;
  scaled: boolean;
}

/**
 * Keeps flood-fill keying within a bounded pixel budget. Extremely large user
 * images otherwise allocate ImageData + visited arrays and a huge pixel queue on
 * the main thread, freezing the editor.
 */
export function fitKeyingDimensions(
  width: number,
  height: number,
  maxPixels = MAX_KEYING_PIXELS
): KeyingDimensions {
  const safeWidth = Math.max(1, Math.round(Number(width) || 1));
  const safeHeight = Math.max(1, Math.round(Number(height) || 1));
  const limit = Math.max(1, Math.round(Number(maxPixels) || MAX_KEYING_PIXELS));
  const pixels = safeWidth * safeHeight;
  if (pixels <= limit) return { width: safeWidth, height: safeHeight, scaled: false };

  const scale = Math.sqrt(limit / pixels);
  return {
    width: Math.max(1, Math.floor(safeWidth * scale)),
    height: Math.max(1, Math.floor(safeHeight * scale)),
    scaled: true
  };
}
