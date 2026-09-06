import type { AIProject } from '../types/aiProject';

export const DEFAULT_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

export const DEFAULT_I2V_PROMPTS: AIProject['i2vPrompts'] = {
  'full-body': '模特从远处缓慢走向镜头并步入画面中心。镜头保持平稳，慢速跟焦推进，展示全身服装版型与行走时的灵动垂感。',
  'medium': '镜头缓慢自左向右横移。半身中景对焦模特上身，模特伴随轻微自然的侧身姿势调整，慢速横移运镜，画面流畅。',
  'close-up': '微距镜头缓慢拉近。极细致特写聚焦于衣服面料纹理、做工走线与接缝细节，轻微景深虚化与慢速推进，保留呼吸感运镜。'
};

export const DEFAULT_MASTER_PROMPT = '15秒快节奏连贯 5 幕叙事，引用参考图作为服装和模特的严格一致性参考。场景设定：摩登街头。第一幕：固定中景镜头，起初为场景空镜头，随后模特从画外走入镜头中央，风轻轻吹动发丝 and 服装衣角，确立高级气场。镜头切换（Cut to）第二幕：特写镜头，镜头聚焦在领口褶皱 and 收腰剪裁，清晰展现哑光羊绒的厚实温暖质感。镜头切换（Cut to）第三幕：中景跟拍，模特转身大步向前走，镜头跟随，完美展现流线型垂坠感。镜头切换（Cut to）第四幕：优雅侧面视角人像（模特微微侧身45度），模特微低头整理衣服袖口，展现别具一格的侧姿版型与剪裁。镜头切换（Cut to）第五幕：正面全身广角镜头，模特正面直视前方镜头站立，双手自然下垂，大方定格展示整体服装的穿着全貌。原生音效：环境白噪音与高跟鞋大理石脚步声混合舒缓大提琴乐。';

type ProjectRow = Record<string, unknown>;

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function parseStoredUrls(value: unknown): string[] {
  if (typeof value !== 'string' || !value) return [];
  if (!value.startsWith('[')) return [value];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [value];
  } catch {
    return [value];
  }
}

export function mapProjectRow(row: ProjectRow): AIProject {
  const referenceOutfitUrls = parseStoredUrls(row.reference_outfit_url);
  const modelOutfitImgUrls = parseStoredUrls(row.model_outfit_img_url);
  const storedPrompts = row.i2v_prompts;
  const i2vPrompts = storedPrompts && typeof storedPrompts === 'object'
    ? { ...DEFAULT_I2V_PROMPTS, ...storedPrompts as Partial<AIProject['i2vPrompts']> }
    : { ...DEFAULT_I2V_PROMPTS };

  return {
    id: stringValue(row.id),
    name: stringValue(row.name, '未命名项目'),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
    topClothingUrl: stringValue(row.top_clothing_url),
    bottomClothingUrl: stringValue(row.bottom_clothing_url),
    referenceOutfitUrl: referenceOutfitUrls[0] || '',
    referenceOutfitUrls,
    modelOutfitImgUrl: modelOutfitImgUrls[0] || null,
    modelOutfitImgUrls,
    modelGender: row.model_gender === 'male' ? 'male' : 'female',
    modelRegion: row.model_region === 'western' ? 'western' : 'east-asian',
    modelScene: stringValue(row.model_scene, 'street'),
    i2vMasterPrompt15s: stringValue(row.i2v_master_prompt_15s),
    i2vPrompts,
    storyboards: Array.isArray(row.storyboards) ? row.storyboards as AIProject['storyboards'] : [],
    i2vStep: row.i2v_step === 'storyboard_generated' || row.i2v_step === 'video_generated' ? row.i2v_step : 'idle',
    videoDuration: row.video_duration === '3s' ? '3s' : '15s',
    isOutfitImgGenerating: row.status === 'generating_outfit',
    isI2vGenerating: false,
    isStoryboardGenerating: false
  };
}

export function createAIProject({
  id,
  name,
  withDefaultPrompts = false
}: {
  id: string;
  name: string;
  withDefaultPrompts?: boolean;
}): AIProject {
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    topClothingUrl: '',
    bottomClothingUrl: '',
    referenceOutfitUrl: '',
    referenceOutfitUrls: [],
    modelOutfitImgUrl: null,
    modelOutfitImgUrls: [],
    modelGender: 'female',
    modelRegion: 'east-asian',
    modelScene: 'street',
    i2vMasterPrompt15s: withDefaultPrompts ? DEFAULT_MASTER_PROMPT : '',
    i2vPrompts: withDefaultPrompts
      ? { ...DEFAULT_I2V_PROMPTS }
      : { 'full-body': '', 'medium': '', 'close-up': '', swapModelUrl: '/clothing_model.png' },
    storyboards: [],
    i2vStep: 'idle',
    videoDuration: '15s',
    isOutfitImgGenerating: false,
    isI2vGenerating: false,
    isStoryboardGenerating: false
  };
}
