import { collection, doc, setDoc, getDoc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

let localStream = null;
let peerConnection = null;
let iceGatheringComplete = false;
let cachedRtcConfig = null;
let cachedRtcConfigExpiresAt = 0;

// WHIP ingest state
let whipPeerConnection = null;
let whipResourceUrl = null; // Location header from WHIP response
let relayPeerConnection = null;
let relaySessionId = null;
let relayBaseUrl = null;

// WHEP playback state

function splitEnvList(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function fallbackTurnServer() {
  const configuredTurnUrls = splitEnvList(import.meta.env.VITE_TURN_URLS);
  const configuredTurnUsername = import.meta.env.VITE_TURN_USERNAME;
  const configuredTurnCredential = import.meta.env.VITE_TURN_CREDENTIAL;
  if (configuredTurnUrls.length && configuredTurnUsername && configuredTurnCredential) {
    return {
      urls: configuredTurnUrls,
      username: configuredTurnUsername,
      credential: configuredTurnCredential,
    };
  }

  return {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  };
}

function buildRtcConfig(turnServer = fallbackTurnServer()) {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    turnServer,
  ];
}

function normalizeTurnPayload(payload) {
  if (Array.isArray(payload?.iceServers)) {
    return {
      iceServers: payload.iceServers,
      ttlSeconds: Number(payload.ttlSeconds ?? payload.ttl ?? 300) || 300,
    };
  }

  const urls = Array.isArray(payload?.urls) ? payload.urls : splitEnvList(payload?.urls);
  if (!urls.length || !payload?.username || !payload?.credential) return null;

  return {
    iceServers: buildRtcConfig({
      urls,
      username: payload.username,
      credential: payload.credential,
    }),
    ttlSeconds: Number(payload.ttlSeconds ?? payload.ttl ?? 300) || 300,
  };
}

async function fetchTurnConfig() {
  const endpoint = import.meta.env.VITE_TURN_CREDENTIALS_URL;
  if (!endpoint) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1200);

  try {
    const token = await auth.currentUser?.getIdToken?.();
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return normalizeTurnPayload(await response.json());
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('[webrtcService] TURN credential endpoint unavailable:', err.message);
    }
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function getRtcConfig() {
  if (cachedRtcConfig && Date.now() < cachedRtcConfigExpiresAt) {
    return cachedRtcConfig;
  }

  const remoteConfig = await fetchTurnConfig();
  if (remoteConfig?.iceServers?.length) {
    cachedRtcConfig = { iceServers: remoteConfig.iceServers };
    cachedRtcConfigExpiresAt = Date.now() + Math.max(60, remoteConfig.ttlSeconds - 20) * 1000;
    return cachedRtcConfig;
  }

  cachedRtcConfig = { iceServers: buildRtcConfig() };
  cachedRtcConfigExpiresAt = Date.now() + 60 * 1000;
  return cachedRtcConfig;
}

// ─── WHIP Ingest (broadcaster → Cloudflare) ────────────────────────────────

async function startWhipIngest(whipUrl, streamKey, stream) {
  try {
    console.log('[CLOUDFLARE] broadcast started — connecting via WHIP');
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
      bundlePolicy: 'max-bundle',
    });
    whipPeerConnection = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') { resolve(); return; }
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') resolve();
      };
      setTimeout(resolve, 5000);
    });

    if (pc.connectionState === 'closed' || pc.signalingState === 'closed' || !pc.localDescription) {
      throw new Error('whipPeerConnection closed during ICE gathering');
    }

    const response = await fetch(whipUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        ...(streamKey ? { 'Authorization': `Bearer ${streamKey}` } : {}),
      },
      body: pc.localDescription.sdp,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WHIP ${response.status}: ${text.slice(0, 200)}`);
    }

    // Store resource URL for proper teardown (WHIP RFC 9725)
    whipResourceUrl = response.headers.get('Location') || null;

    const answerSdp = await response.text();
    if (!whipPeerConnection) return;
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    console.log('[CLOUDFLARE] WHIP connected — SDP exchange complete, resource URL:', whipResourceUrl ?? 'not provided by server');

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[CLOUDFLARE] WHIP connection state:', state);
      if (state === 'failed' || state === 'disconnected') {
        console.warn('[CLOUDFLARE] WHIP connection lost');
      }
    };
    pc.oniceconnectionstatechange = () => {
      console.log('[CLOUDFLARE] WHIP ICE state:', pc.iceConnectionState);
    };
  } catch (err) {
    console.error('[CLOUDFLARE] WHIP ingest failed:', err.message);
    whipPeerConnection?.close();
    whipPeerConnection = null;
    whipResourceUrl = null;
  }
}

function closeWhipConnectionSync() {
  if (whipPeerConnection) {
    whipPeerConnection.onconnectionstatechange = null;
    whipPeerConnection.oniceconnectionstatechange = null;
    whipPeerConnection.close();
    whipPeerConnection = null;
    console.log('[CLOUDFLARE] WHIP closed');
  }
  // Send DELETE to Cloudflare to formally end the WHIP session
  // Closing the RTCPeerConnection also signals Cloudflare, which triggers live_input.ended webhook
  if (whipResourceUrl) {
    const url = whipResourceUrl;
    whipResourceUrl = null;
    fetch(url, { method: 'DELETE' }).catch(() => {});
  }
}

async function startRtmpRelayIngest(relayUrl, liveInputId, stream) {
  if (!relayUrl) throw new Error('Missing RTMPS relay URL');

  relayBaseUrl = relayUrl.replace(/\/$/, '');
  console.log('[RTMPS-RELAY] starting relay session for live:', liveInputId);

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
    bundlePolicy: 'max-bundle',
  });
  relayPeerConnection = pc;

  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') resolve();
    };
    setTimeout(resolve, 5000);
  });

  if (!pc.localDescription) {
    throw new Error('[RTMPS-RELAY] Failed to create offer: localDescription is null');
  }

  const response = await fetch(`${relayBaseUrl}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      liveInputId,
      sdpOffer: pc.localDescription.sdp,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[RTMPS-RELAY] session create failed: ${response.status} ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  relaySessionId = data.sessionId || null;
  console.log('[RTMPS-RELAY] WebRTC publisher connected');
  await pc.setRemoteDescription({ type: 'answer', sdp: data.sdpAnswer });
  console.log('[RTMPS-RELAY] Cloudflare RTMPS connected');

  pc.onconnectionstatechange = () => {
    console.log('[RTMPS-RELAY] WebRTC connection state:', pc.connectionState);
  };
  pc.oniceconnectionstatechange = () => {
    console.log('[RTMPS-RELAY] WebRTC ICE state:', pc.iceConnectionState);
  };

  return relaySessionId;
}

async function stopRtmpRelayConnection() {
  try {
    if (relayPeerConnection) {
      relayPeerConnection.onconnectionstatechange = null;
      relayPeerConnection.oniceconnectionstatechange = null;
      relayPeerConnection.close();
      relayPeerConnection = null;
    }
  } finally {
    if (relayBaseUrl && relaySessionId) {
      const sessionId = relaySessionId;
      relaySessionId = null;
      fetch(`${relayBaseUrl}/sessions/${sessionId}`, { method: 'DELETE' }).catch(() => {});
    }
    relayBaseUrl = null;
  }
}

// ─── Broadcast lifecycle ────────────────────────────────────────────────────

export async function startBroadcast(liveId, userId, existingStream = null, whipUrl = null, streamKey = null) {
  try {
    console.log('[webrtcService] Starting broadcast for live:', liveId);
    const signalSessionId = `signal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (existingStream?.getTracks?.().length) {
      localStream = existingStream;
      console.log('[webrtcService] Using existing camera stream — no new getUserMedia()');
    } else {
      console.warn('[DEBUG-PREVIEW] getUserMedia() called from startBroadcast — no existingStream was provided', new Error().stack);
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      console.log('[webrtcService] Camera stream acquired', localStream.id);
    }

    localStream.getTracks().forEach((track) => {
      console.log('[DEBUG-PREVIEW] broadcast track ready:', track.kind, track.id, 'readyState:', track.readyState);
      track.onmute = () => console.warn('[DEBUG-PREVIEW] broadcast track muted:', track.kind);
      track.onunmute = () => console.log('[DEBUG-PREVIEW] broadcast track unmuted:', track.kind);
      track.onended = () => console.warn('[DEBUG-PREVIEW] broadcast track ended:', track.kind);
    });

    // Primary path: WHIP to Cloudflare (WHEP viewers connect on the other end)
    if (whipUrl && streamKey) {
      await startWhipIngest(whipUrl, streamKey, localStream);
    } else {
      console.warn('[CLOUDFLARE] No WHIP credentials — Cloudflare broadcast will NOT work');
    }

    // Also set up P2P fallback for viewers without WHEP
    peerConnection = new RTCPeerConnection(await getRtcConfig());

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    const candidates = [];
    let offerSaved = false;
    const publishBroadcasterCandidates = () => {
      if (!offerSaved) return;
      updateDoc(doc(db, 'activeLives', liveId), {
        iceCandidates: candidates,
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        console.warn('[webrtcService] Failed to publish broadcaster ICE:', err.message);
      });
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await new Promise(resolve => {
      const checkComplete = () => {
        if (peerConnection.iceGatheringState === 'complete') {
          iceGatheringComplete = true;
          resolve();
        }
      };
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          candidates.push(event.candidate.toJSON());
          publishBroadcasterCandidates();
        } else {
          iceGatheringComplete = true;
          publishBroadcasterCandidates();
          resolve();
        }
      };
      checkComplete();
      setTimeout(() => resolve(), 5000);
    });

    if (!peerConnection?.localDescription) {
      throw new Error('[webrtcService] Failed to create offer: localDescription is null');
    }
    await setDoc(doc(db, 'activeLives', liveId), {
      creatorUid: userId,
      status: 'live',
      signalSessionId,
      sdpOffer: peerConnection.localDescription.sdp,
      iceCandidates: candidates,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    offerSaved = true;
    publishBroadcasterCandidates();
    console.log('[webrtcService] P2P offer saved — fallback ready for', candidates.length, 'ICE candidates');

    let answerProcessed = false;
    const addedWatcherCandidates = new Set();
    const unsubscribeWatchers = onSnapshot(collection(db, 'activeLives', liveId, 'watchers'), async (snapshot) => {
      if (!peerConnection) return;
      const answerDoc = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.sdpAnswer && item.signalSessionId === signalSessionId)
        .sort((a, b) => {
          const aMs = a.updatedAt?.toMillis?.() ?? 0;
          const bMs = b.updatedAt?.toMillis?.() ?? 0;
          return bMs - aMs;
        })[0];
      const data = answerDoc;
      if (!data?.sdpAnswer) return;

      if (!answerProcessed && peerConnection.signalingState === 'have-local-offer') {
        answerProcessed = true;
        console.log('[webrtcService] Received P2P answer from watcher:', answerDoc.id);
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdpAnswer }));
        } catch (err) {
          console.error('[webrtcService] Failed to set remote description:', err.message);
        }
      }

      if (peerConnection.remoteDescription && data.watcherIceCandidates?.length) {
        for (const candidate of data.watcherIceCandidates) {
          const key = candidate.candidate ?? JSON.stringify(candidate);
          if (addedWatcherCandidates.has(key)) continue;
          addedWatcherCandidates.add(key);
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn('[webrtcService] Failed to add watcher ICE candidate:', err.message);
          }
        }
      }
    }, (err) => {
      console.error('[webrtcService] Watcher answer listener failed:', err.message);
    });
    if (peerConnection) {
      peerConnection._vuvioUnsubscribe = unsubscribeWatchers;
    }

    return localStream;
  } catch (err) {
    console.error('[webrtcService] Failed to start broadcast:', err.message);
    throw err;
  }
}

export async function startRtmpRelayBroadcast(liveId, userId, existingStream = null, relayUrl = null) {
  try {
    console.log('[webrtcService] Starting RTMPS relay broadcast for live:', liveId);

    if (existingStream?.getTracks?.().length) {
      localStream = existingStream;
      console.log('[webrtcService] Using existing camera stream — no new getUserMedia()');
    } else {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      console.log('[webrtcService] Camera stream acquired', localStream.id);
    }

    localStream.getTracks().forEach((track) => {
      console.log('[DEBUG-PREVIEW] relay track ready:', track.kind, track.id, 'readyState:', track.readyState);
      track.onmute = () => console.warn('[DEBUG-PREVIEW] relay track muted:', track.kind);
      track.onunmute = () => console.log('[DEBUG-PREVIEW] relay track unmuted:', track.kind);
      track.onended = () => console.warn('[DEBUG-PREVIEW] relay track ended:', track.kind);
    });

    await startRtmpRelayIngest(relayUrl, liveId, localStream);
    return localStream;
  } catch (err) {
    console.error('[webrtcService] Failed to start RTMPS relay broadcast:', err.message);
    throw err;
  }
}

export async function stopBroadcast(liveId) {
  try {
    console.log('[CLOUDFLARE] broadcast ending');

    // Stop all local media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }

    // Close WHIP — this stops Cloudflare ingest and triggers live_input.ended webhook
    closeWhipConnectionSync();

    // Close P2P fallback
    if (peerConnection) {
      peerConnection._vuvioUnsubscribe?.();
      peerConnection._vuvioCleanup?.();
      peerConnection.close();
      peerConnection = null;
    }

    // Mark ended in Firestore so viewers see the broadcast stopped immediately
    await updateDoc(doc(db, 'activeLives', liveId), {
      status: 'ended',
      endedAt: new Date().toISOString(),
    });

    console.log('[CLOUDFLARE] live marked ended');
    console.log('[CLOUDFLARE] cleanup complete');
  } catch (err) {
    console.error('[CLOUDFLARE] Failed to stop broadcast:', err.message);
    throw err;
  }
}

export async function stopRtmpRelayBroadcast(liveId) {
  try {
    console.log('[RTMPS-RELAY] stopping broadcast');
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    await stopRtmpRelayConnection();
    await updateDoc(doc(db, 'activeLives', liveId), {
      status: 'ended',
      endedAt: new Date().toISOString(),
    });
    console.log('[RTMPS-RELAY] live marked ended');
  } catch (err) {
    console.error('[RTMPS-RELAY] Failed to stop relay broadcast:', err.message);
    throw err;
  }
}

// Synchronous cleanup for beforeunload / tab close (no async ops allowed)
export function stopBroadcastSync() {
  console.log('[CLOUDFLARE] broadcast ending (sync — tab closing or network loss)');
  try {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    // Closing PeerConnection signals Cloudflare — live_input.ended webhook will fire
    // That webhook + server-side stale live cleanup handles the rest
    closeWhipConnectionSync();
    if (peerConnection) {
      peerConnection._vuvioUnsubscribe?.();
      peerConnection.close();
      peerConnection = null;
    }
    console.log('[CLOUDFLARE] sync cleanup done — server stale-live detector will mark ended');
  } catch (err) {
    console.warn('[CLOUDFLARE] Sync cleanup error:', err.message);
  }
}

export function stopRtmpRelayBroadcastSync() {
  try {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    if (relayPeerConnection) {
      relayPeerConnection.close();
      relayPeerConnection = null;
    }
    if (relayBaseUrl && relaySessionId) {
      fetch(`${relayBaseUrl}/sessions/${relaySessionId}`, { method: 'DELETE' }).catch(() => {});
      relaySessionId = null;
      relayBaseUrl = null;
    }
  } catch (err) {
    console.warn('[RTMPS-RELAY] Sync cleanup error:', err.message);
  }
}

// ─── WHEP Viewer (Cloudflare → viewer) ─────────────────────────────────────

function createViewerSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

function resolveWhepResourceUrl(whepUrl, locationHeader) {
  if (!locationHeader) return null;
  try {
    return new URL(locationHeader, whepUrl).href;
  } catch {
    return locationHeader;
  }
}

export async function startWhepPlayback(whepUrl, onStreamReceived, viewerSessionId = createViewerSessionId()) {
  const sessionTag = `[WHEP viewer ${viewerSessionId}]`;
  console.log(`${sessionTag} creating`, whepUrl);

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
    bundlePolicy: 'max-bundle',
  });

  pc.ontrack = (event) => {
    console.log(`${sessionTag} connected — track:`, event.track.kind);
    if (event.streams?.[0]) {
      onStreamReceived(event.streams[0]);
    }
  };

  // WHEP: receive only — never send media
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Wait for ICE gathering before sending offer
  await new Promise(resolve => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    const prev = pc.onicegatheringstatechange;
    pc.onicegatheringstatechange = (e) => {
      prev?.(e);
      if (pc.iceGatheringState === 'complete') resolve();
    };
    setTimeout(resolve, 5000);
  });

  if (!pc.localDescription) throw new Error('WHEP: no local description after ICE gathering');

  const response = await fetch(whepUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: pc.localDescription.sdp,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WHEP ${response.status}: ${text.slice(0, 200)}`);
  }

  const resourceUrl = resolveWhepResourceUrl(whepUrl, response.headers.get('Location'));
  console.log(`${sessionTag} resource URL:`, resourceUrl);
  const answerSdp = await response.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
  console.log(`${sessionTag} SDP exchange complete — waiting for tracks`);

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    console.log(`${sessionTag} connection state:`, state);
    if (state === 'failed' || state === 'disconnected') {
      console.warn(`${sessionTag} connection lost`);
      onStreamReceived(null, state);
    }
  };

  const stop = () => {
    console.log(`${sessionTag} stopping`);
    pc.onconnectionstatechange = null;
    if (pc.connectionState !== 'closed') {
      pc.close();
    }
    if (resourceUrl) {
      fetch(resourceUrl, { method: 'DELETE' }).catch(() => {});
    }
  };

  return { viewerSessionId, resourceUrl, peerConnection: pc, stop };
}

export function stopWhepPlayback(resourceUrl = null, peerConnection = null) {
  const connection = peerConnection ?? null;
  if (connection) {
    connection.onconnectionstatechange = null;
    connection.close();
  }
  if (resourceUrl) {
    fetch(resourceUrl, { method: 'DELETE' }).catch(() => {});
  }
}

// ─── P2P Viewer fallback ────────────────────────────────────────────────────

async function waitForBroadcasterOffer(liveId, maxRetries = 12) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const liveDoc = await getDoc(doc(db, 'activeLives', liveId));
      if (liveDoc.exists() && liveDoc.data().sdpOffer) {
        return liveDoc.data();
      }
    } catch (err) {
      lastError = err;
    }
    if (attempt < maxRetries - 1) {
      const delayMs = Math.min(500 * Math.pow(2, attempt), 5000);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError || new Error('Broadcaster offer not found after retries');
}

export async function watchBroadcast(liveId, onStreamReceived, watcherId = `viewer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, watcherUid = null) {
  try {
    console.log('[webrtcService] Watching broadcast for live (P2P fallback):', liveId);

    const offerData = await waitForBroadcasterOffer(liveId);
    const { sdpOffer, iceCandidates, signalSessionId } = offerData;
    const watcherRef = doc(db, 'activeLives', liveId, 'watchers', watcherId);

    peerConnection = new RTCPeerConnection(await getRtcConfig());

    peerConnection.ontrack = (event) => {
      console.log('[webrtcService] Received remote track (P2P):', event.track.kind);
      onStreamReceived(null, `track:${event.track.kind}`);
      if (event.streams && event.streams.length > 0) {
        onStreamReceived(event.streams[0]);
      }
    };

    const watcherCandidates = [];
    let watcherDocReady = false;
    const publishWatcherCandidates = () => {
      if (!watcherDocReady) return;
      setDoc(watcherRef, {
        signalSessionId,
        watcherUid,
        watcherIceCandidates: watcherCandidates,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch((err) => {
        console.warn('[webrtcService] Failed to publish watcher ICE:', err.message);
      });
    };
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        watcherCandidates.push(event.candidate.toJSON());
        publishWatcherCandidates();
      }
    };

    await peerConnection.setRemoteDescription({ type: 'offer', sdp: sdpOffer });

    const addedBroadcasterCandidates = new Set();
    if (iceCandidates && iceCandidates.length > 0) {
      for (const candidate of iceCandidates) {
        const key = candidate.candidate ?? JSON.stringify(candidate);
        if (addedBroadcasterCandidates.has(key)) continue;
        addedBroadcasterCandidates.add(key);
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[webrtcService] Failed to add ICE candidate:', err.message);
        }
      }
    }

    const unsubscribeBroadcaster = onSnapshot(doc(db, 'activeLives', liveId), async (docSnap) => {
      if (!docSnap.exists() || !peerConnection?.remoteDescription) return;
      const data = docSnap.data();
      if (data.signalSessionId !== signalSessionId || !data.iceCandidates?.length) return;
      for (const candidate of data.iceCandidates) {
        const key = candidate.candidate ?? JSON.stringify(candidate);
        if (addedBroadcasterCandidates.has(key)) continue;
        addedBroadcasterCandidates.add(key);
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[webrtcService] Failed to add updated broadcaster ICE candidate:', err.message);
        }
      }
    }, (err) => {
      console.error('[webrtcService] Broadcaster ICE listener failed:', err.message);
    });

    if (peerConnection.signalingState === 'have-remote-offer') {
      try {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
      } catch (err) {
        console.log('[webrtcService] Could not set local answer (already set):', err.message);
      }
    } else {
      console.log('[webrtcService] Skipping answer: signaling state is', peerConnection.signalingState);
    }

    await new Promise(resolve => {
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          watcherCandidates.push(event.candidate.toJSON());
        } else {
          resolve();
        }
      };
      setTimeout(resolve, 5000);
    });

    if (peerConnection.localDescription) {
      await setDoc(watcherRef, {
        signalSessionId,
        watcherUid,
        sdpAnswer: peerConnection.localDescription.sdp,
        watcherIceCandidates: watcherCandidates,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      watcherDocReady = true;
      publishWatcherCandidates();
      console.log('[webrtcService] P2P answer sent to broadcaster:', watcherId);
    } else {
      console.log('[webrtcService] No local description to send (already established)');
    }

    peerConnection.onconnectionstatechange = () => {
      console.log('[webrtcService] P2P connection state:', peerConnection.connectionState);
      onStreamReceived(null, peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        onStreamReceived(null);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      onStreamReceived(null, `ice:${peerConnection.iceConnectionState}`);
    };

    peerConnection._vuvioCleanup = () => {
      unsubscribeBroadcaster();
      deleteDoc(watcherRef).catch((err) => {
        if (err.code !== 'permission-denied') {
          console.warn('[webrtcService] Failed to clean watcher doc:', err.message);
        }
      });
    };
    return peerConnection;
  } catch (err) {
    console.error('[webrtcService] Failed to watch broadcast (P2P):', err.message);
    if (err.message.includes('Broadcaster offer not found')) {
      onStreamReceived(null);
    }
    throw err;
  }
}

export function getLocalStream() {
  return localStream;
}

export function getRemoteStream() {
  return null;
}

export function closePeer() {
  if (peerConnection) {
    peerConnection._vuvioUnsubscribe?.();
    peerConnection._vuvioCleanup?.();
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
}
