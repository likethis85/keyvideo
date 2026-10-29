import type { Layer } from '../components/VideoCanvas';

export type StudioTrack = 'video' | 'caption' | 'voice' | 'sfx' | 'brand' | 'note';

export function formatStudioTimecode(seconds: number, fps = 30): string {
  const frames = Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * fps);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(frames / fps / 60))}:${pad(Math.floor(frames / fps) % 60)}:${pad(frames % fps)}`;
}

export function getStudioTrack(layer: Layer): StudioTrack {
  if (layer.properties.timelineTrack) return layer.properties.timelineTrack;
  const name = `${layer.id} ${layer.name}`;
  if (/logo|品牌|角标/i.test(name)) return 'brand';
  if (/标记|备注|marker|note/i.test(name)) return 'note';
  if (layer.type === 'audio') return /音效|sfx|foley/i.test(name) ? 'sfx' : 'voice';
  return layer.type === 'media' ? 'video' : 'caption';
}
