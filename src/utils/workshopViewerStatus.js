/**
 * Pure state-classification helper for the Workshop Playground.
 *
 * Takes a workshop session (as produced by workshopService.mock.js) and a
 * viewer identity (userId) and returns a tagged union describing the
 * viewer's current relationship to the session.
 *
 * This file intentionally has ZERO React / JSX / DOM imports so it can be
 * unit-tested with `node --test` without a bundler.
 */

/** @typedef {'none'|'absent'|'pending'|'declined'|'left'|'active'} ViewerStatusKind */

/**
 * @param {object|null|undefined} session
 * @param {string|null|undefined} userId
 * @returns {{kind: ViewerStatusKind, participant?: any, request?: any}}
 */
export function classifyViewer(session, userId) {
  if (!userId) return { kind: 'none' };
  const participant = (session?.participants || []).find((p) => p.userId === userId);
  if (participant) return { kind: 'active', participant };
  const requests = (session?.joinRequests || [])
    .filter((r) => r.userId === userId)
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const latest = requests[0] || null;
  if (!latest) return { kind: 'absent' };
  if (latest.status === 'pending') return { kind: 'pending', request: latest };
  if (latest.status === 'declined') return { kind: 'declined', request: latest };
  if (latest.status === 'accepted') return { kind: 'left', request: latest };
  // 'cancelled' and unknown fall back to absent so the user can request again.
  return { kind: 'absent' };
}

export function statusBadge(kind) {
  switch (kind) {
    case 'active': return 'Active';
    case 'pending': return 'Pending';
    case 'declined': return 'Declined';
    case 'left': return 'Left';
    case 'absent': return 'Not joined';
    default: return '';
  }
}
