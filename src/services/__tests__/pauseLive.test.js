/**
 * Pause / Resume Live — unit tests (Node native test runner, no browser APIs)
 *
 * Run: node --test src/services/__tests__/pauseLive.test.js
 *
 * What is tested here (pure JS logic, no Cloudflare / Firebase / WebRTC calls):
 *   - Pause segment model construction and accumulation
 *   - Broadcast stats calculation from segments
 *   - Transition guard logic (isTransitioning / liveStatus)
 *   - pauseWhipTracks / pauseRelayTracks mock-based smoke tests
 *
 * What is NOT tested here (requires real device + live Cloudflare session):
 *   - Actual track.enabled mutation effect on RTP packet flow
 *   - Canvas draw() blackout on real browser + relay server
 *   - Firestore write/read round-trips
 *   - HLS viewer reconnection after resume
 *   - iOS/Android background behaviour
 *   - Multiple concurrent viewers
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ─── Pure helpers (extracted logic, no imports from browser modules) ───────

function computePauseStats({ pauseSegments, totalElapsedMs }) {
  const totalPausedMs = pauseSegments.reduce((acc, seg) => acc + (seg.durationMs ?? 0), 0);
  const broadcastMs = Math.max(0, totalElapsedMs - totalPausedMs);
  return {
    totalPausedMs,
    broadcastMs,
    totalPausedSeconds: Math.round(totalPausedMs / 1000),
    broadcastDurationSeconds: Math.round(broadcastMs / 1000),
    pauseCount: pauseSegments.length,
  };
}

function closePauseSegment(segments, resumedAt) {
  if (segments.length === 0) return segments;
  const last = segments[segments.length - 1];
  if (last.resumedAt !== null) return segments; // already closed
  const durationMs = resumedAt.getTime() - last.startedAt.getTime();
  return [
    ...segments.slice(0, -1),
    { ...last, resumedAt, durationMs },
  ];
}

function canTransition(liveStatus, isTransitioning) {
  if (isTransitioning) return false;
  return liveStatus === 'live' || liveStatus === 'paused';
}

function canPause(liveStatus, isTransitioning) {
  return !isTransitioning && liveStatus === 'live';
}

function canResume(liveStatus, isTransitioning) {
  return !isTransitioning && liveStatus === 'paused';
}

// ─── Mock for WebRTC sender ──────────────────────────────────────────────

function makeTrack(kind = 'video', enabled = true) {
  return { kind, enabled, _enabled: enabled };
}

function makeSender(track) {
  return { track };
}

function makePc(tracks = []) {
  const senders = tracks.map(makeSender);
  return {
    getSenders: () => senders,
    _senders: senders,
  };
}

// Simulated pauseWhipTracks / resumeWhipTracks (mirrors webrtcService.js logic)
function simulatePauseWhipTracks(whipPc) {
  if (!whipPc) return false;
  whipPc.getSenders().forEach((sender) => {
    if (sender.track) sender.track.enabled = false;
  });
  return true;
}

function simulateResumeWhipTracks(whipPc) {
  if (!whipPc) return false;
  whipPc.getSenders().forEach((sender) => {
    if (sender.track) sender.track.enabled = true;
  });
  return true;
}

// Simulated pauseRelayTracks / resumeRelayTracks
function simulatePauseRelayTracks(relayPc, localStream, state) {
  if (!relayPc) return false;
  state.relayPaused = true;
  if (localStream) {
    localStream.getAudioTracks().forEach((t) => { t.enabled = false; });
  }
  return true;
}

function simulateResumeRelayTracks(relayPc, localStream, state) {
  if (!relayPc) return false;
  state.relayPaused = false;
  if (localStream) {
    localStream.getAudioTracks().forEach((t) => { t.enabled = true; });
  }
  return true;
}

// ─── Tests ──────────────────────────────────────────────────────────────

test('computePauseStats — no pauses', () => {
  const result = computePauseStats({ pauseSegments: [], totalElapsedMs: 45_000 });
  assert.equal(result.totalPausedMs, 0);
  assert.equal(result.broadcastMs, 45_000);
  assert.equal(result.pauseCount, 0);
  assert.equal(result.broadcastDurationSeconds, 45);
});

test('computePauseStats — one 5-minute pause in a 15-minute live', () => {
  const segments = [{ startedAt: new Date(), resumedAt: new Date(), durationMs: 5 * 60_000, expectedMinutes: 5 }];
  const result = computePauseStats({ pauseSegments: segments, totalElapsedMs: 15 * 60_000 });
  assert.equal(result.totalPausedSeconds, 300);
  assert.equal(result.broadcastDurationSeconds, 600);
  assert.equal(result.pauseCount, 1);
});

test('computePauseStats — two pauses', () => {
  const segments = [
    { startedAt: new Date(), resumedAt: new Date(), durationMs: 3 * 60_000 },
    { startedAt: new Date(), resumedAt: new Date(), durationMs: 5 * 60_000 },
  ];
  const result = computePauseStats({ pauseSegments: segments, totalElapsedMs: 20 * 60_000 });
  assert.equal(result.totalPausedSeconds, 480);
  assert.equal(result.broadcastDurationSeconds, 720);
  assert.equal(result.pauseCount, 2);
});

test('computePauseStats — pause longer than elapsed (guard against negative broadcast)', () => {
  const segments = [{ durationMs: 60_000 }];
  const result = computePauseStats({ pauseSegments: segments, totalElapsedMs: 30_000 });
  assert.equal(result.broadcastMs, 0);
  assert.equal(result.broadcastDurationSeconds, 0);
});

test('closePauseSegment — closes open segment', () => {
  const start = new Date('2026-01-01T12:00:00Z');
  const resume = new Date('2026-01-01T12:05:00Z');
  const segments = [{ startedAt: start, resumedAt: null, durationMs: null }];
  const closed = closePauseSegment(segments, resume);
  assert.equal(closed[0].resumedAt, resume);
  assert.equal(closed[0].durationMs, 5 * 60_000);
});

test('closePauseSegment — does not modify already-closed segment', () => {
  const start = new Date('2026-01-01T12:00:00Z');
  const originalResume = new Date('2026-01-01T12:05:00Z');
  const segments = [{ startedAt: start, resumedAt: originalResume, durationMs: 5 * 60_000 }];
  const result = closePauseSegment(segments, new Date());
  assert.equal(result[0].resumedAt, originalResume);
});

test('closePauseSegment — empty segments returns empty', () => {
  const result = closePauseSegment([], new Date());
  assert.deepEqual(result, []);
});

test('canPause — allowed when live and not transitioning', () => {
  assert.equal(canPause('live', false), true);
});

test('canPause — blocked when already paused', () => {
  assert.equal(canPause('paused', false), false);
});

test('canPause — blocked when transitioning', () => {
  assert.equal(canPause('live', true), false);
});

test('canResume — allowed when paused and not transitioning', () => {
  assert.equal(canResume('paused', false), true);
});

test('canResume — blocked when live', () => {
  assert.equal(canResume('live', false), false);
});

test('canResume — blocked when transitioning', () => {
  assert.equal(canResume('paused', true), false);
});

test('canTransition — blocked when isTransitioning', () => {
  assert.equal(canTransition('live', true), false);
  assert.equal(canTransition('paused', true), false);
});

test('simulatePauseWhipTracks — disables all sender tracks', () => {
  const videoTrack = makeTrack('video', true);
  const audioTrack = makeTrack('audio', true);
  const pc = makePc([videoTrack, audioTrack]);

  const result = simulatePauseWhipTracks(pc);
  assert.equal(result, true);
  assert.equal(videoTrack.enabled, false);
  assert.equal(audioTrack.enabled, false);
});

test('simulateResumeWhipTracks — re-enables all sender tracks', () => {
  const videoTrack = makeTrack('video', false);
  const audioTrack = makeTrack('audio', false);
  const pc = makePc([videoTrack, audioTrack]);

  const result = simulateResumeWhipTracks(pc);
  assert.equal(result, true);
  assert.equal(videoTrack.enabled, true);
  assert.equal(audioTrack.enabled, true);
});

test('simulatePauseWhipTracks — returns false when no connection', () => {
  assert.equal(simulatePauseWhipTracks(null), false);
});

test('simulateResumeWhipTracks — returns false when no connection', () => {
  assert.equal(simulateResumeWhipTracks(null), false);
});

test('simulatePauseRelayTracks — sets relayPaused and mutes audio', () => {
  const audioTrack = makeTrack('audio', true);
  const localStream = { getAudioTracks: () => [audioTrack] };
  const relayPc = {}; // truthy
  const state = { relayPaused: false };

  const result = simulatePauseRelayTracks(relayPc, localStream, state);
  assert.equal(result, true);
  assert.equal(state.relayPaused, true);
  assert.equal(audioTrack.enabled, false);
});

test('simulateResumeRelayTracks — clears relayPaused and unmutes audio', () => {
  const audioTrack = makeTrack('audio', false);
  const localStream = { getAudioTracks: () => [audioTrack] };
  const relayPc = {};
  const state = { relayPaused: true };

  const result = simulateResumeRelayTracks(relayPc, localStream, state);
  assert.equal(result, true);
  assert.equal(state.relayPaused, false);
  assert.equal(audioTrack.enabled, true);
});

test('simulatePauseRelayTracks — returns false when relay not connected', () => {
  const state = { relayPaused: false };
  assert.equal(simulatePauseRelayTracks(null, null, state), false);
  assert.equal(state.relayPaused, false); // unchanged
});

test('full pause → resume cycle — segment model is consistent', () => {
  const liveStartedAt = new Date('2026-01-01T12:00:00Z');
  let segments = [];
  let totalPausedMs = 0;

  // Pause 1 at t=600s
  const pause1Start = new Date(liveStartedAt.getTime() + 600_000);
  segments = [...segments, { startedAt: pause1Start, resumedAt: null, durationMs: null, expectedMinutes: 5 }];

  // Resume 1 at t=900s (5 minutes later)
  const resume1 = new Date(liveStartedAt.getTime() + 900_000);
  segments = closePauseSegment(segments, resume1);
  totalPausedMs += segments[0].durationMs;

  // Pause 2 at t=1800s
  const pause2Start = new Date(liveStartedAt.getTime() + 1800_000);
  segments = [...segments, { startedAt: pause2Start, resumedAt: null, durationMs: null, expectedMinutes: null }];

  // End live during pause 2 at t=2000s
  const endTime = new Date(liveStartedAt.getTime() + 2000_000);
  segments = closePauseSegment(segments, endTime);
  totalPausedMs += segments[1].durationMs;

  const totalElapsedMs = endTime.getTime() - liveStartedAt.getTime();
  const stats = computePauseStats({ pauseSegments: segments, totalElapsedMs });

  assert.equal(stats.pauseCount, 2);
  assert.equal(stats.totalPausedMs, 300_000 + 200_000); // 5min + 3min20s
  assert.equal(stats.broadcastMs, totalElapsedMs - stats.totalPausedMs);
  assert.equal(stats.broadcastMs, 2_000_000 - 300_000 - 200_000);
  // All segments closed
  assert.ok(segments.every((s) => s.resumedAt !== null));
});
