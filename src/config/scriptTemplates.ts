export type ScriptTemplateCategory = '口播' | '穿搭展示' | '产品种草' | '活动探店';

export interface ScriptTemplate {
  id: string;
  title: string;
  subtitle: string;
  category: ScriptTemplateCategory;
  duration: string;
  shots: string;
  icon: string;
  accent: string;
  description: string;
  tags: string[];
  sample: string;
  prefill: string;
  masterPrompt: string;
  prompts: {
    'full-body': string;
    'medium': string;
    'close-up': string;
  };
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'talking-head-3',
    title: '口播种草 · 3 段式',
    subtitle: 'TALKING HEAD · 30S',
    category: '口播',
    duration: '30 秒',
    shots: '3 段',
    icon: '🎙️',
    accent: '#39e6ff',
    description: '先用一句反常识钩子抓住人，再讲 3 个卖点，最后自然收口。适合真人出镜或数字人口播。',
    tags: ['口播文案', '提词器节奏', '字幕高亮', 'B-roll 提示词'],
    sample: '“别再买显胖的毛衣了——真正显瘦的，是肩线这里。”',
    prefill: '将预填 主提示词 + 3 段台词',
    masterPrompt: '15 秒口播短视频，真实通勤场景。第一段用反常识钩子抓住注意力；第二段讲清 3 个卖点，每个卖点配一个特写镜头；第三段自然收口，给出行动建议。画面保持人物半身口播为主，穿插面料、肩线、版型细节 B-roll。字幕只保留关键词高亮，不遮挡人脸。',
    prompts: {
      'full-body': '中景口播开场，人物自然站在通勤街景中，镜头固定，字幕在画面下方留出安全区。',
      'medium': '半身近景，人物看向镜头讲出卖点，背景轻微虚化，镜头缓慢推近。',
      'close-up': '面料与肩线特写，浅景深，突出纹理和剪裁，作为口播中的 B-roll。'
    }
  },
  {
    id: 'outfit-transition-5',
    title: '穿搭转场 · 5 镜',
    subtitle: 'OUTFIT TRANSITION · 15S',
    category: '穿搭展示',
    duration: '15 秒',
    shots: '5 镜',
    icon: '👗',
    accent: '#b18cff',
    description: '同一模特、同一场景，用 5 个镜头完成从全身到细节的穿搭转场，适合卡点音乐。',
    tags: ['5 镜分镜', '转场词', '卡点节奏', '运镜提示词'],
    sample: '全身入场 → 侧身回眸 → 面料微距 → 动态裙摆 → 定格全景',
    prefill: '将预填 5 镜提示词 + 转场节奏',
    masterPrompt: '15 秒穿搭展示，同一模特、同一场景、同一套服装，保持人物五官与服装一致。五个镜头按卡点节奏切换：全身入场、侧身回眸、面料微距、动态裙摆、定格全景。转场使用硬切或轻微推拉，不改变人物身份。',
    prompts: {
      'full-body': '全身镜头，模特从画面外走入中心，镜头缓慢后拉，完整展示服装版型与鞋包搭配。',
      'medium': '侧身中景，模特回眸看向镜头，镜头轻微横移，展示肩线与腰线。',
      'close-up': '微距镜头贴近面料与缝线，浅景深，随后快速拉回半身，形成卡点转场。'
    }
  },
  {
    id: 'product-detail-4',
    title: '产品细节 · 4 镜',
    subtitle: 'PRODUCT DETAIL · 10S',
    category: '产品种草',
    duration: '10 秒',
    shots: '4 镜',
    icon: '🔍',
    accent: '#ff718f',
    description: '从材质、做工、版型到上身效果，用微距和侧光把“贵”拍出来，适合详情页/种草图。',
    tags: ['微距', '材质光', '细节文案', '静物转场'],
    sample: '90mm 微距，侧逆光扫过羊毛纤维，浅景深，保留织物绒毛',
    prefill: '将预填 产品主图提示词',
    masterPrompt: '10 秒产品细节短片，核心是材质与做工。使用微距和侧逆光，依次展示面料纤维、走线、五金、上身局部。画面干净，背景低饱和，字幕只标注材质与工艺关键词。',
    prompts: {
      'full-body': '产品平铺或半身展示，干净背景，柔和侧光扫过整体轮廓，建立产品第一印象。',
      'medium': '半身细节，镜头缓慢横移，展示版型与垂坠感，背景保持安静。',
      'close-up': '90mm 微距，侧逆光扫过面料纤维与缝线，浅景深，保留真实纹理。'
    }
  },
  {
    id: 'store-visit-3',
    title: '探店/活动 · 3 幕',
    subtitle: 'STORE VISIT · 20S',
    category: '活动探店',
    duration: '20 秒',
    shots: '3 幕',
    icon: '📍',
    accent: '#55d99a',
    description: '环境建立、人物入镜、体验收尾。适合门店活动、快闪、线下探店，保留真实环境声。',
    tags: ['环境建立', '人物入镜', '现场声', '口播片段'],
    sample: '先给空间 1 秒，再让模特从画外进入——不要一上来就切人脸',
    prefill: '将预填 场景 + 3 幕脚本',
    masterPrompt: '20 秒门店探店短片，三幕结构：第一幕建立空间与品牌氛围；第二幕人物入镜，展示服装与互动；第三幕体验收尾，给出地址/活动信息。保留环境声与自然光，少用过度滤镜。',
    prompts: {
      'full-body': '广角建立镜头，先拍空间与陈列，再让模特从画外走入，镜头缓慢跟随。',
      'medium': '中景跟拍，模特在店内自然浏览、触摸面料，镜头保持稳定，保留环境声。',
      'close-up': '手部与面料细节特写，随后切回人物微笑收尾，字幕落在活动信息上。'
    }
  }
];

export const SCRIPT_TEMPLATE_CATEGORIES: Array<{ id: 'all' | ScriptTemplateCategory; label: string }> = [
  { id: 'all', label: '全部' },
  { id: '口播', label: '口播' },
  { id: '穿搭展示', label: '穿搭展示' },
  { id: '产品种草', label: '产品种草' },
  { id: '活动探店', label: '活动探店' }
];
