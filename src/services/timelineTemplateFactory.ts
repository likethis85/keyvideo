import type { Layer } from '../components/VideoCanvas';

export type TimelineTemplateType = 'beat' | 'split' | 'detail' | 'transition_demo';

interface BgmOption {
  src: string;
  name: string;
}

type TextAnimation = 'fade' | 'typewriter' | 'zoom' | 'slide';
type StickerStyle = 'black' | 'cyan' | 'gold' | 'purple' | 'red';

const base = (id: string, type: Layer['type'], name: string, start: number, end: number): Layer => ({
  id, type, name, start, end, visible: true, x: 50, y: 50, scale: 1, opacity: 1, properties: {}
});

const media = (id: string, name: string, src: string, overrides: Partial<Layer> = {}): Layer => ({
  ...base(id, 'media', name, 0, 15),
  properties: { src, bgRemoved: false },
  ...overrides
});

const text = (
  id: string,
  name: string,
  content: string,
  start: number,
  end: number,
  y: number,
  fontSize: number,
  color: string,
  animation: TextAnimation
): Layer => ({
  ...base(id, 'text', name, start, end),
  y,
  properties: { text: content, fontSize, color, animation, bold: true, shadow: true }
});

const sticker = (id: string, name: string, content: string, style: StickerStyle, start: number, end: number, x: number, y: number, scale: number): Layer => ({
  ...base(id, 'sticker', name, start, end), x, y, scale, properties: { text: content, style }
});

const audio = (id: string, bgm: BgmOption, volume: number): Layer => ({
  ...base(id, 'audio', bgm.name, 0, 15), x: 0, y: 0, properties: { src: bgm.src, volume }
});

function resolveBgm(template: TimelineTemplateType, bgm?: Partial<BgmOption>): BgmOption {
  const defaults = template === 'beat'
    ? { src: 'fashion_beat.mp3', name: '动感时尚卡点音轨' }
    : template === 'split'
      ? { src: 'jazz.mp3', name: '轻快爵士音轨' }
      : { src: 'tech_ambient.mp3', name: '极简科技感纯音乐' };
  return { src: bgm?.src || defaults.src, name: bgm?.name || defaults.name };
}

export function createTimelineTemplate(template: TimelineTemplateType, preferredBgm?: Partial<BgmOption>): Layer[] {
  const bgm = resolveBgm(template, preferredBgm);
  let layers: Layer[];

  if (template === 'beat') {
    layers = [
      media('media_1', '商品图 (亚麻衬衫)', '/clothing_shirt.png', { y: 45, scale: 0.95 }),
      text('text_1', '主标题 (天然面料)', '100% 纯天然法国亚麻', 1, 6, 78, 32, '#ffffff', 'zoom'),
      text('text_2', '副标题 (透气排汗)', '干爽透气 • 不易起皱', 6.5, 12, 78, 32, '#00f2fe', 'typewriter'),
      sticker('sticker_1', '促销标签', '新品上市', 'purple', 2, 14, 80, 18, 1.1),
      audio('audio_1', bgm, 0.8)
    ];
  } else if (template === 'split') {
    layers = [
      media('media_1', '模特展示图', '/clothing_model.png', { y: 48, scale: 1.05 }),
      text('text_1', '文案 (法式优雅)', '法式复古 · 优雅风度', 0.5, 14.5, 82, 36, '#ffb703', 'slide'),
      sticker('sticker_1', '爆款标签', '年度爆款', 'gold', 1, 15, 20, 15, 1.2),
      audio('audio_1', bgm, 0.7)
    ];
  } else if (template === 'detail') {
    layers = [
      media('media_1', '瑜伽服平铺图', '/clothing_flatlay.png', { y: 45, scale: 0.9 }),
      text('text_1', '文案 (轻盈亲肤)', '轻盈包裹 塑形美背', 1.5, 13.5, 80, 34, '#00f2fe', 'zoom'),
      sticker('sticker_1', '特惠贴纸', '限时特惠', 'cyan', 0.5, 14.5, 82, 15, 1.1),
      audio('audio_1', bgm, 0.6)
    ];
  } else {
    const now = Date.now();
    layers = [
      media(`media_demo_1_${now}`, '🎬 视频片段一 (全身大图)', '/clothing_model.png', { end: 5 }),
      {
        ...media(`media_demo_2_${now}`, '🎬 视频片段二 (半身展示)', '/clothing_model_yoga.png', { start: 5, end: 10 }),
        properties: { src: '/clothing_model_yoga.png', bgRemoved: false, isVideo: false, transitionType: 'fade', transitionDuration: 0.8 }
      },
      {
        ...media(`media_demo_3_${now}`, '🎬 视频片段三 (平铺质感)', '/clothing_flatlay.png', { start: 10 }),
        properties: { src: '/clothing_flatlay.png', bgRemoved: false, isVideo: false, transitionType: 'slideLeft', transitionDuration: 0.8 }
      },
      text(`text_demo_1_${now}`, '过渡演示文案', '丝滑视频片段转场过渡演示', 1.5, 13.5, 82, 28, '#00f2fe', 'zoom'),
      audio(`audio_demo_${now}`, bgm, 0.6)
    ];
  }

  const logo = media(`logo_layer_${Date.now()}`, '品牌 LOGO', '/logo.png', { end: 1 });
  return [logo, ...layers];
}
