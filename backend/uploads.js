import express from 'express';
import OSS from 'ali-oss';

export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac',
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif',
  'mp4', 'webm', 'mov'
]);

export const sanitizeOwnerSegment = (userId) => String(userId || '')
  .replace(/[^A-Za-z0-9_-]/g, '_')
  .slice(0, 100);

const defaultOssClient = () => new OSS({
  region: process.env.OSS_REGION || 'oss-cn-shanghai',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  secure: true
});

const readManifest = (req) => {
  const requestedName = String(req.query.name || 'file.mp3').slice(0, 200);
  const fileExt = requestedName.split('.').pop()?.toLowerCase() || '';
  return { requestedName, fileExt };
};

/**
 * Authenticated OSS upload/delete routes.
 *
 * Objects are written under `audio/<owner>/...` and deletion only succeeds for
 * keys inside the caller's own prefix, so knowing another user's object URL is
 * not enough to delete it. Requests without a verified identity are rejected
 * even if the router is accidentally mounted before the global auth middleware.
 */
export const createUploadRouter = ({
  createOssClient = defaultOssClient,
  maxUploadBytes = Math.max(1, Number(process.env.MAX_UPLOAD_MB) || 100) * 1024 * 1024,
  randomSuffix = () => Math.random().toString(36).substring(2, 11),
  logger = console
} = {}) => {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!req.authUser?.id) return res.status(401).json({ error: 'unauthorized' });
    return next();
  });

  router.post('/upload', (req, res) => {
    const { fileExt } = readManifest(req);
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(fileExt)) {
      return res.status(400).json({ error: 'File type is not allowed' });
    }

    const owner = sanitizeOwnerSegment(req.authUser.id);
    if (!owner) return res.status(401).json({ error: 'unauthorized' });

    const chunks = [];
    let receivedBytes = 0;
    let uploadRejected = false;

    req.on('data', (chunk) => {
      if (uploadRejected) return;
      receivedBytes += chunk.length;
      if (receivedBytes > maxUploadBytes) {
        uploadRejected = true;
        chunks.length = 0;
        res.status(413).json({ error: 'Upload exceeds the configured size limit' });
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', async () => {
      if (uploadRejected) return;
      try {
        if (chunks.length === 0) {
          return res.status(400).json({ error: 'No file data received' });
        }

        const buffer = Buffer.concat(chunks);
        const client = createOssClient();
        const fileName = `${Date.now()}_${randomSuffix()}.${fileExt}`;
        const ossPath = `audio/${owner}/${fileName}`;
        const result = await client.put(ossPath, buffer, {
          headers: { 'x-oss-meta-keyvideo-owner': owner }
        });

        return res.status(200).json({ url: result.url });
      } catch (err) {
        logger.error('Alibaba Cloud OSS upload failed:', err);
        return res.status(500).json({ error: err.message || 'Upload failed' });
      }
    });
    return undefined;
  });

  router.post('/upload/delete', async (req, res) => {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
      const bucket = process.env.OSS_BUCKET;
      const expectedHost = `${bucket}.${process.env.OSS_REGION || 'oss-cn-shanghai'}.aliyuncs.com`;
      let urlObj;
      try {
        urlObj = new URL(String(url));
      } catch {
        return res.status(400).json({ error: 'Invalid object URL' });
      }
      if (urlObj.protocol !== 'https:' || urlObj.hostname !== expectedHost) {
        return res.status(400).json({ error: 'URL does not belong to the configured OSS bucket' });
      }

      const key = decodeURIComponent(urlObj.pathname.slice(1));
      const owner = sanitizeOwnerSegment(req.authUser.id);
      const ownerPrefix = `audio/${owner}/`;
      if (!owner || !key.startsWith(ownerPrefix) || key.includes('..') || key.includes('//')) {
        return res.status(403).json({ error: 'Object is not owned by the current user' });
      }

      const client = createOssClient();
      await client.delete(key);
      logger.log(`Deleted OSS object ${key}`);
      return res.status(200).json({ success: true });
    } catch (err) {
      logger.error('Alibaba Cloud OSS deletion failed:', err);
      return res.status(500).json({ error: err.message || 'Deletion failed' });
    }
  });

  return router;
};
