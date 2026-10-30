import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OSS from 'ali-oss';
import fs from 'fs';
import path from 'path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'url';
import { createSsoRouter } from './sso.js';
import { createApiAuthMiddleware } from './auth.js';
import { fetchWithTimeout, assertSafeRemoteUrl, safeFetchRemote, readBodyWithTimeout } from './remoteUrl.js';
import { createIdempotencyMiddleware, IDEMPOTENT_GENERATION_PATHS } from './idempotency.js';
import { createImageProxyHandler } from './imageProxy.js';
import { createUploadRouter } from './uploads.js';
import { createKeyvideoCloudRouter } from './keyvideoCloud.js';
import { submitSandbaseTask } from './sandbaseSubmit.js';
import { compactTaskStore as compactTaskHistory } from './taskHistory.js';
import {
  createGenerationQuota,
  validateVideoTaskInput,
  validateVideoBatchInput,
  validateImageGenerationInput,
  validateMannequinInput,
  validateTryOnInput,
  validateInpaintInput,
  validateUpscaleInput,
  DEFAULT_DAILY_TASK_LIMIT,
  DEFAULT_MAX_CONCURRENT_TASKS
} from './generationLimits.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Persistent state lives outside the code directory so containers can mount a
// volume without shadowing the application. Defaults to the repo folder for
// local development.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (error) {
  console.error(`[TaskStore] Could not create DATA_DIR ${DATA_DIR}:`, error.message);
}

const app = express();
const port = process.env.PORT || 3001;
const host = process.env.HOST || '127.0.0.1';
const DEFAULT_EXTERNAL_TIMEOUT_MS = Math.max(5, Number(process.env.EXTERNAL_REQUEST_TIMEOUT_SECONDS) || 30) * 1000;
const LONG_EXTERNAL_TIMEOUT_MS = Math.max(30, Number(process.env.LONG_AI_REQUEST_TIMEOUT_SECONDS) || 180) * 1000;
const MAX_JSON_MB = Math.max(1, Number(process.env.MAX_JSON_MB) || 50);
const generationQuota = createGenerationQuota({
  dailyLimit: Number(process.env.AI_DAILY_TASK_LIMIT) || DEFAULT_DAILY_TASK_LIMIT,
  maxConcurrent: Number(process.env.AI_MAX_CONCURRENT_TASKS) || DEFAULT_MAX_CONCURRENT_TASKS
});

const enforceGenerationQuota = (req, res, cost = 1) => {
  const reservation = generationQuota.reserve(req.authUser?.id, cost);
  if (!reservation.ok) {
    res.set('Retry-After', '60');
    res.status(reservation.status || 429).json({
      error: reservation.error,
      code: reservation.code
    });
    return null;
  }
  // Safety net: release the concurrency slot no matter how the request exits.
  // release() is idempotent, so the explicit release after submission is safe.
  res.once('finish', reservation.release);
  res.once('close', reservation.release);
  return reservation;
};


const requiredEnv = [
  'OSS_ACCESS_KEY_ID',
  'OSS_ACCESS_KEY_SECRET',
  'OSS_BUCKET'
];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

if (!process.env.TEXT_LLM_API_KEY && !process.env.SANDBASE_API_KEY) {
  console.error('Missing required AI credentials: Please configure TEXT_LLM_API_KEY or SANDBASE_API_KEY');
  process.exit(1);
}

// Helper: Resolve Chat Completion API endpoint, key and model (Default to TelecomJS DeepSeek, then Sandbase)
const getChatCompletionConfig = () => {
  if (process.env.TEXT_LLM_API_KEY && process.env.TEXT_LLM_URL) {
    return {
      provider: 'TelecomJS OpenAICompatible',
      url: process.env.TEXT_LLM_URL,
      apiKey: process.env.TEXT_LLM_API_KEY,
      defaultModel: process.env.TEXT_LLM_MODEL || 'deepseek-v4-flash-0731-tem',
      isTextOnly: true
    };
  }
  if (process.env.SANDBASE_API_KEY) {
    return {
      provider: 'Sandbase AI',
      url: process.env.SANDBASE_CHAT_URL || 'https://api.sandbase.ai/v1/chat/completions',
      apiKey: process.env.SANDBASE_API_KEY,
      defaultModel: process.env.SANDBASE_CHAT_MODEL || 'google/gemini-2.5-flash',
      isTextOnly: false
    };
  }
  return {
    provider: 'Unconfigured',
    url: '',
    apiKey: '',
    defaultModel: '',
    isTextOnly: true
  };
};

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,https://www.marius.com.cn,https://marius.com.cn')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    // Native Tauri and server-to-server requests generally have no Origin header.
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
  exposedHeaders: ['X-Idempotency-Replayed']
}));
app.use(express.json({ limit: `${MAX_JSON_MB}mb` }));
app.use(express.urlencoded({ limit: `${MAX_JSON_MB}mb`, extended: true }));

app.use((err, _req, res, next) => {
  if (err?.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ error: err.message });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'request_too_large' });
  }
  return next(err);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'keyvideo-backend', timestamp: Date.now() });
});

// Unified SSO (marius-sso). The client secret and code exchange stay on the server.
const ssoRouter = createSsoRouter();
app.use('/api/auth/sso', ssoRouter);
// Production may proxy /videos/api/* without stripping the /videos prefix.
app.use('/videos/api/auth/sso', ssoRouter);

// Every remaining /api/* route requires a valid KeyVideo SSO session or a
// Supabase access token. Public media proxying is handled inside the middleware.
app.use('/api', createApiAuthMiddleware());

// Keep authenticated API traffic bounded. Polling five video tasks every 3.5s
// stays well below this; abusive loops are rejected with 429.
const API_RATE_LIMIT_PER_MINUTE = Math.max(60, Number(process.env.API_RATE_LIMIT_PER_MINUTE) || 600);
const API_RATE_BUCKET_CAPACITY = Math.max(100, Number(process.env.API_RATE_BUCKET_CAPACITY) || 5_000);
const apiRateBuckets = new Map();
app.use('/api', (req, res, next) => {
  const userId = req.authUser?.id;
  if (!userId) return next();
  const now = Date.now();
  const existing = apiRateBuckets.get(userId);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + 60_000 }
    : existing;
  bucket.count += 1;
  apiRateBuckets.set(userId, bucket);
  if (bucket.count > API_RATE_LIMIT_PER_MINUTE) {
    res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    return res.status(429).json({ error: 'rate_limited', error_description: '请求过于频繁，请稍后重试' });
  }
  if (apiRateBuckets.size > API_RATE_BUCKET_CAPACITY) {
    for (const [key, value] of apiRateBuckets) {
      if (value.resetAt <= now) apiRateBuckets.delete(key);
    }
    // Hard cap: evict the oldest live buckets even if their minute has not
    // elapsed, so a stream of distinct accounts cannot grow the map forever.
    for (const key of apiRateBuckets.keys()) {
      if (apiRateBuckets.size <= API_RATE_BUCKET_CAPACITY) break;
      if (key !== userId) apiRateBuckets.delete(key);
    }
  }
  return next();
});

// Idempotent generation replay runs only after authentication, so cached paid
// results are namespaced by the verified user and canonical request body.
app.use(IDEMPOTENT_GENERATION_PATHS, createIdempotencyMiddleware({
  ttlMs: Math.max(5, Number(process.env.IDEMPOTENCY_TTL_SECONDS) || 30) * 1000,
  maxEntries: Math.max(1, Number(process.env.IDEMPOTENCY_MAX_ENTRIES) || 1000)
}));

const TRYON_SCENE_PROMPT_DESCRIPTIONS = {
  street: 'posing in a modern urban street with city lights and soft outdoor background',
  studio: 'posing in a professional indoor photo studio with clean lighting and neutral studio backdrop',
  home: 'posing in a cozy warm living room with soft lighting, high-end modern home background',
  office: 'posing in a sleek modern corporate office space, high-end building interior',
  beach: 'posing on a beautiful sunny holiday beach with soft sand and gentle ocean waves',
  runway: 'posing on a fashion show runway with stage lights and professional modeling setup',
  minimalist: 'posing against a minimalist wabi-sabi concrete wall with artistic soft shadows'
};

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const REAL_PUBLIC_DIR = fs.existsSync(PUBLIC_DIR) ? fs.realpathSync(PUBLIC_DIR) : PUBLIC_DIR;
const MAX_LOCAL_IMAGE_BYTES = Math.max(1, Number(process.env.MAX_IMAGE_MB) || 25) * 1024 * 1024;
const LOCAL_IMAGE_MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif'
};

// Helper: Normalize image URL for Sandbase API
// - HTTP/HTTPS URLs are preserved as URLs without base64 conversion
// - Local relative paths (like /clothing_model.png) are resolved from public/ and converted to Data URIs
// - Data URIs are checked and corrected if MIME type header mismatches magic bytes (e.g. data:image/png for JPEG bytes)
const normalizeImageUrl = (url) => {
  if (typeof url !== 'string' || !url) return '';

  // 1. Keep HTTP / HTTPS URLs as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // 2. Handle local relative assets (like /clothing_model.png)
  if (url.startsWith('/')) {
    try {
      const pathname = decodeURIComponent(url.split('?')[0].split('#')[0]);
      if (!pathname || pathname.includes('\0') || pathname.includes('\\')) return '';
      const localPath = path.resolve(PUBLIC_DIR, `.${pathname}`);
      if (localPath !== PUBLIC_DIR && !localPath.startsWith(`${PUBLIC_DIR}${path.sep}`)) return '';
      if (!fs.existsSync(localPath)) return '';
      const realPath = fs.realpathSync(localPath);
      if (realPath !== REAL_PUBLIC_DIR && !realPath.startsWith(`${REAL_PUBLIC_DIR}${path.sep}`)) return '';
      const ext = path.extname(realPath).toLowerCase();
      const mimeType = LOCAL_IMAGE_MIME_TYPES[ext];
      if (!mimeType) return '';
      const stat = fs.statSync(realPath);
      if (!stat.isFile() || stat.size > MAX_LOCAL_IMAGE_BYTES) return '';
      const fileBuffer = fs.readFileSync(realPath);
      return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    } catch (e) {
      console.warn(`Failed to resolve local asset ${url} to base64:`, e.message);
    }
  }

  // 3. Handle existing Data URIs (fix mismatched MIME headers if present)
  if (url.startsWith('data:image/')) {
    const commaIdx = url.indexOf(',');
    if (commaIdx !== -1) {
      const header = url.substring(0, commaIdx);
      const base64Data = url.substring(commaIdx + 1).trim();
      let correctMime = '';
      if (base64Data.startsWith('/9j/')) correctMime = 'image/jpeg';
      else if (base64Data.startsWith('iVBORw0KGg')) correctMime = 'image/png';
      else if (base64Data.startsWith('R0lGOD')) correctMime = 'image/gif';
      else if (base64Data.startsWith('UklGR')) correctMime = 'image/webp';

      if (correctMime && !header.startsWith(`data:${correctMime};`)) {
        return `data:${correctMime};base64,${base64Data}`;
      }
    }
    return url;
  }

  return url;
};

// Helper: Fetch remote image as Base64 Data URL (when explicitly needed for OSS upload or canvas)
const fetchImageAsBase64 = async (url) => {
  const normalized = normalizeImageUrl(url);
  if (!normalized) throw new Error('Invalid or unsupported image URL');
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    return normalized;
  }
  const response = await safeFetchRemote(normalized, {}, 60_000);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_LOCAL_IMAGE_BYTES) {
    throw new Error('Remote image exceeds the size limit');
  }
  const buffer = await readBodyWithTimeout(response, { timeoutMs: 60_000 });
  if (buffer.byteLength > MAX_LOCAL_IMAGE_BYTES) {
    throw new Error('Remote image exceeds the size limit');
  }
  const base64 = Buffer.from(buffer).toString('base64');
  let contentType = response.headers.get('content-type');
  if (!contentType || !contentType.startsWith('image/')) {
    contentType = base64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
  }
  return `data:${contentType};base64,${base64}`;
};

const resolveLocalAssetToBase64 = normalizeImageUrl;

const extractTaskOutputUrl = (data) => {
  if (data?.outputs?.[0]?.url) return data.outputs[0].url;
  if (data?.result?.videos?.[0]) return data.result.videos[0];
  if (data?.result?.images?.[0]) return data.result.images[0];
  return '';
};

// Helper: Upload remote URL directly to Alibaba Cloud OSS
const uploadUrlToOSS = async (imageUrl) => {
  const response = await safeFetchRemote(imageUrl, {}, 60_000);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();

  const client = new OSS({
    region: process.env.OSS_REGION || 'oss-cn-shanghai',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    secure: true
  });

  const fileExt = 'png';
  const randomName = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${fileExt}`;
  const ossPath = `audio/${randomName}`;
  const result = await client.put(ossPath, Buffer.from(buffer));
  return result.url;
};

// Helper: Recursively search object for image URL or base64 data
const findImageUrlInObject = (obj) => {
  if (!obj) return '';
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') || obj.startsWith('http://') || obj.startsWith('https://')) {
      return obj;
    }
    const cleanStr = obj.replace(/\s/g, '');
    if (cleanStr.length > 500 && /^[A-Za-z0-9+/=]+$/.test(cleanStr.substring(0, 100))) {
      let mime = 'png';
      if (cleanStr.startsWith('/9j/')) mime = 'jpeg';
      else if (cleanStr.startsWith('R0lGOD')) mime = 'gif';
      else if (cleanStr.startsWith('UklGR')) mime = 'webp';
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


// Helper: Poll sandbase.ai task until completed (with retry on transient errors)
const pollSandbaseTask = async (taskId, timeoutSeconds = 360) => {
  const apiKey = process.env.SANDBASE_API_KEY;
  const pollInterval = 3000; // 3 seconds
  const maxRetries = Math.ceil((timeoutSeconds * 1000) / pollInterval);

  console.log(`[Sandbase API] <<< Started polling for Task ID: ${taskId} (Timeout: ${timeoutSeconds}s)`);

  for (let i = 0; i < maxRetries; i++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    try {
      const response = await fetchWithTimeout(`https://api.sandbase.ai/v1/run/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        // If it's a server error (502, 503, 504) or rate limit (429), don't crash, just log and continue polling
        if (response.status >= 500 || response.status === 429) {
          console.warn(`[Sandbase API] Polling returned transient status ${response.status}. Retrying on next tick...`);
          continue;
        }
        const errText = await response.text();
        throw new Error(`Sandbase polling failed (${response.status}): ${errText}`);
      }

      const data = await readBodyWithTimeout(response, { timeoutMs: 30_000, format: 'json' });
      const elapsedSeconds = Math.round(((i + 1) * pollInterval) / 1000);
      console.log(`[Sandbase API] Polling Task ID: ${taskId} | Status: ${data.status} | Elapsed: ${elapsedSeconds}s/${timeoutSeconds}s`);

      if (data.status === 'completed') {
        if (data.outputs && data.outputs.length > 0 && data.outputs[0].url) {
          console.log(`[Sandbase API] Task ${taskId} completed.`);
          return data.outputs[0].url;
        }
        if (data.result && data.result.images && data.result.images.length > 0) {
          console.log(`[Sandbase API] Task ${taskId} completed.`);
          return data.result.images[0];
        }
        throw new Error('Sandbase task completed but no images returned');
      } else if (data.status === 'failed') {
        const errMsg = typeof data.error === 'object' ? (data.error?.message || JSON.stringify(data.error)) : (data.error || 'Unknown error');
        throw new Error(`Sandbase task failed: ${errMsg}`);
      }
    } catch (err) {
      // Log error and continue loop unless it's a non-transient assertion failure
      if (err.message.includes('Sandbase task failed') || err.message.includes('no images returned')) {
        throw err;
      }
      console.warn(`[Sandbase API] Polling encountered network error: ${err.message}. Retrying on next tick...`);
    }
  }
  throw new Error(`Sandbase task timed out (exceeded ${timeoutSeconds}s)`);
};


// --- Persistent AI Task Store Manager ---
const sanitizeTaskRecord = (record = {}) => ({
  taskId: record.taskId,
  status: record.status || 'pending',
  createdAt: record.createdAt || Date.now(),
  ...(record.updatedAt ? { updatedAt: record.updatedAt } : {}),
  ...(record.type ? { type: record.type } : {}),
  ...(record.scene ? { scene: String(record.scene).slice(0, 100) } : {}),
  ...(record.projectId ? { projectId: String(record.projectId).slice(0, 100) } : {}),
  ...(record.userId ? { userId: String(record.userId).slice(0, 100) } : {}),
  ...(record.shotId ? { shotId: String(record.shotId).slice(0, 100) } : {}),
  ...(record.shotName ? { shotName: String(record.shotName).slice(0, 200) } : {}),
  ...(Number.isFinite(record.shotIndex) ? { shotIndex: record.shotIndex } : {}),
  ...(record.prompt ? { prompt: String(record.prompt).slice(0, 4000) } : {}),
  ...(typeof record.imageSrc === 'string' && /^https?:\/\//.test(record.imageSrc)
    ? { imageSrc: record.imageSrc.slice(0, 2000) }
    : {}),
  ...(record.resultUrl ? { resultUrl: record.resultUrl } : {}),
  ...(record.error ? { error: typeof record.error === 'string' ? record.error.slice(0, 1000) : JSON.stringify(record.error).slice(0, 1000) } : {}),
  ...(record.model ? { model: String(record.model).slice(0, 150) } : {}),
  ...(record.duration ? { duration: record.duration } : {})
});

const compactTaskStore = () => {
  const compacted = compactTaskHistory(taskStore, {
    perUserLimit: Number(process.env.TASK_HISTORY_MAX_PER_USER) || undefined,
    totalLimit: Number(process.env.TASK_HISTORY_MAX_TOTAL) || undefined
  });
  return Object.fromEntries(
    Object.entries(compacted).map(([key, value]) => [key, sanitizeTaskRecord(value)])
  );
};

const TASKS_FILE = path.join(DATA_DIR, 'tasks_history.json');
const TASKS_BACKUP_FILE = `${TASKS_FILE}.bak`;
let taskStore = {};
let primaryTaskStoreIsValid = !fs.existsSync(TASKS_FILE);

const loadTaskStoreFile = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, sanitizeTaskRecord(value)])
  );
};

if (fs.existsSync(TASKS_FILE)) {
  try {
    taskStore = loadTaskStoreFile(TASKS_FILE);
    primaryTaskStoreIsValid = true;
  } catch (primaryError) {
    primaryTaskStoreIsValid = false;
    console.warn('[TaskStore] Primary history is unreadable:', primaryError.message);
    if (fs.existsSync(TASKS_BACKUP_FILE)) {
      try {
        taskStore = loadTaskStoreFile(TASKS_BACKUP_FILE);
        console.warn('[TaskStore] Recovered task history from backup.');
      } catch (backupError) {
        console.warn('[TaskStore] Backup history is also unreadable:', backupError.message);
      }
    }
  }
}

let saveTimer = null;
const writeTaskStoreSync = () => {
  const trimmed = compactTaskStore();
  const tmpFile = `${TASKS_FILE}.tmp.${process.pid}.${Date.now()}`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(trimmed, null, 2), 'utf-8');
    if (primaryTaskStoreIsValid && fs.existsSync(TASKS_FILE)) {
      fs.copyFileSync(TASKS_FILE, TASKS_BACKUP_FILE);
    }
    fs.renameSync(tmpFile, TASKS_FILE);
    primaryTaskStoreIsValid = true;
    taskStore = trimmed;
  } catch (error) {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {
      // Best-effort cleanup; preserve the original write error below.
    }
    throw error;
  }
};

const saveTaskStore = () => {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      writeTaskStoreSync();
    } catch (e) {
      console.warn('[TaskStore] Failed to atomically save tasks history:', e.message);
    }
  }, 100);
};

process.on('beforeExit', () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    try {
      writeTaskStoreSync();
    } catch (error) {
      console.warn('[TaskStore] Final save failed:', error.message);
    }
  }
});

let isShuttingDown = false;
const handleShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (saveTimer) clearTimeout(saveTimer);
  try {
    writeTaskStoreSync();
    console.log(`[TaskStore] Saved task history before ${signal}.`);
  } catch (error) {
    console.error(`[TaskStore] Could not save task history before ${signal}:`, error.message);
  }
  process.exit(0);
};

process.once('SIGINT', () => handleShutdown('SIGINT'));
process.once('SIGTERM', () => handleShutdown('SIGTERM'));

const registerTask = (taskId, meta = {}) => {
  taskStore[taskId] = sanitizeTaskRecord({
    taskId,
    status: 'pending',
    createdAt: Date.now(),
    ...meta
  });
  saveTaskStore();
};

const updateTaskStatus = (taskId, patch = {}) => {
  if (taskStore[taskId]) {
    taskStore[taskId] = sanitizeTaskRecord({
      ...taskStore[taskId],
      ...patch,
      updatedAt: Date.now()
    });
  } else {
    taskStore[taskId] = sanitizeTaskRecord({ taskId, status: 'pending', createdAt: Date.now(), ...patch });
  }
  saveTaskStore();
};

const IMAGE_TASK_TYPES = new Set(['background', 'mannequin', 'tryon', 'inpaint', 'upscale']);
const TASK_REFRESH_MIN_INTERVAL_MS = 3_000;
const taskRefreshTimes = new Map();

// After a restart (or a dropped client) the in-process poller is gone. When the
// UI keeps polling our status endpoint, refresh the upstream state so the task
// can still reach a terminal result instead of staying "processing" forever.
const refreshProcessingImageTask = async (taskId) => {
  const task = taskStore[taskId];
  if (!task || !IMAGE_TASK_TYPES.has(task.type)) return;
  if (task.status !== 'processing' && task.status !== 'pending') return;

  const apiKey = process.env.SANDBASE_API_KEY || process.env.AIGATEWAY_TOKEN;
  if (!apiKey) return;

  const timestamp = Date.now();
  if ((taskRefreshTimes.get(taskId) || 0) + TASK_REFRESH_MIN_INTERVAL_MS > timestamp) return;
  taskRefreshTimes.set(taskId, timestamp);
  if (taskRefreshTimes.size > 2_000) {
    for (const key of taskRefreshTimes.keys()) {
      taskRefreshTimes.delete(key);
      if (taskRefreshTimes.size <= 1_500) break;
    }
  }

  try {
    const response = await fetchWithTimeout(`https://api.sandbase.ai/v1/run/${taskId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` }
    }, 8_000);
    if (!response.ok) return;
    const data = await readBodyWithTimeout(response, { timeoutMs: 30_000, format: 'json' });
    if (!data?.status) return;
    const resultUrl = data.status === 'completed' ? extractTaskOutputUrl(data) : '';
    updateTaskStatus(taskId, {
      status: data.status,
      error: data.error || null,
      ...(resultUrl ? { resultUrl } : {})
    });
  } catch {
    // Best-effort recovery; the next poll retries.
  }
};

// API: Query status and result of a task owned by the current user
app.get('/api/ai/task/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const task = taskStore[taskId];
  if (!task || task.userId !== req.authUser?.id) {
    return res.status(404).json({ error: 'Task not found' });
  }
  await refreshProcessingImageTask(taskId);
  res.json(taskStore[taskId]);
});

// API: Pull recent generated tasks history for the current user.
app.get('/api/ai/tasks/recent', (req, res) => {
  const { projectId } = req.query;
  let list = Object.values(taskStore).filter(t => t.userId === req.authUser?.id);
  if (projectId) {
    list = list.filter(t => t.projectId === projectId);
  }
  list = list
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 50);
  res.json({ tasks: list });
});


// Authenticated raw-binary OSS upload/delete (drop-in replacement for the Vite
// configureServer proxy). Objects are namespaced per user and deletes are
// owner-checked inside the router.
app.use('/api', createUploadRouter());
// SSO cloud persistence. The router is authenticated above and uses the
// server-only Supabase service-role key; it never exposes that key to clients.
app.use('/api/cloud', createKeyvideoCloudRouter());

// AI Mannequin Model Swap
app.post('/api/ai/mannequin', async (req, res) => {
  try {
    const validation = validateMannequinInput(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error, code: validation.code });
    }
    const { imageUrl, gender, region, ratio, customPrompt } = validation.value;

    const reservation = enforceGenerationQuota(req, res, 1);
    if (!reservation) return;

    const genderStr = gender === 'female' ? 'female' : 'male';
    const regionStr = region === 'east-asian' ? 'East Asian' : 'Western';

    let textPrompt = customPrompt ||
      `A premium quality fashion catalog photo. A high-resolution photo of a professional ${regionStr} ${genderStr} model wearing this clothing, posing against a clean solid white background. Highly detailed, realistic skin texture and clothing folds. Flat studio lighting.`;
    textPrompt += " The generated image must be clean and must not contain any text, letters, words, numbers, writing, signatures, logos, watermarks, stamps, tags, or captions.";

    const apiAspectRatio = ratio.replace('-', ':');

    const sandbasePayload = {
      model: 'google/nano-banana-2/edit',
      images: [imageUrl],
      prompt: textPrompt,
      resolution: '1K',
      aspect_ratio: apiAspectRatio,
      output_format: 'png',
      enable_web_search: false,
      enable_image_search: false
    };

    let taskId;
    try {
      taskId = await submitSandbaseTask(sandbasePayload, {
        userId: req.authUser?.id,
        requestKey: req.get('X-Idempotency-Key')
      });
    } finally {
      reservation.release();
    }
    registerTask(taskId, { type: 'mannequin', prompt: textPrompt, userId: req.authUser?.id, status: 'processing' });

    const poller = async () => {
      try {
        const resultImageUrl = await pollSandbaseTask(taskId);
        updateTaskStatus(taskId, { status: 'completed', resultUrl: resultImageUrl });
        return resultImageUrl;
      } catch (pollErr) {
        updateTaskStatus(taskId, { status: 'failed', error: pollErr.message });
        throw pollErr;
      }
    };

    if (req.query.async === 'true' || req.body.async === true) {
      poller().catch(e => console.warn(`[Mannequin Task ${taskId}] Background polling error:`, e.message));
      return res.status(200).json({ taskId, status: 'processing' });
    }

    const resultImageUrl = await poller();
    res.status(200).json({ taskId, url: resultImageUrl });
  } catch (err) {
    console.error('Mannequin generation failed:', err);
    res.status(500).json({ error: err.message || 'Mannequin generation failed' });
  }
});


// 3. AI Try-On & Pose Integration
app.post('/api/ai/tryon', async (req, res) => {
  try {
    const validation = validateTryOnInput(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error, code: validation.code });
    }
    const { clothingUrl, clothingBottomUrl, modelUrl, gender, region, scene, ratio, customPrompt, backgroundImageUrl, poseImageUrl, projectId } = validation.value;

    const reservation = enforceGenerationQuota(req, res, 1);
    if (!reservation) return;

    let rawImages = [];

    if (Array.isArray(clothingUrl)) {
      clothingUrl.forEach(url => { if (url) rawImages.push(url); });
    } else if (clothingUrl) {
      rawImages.push(clothingUrl);
    }

    if (clothingBottomUrl) {
      rawImages.push(clothingBottomUrl);
    }

    if (Array.isArray(modelUrl)) {
      modelUrl.forEach(url => { if (url) rawImages.push(url); });
    } else if (modelUrl) {
      rawImages.push(modelUrl);
    }

    if (poseImageUrl) {
      rawImages.push(poseImageUrl);
    }

    if (backgroundImageUrl) {
      rawImages.push(backgroundImageUrl);
    }

    // Resolve any local relative assets to base64 before sending to Sandbase API
    let images = [];
    for (const img of rawImages) {
      images.push(await resolveLocalAssetToBase64(img));
    }

    const genderStr = gender === 'female' ? 'female' : 'male';
    const regionStr = region === 'east-asian' ? 'East Asian' : 'Western';
    const sceneDesc = TRYON_SCENE_PROMPT_DESCRIPTIONS[scene] || 'posing in a matching catalog studio setting';

    const clothingsCount = Array.isArray(clothingUrl) ? clothingUrl.filter(Boolean).length : (clothingUrl ? 1 : 0);
    const bottomCount = clothingBottomUrl ? 1 : 0;
    const modelsCount = Array.isArray(modelUrl) ? modelUrl.filter(Boolean).length : (modelUrl ? 1 : 0);
    const poseCount = poseImageUrl ? 1 : 0;

    // Build explicit role indexing mappings in 图X format to guide the AI model
    let clothingIndexText = '';
    if (clothingsCount === 1) {
      clothingIndexText = '图1';
    } else if (clothingsCount > 1) {
      clothingIndexText = `图1至图${clothingsCount}`;
    }

    let bottomIndexText = '';
    if (bottomCount > 0) {
      bottomIndexText = `图${1 + clothingsCount}`;
    }

    const modelStartIndex = 1 + clothingsCount + bottomCount;
    let modelIndexText = '';
    if (modelsCount === 1) {
      modelIndexText = `图${modelStartIndex}`;
    } else if (modelsCount > 1) {
      modelIndexText = `图${modelStartIndex}至图${modelStartIndex + modelsCount - 1}`;
    }

    const clothingRef = bottomIndexText ? `${clothingIndexText} and ${bottomIndexText}` : clothingIndexText;
    const poseIndex = 1 + clothingsCount + bottomCount + modelsCount;

    const defaultPrompt = `Task: Generate a premium fashion catalog photo by transferring the exact outfit from ${clothingRef} onto the model from ${modelIndexText}.
Model (Strict): 100% exact face, facial features, head, hair, skin tone, and body of ${modelIndexText}. Do NOT retain any facial features or identity from ${clothingRef}${poseImageUrl ? ` or the pose reference image (图${poseIndex})` : ''}.
Outfit (Strict): Identical clothing from ${clothingRef} (fabric, drapery, and fit). Automatically outpaint missing lower body parts (bottoms/footwear) for a cohesive full-body look.
Style & Setting: High-resolution, detailed skin, professional studio lighting, solid light grey/white background.
Negative constraints: Clean image, strictly NO text, logos, watermarks, tags, or signatures.`;

    let textPrompt = '';
    if (customPrompt) {
      textPrompt = customPrompt;
    } else {
      textPrompt = defaultPrompt;
      if (poseImageUrl) {
        textPrompt += `\nPose Reference (Strict): Strictly copy the pose, posture, gesture, camera angle, and composition of the model in the pose reference image (图${poseIndex}) onto the target model.
CRITICAL MODEL FACE RULE: Only extract the body pose from 图${poseIndex}. Strictly do NOT copy, retain, transfer, or blend any face, head, hair, facial features, or identity from the pose reference model in 图${poseIndex}. The face and head of the generated model MUST be 100% strictly copied from ${modelIndexText}.
HANDBAG & ACCESSORY ADAPTATION: If the model originally carried a handbag or accessory, dynamically adapt its placement according to the new pose in 图${poseIndex}. If holding a bag is unnatural or incompatible with the new posture in 图${poseIndex}, automatically omit the bag completely from the image.`;
      }
      if (backgroundImageUrl) {
        const bgIndex = 1 + clothingsCount + bottomCount + modelsCount + poseCount;
        textPrompt += `\nBackground (Strict): The background of the generated image must strictly and exactly match the provided background reference image (图${bgIndex}) in every single pixel, detail, color, furniture, layout, texture, and structure. Do not alter, regenerate, modify, or add any new elements to the background. The model must be seamlessly integrated into the exact background provided.`;
      }
    }

    const apiAspectRatio = ratio.replace('-', ':');

    const sandbasePayload = {
      model: 'google/nano-banana-2/edit',
      images: images,
      prompt: textPrompt,
      resolution: '1K',
      aspect_ratio: apiAspectRatio,
      output_format: 'png',
      enable_web_search: false,
      enable_image_search: false
    };

    let taskId;
    try {
      taskId = await submitSandbaseTask(sandbasePayload, {
        userId: req.authUser?.id,
        requestKey: req.get('X-Idempotency-Key')
      });
    } finally {
      reservation.release();
    }
    registerTask(taskId, { type: 'tryon', scene, prompt: textPrompt, projectId, userId: req.authUser?.id, status: 'processing' });

    const poller = async () => {
      try {
        const resultImageUrl = await pollSandbaseTask(taskId);
        updateTaskStatus(taskId, { status: 'completed', resultUrl: resultImageUrl });
        return resultImageUrl;
      } catch (pollErr) {
        updateTaskStatus(taskId, { status: 'failed', error: pollErr.message });
        throw pollErr;
      }
    };

    if (req.query.async === 'true' || req.body.async === true) {
      poller().catch(e => console.warn(`[Tryon Task ${taskId}] Background polling error:`, e.message));
      return res.status(200).json({ taskId, status: 'processing' });
    }

    const resultImageUrl = await poller();
    res.status(200).json({ taskId, url: resultImageUrl });
  } catch (err) {
    console.error('Try-on failed:', err);
    res.status(500).json({ error: err.message || 'Try-on failed' });
  }
});

// 4. AI Background Scene Generation
app.post('/api/ai/background', async (req, res) => {
  try {
    const validation = validateImageGenerationInput(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error, code: validation.code });
    }
    const { prompt, ratio, refImageUrl } = validation.value;
    if (!ratio) {
      return res.status(400).json({ error: 'ratio is required', code: 'INVALID_INPUT' });
    }

    const reservation = enforceGenerationQuota(req, res, 1);
    if (!reservation) return;

    const apiAspectRatio = ratio.replace('-', ':');
    const backgroundPrompt = `A professional commercial background scene, high resolution, photorealistic, empty setting for fashion model photoshoot, clean composition, studio lighting. Scene description: ${prompt}. No people, no models, no text, no watermarks.`;

    const sandbasePayload = {
      model: refImageUrl ? 'google/nano-banana-2/edit' : 'google/nano-banana-2',
      prompt: backgroundPrompt,
      resolution: '1K',
      aspect_ratio: apiAspectRatio,
      output_format: 'png',
      enable_web_search: false,
      enable_image_search: false
    };

    if (refImageUrl) {
      sandbasePayload.images = [refImageUrl];
    }

    let taskId;
    try {
      taskId = await submitSandbaseTask(sandbasePayload, {
        userId: req.authUser?.id,
        requestKey: req.get('X-Idempotency-Key')
      });
    } finally {
      reservation.release();
    }

    registerTask(taskId, {
      type: 'background',
      prompt: backgroundPrompt,
      projectId: typeof req.body.projectId === 'string' ? req.body.projectId : undefined,
      userId: req.authUser?.id,
      status: 'processing'
    });

    const poller = async () => {
      try {
        const resultImageUrl = await pollSandbaseTask(taskId);
        updateTaskStatus(taskId, { status: 'completed', resultUrl: resultImageUrl });
        return resultImageUrl;
      } catch (pollErr) {
        updateTaskStatus(taskId, { status: 'failed', error: pollErr.message });
        throw pollErr;
      }
    };

    if (req.query.async === 'true' || req.body.async === true) {
      poller().catch(error => console.warn(`[Background Task ${taskId}] Background polling error:`, error.message));
      return res.status(200).json({ taskId, status: 'processing' });
    }

    const resultImageUrl = await poller();

    // Sync callers keep the legacy base64 response to bypass browser CORS.
    const base64DataUrl = await fetchImageAsBase64(resultImageUrl);

    res.status(200).json({ taskId, url: base64DataUrl });
  } catch (err) {
    console.error('Background generation failed:', err);
    res.status(500).json({ error: err.message || 'Background generation failed' });
  }
});

// 5. Stylist Garment Suggestion
app.post('/api/ai/stylist', async (req, res) => {
  try {
    const { topUrl, bottomUrl } = req.body;

    const contentArray = [
      {
        type: 'text',
        text: `You are a professional fashion stylist. Analyze the uploaded garment(s) and generate matching recommendations for a fashion catalog photoshoot model.
If only one item (top or bottom) is provided, you must recommend the perfect match for the other half (style, color, fit).
If both are provided, summarize their style.
Also provide a recommendation for footwear (shoes) and accessories/bags (optional).
Output your recommendations strictly in the following JSON format:
{
  "matchingItem": "款式与配色描述 (例如：搭配高腰深蓝色直筒牛仔裤)",
  "shoes": "鞋履建议描述 (例如：搭配白色简约平底运动鞋)",
  "accessories": "配饰与包包建议描述 (例如：搭配银色简约细耳环，手持黑色复古皮质小包)"
}
Output ONLY the JSON object, no markdown wrappers, no other text.`
      }
    ];

    if (topUrl) {
      const base64Top = await fetchImageAsBase64(topUrl);
      contentArray.push({ type: 'image_url', image_url: { url: base64Top } });
    }
    if (bottomUrl) {
      const base64Bottom = await fetchImageAsBase64(bottomUrl);
      contentArray.push({ type: 'image_url', image_url: { url: base64Bottom } });
    }

    const chatConfig = getChatCompletionConfig();
    const isTextOnly = chatConfig.isTextOnly || chatConfig.defaultModel.toLowerCase().includes('deepseek');

    let messages;
    if (isTextOnly) {
      const textOnlyPrompt = `You are a professional fashion stylist. Generate matching outfit recommendations for a fashion catalog photoshoot model.
Provide a recommendation for matching clothing item (matchingItem), footwear (shoes), and accessories/bags (accessories).
Output your recommendations strictly in the following JSON format:
{
  "matchingItem": "款式与配色描述 (例如：搭配高腰深蓝色直筒牛仔裤)",
  "shoes": "鞋履建议描述 (例如：搭配白色简约平底运动鞋)",
  "accessories": "配饰与包包建议描述 (例如：搭配银色简约细耳环，手持黑色复古皮质小包)"
}
Output ONLY the JSON object, no markdown wrappers, no other text.`;
      messages = [{ role: 'user', content: textOnlyPrompt }];
    } else {
      messages = [{ role: 'user', content: contentArray }];
    }

    const requestBody = {
      model: chatConfig.defaultModel,
      messages: messages,
      max_tokens: 1024,
      stream: false
    };
    if (!isTextOnly) {
      requestBody.response_format = { type: 'json_object' };
    }

    console.log(`[AI Stylist] Calling chat completions via ${chatConfig.provider} (model: ${chatConfig.defaultModel})`);

    const response = await fetchWithTimeout(chatConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chatConfig.apiKey}`
      },
      body: JSON.stringify(requestBody)
    }, LONG_EXTERNAL_TIMEOUT_MS);

    if (!response.ok) throw new Error(`AI Stylist failed (${response.status})`);

    const responseData = await readBodyWithTimeout(response, { timeoutMs: 30_000, format: 'json' });
    const choiceContent = responseData.choices?.[0]?.message?.content;
    if (!choiceContent) throw new Error('No message content returned from AI Stylist');

    const cleanJsonStr = choiceContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    let jsonToParse = cleanJsonStr;
    const firstBraceIdx = cleanJsonStr.indexOf('{');
    const lastBraceIdx = cleanJsonStr.lastIndexOf('}');
    if (firstBraceIdx !== -1 && lastBraceIdx !== -1 && lastBraceIdx > firstBraceIdx) {
      jsonToParse = cleanJsonStr.substring(firstBraceIdx, lastBraceIdx + 1);
    }

    const sanitizedJsonStr = jsonToParse.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (_match, p1) => {
      const escaped = p1.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
      return `"${escaped}"`;
    });

    const parsed = JSON.parse(sanitizedJsonStr);
    res.status(200).json({
      matchingItem: Array.isArray(parsed.matchingItem) ? parsed.matchingItem.join('、') : (parsed.matchingItem || ''),
      shoes: Array.isArray(parsed.shoes) ? parsed.shoes.join('、') : (parsed.shoes || ''),
      accessories: Array.isArray(parsed.accessories) ? parsed.accessories.join('、') : (parsed.accessories || '')
    });
  } catch (err) {
    console.error('Stylist suggestion failed:', err);
    res.status(500).json({ error: err.message || 'Suggestion failed' });
  }
});

// 6. Prompts Generation from Skill (Enriched)
app.post('/api/ai/text-copy', async (req, res) => {
  try {
    const { brief = '', product = '', platform = '短视频', tone = '高级自然', goal = '突出核心卖点' } = req.body || {};
    const clean = value => String(value ?? '').trim().slice(0, 1200);
    const safeBrief = clean(brief);
    if (!safeBrief) return res.status(400).json({ error: '请先输入文案主题或产品卖点' });

    const chatConfig = getChatCompletionConfig();
    if (!chatConfig.url || !chatConfig.apiKey) return res.status(503).json({ error: 'AI 文案服务暂未配置' });
    const prompt = `你是一名专业短视频广告文案编辑。请根据输入生成 5 条适合直接叠加在视频画面上的中文短文案。\n产品信息：${clean(product) || '未提供'}\n文案主题或用户要求：${safeBrief}\n发布平台：${clean(platform)}\n表达风格：${clean(tone)}\n本次目标：${clean(goal)}\n要求：每条 6 到 24 个汉字，口语清楚、有信息量，不编造价格、功效、材质和促销事实；避免夸大承诺；五条角度要不同。只输出 5 行文案，不要标题、编号、引号或解释。`;
    const response = await fetchWithTimeout(chatConfig.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chatConfig.apiKey}` },
      body: JSON.stringify({
        model: chatConfig.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 420,
        stream: false
      })
    }, LONG_EXTERNAL_TIMEOUT_MS);

    if (!response.ok) throw new Error(`AI 文案生成失败 (${response.status})`);
    const data = await readBodyWithTimeout(response, { timeoutMs: 30_000, format: 'json' });
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('AI 未返回文案内容');
    return res.status(200).json({ text: text.trim() });
  } catch (error) {
    console.error('Text copy generation failed:', error);
    return res.status(500).json({ error: error.message || 'AI 文案生成失败' });
  }
});

app.post('/api/ai/prompts-skill', async (req, res) => {
  try {
    const {
      modelOutfitImgUrl,
      videoDuration,
      matchingItemDesc = '',
      shoesDesc = '',
      accessoriesDesc = '',
      modelScene = 'street',
      customScenes = [],
      storyboardImgUrls = [],
      backgroundImageUrl = '',
      model = '',
      storyboardMode = 'individual',
      useSlowMotion = false,
      focus = 'both',
      // 新增强化参数
      apparelStyle = 'general',
      cameraStyle = 'cinematic_dolly',
      lightingMood = 'editorial_soft',
      singleShotIndex = null,
      currentPrompt = ''
    } = req.body;

    const base64Outfit = await fetchImageAsBase64(modelOutfitImgUrl);
    let base64Background = null;
    if (backgroundImageUrl) {
      try {
        base64Background = await fetchImageAsBase64(backgroundImageUrl);
      } catch (err) {
        console.warn('Failed to load background reference image:', err.message);
      }
    }

    const is15s = videoDuration === '15s' || videoDuration === '3s';
    const customSceneObj = customScenes.find(s => s.id === modelScene);
    
    const ENRICHED_SCENE_DESCRIPTIONS = {
      street: '高档电影感多层都市街景（包括光滑的建筑金属板材墙面、通透的橱窗玻璃反射出温暖室内光、干净湿润的沥青地面映射出街灯倒影，后景有都市车流虚化形成的灿烂焦外光斑，多重光影交错）',
      studio: '侘寂风极简艺术画廊影棚（包括斑驳微水泥质感墙面、优雅几何弧形墙体设计、大落地窗斜射入的丁达尔几何光束阴影，空旷的画廊感空间纵深，摆放有极简洞石器皿与设计师单椅，光影交错极具呼吸感）',
      home: '奢华极简主义建筑别墅内景（包括抛光微水泥地面、温润的大理石/洞石岩板质感、隐藏式温暖线型灯带，落地玻璃窗外隐约可见葱郁且带薄雾的庭院植被，虚实对比强烈，极具深度空间层次）',
      office: '现代极简主义高档商务空间（包括大面积通透落地玻璃幕墙、后景隐约可见微雾暮色中的都市摩天大楼天际线、水磨石反射地面、高档金属与深色实木饰面，干净洗练的线性反射光）',
      beach: '高档热带海滨度假酒店一角（包括细腻洁净的沙滩、极简白色混凝土拱门廊柱建筑结构、斑驳的棕榈树叶阴影投射在浅色微水泥墙面上、远处有波光粼粼的蔚蓝海面焦外光斑，晨曦柔和侧光）',
      runway: '前卫概念时尚大秀秀场（包括粗犷的清水混凝土粗骨料墙体、光滑深色Catwalk镜面折射舞台高对比度射灯、轻微的环境烟雾漫反射氛围、上方几何光源形成极具时装大片质感的明暗轮廓）',
      minimalist: '高端侘寂风美术馆角落（包括柔和的微水泥米色弧形墙面、艺术阴影凹槽、空间几何留白、局部极简柔和光束，营造出极高冷、质感纯净的品牌画册大片拍摄环境）'
    };

    const sceneDetail = customSceneObj 
      ? `自定义参考场景：${customSceneObj.name}` 
      : (ENRICHED_SCENE_DESCRIPTIONS[modelScene] || '高端商业大片时尚摄影背景（包含高级微水泥墙面、几何光影与空间物理材质细节）');

    // 六大服装品类专属物理力学法则
    const APPAREL_PHYSICS_RULES = {
      dress: '【长裙/礼服专有物理力学】：重点展现裙摆的流线垂坠力学 (Fluid drape) 与波浪状起伏摆动 (Wave ripple)。微风轻抚裙裾，转身时面料顺势飘逸延展展开，呈现优雅灵动的悬垂与自然波褶。',
      suit: '【西服/正装专有物理力学】：强调挺阔肩线结构 (Structured shoulder line) 与平整垂顺的驳头剪裁。面料呈现高档羊毛/精纺微观哑光质感，走动时保持挺拔身形，动作利落沉稳，凸显高级商政大片气场。',
      street: '【潮酷高街/运动机能专有物理力学】：突出立体机能剪裁、抽绳拉链与辅料反光质感。行走步态轻快松弛且富有节奏弹性，面料随动作呈现轻微自然拉伸与抗皱张力。',
      neo_chinese: '【新中式/国风汉服专有物理力学】：重点突出广袖流云 (Flowing sleeves) 与马面裙/旗袍的织金暗纹光泽 (Silk & brocade luster)。步履徐缓间衣袂飘飘，展现东方含蓄空灵与丝绸垂坠美学。',
      overcoat: '【风衣/大衣外套专有物理力学】：着重刻画衣摆随步伐自然前后开合 (Dynamic coat flare) 与重力摆动。大衣系带与排扣金属光泽微动，展现走路带风的超模出街气场。',
      knitwear: '【软糯针织/静奢羊绒专有物理力学】：微距聚焦细密羊绒的微观蓬松纤维与天然绒毛感。衣物呈现温润柔和的贴合悬垂 (Organic soft drape)，随呼吸轻微起伏。',
      general: '【高端服装自然物理力学】：展现面料真实的重力垂坠与微观物理折叠褶皱，随模特自然呼吸和微幅动态产生流线型垂坠美感。'
    };

    // 镜头运镜微操调性
    const CAMERA_STYLE_RULES = {
      cinematic_dolly: '【电影级平推与微移动】：采用电影感极慢平推镜头 (Ultra-slow Dolly In) 与微平移 (Subtle Pan)，焦点极其稳定，画面富有呼吸感。',
      orbit_360: '【秀场360°环绕追踪】：运镜注重弧形或环绕轨迹 (Smooth Orbit & Track)，围绕模特优雅微转，全方位展现服装正面、侧身与背面版型。',
      macro_rack: '【微距变焦质感特写】：运镜以微距浅景深变焦 (Macro Rack Focus) 为亮点，焦外背景如奶油般柔化虚化，极致突出面料肌理、缝线与扣件五金。',
      low_angle: '【低视角气场跟拍】：采用低角度跟拍镜头 (Low-angle heroic tracking)，拉长模特修长身材比例，营造大秀领闭出场的霸气气场。',
      default: '【高端时尚商业运镜】：缓推、微移与微动结合，镜头转动舒缓高档，保持大片从容感。'
    };

    // 光影与影调美学
    const LIGHTING_MOOD_RULES = {
      editorial_soft: '【大牌杂志柔光箱】：采用高端商业影棚大柔光箱漫射，配合柔和轮廓光勾勒服饰剪裁边缘，光影通透干净无杂质。',
      golden_hour: '【黄金时刻温暖逆光】：清晨或傍晚温暖斜阳侧逆光，发丝泛起金色光芒，镜头伴随柔和的自然丁达尔光晕。',
      wabi_sabi: '【侘寂极简几何硬影】：极简清水混凝土环境，大窗斜射入干净清晰的几何光斑与深浅阴影，极具现代建筑艺术冷淡感。',
      cyber_night: '【夜色街头潮酷霓虹】：都市湿润沥青路面折射出绚烂的街灯与霓虹倒影，主体带有冷暖对比的高级环境边缘光。',
      default: '【自然通透商业大片光影】：自然光线流转，高光温和，阴影细腻，材质层次分明。'
    };

    const apparelRule = APPAREL_PHYSICS_RULES[apparelStyle] || APPAREL_PHYSICS_RULES.general;
    const cameraRule = CAMERA_STYLE_RULES[cameraStyle] || CAMERA_STYLE_RULES.default;
    const lightingRule = LIGHTING_MOOD_RULES[lightingMood] || LIGHTING_MOOD_RULES.default;

    const base64Storyboards = await Promise.all(
      storyboardImgUrls.map(async (url) => {
        try {
          if (!url) return null;
          return await fetchImageAsBase64(url);
        } catch (err) {
          console.warn('Failed to fetch a storyboard image:', err.message);
          return null;
        }
      })
    );
    const validBase64Storyboards = base64Storyboards.filter(b => b !== null);

    const isNoSlice = storyboardMode === 'composite_no_slice';
    let promptText = '';

    const slowMotionInstruction = useSlowMotion ? `
【人物慢动作与注重运镜特殊强化约束】：
- 核心要求：当前模式下，智能生成的提示词必须以【人物慢动作】与【高端镜头运镜】为绝对核心与视觉主体。
- 人物慢动作：每一幕的人物动作描述必须明确包含“慢动作 (slow motion)”、“超慢速 (ultra-slow)”、“极致缓步”等词汇。模特的行走、转身、回眸、整理衣物等所有动态必须被描述为“极其缓慢、带有延迟感的电影级慢动作”，展现出面料在极慢速动态下的高级飘逸感与重力感。
- 注重镜头运镜：运镜描述必须非常具体且有强烈的镜头动感。必须在每一幕显式描述摄像机的轨迹，例如“极其缓慢地向前平推 (Ultra-slow Dolly In)”、“视差缓慢横移 (Parallax slow panning)”、“极其平滑的轨道环绕镜头 (Slow 360-degree camera orbit)”、“极慢变焦拉近 (Slow focal zoom in)”，突出镜头与主体人物之间的运动轨迹和距离变化，营造出强烈的高端时装电影运镜质感。
` : '';

    // ==========================================
    // 分支 A：单镜头独立智能润色 (Single-Shot Polish)
    // ==========================================
    if (singleShotIndex && singleShotIndex >= 1 && singleShotIndex <= 5) {
      const shotNames = ['第一幕：出场与氛围 (0-3s)', '第二幕：质感与特写 (3-6s)', '第三幕：张力与版型律动 (6-9s)', '第四幕：微动与细节 (9-12s)', '第五幕：定格与全貌展示 (12-15s)'];
      const shotTitle = shotNames[singleShotIndex - 1];

      promptText = `你是一个专业的电商时尚视频编导大师。请根据用户提供的模特穿搭图（图1）、场景和服装品类力学规约，专门对【第 ${singleShotIndex} 幕（${shotTitle}）】分镜提示词进行深度重构与高级润色。

【输入参数与规约】：
- 当前分镜原有草稿或需求：${currentPrompt || '无草稿，请全新根据该幕特征精心设计'}
- 服装品类物理力学规约：${apparelRule}
- 运镜调性指令：${cameraRule}
- 光影影调美学：${lightingRule}
- 场景空间与物理材质：${sceneDetail}
- 重点推广展示部位：${focus === 'top' ? '重点突出上装剪裁、衣领、袖口和上身材质' : focus === 'bottom' ? '重点突出下装垂坠力学、裤腿/裙摆摆动细节与腰线设计' : '整套搭配协调，兼顾全身或中景平衡'}
${slowMotionInstruction}

【针对第 ${singleShotIndex} 幕的特别创作指引】：
${singleShotIndex === 1 ? '- 第一幕核心为出场入画。首帧模特位于画外侧边边缘，随后从容慢速迈步走入画面中央站定，路径与背景实体完全分离，展现超模出街/进场气场。' : ''}
${singleShotIndex === 2 ? '- 第二幕核心为特写/微距推镜。极慢镜头推进，聚焦服饰细节（领口/纽扣/拉链/面料微观纹理），凸显面料在真实光照下的高级奢品感。' : ''}
${singleShotIndex === 3 ? '- 第三幕核心为律动与版型。模特优雅微侧身或步态舒展，服装呈现符合品类力学的流线型垂坠感与动态张力。' : ''}
${singleShotIndex === 4 ? '- 第四幕核心为微动态慢动作。平缓推移镜头，模特高冷微倾肩部或眼神微转，展示自然面料物理力学微小褶皱。' : ''}
${singleShotIndex === 5 ? '- 第五幕核心为定格与全身比例。镜头缓缓拉远，模特高冷定格，在富有纵深感的艺术场景背景下360度展现完美身材与服装搭配全貌。' : ''}

【输出要求】：
1. 请直接输出润色后的该幕完整描述段落，字数在 80-150 字之间。
2. 严禁输出“第${singleShotIndex}幕：”等序号前缀，严禁输出任何 Markdown 标记、代码块、换行符或多余的客套话。
3. 请确保语言充满电影质感与 Vogue 级别时尚感，详细融合镜头运镜、服装面料力学与背景光影层次。`;
    }
    // ==========================================
    // 分支 B：整段 15s/3s 5 幕脚本生成
    // ==========================================
    else if (isNoSlice) {
      promptText = `你是一个专业的电商时尚视频编导。请根据上传的[模特穿搭主图]（作为输入的第一张图像，即图1）和提供的场景及搭配参数，结合我们生成并作为图2传入给你的[16:9 五格分镜合集参考图]（即图2，这是一张完整的16:9图片，里面按顺序水平排列了5个分镜的小画面），${base64Background ? `以及作为图3传入给你的[背景场景模板图]（即图3，干净没有任何人物的场景空图），` : ''}调用以下视频提示词智能编排规约，生成一整段用于图生视频的15秒/12秒视频提示词。
 
【输入参数】：
- 穿搭图配饰/鞋子搭配建议：${matchingItemDesc} ${shoesDesc} ${accessoriesDesc}
- 目标环境场景空间与材质细节：${sceneDetail}
- 服装品类物理力学规约：${apparelRule}
- 镜头运镜调性指令：${cameraRule}
- 光影影调美学：${lightingRule}
- 重点推广与展示部位：${focus === 'top' ? '重点推广上装 (Topwear)。每一幕分镜描述（尤其是第二幕、第四幕和第五幕）必须主要关注和描绘上衣/外套的设计细节、肩线与胸口裁剪、衣领、袖口和上身材质，把上装作为视觉焦点。' : focus === 'bottom' ? '重点推广下装 (Bottomwear)。每一幕分镜描述（尤其是第二幕、第四幕和第五幕）必须主要关注和描绘下装/裤子/裙子的垂坠物理特性、裤腿/裙摆摆动细节、腰线设计与下身材质，把下装作为视觉焦点。' : '重点推广整体搭配与服饰协调度 (Overall)。保持全身或中景构图，合理兼顾展示整套衣服的搭配协调度。'}
${slowMotionInstruction}
 
【技能规约核心框架】：
- 严格图像序号命名规约：生成内容中引用的任何图像，必须且只能命名为「图1」、「图2」、「图3」、「图4」、「图5」、「图6」或「图7」格式。严禁在输出的提示词中出现任何诸如「@image_0.png」、「@image_1.png」、「image_0.png」、「@input_file_0.png」等临时变量名或具体图像文件名，必须将其映射为中文序号。
模块一：视觉资产解耦与锚定 (Asset Decoupling & Anchoring)
- 主体锚点（引用 图1）：锁定主体细节。整个视频生成过程中，必须严格锁定图1中的人物五官、身材比例、服装款式、色彩及面料细节，确保 100% 一致性。
- 时空锚点（引用 图2）：图2是一整张16:9分镜合集大图。请指导视频模型直接以这整张16:9的五格合集图作为蓝本，顺序连贯地从左到右过渡（从第一格动画推演到最后一格），平滑在分镜的不同视图之间切换推演。
${base64Background ? `- 场景背景锚点（引用 图3）：整个生成过程中，必须读取图3所示的纯净场景模板，确保在每一幕分镜中详细描述并严格还原图3的背景细节（包括色调、光线投射方向、室内外布景以及陈设物品），锁定生成视频的背景一致性。` : ''}
- 场景空间深度与背景细节：绝对不允许描述成单调的‘在影棚’或‘在街头’。你必须结合给定的“- 目标环境场景空间与材质细节”，在每一幕中详细拓展和描绘“多层空间透视、精细的墙面地面物理材质（如微水泥质感、湿沥青地面反射、镜面大理石纹理）、独特的氛围光线（如几何丁达尔斜射光、温暖的橱窗折射、柔焦焦外光斑）以及极简的高档软装摆件（如弧形门廊、洞石器皿、花瓶干树枝、设计师单椅）”，使得生成的视频背景层次极具纵深空间感与高端画册感，解决背景单一单薄的问题。
 
模块二：动态微操注入与高端运镜 (Micro-Dynamics & Premium Camera Motion)
- 摄像机运镜：遵循给定的【镜头运镜调性指令】。镜头转动舒缓、高档且富有呼吸感。
- 人物与动作幅度控制：模特采取「高端时尚大片微动态 (High-fashion micro-movements)」姿态，人物动作幅度微小且极其缓慢优雅，避免任何过快或大范围肢体摆动，以求极高的画面清晰度和大片高冷质感。
- 环境与光影美学：遵循给定的【光影影调美学】。自然细腻的光感流转，雕琢Vogue杂志大片般的明暗质感。
- 人物与面料力学：严格遵循给定的【服装品类物理力学规约】。面料随微小动作产生真实的微观物理褶皱与动态张力。
 
你的任务是：输出中文的一整段视频提示词描述。
请严格按照以下格式生成一整段话，不要换行，不要输出 JSON，不要包含任何 Markdown 标记，并且必须显式引用图的序号：
格式范例：
${is15s ? `15秒快节奏连贯 5 幕叙事，引用 图1 作为服装和模特的严格一致性参考，并以 图2（16:9分镜合集参考图）作为全局构图及姿态参考。第一幕：对应 图2 中的最左侧第一格，摄像机极其缓慢向前推进，模特从画外极其从容慢速迈步走入镜头中央站定，呈现大片气场，背景为 [这里具体详细描绘多层空间构筑、墙面与地面材质细节、独特的丁达尔折射光与高档装饰软装物件]，风吹衣摆产生轻微物理力学运动。镜头切换（Cut to）第二幕：对应 图2 中的第二格特写镜头，微焦段拉近极慢移镜头，聚焦在领口剪裁与微观面料材质，背景展现 [精细的大片光影变化与高级材质纹理]。镜头切换（Cut to）第三幕：对应 图2 中的第三格中景，平滑轨道环绕镜头，模特极缓侧身，服装呈现流线型高端垂坠质感，背景的 [这里详细写入微水泥弧形几何墙体与光线投射交错细节] 随镜头平稳运动。镜头切换（Cut to）第四幕：对应 图2 中的第四格侧面，镜头极其缓慢地推移，模特极其徐缓地微倾肩部，展现服装优雅流畅的物理折叠与自然的微小褶皱。镜头切换（Cut to）第五幕：对应 图2 中的最右侧第五格全景，镜头缓缓拉远，模特高冷微调头姿态并优雅定格，在 [这里详细描述带有纵深空间感的极简侘寂艺术软装与漫反射光影背景] 背景下定格展现完美比例。原生音效：高级环境底噪 + 衣服摩擦与高跟鞋脚步拟音 Foley + 舒缓音乐 BGM。` : `12秒快节奏连贯 3 幕叙事，引用 图1 作为服装和模特的严格一致性参考，并以 图2（16:9分镜合集参考图）作为全局构图及姿态参考。第一幕：对应 图2 中的最左侧第一格，展现全身版型，背景场景为 [这里详细描述带有空间透视和材质的丰富场景背景]。镜头切换（Cut to）第二幕：对应 图2 中的第二格半身中景，聚焦上身设计，背景为 [材质与柔和氛围光影细节]。镜头切换（Cut to）第三幕：对应 图2 中的最右侧第三格细节特写，展示面料纹理。原生音效：高级环境底噪 + 衣服摩擦脚步声 + 舒缓音乐 BGM。`}
 
注意：请将范例中的说明替换为具体的中文描述词，输出的结果必须是连续的一整段文字，段落之间不要换行。不要输出任何其他前缀或后缀。`;
    } else {
      const bgIndex = validBase64Storyboards.length + 2;
      const isKling15s = model === 'kling-v3-omni' && videoDuration === '15s' && storyboardMode !== 'individual';
      promptText = isKling15s ? `你是一个专业的电商时尚视频编导。请根据上传的[模特穿搭主图]（作为输入的第一张图像，即图1）和提供的场景及搭配参数，结合我们生成并作为后续输入（依次为图2、图3、图4、图5、图6）的每一幕分镜参考图，${base64Background ? `以及最后作为图7传入的[背景场景模板图]（即图7，干净的场景空图），` : ''}调用以下视频提示词智能编排规约，生成分镜视频生成提示词。
 
【输入参数】：
- 穿搭图配饰/鞋子搭配建议：${matchingItemDesc} ${shoesDesc} ${accessoriesDesc}
- 目标环境场景空间与材质细节：${sceneDetail}
- 服装品类物理力学规约：${apparelRule}
- 镜头运镜调性指令：${cameraRule}
- 光影影调美学：${lightingRule}
- 重点推广与展示部位：${focus === 'top' ? '重点推广上装 (Topwear)。每一幕分镜描述（尤其是第二幕、第四幕和第五幕）必须主要关注和描绘上衣/外套的设计细节、肩线与胸口裁剪、衣领、袖口和上身材质，把上装作为视觉焦点。' : focus === 'bottom' ? '重点推广下装 (Bottomwear)。每一幕分镜描述（尤其是第二幕、第四幕和第五幕）必须主要关注和描绘下装/裤子/裙子的垂坠物理特性、裤腿/裙摆摆动细节、腰线设计与下身材质，把下装作为视觉焦点。' : '重点推广整体搭配与服饰协调度 (Overall)。保持全身或中景构图，合理兼顾展示整套衣服的搭配协调度。'}
${slowMotionInstruction}
 
【技能规约核心框架】：
模块一：视觉资产解耦与锚定 (Asset Decoupling & Anchoring)
- 主体锚点（引用 图1）：锁定主体细节。整个视频生成过程中，必须严格锁定图1中的人物五官、身材比例、服装款式、色彩及面料细节，确保 100% 一致性。
- 时空锚点（依次对应引用 图2、图3、图4、图5、图6）：用作分镜中五幕视频生成的初始姿态与背景参考。
${base64Background ? `- 场景背景锚点（引用 图7）：整个生成过程中，每一幕视频生成的背景必须以图7（目标场景模板图）为核心基准，结合每幕分镜图的具体构图，详细描绘图7中的背景质感、布局细节、光影分布，锁定生成视频的背景场景。` : ''}
- 场景空间深度与背景细节：绝对不允许描述成单调的‘在影棚’或‘在街头’。在每一幕中详细拓展多层空间透视、微水泥/大理石地面物理材质、独特光线与极简软装陈设，赋予画面纵深空间感与高端画册感。
 
模块二：动态微操注入与高端运镜 (Micro-Dynamics & Premium Camera Motion)
- 摄像机运镜：遵循【镜头运镜调性指令】。包含：极其缓慢推近镜头 (Ultra-slow Dolly In)、缓缓拉远 (Slow Dolly Out)、视差缓慢横移 (Parallax slow panning)、极平滑轨道环绕镜头 (Slow 360-degree camera orbit) 或微小变焦，运镜舒缓、平滑且富有呼吸感。
- 人物动作控制：模特采取「高端时尚大片微动态 (High-fashion micro-movements)」姿态，动作幅度小且极其徐缓优雅，保持大片高冷质感。
- 环境与光影：遵循【光影影调美学】。微风轻拂、侧逆光流转，呈现Vogue大片质感。
- 服装力学：严格遵循【服装品类物理力学规约】。产生符合该服装面料特性的自然悬垂与褶皱。
 
模块三：五幕时间轴激活 (Timeline Activation)
- 配合传入的 图2 ~ 图6 分镜图，推演连贯动作。第一幕：首帧模特处于画面最外侧画外边缘位置，动作必须是从屏幕外空旷侧边从容迈步走入镜头中央并站定，行走路径与背景实体完全分离。其他各幕均设计为极优雅的微动态慢镜头（缓缓转身、视线微倾、肩部微沉）。
 
模块四：原生音画同构 (Audio-Visual Syncing)
- 音频 Tag 组合公式：原生音效：[环境底音] + [动作/材质拟音 Foley] + [情绪 BGM]
 
你的任务是：输出中文的一整段视频提示词描述。
请严格按照以下格式生成一整段话，不要换行，不要输出 JSON，不要包含任何 Markdown 标记，并且必须显式引用图的序号：
15秒快节奏连贯 5 幕叙事，引用 图1 作为服装和模特的严格一致性参考。第一幕：引用 图2，极其缓慢向前推进的特写与中景，首帧模特处于画外最外侧边缘，随后模特顺着侧边空旷的道路极其从容慢速走入镜头中央站定（行走路径与背景实体完全分离），背景场景为 [具有纵深感的背景，包含多层空间、微水泥墙面、反射地面、落地玻璃与精致几何光影]，风吹衣角微动展现超模气场。镜头切换（Cut to）第二幕：引用 图3 做为特写，极慢变焦镜头，镜头聚焦在 [第二幕特写细节如拉链头/配饰/面料卖点]，清晰展现 [面料在逆光下高端微观材质与质感]。镜头切换（Cut to）第三幕：引用 图4 中景，轨道慢移环绕运镜，模特以极其缓慢优美的微侧身动作展示 [第三幕微幅动作]，伴随平稳镜头运转，展现流线型高端垂坠感。镜头切换（Cut to）第四幕：引用 图5 侧面中景，极其平缓推移的镜头，模特极其徐缓地微倾身姿，展示优美层次感与自然面料物理力学微小褶皱。镜头切换（Cut to）第五幕：引用 图6 全景，镜头缓缓拉远，模特眼神微抬高冷定格，在 [带有大片空间感的极简侘寂艺术画廊内景，几何留白与柔焦光斑] 背景下展现整体穿搭的商业时尚大片完美比例，画面在精致光影中定格。原生音效：[音效同构音频 Tag 组合中文描述]
 
注意：
1. 必须包含对“图1”到“图6”的硬编码文字引用。
2. 将中括号里的描述替换为具体的中文场景与材质属性描述词，不要保留中括号。
3. 输出的结果必须是连续的一整段文字，段落之间不要换行，不要输出换行符。不要输出任何其他前缀或后缀。` : `你是一个专业的电商时尚视频编导。请根据上传的[模特穿搭主图]（包含模特穿着特定款式的服装）和提供的场景及搭配参数，结合我们生成并传入给大模型作为输入的每一幕分镜参考图，${base64Background ? `以及最后传入给大模型作为输入的[背景场景模板图]（即图${bgIndex}，干净的场景空图），` : ''}调用以下视频提示词智能编排规约，生成分镜视频生成提示词。
 
【输入参数】：
- 穿搭图配饰/鞋子搭配建议：${matchingItemDesc} ${shoesDesc} ${accessoriesDesc}
- 目标环境场景空间与材质细节：${sceneDetail}
- 服装品类物理力学规约：${apparelRule}
- 镜头运镜调性指令：${cameraRule}
- 光影影调美学：${lightingRule}
- 重点推广与展示部位：${focus === 'top' ? '重点推广上装 (Topwear)。每一幕分镜描述必须主要关注和描绘上衣/外套的设计细节、肩线与胸口裁剪、衣领、袖口和上身材质。' : focus === 'bottom' ? '重点推广下装 (Bottomwear)。每一幕分镜描述必须主要关注和描绘下装/裤子/裙子的垂坠物理特性、裤腿/裙摆摆动细节与腰线设计。' : '重点推广整体搭配与服饰协调度 (Overall)。保持全身或中景构图，合理兼顾展示整套衣服的搭配协调度。'}
${slowMotionInstruction}
 
【技能规约核心框架】：
- 严格图像序号命名规约：生成内容中引用的任何图像，必须且只能命名为「图1」、「图2」、「图3」、「图4」、「图5」、「图6」或「图7」格式。严禁在输出的提示词中出现任何临时变量名。
模块一：视觉资产解耦与锚定：主体锚点（[@模特穿搭主图]）严格锁定五官、身材、款式与面料；时空锚点（[@分镜图_幕1] ~ [@分镜图_幕${validBase64Storyboards.length}]）控制构图、景别与初始姿态。
模块二：服装品类力学与运镜：严格执行【服装品类物理力学规约】与【镜头运镜调性指令】。
模块三：${is15s ? '五幕' : '三幕'}时间轴激活：连贯推演各幕微动态与走位。
模块四：原生音画同构：包含环境底音 + 拟音 Foley + 情绪 BGM。
 
你的任务是：输出中文的一整段视频提示词描述。
请严格按照以下格式生成一整段话，不要换行，不要输出 JSON，不要包含任何 Markdown 标记：
${is15s ? `最终生成的提示词应该类似：
15秒快节奏连贯 5 幕叙事，引用参考图作为服装和模特的严格一致性参考。
场景设定： [详细描绘的高端大片场景背景物理格局与材质，包含多层空间深度的微水泥/反射地面/大理石板材，以及大落地窗斜射光影和侘寂风洞石器皿摆设]
第一幕： 极其缓慢推进的镜头，首帧模特处于画外最外侧边缘，随后从画外地面优雅慢速向镜头中央迈步（确保行走路径与背景实体结构物理分离，不产生空间重叠），背景展现出 [这里详细描写包含多层空间透视与光影的精美背景场景]，自然呼吸且确立大片气场。
镜头切换（Cut to）第二幕： 特写微距极慢移动镜头，聚焦在 [第二幕设计锚点]，背景是 [细节的微水泥墙体与高档光影投影]，清晰展现 [第二幕高端面料质感与光影反射]。
镜头切换（Cut to）第三幕： 中景慢速轨道环绕镜头，模特极其平缓地优雅微侧身，背景的 [这里详细描绘几何弧面、大理石物理地面与斜射丁达尔光线反射] 随镜头平稳运动，完美展示 [第三幕版型与面料流线型垂坠感]。
镜头切换（Cut to）第四幕： 极其平缓推移的镜头，模特极其徐缓地微倾肩部或微微转身，背景是 [此处写入艺术阴影对比与极简高级花瓶、软装摆件]，产生自然面料物理褶皱与大片氛围。
镜头切换（Cut to）第五幕： 全景镜头极慢拉远，模特眼神微抬高冷定格，在 [这里详细描绘带有极致纵深与柔和焦外光斑的极简侘寂艺术画廊空旷内景] 背景下展现整体穿搭的商业时尚大片完美比例，画面在精致光影中定格。
原生音效： [音效同构音频 Tag 组合描述]` : `最终生成的提示词应该类似：
12秒快节奏连贯 3 幕叙事，引用参考图作为服装和模特的严格一致性参考。
场景设定： [详细描绘的高端大片场景背景物理格局与材质]
第一幕： 全景镜头极慢推移，模特在画面中央从容微调姿态，背景为 [包含空间透视、材质与光影的丰富场景背景]，展现全身版型与高端大片光影。
镜头切换（Cut to）第二幕： 半身中景极慢轨道横移，模特侧身极缓摆动，聚焦上衣细节与高端贴合感。
镜头切换（Cut to）第三幕： 细节特写微距极慢推进，对焦服装微观纹理与做工，光感流转细腻。
原生音效： [音效同构音频 Tag 组合描述]`}
 
注意：请将括号里的说明替换为具体的中文描述词，输出的结果必须是连续的一整段文字，段落之间不要换行。不要输出任何其他前缀或后缀。`;
    }

    const messagesContent = [
      { type: 'text', text: promptText },
      { type: 'image_url', image_url: { url: base64Outfit } }
    ];

    validBase64Storyboards.forEach((b64) => {
      messagesContent.push({ type: 'image_url', image_url: { url: b64 } });
    });

    if (base64Background) {
      messagesContent.push({ type: 'image_url', image_url: { url: base64Background } });
    }

    const chatConfig = getChatCompletionConfig();
    const isTextOnly = chatConfig.isTextOnly || chatConfig.defaultModel.toLowerCase().includes('deepseek');

    const requestBody = {
      model: chatConfig.defaultModel,
      messages: isTextOnly
        ? [{ role: 'user', content: promptText }]
        : [{ role: 'user', content: messagesContent }],
      max_tokens: singleShotIndex ? 512 : 1536,
      stream: false
    };

    console.log(`[AI Prompts Skill] Calling chat completions via ${chatConfig.provider} (model: ${chatConfig.defaultModel})${singleShotIndex ? ` [Single Shot ${singleShotIndex} Polish]` : ''}`);

    const response = await fetchWithTimeout(chatConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chatConfig.apiKey}`
      },
      body: JSON.stringify(requestBody)
    }, LONG_EXTERNAL_TIMEOUT_MS);

    if (!response.ok) throw new Error(`AI prompt generator failed (${response.status})`);

    const responseData = await readBodyWithTimeout(response, { timeoutMs: 30_000, format: 'json' });
    const choiceContent = responseData.choices?.[0]?.message?.content;
    if (!choiceContent) throw new Error('No message content returned from AI prompt generator');

    let cleanContent = choiceContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    cleanContent = cleanContent.replace(/@?(?:image|input_file)_(\d+)(?:\.png)?/gi, (_match, p1) => {
      const idx = parseInt(p1, 10);
      return `图${idx + 1}`;
    });

    res.status(200).json({ prompts: cleanContent, singleShotIndex });
  } catch (err) {
    console.error('Skill prompts generation failed:', err);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// 7. Video Generation Task Creator
app.post('/api/video/task', async (req, res) => {
  try {
    const validation = validateVideoTaskInput(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error, code: validation.code });
    }
    const { prompt, imageSrc, seconds: duration, projectId } = validation.value;

    const reservation = enforceGenerationQuota(req, res, 1);
    if (!reservation) return;

    // Use sandbase.ai's Kling 3.0 Omni Pro Video model
    const sandbaseVideoModel = "kwaivgi/kling-video/3.0/omni/pro/image-to-video";
    const sandbasePayload = {
      model: sandbaseVideoModel,
      image: imageSrc,
      prompt: prompt,
      duration: duration
    };

    console.log(`[Sandbase API] Submitting video task (model: ${sandbaseVideoModel}, duration: ${duration}s)`);

    let taskId;
    try {
      taskId = await submitSandbaseTask(sandbasePayload, {
        userId: req.authUser?.id,
        requestKey: req.get('X-Idempotency-Key')
      });
    } finally {
      reservation.release();
    }

    registerTask(taskId, {
      type: 'video',
      model: sandbaseVideoModel,
      duration,
      projectId,
      prompt,
      imageSrc,
      userId: req.authUser?.id,
      status: 'processing'
    });

    res.status(200).json({ id: taskId });
  } catch (err) {
    console.error('Video task creation failed:', err);
    res.status(500).json({ error: err.message || 'Video task creation failed' });
  }
});

// 8. Video Generation Status Poller
app.get('/api/video/poll/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const knownTask = taskStore[taskId];
    if (!knownTask || knownTask.userId !== req.authUser?.id) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const apiKey = process.env.SANDBASE_API_KEY || process.env.AIGATEWAY_TOKEN;

    const response = await fetchWithTimeout(`https://api.sandbase.ai/v1/run/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Polling status failed (${response.status}): ${errorText}`);
    }

    const data = await readBodyWithTimeout(response, { timeoutMs: 30_000, format: 'json' });
    console.log(`[Sandbase API] Polling Video Task ID: ${taskId} | Status: ${data.status}`);

    const resultUrl = data.status === 'completed' ? extractTaskOutputUrl(data) : '';
    updateTaskStatus(taskId, {
      status: data.status,
      error: data.error || null,
      ...(resultUrl ? { resultUrl } : {})
    });

    res.status(200).json({
      status: data.status,
      error: data.error || null,
      ...(resultUrl ? { resultUrl } : {})
    });
  } catch (err) {
    console.error('Video status polling failed:', err);
    res.status(500).json({ error: err.message || 'Polling failed' });
  }
});

// 8.1 Batch Video Generation for 5-Shot Storyboards
app.post('/api/video/task/batch', async (req, res) => {
  try {
    const validation = validateVideoBatchInput(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error, code: validation.code });
    }
    const { projectId } = req.body;
    const { shots, model: sandbaseVideoModel, cost } = validation.value;

    const reservation = enforceGenerationQuota(req, res, cost);
    if (!reservation) return;

    console.log(`\n[Sandbase API] >>> Submitting Batch Video Tasks (${shots.length} shots) for Project: ${projectId || 'default'}`);

    const submitPromises = shots.map(async (shot, idx) => {
      const duration = shot.seconds;
      const sandbasePayload = {
        model: sandbaseVideoModel,
        image: shot.imageSrc,
        prompt: shot.prompt,
        duration
      };

      try {
        console.log(`[Sandbase API] Submitting Shot [${idx + 1}/${shots.length}]: "${shot.name || shot.id}"`);
        const batchRequestKey = req.get('X-Idempotency-Key');
        const taskId = await submitSandbaseTask(sandbasePayload, {
          userId: req.authUser?.id,
          requestKey: batchRequestKey
            ? `${batchRequestKey}:shot:${shot.id || idx + 1}`
            : ''
        });
        const taskMeta = {
          type: 'video',
          model: sandbaseVideoModel,
          duration,
          projectId,
          shotId: shot.id,
          shotIndex: idx + 1,
          shotName: shot.name || `分镜 ${idx + 1}`,
          prompt: shot.prompt,
          imageSrc: shot.imageSrc,
          userId: req.authUser?.id,
          status: 'processing'
        };
        registerTask(taskId, taskMeta);
        return {
          shotId: shot.id,
          shotIndex: idx + 1,
          shotName: shot.name || `分镜 ${idx + 1}`,
          taskId,
          status: 'processing',
          duration
        };
      } catch (subErr) {
        console.error(`[Sandbase API] Failed shot ${shot.id}:`, subErr.message);
        return {
          shotId: shot.id,
          shotIndex: idx + 1,
          shotName: shot.name || `分镜 ${idx + 1}`,
          taskId: null,
          status: 'failed',
          error: subErr.message || 'Submission failed'
        };
      }
    });

    let results;
    try {
      results = await Promise.all(submitPromises);
    } finally {
      reservation.release();
    }
    res.status(200).json({ tasks: results });
  } catch (err) {
    console.error('Batch video task submission failed:', err);
    res.status(500).json({ error: err.message || 'Batch video task submission failed' });
  }
});

// 8.2 Query All Video Tasks for a Specific Project
app.get('/api/video/tasks/project/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const projectTasks = Object.values(taskStore)
      .filter(t => t.type === 'video' && t.projectId === projectId && t.userId === req.authUser?.id)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.status(200).json({ tasks: projectTasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Background Auto-Poller Daemon: Periodically syncs active video tasks even when client is disconnected
let isVideoPollerActive = false;
setInterval(async () => {
  if (isVideoPollerActive) return;
  isVideoPollerActive = true;
  try {
    const apiKey = process.env.SANDBASE_API_KEY;
    if (!apiKey) return;

    const pendingVideoTasks = Object.values(taskStore).filter(
      t => t.type === 'video' && (t.status === 'processing' || t.status === 'pending') && t.taskId
    );

    if (pendingVideoTasks.length === 0) return;

    for (const task of pendingVideoTasks.slice(0, 6)) {
      try {
        const response = await fetchWithTimeout(`https://api.sandbase.ai/v1/run/${task.taskId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        }, 8000);

        if (response.ok) {
          const data = await readBodyWithTimeout(response, { timeoutMs: 30_000, format: 'json' });
          if (data.status && data.status !== task.status) {
            const resultUrl = data.status === 'completed' ? extractTaskOutputUrl(data) : '';
            updateTaskStatus(task.taskId, {
              status: data.status,
              error: data.error || null,
              ...(resultUrl ? { resultUrl } : {})
            });
            console.log(`[AutoPoller] Synced video task ${task.taskId} -> ${data.status}`);
          }
        }
      } catch {}
    }
  } catch {}
  finally {
    isVideoPollerActive = false;
  }
}, 4500);

// 9. Video Content Relayer
app.get('/api/video/content/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const knownTask = taskStore[taskId];
    if (!knownTask || knownTask.userId !== req.authUser?.id) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const apiKey = process.env.SANDBASE_API_KEY || process.env.AIGATEWAY_TOKEN;

    // 1. Get task status to find the output URL
    const statusResponse = await fetchWithTimeout(`https://api.sandbase.ai/v1/run/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`Failed to check video task status (${statusResponse.status}): ${errorText}`);
    }

    const data = await readBodyWithTimeout(statusResponse, { timeoutMs: 30_000, format: 'json' });
    if (data.status !== 'completed') {
      throw new Error(`Video task is not completed yet (current status: ${data.status})`);
    }

    const videoUrl = extractTaskOutputUrl(data);

    if (!videoUrl) {
      throw new Error('No video URL returned in sandbase task outputs');
    }

    updateTaskStatus(taskId, { status: 'completed', resultUrl: videoUrl, error: null });

    // 2. Stream the video binary instead of buffering the entire file in memory.
    const videoResponse = await safeFetchRemote(videoUrl, {}, LONG_EXTERNAL_TIMEOUT_MS);
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video binary from ${videoUrl} (${videoResponse.status})`);
    }
    if (!videoResponse.body) {
      throw new Error('Video provider returned an empty body');
    }

    res.setHeader('Content-Type', videoResponse.headers.get('content-type') || 'video/mp4');
    const contentLength = videoResponse.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.status(200);
    Readable.fromWeb(videoResponse.body)
      .on('error', (streamError) => {
        console.error('Video stream failed:', streamError);
        res.destroy(streamError);
      })
      .pipe(res);
  } catch (err) {
    console.error('Failed to retrieve video content:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch video content' });
  }
});

// ==================== Infinite Canvas REST APIs (Route B) ====================
const CANVAS_STORE_PATH = path.join(DATA_DIR, 'canvas_state.json');
const getCanvasStore = () => {
  try {
    if (fs.existsSync(CANVAS_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(CANVAS_STORE_PATH, 'utf-8'));
    }
  } catch {}
  return {};
};
const saveCanvasStore = (store) => {
  try {
    fs.writeFileSync(CANVAS_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save canvas store:', err);
  }
};

const canvasStoreKey = (req, projectId) => `${req.authUser?.id || 'anonymous'}:${projectId}`;

app.get('/api/canvas/state/:projectId', (req, res) => {
  const { projectId } = req.params;
  const store = getCanvasStore();
  const canvas = store[canvasStoreKey(req, projectId)] || {
    projectId,
    viewport: { x: 80, y: 60, scale: 1 },
    nodes: [],
    connections: [],
    updatedAt: new Date().toISOString()
  };
  res.json(canvas);
});

app.post('/api/canvas/state/:projectId', (req, res) => {
  const { projectId } = req.params;
  const { nodes, connections, viewport } = req.body || {};
  const store = getCanvasStore();
  const key = canvasStoreKey(req, projectId);
  store[key] = {
    projectId,
    nodes: Array.isArray(nodes) ? nodes : (store[key]?.nodes || []),
    connections: Array.isArray(connections) ? connections : (store[key]?.connections || []),
    viewport: viewport || store[key]?.viewport || { x: 80, y: 60, scale: 1 },
    updatedAt: new Date().toISOString()
  };
  saveCanvasStore(store);
  res.json({ success: true, canvas: store[key] });
});

// 2.1 Google image inpainting with an explicit black/white mask.
app.post('/api/ai/inpaint', async (req, res) => {
  try {
    const validation = validateInpaintInput(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error, code: validation.code });
    }
    const { imageUrl, maskUrl, prompt, strength = 0.75, aspectRatio = '1:1' } = validation.value;

    const reservation = enforceGenerationQuota(req, res, 1);
    if (!reservation) return;

    const images = [
      await resolveLocalAssetToBase64(imageUrl),
      await resolveLocalAssetToBase64(maskUrl)
    ];
    const normalizedStrength = Math.max(0.1, Math.min(1, Number(strength) || 0.75));
    const apiAspectRatio = String(aspectRatio || '1:1').replace('-', ':');
    const textPrompt = `Image editing task. 图1 is the original image. 图2 is a strict black-and-white edit mask: white pixels are the only area allowed to change, and black pixels must remain identical to 图1. Modify only the white masked region according to this instruction: ${String(prompt).trim()}. Preserve the person's identity, face, pose, body proportions, clothing outside the mask, lighting, background, framing, and all unmasked pixels. Blend the edited area naturally with realistic texture, edges, shadows, and lighting. Edit strength: ${Math.round(normalizedStrength * 100)}%. Do not add text, logos, watermarks, borders, or captions.`;
    const sandbasePayload = {
      model: 'google/nano-banana-2/edit',
      images,
      prompt: textPrompt,
      resolution: '1K',
      aspect_ratio: apiAspectRatio,
      output_format: 'png',
      enable_web_search: false,
      enable_image_search: false
    };

    let taskId;
    try {
      taskId = await submitSandbaseTask(sandbasePayload, {
        userId: req.authUser?.id,
        requestKey: req.get('X-Idempotency-Key')
      });
    } finally {
      reservation.release();
    }
    registerTask(taskId, { type: 'inpaint', prompt: textPrompt, userId: req.authUser?.id, status: 'processing' });
    const poller = async () => {
      try {
        const resultImageUrl = await pollSandbaseTask(taskId);
        const canvasSafeResult = await fetchImageAsBase64(resultImageUrl);
        updateTaskStatus(taskId, { status: 'completed', resultUrl: canvasSafeResult });
        return canvasSafeResult;
      } catch (pollErr) {
        updateTaskStatus(taskId, { status: 'failed', error: pollErr.message });
        throw pollErr;
      }
    };

    if (req.query.async === 'true' || req.body.async === true) {
      poller().catch(error => console.warn(`[Inpaint Task ${taskId}] Background polling error:`, error.message));
      return res.status(200).json({ taskId, status: 'processing' });
    }
    return res.status(200).json({ taskId, url: await poller() });
  } catch (err) {
    console.error('Google image inpainting failed:', err);
    return res.status(500).json({ error: err.message || 'Google image inpainting failed' });
  }
});

app.post('/api/ai/upscale', async (req, res) => {
  try {
    const validation = validateUpscaleInput(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error, code: validation.code });
    }
    const { imageUrl, scaleFactor = '2x', mode = 'fashion', denoise = 30, sharpen = 50, aspectRatio = '1:1' } = validation.value;

    const reservation = enforceGenerationQuota(req, res, 1);
    if (!reservation) return;

    const sourceImage = await resolveLocalAssetToBase64(imageUrl);
    const resolution = scaleFactor === '4x' ? '4K' : '2K';
    const apiAspectRatio = String(aspectRatio || '1:1').replace('-', ':');
    const modeInstructions = {
      fashion: 'Prioritize authentic garment weave, seams, stitching, fabric grain, folds, drape, and small fashion details.',
      portrait: 'Prioritize natural facial detail, eyes, hair strands, skin texture, and identity preservation without beauty-filter artifacts.',
      general: 'Balance fine detail recovery across the entire image, including subject, clothing, and background.'
    };
    const textPrompt = `Professional AI image upscaling and detail restoration. Reconstruct this exact image at ${resolution} quality. ${modeInstructions[mode] || modeInstructions.general} Preserve the exact person identity, pose, body proportions, composition, colors, clothing design, logos, background, lighting, and crop. Do not redesign, add, remove, or move any object. Denoise level: ${Math.max(0, Math.min(100, Number(denoise) || 0))}%. Detail sharpening: ${Math.max(0, Math.min(100, Number(sharpen) || 0))}%. Produce photorealistic natural micro-detail without halos, oversharpening, text, captions, or watermarks.`;
    const sandbasePayload = {
      model: 'google/nano-banana-2/edit',
      images: [sourceImage],
      prompt: textPrompt,
      resolution,
      aspect_ratio: apiAspectRatio,
      output_format: 'png',
      enable_web_search: false,
      enable_image_search: false
    };

    let taskId;
    try {
      taskId = await submitSandbaseTask(sandbasePayload, {
        userId: req.authUser?.id,
        requestKey: req.get('X-Idempotency-Key')
      });
    } finally {
      reservation.release();
    }
    registerTask(taskId, { type: 'upscale', prompt: textPrompt, userId: req.authUser?.id, status: 'processing' });
    const poller = async () => {
      try {
        const resultImageUrl = await pollSandbaseTask(taskId);
        const canvasSafeResult = await fetchImageAsBase64(resultImageUrl);
        updateTaskStatus(taskId, { status: 'completed', resultUrl: canvasSafeResult });
        return canvasSafeResult;
      } catch (pollErr) {
        updateTaskStatus(taskId, { status: 'failed', error: pollErr.message });
        throw pollErr;
      }
    };

    if (req.query.async === 'true' || req.body.async === true) {
      poller().catch(error => console.warn(`[Upscale Task ${taskId}] Background polling error:`, error.message));
      return res.status(200).json({ taskId, status: 'processing' });
    }
    return res.status(200).json({ taskId, url: await poller() });
  } catch (err) {
    console.error('Google image upscale failed:', err);
    return res.status(500).json({ error: err.message || 'Google image upscale failed' });
  }
});

app.get('/api/ai/image-proxy', createImageProxyHandler({
  maxBytes: MAX_LOCAL_IMAGE_BYTES,
  rateLimitPerMinute: Math.max(10, Number(process.env.IMAGE_PROXY_RATE_LIMIT_PER_MINUTE) || 300)
}));

app.listen(port, host, () => {
  console.log(`KeyVideo backend microservice running on http://${host}:${port}`);
});
