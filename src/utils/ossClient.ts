import { getBackendUrl } from './aiGateway';

/**
 * Uploads a file to Aliyun OSS via Vite dev server backend relay.
 * This prevents CORS issues and protects AccessKey credentials from leaking to the browser.
 * @param file The file to upload.
 */
export const uploadFileToOSS = async (file: File): Promise<string> => {
  const response = await fetch(`${getBackendUrl()}/api/upload?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    body: file
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Upload failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.url;
};

/**
 * Legacy wrapper for BGM audio uploading.
 */
export const uploadAudioToOSS = uploadFileToOSS;

/**
 * Deletes a file from Aliyun OSS via Vite dev server backend relay.
 * @param url The public URL of the file to delete.
 */
export const deleteFileFromOSS = async (url: string): Promise<void> => {
  if (!url || !url.startsWith('http')) return;
  try {
    const response = await fetch(`${getBackendUrl()}/api/upload/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Deletion failed with status ${response.status}`);
    }
  } catch (err) {
    console.error('Failed to delete file from OSS:', err);
    throw err;
  }
};
