function loadImage(sourceUrl: string, cacheBust = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${sourceUrl}`));
    image.src = cacheBust && sourceUrl.startsWith('http')
      ? `${sourceUrl}${sourceUrl.includes('?') ? '&' : '?'}t=${Date.now()}`
      : sourceUrl;
  });
}

function sliceLoadedImage(image: HTMLImageElement, panels: number, direction: 'horizontal' | 'vertical'): string[] {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas context not available');
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const panelWidth = direction === 'horizontal' ? width / panels : width;
  const panelHeight = direction === 'vertical' ? height / panels : height;
  canvas.width = panelWidth;
  canvas.height = panelHeight;

  const results: string[] = [];
  for (let index = 0; index < panels; index++) {
    context.clearRect(0, 0, panelWidth, panelHeight);
    const sourceX = direction === 'horizontal' ? index * panelWidth : 0;
    const sourceY = direction === 'vertical' ? index * panelHeight : 0;
    context.drawImage(image, sourceX, sourceY, panelWidth, panelHeight, 0, 0, panelWidth, panelHeight);
    results.push(canvas.toDataURL('image/png'));
  }
  return results;
}

export async function sliceStoryboardImage(
  sourceUrl: string,
  panels: number,
  direction: 'horizontal' | 'vertical' = 'horizontal'
): Promise<string[]> {
  return sliceLoadedImage(await loadImage(sourceUrl), panels, direction);
}

export async function slicePanoramicBackground(sourceUrl: string): Promise<string[] | null> {
  try {
    const image = await loadImage(sourceUrl, true);
    if (image.naturalWidth / image.naturalHeight < 2) return null;
    return sliceLoadedImage(image, 3, 'horizontal');
  } catch (error) {
    console.warn('Failed to load background image for slicing:', sourceUrl, error);
    return null;
  }
}
