import type { Layer } from '../components/VideoCanvas';

export const createDefaultLayers = (): Layer[] => [
  {
    id: 'media_1', type: 'media', name: '商品图 (亚麻衬衫)', start: 0, end: 15,
    visible: true, x: 50, y: 45, scale: 0.95, opacity: 1,
    properties: { src: '/clothing_shirt.png', bgRemoved: false }
  },
  {
    id: 'text_1', type: 'text', name: '主标题 (天然面料)', start: 1, end: 6.5,
    visible: true, x: 50, y: 78, scale: 1, opacity: 1,
    properties: { text: '100% 纯天然法国亚麻', fontSize: 32, color: '#ffffff', animation: 'zoom', bold: true, shadow: true }
  },
  {
    id: 'text_2', type: 'text', name: '副标题 (透气排汗)', start: 7, end: 13,
    visible: true, x: 50, y: 78, scale: 1, opacity: 1,
    properties: { text: '干爽透气 • 不易起皱', fontSize: 32, color: '#00f2fe', animation: 'typewriter', bold: true, shadow: true }
  },
  {
    id: 'sticker_1', type: 'sticker', name: '促销标签', start: 2, end: 14,
    visible: true, x: 80, y: 18, scale: 1.1, opacity: 1,
    properties: { text: '新品上市', style: 'purple' }
  },
  {
    id: 'audio_1', type: 'audio', name: '动感时尚卡点音轨', start: 0, end: 15,
    visible: true, x: 0, y: 0, scale: 1, opacity: 1,
    properties: { src: 'fashion_beat.mp3', volume: 0.8 }
  },
  {
    id: 'logo_layer', type: 'media', name: '品牌 LOGO', start: 0, end: 1,
    visible: true, x: 50, y: 50, scale: 1.5, opacity: 1,
    properties: { src: '/logo.png', bgRemoved: false }
  }
];
