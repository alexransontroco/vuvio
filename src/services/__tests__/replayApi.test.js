/**
 * Replay API — unit tests (Node native test runner, no browser APIs)
 *
 * Run: node --test src/services/__tests__/replayApi.test.js
 *
 * Tests pure logic only: response shape parsing, error propagation.
 * Does NOT test real Cloudflare or Firebase calls.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ─── Inline helpers (mirrors apiRequest logic, no Firebase import) ────────────

function parseDownloadResponse(body, status) {
  if (!status || status < 200 || status >= 300) throw new Error('API request failed');
  const dl = body?.result?.default ?? body ?? {};
  return {
    success: body?.success ?? true,
    status: typeof dl.status === 'string' ? dl.status : 'inprogress',
    url: dl.status === 'ready' && typeof dl.url === 'string' ? dl.url : '',
    pctComplete: typeof dl.pctComplete === 'number' ? dl.pctComplete : null,
    videoUid: typeof body?.videoUid === 'string' ? body.videoUid : '',
  };
}

function parseDeleteResponse(body, status) {
  if (!status || status < 200 || status >= 300) throw new Error('API request failed');
  const validStatuses = ['deleted', 'deferred', 'not_found', 'nothing_to_delete'];
  return {
    success: body?.success === true,
    status: validStatuses.includes(body?.status) ? body.status : 'not_found',
  };
}

// ─── requestReplayDownload response parsing ───────────────────────────────────

test('download response: ready state returns url', () => {
  const body = { success: true, status: 'ready', url: 'https://cf.example.com/vid.mp4', pctComplete: 100, videoUid: 'uid-1' };
  const r = parseDownloadResponse(body, 200);
  assert.equal(r.status, 'ready');
  assert.equal(r.url, 'https://cf.example.com/vid.mp4');
  assert.equal(r.pctComplete, 100);
});

test('download response: inprogress has no url', () => {
  const body = { success: true, status: 'inprogress', url: '', pctComplete: 42, videoUid: 'uid-1' };
  const r = parseDownloadResponse(body, 200);
  assert.equal(r.status, 'inprogress');
  assert.equal(r.url, '');
  assert.equal(r.pctComplete, 42);
});

test('download response: missing pctComplete returns null', () => {
  const body = { success: true, status: 'inprogress', videoUid: 'uid-1' };
  const r = parseDownloadResponse(body, 200);
  assert.equal(r.pctComplete, null);
});

test('download response: HTTP error throws', () => {
  assert.throws(() => parseDownloadResponse({}, 500), /failed/);
});

// ─── deleteReplay response parsing ───────────────────────────────────────────

test('delete response: deleted status', () => {
  const r = parseDeleteResponse({ success: true, status: 'deleted' }, 200);
  assert.equal(r.status, 'deleted');
  assert.equal(r.success, true);
});

test('delete response: deferred status (highlight pending)', () => {
  const r = parseDeleteResponse({ success: true, status: 'deferred' }, 200);
  assert.equal(r.status, 'deferred');
});

test('delete response: nothing_to_delete is valid', () => {
  const r = parseDeleteResponse({ success: true, status: 'nothing_to_delete' }, 200);
  assert.equal(r.status, 'nothing_to_delete');
});

test('delete response: HTTP 403 throws', () => {
  assert.throws(() => parseDeleteResponse({ code: 'forbidden' }, 403), /failed/);
});

test('delete response: unknown status falls back to not_found', () => {
  const r = parseDeleteResponse({ success: true, status: 'bogus_value' }, 200);
  assert.equal(r.status, 'not_found');
});

// ─── URL construction ────────────────────────────────────────────────────────

test('replay/download route is correct', () => {
  const liveId = 'my-live-id';
  const path = `/streams/${encodeURIComponent(liveId)}/replay/download`;
  assert.equal(path, '/streams/my-live-id/replay/download');
});

test('replay/delete route is correct', () => {
  const liveId = 'live/with/slashes';
  const path = `/streams/${encodeURIComponent(liveId)}/replay/delete`;
  assert.equal(path, '/streams/live%2Fwith%2Fslashes/replay/delete');
});
