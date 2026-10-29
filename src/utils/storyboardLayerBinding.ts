import type { Layer } from '../components/VideoCanvas';
import type { StoryboardItem } from '../types/aiProject';

/**
 * Resolves which storyboard a timeline media layer belongs to.
 *
 * New layers carry an explicit `storyboardId`; legacy layers only have a
 * `media_i2v_<index>_` id, so they fall back to positional matching. Matching by
 * ID first prevents a reordered/deleted storyboard from restoring another shot's
 * video after a project reload.
 */
export function findStoryboardForLayer(
  layer: Pick<Layer, 'id' | 'properties'>,
  storyboards: StoryboardItem[]
): StoryboardItem | null {
  const boundId = typeof layer.properties?.storyboardId === 'string' ? layer.properties.storyboardId : '';
  if (boundId) {
    return storyboards.find(storyboard => storyboard.id === boundId) || null;
  }

  const match = /^media_i2v_(\d+)_/.exec(layer.id);
  if (!match) return null;
  return storyboards[Number(match[1])] || null;
}
