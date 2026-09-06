import type { Layer } from '../components/VideoCanvas';
import type { AspectRatio } from '../utils/smartReflow';
import type { CanvasNodeType } from '../types/canvas';

export interface EditorExecutionContext {
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  ratio: AspectRatio;
  onRatioChange: (ratio: AspectRatio) => void;
  onSmartReflow: () => void;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  triggerExport: () => void;

  // Infinite Canvas integration (Route B)
  viewMode?: 'editor' | 'canvas';
  setViewMode?: (mode: 'editor' | 'canvas') => void;
  onCanvasAddNode?: (type: CanvasNodeType, title?: string) => void;
  onCanvasGeneratePipeline?: (theme?: string) => void;
  onCanvasAutoLayout?: () => void;
  onCanvasClear?: () => void;
}

export interface AgentExecutionResult {
  success: boolean;
  reply: string;
  actionExecuted?: string;
}

/**
 * Parses and executes natural language commands on the active KeyVideo workspace (Timeline + Canvas)
 */
export const executeAgentInstruction = (
  instruction: string,
  context: EditorExecutionContext
): AgentExecutionResult => {
  const text = instruction.trim().toLowerCase();

  // 1. Switch View Mode (Editor vs Infinite Canvas)
  if (/切换到画布|切换画布|打开画布|进入画布|无限画布|节点画布/.test(text)) {
    if (context.setViewMode) {
      context.setViewMode('canvas');
      return {
        success: true,
        reply: '已为您切换至 AI 无限创作画布！您可以在此自由编排节点与多模态生成管线。',
        actionExecuted: '切换至无限画布'
      };
    }
  }

  if (/回到时间轴|切换到时间轴|回到剪辑|视频剪辑模式|时间线模式/.test(text)) {
    if (context.setViewMode) {
      context.setViewMode('editor');
      return {
        success: true,
        reply: '已为您切换至时间轴多轨视频剪辑界面！',
        actionExecuted: '切换至时间轴模式'
      };
    }
  }

  // 2. Canvas 5-shot Pipeline Generation
  if (/生成分镜管线|生成5个分镜|生成五镜|创建分镜流程|管线生成|画布管线/.test(text)) {
    if (context.setViewMode) {
      context.setViewMode('canvas');
    }
    if (context.onCanvasGeneratePipeline) {
      let theme = instruction.replace(/.*(生成分镜管线|生成5个分镜|生成五镜|创建分镜流程|管线生成|画布管线)[:：\s]*/i, '').trim();
      if (!theme || theme === instruction) {
        theme = '爆款夏日法式碎花裙';
      }
      context.onCanvasGeneratePipeline(theme);
      return {
        success: true,
        reply: `已在无限画布中为您自动生成「${theme}」的 5 镜头完整电商短视频管线（服装 -> 5镜提示词 -> 5镜生图 -> 5镜生视频）！`,
        actionExecuted: `生成 5 镜头管线: ${theme}`
      };
    }
  }

  // 3. Canvas Add Node
  if (/在画布添加|画布新建|添加节点|新建节点/.test(text)) {
    if (context.setViewMode) {
      context.setViewMode('canvas');
    }
    if (context.onCanvasAddNode) {
      if (/提示词|文案|prompt/.test(text)) {
        const title = instruction.replace(/.*(提示词|文案|prompt)[:：\s]*/i, '').trim() || '新提示词节点';
        context.onCanvasAddNode('prompt', title);
        return { success: true, reply: `已在画布为您创建提示词节点：「${title}」！`, actionExecuted: `新建提示词节点: ${title}` };
      }
      if (/服装|衣服|上装|下装|cloth/.test(text)) {
        context.onCanvasAddNode('clothing', '服装款式节点');
        return { success: true, reply: '已在画布为您创建服装参考节点！', actionExecuted: '新建服装节点' };
      }
      if (/生图|图片|模特图|image/.test(text)) {
        context.onCanvasAddNode('image', 'AI 生图节点');
        return { success: true, reply: '已在画布为您创建图片生成节点！', actionExecuted: '新建生图节点' };
      }
      if (/视频|镜头|video/.test(text)) {
        context.onCanvasAddNode('video', '视频镜头');
        return { success: true, reply: '已在画布为您创建视频镜头节点！', actionExecuted: '新建视频节点' };
      }
    }
  }

  // 4. Canvas Auto Layout & Anti-overlap
  if (/画布排版|整理画布|排版节点|节点排版|自动排版|不要叠加|不要重叠|不要堆叠|分开节点|节点重叠|自动对齐|消除重叠/.test(text)) {
    if (context.onCanvasAutoLayout) {
      context.onCanvasAutoLayout();
      return { success: true, reply: '已为您自动整理并对齐画布上的所有节点和连线，彻底消除了重叠与遮挡！', actionExecuted: '画布自动排版与消除重叠' };
    }
  }

  // 5. Switch Aspect Ratio
  if (/切换画幅|改变画幅|切到|横屏|竖屏|方屏/.test(text)) {
    if (/16:9|横屏|横版/.test(text)) {
      context.onRatioChange('16-9');
      return { success: true, reply: '已为您将画幅切换为 16:9 横屏，并自动执行了安全边距重排！', actionExecuted: '切换画幅至 16:9' };
    }
    if (/9:16|竖屏|竖版|抖音|tiktok/.test(text)) {
      context.onRatioChange('9-16');
      return { success: true, reply: '已为您将画幅切换为 9:16 竖屏，并对图层进行了安全边距重排！', actionExecuted: '切换画幅至 9:16' };
    }
    if (/1:1|方形|正方形/.test(text)) {
      context.onRatioChange('1-1');
      return { success: true, reply: '已为您将画幅切换为 1:1 正方形！', actionExecuted: '切换画幅至 1:1' };
    }
    if (/3:4|小红书/.test(text)) {
      context.onRatioChange('3-4');
      return { success: true, reply: '已为您将画幅切换为 3:4 电商主图比例！', actionExecuted: '切换画幅至 3:4' };
    }
  }

  // 6. Add Text Layer
  if (/加文案|添加文字|写一句|加标题|加卖点|添加文案/.test(text)) {
    let copyText = instruction.replace(/.*(加文案|添加文字|写一句|加标题|加卖点|添加文案)[:：\s]*/i, '').trim();
    if (!copyText || copyText === instruction) {
      copyText = '限时特惠 · 爆款直降5折';
    }
    const id = `text_agent_${Date.now()}`;
    const newLayer: Layer = {
      id,
      type: 'text',
      name: 'AI 营销文案',
      start: context.currentTime,
      end: Math.min(15, context.currentTime + 4),
      visible: true,
      x: 50,
      y: 75,
      scale: 1,
      opacity: 1,
      properties: {
        text: copyText,
        fontSize: 32,
        color: '#ffffff',
        animation: 'zoom',
        bold: true,
        shadow: true
      }
    };
    context.setLayers(prev => [...prev, newLayer]);
    context.setSelectedLayerId(id);
    return {
      success: true,
      reply: `已在画板为您创建营销文案：「${copyText}」！`,
      actionExecuted: `新建文案图层：「${copyText}」`
    };
  }

  // 7. Playback Controls
  if (/播放|暂停|停止/.test(text)) {
    context.setIsPlaying(prev => !prev);
    return {
      success: true,
      reply: context.isPlaying ? '已为您暂停时间轴播放。' : '已为您启动时间轴播放！',
      actionExecuted: context.isPlaying ? '暂停播放' : '启动播放'
    };
  }

  // 8. Seek Time
  const timeMatch = text.match(/(?:跳到|跳转|定位到)\s*(\d+(?:\.\d+)?)\s*秒?/);
  if (timeMatch && timeMatch[1]) {
    const targetSeconds = Math.min(15, Math.max(0, parseFloat(timeMatch[1])));
    context.setCurrentTime(targetSeconds);
    return {
      success: true,
      reply: `已将播放进度跳转至 ${targetSeconds} 秒。`,
      actionExecuted: `跳转时间至 ${targetSeconds}s`
    };
  }

  // 9. Smart Reflow
  if (/智能排版|安全重排|重新排版|整理图层/.test(text)) {
    context.onSmartReflow();
    return {
      success: true,
      reply: '已依据当前画幅安全边距为您的图层执行智能排版！',
      actionExecuted: '智能安全排版'
    };
  }

  // 10. Delete Layer
  if (/删除选中|删除当前|删掉这个|移除图层/.test(text)) {
    if (context.selectedLayerId) {
      const targetId = context.selectedLayerId;
      context.setLayers(prev => prev.filter(l => l.id !== targetId));
      context.setSelectedLayerId(null);
      return {
        success: true,
        reply: '已为您删除当前选中的图层。',
        actionExecuted: '删除选中图层'
      };
    }
    return {
      success: false,
      reply: '画板当前没有选中的图层。请先在画板或时间轴点击选中一个图层后再让我删除。'
    };
  }

  // 11. Trigger Export
  if (/导出视频|生成视频|渲染视频|下载成片/.test(text)) {
    context.triggerExport();
    return {
      success: true,
      reply: '正在为您启动浏览器原生 MP4 视频无损合成与导出任务，请查看中心画板渲染进度条！',
      actionExecuted: '触发视频导出'
    };
  }

  // Fallback assistant response
  return {
    success: true,
    reply: `我理解您的要求：「${instruction}」。您可以尝试给我以下具体指令：\n• "切换到无限画布" 或 "回到时间轴剪辑"\n• "在画布生成5个分镜管线"\n• "在画布添加提示词节点：法式轻奢风格"\n• "画布自动排版"\n• "帮我切换为 16:9 横屏"\n• "添加文案：首发限时立减50元"\n• "立即导出当前视频"`
  };
};
