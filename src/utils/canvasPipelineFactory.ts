import type { CanvasNodeData, CanvasConnection } from '../types/canvas';
import type { Layer } from '../components/VideoCanvas';

/**
 * Creates a Multi-Model Comparison Pipeline branching out from a clothing or image source node.
 * Spawns 3 diverse model archetypes (East Asian female, Western female, Minimalist male) + 1 shared prompt node.
 */
export function createMultiModelComparisonPipeline(
  sourceNode: CanvasNodeData,
  basePrompt?: string
): { nodes: CanvasNodeData[]; connections: CanvasConnection[] } {
  const newNodes: CanvasNodeData[] = [];
  const newConns: CanvasConnection[] = [];
  const timestamp = Date.now();

  const startX = sourceNode.position.x + 380;
  let startY = sourceNode.position.y - 120;
  if (startY < 40) startY = 40;

  // 1. Shared Prompt Node (Above the comparison column)
  const promptId = `prompt_cmp_${timestamp}`;
  const promptText = basePrompt || `${sourceNode.title}，高级电商穿搭大片，顶级光影质感，全景与细节双重呈现`;
  
  newNodes.push({
    id: promptId,
    type: 'prompt',
    title: '✍️ 对比提示词 (全局共享)',
    position: { x: startX, y: startY },
    width: 280,
    height: 180,
    metadata: {
      text: promptText,
      role: 'master',
      tags: ['多模特对比', '共享光影']
    }
  });

  // Connect sourceNode to promptNode
  newConns.push({
    id: `conn_${sourceNode.id}_${promptId}`,
    fromNodeId: sourceNode.id,
    toNodeId: promptId,
    label: '款式输入'
  });

  // 2. Three Model Comparison Nodes
  const models = [
    {
      title: '东亚优雅超模 (影棚柔光)',
      gender: 'female' as const,
      region: 'east-asian' as const,
      scene: '高端极简电商影棚自然柔光漫反射',
      tag: '东亚女模 · 优雅',
      fallbackImg: sourceNode.metadata.imageSrc || '/clothing_model.png'
    },
    {
      title: '欧美摩登超模 (高街侧逆光)',
      gender: 'female' as const,
      region: 'western' as const,
      scene: '米兰时装周米白石材街景柔和逆光',
      tag: '欧美超模 · 摩登',
      fallbackImg: '/clothing_model_yoga.png'
    },
    {
      title: '高级先锋男模 (冷灰几何)',
      gender: 'male' as const,
      region: 'east-asian' as const,
      scene: '现代艺术空间冷灰几何结构与环境光',
      tag: '高级男模 · 廓形',
      fallbackImg: '/clothing_flatlay.png'
    }
  ];

  const cardHeight = 340;
  const gap = 36;
  const colX = startX + 340;

  models.forEach((m, idx) => {
    const cardY = startY + idx * (cardHeight + gap);
    const modelNodeId = `img_cmp_${idx}_${timestamp}`;

    newNodes.push({
      id: modelNodeId,
      type: 'image',
      title: `🖼️ 候选模特 ${idx + 1}: ${m.title}`,
      position: { x: colX, y: cardY },
      width: 280,
      height: cardHeight,
      status: 'idle',
      metadata: {
        imageSrc: m.fallbackImg,
        modelGender: m.gender,
        modelRegion: m.region,
        modelScene: m.scene,
        aspectRatio: '9:16',
        isComparisonBranch: true,
        comparisonArchetype: m.tag,
        tags: [m.tag, '待评选']
      }
    });

    // Connection from source clothing/image
    newConns.push({
      id: `conn_${sourceNode.id}_${modelNodeId}`,
      fromNodeId: sourceNode.id,
      toNodeId: modelNodeId,
      label: '款式原料'
    });

    // Connection from shared prompt
    newConns.push({
      id: `conn_${promptId}_${modelNodeId}`,
      fromNodeId: promptId,
      toNodeId: modelNodeId,
      label: '光影指令'
    });
  });

  return { nodes: newNodes, connections: newConns };
}

/**
 * Creates a Batch 4-View Generation Pipeline (Full Body, 45° Medium, Fabric Macro, Back View).
 */
export function createBatchFourViewPipeline(
  sourceNode: CanvasNodeData
): { nodes: CanvasNodeData[]; connections: CanvasConnection[] } {
  const newNodes: CanvasNodeData[] = [];
  const newConns: CanvasConnection[] = [];
  const timestamp = Date.now();

  const startX = sourceNode.position.x + 360;
  const startY = sourceNode.position.y - 140;

  const views = [
    {
      title: '视角一：正面全身 (Full-body)',
      shotType: 'full-body' as const,
      prompt: '正面广角大景，模特直视前方镜头站立，完整呈现服装整体廓形、衣长比例与垂坠美感。',
      chip: '正面全身',
      sampleImg: sourceNode.metadata.imageSrc || '/clothing_model.png'
    },
    {
      title: '视角二：45°优雅侧姿 (Medium)',
      shotType: 'medium' as const,
      prompt: '中景半身，模特微微侧身45度，轻微微动回眸，展现侧缝剪裁线条与袖型舒展。',
      chip: '45°侧身',
      sampleImg: '/clothing_model_yoga.png'
    },
    {
      title: '视角三：领口面料特写 (Macro Detail)',
      shotType: 'close-up' as const,
      prompt: '极微距微推特写，微调手部动作，浅景深虚化背景，极致聚焦领口车线、暗纹纽扣与高级面料细腻纹理。',
      chip: '微距特写',
      sampleImg: '/clothing_flatlay.png'
    },
    {
      title: '视角四：背面走秀定格 (Back View)',
      shotType: 'full-body' as const,
      prompt: '模特背对镜头站立或缓步向前，重点展示背部破缝、后领标与下摆自然飘逸动态。',
      chip: '背面廓形',
      sampleImg: sourceNode.metadata.imageSrc || '/clothing_shirt.png'
    }
  ];

  const cardHeight = 320;
  const promptHeight = 160;
  const vGap = 28;

  views.forEach((v, idx) => {
    const rowY = Math.max(40, startY + idx * (cardHeight + vGap));
    const pNodeId = `prompt_4v_${idx}_${timestamp}`;
    const imgNodeId = `img_4v_${idx}_${timestamp}`;

    // Prompt Column (X = startX)
    newNodes.push({
      id: pNodeId,
      type: 'prompt',
      title: `✍️ 提示词 · ${v.chip}`,
      position: { x: startX, y: rowY },
      width: 260,
      height: promptHeight,
      metadata: {
        text: v.prompt,
        role: 'shot',
        shotType: v.shotType,
        tags: [v.chip, '分镜运镜']
      }
    });

    // Image Output Column (X = startX + 320)
    newNodes.push({
      id: imgNodeId,
      type: 'image',
      title: `🖼️ ${v.title}`,
      position: { x: startX + 320, y: rowY },
      width: 280,
      height: cardHeight,
      status: 'idle',
      metadata: {
        imageSrc: v.sampleImg,
        shotType: v.shotType,
        aspectRatio: '9:16',
        tags: [v.chip, '电商大片', '可注入时间轴']
      }
    });

    // Connections
    newConns.push({
      id: `conn_${sourceNode.id}_${imgNodeId}`,
      fromNodeId: sourceNode.id,
      toNodeId: imgNodeId,
      label: '主体锚点'
    });

    newConns.push({
      id: `conn_${pNodeId}_${imgNodeId}`,
      fromNodeId: pNodeId,
      toNodeId: imgNodeId,
      label: '构图指令'
    });
  });

  return { nodes: newNodes, connections: newConns };
}

/**
 * Batch Executes the Canvas DAG from inputs to outputs with simulated or API execution.
 */
export async function executePipelineDAG(
  nodes: CanvasNodeData[],
  connections: CanvasConnection[],
  updateNode: (id: string, patch: Partial<CanvasNodeData>) => void,
  onProgress?: (completed: number, total: number) => void
): Promise<{ executedCount: number }> {
  // Find all executable target nodes (image, video, workflow)
  const executableNodes = nodes.filter(n => n.type === 'image' || n.type === 'video' || n.type === 'workflow');
  if (executableNodes.length === 0) return { executedCount: 0 };

  let completed = 0;
  const total = executableNodes.length;
  onProgress?.(0, total);

  for (const node of executableNodes) {
    updateNode(node.id, { status: 'loading' });

    // Simulate step execution delay
    await new Promise(r => setTimeout(r, 600));

    // Find upstream source image if any
    const incoming = connections.filter(c => c.toNodeId === node.id);
    const upstreamNode = nodes.find(n => incoming.some(c => c.fromNodeId === n.id));
    const fallbackImage = upstreamNode?.metadata.imageSrc || node.metadata.imageSrc || '/clothing_model.png';

    if (node.type === 'image') {
      updateNode(node.id, {
        status: 'success',
        metadata: {
          ...node.metadata,
          imageSrc: fallbackImage
        }
      });
    } else if (node.type === 'video') {
      updateNode(node.id, {
        status: 'success',
        metadata: {
          ...node.metadata,
          imageSrc: fallbackImage,
          duration: node.metadata.duration || '3s'
        }
      });
    } else {
      updateNode(node.id, { status: 'success' });
    }

    completed++;
    onProgress?.(completed, total);
  }

  return { executedCount: completed };
}

/**
 * Batch syncs valid media nodes from the Canvas directly into sequential tracks in the Timeline.
 */
export function batchSyncCanvasToTimeline({
  nodes,
  currentTime,
  layers,
  setLayers,
  commitHistory
}: {
  nodes: CanvasNodeData[];
  currentTime: number;
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  commitHistory: (layers: Layer[], desc: string) => void;
}): number {
  // Collect all nodes with valid imageSrc or videoSrc
  const validNodes = nodes.filter(n => 
    (n.type === 'image' && Boolean(n.metadata.imageSrc)) ||
    (n.type === 'video' && (Boolean(n.metadata.videoSrc) || Boolean(n.metadata.imageSrc)))
  );

  if (validNodes.length === 0) return 0;

  let currentCursor = currentTime >= 0 ? currentTime : 0;
  const updatedLayers = [...layers];

  validNodes.forEach((node, idx) => {
    const isVideo = node.type === 'video' && Boolean(node.metadata.videoSrc);
    const duration = 3.0; // Standard 3s shot rhythm
    const layerStart = currentCursor;
    const layerEnd = currentCursor + duration;
    currentCursor = layerEnd;

    const newLayerId = `layer_canvas_batch_${node.id}_${Date.now()}`;
    const newLayer: Layer = {
      id: newLayerId,
      type: 'media',
      name: `🎬 分镜 ${idx + 1} (${node.title})`,
      start: layerStart,
      end: layerEnd,
      visible: true,
      x: 50,
      y: 50,
      scale: 1,
      opacity: 1,
      properties: {
        src: (node.metadata.videoSrc || node.metadata.imageSrc) as string,
        isVideo,
        videoStartOffset: 0,
        videoEndOffset: duration,
        transitionType: idx > 0 ? 'fade' : 'none',
        transitionDuration: 0.5,
        bgRemoved: false
      }
    };

    // Replace if same exists or push
    const existingIdx = updatedLayers.findIndex(l => l.id === newLayerId);
    if (existingIdx !== -1) {
      updatedLayers[existingIdx] = newLayer;
    } else {
      updatedLayers.push(newLayer);
    }
  });

  setLayers(updatedLayers);
  commitHistory(updatedLayers, `批量导入画布 ${validNodes.length} 个分镜至时间轴`);
  return validNodes.length;
}
