import test from 'node:test';
import assert from 'node:assert/strict';
import { parseApproximateLocation, parseEnvironment, safeMetadata, stringArray } from '../src/shared/validation.js';
import { assertStatus } from '../src/streams/status.js';

test('approximates precise coordinates', () => {
  const result = parseApproximateLocation({ approximateLocation: { latitude: 48.8566123, longitude: 2.3522456 } });
  assert.deepEqual(result, { latitude: 48.86, longitude: 2.35 });
});

test('rejects invalid environment', () => {
  assert.throws(() => parseEnvironment('space'), /environment is invalid/);
});

test('deduplicates string arrays', () => {
  assert.deepEqual(stringArray({ gearIds: ['a', 'a', 'b'] }, 'gearIds', 20), ['a', 'b']);
});

test('rejects oversized metadata', () => {
  assert.throws(() => safeMetadata({ payload: 'x'.repeat(3000) }), /metadata is too large/);
});

test('stream start compatible statuses', () => {
  assert.equal(assertStatus('preparing', ['preparing', 'connecting'], 'Start'), null);
  assert.match(assertStatus('live', ['preparing', 'connecting'], 'Start') ?? '', /not allowed/);
});
