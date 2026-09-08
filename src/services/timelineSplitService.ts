import type { Layer } from '../components/VideoCanvas';

export interface SplitResult {
  canSplit: boolean;
  reason?: string;
}

/**
 * Checks whether a layer can be split at the given timeline time.
 * Requires at least 0.1s duration on both sides to prevent degenerate empty slices.
 */
export function canSplitLayer(layer: Layer | undefined | null, currentTime: number): SplitResult {
  if (!layer) {
    return { canSplit: false, reason: '未选中任何图层' };
  }
  if (!layer.visible) {
    return { canSplit: false, reason: '隐藏图层不可分割' };
  }
  const minPadding = 0.1;
  if (currentTime <= layer.start + minPadding) {
    return { canSplit: false, reason: '播放头位置过近或位于图层起点前' };
  }
  if (currentTime >= layer.end - minPadding) {
    return { canSplit: false, reason: '播放头位置过近或位于图层终点后' };
  }
  return { canSplit: true };
}

/**
 * Splits a layer into two contiguous chunks at currentTime.
 * Preserves media video offsets, audio offsets, text properties, etc.
 */
export function splitLayer(layer: Layer, currentTime: number): [Layer, Layer] {
  const roundedSplitTime = Math.round(currentTime * 100) / 100;
  const elapsedFromStart = roundedSplitTime - layer.start;
  const timestamp = Date.now().toString().slice(-5);

  // Left chunk retains original ID or takes a clean suffix
  const firstHalf: Layer = {
    ...layer,
    end: roundedSplitTime,
    properties: {
      ...layer.properties,
    },
  };

  // Video offset adjustments
  if (layer.properties.isVideo) {
    const origVideoStart = layer.properties.videoStartOffset || 0;
    firstHalf.properties.videoStartOffset = origVideoStart;
    firstHalf.properties.videoEndOffset = origVideoStart + elapsedFromStart;
  }

  // Right chunk gets a new ID and adjusted start offset
  const secondHalfId = `${layer.id}_split_${timestamp}`;
  const secondHalf: Layer = {
    ...layer,
    id: secondHalfId,
    name: layer.name.includes('(前半段)') 
      ? layer.name.replace('(前半段)', '(后半段)') 
      : `${layer.name} (后段)`,
    start: roundedSplitTime,
    properties: {
      ...layer.properties,
      // Default to no transition at the split point to maintain continuity
      transitionType: 'none',
    },
  };

  // Set the correct start offset for video & audio playback
  if (layer.properties.isVideo) {
    const origVideoStart = layer.properties.videoStartOffset || 0;
    secondHalf.properties.videoStartOffset = origVideoStart + elapsedFromStart;
    secondHalf.properties.videoEndOffset = layer.properties.videoEndOffset;
  }

  if (layer.type === 'audio') {
    const origAudioStart = layer.properties.audioStartOffset || 0;
    secondHalf.properties.audioStartOffset = origAudioStart + elapsedFromStart;
  }

  return [firstHalf, secondHalf];
}

/**
 * Replaces the target layer in a layer array with two split chunks.
 */
export function splitLayerInList(
  layers: Layer[],
  layerId: string,
  currentTime: number
): { newLayers: Layer[]; splitLayer: Layer; newLayerId: string } | null {
  const targetIndex = layers.findIndex(l => l.id === layerId);
  if (targetIndex === -1) return null;

  const targetLayer = layers[targetIndex];
  const check = canSplitLayer(targetLayer, currentTime);
  if (!check.canSplit) return null;

  const [firstHalf, secondHalf] = splitLayer(targetLayer, currentTime);

  const newLayers = [...layers];
  newLayers.splice(targetIndex, 1, firstHalf, secondHalf);

  return {
    newLayers,
    splitLayer: targetLayer,
    newLayerId: secondHalf.id,
  };
}
