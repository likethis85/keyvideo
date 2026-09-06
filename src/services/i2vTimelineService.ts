import type { Dispatch, SetStateAction } from 'react';
import type { Layer } from '../components/VideoCanvas';
import type { BgmItem } from '../components/sidebar/AudioTab';
import type { StoryboardItem } from '../types/aiProject';

interface ApplyI2VToTimelineOptions {
  storyboards: StoryboardItem[];
  bgmLibrary: BgmItem[];
  videoDuration: '3s' | '15s';
  videoModel: string;
  storyboardMode: string;
  includeI2VStickers: boolean;
  includeI2VSubtitles: boolean;
  setLayers: Dispatch<SetStateAction<Layer[]>>;
  setSelectedLayerId: (id: string | null) => void;
}

export function applyI2VToTimeline({ storyboards, bgmLibrary, videoDuration, videoModel, storyboardMode, includeI2VStickers, includeI2VSubtitles, setLayers, setSelectedLayerId }: ApplyI2VToTimelineOptions) {
  if (storyboards.length === 0 || storyboards.some(s => !s.videoSrc)) {
    alert('请先完成步骤 2 生成动态分镜视频！');
    return;
  }

  const logoId = `logo_i2v_${Date.now()}`;
  let newLayers: Layer[];

  const firstBgm = bgmLibrary[0];
  const defaultBgmSrc = firstBgm?.src || 'fashion_beat.mp3';
  const defaultBgmName = firstBgm?.name || '动感电音卡点 BGM';

  if (videoDuration === '15s' || videoDuration === '3s') {
    // 15s / 3s 5-Segment Storyboard Stitching Mode
    const isKling15s = videoModel === 'kling-v3-omni' && storyboardMode !== 'individual';
    if (isKling15s) {
      newLayers = [
        // Single continuous video layer
        {
          id: `media_i2v_0_${Date.now()}`,
          type: 'media',
          name: '🎬 可灵15s合成视频',
          start: 0,
          end: 15,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: {
            src: storyboards[0]?.videoSrc || '/video.mp4',
            isVideo: true,
            videoStartOffset: 0,
            videoEndOffset: 15
          }
        },
        // Background Beat Audio track (up to 15s)
        {
          id: `audio_i2v_${Date.now()}`,
          type: 'audio',
          name: defaultBgmName,
          start: 0,
          end: 15,
          visible: true,
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          properties: {
            src: defaultBgmSrc,
            volume: 0.8
          }
        },
        // Brand logo
        {
          id: logoId,
          type: 'media',
          name: '品牌 LOGO',
          start: 0,
          end: 1.5,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: { src: '/logo.png', bgRemoved: false }
        }
      ];
    } else {
      newLayers = [
        // Shot 1: 0s to 3s (3 seconds)
        {
          id: `media_i2v_0_${Date.now()}`,
          type: 'media',
          name: '🎬 分镜一 (全身出场)',
          start: 0,
          end: 3,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: {
            src: storyboards[0]?.videoSrc || '/video.mp4',
            isVideo: true,
            videoStartOffset: 0,
            videoEndOffset: 3
          }
        },
        // Shot 2: 3s to 6s (3 seconds)
        {
          id: `media_i2v_1_${Date.now()}`,
          type: 'media',
          name: '🎬 分镜二 (下身聚焦)',
          start: 3,
          end: 6,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: {
            src: storyboards[1]?.videoSrc || '/video.mp4',
            isVideo: true,
            videoStartOffset: 0,
            videoEndOffset: 3,
            transitionType: 'fade',
            transitionDuration: 0.3
          }
        },
        // Shot 3: 6s to 9s (3 seconds)
        {
          id: `media_i2v_2_${Date.now()}`,
          type: 'media',
          name: '🎬 分镜三 (手部拧捏)',
          start: 6,
          end: 9,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: {
            src: storyboards[2]?.videoSrc || '/video.mp4',
            isVideo: true,
            videoStartOffset: 0,
            videoEndOffset: 3,
            transitionType: 'fade',
            transitionDuration: 0.3
          }
        },
        // Shot 4: 9s to 12s (3 seconds)
        {
          id: `media_i2v_3_${Date.now()}`,
          type: 'media',
          name: '🎬 分镜四 (特写拉回)',
          start: 9,
          end: 12,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: {
            src: storyboards[3]?.videoSrc || '/video.mp4',
            isVideo: true,
            videoStartOffset: 0,
            videoEndOffset: 3,
            transitionType: 'fade',
            transitionDuration: 0.3
          }
        },
        // Shot 5: 12s to 15s (3 seconds)
        {
          id: `media_i2v_4_${Date.now()}`,
          type: 'media',
          name: '🎬 分镜五 (全身定格)',
          start: 12,
          end: 15,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: {
            src: storyboards[4]?.videoSrc || '/video.mp4',
            isVideo: true,
            videoStartOffset: 0,
            videoEndOffset: 3,
            transitionType: 'fade',
            transitionDuration: 0.3
          }
        },
        // Background Beat Audio track (up to 15s)
        {
          id: `audio_i2v_${Date.now()}`,
          type: 'audio',
          name: defaultBgmName,
          start: 0,
          end: 15,
          visible: true,
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          properties: {
            src: defaultBgmSrc,
            volume: 0.8
          }
        },
        // Brand logo
        {
          id: logoId,
          type: 'media',
          name: '品牌 LOGO',
          start: 0,
          end: 1.5,
          visible: true,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1,
          properties: { src: '/logo.png', bgRemoved: false }
        }
      ];
    }

    if (includeI2VSubtitles) {
      newLayers.push(
        // Subtitle 1 (0.5s - 2.5s)
        {
          id: `text_i2v_1_${Date.now()}`,
          type: 'text',
          name: '文案 (全身出场)',
          start: 0.5,
          end: 2.5,
          visible: true,
          x: 50,
          y: 80,
          scale: 1,
          opacity: 1,
          properties: {
            text: '全场景高级感走秀出场展示',
            fontSize: 28,
            color: '#ffffff',
            animation: 'zoom',
            bold: true,
            shadow: true
          }
        },
        // Subtitle 2 (3.5s - 5.5s)
        {
          id: `text_i2v_2_${Date.now()}`,
          type: 'text',
          name: '文案 (下半身聚焦)',
          start: 3.5,
          end: 5.5,
          visible: true,
          x: 50,
          y: 80,
          scale: 1,
          opacity: 1,
          properties: {
            text: '下半身聚焦 展现下装版型',
            fontSize: 28,
            color: '#00f2fe',
            animation: 'typewriter',
            bold: true,
            shadow: true
          }
        },
        // Subtitle 3 (6.5s - 8.5s)
        {
          id: `text_i2v_3_${Date.now()}`,
          type: 'text',
          name: '文案 (面料细节)',
          start: 6.5,
          end: 8.5,
          visible: true,
          x: 50,
          y: 80,
          scale: 1,
          opacity: 1,
          properties: {
            text: '微距对准手部 呈现面料质地',
            fontSize: 28,
            color: '#ff007f',
            animation: 'slide',
            bold: true,
            shadow: true
          }
        },
        // Subtitle 4 (9.5s - 11.5s)
        {
          id: `text_i2v_4_${Date.now()}`,
          type: 'text',
          name: '文案 (全身拉回)',
          start: 9.5,
          end: 11.5,
          visible: true,
          x: 50,
          y: 80,
          scale: 1,
          opacity: 1,
          properties: {
            text: '特写拉回全身 完美身姿舒展',
            fontSize: 28,
            color: '#00ff66',
            animation: 'zoom',
            bold: true,
            shadow: true
          }
        },
        // Subtitle 5 (12.5s - 14.5s)
        {
          id: `text_i2v_5_${Date.now()}`,
          type: 'text',
          name: '文案 (全新定格)',
          start: 12.5,
          end: 14.5,
          visible: true,
          x: 50,
          y: 80,
          scale: 1,
          opacity: 1,
          properties: {
            text: '优雅站立定格 完美呈现穿搭',
            fontSize: 28,
            color: '#ffaa00',
            animation: 'typewriter',
            bold: true,
            shadow: true
          }
        }
      );
    }

    if (includeI2VStickers) {
      newLayers.push({
        id: `sticker_i2v_${Date.now()}`,
        type: 'sticker',
        name: 'AI 贴纸',
        start: 0,
        end: 15,
        visible: true,
        x: 80,
        y: 15,
        scale: 1.1,
        opacity: 1,
        properties: {
          text: '图生视频合成',
          style: 'purple'
        }
      });
    }
  } else {
    // 4s Loop (3 segments = 12s total)
    newLayers = [
      // Shot 1: Full-body (0s to 4s)
      {
        id: `media_i2v_0_${Date.now()}`,
        type: 'media',
        name: '🎬 视频分镜一 (全身展示)',
        start: 0,
        end: 4,
        visible: true,
        x: 50,
        y: 50,
        scale: 1.0,
        opacity: 1,
        properties: {
          src: storyboards[0]?.videoSrc || '/video.mp4',
          isVideo: true,
          videoStartOffset: 0,
          videoEndOffset: 4
        }
      },
      // Shot 2: Medium (4s to 8s)
      {
        id: `media_i2v_1_${Date.now()}`,
        type: 'media',
        name: '🎬 视频分镜二 (半身中景)',
        start: 4,
        end: 8,
        visible: true,
        x: 50,
        y: 50,
        scale: 1.0,
        opacity: 1,
        properties: {
          src: storyboards[1]?.videoSrc || '/video.mp4',
          isVideo: true,
          videoStartOffset: 0,
          videoEndOffset: 4,
          transitionType: 'fade',
          transitionDuration: 0.5
        }
      },
      // Shot 3: Close-Up (8s to 12s)
      {
        id: `media_i2v_2_${Date.now()}`,
        type: 'media',
        name: '🎬 视频分镜三 (细节特写)',
        start: 8,
        end: 12,
        visible: true,
        x: 50,
        y: 50,
        scale: 1.0,
        opacity: 1,
        properties: {
          src: storyboards[2]?.videoSrc || '/video.mp4',
          isVideo: true,
          videoStartOffset: 0,
          videoEndOffset: 4,
          transitionType: 'fade',
          transitionDuration: 0.5
        }
      },
      // Background Beat Audio track
      {
        id: `audio_i2v_${Date.now()}`,
        type: 'audio',
        name: defaultBgmName,
        start: 0,
        end: 12,
        visible: true,
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        properties: {
          src: defaultBgmSrc,
          volume: 0.8
        }
      },
      {
        id: logoId,
        type: 'media',
        name: '品牌 LOGO',
        start: 0,
        end: 1,
        visible: true,
        x: 50,
        y: 50,
        scale: 1.0,
        opacity: 1,
        properties: { src: '/logo.png', bgRemoved: false }
      }
    ];

    if (includeI2VSubtitles) {
      newLayers.push(
        // Subtitle 1 (0.5s - 3.5s)
        {
          id: `text_i2v_1_${Date.now()}`,
          type: 'text',
          name: '文案 (全身展示)',
          start: 0.5,
          end: 3.5,
          visible: true,
          x: 50,
          y: 80,
          scale: 1,
          opacity: 1,
          properties: {
            text: '全场景高级感模特上身展示',
            fontSize: 28,
            color: '#ffffff',
            animation: 'zoom',
            bold: true,
            shadow: true
          }
        },
        // Subtitle 2 (4.5s - 7.5s)
        {
          id: `text_i2v_2_${Date.now()}`,
          type: 'text',
          name: '文案 (半身版型)',
          start: 4.5,
          end: 7.5,
          visible: true,
          x: 50,
          y: 80,
          scale: 1,
          opacity: 1,
          properties: {
            text: '智能模特贴合 剪裁显瘦版型',
            fontSize: 28,
            color: '#00f2fe',
            animation: 'typewriter',
            bold: true,
            shadow: true
          }
        },
        // Subtitle 3 (8.5s - 11.5s)
        {
          id: `text_i2v_3_${Date.now()}`,
          type: 'text',
          name: '文案 (面料细节)',
          start: 8.5,
          end: 11.5,
          visible: true,
          x: 50,
          y: 80,
          scale: 1,
          opacity: 1,
          properties: {
            text: '大师级车线走工 细节清晰可见',
            fontSize: 28,
            color: '#ff007f',
            animation: 'slide',
            bold: true,
            shadow: true
          }
        }
      );
    }

    if (includeI2VStickers) {
      newLayers.push({
        id: `sticker_i2v_${Date.now()}`,
        type: 'sticker',
        name: 'AI 贴纸',
        start: 0,
        end: 12,
        visible: true,
        x: 80,
        y: 15,
        scale: 1.1,
        opacity: 1,
        properties: {
          text: '图生视频合成',
          style: 'purple'
        }
      });
    }
  }

  setLayers(newLayers);
  setSelectedLayerId(logoId);

  const autoItems = [];
  if (includeI2VSubtitles) autoItems.push('卖点字幕');
  if (includeI2VStickers) autoItems.push('AI 贴纸');
  const autoStr = autoItems.length > 0 ? `并自动配置音轨与${autoItems.join('、')}` : '并自动配置音轨';
  alert(videoDuration === '15s' || videoDuration === '3s'
    ? `一键拼接 15s 分镜视频大功告成！5 段视频分镜已拼接${autoStr}，您现在可以点击画布底部的播放按钮观看，或直接导出视频！`
    : `一键拼接分镜视频大功告成！三段视频分镜已拼接${autoStr}，您现在可以点击画布底部的播放按钮观看，或直接导出视频！`);
}
