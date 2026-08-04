import { collection, doc, setDoc, getDoc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

let localStream = null;
let peerConnection = null;
let iceGatheringComplete = false;
let cachedRtcConfig = null;
let cachedRtcConfigExpiresAt = 0;

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
  const endpoint = import.meta.env.VITE_TURN_CREDENTIALS_URL || '/api/turn-credentials';
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

export async function startBroadcast(liveId, userId, existingStream = null) {
  try {
    console.log('[webrtcService] Starting broadcast for live:', liveId);
    const signalSessionId = `signal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (existingStream?.getTracks?.().length) {
      localStream = existingStream;
      console.log('[webrtcService] Using existing camera stream');
    } else {
      // Get camera stream
      console.log('[webrtcService] Requesting camera stream...');
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      console.log('[webrtcService] Camera stream acquired');
    }

    // Create peer connection
    console.log('[webrtcService] Creating peer connection...');
    peerConnection = new RTCPeerConnection(await getRtcConfig());
    console.log('[webrtcService] Peer connection created');

    // Add local stream tracks to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Collect ICE candidates. Keep publishing after the initial offer because
    // mobile browsers often discover useful candidates after the first batch.
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
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        candidates.push(event.candidate.toJSON());
        publishBroadcasterCandidates();
      }
    };

    // Create and save SDP offer
    console.log('[webrtcService] Creating offer...');
    const offer = await peerConnection.createOffer();
    console.log('[webrtcService] Offer created, setting local description...');
    await peerConnection.setLocalDescription(offer);
    console.log('[webrtcService] Local description set, waiting for ICE gathering...');

    // Wait for ICE gathering to complete
    await new Promise(resolve => {
      const checkComplete = () => {
        if (peerConnection.iceGatheringState === 'complete') {
          iceGatheringComplete = true;
          console.log('[webrtcService] ICE gathering complete (via state check)');
          resolve();
        }
      };
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          candidates.push(event.candidate.toJSON());
          publishBroadcasterCandidates();
        } else {
          iceGatheringComplete = true;
          console.log('[webrtcService] ICE gathering complete (via candidate event)');
          publishBroadcasterCandidates();
          resolve();
        }
      };
      setTimeout(() => {
        console.log('[webrtcService] ICE gathering timeout (5s)');
        resolve();
      }, 5000);
    });

    // Save offer to Firestore
    console.log('[webrtcService] Saving offer to Firestore with', candidates.length, 'candidates');
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
    console.log('[webrtcService] Offer created and saved');

    // Listen for answer from a watcher. Each watcher writes its own answer in a
    // subdocument so stale/parallel viewers cannot overwrite a single global answer.
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
        console.log('[webrtcService] Received answer from watcher:', answerDoc.id);
        try {
          const answer = new RTCSessionDescription({
            type: 'answer',
            sdp: data.sdpAnswer
          });
          await peerConnection.setRemoteDescription(answer);
          answerProcessed = true;
          console.log('[webrtcService] Remote description set successfully');
        } catch (err) {
          console.error('[webrtcService] Failed to set remote description:', err.message);
          answerProcessed = false;
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

export async function stopBroadcast(liveId) {
  try {
    console.log('[webrtcService] Stopping broadcast:', liveId);

    // Stop all local stream tracks immediately
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log('[webrtcService] Stopping track:', track.kind);
        track.stop();
      });
      localStream = null;
    }

    // Close peer connection immediately
    if (peerConnection) {
      peerConnection._vuvioUnsubscribe?.();
      peerConnection._vuvioCleanup?.();
      peerConnection.close();
      peerConnection = null;
    }

    // Mark the live as ended in Firestore (don't delete, so watchers know it ended)
    await updateDoc(doc(db, 'activeLives', liveId), {
      status: 'ended',
      endedAt: new Date().toISOString(),
    });

    console.log('[webrtcService] Broadcast marked as ended');
  } catch (err) {
    console.error('[webrtcService] Failed to stop broadcast:', err.message);
    throw err;
  }
}

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
    console.log('[webrtcService] Watching broadcast for live:', liveId);

    // Wait for broadcaster offer with retry logic
    const offerData = await waitForBroadcasterOffer(liveId);
    console.log('[webrtcService] Broadcaster offer received');

    const { sdpOffer, iceCandidates, signalSessionId } = offerData;
    const watcherRef = doc(db, 'activeLives', liveId, 'watchers', watcherId);

    // Create peer connection
    peerConnection = new RTCPeerConnection(await getRtcConfig());

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('[webrtcService] Received remote track:', event.track.kind);
      console.log('[webrtcService] Streams available:', event.streams.length, event.streams[0]?.getTracks?.().length ?? 0, 'tracks');
      onStreamReceived(null, `track:${event.track.kind}`);
      if (event.streams && event.streams.length > 0) {
        onStreamReceived(event.streams[0]);
      }
    };

    // Collect ICE candidates continuously and publish updates as they arrive.
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

    // Set remote description with offer
    await peerConnection.setRemoteDescription({
      type: 'offer',
      sdp: sdpOffer
    });

    // Add broadcaster ICE candidates
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

    // Create and send answer (only if not already set due to React Strict Mode)
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

    // Wait for ICE gathering
    await new Promise(resolve => {
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          watcherCandidates.push(event.candidate.toJSON());
        } else {
          resolve();
        }
      };
      setTimeout(resolve, 5000); // Timeout after 5s
    });

    // Save answer and candidates to Firestore (only if we have a local description)
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
      console.log('[webrtcService] Answer sent to broadcaster:', watcherId);
    } else {
      console.log('[webrtcService] No local description to send (already established)');
    }

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('[webrtcService] Connection state:', peerConnection.connectionState);
      onStreamReceived(null, peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        onStreamReceived(null);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('[webrtcService] ICE connection state:', peerConnection.iceConnectionState);
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
    console.error('[webrtcService] Failed to watch broadcast:', err.message);
    // Only call onStreamReceived(null) if this is a critical error before receiving tracks
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
  return null; // Remote stream is handled via ontrack callback
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
