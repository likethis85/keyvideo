import type { CanvasNodeData, CanvasConnection } from '../types/canvas';

/**
 * 获取节点的真实渲染尺寸评估值（按节点类型与内容自适应）
 * 解决卡片实际 DOM 高度（含视频播放器、状态、标签、操作按钮）大于预设 height 导致卡片上下遮挡重叠的问题
 */
export function getNodeDimensions(node: CanvasNodeData): { width: number; height: number } {
  const width = Math.max(node.width || (node.type === 'prompt' ? 280 : 300), 260);
  let height = 300;

  switch (node.type) {
    case 'video':
      // 视频节点紧凑自适应高度：头部(~38px) + 视频播放器(250px) + 边距与芯片(~46px) = ~338px
      height = 338;
      break;
    case 'image':
      // 生图/试衣节点：头部(~38px) + 图片预览(220px) + 操作工具条(~38px) + 芯片(~30px) + 边距 = ~338px
      height = 338;
      break;
    case 'clothing':
      // 服装原料节点：头部(~38px) + 预览/上传(200px) + 类型选择器(~36px) + 边距 = ~300px
      height = 300;
      break;
    case 'prompt':
      // 提示词节点：头部(~38px) + 文本域(90px) + 预设提示词标签(~50px) = ~210px
      height = 210;
      break;
    default:
      height = 300;
  }

  return { width, height };
}

/**
 * 检测两个节点在 2D 平面上是否存在几何重叠（含安全 Padding 边距）
 */
export function doNodesOverlap(
  a: CanvasNodeData,
  b: CanvasNodeData,
  padding: number = 24
): boolean {
  const aDims = getNodeDimensions(a);
  const bDims = getNodeDimensions(b);

  return !(
    a.position.x + aDims.width + padding <= b.position.x ||
    b.position.x + bDims.width + padding <= a.position.x ||
    a.position.y + aDims.height + padding <= b.position.y ||
    b.position.y + bDims.height + padding <= a.position.y
  );
}

/**
 * 防重叠修正算法 (Non-overlapping separator)
 * 遍历所有节点，一旦检测到两节点重叠或过于贴近，智能将下方节点下移，确保垂直间距至少达到 minGapY。
 * 保护既有工作流布局的同时，彻底解决卡片上下互相压盖遮挡、芯片信息被切除的问题。
 */
export function resolveNodeOverlaps(
  nodes: CanvasNodeData[],
  minGapY: number = 48
): CanvasNodeData[] {
  if (nodes.length <= 1) return nodes;

  // 1. 获取所有节点准确边界与深拷贝
  const result = nodes.map(n => {
    const dims = getNodeDimensions(n);
    return {
      ...n,
      width: dims.width,
      height: dims.height,
      position: { ...n.position }
    };
  });

  let hasOverlap = true;
  let iterations = 0;
  const maxIterations = 35;

  while (hasOverlap && iterations < maxIterations) {
    hasOverlap = false;
    iterations++;

    // 按纵向 Y 坐标从上至下排序索引，实现级联平滑下推
    const sortedIndices = result
      .map((_, i) => i)
      .sort((a, b) => result[a].position.y - result[b].position.y);

    for (let idxA = 0; idxA < sortedIndices.length; idxA++) {
      for (let idxB = idxA + 1; idxB < sortedIndices.length; idxB++) {
        const i = sortedIndices[idxA];
        const j = sortedIndices[idxB];
        const nodeA = result[i];
        const nodeB = result[j];

        const dimsA = getNodeDimensions(nodeA);
        const dimsB = getNodeDimensions(nodeB);

        // 检测横向投影是否存在重合或过于贴近
        const xOverlap = !(
          nodeA.position.x + dimsA.width + 16 <= nodeB.position.x ||
          nodeB.position.x + dimsB.width + 16 <= nodeA.position.x
        );

        if (xOverlap) {
          // nodeA 在上方，nodeB 在下方
          const neededY = nodeA.position.y + dimsA.height + minGapY;
          if (nodeB.position.y < neededY) {
            hasOverlap = true;
            nodeB.position.y = neededY;
          }
        }
      }
    }
  }

  return result;
}

/**
 * 智能拓扑自动整理与对齐 (Topological Layered Auto-Layout)
 * 按照「服装原料/提示词(Col 1) ➔ 模特试衣(Col 2) ➔ 分镜视频(Col 3) ➔ 导出图层」
 * 进行专业层级分列排版，各列横向间距 380px，列内各节点纵向充裕间距 80px，绝不发生重叠。
 */
export function autoLayoutCanvasNodes(
  nodes: CanvasNodeData[],
  connections: CanvasConnection[]
): CanvasNodeData[] {
  if (nodes.length === 0) return [];

  // 1. 初始化入度与出度
  const inDegree: Record<string, number> = {};
  const outgoing: Record<string, string[]> = {};
  nodes.forEach(n => {
    inDegree[n.id] = 0;
    outgoing[n.id] = [];
  });

  connections.forEach(c => {
    if (inDegree[c.toNodeId] !== undefined) {
      inDegree[c.toNodeId]++;
    }
    if (outgoing[c.fromNodeId]) {
      outgoing[c.fromNodeId].push(c.toNodeId);
    }
  });

  // 2. 根据节点类型和连接关系赋予拓扑层级 (Level)
  const nodeLevel: Record<string, number> = {};
  nodes.forEach(n => {
    if (n.type === 'clothing') {
      nodeLevel[n.id] = 0;
    } else if (n.type === 'prompt' && inDegree[n.id] === 0) {
      nodeLevel[n.id] = 0;
    } else if (n.type === 'workflow') {
      nodeLevel[n.id] = 1;
    } else if (n.type === 'image') {
      nodeLevel[n.id] = inDegree[n.id] === 0 ? 0 : 1;
    } else if (n.type === 'video') {
      nodeLevel[n.id] = 2;
    } else {
      nodeLevel[n.id] = 1;
    }
  });

  // 拓扑推进：子节点的层级必须大于父节点
  const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (visited.has(currId)) continue;
    visited.add(currId);

    const currLevel = nodeLevel[currId] ?? 0;
    const children = outgoing[currId] || [];
    children.forEach(childId => {
      nodeLevel[childId] = Math.max(nodeLevel[childId] ?? 0, currLevel + 1);
      queue.push(childId);
    });
  }

  // 3. 将节点按层级分组
  const levels: Record<number, CanvasNodeData[]> = {};
  nodes.forEach(node => {
    const lvl = nodeLevel[node.id] ?? 0;
    if (!levels[lvl]) levels[lvl] = [];
    const dims = getNodeDimensions(node);
    levels[lvl].push({
      ...node,
      width: dims.width,
      height: dims.height,
      position: { ...node.position }
    });
  });

  // 4. 计算每列每行的绝对坐标
  const startX = 80;
  const colSpacing = 380;
  const startY = 80;
  const minRowGap = 48;

  const sortedLevels = Object.keys(levels).map(Number).sort((a, b) => a - b);
  const layoutedNodes: CanvasNodeData[] = [];

  sortedLevels.forEach(lvl => {
    const columnNodes = levels[lvl];
    const colX = startX + lvl * colSpacing;
    let currentY = startY;

    columnNodes.forEach(node => {
      const dims = getNodeDimensions(node);
      layoutedNodes.push({
        ...node,
        width: dims.width,
        height: dims.height,
        position: {
          x: colX,
          y: currentY
        }
      });

      currentY += dims.height + minRowGap;
    });
  });

  // 最终做全局二次防重叠校验
  return resolveNodeOverlaps(layoutedNodes, 48);
}
