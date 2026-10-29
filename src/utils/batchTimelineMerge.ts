import type { Layer } from '../components/VideoCanvas';

export interface CompletedBatchShot {
  shotId: string;
  shotIndex: number;
  shotName: string;
  resultUrl: string;
}

/**
 * Merges completed batch-video shots into an existing timeline.
 *
 * Only media layers explicitly bound to one of the incoming storyboard IDs are
 * replaced. Photos, audio, captions, unrelated videos and other projects' media
 * are preserved. New clips are appended after the last remaining media layer so
 * they do not overwrite existing content.
 */
export function mergeBatchVideosIntoTimeline(
  existingLayers: Layer[],
  completedShots: CompletedBatchShot[],
  options: { shotDuration?: number; timestamp?: number } = {}
): Layer[] {
  const shotDuration = options.shotDuration ?? 3;
  const timestamp = options.timestamp ?? Date.now();
  const targetShotIds = new Set(completedShots.map(shot => shot.shotId));

  const remaining = existingLayers.filter(layer => {
    if (layer.type !== 'media') return true;
    const boundId = typeof layer.properties?.storyboardId === 'string' ? layer.properties.storyboardId : '';
    return !(boundId && targetShotIds.has(boundId));
  });

  const baseStart = remaining.reduce((latest, layer) => {
    if (layer.type !== 'media') return latest;
    const end = Number(layer.end);
    return Number.isFinite(end) ? Math.max(latest, end) : latest;
  }, 0);

  const ordered = [...completedShots].sort((a, b) => a.shotIndex - b.shotIndex);
  const created: Layer[] = ordered.map((shot, index) => ({
    id: `layer_batch_video_${timestamp}_${index}`,
    type: 'media',
    name: `分镜 ${shot.shotIndex}: ${shot.shotName}`,
    start: baseStart + index * shotDuration,
    end: baseStart + (index + 1) * shotDuration,
    visible: true,
    x: 50,
    y: 50,
    scale: 1,
    opacity: 1,
    properties: {
      src: shot.resultUrl,
      storyboardId: shot.shotId,
      isVideo: true,
      transitionType: index > 0 ? 'fade' : 'none',
      transitionDuration: 0.5
    }
  }));

  return [...created, ...remaining];
}
