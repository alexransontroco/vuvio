/**
 * Unit tests for the workshop mock service state machine.
 *
 * Run with: node --test src/services/__tests__/workshopService.mock.test.js
 * The service is pure ESM with no DOM/React, so Node's native test runner
 * works without a bundler.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as svc from '../workshopService.mock.js';
import { classifyViewer } from '../../utils/workshopViewerStatus.js';

function freshSession(liveId = `live-${Math.random().toString(36).slice(2, 8)}`) {
  svc.resetSession(liveId, {
    mode: 'workshop',
    maxParticipants: 4,
    audience: 'everyone',
    activityTitle: 'Test activity',
    hostId: 'host',
    hostName: 'Host',
  });
  return liveId;
}

const EMMA = { userId: 'viewer-emma', userName: 'Emma' };
const TOM = { userId: 'viewer-tom', userName: 'Tom' };

/* ─── join lifecycle ────────────────────────────────────────── */

test('requestJoin → queued as pending', () => {
  const id = freshSession();
  const req = svc.requestJoin(id, EMMA);
  const s = svc.getSession(id);
  assert.equal(s.joinRequests.length, 1);
  assert.equal(req.status, 'pending');
  assert.equal(s.participants.length, 0);
  assert.equal(classifyViewer(s, EMMA.userId).kind, 'pending');
});

test('respondJoinRequest accept=true → participant created, log in order', () => {
  const id = freshSession();
  const req = svc.requestJoin(id, EMMA);
  svc.respondJoinRequest(id, req.id, { accept: true });
  const s = svc.getSession(id);
  assert.equal(s.participants.length, 1);
  assert.equal(s.participants[0].userId, EMMA.userId);
  assert.equal(s.joinRequests[0].status, 'accepted');
  const kinds = s.log.map((e) => e.kind);
  assert.ok(kinds.includes('join.requested'));
  assert.ok(kinds.includes('join.accepted'));
  assert.ok(kinds.indexOf('join.accepted') < kinds.indexOf('join.requested'),
    'log is prepended — newer first');
  assert.equal(classifyViewer(s, EMMA.userId).kind, 'active');
});

test('respondJoinRequest accept=false → declined, no participant', () => {
  const id = freshSession();
  const req = svc.requestJoin(id, EMMA);
  svc.respondJoinRequest(id, req.id, { accept: false });
  const s = svc.getSession(id);
  assert.equal(s.participants.length, 0);
  assert.equal(s.joinRequests[0].status, 'declined');
  assert.equal(classifyViewer(s, EMMA.userId).kind, 'declined');
});

test('cancelJoinRequest marks the request as cancelled', () => {
  const id = freshSession();
  const req = svc.requestJoin(id, EMMA);
  svc.cancelJoinRequest(id, req.id);
  const s = svc.getSession(id);
  assert.equal(s.joinRequests[0].status, 'cancelled');
  // Classify: no accepted history, latest is cancelled → absent
  assert.equal(classifyViewer(s, EMMA.userId).kind, 'absent');
});

test('leaveWorkshop splices participant, keeps joinRequest accepted', () => {
  const id = freshSession();
  const req = svc.requestJoin(id, EMMA);
  svc.respondJoinRequest(id, req.id, { accept: true });
  svc.leaveWorkshop(id, EMMA.userId);
  const s = svc.getSession(id);
  assert.equal(s.participants.length, 0);
  assert.equal(s.joinRequests[0].status, 'accepted');
  assert.equal(classifyViewer(s, EMMA.userId).kind, 'left');
});

test('re-request after leaving → new pending request, classify as pending', () => {
  const id = freshSession();
  const req1 = svc.requestJoin(id, EMMA);
  svc.respondJoinRequest(id, req1.id, { accept: true });
  svc.leaveWorkshop(id, EMMA.userId);
  // Advance createdAt so the sort can distinguish them.
  const before = svc.getSession(id).joinRequests.length;
  const req2 = svc.requestJoin(id, EMMA);
  const s = svc.getSession(id);
  assert.equal(s.joinRequests.length, before + 1);
  assert.equal(req2.status, 'pending');
  // classify: latest is pending
  assert.equal(classifyViewer(s, EMMA.userId).kind, 'pending');
});

test('requestJoin when full → declined with reason=full', () => {
  const id = 'live-full';
  svc.resetSession(id, { mode: 'workshop', maxParticipants: 1, activityTitle: 'tight' });
  const r1 = svc.requestJoin(id, EMMA);
  svc.respondJoinRequest(id, r1.id, { accept: true });
  const r2 = svc.requestJoin(id, TOM);
  svc.respondJoinRequest(id, r2.id, { accept: true });
  const s = svc.getSession(id);
  const tomReq = s.joinRequests.find((r) => r.userId === TOM.userId);
  assert.equal(tomReq.status, 'declined');
  assert.equal(tomReq.reason, 'full');
  assert.equal(s.participants.length, 1);
});

test('duplicate requestJoin by same user → returns existing pending without clone', () => {
  const id = freshSession();
  const r1 = svc.requestJoin(id, EMMA);
  const r2 = svc.requestJoin(id, EMMA);
  const s = svc.getSession(id);
  assert.equal(s.joinRequests.length, 1);
  assert.equal(r1.id, r2.id);
});

/* ─── spotlight (mutual consent) ────────────────────────────── */

test('host-initiated spotlight: accept + startSpotlight makes live', () => {
  const id = freshSession();
  const r = svc.requestJoin(id, EMMA);
  svc.respondJoinRequest(id, r.id, { accept: true });
  svc.setParticipantMedia(id, EMMA.userId, { cameraOn: true });
  svc.hostRequestSpotlight(id, EMMA.userId);
  let s = svc.getSession(id);
  assert.equal(s.participants[0].pendingSpotlightRequest?.origin, 'host');
  assert.equal(s.participants[0].pendingSpotlightRequest?.status, 'pending');
  // Blocked until consent given
  svc.startSpotlight(id, EMMA.userId);
  s = svc.getSession(id);
  assert.equal(s.spotlightParticipantId, null, 'cannot spotlight without consent');
  // Participant consents
  svc.participantRespondSpotlight(id, EMMA.userId, { accept: true });
  s = svc.getSession(id);
  assert.equal(s.participants[0].publicSpotlightAuthorized, true);
  svc.startSpotlight(id, EMMA.userId);
  s = svc.getSession(id);
  assert.equal(s.spotlightParticipantId, EMMA.userId);
});

test('host-initiated spotlight: decline → no live, flag false', () => {
  const id = freshSession();
  const r = svc.requestJoin(id, EMMA);
  svc.respondJoinRequest(id, r.id, { accept: true });
  svc.setParticipantMedia(id, EMMA.userId, { cameraOn: true });
  svc.hostRequestSpotlight(id, EMMA.userId);
  svc.participantRespondSpotlight(id, EMMA.userId, { accept: false });
  const s = svc.getSession(id);
  assert.equal(s.participants[0].publicSpotlightAuthorized, false);
  assert.equal(s.participants[0].pendingSpotlightRequest.status, 'declined');
  svc.startSpotlight(id, EMMA.userId);
  const s2 = svc.getSession(id);
  assert.equal(s2.spotlightParticipantId, null);
});

test('participant-initiated spotlight via hook contract (consent captured)', () => {
  const id = freshSession();
  const r = svc.requestJoin(id, EMMA);
  svc.respondJoinRequest(id, r.id, { accept: true });
  svc.setParticipantMedia(id, EMMA.userId, { cameraOn: true });
  // Hook calls these two in sequence to emulate explicit consent + request.
  svc.setPublicSpotlightConsent(id, EMMA.userId, true);
  svc.participantRequestSpotlight(id, EMMA.userId);
  let s = svc.getSession(id);
  assert.equal(s.participants[0].pendingSpotlightRequest?.origin, 'participant');
  assert.equal(s.participants[0].publicSpotlightAuthorized, true);
  // Host accepts → since consent was captured upfront, startSpotlight works
  svc.hostRespondSpotlight(id, EMMA.userId, { accept: true });
  svc.startSpotlight(id, EMMA.userId);
  s = svc.getSession(id);
  assert.equal(s.spotlightParticipantId, EMMA.userId);
});

test('host declines participant-initiated spotlight → consent revoked', () => {
  const id = freshSession();
  const r = svc.requestJoin(id, EMMA);
  svc.respondJoinRequest(id, r.id, { accept: true });
  svc.setParticipantMedia(id, EMMA.userId, { cameraOn: true });
  svc.setPublicSpotlightConsent(id, EMMA.userId, true);
  svc.participantRequestSpotlight(id, EMMA.userId);
  svc.hostRespondSpotlight(id, EMMA.userId, { accept: false });
  const s = svc.getSession(id);
  assert.equal(s.participants[0].pendingSpotlightRequest.status, 'declined');
  assert.equal(s.participants[0].publicSpotlightAuthorized, false);
  assert.equal(s.spotlightParticipantId, null);
});

test('camera off during live spotlight → spotlight ends automatically', () => {
  const id = freshSession();
  const r = svc.requestJoin(id, EMMA);
  svc.respondJoinRequest(id, r.id, { accept: true });
  svc.setParticipantMedia(id, EMMA.userId, { cameraOn: true });
  svc.setPublicSpotlightConsent(id, EMMA.userId, true);
  svc.participantRequestSpotlight(id, EMMA.userId);
  svc.hostRespondSpotlight(id, EMMA.userId, { accept: true });
  svc.startSpotlight(id, EMMA.userId);
  assert.equal(svc.getSession(id).spotlightParticipantId, EMMA.userId);
  // Camera off → auto-end
  svc.setParticipantMedia(id, EMMA.userId, { cameraOn: false });
  const s = svc.getSession(id);
  assert.equal(s.spotlightParticipantId, null);
});

test('revoke public consent during live spotlight → spotlight ends', () => {
  const id = freshSession();
  const r = svc.requestJoin(id, EMMA);
  svc.respondJoinRequest(id, r.id, { accept: true });
  svc.setParticipantMedia(id, EMMA.userId, { cameraOn: true });
  svc.setPublicSpotlightConsent(id, EMMA.userId, true);
  svc.participantRequestSpotlight(id, EMMA.userId);
  svc.hostRespondSpotlight(id, EMMA.userId, { accept: true });
  svc.startSpotlight(id, EMMA.userId);
  svc.setPublicSpotlightConsent(id, EMMA.userId, false);
  const s = svc.getSession(id);
  assert.equal(s.spotlightParticipantId, null);
});

test('leaveWorkshop while live spotlight → spotlight cleared + consent gone', () => {
  const id = freshSession();
  const r = svc.requestJoin(id, EMMA);
  svc.respondJoinRequest(id, r.id, { accept: true });
  svc.setParticipantMedia(id, EMMA.userId, { cameraOn: true });
  svc.setPublicSpotlightConsent(id, EMMA.userId, true);
  svc.participantRequestSpotlight(id, EMMA.userId);
  svc.hostRespondSpotlight(id, EMMA.userId, { accept: true });
  svc.startSpotlight(id, EMMA.userId);
  svc.leaveWorkshop(id, EMMA.userId);
  const s = svc.getSession(id);
  assert.equal(s.spotlightParticipantId, null);
  assert.equal(s.participants.length, 0);
  assert.equal(classifyViewer(s, EMMA.userId).kind, 'left');
});

/* ─── log de-dup: session.configured should fire at most once per creation ─ */

test('configureSession no-ops when called repeatedly with same config', () => {
  const id = 'live-logdup';
  svc.resetSession(id, { mode: 'workshop', maxParticipants: 4, activityTitle: 'cook' });
  const initialCount = svc.getSession(id).log.filter((e) => e.kind === 'session.configured').length;
  // Simulate two parallel hook mounts calling configureSession.
  svc.configureSession(id, { mode: 'workshop', maxParticipants: 4, activityTitle: 'cook' });
  svc.configureSession(id, { mode: 'workshop', maxParticipants: 4, activityTitle: 'cook' });
  const finalCount = svc.getSession(id).log.filter((e) => e.kind === 'session.configured').length;
  assert.equal(finalCount, initialCount, 'no extra session.configured entries from no-op reconfigure');
});

test('configureSession with an actual diff → logs session.updated', () => {
  const id = 'live-upd';
  svc.resetSession(id, { mode: 'workshop', maxParticipants: 4, activityTitle: 'cook' });
  svc.configureSession(id, { activityTitle: 'cook v2' });
  const log = svc.getSession(id).log;
  const updated = log.find((e) => e.kind === 'session.updated');
  assert.ok(updated, 'session.updated should be logged on actual diff');
  assert.deepEqual(updated.changed, { activityTitle: 'cook v2' });
});

/* ─── classifyViewer edge cases ─────────────────────────────── */

test('classifyViewer: null session / null userId → none/absent', () => {
  assert.equal(classifyViewer(null, null).kind, 'none');
  assert.equal(classifyViewer(null, 'x').kind, 'absent');
  assert.equal(classifyViewer({}, null).kind, 'none');
});

test('classifyViewer: ordering by createdAt — latest wins', () => {
  const session = {
    participants: [],
    joinRequests: [
      { id: 'a', userId: 'u', status: 'declined', createdAt: 10 },
      { id: 'b', userId: 'u', status: 'pending', createdAt: 50 },
      { id: 'c', userId: 'u', status: 'cancelled', createdAt: 30 },
    ],
  };
  const res = classifyViewer(session, 'u');
  assert.equal(res.kind, 'pending');
  assert.equal(res.request.id, 'b');
});
