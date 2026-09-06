export interface PromptItem {
  id: string;
  category: 'camera' | 'lighting' | 'copy' | 'fabric';
  title: string;
  tags: string[];
  content: string;
  description: string;
  targetType: 'prompt' | 'text_layer' | 'both';
}

export const PROMPT_CATEGORIES = [
  { id: 'all', label: '全部灵感', icon: '✨' },
  { id: 'camera', label: '镜头运镜', icon: '🎥' },
  { id: 'lighting', label: '光影氛围', icon: '💡' },
  { id: 'copy', label: '文案钩子', icon: '✍️' },
  { id: 'fabric', label: '面料版型', icon: '👗' }
] as const;

export const PROMPT_LIBRARY: PromptItem[] = [
  // 1. 镜头运镜 (Camera Movements)
  {
    id: 'cam_push_in',
    category: 'camera',
    title: '特写微推（突出细节）',
    tags: ['推镜头', '细节特写', '高级感'],
    content: 'Slow cinematic push-in towards the model, emphasizing fabric texture and premium craftsmanship, buttery smooth tracking',
    description: '镜头平缓推近模特，聚焦服装面料质感与精细做工。',
    targetType: 'prompt'
  },
  {
    id: 'cam_orbit_360',
    category: 'camera',
    title: '360° 环绕走秀',
    tags: ['环绕', '走秀姿态', '动态全貌'],
    content: 'Smooth 360-degree orbit rotation around the walking model, dynamic runway perspective, fluid cinematic camera movement',
    description: '环绕模特流畅旋转，全方位展示服装前后剪裁与上身效果。',
    targetType: 'prompt'
  },
  {
    id: 'cam_slow_mo',
    category: 'camera',
    title: '慢动作灵动卡点',
    tags: ['慢动作', '飘逸动感', '卡点节拍'],
    content: 'High framerate slow-motion capture, model turning gracefully, dynamic breeze flowing through the garment hemline, cinematic timing',
    description: '60帧慢动作捕捉转身瞬间，衣摆随微风灵动摇曳。',
    targetType: 'prompt'
  },
  {
    id: 'cam_low_angle',
    category: 'camera',
    title: '仰拍气场跟拍',
    tags: ['低角度', '修长身材', '超模气场'],
    content: 'Cinematic low-angle tracking shot moving forward alongside the model, lengthening legs, confident fashion editorial catwalk',
    description: '低视角向前跟拍，凸显修长腿部比例与超模出街气场。',
    targetType: 'prompt'
  },
  {
    id: 'cam_macro_focus',
    category: 'camera',
    title: '微距材质浅景深',
    tags: ['微距', '浅景深', '面料肌理'],
    content: 'Macro close-up rack focus on clothing seams and textile weave, creamy background bokeh, studio editorial detail',
    description: '焦点从背景变焦拉到面料缝线，虚化自然细腻。',
    targetType: 'prompt'
  },

  // 2. 光影氛围 (Lighting & Atmosphere)
  {
    id: 'light_studio_diffused',
    category: 'lighting',
    title: '高端大牌影棚柔光',
    tags: ['商业影棚', '高级柔光', '无暇底色'],
    content: 'High-end commercial photo studio lighting, large softbox diffused illumination, subtle rim light highlighting garment silhouette, clean neutral background',
    description: '经典商业摄影柔光箱布光，立体轮廓光勾勒服装层次。',
    targetType: 'prompt'
  },
  {
    id: 'light_golden_hour',
    category: 'lighting',
    title: '落日金辉度假风',
    tags: ['黄金时刻', '户外阳光', '温暖惬意'],
    content: 'Golden hour sunset backlight, warm cinematic lens flares, soft ocean breeze, natural sunny holiday beach mood',
    description: '傍晚落日逆光，温暖金色光晕营造舒适度假生活感。',
    targetType: 'prompt'
  },
  {
    id: 'light_minimalist_concrete',
    category: 'lighting',
    title: '极简性冷淡建筑光影',
    tags: ['极简主义', '建筑几何', '高级冷淡'],
    content: 'Minimalist wabi-sabi architectural background, crisp natural directional sunlight, soft geometric architectural shadows, serene artistic atmosphere',
    description: '极简清水混凝土建筑环境，硬朗几何阴影凸显现代艺术感。',
    targetType: 'prompt'
  },
  {
    id: 'light_cyber_neon',
    category: 'lighting',
    title: '夜色街头潮酷霓虹',
    tags: ['街头夜景', '霓虹光效', '潮流都市'],
    content: 'Vibrant city night street background, wet asphalt reflecting colorful neon glows, moody atmospheric rim light, urban fashion edge',
    description: '潮牌出街首选，湿润地面倒影配合霓虹氛围灯。',
    targetType: 'prompt'
  },

  // 3. 营销文案钩子 (Marketing Copy Hooks)
  {
    id: 'copy_golden_3s',
    category: 'copy',
    title: '黄金前3秒：显瘦天花板',
    tags: ['痛点吸引', '视觉冲击', '前3秒留存'],
    content: '显瘦显高天花板！穿上立刻立减视觉5斤，高级感直接拉满 ✨',
    description: '强痛点短平快，吸引用户停留在视频前3秒。',
    targetType: 'both'
  },
  {
    id: 'copy_limited_urgency',
    category: 'copy',
    title: '促销钩子：限时秒杀促单',
    tags: ['限时折扣', '紧迫感', '促成下单'],
    content: '🔥 专属限时直降！首发现货手慢无，手快有手慢无！',
    description: '制造紧迫感与抢购氛围，促成冲动点击。',
    targetType: 'both'
  },
  {
    id: 'copy_fabric_trust',
    category: 'copy',
    title: '面料信任：重磅匠心品质',
    tags: ['面料背书', '耐穿耐洗', '信任感'],
    content: '甄选重磅丝光面料 · 亲肤透气抗皱 · 一洗如新不缩水 💎',
    description: '建立质量信任，打消材质顾虑。',
    targetType: 'both'
  },
  {
    id: 'copy_versatile_commute',
    category: 'copy',
    title: '场景痛点：通勤休闲一衣多穿',
    tags: ['百搭日常', '通勤不费力', '高利用率'],
    content: '不用动脑搭配的满分神仙单品，可盐可甜，通勤出街一件搞定！',
    description: '强调高频利用率与百搭属性。',
    targetType: 'both'
  },

  // 4. 面料版型质感 (Fabric & Silhouette)
  {
    id: 'fabric_silky_drape',
    category: 'fabric',
    title: '法式垂坠丝光感',
    tags: ['垂感', '丝光流光', '亲肤顺滑'],
    content: 'Silky flowing drape with subtle pearlescent sheen, fluid movement, premium fluid textile, wrinkle-resistant luxury touch',
    description: '极具法式优雅的流动垂坠感，微光面料。',
    targetType: 'prompt'
  },
  {
    id: 'fabric_tailored_structure',
    category: 'fabric',
    title: '立体挺括重磅西装剪裁',
    tags: ['立体版型', '挺括肩线', '利落干练'],
    content: 'Crisp heavyweight tailored silhouette, structured shoulder line, clean sharp lapels, immaculate fit, premium wool blend feel',
    description: '立体挺括轮廓，修饰身型，尽显专业高级质感。',
    targetType: 'prompt'
  },
  {
    id: 'fabric_organic_linen',
    category: 'fabric',
    title: '自然棉麻微肌理',
    tags: ['棉麻质地', '自然透气', '文艺舒缓'],
    content: 'Textured breathable linen-cotton weave, authentic tactile organic slub surface, soft earthy tones, airy relaxed silhouette',
    description: '天然棉麻微纹理，透气轻盈，充满松弛感。',
    targetType: 'prompt'
  }
];
