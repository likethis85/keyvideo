/**
 * Format raw and machine-generated image/media file names into clean, elegant, human-readable labels.
 * Examples:
 * - "Gemini_Generated_Image_pcqa51pcqa51pcqa.jpeg" -> "AI生成场景 (pcqa51)"
 * - "Midjourney_2024_09_03_xxxx.png" -> "MJ场景 (2024)"
 * - "1788417191816_minimalist_room.png" -> "minimalist room"
 * - "IMG_20240903_142345.jpg" -> "实拍图 0903"
 */
export function formatFileName(rawName?: string | null, maxLength = 18): string {
  if (!rawName) return '';

  let clean = rawName.trim();

  // 1. Strip file extension (.png, .jpg, .jpeg, .webp, .gif, .svg, .mp4, etc.)
  clean = clean.replace(/\.(png|jpe?g|webp|gif|svg|mp4|mov|webm)$/i, '').trim();

  // 2. Format Gemini generated names: Gemini_Generated_Image_xxxx
  if (/^Gemini_Generated_Image_/i.test(clean)) {
    const hash = clean.replace(/^Gemini_Generated_Image_/i, '').trim();
    const shortHash = hash.slice(0, 6);
    return shortHash ? `AI场景 (${shortHash})` : 'AI生成场景';
  }

  // 3. Format Midjourney generated names
  if (/^Midjourney_/i.test(clean)) {
    const hash = clean.replace(/^Midjourney_/i, '').trim();
    const shortHash = hash.slice(0, 6);
    return shortHash ? `MJ场景 (${shortHash})` : 'MJ生成场景';
  }

  // 4. Strip timestamp prefixes: e.g. 1788417191816_scene_name
  if (/^\d{11,14}[-_]/.test(clean)) {
    const rest = clean.replace(/^\d{11,14}[-_]/, '').trim();
    if (rest) clean = rest;
  }

  // 5. Format phone camera file names: IMG_20240903_xxxx / Screenshot_2024xxxx
  if (/^IMG_\d{4}(\d{4})_.*$/i.test(clean)) {
    const datePart = clean.replace(/^IMG_\d{4}(\d{4})_.*$/i, '$1');
    return `实拍图_${datePart}`;
  }
  if (/^Screenshot_.*$/i.test(clean)) {
    return '截屏图片';
  }

  // 6. Replace multiple underscores and hyphens with clean spacing if it's not a short code
  if (clean.includes('_') || clean.includes('-')) {
    // If it's something like "参考卡-女-欧美", keep it as is
    if (!/[\u4e00-\u9fa5]/.test(clean)) {
      clean = clean.replace(/[_-]+/g, ' ').trim();
    }
  }

  // 7. Graceful length truncation with ellipsis
  if (clean.length > maxLength) {
    return clean.slice(0, maxLength - 1) + '…';
  }

  return clean;
}
