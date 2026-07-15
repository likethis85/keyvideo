/**
 * Uploads a file to Aliyun OSS via Vite dev server backend relay.
 * This prevents CORS issues and protects AccessKey credentials from leaking to the browser.
 * @param file The file to upload.
 */
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const uploadFileToOSS = async (file: File): Promise<string> => {
  const response = await fetch(`${BACKEND_BASE_URL}/api/upload?name=${encodeURIComponent(file.name)}`, {
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
