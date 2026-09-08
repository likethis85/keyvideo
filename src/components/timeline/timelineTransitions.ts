export type TransitionType = 'none' | 'fade' | 'slideLeft' | 'slideRight' | 'zoom' | 'wipe';

export const TRANSITION_CONFIGS: Record<TransitionType, { label: string; icon: string; short: string }> = {
  none: { label: '无转场', icon: '⛔', short: '无' },
  fade: { label: '交叉淡入淡出', icon: '✨', short: '淡入' },
  slideLeft: { label: '向左推移', icon: '⬅️', short: '左推' },
  slideRight: { label: '向右推移', icon: '➡️', short: '右推' },
  zoom: { label: '缩放过渡', icon: '🔍', short: '缩放' },
  wipe: { label: '左右擦除', icon: '🧹', short: '擦除' },
};
