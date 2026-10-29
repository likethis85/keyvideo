/**
 * Input limits and paid-generation quotas for AI routes.
 *
 * Validation runs before any upstream submission so malformed or oversized
 * requests can never consume provider credits. Quotas are per authenticated
 * user, reset on UTC day boundaries and keep a hard cap on the tracking map so
 * they cannot grow without bound.
 */

export const MAX_PROMPT_LENGTH = 4_000;
export const MAX_MODEL_LENGTH = 150;
export const MAX_IMAGE_REFERENCE_LENGTH = 20_000_000;
export const MAX_VIDEO_IMAGES = 9;
export const MAX_BATCH_SHOTS = 10;
export const MAX_VIDEO_SECONDS = 20;
export const DEFAULT_DAILY_TASK_LIMIT = 200;
export const DEFAULT_MAX_CONCURRENT_TASKS = 6;
export const DEFAULT_QUOTA_MAP_CAPACITY = 10_000;

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const fail = (error, code = 'INVALID_INPUT') => ({ ok: false, error, code });

/**
 * Accepts only references the backend can hand to the provider: hosted http(s)
 * URLs and inline base64 images. Blob/object URLs are browser-local and would
 * always fail upstream, so they are rejected up front.
 */
export const isValidImageReference = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_IMAGE_REFERENCE_LENGTH) return false;
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
  // Bundled public assets are resolved server-side by normalizeImageUrl.
  if (/^\/[^\s\\]+$/.test(trimmed)) {
    return !trimmed.split('/').includes('..');
  }
  return /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(trimmed);
};

const validateReferenceList = (value, { required = false, label = 'images' } = {}) => {
  const list = Array.isArray(value) ? value : (value === undefined || value === null || value === '' ? [] : [value]);
  if (required && list.length === 0) return fail(`${label} are required`);
  if (list.length > MAX_VIDEO_IMAGES) {
    return fail(`at most ${MAX_VIDEO_IMAGES} ${label} are allowed`);
  }
  for (let index = 0; index < list.length; index += 1) {
    if (!isValidImageReference(list[index])) {
      return fail(`${label}[${index}] must be an http(s) URL, public path or base64 image`);
    }
  }
  return { ok: true, value: list };
};

const validateRatio = (value, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    return required ? fail('ratio is required') : { ok: true, value: undefined };
  }
  if (typeof value !== 'string' || !/^\d{1,2}-\d{1,2}$/.test(value)) {
    return fail('ratio must look like "16-9"');
  }
  return { ok: true, value };
};

export const validatePrompt = (value, { required = true } = {}) => {
  if (value === undefined || value === null) {
    return required ? fail('prompt is required') : { ok: true, value: '' };
  }
  if (typeof value !== 'string') return fail('prompt must be a string');
  const trimmed = value.trim();
  if (required && !trimmed) return fail('prompt is required');
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return fail(`prompt exceeds ${MAX_PROMPT_LENGTH} characters`);
  }
  return { ok: true, value: trimmed };
};

export const validateModel = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: fallback };
  }
  if (typeof value !== 'string') return fail('model must be a string');
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: fallback };
  if (trimmed.length > MAX_MODEL_LENGTH) return fail(`model exceeds ${MAX_MODEL_LENGTH} characters`);
  if (!/^[a-z0-9][a-z0-9._/-]*$/i.test(trimmed)) return fail('model contains unsupported characters');
  return { ok: true, value: trimmed };
};

export const normalizeSeconds = (value, fallback = 4) => {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (numeric === undefined || numeric === null || numeric === '') {
    return { ok: true, value: fallback };
  }
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
    return fail('seconds must be a finite number');
  }
  const rounded = Math.round(numeric);
  if (rounded < 1 || rounded > MAX_VIDEO_SECONDS) {
    return fail(`seconds must be between 1 and ${MAX_VIDEO_SECONDS}`);
  }
  return { ok: true, value: rounded };
};

const validateImageList = (value, { required = false, label = 'images' } = {}) => {
  if (value === undefined || value === null) {
    return required ? fail(`${label} are required`) : { ok: true, value: [] };
  }
  if (!Array.isArray(value)) return fail(`${label} must be an array`);
  if (value.length > MAX_VIDEO_IMAGES) {
    return fail(`at most ${MAX_VIDEO_IMAGES} ${label} are allowed`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!isValidImageReference(value[index])) {
      return fail(`${label}[${index}] must be an http(s) URL or base64 image`);
    }
  }
  if (required && value.length === 0) return fail(`${label} are required`);
  return { ok: true, value };
};

/**
 * Validates a single image-to-video submission. Returns the normalized duration
 * so callers can pass exactly what was validated to the provider.
 */
export const validateVideoTaskInput = (body = {}) => {
  if (!isPlainObject(body)) return fail('request body must be an object');

  const model = validateModel(body.model, 'kwaivgi/kling-video/3.0/omni/pro/image-to-video');
  if (!model.ok) return model;

  const prompt = validatePrompt(body.prompt);
  if (!prompt.ok) return prompt;

  const seconds = normalizeSeconds(body.seconds);
  if (!seconds.ok) return seconds;

  if (!isValidImageReference(body.imageSrc)) {
    return fail('imageSrc must be an http(s) URL or base64 image');
  }

  const extraImages = validateImageList(
    body.storyboardImgUrls ?? body.images,
    { label: 'storyboard images' }
  );
  if (!extraImages.ok) return extraImages;

  if (body.aspectRatio !== undefined && body.aspectRatio !== null) {
    if (typeof body.aspectRatio !== 'string' || body.aspectRatio.length > 20) {
      return fail('aspectRatio is invalid');
    }
  }
  if (body.size !== undefined && body.size !== null) {
    if (typeof body.size !== 'string' || body.size.length > 40) return fail('size is invalid');
  }

  return {
    ok: true,
    value: {
      model: model.value,
      prompt: prompt.value,
      seconds: seconds.value,
      imageSrc: body.imageSrc,
      projectId: typeof body.projectId === 'string' ? body.projectId.slice(0, 100) : undefined
    }
  };
};

/**
 * Validates a batch submission. Every shot must be valid; the returned `cost`
 * is the number of paid tasks the batch will create.
 */
export const validateVideoBatchInput = (body = {}) => {
  if (!isPlainObject(body)) return fail('request body must be an object');
  if (!Array.isArray(body.shots) || body.shots.length === 0) {
    return fail('No shots provided for batch generation');
  }
  if (body.shots.length > MAX_BATCH_SHOTS) {
    return fail(`At most ${MAX_BATCH_SHOTS} shots are allowed per batch`);
  }

  const model = validateModel(body.model, 'kwaivgi/kling-video/3.0/omni/pro/image-to-video');
  if (!model.ok) return model;

  const defaultSeconds = normalizeSeconds(body.seconds, 3);
  if (!defaultSeconds.ok) return defaultSeconds;

  const shots = [];
  for (let index = 0; index < body.shots.length; index += 1) {
    const shot = body.shots[index];
    if (!isPlainObject(shot)) return fail(`shots[${index}] must be an object`);
    const prompt = validatePrompt(shot.prompt);
    if (!prompt.ok) return fail(`shots[${index}]: ${prompt.error}`);
    if (!isValidImageReference(shot.imageSrc)) {
      return fail(`shots[${index}]: imageSrc must be an http(s) URL or base64 image`);
    }
    const seconds = normalizeSeconds(shot.seconds, defaultSeconds.value);
    if (!seconds.ok) return fail(`shots[${index}]: ${seconds.error}`);
    shots.push({
      id: shot.id,
      name: typeof shot.name === 'string' ? shot.name.slice(0, 200) : undefined,
      prompt: prompt.value,
      imageSrc: shot.imageSrc,
      seconds: seconds.value
    });
  }

  return { ok: true, value: { model: model.value, shots, cost: shots.length } };
};

export const validateImageGenerationInput = (body = {}, { promptRequired = true } = {}) => {
  if (!isPlainObject(body)) return fail('request body must be an object');
  const prompt = validatePrompt(body.prompt, { required: promptRequired });
  if (!prompt.ok) return prompt;
  const ratio = validateRatio(body.ratio);
  if (!ratio.ok) return ratio;
  if (body.refImageUrl !== undefined && body.refImageUrl !== null && !isValidImageReference(body.refImageUrl)) {
    return fail('refImageUrl must be an http(s) URL, public path or base64 image');
  }
  return { ok: true, value: { prompt: prompt.value, ratio: ratio.value, refImageUrl: body.refImageUrl } };
};

export const validateMannequinInput = (body = {}) => {
  if (!isPlainObject(body)) return fail('request body must be an object');
  const ratio = validateRatio(body.ratio, { required: true });
  if (!ratio.ok) return ratio;
  const image = validateReferenceList(body.imageUrl, { required: true, label: 'imageUrl' });
  if (!image.ok) return image;
  if (image.value.length > 1) return fail('imageUrl must contain a single image');
  if (body.customPrompt !== undefined && body.customPrompt !== null) {
    const prompt = validatePrompt(body.customPrompt, { required: false });
    if (!prompt.ok) return prompt;
  }
  return {
    ok: true,
    value: {
      imageUrl: image.value[0],
      ratio: ratio.value,
      gender: body.gender,
      region: body.region,
      customPrompt: body.customPrompt
    }
  };
};

export const validateTryOnInput = (body = {}) => {
  if (!isPlainObject(body)) return fail('request body must be an object');
  const ratio = validateRatio(body.ratio, { required: true });
  if (!ratio.ok) return ratio;

  const clothing = validateReferenceList(body.clothingUrl, { required: true, label: 'clothingUrl' });
  if (!clothing.ok) return clothing;
  const model = validateReferenceList(body.modelUrl, { label: 'modelUrl' });
  if (!model.ok) return model;
  const optionalRefs = [];
  for (const field of ['clothingBottomUrl', 'poseImageUrl', 'backgroundImageUrl']) {
    const value = body[field];
    if (value === undefined || value === null || value === '') continue;
    if (!isValidImageReference(value)) {
      return fail(`${field} must be an http(s) URL, public path or base64 image`);
    }
    optionalRefs.push(value);
  }
  const totalImages = clothing.value.length + model.value.length + optionalRefs.length;
  if (totalImages > MAX_VIDEO_IMAGES) {
    return fail(`at most ${MAX_VIDEO_IMAGES} reference images are allowed`);
  }
  if (body.customPrompt !== undefined && body.customPrompt !== null) {
    const prompt = validatePrompt(body.customPrompt, { required: false });
    if (!prompt.ok) return prompt;
  }
  return {
    ok: true,
    value: {
      clothingUrl: body.clothingUrl,
      clothingBottomUrl: body.clothingBottomUrl,
      modelUrl: body.modelUrl,
      gender: body.gender,
      region: body.region,
      scene: body.scene,
      ratio: ratio.value,
      customPrompt: body.customPrompt,
      backgroundImageUrl: body.backgroundImageUrl,
      poseImageUrl: body.poseImageUrl,
      projectId: body.projectId
    }
  };
};

export const validateInpaintInput = (body = {}) => {
  if (!isPlainObject(body)) return fail('request body must be an object');
  const prompt = validatePrompt(body.prompt);
  if (!prompt.ok) return prompt;
  const image = validateReferenceList(body.imageUrl, { required: true, label: 'imageUrl' });
  if (!image.ok) return image;
  const mask = validateReferenceList(body.maskUrl, { required: true, label: 'maskUrl' });
  if (!mask.ok) return mask;
  if (image.value.length > 1 || mask.value.length > 1) {
    return fail('imageUrl and maskUrl must each contain a single image');
  }
  const strength = body.strength === undefined ? 0.75 : Number(body.strength);
  if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
    return fail('strength must be between 0 and 1');
  }
  return {
    ok: true,
    value: {
      imageUrl: image.value[0],
      maskUrl: mask.value[0],
      prompt: prompt.value,
      strength,
      aspectRatio: body.aspectRatio
    }
  };
};

export const validateUpscaleInput = (body = {}) => {
  if (!isPlainObject(body)) return fail('request body must be an object');
  const image = validateReferenceList(body.imageUrl, { required: true, label: 'imageUrl' });
  if (!image.ok) return image;
  if (image.value.length > 1) return fail('imageUrl must contain a single image');
  const scaleFactor = body.scaleFactor ?? '2x';
  if (scaleFactor !== '2x' && scaleFactor !== '4x') {
    return fail('scaleFactor must be "2x" or "4x"');
  }
  const mode = body.mode ?? 'fashion';
  if (!['fashion', 'portrait', 'general'].includes(mode)) {
    return fail('mode is invalid');
  }
  const clampPercent = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    return Math.min(100, Math.max(0, numeric));
  };
  return {
    ok: true,
    value: {
      imageUrl: image.value[0],
      scaleFactor,
      mode,
      denoise: clampPercent(body.denoise),
      sharpen: clampPercent(body.sharpen),
      aspectRatio: body.aspectRatio
    }
  };
};

const utcDay = (timestamp) => new Date(timestamp).toISOString().slice(0, 10);

/**
 * Per-user daily task counter plus in-flight concurrency limiter.
 *
 * `reserve` must be paired with `release` (typically in a finally block). The
 * release callback is idempotent and only decrements the concurrency counter,
 * never the daily usage, so a failed submission still counts toward the day.
 */
export const createGenerationQuota = ({
  dailyLimit = DEFAULT_DAILY_TASK_LIMIT,
  maxConcurrent = DEFAULT_MAX_CONCURRENT_TASKS,
  capacity = DEFAULT_QUOTA_MAP_CAPACITY,
  now = Date.now
} = {}) => {
  const limit = Math.max(1, Number(dailyLimit) || DEFAULT_DAILY_TASK_LIMIT);
  const concurrencyLimit = Math.max(1, Number(maxConcurrent) || DEFAULT_MAX_CONCURRENT_TASKS);
  const maxEntries = Math.max(1, Number(capacity) || DEFAULT_QUOTA_MAP_CAPACITY);
  const usage = new Map();

  const resetIfNeeded = (entry, day) => {
    if (entry.day !== day) {
      entry.day = day;
      entry.count = 0;
    }
    return entry;
  };

  const getEntry = (userId, day) => {
    let entry = usage.get(userId);
    if (!entry) {
      entry = { day, count: 0, active: 0 };
      usage.set(userId, entry);
      if (usage.size > maxEntries) {
        const oldest = usage.keys().next().value;
        if (oldest !== undefined && oldest !== userId) usage.delete(oldest);
      }
    }
    return resetIfNeeded(entry, day);
  };

  const reserve = (userId, cost = 1) => {
    const amount = Math.max(1, Math.round(Number(cost) || 1));
    if (!userId) {
      return { ok: true, release: () => {}, remaining: limit };
    }
    const day = utcDay(now());
    const entry = getEntry(String(userId), day);
    if (entry.active >= concurrencyLimit) {
      return {
        ok: false,
        status: 429,
        code: 'CONCURRENCY_LIMIT',
        error: 'Too many generations are already running. Please wait for one to finish.'
      };
    }
    if (entry.count + amount > limit) {
      return {
        ok: false,
        status: 429,
        code: 'DAILY_QUOTA_EXCEEDED',
        error: `Daily generation quota exceeded (${limit} tasks per day).`
      };
    }
    entry.count += amount;
    entry.active += 1;
    let released = false;
    return {
      ok: true,
      remaining: Math.max(0, limit - entry.count),
      counted: amount,
      release: () => {
        if (released) return;
        released = true;
        entry.active = Math.max(0, entry.active - 1);
      }
    };
  };

  const snapshot = (userId) => {
    const entry = usage.get(String(userId));
    if (!entry) return { count: 0, active: 0, remaining: limit };
    resetIfNeeded(entry, utcDay(now()));
    return { count: entry.count, active: entry.active, remaining: Math.max(0, limit - entry.count) };
  };

  return { reserve, snapshot, dailyLimit: limit, maxConcurrent: concurrencyLimit, size: () => usage.size };
};
