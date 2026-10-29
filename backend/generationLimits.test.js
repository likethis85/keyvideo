import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PROMPT_LENGTH,
  MAX_VIDEO_IMAGES,
  validatePrompt,
  validateModel,
  normalizeSeconds,
  isValidImageReference,
  validateVideoTaskInput,
  validateVideoBatchInput,
  validateImageGenerationInput,
  validateMannequinInput,
  validateTryOnInput,
  validateInpaintInput,
  validateUpscaleInput,
  createGenerationQuota
} from './generationLimits.js';

const httpsImage = 'https://cdn.example.com/a.png';
const dataImage = 'data:image/png;base64,AAAA';

test('accepts only http(s) and base64 image references', () => {
  assert.equal(isValidImageReference(httpsImage), true);
  assert.equal(isValidImageReference(dataImage), true);
  assert.equal(isValidImageReference('/clothing_model.png'), true);
  assert.equal(isValidImageReference('/../secret.png'), false);
  assert.equal(isValidImageReference('blob:http://localhost/abc'), false);
  assert.equal(isValidImageReference('javascript:alert(1)'), false);
  assert.equal(isValidImageReference(''), false);
  assert.equal(isValidImageReference(undefined), false);
  assert.equal(isValidImageReference(`data:image/png;base64,${'A'.repeat(20_000_001)}`), false);
});

test('validates prompts and models', () => {
  assert.equal(validatePrompt('  hello  ').value, 'hello');
  assert.equal(validatePrompt('').ok, false);
  assert.equal(validatePrompt('x'.repeat(MAX_PROMPT_LENGTH + 1)).ok, false);
  assert.equal(validatePrompt(undefined, { required: false }).ok, true);
  assert.equal(validateModel('', 'fallback/model').value, 'fallback/model');
  assert.equal(validateModel('bad model!').ok, false);
  assert.equal(validateModel('vendor/model-1.5').ok, true);
});

test('normalizes duration integers and rejects out-of-range values', () => {
  assert.equal(normalizeSeconds('5').value, 5);
  assert.equal(normalizeSeconds(3.4).value, 3);
  assert.equal(normalizeSeconds(undefined, 4).value, 4);
  assert.equal(normalizeSeconds(0).ok, false);
  assert.equal(normalizeSeconds(21).ok, false);
  assert.equal(normalizeSeconds('abc').ok, false);
  assert.equal(normalizeSeconds(NaN).ok, false);
});

test('validates a single video task before any paid submission', () => {
  const valid = validateVideoTaskInput({
    prompt: '  walk forward  ',
    imageSrc: httpsImage,
    seconds: '5',
    projectId: 'project-1',
    storyboardImgUrls: [httpsImage, dataImage]
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.value.seconds, 5);
  assert.equal(valid.value.prompt, 'walk forward');
  assert.equal(valid.value.projectId, 'project-1');

  assert.equal(validateVideoTaskInput({ prompt: '', imageSrc: httpsImage }).ok, false);
  assert.equal(validateVideoTaskInput({ prompt: 'ok', imageSrc: 'blob:x' }).ok, false);
  assert.equal(validateVideoTaskInput({ prompt: 'ok', imageSrc: httpsImage, seconds: 99 }).ok, false);
  assert.equal(
    validateVideoTaskInput({
      prompt: 'ok',
      imageSrc: httpsImage,
      storyboardImgUrls: Array.from({ length: MAX_VIDEO_IMAGES + 1 }, () => httpsImage)
    }).ok,
    false
  );
  assert.equal(validateVideoTaskInput({ prompt: 'ok', imageSrc: httpsImage, size: 'x'.repeat(50) }).ok, false);
});

test('validates every batch shot and reports the paid task cost', () => {
  const batch = validateVideoBatchInput({
    model: 'vendor/video-model',
    seconds: 4,
    shots: [
      { id: 's1', name: 'shot one', prompt: 'walk', imageSrc: httpsImage },
      { id: 's2', prompt: 'turn', imageSrc: dataImage, seconds: 10 }
    ]
  });
  assert.equal(batch.ok, true);
  assert.equal(batch.value.cost, 2);
  assert.equal(batch.value.shots[0].seconds, 4);
  assert.equal(batch.value.shots[1].seconds, 10);

  assert.equal(validateVideoBatchInput({ shots: [] }).ok, false);
  assert.equal(
    validateVideoBatchInput({ shots: Array.from({ length: 11 }, () => ({ prompt: 'x', imageSrc: httpsImage })) }).ok,
    false
  );
  assert.equal(validateVideoBatchInput({ shots: [{ prompt: '', imageSrc: httpsImage }] }).ok, false);
  assert.equal(validateVideoBatchInput({ shots: [{ prompt: 'x', imageSrc: 'blob:x' }] }).ok, false);
  assert.equal(validateVideoBatchInput({ shots: [{ prompt: 'x', imageSrc: httpsImage, seconds: 0 }] }).ok, false);
});

test('validates image generation ratio and reference image', () => {
  assert.equal(validateImageGenerationInput({ prompt: 'studio', ratio: '16-9' }).ok, true);
  assert.equal(validateImageGenerationInput({ prompt: 'studio', ratio: 'wide' }).ok, false);
  assert.equal(validateImageGenerationInput({ prompt: 'studio', ratio: '16-9', refImageUrl: 'blob:x' }).ok, false);
  assert.equal(validateImageGenerationInput({ ratio: '16-9' }).ok, false);
  assert.equal(validateImageGenerationInput({ ratio: '16-9' }, { promptRequired: false }).ok, true);
});

test('validates mannequin input before submission', () => {
  assert.equal(validateMannequinInput({ imageUrl: 'https://cdn/a.png', ratio: '3-4' }).ok, true);
  assert.equal(validateMannequinInput({ imageUrl: '/clothing_model.png', ratio: '3-4' }).ok, true);
  assert.equal(validateMannequinInput({ ratio: '3-4' }).ok, false);
  assert.equal(validateMannequinInput({ imageUrl: 'https://cdn/a.png' }).ok, false);
  assert.equal(validateMannequinInput({ imageUrl: 'https://cdn/a.png', ratio: 'wide' }).ok, false);
  assert.equal(
    validateMannequinInput({ imageUrl: '/../etc/passwd', ratio: '3-4' }).ok,
    false
  );
});

test('validates try-on references and total image budget', () => {
  assert.equal(
    validateTryOnInput({
      clothingUrl: ['https://cdn/a.png', 'https://cdn/b.png'],
      modelUrl: 'https://cdn/m.png',
      ratio: '16-9'
    }).ok,
    true
  );
  assert.equal(validateTryOnInput({ clothingUrl: 'https://cdn/a.png' }).ok, false);
  assert.equal(validateTryOnInput({ clothingUrl: '', ratio: '16-9' }).ok, false);
  assert.equal(validateTryOnInput({ clothingUrl: 'https://cdn/a.png', ratio: '16-9', poseImageUrl: 'blob:x' }).ok, false);
  assert.equal(
    validateTryOnInput({
      clothingUrl: Array.from({ length: MAX_VIDEO_IMAGES }, () => 'https://cdn/a.png'),
      modelUrl: 'https://cdn/m.png',
      ratio: '16-9'
    }).ok,
    false
  );
});

test('validates inpaint and upscale inputs', () => {
  assert.equal(
    validateInpaintInput({ imageUrl: 'https://cdn/a.png', maskUrl: dataImage, prompt: 'fix', strength: 0.5 }).ok,
    true
  );
  assert.equal(validateInpaintInput({ imageUrl: 'https://cdn/a.png', maskUrl: dataImage, prompt: '' }).ok, false);
  assert.equal(
    validateInpaintInput({ imageUrl: 'https://cdn/a.png', maskUrl: dataImage, prompt: 'fix', strength: 2 }).ok,
    false
  );

  assert.equal(validateUpscaleInput({ imageUrl: 'https://cdn/a.png', scaleFactor: '4x', mode: 'portrait' }).ok, true);
  assert.equal(validateUpscaleInput({ imageUrl: 'https://cdn/a.png', scaleFactor: '8x' }).ok, false);
  assert.equal(validateUpscaleInput({ imageUrl: 'https://cdn/a.png', mode: 'unknown' }).ok, false);
  assert.equal(validateUpscaleInput({}).ok, false);
});

test('quota counts paid tasks per user and enforces the daily limit', () => {
  let timestamp = Date.UTC(2026, 9, 29, 12, 0, 0);
  const quota = createGenerationQuota({ dailyLimit: 3, maxConcurrent: 2, now: () => timestamp });

  const first = quota.reserve('user-a', 1);
  assert.equal(first.ok, true);
  assert.equal(first.remaining, 2);
  first.release();

  const batch = quota.reserve('user-a', 2);
  assert.equal(batch.ok, true);
  assert.equal(batch.remaining, 0);
  batch.release();

  const over = quota.reserve('user-a', 1);
  assert.equal(over.ok, false);
  assert.equal(over.status, 429);
  assert.equal(over.code, 'DAILY_QUOTA_EXCEEDED');

  assert.equal(quota.snapshot('user-b').remaining, 3);

  timestamp = Date.UTC(2026, 9, 30, 0, 0, 1);
  const nextDay = quota.reserve('user-a', 1);
  assert.equal(nextDay.ok, true);
  assert.equal(nextDay.remaining, 2);
});

test('quota enforces concurrency and releases idempotently', () => {
  const quota = createGenerationQuota({ dailyLimit: 10, maxConcurrent: 2 });
  const first = quota.reserve('user-a');
  const second = quota.reserve('user-a');
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const third = quota.reserve('user-a');
  assert.equal(third.ok, false);
  assert.equal(third.code, 'CONCURRENCY_LIMIT');

  first.release();
  first.release();
  first.release();
  const retry = quota.reserve('user-a');
  assert.equal(retry.ok, true);
});

test('quota bypasses anonymous callers and bounds its tracking map', () => {
  const quota = createGenerationQuota({ dailyLimit: 1, maxConcurrent: 1, capacity: 2 });
  const anonymous = quota.reserve(undefined);
  assert.equal(anonymous.ok, true);
  anonymous.release();

  assert.equal(quota.reserve('user-a').ok, true);
  assert.equal(quota.reserve('user-b').ok, true);
  assert.equal(quota.size(), 2);
  assert.equal(quota.reserve('user-c').ok, true);
  assert.equal(quota.size() <= 2, true);
});
