import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Layer } from '../components/VideoCanvas';

type StickerStyle = 'red' | 'gold' | 'cyan' | 'black' | 'purple';

export function useTimelineActions(
  setLayers: Dispatch<SetStateAction<Layer[]>>,
  setSelectedLayerId: (id: string | null) => void
) {
  const appendAndSelect = useCallback((layer: Layer) => {
    setLayers(previous => [...previous, layer]);
    setSelectedLayerId(layer.id);
  }, [setLayers, setSelectedLayerId]);

  const addTextLayer = useCallback((text: string) => {
    appendAndSelect({
      id: `text_${Date.now()}`,
      type: 'text',
      name: `文本 (${text.slice(0, 5)})`,
      start: 2,
      end: 8,
      visible: true,
      x: 50,
      y: 75,
      scale: 1,
      opacity: 1,
      properties: { text, fontSize: 32, color: '#ffffff', animation: 'fade', bold: true, shadow: true }
    });
  }, [appendAndSelect]);

  const addStickerLayer = useCallback((text: string, style: StickerStyle) => {
    appendAndSelect({
      id: `sticker_${Date.now()}`,
      type: 'sticker',
      name: `贴纸 (${text})`,
      start: 1,
      end: 14,
      visible: true,
      x: 30,
      y: 20,
      scale: 1.1,
      opacity: 1,
      properties: { text, style }
    });
  }, [appendAndSelect]);

  const addBrandLogoLayer = useCallback(() => {
    appendAndSelect({
      id: `logo_layer_${Date.now()}`,
      type: 'media',
      name: '品牌 LOGO',
      start: 0,
      end: 15,
      visible: true,
      x: 50,
      y: 50,
      scale: 1,
      opacity: 1,
      properties: { src: '/logo.png', bgRemoved: false }
    });
  }, [appendAndSelect]);

  const addLocalVideoLayer = useCallback((video: { name: string; src: string }) => {
    appendAndSelect({
      id: `local_video_layer_${Date.now()}`,
      type: 'media',
      name: `本地视频: ${video.name}`,
      start: 0,
      end: 15,
      visible: true,
      x: 50,
      y: 50,
      scale: 1,
      opacity: 1,
      properties: { src: video.src, bgRemoved: false }
    });
  }, [appendAndSelect]);

  const selectBgm = useCallback((src: string, name: string) => {
    setLayers(previous => {
      const hasAudio = previous.some(layer => layer.type === 'audio');
      if (hasAudio) {
        return previous.map(layer => layer.type === 'audio'
          ? { ...layer, name, properties: { ...layer.properties, src } }
          : layer);
      }

      return [...previous, {
        id: `audio_${Date.now()}`,
        type: 'audio',
        name,
        start: 0,
        end: 15,
        visible: true,
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        properties: { src, volume: 0.8 }
      }];
    });
  }, [setLayers]);

  return { addTextLayer, addStickerLayer, addBrandLogoLayer, addLocalVideoLayer, selectBgm };
}
