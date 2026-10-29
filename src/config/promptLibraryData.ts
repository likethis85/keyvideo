export interface PromptItem {
  id: string;
  category: 'camera' | 'lighting' | 'copy' | 'fabric' | 'story' | 'style';
  title: string;
  tags: string[];
  content: string;
  description: string;
  targetType: 'prompt' | 'text_layer' | 'both';
  recommendedShot?: 'shot-1' | 'shot-2' | 'shot-3' | 'shot-4' | 'shot-5' | 'all' | 'text_layer';
  hasVariables?: boolean;
}

export interface FiveShotStoryboardSuite {
  id: string;
  title: string;
  style: 'dress' | 'suit' | 'street' | 'neo_chinese' | 'overcoat' | 'knitwear' | 'general';
  icon: string;
  tagline: string;
  description: string;
  shots: {
    'shot-1': string;
    'shot-2': string;
    'shot-3': string;
    'shot-4': string;
    'shot-5': string;
  };
  audioPart: string;
}

export const PROMPT_CATEGORIES = [
  { id: 'all', label: '全部灵感', icon: '✨' },
  { id: 'camera', label: '镜头运镜', icon: '🎥' },
  { id: 'lighting', label: '光影氛围', icon: '💡' },
  { id: 'copy', label: '文案钩子', icon: '✍️' },
  { id: 'fabric', label: '面料版型', icon: '👗' },
  { id: 'story', label: '节奏结构', icon: '🧩' },
  { id: 'style', label: '色彩风格', icon: '🎨' }
] as const;

export const PROMPT_LIBRARY: PromptItem[] = [
  // 1. 镜头运镜 (Camera Movements)
  {
    id: 'cam_push_in',
    category: 'camera',
    title: '特写微推（突出细节）',
    tags: ['推镜头', '细节特写', '高级感'],
    content: '缓慢电影级向前推近镜头，聚焦{model}的{fabric}面料纹理与精湛工艺，运镜丝滑平稳',
    description: '镜头平缓推近模特，聚焦服装面料质感与精细做工。',
    targetType: 'prompt',
    recommendedShot: 'shot-2',
    hasVariables: true
  },
  {
    id: 'cam_orbit_360',
    category: 'camera',
    title: '360° 环绕走秀',
    tags: ['环绕', '走秀姿态', '动态全貌'],
    content: '围绕自信行走的{model}进行360度平滑环绕，采用动态秀场视角展示{clothing}，电影级运动流畅自然',
    description: '环绕模特流畅旋转，全方位展示服装前后剪裁与上身效果。',
    targetType: 'prompt',
    recommendedShot: 'shot-3',
    hasVariables: true
  },
  {
    id: 'cam_slow_mo',
    category: 'camera',
    title: '慢动作灵动卡点',
    tags: ['慢动作', '飘逸动感', '卡点节拍'],
    content: '以{speed}进行高帧率慢动作拍摄，{model}优雅转身，微风吹动{clothing}下摆，呈现灵动飘逸效果',
    description: '升格慢动作捕捉转身瞬间，衣摆随微风灵动摇曳。',
    targetType: 'prompt',
    recommendedShot: 'shot-4',
    hasVariables: true
  },
  {
    id: 'cam_low_angle',
    category: 'camera',
    title: '仰拍气场跟拍',
    tags: ['低角度', '修长身材', '超模气场'],
    content: '电影级低角度跟拍，与{model}并行向前移动，拉长腿部比例，呈现穿着{clothing}的自信时尚走秀气场',
    description: '低视角向前跟拍，凸显修长腿部比例与超模出街气场。',
    targetType: 'prompt',
    recommendedShot: 'shot-1',
    hasVariables: true
  },
  {
    id: 'cam_macro_focus',
    category: 'camera',
    title: '微距材质浅景深',
    tags: ['微距', '浅景深', '面料肌理'],
    content: '微距特写并进行焦点转移，对准{clothing}缝线与{fabric}织纹，奶油般背景虚化，呈现影棚级细节质感',
    description: '焦点从背景变焦拉到面料缝线，虚化自然细腻。',
    targetType: 'prompt',
    recommendedShot: 'shot-2',
    hasVariables: true
  },

  // 2. 光影氛围 (Lighting & Atmosphere)
  {
    id: 'light_studio_diffused',
    category: 'lighting',
    title: '高端大牌影棚柔光',
    tags: ['商业影棚', '高级柔光', '无暇底色'],
    content: '高端商业影棚布光，大型柔光箱漫射照明，细腻轮廓光勾勒{clothing}剪影，干净中性背景',
    description: '经典商业摄影柔光箱布光，立体轮廓光勾勒服装层次。',
    targetType: 'prompt',
    recommendedShot: 'all',
    hasVariables: true
  },
  {
    id: 'light_golden_hour',
    category: 'lighting',
    title: '落日金辉度假风',
    tags: ['黄金时刻', '户外阳光', '温暖惬意'],
    content: '落日黄金时刻逆光，温暖电影级镜头光晕，柔和海风与明亮假日氛围映照{fabric}',
    description: '傍晚落日逆光，温暖金色光晕营造舒适度假生活感。',
    targetType: 'prompt',
    recommendedShot: 'all',
    hasVariables: true
  },
  {
    id: 'light_minimalist_concrete',
    category: 'lighting',
    title: '极简性冷淡建筑光影',
    tags: ['极简主义', '建筑几何', '高级冷淡'],
    content: '极简侘寂建筑背景，清晰自然的定向日光，柔和几何建筑阴影凸显{clothing}',
    description: '极简清水混凝土建筑环境，硬朗几何阴影凸显现代艺术感。',
    targetType: 'prompt',
    recommendedShot: 'shot-5',
    hasVariables: true
  },
  {
    id: 'light_cyber_neon',
    category: 'lighting',
    title: '夜色街头潮酷霓虹',
    tags: ['街头夜景', '霓虹光效', '潮流都市'],
    content: '充满活力的都市夜街背景，湿润路面倒映彩色霓虹，氛围轮廓光映照{model}与{clothing}',
    description: '潮牌出街首选，湿润地面倒影配合霓虹氛围灯。',
    targetType: 'prompt',
    recommendedShot: 'all',
    hasVariables: true
  },

  // 3. 营销文案钩子 (Marketing Copy Hooks)
  {
    id: 'copy_golden_3s',
    category: 'copy',
    title: '黄金前3秒：显瘦天花板',
    tags: ['痛点吸引', '视觉冲击', '前3秒留存'],
    content: '显瘦显高天花板！穿上立刻立减视觉5斤，高级感直接拉满 ✨',
    description: '强痛点短平快，吸引用户停留在视频前3秒。',
    targetType: 'both',
    recommendedShot: 'shot-1'
  },
  {
    id: 'copy_limited_urgency',
    category: 'copy',
    title: '促销钩子：限时秒杀促单',
    tags: ['限时折扣', '紧迫感', '促成下单'],
    content: '🔥 专属限时直降！首发现货手慢无，手快有手慢无！',
    description: '制造紧迫感与抢购氛围，促成冲动点击。',
    targetType: 'both',
    recommendedShot: 'shot-5'
  },
  {
    id: 'copy_fabric_trust',
    category: 'copy',
    title: '面料信任：重磅匠心品质',
    tags: ['面料背书', '耐穿耐洗', '信任感'],
    content: '甄选重磅{fabric} · 亲肤透气抗皱 · 一洗如新不缩水 💎',
    description: '建立质量信任，打消材质顾虑。',
    targetType: 'both',
    recommendedShot: 'shot-2',
    hasVariables: true
  },
  {
    id: 'copy_versatile_commute',
    category: 'copy',
    title: '场景痛点：通勤休闲一衣多穿',
    tags: ['百搭日常', '通勤不费力', '高利用率'],
    content: '不用动脑搭配的满分神仙单品，可盐可甜，通勤出街一件搞定！',
    description: '强调高频利用率与百搭属性。',
    targetType: 'both',
    recommendedShot: 'shot-3'
  },

  // 4. 面料版型质感 (Fabric & Silhouette)
  {
    id: 'fabric_silky_drape',
    category: 'fabric',
    title: '法式垂坠丝光感',
    tags: ['垂感', '丝光流光', '亲肤顺滑'],
    content: '丝质流动垂坠感，细腻珍珠微光，动作自然流畅，高级流动纺织面料，触感奢华且抗皱',
    description: '极具法式优雅的流动垂坠感，微光面料。',
    targetType: 'prompt',
    recommendedShot: 'shot-2'
  },
  {
    id: 'fabric_tailored_structure',
    category: 'fabric',
    title: '立体挺括重磅西装剪裁',
    tags: ['立体版型', '挺括肩线', '利落干练'],
    content: '清晰挺括的重磅剪裁轮廓，结构化肩线，利落平驳领，版型精致无瑕，呈现高级羊毛混纺质感',
    description: '立体挺括轮廓，修饰身型，尽显专业高级质感。',
    targetType: 'prompt',
    recommendedShot: 'shot-4'
  },
  {
    id: 'fabric_organic_linen',
    category: 'fabric',
    title: '自然棉麻微肌理',
    tags: ['棉麻质地', '自然透气', '文艺舒缓'],
    content: '具有真实触感的透气棉麻织纹，自然有机粗节肌理，柔和大地色调，轻盈松弛的廓形',
    description: '天然棉麻微纹理，透气轻盈，充满松弛感。',
    targetType: 'prompt',
    recommendedShot: 'shot-2'
  },
  {
    id: 'story_hook_reveal',
    category: 'story',
    title: '悬念揭示：先给局部再亮相',
    tags: ['悬念开场', '节奏递进', '新品发布'],
    content: '前1秒只展示{clothing}的局部材质与轮廓，保持信息不完整；随后镜头快速拉远并切换全身画面，让{model}完成一次自然转身，最后用一句简短卖点完成亮相。',
    description: '先隐藏关键信息制造好奇，再用完整亮相完成记忆点建立。',
    targetType: 'prompt',
    recommendedShot: 'shot-1',
    hasVariables: true
  },
  {
    id: 'story_three_proof',
    category: 'story',
    title: '三段证据：卖点逐个被看见',
    tags: ['卖点拆解', '证据镜头', '转化节奏'],
    content: '围绕{clothing}依次展示三个可被看见的证据：版型轮廓、{fabric}纹理和实际动作表现；每个证据只保留一个清晰动作，镜头之间使用干净硬切，结尾回到人物整体状态。',
    description: '把抽象卖点拆成三个可以被镜头证明的具体细节。',
    targetType: 'prompt',
    recommendedShot: 'shot-2',
    hasVariables: true
  },
  {
    id: 'story_before_after',
    category: 'story',
    title: '前后对比：一眼看懂变化',
    tags: ['前后对比', '同机位', '效果展示'],
    content: '使用固定机位和相同构图，先展示未搭配状态，再通过一次自然转身或遮挡转场切换到{model}穿着{clothing}的完整效果；保持光线和背景一致，让变化集中在服装与整体比例上。',
    description: '用同机位对比降低理解成本，适合穿搭改造和效果证明。',
    targetType: 'prompt',
    recommendedShot: 'shot-3',
    hasVariables: true
  },
  {
    id: 'style_editorial_monochrome',
    category: 'style',
    title: '杂志黑白：高级对比质感',
    tags: ['黑白影像', '杂志感', '高对比'],
    content: '采用克制的黑白摄影风格，保留{clothing}的轮廓、褶皱和{fabric}纹理，用硬朗侧光制造清晰明暗分界，画面简洁留白，呈现时装杂志内页质感。',
    description: '用黑白和明暗关系突出剪裁，不依赖复杂背景。',
    targetType: 'prompt',
    recommendedShot: 'all',
    hasVariables: true
  },
  {
    id: 'style_pastel_commerce',
    category: 'style',
    title: '柔和彩色：轻盈电商氛围',
    tags: ['低饱和', '柔和彩色', '电商主图'],
    content: '使用低饱和奶油色背景与柔和漫射光，围绕{clothing}建立干净的商业画面；色彩统一、阴影轻薄，人物动作自然，突出{fabric}的触感与亲和力。',
    description: '适合电商展示和日常穿搭，画面轻松且信息清晰。',
    targetType: 'prompt',
    recommendedShot: 'all',
    hasVariables: true
  },
  {
    id: 'copy_comment_question',
    category: 'copy',
    title: '评论互动：把选择题抛给观众',
    tags: ['评论引导', '互动提问', '社区传播'],
    content: '你会选择{clothing}的通勤穿法，还是周末休闲穿法？把两种搭配并列展示，最后邀请观众在评论区留下选择。',
    description: '把单向介绍变成明确问题，帮助视频获得互动和停留。',
    targetType: 'both',
    recommendedShot: 'shot-5',
    hasVariables: true
  },
  {
    id: 'camera_handheld_follow',
    category: 'camera',
    title: '手持跟拍：真实街头呼吸感',
    tags: ['手持跟拍', '真实感', '街头氛围'],
    content: '使用轻微手持跟拍，镜头与{model}保持自然距离，捕捉走路、回头和整理{clothing}的真实动作；保留少量环境声，避免过度稳定和过度磨皮。',
    description: '比精致棚拍更有生活感，适合街头、通勤和短视频原生内容。',
    targetType: 'prompt',
    recommendedShot: 'shot-3',
    hasVariables: true
  }
];

export const FIVE_SHOT_STORYBOARD_SUITES: FiveShotStoryboardSuite[] = [
  {
    id: 'suite_french_resort',
    title: '法式度假高定风',
    style: 'dress',
    icon: '👗',
    tagline: '海风流线 · 丝光垂坠 · 优雅松弛',
    description: '适合真丝吊带裙、度假长裙、优雅夏装，以落日温暖光线与自然波浪垂感为主轴。',
    shots: {
      'shot-1': '{model}迈着从容优雅步伐从画外步入镜头中央站定，落日金辉洒在发丝上，微风轻拂{clothing}裙摆。',
      'shot-2': '摄像机极其缓慢向前平推，微距特写对焦领口做工与胸前细节，展现{fabric}的细腻光泽与精细走线。',
      'shot-3': '360°平滑轨道环绕运镜，{model}轻盈转身展颜微笑，{clothing}在阳光下泛起柔和流线波浪。',
      'shot-4': '镜头中景微移，{model}微低头优雅侧身45度，指尖轻触裙摆，呈现法式松弛感与修长侧影。',
      'shot-5': '正面全身广角镜头徐缓拉远，{model}高挑挺拔直视前方大方定格，尽显海岛度假的高级松弛美学。'
    },
    audioPart: '舒缓微风白噪音与海浪沙沙声，搭配优雅小提琴与自然脚步声 Foley。'
  },
  {
    id: 'suite_executive_suit',
    title: '职场精英正装风',
    style: 'suit',
    icon: '💼',
    tagline: '立体挺括 · 气场开挂 · 高端精纺',
    description: '适合西服外套、大衣风衣、通勤商务套装，注重挺拔肩线与抗皱面料细节。',
    shots: {
      'shot-1': '{model}目光自信笃定，从现代商务大堂迈着干练大气的步伐由远及近走向画面中心，利落出场。',
      'shot-2': '镜头平滑快速微推特写，浅景深虚化聚焦西服平驳领与高精细纽扣，凸显{fabric}的重磅挺括质地。',
      'shot-3': '镜头伴随模特横向平行跟拍，{model}单手插兜从容迈步，呈现立体剪裁的挺拔肩线与修长身姿。',
      'shot-4': '45度半身侧景慢动作微移，模特轻理西装下摆，利落收腰剪裁与平整抗皱缝线一览无余。',
      'shot-5': '现代极简落地窗前全身定格，{model}双手自然交叠站立，直视镜头，展现职场大女主的气场与信任感。'
    },
    audioPart: '清脆利落的皮鞋高跟脚步声，商务环境氛围底噪，搭配沉稳节奏节拍 BGM。'
  },
  {
    id: 'suite_neo_chinese',
    title: '新中式东方国潮风',
    style: 'neo_chinese',
    icon: '🪭',
    tagline: '广袖流云 · 暗纹刺绣 · 端庄雅韵',
    description: '适合改良旗袍、汉服广袖、马面裙与盘扣唐装，突出东方意境与丝绸暗光。',
    shots: {
      'shot-1': '屏风光影微透，{model}身着{clothing}如画中漫步而出，东方雅韵扑面而来。',
      'shot-2': '微距浅景深变焦，镜头极细腻掠过衣领暗纹盘扣与刺绣花纹，展现{fabric}独特的丝绸暗光。',
      'shot-3': '广角运镜伴随模特徐缓迈步，广袖如云舒展，行走间衣角翻飞，流露出东方仪态的端庄与从容。',
      'shot-4': '柔美侧光穿透薄纱，{model}优雅侧身半掩面微启眼帘，侧颜版型与立体剪裁相互呼应。',
      'shot-5': '雅致水墨空间全身定格，{model}端庄独立，微风拂动发丝衣袂，定格古典美学与现代高定的完美融合。'
    },
    audioPart: '空灵悠扬的古筝古琴轻拨泛音，微风拂动丝绸沙沙摩擦拟音。'
  },
  {
    id: 'suite_street_techwear',
    title: '高街潮酷机能风',
    style: 'street',
    icon: '🧢',
    tagline: '街头霓虹 · 机能抽绳 · 动感节奏',
    description: '适合潮牌卫衣、工装裤、机能夹克、户外冲锋衣，强节奏与硬朗撞色。',
    shots: {
      'shot-1': '夜幕霓虹闪烁，{model}踩着动感节拍大步穿过湿润街头走向镜头，潮酷气场拉满。',
      'shot-2': '快速变焦推镜瞬间定格在机能搭扣与反光拉链，呈现{fabric}独特的哑光质感与防水肌理。',
      'shot-3': '低视角极速环绕运镜，{model}自信踱步换位，廓形剪裁与潮流多口袋结构全方位立体展现。',
      'shot-4': '慢动作升格捕捉模特随性抬臂微倾身姿，机能抽绳自然摇晃，松弛街头感十足。',
      'shot-5': '街头霓虹光晕下全身广角定格，{model}冷峻眼神直视前方，彰显不被定义的年轻潮酷态度。'
    },
    audioPart: '重低音 Hip-hop 鼓点卡点，城市街道湿漉声与衣物拉链金属碰撞声。'
  },
  {
    id: 'suite_quiet_cashmere',
    title: '静奢软糯羊绒风',
    style: 'knitwear',
    icon: '🧶',
    tagline: '亲肤软糯 · 羊绒微绒 · 治愈高级',
    description: '适合羊绒衫、高支针织开衫、秋冬保暖毛衣，展现细腻织纹与贴身呼吸感。',
    shots: {
      'shot-1': '晨曦暖阳透过百叶窗洒下，{model}身着{clothing}带着松弛温和的笑容迎着光线步入居室中央。',
      'shot-2': '超微距柔焦镜头缓缓推进，捕捉软糯微细纤维的绒毛呼吸感，展现{fabric}无与伦比的亲肤奢华。',
      'shot-3': '平稳慢速横移运镜，{model}惬意转身微抚双臂，羊绒随动作自然下垂，展现极具包裹感的温暖。',
      'shot-4': '温暖半身中景微调，柔和光晕描摹模特轮廓，领口与袖口螺纹细节温润精致。',
      'shot-5': '极简原木素色空间优雅全身定格，暖意流淌，大方展示高端居家与出街皆宜的静奢品质。'
    },
    audioPart: '温暖治愈的 Lo-fi 钢琴吉他旋律，温暖舒缓的自然呼吸拟音声。'
  }
];
