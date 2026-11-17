/**
 * ⚠️ MOCK SERVICE — SIMULATION ONLY
 * ---------------------------------
 * In-memory state machine for the Join Activity / Workshop feature.
 *
 * NOT persisted. NOT Firestore. NOT networked.
 * It emulates everything the future backend will do (join requests,
 * participants roster, spotlight consent, feedback queue) so the UI
 * can be exercised end-to-end for all three roles (creator / participant
 * / viewer) on a single device via /workshop-demo.
 *
 * The real implementation (Step 3) must:
 *   - persist state under `activeLives/{id}/{participants,joinRequests,
 *     spotlightRequests,feedbackRequests}`
 *   - validate every status transition server-side (host can accept a join;
 *     only the participant can grant publicSpotlightAuthorized; etc.)
 *   - sign per-participant HLS manifest URLs (private POVs cannot be public)
 *   - invalidate requests on disconnect / session change
 */

const EVENT = 'change';

function createEmitter() {
  const listeners = new Set();
  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit() {
      listeners.forEach((fn) => {
        try { fn(); } catch (err) { console.warn('[workshopService.mock] listener error', err); }
      });
    },
  };
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Per-live session state.
 * We key sessions by liveId so /workshop-demo can simulate multiple roles
 * pointing at the same session, all reactive.
 */
function createEmptySession(liveId, { mode = 'workshop', maxParticipants = 6, audience = 'everyone', activityTitle = '', hostId = 'host', hostName = 'Host' } = {}) {
  return {
    liveId,
    mode,                 // 'off' | 'join' | 'workshop'
    maxParticipants,
    audience,
    activityTitle,
    hostId,
    hostName,
    // Spotlighted participant id — MVP: exactly 0 or 1.
    spotlightParticipantId: null,
    // Pending join requests from viewers.
    // { id, userId, userName, userAvatar?, status: 'pending'|'accepted'|'declined'|'cancelled', createdAt }
    joinRequests: [],
    // Accepted participants.
    // {
    //   id (participantId, usually userId),
    //   userId,
    //   userName,
    //   userAvatar?,
    //   joinedAt,
    //   cameraOn: bool,          // local only — the PARTICIPANT toggles it
    //   micOn: bool,
    //   hostViewAuthorized: bool,// participant allowed host to see their POV privately
    //   publicSpotlightAuthorized: bool, // participant granted public broadcast for CURRENT request
    //   pendingSpotlightRequest: null | { id, origin: 'host'|'participant', status: 'pending'|'accepted'|'declined', createdAt }
    //   pendingFeedback: null | { id, note?: string, createdAt, resolvedAt? }
    //   connectionState: 'connecting'|'connected'|'disconnected'
    // }
    participants: [],
    // Feedback requests queue (shortcut view across participants).
    // { id, participantId, userName, createdAt, resolvedAt? }
    feedbackQueue: [],
    // Event log (useful in demo mode to observe state transitions).
    log: [],
  };
}

const sessions = new Map();
const emitter = createEmitter();

function pushLog(session, kind, payload = {}) {
  session.log.unshift({ id: uid('log'), kind, at: Date.now(), ...payload });
  if (session.log.length > 60) session.log.length = 60;
}

const CONFIG_KEYS = ['mode', 'maxParticipants', 'audience', 'activityTitle', 'hostId', 'hostName'];

function diffConfig(session, config) {
  const changed = {};
  for (const key of CONFIG_KEYS) {
    if (key in config && config[key] !== undefined && config[key] !== session[key]) {
      changed[key] = config[key];
    }
  }
  return changed;
}

function getOrCreateSession(liveId, config = {}) {
  if (!liveId) return { session: null, created: false, changed: {} };
  let session = sessions.get(liveId);
  if (!session) {
    session = createEmptySession(liveId, config);
    sessions.set(liveId, session);
    return { session, created: true, changed: {} };
  }
  const changed = diffConfig(session, config);
  if (Object.keys(changed).length) Object.assign(session, changed);
  return { session, created: false, changed };
}

/** Overwrite a session (used by demo to reset). */
export function resetSession(liveId, config = {}) {
  if (!liveId) return;
  const fresh = createEmptySession(liveId, config);
  sessions.set(liveId, fresh);
  emitter.emit();
}

export function configureSession(liveId, config = {}) {
  const { session, created, changed } = getOrCreateSession(liveId, config);
  if (!session) return;
  // Log only when something actually happens — avoids one entry per
  // hook mount (demo has two parallel useWorkshopSession calls).
  if (created) {
    pushLog(session, 'session.configured', { config: pickConfig(session) });
    emitter.emit();
    return;
  }
  if (Object.keys(changed).length) {
    pushLog(session, 'session.updated', { changed });
    emitter.emit();
  }
}

function pickConfig(session) {
  const out = {};
  for (const key of CONFIG_KEYS) out[key] = session[key];
  return out;
}

/** Read-only snapshot. */
export function getSession(liveId) {
  if (!liveId) return null;
  return sessions.get(liveId) || null;
}

export function subscribe(listener) {
  return emitter.subscribe(listener);
}

/* ─── Join lifecycle ────────────────────────────────────────── */

export function requestJoin(liveId, user) {
  const session = sessions.get(liveId);
  if (!session) throw new Error('No workshop session for this live.');
  if (session.mode === 'off') throw new Error('This live does not allow participation.');
  // Already a participant?
  if (session.participants.some((p) => p.userId === user.userId)) return;
  // Already requested?
  const existing = session.joinRequests.find((r) => r.userId === user.userId && r.status === 'pending');
  if (existing) return existing;
  const req = {
    id: uid('join'),
    userId: user.userId,
    userName: user.userName || 'Viewer',
    userAvatar: user.userAvatar || null,
    status: 'pending',
    createdAt: Date.now(),
  };
  session.joinRequests.unshift(req);
  pushLog(session, 'join.requested', { userId: user.userId });
  emitter.emit();
  return req;
}

export function cancelJoinRequest(liveId, requestId) {
  const session = sessions.get(liveId);
  if (!session) return;
  const req = session.joinRequests.find((r) => r.id === requestId);
  if (!req || req.status !== 'pending') return;
  req.status = 'cancelled';
  pushLog(session, 'join.cancelled', { requestId });
  emitter.emit();
}

export function respondJoinRequest(liveId, requestId, { accept }) {
  const session = sessions.get(liveId);
  if (!session) return;
  const req = session.joinRequests.find((r) => r.id === requestId);
  if (!req || req.status !== 'pending') return;
  if (accept) {
    if (session.participants.length >= session.maxParticipants) {
      req.status = 'declined';
      req.reason = 'full';
      pushLog(session, 'join.declined.full', { requestId });
      emitter.emit();
      return;
    }
    req.status = 'accepted';
    session.participants.push({
      id: req.userId,
      userId: req.userId,
      userName: req.userName,
      userAvatar: req.userAvatar,
      joinedAt: Date.now(),
      cameraOn: false,
      micOn: false,
      hostViewAuthorized: false,
      publicSpotlightAuthorized: false,
      pendingSpotlightRequest: null,
      pendingFeedback: null,
      connectionState: 'connected',
    });
    pushLog(session, 'join.accepted', { userId: req.userId });
  } else {
    req.status = 'declined';
    pushLog(session, 'join.declined', { userId: req.userId });
  }
  emitter.emit();
}

export function leaveWorkshop(liveId, participantId) {
  const session = sessions.get(liveId);
  if (!session) return;
  const idx = session.participants.findIndex((p) => p.id === participantId);
  if (idx === -1) return;
  // Pulling the plug revokes all authorizations + spotlight.
  if (session.spotlightParticipantId === participantId) {
    session.spotlightParticipantId = null;
    pushLog(session, 'spotlight.ended.leave', { participantId });
  }
  const [removed] = session.participants.splice(idx, 1);
  // Clean feedback queue
  session.feedbackQueue = session.feedbackQueue.filter((f) => f.participantId !== participantId);
  pushLog(session, 'participant.left', { participantId, userName: removed.userName });
  emitter.emit();
}

export function removeParticipant(liveId, participantId) {
  // Host-initiated removal, same behaviour but different log kind.
  const session = sessions.get(liveId);
  if (!session) return;
  const target = session.participants.find((p) => p.id === participantId);
  if (!target) return;
  leaveWorkshop(liveId, participantId);
  const s2 = sessions.get(liveId);
  if (s2) pushLog(s2, 'participant.removed', { participantId });
  emitter.emit();
}

/* ─── Local participant controls (camera / mic) ─────────────── */

export function setParticipantMedia(liveId, participantId, { cameraOn, micOn }) {
  const session = sessions.get(liveId);
  if (!session) return;
  const p = session.participants.find((x) => x.id === participantId);
  if (!p) return;
  if (typeof cameraOn === 'boolean') p.cameraOn = cameraOn;
  if (typeof micOn === 'boolean') p.micOn = micOn;
  // If participant disables camera, spotlight must end.
  if (p.cameraOn === false && session.spotlightParticipantId === participantId) {
    session.spotlightParticipantId = null;
    p.publicSpotlightAuthorized = false;
    pushLog(session, 'spotlight.ended.cameraOff', { participantId });
  }
  pushLog(session, 'participant.media', { participantId, cameraOn: p.cameraOn, micOn: p.micOn });
  emitter.emit();
}

/* ─── Private host-view authorization (separate from public) ─ */

export function setHostViewAuthorization(liveId, participantId, allow) {
  const session = sessions.get(liveId);
  if (!session) return;
  const p = session.participants.find((x) => x.id === participantId);
  if (!p) return;
  p.hostViewAuthorized = Boolean(allow);
  pushLog(session, 'hostView.updated', { participantId, allow: p.hostViewAuthorized });
  emitter.emit();
}

/* ─── Need Feedback ─────────────────────────────────────────── */

export function requestFeedback(liveId, participantId, note = '') {
  const session = sessions.get(liveId);
  if (!session) return;
  const p = session.participants.find((x) => x.id === participantId);
  if (!p) return;
  const fb = {
    id: uid('fb'),
    participantId,
    userName: p.userName,
    note,
    createdAt: Date.now(),
    resolvedAt: null,
  };
  p.pendingFeedback = fb;
  session.feedbackQueue.unshift(fb);
  pushLog(session, 'feedback.requested', { participantId });
  emitter.emit();
  return fb;
}

export function resolveFeedback(liveId, feedbackId) {
  const session = sessions.get(liveId);
  if (!session) return;
  const fb = session.feedbackQueue.find((f) => f.id === feedbackId);
  if (!fb || fb.resolvedAt) return;
  fb.resolvedAt = Date.now();
  const p = session.participants.find((x) => x.id === fb.participantId);
  if (p && p.pendingFeedback?.id === feedbackId) p.pendingFeedback = null;
  pushLog(session, 'feedback.resolved', { feedbackId });
  emitter.emit();
}

/* ─── Spotlight (mutual consent) ────────────────────────────── */

/**
 * Host initiates: sends a spotlight request to participant.
 * Participant must explicitly accept → publicSpotlightAuthorized = true.
 */
export function hostRequestSpotlight(liveId, participantId) {
  const session = sessions.get(liveId);
  if (!session) return;
  const p = session.participants.find((x) => x.id === participantId);
  if (!p) return;
  // Only one pending at a time per participant.
  if (p.pendingSpotlightRequest?.status === 'pending') return;
  p.pendingSpotlightRequest = {
    id: uid('sp'),
    origin: 'host',
    status: 'pending',
    createdAt: Date.now(),
  };
  pushLog(session, 'spotlight.host.requested', { participantId });
  emitter.emit();
}

/**
 * Participant initiates: raises hand toward host.
 * The host must accept AND the participant's grant is captured in the same
 * confirmation step on the participant side.
 */
export function participantRequestSpotlight(liveId, participantId) {
  const session = sessions.get(liveId);
  if (!session) return;
  const p = session.participants.find((x) => x.id === participantId);
  if (!p) return;
  if (p.pendingSpotlightRequest?.status === 'pending') return;
  p.pendingSpotlightRequest = {
    id: uid('sp'),
    origin: 'participant',
    status: 'pending',
    createdAt: Date.now(),
  };
  pushLog(session, 'spotlight.participant.requested', { participantId });
  emitter.emit();
}

/**
 * Participant response to a host-initiated spotlight request.
 *  - accept=true → publicSpotlightAuthorized=true (explicit consent for THIS request)
 *  - accept=false → request declined, no change to public auth
 *
 * Even on accept we DO NOT auto-promote to spotlightParticipantId here —
 * the host still clicks "Start spotlight" from their panel. This keeps
 * the mutual-consent rule explicit on both sides.
 */
export function participantRespondSpotlight(liveId, participantId, { accept }) {
  const session = sessions.get(liveId);
  if (!session) return;
  const p = session.participants.find((x) => x.id === participantId);
  if (!p?.pendingSpotlightRequest) return;
  const req = p.pendingSpotlightRequest;
  if (req.status !== 'pending') return;
  if (req.origin !== 'host') return;
  if (accept) {
    req.status = 'accepted';
    p.publicSpotlightAuthorized = true;
    pushLog(session, 'spotlight.consent.granted', { participantId });
  } else {
    req.status = 'declined';
    p.publicSpotlightAuthorized = false;
    pushLog(session, 'spotlight.consent.declined', { participantId });
  }
  emitter.emit();
}

/**
 * Host response to a participant-initiated spotlight request.
 *  - accept=true → publicSpotlightAuthorized=true IF the participant has
 *    already confirmed public broadcast. The participant initiates with
 *    that intent so we capture publicSpotlightAuthorized=true at request
 *    time (participantRequestSpotlight above sets it below).
 *  - accept=false → request declined.
 */
export function hostRespondSpotlight(liveId, participantId, { accept }) {
  const session = sessions.get(liveId);
  if (!session) return;
  const p = session.participants.find((x) => x.id === participantId);
  if (!p?.pendingSpotlightRequest) return;
  const req = p.pendingSpotlightRequest;
  if (req.status !== 'pending') return;
  if (req.origin !== 'participant') return;
  if (accept) {
    req.status = 'accepted';
    // Participant's confirmation is already captured on the participant
    // side when they fire participantRequestSpotlight — see consent step.
    pushLog(session, 'spotlight.host.accepted', { participantId });
  } else {
    req.status = 'declined';
    p.publicSpotlightAuthorized = false;
    pushLog(session, 'spotlight.host.declined', { participantId });
  }
  emitter.emit();
}

/**
 * Participant explicit public-consent toggle (independent from joining).
 * When the participant raises their hand, they go through a consent sheet
 * that calls this with true. They can also revoke via Stop Sharing.
 */
export function setPublicSpotlightConsent(liveId, participantId, allow) {
  const session = sessions.get(liveId);
  if (!session) return;
  const p = session.participants.find((x) => x.id === participantId);
  if (!p) return;
  p.publicSpotlightAuthorized = Boolean(allow);
  if (!p.publicSpotlightAuthorized && session.spotlightParticipantId === participantId) {
    session.spotlightParticipantId = null;
    pushLog(session, 'spotlight.ended.revoked', { participantId });
  }
  pushLog(session, 'spotlight.consent.set', { participantId, allow: p.publicSpotlightAuthorized });
  emitter.emit();
}

/**
 * Host promotes an authorized participant to public spotlight.
 * REQUIRES: participant.publicSpotlightAuthorized === true AND their camera on.
 * Only ONE participant at a time (MVP).
 */
export function startSpotlight(liveId, participantId) {
  const session = sessions.get(liveId);
  if (!session) return;
  const p = session.participants.find((x) => x.id === participantId);
  if (!p) return;
  if (!p.publicSpotlightAuthorized) {
    pushLog(session, 'spotlight.start.blocked.noConsent', { participantId });
    emitter.emit();
    return;
  }
  if (!p.cameraOn) {
    pushLog(session, 'spotlight.start.blocked.cameraOff', { participantId });
    emitter.emit();
    return;
  }
  session.spotlightParticipantId = participantId;
  pushLog(session, 'spotlight.started', { participantId });
  emitter.emit();
}

/** Either party can end spotlight at any time. */
export function endSpotlight(liveId, { by } = {}) {
  const session = sessions.get(liveId);
  if (!session) return;
  if (!session.spotlightParticipantId) return;
  const prev = session.spotlightParticipantId;
  session.spotlightParticipantId = null;
  // Participant ending via "Stop Sharing" also revokes current grant.
  if (by === 'participant') {
    const p = session.participants.find((x) => x.id === prev);
    if (p) p.publicSpotlightAuthorized = false;
  }
  pushLog(session, 'spotlight.ended', { by: by || 'host', participantId: prev });
  emitter.emit();
}

/**
 * Swap main POV ↔ spotlight (UI-level toggle, kept in state so creator
 * HUD and viewer can both reflect it).
 */
export function toggleSpotlightLayout(liveId) {
  const session = sessions.get(liveId);
  if (!session) return;
  session.spotlightSwapped = !session.spotlightSwapped;
  pushLog(session, 'spotlight.layout.swapped', { swapped: !!session.spotlightSwapped });
  emitter.emit();
}
