export type ScriptTemplateCategory = '口播' | '穿搭展示' | '产品种草' | '活动探店' | '新品发布' | '品牌故事' | '教程科普' | '直播切片';

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
  },
  {
    id: 'talking-review-5',
    title: '口播测评 · 5 段式',
    subtitle: 'HONEST REVIEW · 45S',
    category: '口播',
    duration: '45 秒',
    shots: '5 段',
    icon: '🎤',
    accent: '#ffb86b',
    description: '先说结论，再用版型、面料、上身效果和缺点做完整测评，适合建立信任感。',
    tags: ['测评结构', '对比镜头', '口播节奏', '购买建议'],
    sample: '先说结论：这件大衣值不值，看三个地方就够了。',
    prefill: '将预填 主提示词 + 5 段评测脚本',
    masterPrompt: '45 秒真实口播测评，开头 3 秒先给结论，随后按版型、面料、上身效果、缺点、购买建议五段展开。人物半身口播为主，穿插对应细节 B-roll；不夸大、不绝对化，字幕只强化结论关键词。',
    prompts: {
      'full-body': '半身口播开场，背景为真实通勤环境，人物直视镜头，先给出明确结论。',
      'medium': '中景口播，人物侧身展示版型与肩线，镜头缓慢横移，字幕落在关键词上。',
      'close-up': '面料、走线与纽扣特写，微距浅景深，作为测评中的证据镜头。'
    }
  },
  {
    id: 'one-piece-multi-look',
    title: '一衣多穿 · 4 镜',
    subtitle: 'MULTI LOOK · 12S',
    category: '穿搭展示',
    duration: '12 秒',
    shots: '4 镜',
    icon: '🧥',
    accent: '#f472b6',
    description: '同一件单品切换通勤、约会、休闲三种场景，用四镜快速证明百搭。',
    tags: ['一衣多穿', '场景切换', '配饰变化', '节奏卡点'],
    sample: '同一件大衣，通勤、约会、周末三种穿法。',
    prefill: '将预填 4 镜穿搭提示词',
    masterPrompt: '12 秒一衣多穿短片，同一件服装、同一模特，保持人物与服装一致。四镜分别展示通勤、约会、休闲三种搭配，使用快速换装或同机位切换，字幕标注场景与搭配关键词。',
    prompts: {
      'full-body': '全身正面定妆镜头，模特站在干净背景前，建立同一件单品的完整版型。',
      'medium': '半身中景，快速切换包袋与配饰，同机位展示三种场景搭配。',
      'close-up': '领口、袖口与配饰细节特写，快速卡点切换，强化百搭卖点。'
    }
  },
  {
    id: 'fabric-test-3',
    title: '面料实测 · 3 镜',
    subtitle: 'FABRIC TEST · 12S',
    category: '产品种草',
    duration: '12 秒',
    shots: '3 镜',
    icon: '🧵',
    accent: '#facc15',
    description: '用拉伸、透光、摩擦三个实测镜头讲清面料，比单纯口播更有说服力。',
    tags: ['面料实测', '微距', '对比实验', '质感证明'],
    sample: '别只听我说，直接看这块面料拉伸后的回弹。',
    prefill: '将预填 3 个实测镜头 + 字幕',
    masterPrompt: '12 秒面料实测短片，三个镜头分别展示拉伸回弹、透光程度、摩擦起球。固定机位、干净背景、自然光，手部动作清晰，字幕标注实验结论，不夸大功效。',
    prompts: {
      'full-body': '桌面平铺建立镜头，面料完整展开，侧光扫过纹理，字幕标明测试项目。',
      'medium': '手部中景进行拉伸与回弹测试，镜头固定，动作放慢，突出面料弹性。',
      'close-up': '微距贴近面料表面，展示透光与摩擦细节，浅景深保留真实纹理。'
    }
  },
  {
    id: 'popup-event-4',
    title: '快闪活动 · 4 幕',
    subtitle: 'POP-UP EVENT · 20S',
    category: '活动探店',
    duration: '20 秒',
    shots: '4 幕',
    icon: '🎪',
    accent: '#60a5fa',
    description: '空间、人群、互动、收尾四幕，适合快闪店、品牌活动和线下发布会。',
    tags: ['空间建立', '人群氛围', '互动抓拍', '活动信息'],
    sample: '先拍人群和空间，再切到互动，最后落活动信息。',
    prefill: '将预填 4 幕活动脚本',
    masterPrompt: '20 秒快闪活动短片，四幕结构：空间建立、人群氛围、互动体验、活动信息收尾。保留现场声与真实光线，镜头以手持跟拍和定机位结合，节奏轻快但不乱。',
    prompts: {
      'full-body': '广角定机位建立空间，展示门头、陈列与人群，镜头缓慢前推。',
      'medium': '中景手持跟拍，记录人群互动与体验过程，保留现场环境声。',
      'close-up': '手部互动、产品与活动物料特写，最后落到活动时间与地址字幕。'
    }
  },
  {
    id: 'new-arrival-launch-4',
    title: '新品发布 · 4 幕',
    subtitle: 'NEW ARRIVAL · 20S',
    category: '新品发布',
    duration: '20 秒',
    shots: '4 幕',
    icon: '🚀',
    accent: '#8b9cff',
    description: '用悬念、亮相、卖点和行动四幕完成新品首发，适合上新预热与首发当天投放。',
    tags: ['新品亮相', '卖点节奏', '首发信息', '行动引导'],
    sample: '先露出轮廓制造悬念，再用一个关键动作完成新品亮相。',
    prefill: '将预填 新品发布 + 4 幕脚本',
    masterPrompt: '20 秒新品发布短片，四幕结构：第一幕用局部轮廓和声音制造悬念；第二幕完整亮相并展示核心外观；第三幕用三个快速镜头说明材质、功能和差异化卖点；第四幕落到首发时间、渠道与行动引导。画面保持品牌质感与统一色调。',
    prompts: {
      'full-body': '新品完整亮相，镜头从局部缓慢拉远到全景，主体居中，背景保持干净有层次。',
      'medium': '半身或产品中景，连续展示三个核心卖点，镜头轻微推进，字幕跟随节奏出现。',
      'close-up': '细节微距特写，光线扫过材质、接口或工艺，最后切出首发信息。'
    }
  },
  {
    id: 'brand-story-5',
    title: '品牌故事 · 5 段',
    subtitle: 'BRAND STORY · 30S',
    category: '品牌故事',
    duration: '30 秒',
    shots: '5 段',
    icon: '🏛️',
    accent: '#d8a56d',
    description: '从起点、坚持、工艺到人物与愿景，建立品牌信任感，适合品牌主页和 campaign 视频。',
    tags: ['品牌价值', '人物故事', '工艺过程', '情绪收束'],
    sample: '一个人、一双手、一件产品，把品牌为什么存在讲清楚。',
    prefill: '将预填 品牌故事 + 5 段旁白',
    masterPrompt: '30 秒品牌故事短片，五段叙事：品牌起点、核心坚持、工艺过程、人物细节、未来愿景。使用真实环境与自然光，旁白简洁克制，镜头在人物、手部和产品细节之间平稳切换，结尾保留品牌标识安全区。',
    prompts: {
      'full-body': '真实工作空间的广角建立镜头，人物在场景中自然工作，光线温暖，画面有生活感。',
      'medium': '中景记录人物操作与交流，镜头缓慢跟随，捕捉自然表情和专注状态。',
      'close-up': '手部、工具、材质与产品细节特写，保留真实纹理和轻微环境声。'
    }
  },
  {
    id: 'how-to-guide-4',
    title: '使用教程 · 4 步',
    subtitle: 'HOW TO · 25S',
    category: '教程科普',
    duration: '25 秒',
    shots: '4 步',
    icon: '🧭',
    accent: '#64d6ba',
    description: '问题引入、步骤演示、注意事项和结果对比，帮助用户快速学会一个动作或功能。',
    tags: ['步骤拆解', '屏幕字幕', '前后对比', '易懂表达'],
    sample: '不用复杂术语，四步教会用户今天就能用上的方法。',
    prefill: '将预填 教程步骤 + 4 镜提示词',
    masterPrompt: '25 秒使用教程短片，四步结构：先展示常见问题；再按顺序演示三个操作步骤；补充一个容易忽略的注意事项；最后给出完成后的前后对比。每一步使用清晰动作和编号字幕，镜头稳定，确保关键区域不被字幕遮挡。',
    prompts: {
      'full-body': '完整展示操作环境与工具，人物站位清晰，先用一个动作说明问题所在。',
      'medium': '中景跟随连续操作，画面保留手部与主体，步骤编号在安全区逐条出现。',
      'close-up': '关键按钮、材质或动作的近景特写，放慢操作速度，最后切换到完成效果。'
    }
  },
  {
    id: 'live-highlight-3',
    title: '直播切片 · 3 段',
    subtitle: 'LIVE HIGHLIGHT · 35S',
    category: '直播切片',
    duration: '35 秒',
    shots: '3 段',
    icon: '📡',
    accent: '#ff8b8b',
    description: '从高能观点、产品证据到评论互动，快速把直播里的有效信息剪成可传播短片。',
    tags: ['高能截取', '字幕重点', '评论互动', '转化引导'],
    sample: '保留最有说服力的一句话，再用证据和评论把转化接住。',
    prefill: '将预填 直播高光 + 3 段剪辑',
    masterPrompt: '35 秒直播切片，三段结构：第一段保留主播最有记忆点的观点或结论；第二段插入产品演示、对比或真实反馈作为证据；第三段带出观众评论与明确行动引导。保留自然语气，删除停顿与重复，重点字幕使用高亮色但不遮挡人物。',
    prompts: {
      'full-body': '直播间或录制现场的广角建立镜头，快速带过环境后立刻进入高能观点。',
      'medium': '主播半身口播，保留自然手势与表情，重点句前后留出字幕安全区。',
      'close-up': '产品、评论区或演示细节特写，配合关键数据字幕，最后回到主播行动引导。'
    }
  }
];

export const SCRIPT_TEMPLATE_CATEGORIES: Array<{ id: 'all' | ScriptTemplateCategory; label: string }> = [
  { id: 'all', label: '全部' },
  { id: '口播', label: '口播' },
  { id: '穿搭展示', label: '穿搭展示' },
  { id: '产品种草', label: '产品种草' },
  { id: '活动探店', label: '活动探店' },
  { id: '新品发布', label: '新品发布' },
  { id: '品牌故事', label: '品牌故事' },
  { id: '教程科普', label: '教程科普' },
  { id: '直播切片', label: '直播切片' }
];
