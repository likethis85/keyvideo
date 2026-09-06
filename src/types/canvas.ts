export interface Position {
  x: number;
  y: number;
}

export interface CanvasViewport {
  x: number;
  y: number;
  scale: number;
}

export type CanvasNodeType = 
  | 'clothing'   // 上衣/下衣/平铺参考图
  | 'image'      // 模特图/试衣图/生成结果图
  | 'prompt'     // 提示词/营销文案/分镜描述
  | 'video'      // 视频生成与预览 (3s/15s)
  | 'workflow'   // 试衣与多镜组合配置中继
  | 'group';     // 节点分组容器

export type NodeExecutionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface CanvasNodeData {
  id: string;
  type: CanvasNodeType;
  title: string;
  position: Position;
  width: number;
  height: number;
  status?: NodeExecutionStatus;
  errorMessage?: string;
  metadata: {
    // 图像与服装相关
    imageSrc?: string;
    images?: string[];
    clothingType?: 'top' | 'bottom' | 'reference' | 'custom';
    aspectRatio?: '1:1' | '3:4' | '9:16' | '16:9';
    upscale?: '2x' | '4x' | string;
    inpaintPrompt?: string;

    // 提示词与文本相关
    text?: string;
    tags?: string[];
    role?: 'master' | 'shot' | 'negative' | 'general';

    // 视频生成相关
    videoSrc?: string | null;
    duration?: '3s' | '15s';
    progress?: number;
    shotType?: 'full-body' | 'medium' | 'close-up' | 'shot-1' | 'shot-2' | 'shot-3' | 'shot-4' | 'shot-5';
    firstFrameSrc?: string;
    lastFrameSrc?: string;
    videoTaskId?: string;

    // 工作流与参数
    model?: string;
    modelGender?: 'female' | 'male';
    modelRegion?: 'east-asian' | 'western';
    modelScene?: string;
    autoTrigger?: boolean;

    // 交互与显示
    collapsed?: boolean;
    color?: string;
    groupId?: string;
    [key: string]: unknown;
  };
}

export interface CanvasConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromHandle?: string;
  toHandle?: string;
  label?: string;
}

export interface CanvasProjectData {
  projectId: string;
  viewport: CanvasViewport;
  nodes: CanvasNodeData[];
  connections: CanvasConnection[];
  updatedAt: string;
}
