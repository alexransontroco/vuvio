import test from 'node:test';
import assert from 'node:assert/strict';
import type { DeleteReplayDeps } from '../src/streams/deleteReplay.js';
import { deleteReplayForLive } from '../src/streams/deleteReplay.js';

function makeDeps(overrides: {
  liveData?: Record<string, unknown> | null;
  pendingHighlights?: boolean;
  cfDeleteError?: Error;
} = {}): DeleteReplayDeps & { writes: Array<Record<string, unknown>>; deletedUids: string[] } {
  const writes: Array<Record<string, unknown>> = [];
  const deletedUids: string[] = [];
  return {
    writes,
    deletedUids,
    readLive: async () => overrides.liveData ?? null,
    hasPendingHighlights: async () => overrides.pendingHighlights ?? false,
    writeLive: async (_id, patch) => { writes.push(patch); },
    cfDeleteVideo: async (uid: string) => {
      if (overrides.cfDeleteError) throw overrides.cfDeleteError;
      deletedUids.push(uid);
    },
  };
}

// ─── not_found ───────────────────────────────────────────────────────────────

test('returns not_found when live does not exist', async () => {
  const deps = makeDeps({ liveData: null });
  const result = await deleteReplayForLive('live-123', deps);
  assert.equal(result.status, 'not_found');
  assert.equal(deps.writes.length, 0);
});

// ─── nothing_to_delete ───────────────────────────────────────────────────────

test('returns nothing_to_delete when no videoUid and no replayUrl', async () => {
  const deps = makeDeps({ liveData: { creatorUid: 'u1' } });
  const result = await deleteReplayForLive('live-123', deps);
  assert.equal(result.status, 'nothing_to_delete');
  const write = deps.writes.find(w => w.recordingStatus === 'deleted');
  assert.ok(write, 'should write deleted status');
  assert.equal(write.replayDeletionPending, false);
  assert.equal(deps.deletedUids.length, 0, 'no CF call when nothing to delete');
});

// ─── deferred (highlights in progress) ──────────────────────────────────────

test('defers when highlight jobs are in progress', async () => {
  const deps = makeDeps({ liveData: { recordingUid: 'vid-abc', replayUrl: 'https://hls/vid-abc' }, pendingHighlights: true });
  const result = await deleteReplayForLive('live-123', deps);
  assert.equal(result.status, 'deferred');
  const write = deps.writes.find(w => w.recordingStatus === 'revoked');
  assert.ok(write, 'should revoke in Firestore');
  assert.equal(write.replayDeletionPending, true);
  assert.ok('replayUrl' in write, 'replayUrl field must be in patch to delete it');
  assert.equal(deps.deletedUids.length, 0, 'no CF call when deferred');
});

// ─── happy path ──────────────────────────────────────────────────────────────

test('deletes CF video and cleans Firestore on success', async () => {
  const deps = makeDeps({ liveData: { recordingUid: 'vid-xyz', replayUrl: 'https://hls/vid-xyz' } });
  const result = await deleteReplayForLive('live-123', deps);
  assert.equal(result.status, 'deleted');
  assert.equal(deps.writes.length, 2, 'optimistic revoke + final clean');
  const revoke = deps.writes[0];
  assert.equal(revoke.recordingStatus, 'revoked');
  assert.equal(revoke.replayDeletionPending, true);
  const clean = deps.writes[1];
  assert.equal(clean.recordingStatus, 'deleted');
  assert.equal(clean.replayDeletionPending, false);
  assert.deepEqual(deps.deletedUids, ['vid-xyz']);
});

// ─── CF failure — Firestore already revoked ──────────────────────────────────

test('revokes in Firestore even when CF deleteVideo fails', async () => {
  const deps = makeDeps({
    liveData: { recordingUid: 'vid-fail', replayUrl: 'https://hls/vid-fail' },
    cfDeleteError: new Error('CF 503'),
  });
  const result = await deleteReplayForLive('live-123', deps);
  assert.equal(result.status, 'deferred');
  const revoke = deps.writes.find(w => w.recordingStatus === 'revoked');
  assert.ok(revoke, 'Firestore must be revoked even on CF failure');
  assert.equal(revoke.replayDeletionPending, true, 'pending flag set for retry job');
  const clean = deps.writes.find(w => w.recordingStatus === 'deleted');
  assert.equal(clean, undefined, 'must NOT write deleted when CF fails');
});

// ─── idempotent — already deleted ────────────────────────────────────────────

test('handles already-deleted live (no replayUrl, no videoUid) gracefully', async () => {
  const deps = makeDeps({ liveData: { recordingStatus: 'deleted', creatorUid: 'u1' } });
  const result = await deleteReplayForLive('live-123', deps);
  assert.equal(result.status, 'nothing_to_delete');
  assert.equal(deps.deletedUids.length, 0);
});

// ─── cloudflareVideoId fallback ───────────────────────────────────────────────

test('uses cloudflareVideoId when recordingUid is absent', async () => {
  const deps = makeDeps({ liveData: { cloudflareVideoId: 'vid-fallback', replayUrl: 'https://x' } });
  const result = await deleteReplayForLive('live-123', deps);
  assert.equal(result.status, 'deleted');
  assert.deepEqual(deps.deletedUids, ['vid-fallback']);
});
