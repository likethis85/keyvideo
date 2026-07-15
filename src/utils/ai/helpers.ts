/**
 * Shared utility helpers for AI Gateway requests
 */

/**
 * Fetches an image from a URL and converts it into a base64 Data URL
 */
export const fetchImageAsBase64 = async (url: string): Promise<string> => {
  // If it is already a base64 Data URL, return it directly
  if (url.startsWith('data:image/')) {
    return url;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read image as Base64 Data URL'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('fetchImageAsBase64 error:', error);
    throw error;
  }
};

/**
 * Helper to recursively search an object for any image URL or base64 data string
 */
export const findImageUrlInObject = (obj: any): string => {
  if (!obj) return '';
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') || obj.startsWith('http://') || obj.startsWith('https://')) {
      return obj;
    }
    // Clean all whitespace (including newlines)
    const cleanStr = obj.replace(/\s/g, '');
    if (cleanStr.length > 500 && /^[A-Za-z0-9+/=]+$/.test(cleanStr.substring(0, 100))) {
      let mime = 'png';
      if (cleanStr.startsWith('/9j/')) {
        mime = 'jpeg';
      } else if (cleanStr.startsWith('R0lGOD')) {
        mime = 'gif';
      } else if (cleanStr.startsWith('UklGR')) {
        mime = 'webp';
      }
      return `data:image/${mime};base64,${cleanStr}`;
    }
    return '';
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findImageUrlInObject(item);
      if (found) return found;
    }
  }
  if (typeof obj === 'object') {
    if (obj.url && typeof obj.url === 'string') {
      return obj.url;
    }
    for (const key of Object.keys(obj)) {
      const found = findImageUrlInObject(obj[key]);
      if (found) return found;
    }
  }
  return '';
};

export interface RequestConfig {
  path: string;
  gatewayUrl: string;
  gatewayToken: string;
  contentType?: string | null;
}

/**
 * Builds request URL and authorization headers for the AI Gateway
 */
export const getGatewayRequestConfig = (config: RequestConfig) => {
  const { path, gatewayUrl, gatewayToken, contentType = 'application/json' } = config;
  const isDev = import.meta.env.DEV;
  const cleanGatewayUrl = gatewayUrl.replace(/\/+$/, '');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const requestUrl = isDev ? `/api-gateway${cleanPath}` : `${cleanGatewayUrl}${cleanPath}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${gatewayToken}`
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (isDev) {
    headers['x-gateway-target'] = cleanGatewayUrl;
  }

  return { requestUrl, headers };
};

/**
 * Resolves a media source URL. If running in Tauri and the source is a local path,
 * it returns the Tauri convertFileSrc equivalent.
 */
export const resolveMediaSrc = (src: string): string => {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src;
  }
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    try {
      return (window as any).__TAURI_INTERNALS__.convertFileSrc(src);
    } catch (e) {
      console.error('Failed to convert file src in resolveMediaSrc:', e);
    }
  }
  return src;
};
