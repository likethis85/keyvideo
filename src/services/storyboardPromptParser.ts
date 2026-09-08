export function cleanPromptReferences(text: string): string {
  return text
    .replace(/对应\s*图\d+\s*中的(?:最左侧第一格|第二格特写镜头|第三格中景|第四格侧面|最右侧第五格全景|第一格|第二格|第三格|第四格|第五格)[，,、]?\s*/g, '')
    .replace(/引用\s*图\d+\s*(?:做为特写|中景|侧面中景|全景)[，,、]?\s*/g, '')
    .replace(/\[分镜图_幕\d+\][（(]图\d+[）)](?:中的|中|的|所示的|所示)?/g, '')
    .replace(/\[分镜图_幕\d+\](?:中的|中|的|所示的|所示)?/g, '')
    .replace(/\[模特穿搭主图\][（(]图1[）)](?:中的|中|的|所示的|所示)?/g, '')
    .replace(/\[模特穿搭主图\](?:中的|中|的|所示的|所示)?/g, '')
    .replace(/[（(]图\d+[）)](?:中的|中|的|所示的|所示)?/g, '')
    .replace(/[（(]Image\s*\d+[）)](?:中的|中|的|所示的|所示)?/g, '')
    .replace(/(?:引用|参考|对应)\s*(?:图\d+|参考图|\[@[^\]]+\])(?:中的|中|的|所示的|所示)?[，,、]?\s*/g, '')
    .replace(/图\d+(?:中的|中|的|所示的|所示)?/g, '')
    .replace(/Image\s*\d+(?:in|of|shown in)?/gi, '')
    .replace(/^[，,、\s.]+/, '')
    .replace(/[，,、\s.]+$/, '')
    .replace(/，，/g, '，')
    .replace(/,,/g, ',')
    .trim();
}

function extractPart(prompt: string, startMarker: string, endMarker: string, fallback: string): string {
  const startIndex = prompt.indexOf(startMarker);
  if (startIndex === -1) return fallback;
  const contentStart = startIndex + startMarker.length;
  const endIndex = endMarker ? prompt.indexOf(endMarker, contentStart) : prompt.length;
  return (endIndex === -1 ? prompt.substring(contentStart) : prompt.substring(contentStart, endIndex)).trim();
}

export function parseFiveShotPrompt(prompt: string) {
  return {
    'shot-1': cleanPromptReferences(extractPart(prompt, '第一幕：', '镜头切换（Cut to）第二幕：', '模特迈着从容的步伐从画外走入镜头中央并站定，微风轻轻吹动发丝和服装衣角。')),
    'shot-2': cleanPromptReferences(extractPart(prompt, '第二幕：', '镜头切换（Cut to）第三幕：', '镜头缓慢向前推进聚焦于模特的下半身服饰，展示服装的版型 and 剪裁设计。')),
    'shot-3': cleanPromptReferences(extractPart(prompt, '第三幕：', '镜头切换（Cut to）第四幕：', '镜头平滑拉近对准模特的手部特写，模特手部微调姿态展示材质的质地细节。')),
    'shot-4': cleanPromptReferences(extractPart(prompt, '第四幕：', '镜头切换（Cut to）第五幕：', '优雅侧面视角人像（模特微微侧身45度），模特微低头转身，展现别具一格的侧姿版型与剪裁。')),
    'shot-5': cleanPromptReferences(extractPart(prompt, '第五幕：', '原生音效：', '正面全身广角镜头，模特正面直视前方镜头站立，双手自然下垂，大方定格展示整体服装的穿着全貌。'))
  };
}

export function parseThreeShotPrompt(prompt: string) {
  return {
    'full-body': cleanPromptReferences(extractPart(prompt, '第一幕：', '镜头切换（Cut to）第二幕：', '模特从远处缓慢走向镜头并步入画面中心。镜头保持平稳，慢速跟焦推进，展示全身服装版型与行走时的灵动垂感。')),
    'medium': cleanPromptReferences(extractPart(prompt, '第二幕：', '镜头切换（Cut to）第三幕：', '镜头缓慢自左向右横移。半身中景对焦模特上身，模特伴随轻微自然的侧身姿势调整，慢速横移运镜，画面流畅。')),
    'close-up': cleanPromptReferences(extractPart(prompt, '第三幕：', '原生音效：', '微距镜头缓慢拉近。极细致特写聚焦于衣服面料纹理、做工走线与接缝细节，轻微景深虚化与慢速推进，保留呼吸感运镜。'))
  };
}

export function reconstructFiveShotMasterPrompt(
  parsedShots: Record<'shot-1' | 'shot-2' | 'shot-3' | 'shot-4' | 'shot-5', string>,
  existingPrompt?: string
): string {
  const audioMarker = '原生音效：';
  let audioPart = '高级环境底噪 + 衣服摩擦与高跟鞋脚步拟音 Foley + 舒缓音乐 BGM。';
  if (existingPrompt && existingPrompt.includes(audioMarker)) {
    const extracted = existingPrompt.substring(existingPrompt.indexOf(audioMarker) + audioMarker.length).trim();
    if (extracted) audioPart = extracted;
  }

  return `15秒快节奏连贯 5 幕叙事，引用参考图作为服装和模特的严格一致性参考。第一幕：${parsedShots['shot-1']} 镜头切换（Cut to）第二幕：${parsedShots['shot-2']} 镜头切换（Cut to）第三幕：${parsedShots['shot-3']} 镜头切换（Cut to）第四幕：${parsedShots['shot-4']} 镜头切换（Cut to）第五幕：${parsedShots['shot-5']} 原生音效：${audioPart}`;
}

export function replaceSingleShotInMasterPrompt(
  masterPrompt: string,
  shotKey: 'shot-1' | 'shot-2' | 'shot-3' | 'shot-4' | 'shot-5',
  newShotContent: string
): string {
  const parsed = parseFiveShotPrompt(masterPrompt);
  parsed[shotKey] = cleanPromptReferences(newShotContent);
  return reconstructFiveShotMasterPrompt(parsed, masterPrompt);
}

