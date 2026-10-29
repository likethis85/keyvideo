import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomApiPayload, extractCustomApiResult } from '../src/utils/customApiRunner.ts';
import { calculateExportDimensions, estimateExportFileSizeMb } from '../src/types/exportConfig.ts';
import { buildBatchRequestKey } from '../src/utils/batchRequestKey.ts';
import { DEFAULT_PROJECT_ID, createProjectId, migrateLegacyProjectIds } from '../src/utils/aiProjectFactory.ts';
import { findStoryboardForLayer } from '../src/utils/storyboardLayerBinding.ts';
import { mergeBatchVideosIntoTimeline } from '../src/utils/batchTimelineMerge.ts';
import { DEFAULT_VIDEO_MODEL, isSupportedVideoModel, normalizeVideoModel } from '../src/config/videoModels.ts';
import { normalizeCanvasState } from '../src/utils/canvasImport.ts';
import type { Layer } from '../src/components/VideoCanvas.tsx';
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

test('imported canvas payloads are validated before replacing live state', () => {
  assert.equal(normalizeCanvasState(null), null);
  assert.equal(normalizeCanvasState({ nodes: 'nope' }), null);

  const node = { id: 'node-1', type: 'image', position: { x: 0, y: 0 } };
  const state = normalizeCanvasState({
    nodes: [node],
    connections: [{ id: 'c1', from: 'a', to: 'b' }],
    viewport: { x: 10, y: 20, scale: 0.5 }
  });
  assert.equal(state?.nodes.length, 1);
  assert.equal(state?.connections.length, 1);
  assert.deepEqual(state?.viewport, { x: 10, y: 20, scale: 0.5 });

  const noViewport = normalizeCanvasState({ nodes: [node], viewport: { x: 'bad' } });
  assert.equal(noViewport?.viewport, undefined);
  assert.deepEqual(noViewport?.connections, []);
});

test('unsupported video models normalize to the only mapped upstream model', () => {
  assert.equal(DEFAULT_VIDEO_MODEL, 'kling-v3-omni');
  assert.equal(isSupportedVideoModel('kling-v3-omni'), true);
  assert.equal(isSupportedVideoModel('viduq2'), false);
  assert.equal(isSupportedVideoModel('veo-3.1-fast-generate-001'), false);
  assert.equal(normalizeVideoModel('viduq2'), 'kling-v3-omni');
  assert.equal(normalizeVideoModel(null), 'kling-v3-omni');
  assert.equal(normalizeVideoModel('kling-v3-omni'), 'kling-v3-omni');
});

test('batch imports replace only their own storyboard layers', () => {
  const layer = (overrides: Partial<Layer> & { id: string }): Layer => ({
    type: 'media',
    name: overrides.id,
    start: 0,
    end: 3,
    visible: true,
    x: 50,
    y: 50,
    scale: 1,
    opacity: 1,
    properties: {},
    ...overrides
  });

  const existing: Layer[] = [
    layer({ id: 'photo', end: 3, properties: { src: '/photo.png' } }),
    layer({ id: 'other-video', end: 10, properties: { src: '/other.mp4', isVideo: true } }),
    layer({ id: 'old-shot-1', start: 3, end: 6, properties: { src: 'old', storyboardId: 'shot-1', isVideo: true } }),
    layer({ id: 'voice', type: 'audio', end: 15, properties: { src: 'voice.mp3' } })
  ];
  const completed = [
    { shotId: 'shot-2', shotIndex: 2, shotName: 'two', resultUrl: 'two.mp4' },
    { shotId: 'shot-1', shotIndex: 1, shotName: 'one', resultUrl: 'one.mp4' }
  ];

  const merged = mergeBatchVideosIntoTimeline(existing, completed, { timestamp: 42 });
  const ids = merged.map(item => item.id);
  assert.ok(ids.includes('photo'));
  assert.ok(ids.includes('other-video'));
  assert.ok(ids.includes('voice'));
  assert.ok(!ids.includes('old-shot-1'));

  const imported = merged.filter(item => item.id.startsWith('layer_batch_video_42_'));
  assert.equal(imported.length, 2);
  assert.deepEqual(imported.map(item => item.properties.storyboardId), ['shot-1', 'shot-2']);
  assert.deepEqual(imported.map(item => [item.start, item.end]), [[10, 13], [13, 16]]);

  const mergedAgain = mergeBatchVideosIntoTimeline(merged, completed, { timestamp: 43 });
  assert.equal(mergedAgain.filter(item => item.id.startsWith('layer_batch_video_')).length, 2);
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
