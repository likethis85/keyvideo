export interface MentionableItem {
  id: string;
  type: 'model' | 'scene' | 'clothing' | 'storyboard' | 'layer';
  label: string;
  previewUrl?: string;
  description?: string;
}

/**
 * Extracts @mentions from text.
 * Matches @[Label] or @Label patterns
 */
export const extractMentionTokens = (text: string): string[] => {
  const matches = text.match(/@\[([^\]]+)\]|@([\w\u4e00-\u9fa5\-_]+)/g) || [];
  return matches.map(token => {
    if (token.startsWith('@[') && token.endsWith(']')) {
      return token.slice(2, -1);
    }
    return token.slice(1);
  });
};

/**
 * Resolves mentioned labels against current available items
 */
export const resolveMentions = (
  text: string,
  availableItems: MentionableItem[]
): {
  cleanText: string;
  referencedItems: MentionableItem[];
  referencedImages: string[];
} => {
  const tokens = extractMentionTokens(text);
  const referencedItems: MentionableItem[] = [];
  const referencedImages: string[] = [];

  tokens.forEach(token => {
    const matched = availableItems.find(
      item => item.label.toLowerCase() === token.toLowerCase() || item.id === token
    );
    if (matched && !referencedItems.some(i => i.id === matched.id)) {
      referencedItems.push(matched);
      if (matched.previewUrl) {
        referencedImages.push(matched.previewUrl);
      }
    }
  });

  // Replace @[Label] with readable label for prompt
  const cleanText = text.replace(/@\[([^\]]+)\]/g, '$1');

  return {
    cleanText,
    referencedItems,
    referencedImages
  };
};
