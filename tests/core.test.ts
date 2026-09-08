import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomApiPayload, extractCustomApiResult } from '../src/utils/customApiRunner.ts';
import { calculateExportDimensions, estimateExportFileSizeMb } from '../src/types/exportConfig.ts';

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
