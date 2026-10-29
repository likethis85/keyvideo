import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomApiPayload, extractCustomApiResult } from '../src/utils/customApiRunner.ts';
import { calculateExportDimensions, estimateExportFileSizeMb } from '../src/types/exportConfig.ts';
import { buildBatchRequestKey } from '../src/utils/batchRequestKey.ts';
import { DEFAULT_PROJECT_ID, createProjectId, migrateLegacyProjectIds } from '../src/utils/aiProjectFactory.ts';
import { findStoryboardForLayer } from '../src/utils/storyboardLayerBinding.ts';
import type { StoryboardItem } from '../src/types/aiProject.ts';

test('custom API JSON templates interpolate without executing code', () => {
  const payload = buildCustomApiPayload(
    '{"prompt":"{{prompt}}","model":"{{model}}","size":"{{size}}","count":1}',
    { prompt: 'silk dress', model: 'image-model', ratio: '9-16' }
  );
  assert.deepEqual(payload, {
    prompt: 'silk dress',
    model: 'image-model',
    size: '1024x1792',
    count: 1
  });
});

test('custom API result extraction follows configured fallbacks', () => {
  assert.equal(
    extractCustomApiResult({ data: [{ url: 'https://example.com/image.png' }] }, 'result.url,data.0.url'),
    'https://example.com/image.png'
  );
  assert.throws(() => extractCustomApiResult({}, 'data.0.url'), /未能按配置/);
});

test('export dimensions preserve ratios and encoder-safe even dimensions', () => {
  assert.deepEqual(calculateExportDimensions('16:9', '1080p'), { width: 1920, height: 1080 });
  assert.deepEqual(calculateExportDimensions('9-16', 'native', 1081, 1919), { width: 1082, height: 1920 });
  assert.equal(estimateExportFileSizeMb(0, 8_500_000), '0.0');
});

test('default project IDs are unique per account while legacy IDs migrate', () => {
  const first = createProjectId();
  const second = createProjectId();
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(first, second);

  let counter = 0;
  const idFactory = () => `generated-${++counter}`;
  const migrated = migrateLegacyProjectIds([
    { id: DEFAULT_PROJECT_ID, name: 'default' },
    { id: 'existing-project', name: 'kept' }
  ], idFactory);

  assert.equal(migrated.changed, true);
  assert.equal(migrated.projects.length, 2);
  assert.equal(migrated.projects[0].id, 'generated-1');
  assert.equal(migrated.projects[1].id, 'existing-project');
  assert.equal(migrated.legacyIdMap.get(DEFAULT_PROJECT_ID), 'generated-1');

  const duplicateLegacy = migrateLegacyProjectIds([
    { id: DEFAULT_PROJECT_ID },
    { id: DEFAULT_PROJECT_ID }
  ], idFactory);
  assert.notEqual(duplicateLegacy.projects[0].id, duplicateLegacy.projects[1].id);

  const untouched = migrateLegacyProjectIds([{ id: 'existing-project' }], idFactory);
  assert.equal(untouched.changed, false);
  assert.equal(untouched.projects[0].id, 'existing-project');
});

test('timeline media layers bind to storyboards by id before index', () => {
  const storyboard = (id: string): StoryboardItem => ({
    id,
    name: id,
    shotType: 'shot-1',
    imageSrc: '',
    videoSrc: null,
    isGeneratingVideo: false,
    progress: 0
  });
  const reordered = [storyboard('sb-b'), storyboard('sb-a')];

  const bound = findStoryboardForLayer(
    { id: 'media_i2v_0_123', properties: { storyboardId: 'sb-b' } },
    reordered
  );
  assert.equal(bound?.id, 'sb-b');

  const legacy = findStoryboardForLayer({ id: 'media_i2v_1_123', properties: {} }, reordered);
  assert.equal(legacy?.id, 'sb-a');

  const missing = findStoryboardForLayer(
    { id: 'media_i2v_0_123', properties: { storyboardId: 'sb-deleted' } },
    reordered
  );
  assert.equal(missing, null);

  assert.equal(findStoryboardForLayer({ id: 'logo_1', properties: {} }, reordered), null);
});

test('batch idempotency keys cover reference images and explicit retries', () => {
  const base = {
    projectId: 'project-1',
    model: 'kling',
    seconds: 3,
    shots: [{ id: 'shot-1', prompt: 'walk', imageSrc: 'data:image/png;base64,AAA', seconds: 3 }]
  };
  const first = buildBatchRequestKey(base);
  assert.equal(buildBatchRequestKey({ ...base }), first);

  const changedImage = buildBatchRequestKey({
    ...base,
    shots: [{ ...base.shots[0], imageSrc: 'data:image/png;base64,BBB' }]
  });
  assert.notEqual(changedImage, first);

  const retried = buildBatchRequestKey({ ...base, retryToken: '2' });
  assert.notEqual(retried, first);
  assert.match(retried, /:retry-2$/);
});
