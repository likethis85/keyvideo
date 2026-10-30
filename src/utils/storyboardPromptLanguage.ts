/**
 * Keep the storyboard editor readable when an upstream model mixes English
 * camera notes into an otherwise Chinese prompt. This is intentionally a
 * small, deterministic vocabulary pass; the full prompt remains editable.
 */
export function normalizeStoryboardPromptLanguage(value: string): string {
  if (!value) return value;
  return value
    .replace(/Vibrant city(?: night)? street background,?\s*(?:yet\s+)?wet asphalt reflecting colorful neon glows,?\s*moody atmospheric rim light on\s*/gi, '充满活力的城市夜间街景，湿润路面倒映彩色霓虹，氛围感轮廓光照亮')
    .replace(/\bUltra-slow Dolly In\b/gi, '极慢平推')
    .replace(/\bFluid drape\b/gi, '流线型垂坠')
    .replace(/\bCut to\b/gi, '镜头切换至')
    .replace(/\band\b/gi, '与')
    .replace(/\bbackground\b/gi, '背景')
    .replace(/\bnight street\b/gi, '夜间街景')
    .replace(/\bcolorful neon glows\b/gi, '彩色霓虹光')
    .replace(/\bmoody atmospheric rim light\b/gi, '氛围感轮廓光')
    .replace(/\bhigh-end fashion\b/gi, '高级时尚')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([，。；：！？])/g, '$1')
    .trim();
}
