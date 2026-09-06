/**
 * KeyVideo Model Context Protocol (MCP) Server
 * Implements JSON-RPC 2.0 stdio protocol for Codex / Claude Code / Antigravity integration.
 * Supports task telemetry and full Infinite Canvas node graph manipulation.
 */
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASK_STORE_PATH = path.join(__dirname, 'tasks_history.json');
const CANVAS_STORE_PATH = path.join(__dirname, 'canvas_state.json');

const getTasks = () => {
  try {
    if (fs.existsSync(TASK_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(TASK_STORE_PATH, 'utf-8'));
    }
  } catch {}
  return {};
};

const getCanvasStore = () => {
  try {
    if (fs.existsSync(CANVAS_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(CANVAS_STORE_PATH, 'utf-8'));
    }
  } catch {}
  return {};
};

const saveCanvasStore = (store) => {
  try {
    fs.writeFileSync(CANVAS_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save canvas store:', err);
  }
};

const getProjectCanvas = (projectId = 'default') => {
  const store = getCanvasStore();
  if (!store[projectId]) {
    store[projectId] = {
      projectId,
      viewport: { x: 80, y: 60, scale: 1 },
      nodes: [],
      connections: [],
      updatedAt: new Date().toISOString()
    };
  }
  return store[projectId];
};

const saveProjectCanvas = (projectId = 'default', canvasData) => {
  const store = getCanvasStore();
  store[projectId] = {
    ...canvasData,
    projectId,
    updatedAt: new Date().toISOString()
  };
  saveCanvasStore(store);
  return store[projectId];
};

const MCP_TOOLS = [
  {
    name: 'keyvideo_get_status',
    description: '获取 KeyVideo 后端服务状态、任务队列概况与画布节点统计',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'keyvideo_list_tasks',
    description: '列出最近的 AI 生图与视频渲染任务记录',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回的最大任务数量，默认为 10' }
      }
    }
  },
  {
    name: 'keyvideo_query_task',
    description: '查询特定 taskId 的状态与生成结果 URL',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务 ID' }
      },
      required: ['taskId']
    }
  },
  // Infinite Canvas Tools (Route B)
  {
    name: 'canvas_get_state',
    description: '读取无限画布的当前状态（包含所有节点 nodes、连线 connections 与视口 viewport）',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID，默认 default' }
      }
    }
  },
  {
    name: 'canvas_add_node',
    description: '向无限画布中新增一个节点（支持 clothing、prompt、image、video、workflow）',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        type: {
          type: 'string',
          enum: ['clothing', 'prompt', 'image', 'video', 'workflow'],
          description: '节点类型'
        },
        title: { type: 'string', description: '节点标题' },
        x: { type: 'number', description: 'X 坐标（世界坐标）' },
        y: { type: 'number', description: 'Y 坐标（世界坐标）' },
        metadata: { type: 'object', description: '节点元数据（如 prompt、imageSrc、aspectRatio 等）' }
      },
      required: ['type', 'title']
    }
  },
  {
    name: 'canvas_connect_nodes',
    description: '在无限画布的两个节点之间建立贝塞尔连线',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        fromNodeId: { type: 'string', description: '起始节点 ID' },
        toNodeId: { type: 'string', description: '目标节点 ID' },
        label: { type: 'string', description: '连线标签描述' }
      },
      required: ['fromNodeId', 'toNodeId']
    }
  },
  {
    name: 'canvas_delete_nodes',
    description: '批量删除无限画布中的指定节点及相关连线',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: '待删除的节点 ID 列表'
        }
      },
      required: ['nodeIds']
    }
  },
  {
    name: 'canvas_generate_storyboard_pipeline',
    description: '一键在无限画布中自动创建完整的 5 镜头电商短视频生成管线（服装 -> 5镜提示词 -> 5镜生图 -> 5镜生视频）',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        theme: { type: 'string', description: '视频主题或穿搭风格（如：法式复古小黑裙通勤穿搭）' },
        clothImageSrc: { type: 'string', description: '服装参考图片 URL（可选）' }
      }
    }
  },
  {
    name: 'canvas_apply_ops',
    description: '批量更新或覆盖无限画布的拓扑结构（节点、连线与视口）',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        nodes: { type: 'array', description: '节点列表' },
        connections: { type: 'array', description: '连线列表' },
        viewport: { type: 'object', description: '视口参数' }
      }
    }
  }
];

const handleToolCall = async (name, args = {}) => {
  const projectId = args.projectId || 'default';

  switch (name) {
    case 'keyvideo_get_status': {
      const tasks = getTasks();
      const taskCount = Object.keys(tasks).length;
      const canvas = getProjectCanvas(projectId);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'online',
            service: 'KeyVideo MCP Gateway with Infinite Canvas',
            version: '2.0.0',
            totalTasksRecorded: taskCount,
            activeCanvas: {
              projectId,
              nodesCount: canvas.nodes?.length || 0,
              connectionsCount: canvas.connections?.length || 0
            }
          }, null, 2)
        }]
      };
    }
    case 'keyvideo_list_tasks': {
      const tasks = getTasks();
      const limit = args.limit || 10;
      const list = Object.values(tasks)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, limit);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(list, null, 2)
        }]
      };
    }
    case 'keyvideo_query_task': {
      const tasks = getTasks();
      const task = tasks[args.taskId];
      if (!task) {
        return {
          isError: true,
          content: [{ type: 'text', text: `未找到任务: ${args.taskId}` }]
        };
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(task, null, 2)
        }]
      };
    }
    case 'canvas_get_state': {
      const canvas = getProjectCanvas(projectId);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(canvas, null, 2)
        }]
      };
    }
    case 'canvas_add_node': {
      const canvas = getProjectCanvas(projectId);
      const nodeId = `node_${args.type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const newNode = {
        id: nodeId,
        type: args.type,
        title: args.title,
        position: {
          x: typeof args.x === 'number' ? args.x : 200 + (canvas.nodes.length % 5) * 60,
          y: typeof args.y === 'number' ? args.y : 180 + (canvas.nodes.length % 5) * 60
        },
        width: args.type === 'prompt' ? 280 : 260,
        height: 320,
        status: 'idle',
        metadata: args.metadata || {}
      };
      canvas.nodes.push(newNode);
      saveProjectCanvas(projectId, canvas);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ message: '节点已成功添加', node: newNode }, null, 2)
        }]
      };
    }
    case 'canvas_connect_nodes': {
      const canvas = getProjectCanvas(projectId);
      const { fromNodeId, toNodeId, label } = args;
      const connId = `conn_${fromNodeId}_${toNodeId}`;
      if (canvas.connections.some(c => c.fromNodeId === fromNodeId && c.toNodeId === toNodeId)) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ message: '连线已存在' }) }]
        };
      }
      const newConn = { id: connId, fromNodeId, toNodeId, label };
      canvas.connections.push(newConn);
      saveProjectCanvas(projectId, canvas);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ message: '连线成功', connection: newConn }, null, 2)
        }]
      };
    }
    case 'canvas_delete_nodes': {
      const canvas = getProjectCanvas(projectId);
      const toDelete = new Set(args.nodeIds || []);
      canvas.nodes = canvas.nodes.filter(n => !toDelete.has(n.id));
      canvas.connections = canvas.connections.filter(c => !toDelete.has(c.fromNodeId) && !toDelete.has(c.toNodeId));
      saveProjectCanvas(projectId, canvas);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ message: `已删除 ${toDelete.size} 个节点及其附属连线` })
        }]
      };
    }
    case 'canvas_generate_storyboard_pipeline': {
      const theme = args.theme || '爆款春季新款穿搭';
      const clothImageSrc = args.clothImageSrc || '';
      const canvas = getProjectCanvas(projectId);

      const shotPresets = [
        { title: '镜1：全景登场', type: 'full-body', prompt: `${theme}，优雅模特缓步走入现代采光影棚，全身展示版型剪裁，自然微风轻拂` },
        { title: '镜2：面料特写', type: 'close-up', prompt: `${theme}，摄像机微距推进，重点展示领口与高级面料细腻纹理，柔和漫反射光感` },
        { title: '镜3：侧身动态', type: 'medium', prompt: `${theme}，模特轻微侧身回眸，展示服装侧边线条与腰身轮廓，光影流转` },
        { title: '镜4：半身展示', type: 'medium', prompt: `${theme}，中景半身，模特自信手势与微表情交互，体现高端品牌格调` },
        { title: '镜5：定格谢幕', type: 'full-body', prompt: `${theme}，模特优雅驻足定格微笑，全身穿搭协调完整，光线聚焦质感高级` }
      ];

      const newNodes = [];
      const newConns = [];

      // 1. 服装原料节点 (Col 1)
      const clothId = `cloth_master_${Date.now()}`;
      newNodes.push({
        id: clothId,
        type: 'clothing',
        title: `服装原料 · ${theme}`,
        position: { x: 60, y: 100 },
        width: 260,
        height: 320,
        status: 'idle',
        metadata: {
          imageSrc: clothImageSrc,
          clothingType: 'top',
          tags: ['原料', theme]
        }
      });

      // 2. 场景空间参考图 (Col 1)
      const sceneId = `scene_master_${Date.now()}`;
      newNodes.push({
        id: sceneId,
        type: 'image',
        title: `场景空间参考图 · 现代光影`,
        position: { x: 60, y: 480 },
        width: 260,
        height: 320,
        status: 'idle',
        metadata: {
          text: `${theme}配套的高端极简影棚背景，自然柔光漫反射，空间景深适度`,
          tags: ['场景图', '环境锚点']
        }
      });

      // 3. 模特穿搭主图 (Col 2, 主体锚点)
      const outfitId = `outfit_master_${Date.now()}`;
      newNodes.push({
        id: outfitId,
        type: 'image',
        title: `AI 试衣合成 (模特穿搭主图)`,
        position: { x: 380, y: 280 },
        width: 280,
        height: 340,
        status: 'idle',
        metadata: {
          text: `已穿戴${theme}的专属定制模特，保持全片五官身材与服装版型绝对一致`,
          aspectRatio: '9:16',
          tags: ['主体锚点', '穿搭主图']
        }
      });

      newConns.push({ id: `conn_${clothId}_${outfitId}`, fromNodeId: clothId, toNodeId: outfitId, label: '试衣搭配' });
      newConns.push({ id: `conn_${sceneId}_${outfitId}`, fromNodeId: sceneId, toNodeId: outfitId, label: '场景光影' });

      // 4. 五幕分镜全要素展开 (Col 3: 提示词 -> Col 4: 分镜图 -> Col 5: 分镜视频)
      shotPresets.forEach((shot, idx) => {
        const rowY = 60 + idx * 390;

        const promptId = `prompt_shot_${idx + 1}_${Date.now()}`;
        const imageId = `image_shot_${idx + 1}_${Date.now()}`;
        const videoId = `video_shot_${idx + 1}_${Date.now()}`;

        newNodes.push({
          id: promptId,
          type: 'prompt',
          title: `✍️ 提示词 · ${shot.title}`,
          position: { x: 720, y: rowY },
          width: 270,
          height: 210,
          status: 'idle',
          metadata: {
            text: shot.prompt,
            role: 'shot',
            shotType: shot.type,
            tags: ['运镜指令', shot.type]
          }
        });

        newNodes.push({
          id: imageId,
          type: 'image',
          title: `🖼️ 分镜图 · ${shot.title}`,
          position: { x: 1050, y: rowY },
          width: 280,
          height: 340,
          status: 'idle',
          metadata: {
            aspectRatio: '9:16',
            shotType: shot.type,
            tags: ['分镜首帧', shot.type]
          }
        });

        newNodes.push({
          id: videoId,
          type: 'video',
          title: `🎬 镜头成片 · ${shot.title}`,
          position: { x: 1400, y: rowY },
          width: 300,
          height: 340,
          status: 'idle',
          metadata: {
            duration: '3s',
            shotType: shot.type,
            tags: ['3s 成片', shot.type]
          }
        });

        // 连线拓扑
        newConns.push({ id: `conn_${outfitId}_${imageId}`, fromNodeId: outfitId, toNodeId: imageId, label: '主体锚点' });
        newConns.push({ id: `conn_${sceneId}_${imageId}`, fromNodeId: sceneId, toNodeId: imageId, label: '环境锁定' });
        newConns.push({ id: `conn_${promptId}_${imageId}`, fromNodeId: promptId, toNodeId: imageId, label: '构图指令' });
        newConns.push({ id: `conn_${promptId}_${videoId}`, fromNodeId: promptId, toNodeId: videoId, label: '运镜微动' });
        newConns.push({ id: `conn_${imageId}_${videoId}`, fromNodeId: imageId, toNodeId: videoId, label: '首帧生视频' });
      });

      canvas.nodes = newNodes;
      canvas.connections = newConns;
      canvas.viewport = { x: 40, y: 20, scale: 0.65 };
      saveProjectCanvas(projectId, canvas);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `成功为「${theme}」生成 5 镜头完整电商管线！`,
            nodesCount: newNodes.length,
            connectionsCount: newConns.length
          }, null, 2)
        }]
      };
    }
    case 'canvas_apply_ops': {
      const current = getProjectCanvas(projectId);
      const updated = {
        ...current,
        nodes: args.nodes || current.nodes,
        connections: args.connections || current.connections,
        viewport: args.viewport || current.viewport
      };
      saveProjectCanvas(projectId, updated);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ message: '拓扑结构已同步', state: updated }, null, 2)
        }]
      };
    }
    default:
      throw new Error(`未知工具: ${name}`);
  }
};

const sendResponse = (id, result, error = null) => {
  const payload = { jsonrpc: '2.0', id };
  if (error) {
    payload.error = error;
  } else {
    payload.result = result;
  }
  process.stdout.write(JSON.stringify(payload) + '\n');
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const msg = JSON.parse(trimmed);
    const { id, method, params } = msg;

    if (method === 'initialize') {
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'keyvideo-mcp-server', version: '2.0.0' }
      });
    } else if (method === 'tools/list') {
      sendResponse(id, { tools: MCP_TOOLS });
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params;
      const result = await handleToolCall(name, args);
      sendResponse(id, result);
    } else {
      sendResponse(id, null, { code: -32601, message: `Method not found: ${method}` });
    }
  } catch (err) {
    sendResponse(null, null, { code: -32700, message: err.message });
  }
});
