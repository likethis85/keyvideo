import type { AIProject, StoryboardItem } from '../types/aiProject';
import type { CanvasNodeData, CanvasConnection } from '../types/canvas';
import type { Layer } from '../components/VideoCanvas';
import { localDB } from './db';
import { resolveNodeOverlaps } from './canvasLayout';

import { parseFiveShotPrompt } from '../services/storyboardPromptParser';

/**
 * 将 KeyVideo 的 AIProject 数据对象转换为结构化的无限画布节点拓扑图
 */
export function convertAiProjectToCanvas(project: AIProject): {
  nodes: CanvasNodeData[];
  connections: CanvasConnection[];
} {
  const nodes: CanvasNodeData[] = [];
  const connections: CanvasConnection[] = [];

  let nextId = 1;
  const genId = (prefix: string) => `${prefix}_${Date.now()}_${nextId++}`;

  // 1. 服装与原料节点列 (X = 60)
  let topClothingNodeId: string | null = null;
  if (project.topClothingUrl) {
    topClothingNodeId = genId('node_clothing_top');
    nodes.push({
      id: topClothingNodeId,
      type: 'clothing',
      title: '上装参考',
      position: { x: 60, y: 60 },
      width: 260,
      height: 340,
      metadata: {
        clothingType: 'top',
        imageSrc: project.topClothingUrl,
        tags: ['上装', '原料输入']
      }
    });
  }

  let bottomClothingNodeId: string | null = null;
  if (project.bottomClothingUrl) {
    bottomClothingNodeId = genId('node_clothing_bottom');
    nodes.push({
      id: bottomClothingNodeId,
      type: 'clothing',
      title: '下装参考',
      position: { x: 60, y: 440 },
      width: 260,
      height: 340,
      metadata: {
        clothingType: 'bottom',
        imageSrc: project.bottomClothingUrl,
        tags: ['下装', '原料输入']
      }
    });
  }

  // 模特穿搭参考原图（如果用户上传了模特试衣穿搭参考图）
  let refOutfitNodeId: string | null = null;
  const refOutfitUrl = project.referenceOutfitUrl || (project.referenceOutfitUrls && project.referenceOutfitUrls[0]);
  if (refOutfitUrl) {
    refOutfitNodeId = genId('node_outfit_ref');
    nodes.push({
      id: refOutfitNodeId,
      type: 'image',
      title: '模特穿搭参考图',
      position: { x: 60, y: 820 },
      width: 260,
      height: 340,
      metadata: {
        imageSrc: refOutfitUrl,
        tags: ['穿搭参考', '主体一致性']
      }
    });
  }

  // 2. 场景空间图 (环境锚点，X = 60)
  const sceneNodeId = genId('node_scene');
  nodes.push({
    id: sceneNodeId,
    type: 'image',
    title: '场景环境空间图',
    position: { x: 60, y: refOutfitNodeId ? 1200 : 820 },
    width: 260,
    height: 340,
    metadata: {
      imageSrc: project.sceneImgUrl || undefined,
      text: project.modelScene || project.i2vMasterPrompt15s || '高端极简电商影棚，自然柔光，专业摄影级质感',
      tags: ['场景图', '环境锚点']
    }
  });

  // 3. AI 试衣合成中继节点 (模特穿搭主图·主体锚点，X = 380)
  const tryOnNodeId = genId('node_tryon');
  const outfitMainImg = project.modelOutfitImgUrl || refOutfitUrl || undefined;
  nodes.push({
    id: tryOnNodeId,
    type: 'image',
    title: 'AI 试衣合成 (模特穿搭主图)',
    position: { x: 380, y: 260 },
    width: 280,
    height: 340,
    status: project.isOutfitImgGenerating ? 'loading' : outfitMainImg ? 'success' : 'idle',
    metadata: {
      imageSrc: outfitMainImg,
      modelGender: project.modelGender,
      modelRegion: project.modelRegion,
      modelScene: project.modelScene,
      aspectRatio: '9:16',
      tags: ['主体锚点', '穿搭主图']
    }
  });

  // 连接原料、参考图与场景图至试衣主图节点
  if (topClothingNodeId) {
    connections.push({
      id: `conn_${topClothingNodeId}_${tryOnNodeId}`,
      fromNodeId: topClothingNodeId,
      toNodeId: tryOnNodeId,
      label: '上装'
    });
  }
  if (bottomClothingNodeId) {
    connections.push({
      id: `conn_${bottomClothingNodeId}_${tryOnNodeId}`,
      fromNodeId: bottomClothingNodeId,
      toNodeId: tryOnNodeId,
      label: '下装'
    });
  }
  if (refOutfitNodeId) {
    connections.push({
      id: `conn_${refOutfitNodeId}_${tryOnNodeId}`,
      fromNodeId: refOutfitNodeId,
      toNodeId: tryOnNodeId,
      label: '穿搭参考'
    });
  }
  connections.push({
    id: `conn_${sceneNodeId}_${tryOnNodeId}`,
    fromNodeId: sceneNodeId,
    toNodeId: tryOnNodeId,
    label: '场景光影'
  });

  // 4. 全要素五幕分镜：解耦展开 (Col 3: 提示词 -> Col 4: 分镜静态图 -> Col 5: 分镜视频成片)
  const defaultShots: StoryboardItem[] = [
    { id: 'shot_1', name: '全景走秀出场 (0-3s)', shotType: 'full-body', imageSrc: '', videoSrc: null, isGeneratingVideo: false, progress: 0 },
    { id: 'shot_2', name: '下半身与面料聚焦 (3-6s)', shotType: 'close-up', imageSrc: '', videoSrc: null, isGeneratingVideo: false, progress: 0 },
    { id: 'shot_3', name: '手部与版型细节 (6-9s)', shotType: 'medium', imageSrc: '', videoSrc: null, isGeneratingVideo: false, progress: 0 },
    { id: 'shot_4', name: '侧面回眸微动 (9-12s)', shotType: 'medium', imageSrc: '', videoSrc: null, isGeneratingVideo: false, progress: 0 },
    { id: 'shot_5', name: '正面定格谢幕 (12-15s)', shotType: 'full-body', imageSrc: '', videoSrc: null, isGeneratingVideo: false, progress: 0 }
  ];
  const storyboards = (project.storyboards && project.storyboards.length > 0) ? project.storyboards : defaultShots;
  const sbNodeHeight = 340;
  const sbVerticalGap = 48;
  const parsedPrompts = parseFiveShotPrompt(project.i2vMasterPrompt15s || '');

  storyboards.forEach((sb, index) => {
    const shotKey = `shot-${index + 1}` as keyof typeof parsedPrompts;
    const shotPrompt = (project.i2vPrompts && (project.i2vPrompts as Record<string, string>)[shotKey])
      || parsedPrompts[shotKey]
      || '';

    const posY = 60 + index * (sbNodeHeight + sbVerticalGap);

    // 要素 3: 分镜提示词节点 (Col 3, X = 720)
    const sbPromptNodeId = genId(`node_storyboard_prompt_${index + 1}`);
    nodes.push({
      id: sbPromptNodeId,
      type: 'prompt',
      title: `✍️ 提示词 · 第 ${index + 1} 幕`,
      position: { x: 720, y: posY },
      width: 270,
      height: 210,
      metadata: {
        text: shotPrompt,
        role: 'shot',
        shotType: sb.shotType,
        tags: ['运镜指令', sb.shotType]
      }
    });

    // 要素 4: 分镜关键帧图像节点 (Col 4, X = 1050)
    const sbImgNodeId = genId(`node_storyboard_img_${index + 1}`);
    nodes.push({
      id: sbImgNodeId,
      type: 'image',
      title: `🖼️ 分镜图 · 第 ${index + 1} 幕: ${sb.name}`,
      position: { x: 1050, y: posY },
      width: 290,
      height: sbNodeHeight,
      status: sb.isGeneratingImage ? 'loading' : sb.imageSrc ? 'success' : 'idle',
      metadata: {
        shotType: sb.shotType,
        imageSrc: sb.imageSrc,
        aspectRatio: '9:16',
        tags: ['分镜首帧', sb.shotType]
      }
    });

    // 要素 5: 分镜动态视频成片节点 (Col 5, X = 1400)
    const sbVideoNodeId = genId(`node_storyboard_video_${index + 1}`);
    nodes.push({
      id: sbVideoNodeId,
      type: 'video',
      title: `🎬 分镜视频 · 第 ${index + 1} 幕: ${sb.name}`,
      position: { x: 1400, y: posY },
      width: 300,
      height: sbNodeHeight,
      status: sb.isGeneratingVideo ? 'loading' : sb.videoSrc ? 'success' : 'idle',
      metadata: {
        shotType: sb.shotType,
        imageSrc: sb.imageSrc,
        videoSrc: sb.videoSrc || null,
        videoTaskId: sb.videoTaskId,
        duration: project.videoDuration || '3s',
        tags: ['3s 成片', sb.shotType]
      }
    });

    // 严谨贝塞尔数据连线流转：
    // 1. 模特穿搭主图 -> 分镜静态图 (主体锚点一致性)
    connections.push({
      id: `conn_${tryOnNodeId}_${sbImgNodeId}`,
      fromNodeId: tryOnNodeId,
      toNodeId: sbImgNodeId,
      label: '主体锚点'
    });

    // 2. 场景图 -> 分镜静态图 (环境空间一致性)
    connections.push({
      id: `conn_${sceneNodeId}_${sbImgNodeId}`,
      fromNodeId: sceneNodeId,
      toNodeId: sbImgNodeId,
      label: '环境锁定'
    });

    // 3. 分镜提示词 -> 分镜静态图 (构图与姿态指令)
    connections.push({
      id: `conn_${sbPromptNodeId}_${sbImgNodeId}`,
      fromNodeId: sbPromptNodeId,
      toNodeId: sbImgNodeId,
      label: '构图指令'
    });

    // 4. 分镜提示词 -> 分镜视频 (动态运镜与微动指令)
    connections.push({
      id: `conn_${sbPromptNodeId}_${sbVideoNodeId}`,
      fromNodeId: sbPromptNodeId,
      toNodeId: sbVideoNodeId,
      label: '运镜微动'
    });

    // 5. 分镜静态图 -> 分镜视频 (作为 I2V 图生视频首帧)
    connections.push({
      id: `conn_${sbImgNodeId}_${sbVideoNodeId}`,
      fromNodeId: sbImgNodeId,
      toNodeId: sbVideoNodeId,
      label: '首帧生视频'
    });
  });

  // 最终执行防重叠几何校验，杜绝任何图层层叠
  return {
    nodes: resolveNodeOverlaps(nodes, 48),
    connections
  };
}

/**
 * 将画布节点的产物（视频/图片）无缝注入到现有的剪辑时间线中，创建对应图层
 */
export function injectCanvasAssetToTimeline({
  node,
  currentTime,
  layers,
  setLayers,
  commitHistory
}: {
  node: CanvasNodeData;
  currentTime: number;
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  commitHistory: (layers: Layer[], desc: string) => void;
}): Layer {
  const isVideo = Boolean(node.metadata.videoSrc);
  const mediaSrc = node.metadata.videoSrc || node.metadata.imageSrc || '';
  const duration = isVideo ? 3 : 4;

  const newLayer: Layer = {
    id: `canvas_asset_${Date.now()}`,
    type: 'media',
    name: node.title || (isVideo ? '画布视频片段' : '画布合成图像'),
    start: currentTime,
    end: Math.min(15, currentTime + duration),
    visible: true,
    x: 50,
    y: 50,
    scale: 1,
    opacity: 1,
    properties: {
      src: mediaSrc,
      isVideo,
      animation: 'fade',
      speed: 1,
      volume: 1
    }
  };

  const updatedLayers = [...layers, newLayer];
  setLayers(updatedLayers);
  commitHistory(updatedLayers, `从画布导入「${newLayer.name}」`);
  return newLayer;
}

/**
 * 自动生成 5 镜完整全要素解耦电商管线节点拓扑
 * (包含：穿搭原料图、模特穿搭主图、场景图、分镜提示词、分镜首帧图、分镜成片视频)
 */
export function generateCanvasPipeline(
  theme: string = '法式复古小黑裙通勤穿搭',
  clothImageSrc?: string,
  sceneImageSrc?: string,
  modelOutfitImgSrc?: string
): {
  nodes: CanvasNodeData[];
  connections: CanvasConnection[];
} {
  const nodes: CanvasNodeData[] = [];
  const connections: CanvasConnection[] = [];

  // 1. 服装原料节点 (Col 1, X = 60, Y = 100)
  const clothId = `cloth_${Date.now()}`;
  nodes.push({
    id: clothId,
    type: 'clothing',
    title: `服装原料 · ${theme}`,
    position: { x: 60, y: 100 },
    width: 260,
    height: 320,
    metadata: {
      imageSrc: clothImageSrc || '',
      clothingType: 'top',
      tags: ['原料', theme]
    }
  });

  // 2. 场景参考图节点 (Col 1, X = 60, Y = 480)
  const sceneId = `scene_${Date.now()}`;
  nodes.push({
    id: sceneId,
    type: 'image',
    title: `场景空间参考图 · 现代光影`,
    position: { x: 60, y: 480 },
    width: 260,
    height: 320,
    metadata: {
      imageSrc: sceneImageSrc || '',
      text: `${theme}配套的高端极简影棚背景，自然柔光漫反射，空间景深适度`,
      tags: ['场景图', '环境锚点']
    }
  });

  // 3. 模特穿搭主图 (Col 2, X = 380, Y = 280, 主体锚点)
  const outfitId = `outfit_${Date.now()}`;
  nodes.push({
    id: outfitId,
    type: 'image',
    title: `AI 试衣合成 (模特穿搭主图)`,
    position: { x: 380, y: 280 },
    width: 280,
    height: 340,
    metadata: {
      imageSrc: modelOutfitImgSrc || '',
      text: `已穿戴${theme}的专属定制模特，保持全片五官身材与服装版型绝对一致`,
      aspectRatio: '9:16',
      tags: ['主体锚点', '穿搭主图']
    }
  });

  connections.push({ id: `c_${clothId}_${outfitId}`, fromNodeId: clothId, toNodeId: outfitId, label: '试衣搭配' });
  connections.push({ id: `c_${sceneId}_${outfitId}`, fromNodeId: sceneId, toNodeId: outfitId, label: '场景光影' });

  const shots = [
    { title: '镜1：全景入场', type: 'full-body' as const, prompt: `${theme}，优雅模特缓步走入现代采光影棚，全身展示版型剪裁，自然微风轻拂` },
    { title: '镜2：面料特写', type: 'close-up' as const, prompt: `${theme}，微距推进，重点展示领口与高定面料细腻光泽与工艺细节` },
    { title: '镜3：灵动回眸', type: 'medium' as const, prompt: `${theme}，模特轻微侧身回眸微笑，腰身剪裁与裙摆弧度舒展自然` },
    { title: '镜4：半身穿搭', type: 'medium' as const, prompt: `${theme}，半身中景，自信眼神与微表情，体现品牌高级感与垂坠感` },
    { title: '镜5：优雅谢幕', type: 'full-body' as const, prompt: `${theme}，模特驻足定格，全身版型完整呈现，光芒聚焦完美淡出` }
  ];

  shots.forEach((shot, idx) => {
    const y = 60 + idx * 390;
    const pId = `prompt_${idx + 1}_${Date.now()}`;
    const imgId = `image_${idx + 1}_${Date.now()}`;
    const vId = `video_${idx + 1}_${Date.now()}`;

    // 要素 3: 提示词节点 (Col 3, X = 720)
    nodes.push({
      id: pId,
      type: 'prompt',
      title: `✍️ 提示词 · ${shot.title}`,
      position: { x: 720, y },
      width: 270,
      height: 210,
      metadata: { text: shot.prompt, role: 'shot', tags: ['运镜指令', shot.type] }
    });

    // 要素 4: 分镜首帧静态图 (Col 4, X = 1050)
    nodes.push({
      id: imgId,
      type: 'image',
      title: `🖼️ 分镜图 · ${shot.title}`,
      position: { x: 1050, y },
      width: 280,
      height: 340,
      metadata: { aspectRatio: '9:16', shotType: shot.type, tags: ['分镜首帧', shot.type] }
    });

    // 要素 5: 分镜动态视频 (Col 5, X = 1400)
    nodes.push({
      id: vId,
      type: 'video',
      title: `🎬 镜头成片 · ${shot.title}`,
      position: { x: 1400, y },
      width: 300,
      height: 340,
      metadata: { duration: '3s', shotType: shot.type, tags: ['3s 成片', shot.type] }
    });

    // 连线拓扑
    connections.push({ id: `c_${outfitId}_${imgId}`, fromNodeId: outfitId, toNodeId: imgId, label: '主体锚点' });
    connections.push({ id: `c_${sceneId}_${imgId}`, fromNodeId: sceneId, toNodeId: imgId, label: '环境锁定' });
    connections.push({ id: `c_${pId}_${imgId}`, fromNodeId: pId, toNodeId: imgId, label: '构图指令' });
    connections.push({ id: `c_${pId}_${vId}`, fromNodeId: pId, toNodeId: vId, label: '运镜微动' });
    connections.push({ id: `c_${imgId}_${vId}`, fromNodeId: imgId, toNodeId: vId, label: '首帧生视频' });
  });

  return {
    nodes: resolveNodeOverlaps(nodes, 48),
    connections
  };
}

/**
 * 将画布拓扑持久化至 LocalDB
 */
export async function saveCanvasTopologyToLocalDB(
  projectId: string,
  nodes: CanvasNodeData[],
  connections: CanvasConnection[],
  viewport?: { x: number; y: number; scale: number }
) {
  const storageKey = `KEYVIDEO_CANVAS_DATA_${projectId || 'default'}`;
  await localDB.set(storageKey, {
    nodes,
    connections,
    viewport: viewport || { x: 40, y: 30, scale: 0.75 }
  });
}
