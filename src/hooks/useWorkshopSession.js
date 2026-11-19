import { useCallback, useEffect, useMemo, useState } from 'react';
import * as svc from '../services/workshopService.mock.js';

/**
 * React façade over the (mock) workshop service.
 *
 * Usage:
 *   const session = useWorkshopSession({ liveId, viewer: { userId, userName } });
 *
 * The hook subscribes to the mock store and re-renders on every change.
 * All mutations go through `session.actions.*` which proxy the service.
 */
export function useWorkshopSession({ liveId, viewer, hostConfig } = {}) {
  const [tick, setTick] = useState(0);

  // Auto-configure the session on first mount if hostConfig is supplied.
  useEffect(() => {
    if (!liveId) return;
    if (hostConfig) svc.configureSession(liveId, hostConfig);
    else svc.configureSession(liveId, {}); // ensure session exists
  }, [liveId, hostConfig?.mode, hostConfig?.maxParticipants, hostConfig?.audience, hostConfig?.activityTitle, hostConfig?.hostId, hostConfig?.hostName]);

  useEffect(() => {
    if (!liveId) return undefined;
    return svc.subscribe(() => setTick((v) => v + 1));
  }, [liveId]);

  const session = useMemo(() => svc.getSession(liveId), [liveId, tick]);

  const viewerId = viewer?.userId || null;

  const myParticipant = useMemo(() => {
    if (!session || !viewerId) return null;
    return session.participants.find((p) => p.userId === viewerId) || null;
  }, [session, viewerId]);

  const myJoinRequest = useMemo(() => {
    if (!session || !viewerId) return null;
    const pending = session.joinRequests.find((r) => r.userId === viewerId && r.status === 'pending');
    if (pending) return pending;
    const latest = [...session.joinRequests].reverse().find((r) => r.userId === viewerId);
    return latest || null;
  }, [session, viewerId]);

  const spotlightParticipant = useMemo(() => {
    if (!session?.spotlightParticipantId) return null;
    return session.participants.find((p) => p.id === session.spotlightParticipantId) || null;
  }, [session]);

  const pendingJoinRequests = useMemo(() => (
    session ? session.joinRequests.filter((r) => r.status === 'pending') : []
  ), [session]);

  const pendingFeedback = useMemo(() => (
    session ? session.feedbackQueue.filter((f) => !f.resolvedAt) : []
  ), [session]);

  const requestJoin = useCallback((userOverride) => (
    svc.requestJoin(liveId, userOverride || viewer)
  ), [liveId, viewer]);

  const cancelJoinRequest = useCallback((requestId) => (
    svc.cancelJoinRequest(liveId, requestId)
  ), [liveId]);

  const respondJoinRequest = useCallback((requestId, opts) => (
    svc.respondJoinRequest(liveId, requestId, opts)
  ), [liveId]);

  const leaveWorkshop = useCallback((participantId) => (
    svc.leaveWorkshop(liveId, participantId || myParticipant?.id)
  ), [liveId, myParticipant?.id]);

  const removeParticipant = useCallback((participantId) => (
    svc.removeParticipant(liveId, participantId)
  ), [liveId]);

  const setMedia = useCallback((patch, participantId) => (
    svc.setParticipantMedia(liveId, participantId || myParticipant?.id, patch)
  ), [liveId, myParticipant?.id]);

  const setHostViewAuthorization = useCallback((participantId, allow) => (
    svc.setHostViewAuthorization(liveId, participantId, allow)
  ), [liveId]);

  const requestFeedback = useCallback((note = '', participantId) => (
    svc.requestFeedback(liveId, participantId || myParticipant?.id, note)
  ), [liveId, myParticipant?.id]);

  const resolveFeedback = useCallback((feedbackId) => (
    svc.resolveFeedback(liveId, feedbackId)
  ), [liveId]);

  const hostRequestSpotlight = useCallback((participantId) => (
    svc.hostRequestSpotlight(liveId, participantId)
  ), [liveId]);

  const participantRequestSpotlight = useCallback((participantId) => {
    // Participant-initiated: participant also captures explicit public consent.
    svc.setPublicSpotlightConsent(liveId, participantId || myParticipant?.id, true);
    svc.participantRequestSpotlight(liveId, participantId || myParticipant?.id);
  }, [liveId, myParticipant?.id]);

  const participantRespondSpotlight = useCallback((opts, participantId) => (
    svc.participantRespondSpotlight(liveId, participantId || myParticipant?.id, opts)
  ), [liveId, myParticipant?.id]);

  const hostRespondSpotlight = useCallback((participantId, opts) => (
    svc.hostRespondSpotlight(liveId, participantId, opts)
  ), [liveId]);

  const setPublicSpotlightConsent = useCallback((participantId, allow) => (
    svc.setPublicSpotlightConsent(liveId, participantId, allow)
  ), [liveId]);

  const startSpotlight = useCallback((participantId) => (
    svc.startSpotlight(liveId, participantId)
  ), [liveId]);

  const endSpotlight = useCallback((opts) => (
    svc.endSpotlight(liveId, opts)
  ), [liveId]);

  const toggleSpotlightLayout = useCallback(() => (
    svc.toggleSpotlightLayout(liveId)
  ), [liveId]);

  return {
    session,
    myParticipant,
    myJoinRequest,
    spotlightParticipant,
    pendingJoinRequests,
    pendingFeedback,
    actions: {
      requestJoin,
      cancelJoinRequest,
      respondJoinRequest,
      leaveWorkshop,
      removeParticipant,
      setMedia,
      setHostViewAuthorization,
      requestFeedback,
      resolveFeedback,
      hostRequestSpotlight,
      participantRequestSpotlight,
      participantRespondSpotlight,
      hostRespondSpotlight,
      setPublicSpotlightConsent,
      startSpotlight,
      endSpotlight,
      toggleSpotlightLayout,
    },
  };
}
