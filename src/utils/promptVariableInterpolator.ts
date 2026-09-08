export interface PromptVariableContext {
  modelGender?: string;
  modelRegion?: string;
  modelScene?: string;
  apparelStyle?: 'dress' | 'suit' | 'street' | 'neo_chinese' | 'overcoat' | 'knitwear' | 'general' | string;
  cameraStyle?: 'cinematic_dolly' | 'orbit_360' | 'macro_rack' | 'low_angle' | 'default' | string;
  lightingMood?: 'editorial_soft' | 'golden_hour' | 'wabi_sabi' | 'cyber_night' | 'default' | string;
  useSlowMotion?: boolean;
  clothingFocus?: 'top' | 'bottom' | 'both' | string;
  customOverrides?: Record<string, string>;
}

export interface PromptVariableDef {
  key: string;
  label: string;
  icon: string;
  value: string;
  category: 'model' | 'clothing' | 'environment' | 'style';
}

const APPAREL_MAP: Record<string, { clothing: string; fabric: string; action: string }> = {
  dress: {
    clothing: '法式高定真丝吊带长裙',
    fabric: '极具流线垂坠感的丝光微光面料',
    action: '轻移步伐回眸，微提裙摆迎风泛起自然波浪流线'
  },
  suit: {
    clothing: '立体挺括重磅修身西服外套',
    fabric: '重磅抗皱精纺羊毛混纺面料',
    action: '步伐干练沉稳从容，单手轻插口袋展现挺拔肩线'
  },
  street: {
    clothing: '潮酷廓形高街机能夹克与工装单品',
    fabric: '抗撕裂耐磨哑光机能科技面料',
    action: '随性自信出街迈步，伴随动感节奏轻松换位'
  },
  neo_chinese: {
    clothing: '新中式暗纹刺绣广袖国风华服',
    fabric: '微光暗纹重磅提花真丝面料',
    action: '徐徐漫步抬手抚袖，流云衣袂轻扬尽显东方仪态'
  },
  overcoat: {
    clothing: '经典英伦廓形风衣大衣外套',
    fabric: '挺括防风重磅斜纹棉羊毛混纺',
    action: '大步自信前行，大衣下摆随风自然开合带风'
  },
  knitwear: {
    clothing: '软糯亲肤静奢羊绒针织衫',
    fabric: '细腻蓬松高支山羊绒微纤肌理',
    action: '舒展身形温暖微笑，指尖轻触衣领感受柔滑质感'
  },
  general: {
    clothing: '高级时尚剪裁质感成衣套装',
    fabric: '高端商业精工细密织物面料',
    action: '自然优雅转身走动，从容定格展示整体剪裁'
  }
};

const CAMERA_MAP: Record<string, string> = {
  cinematic_dolly: '缓慢平移微推 (Slow Cinematic Dolly In)',
  orbit_360: '360°平滑轨道环绕运镜 (Smooth 360 Orbit)',
  macro_rack: '微距浅景深虚化变焦 (Macro Rack Focus)',
  low_angle: '仰角跟拍凸显修长比例 (Low Angle Catwalk Tracking)',
  default: '平稳电影级运镜 (Smooth Cinematic Motion)'
};

const LIGHTING_MAP: Record<string, string> = {
  editorial_soft: '高端商业影棚柔光箱漫反射无阴影 (Studio Softbox)',
  golden_hour: '落日黄金时刻温暖逆光与自然光晕 (Golden Hour Sun Flare)',
  wabi_sabi: '极简建筑空间天然直射硬朗几何光影 (Architectural Geometry)',
  cyber_night: '潮酷都市夜景湿润地面霓虹倒影 (Moody Cyber Neon Glow)',
  default: '自然清透立体通透布光 (Clean Neutral Lighting)'
};

/**
 * Extract structured variable definition table from project context
 */
export function resolvePromptVariables(ctx: PromptVariableContext = {}): PromptVariableDef[] {
  const isMale = ctx.modelGender === 'male';
  const isWestern = ctx.modelRegion === 'western';
  const modelText = isMale
    ? (isWestern ? '欧美帅气硬朗男模' : '亚洲清爽帅气男模')
    : (isWestern ? '欧美高挑冷艳超模' : '亚洲知性优雅女模');

  const apparelInfo = APPAREL_MAP[ctx.apparelStyle || 'general'] || APPAREL_MAP.general;
  const cameraText = CAMERA_MAP[ctx.cameraStyle || 'cinematic_dolly'] || CAMERA_MAP.default;
  const lightingText = ctx.modelScene || LIGHTING_MAP[ctx.lightingMood || 'editorial_soft'] || LIGHTING_MAP.default;
  const speedText = ctx.useSlowMotion ? '60FPS 升格丝滑慢动作' : '电影级从容自然帧率';

  const baseVars: PromptVariableDef[] = [
    { key: 'model', label: '模特特征', icon: '👤', value: modelText, category: 'model' },
    { key: 'clothing', label: '服装品类', icon: '👗', value: apparelInfo.clothing, category: 'clothing' },
    { key: 'fabric', label: '面料质感', icon: '🧵', value: apparelInfo.fabric, category: 'clothing' },
    { key: 'action', label: '模特动作', icon: '💃', value: apparelInfo.action, category: 'model' },
    { key: 'scene', label: '场景光影', icon: '💡', value: lightingText, category: 'environment' },
    { key: 'camera', label: '运镜手法', icon: '🎥', value: cameraText, category: 'style' },
    { key: 'speed', label: '节奏帧率', icon: '⏱️', value: speedText, category: 'style' }
  ];

  if (ctx.customOverrides) {
    return baseVars.map(v => ({
      ...v,
      value: ctx.customOverrides?.[v.key] ?? v.value
    }));
  }

  return baseVars;
}

/**
 * Replace all {variable} placeholders in a prompt template with their resolved values
 */
export function interpolatePromptVariables(
  template: string,
  variables: Record<string, string> | PromptVariableDef[]
): string {
  if (!template) return '';

  const varMap: Record<string, string> = Array.isArray(variables)
    ? Object.fromEntries(variables.map(v => [v.key, v.value]))
    : variables;

  return template.replace(/\{([a-zA-Z0-9_\u4e00-\u9fa5]+)\}/g, (match, key) => {
    return varMap[key] !== undefined ? varMap[key] : match;
  });
}

/**
 * Scan a template string to find all placeholder variable keys
 */
export function extractPromptPlaceholders(template: string): string[] {
  if (!template) return [];
  const matches = template.match(/\{([a-zA-Z0-9_\u4e00-\u9fa5]+)\}/g) || [];
  return Array.from(new Set(matches.map(m => m.slice(1, -1))));
}
