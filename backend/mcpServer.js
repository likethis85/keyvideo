/**
 * KeyVideo Model Context Protocol (MCP) Server
 * Implements JSON-RPC 2.0 stdio protocol for Codex / Claude Code / Antigravity integration.
 */
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASK_STORE_PATH = path.join(__dirname, 'tasks_history.json');

const getTasks = () => {
  try {
    if (fs.existsSync(TASK_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(TASK_STORE_PATH, 'utf-8'));
    }
  } catch {}
  return {};
};

const MCP_TOOLS = [
  {
    name: 'keyvideo_get_status',
    description: '获取 KeyVideo 后端服务状态与任务队列概况',
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
  }
];

const handleToolCall = async (name, args = {}) => {
  switch (name) {
    case 'keyvideo_get_status': {
      const tasks = getTasks();
      const taskCount = Object.keys(tasks).length;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'online',
            service: 'KeyVideo MCP Gateway',
            version: '1.0.0',
            totalTasksRecorded: taskCount
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
        serverInfo: { name: 'keyvideo-mcp-server', version: '1.0.0' }
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
