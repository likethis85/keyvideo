import type { Layer } from '../components/VideoCanvas';
import type { AspectRatio } from '../utils/smartReflow';

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
}

export interface AgentExecutionResult {
  success: boolean;
  reply: string;
  actionExecuted?: string;
}

/**
 * Parses and executes natural language commands on the active KeyVideo canvas
 */
export const executeAgentInstruction = (
  instruction: string,
  context: EditorExecutionContext
): AgentExecutionResult => {
  const text = instruction.trim().toLowerCase();

  // 1. Switch Aspect Ratio
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

  // 2. Add Text Layer
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

  // 3. Playback Controls
  if (/播放|暂停|停止/.test(text)) {
    context.setIsPlaying(prev => !prev);
    return {
      success: true,
      reply: context.isPlaying ? '已为您暂停时间轴播放。' : '已为您启动时间轴播放！',
      actionExecuted: context.isPlaying ? '暂停播放' : '启动播放'
    };
  }

  // 4. Seek Time
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

  // 5. Smart Reflow
  if (/智能排版|安全重排|重新排版|整理图层/.test(text)) {
    context.onSmartReflow();
    return {
      success: true,
      reply: '已依据当前画幅安全边距为您的图层执行智能排版！',
      actionExecuted: '智能安全排版'
    };
  }

  // 6. Delete Layer
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

  // 7. Trigger Export
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
    reply: `我理解您的要求：「${instruction}」。您可以尝试给我以下具体指令：\n• "帮我切换为 16:9 横屏"\n• "添加文案：首发限时立减50元"\n• "跳到第 5 秒"\n• "智能优化当前图层排版"\n• "立即导出当前视频"`
  };
};
