import { collection, doc, setDoc, getDoc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';


let localStream = null;
let peerConnection = null;
let whipPeerConnection = null;
let relayPeerConnection = null;
let relaySessionId = null;
let relayBaseUrl = null;
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

let relayCanvasCleanup = null;

async function createFixedResolutionStream(sourceStream, width = 1280, height = 720, fps = 15) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const videoEl = document.createElement('video');
  videoEl.srcObject = sourceStream;
  videoEl.muted = true;
  videoEl.playsInline = true;
  await videoEl.play();
  // Wait for video to have actual frames before starting canvas capture
  if (videoEl.readyState < 2) {
    await new Promise((resolve) => {
      videoEl.addEventListener('canplay', resolve, { once: true });
      setTimeout(resolve, 2000); // fallback
    });
  }

  // Use setInterval instead of requestAnimationFrame so drawing continues when tab is in background.
  let animFrameId;
  function draw() {
    if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
      const videoAR = vw / vh, canvasAR = width / height;
      let sx = 0, sy = 0, sw = vw, sh = vh;
      if (videoAR > canvasAR) { sw = vh * canvasAR; sx = (vw - sw) / 2; }
      else { sh = vw / canvasAR; sy = (vh - sh) / 2; }
      ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, width, height);
    }
  }
  animFrameId = setInterval(draw, 1000 / fps);

  const canvasStream = canvas.captureStream(fps);
  const videoTrack = canvasStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.contentHint = 'motion'; // prefer framerate over resolution in VP8 encoder
    try {
      await videoTrack.applyConstraints({ width: { ideal: width }, height: { ideal: height }, frameRate: { max: fps } });
      console.log('[relay] canvas track constraints applied — %dx%d', width, height);
    } catch (e) {
      console.warn('[relay] applyConstraints failed (non-fatal):', e?.message);
    }
  }
  const audioTrack = sourceStream.getAudioTracks()[0];
  if (audioTrack) canvasStream.addTrack(audioTrack);

  relayCanvasCleanup = () => {
    clearInterval(animFrameId);
    videoEl.pause();
    videoEl.srcObject = null;
    relayCanvasCleanup = null;
  };

  console.log('[relay] canvas stream created — fixed %dx%d @ %dfps | audioTrack=%s', width, height, fps, audioTrack ? 'real-mic' : 'NONE');
  return canvasStream;
}

async function startRtmpRelayIngest(relayUrl, liveInputId, ingestUrl, streamKey, stream) {
  if (!relayUrl) throw new Error('Missing RTMPS relay URL');
  if (!ingestUrl || !streamKey) throw new Error('Missing Cloudflare RTMPS credentials');

  relayBaseUrl = relayUrl.replace(/\/$/, '');
  console.log('[relay-browser] startRtmpRelayIngest called relayUrl=%s vuvioLiveId=%s hasIngestUrl=%s hasStreamKey=%s', relayUrl, liveInputId, !!ingestUrl, !!streamKey);

  const fixedStream = await createFixedResolutionStream(stream, 854, 480, 15);

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
    bundlePolicy: 'max-bundle',
  });
  relayPeerConnection = pc;

  const tracks = fixedStream.getTracks();
  console.log('[relay] adding tracks — count:', tracks.length, 'kinds:', tracks.map((t) => `${t.kind}(enabled=${t.enabled},readyState=${t.readyState})`).join(','));

  // Use addTransceiver with sendEncodings to prevent Chrome VP8 ramp-up (starts at full bitrate immediately)
  const videoTrack = fixedStream.getVideoTracks()[0];
  const audioTrack = fixedStream.getAudioTracks()[0];
  let videoTransceiverRef = null;
  if (videoTrack) {
    videoTransceiverRef = pc.addTransceiver(videoTrack, {
      direction: 'sendonly',
      sendEncodings: [{ maxBitrate: 2_000_000, scaleResolutionDownBy: 1 }],
      streams: [fixedStream],
    });
  }
  if (audioTrack) pc.addTransceiver(audioTrack, { direction: 'sendonly', streams: [fixedStream] });

  // Prefer VP8 via setCodecPreferences so wrtc RTCVideoSink can decode frames
  try {
    const videoTransceiver = videoTransceiverRef || pc.getTransceivers().find((t) => t.sender?.track?.kind === 'video');
    if (videoTransceiver && typeof videoTransceiver.setCodecPreferences === 'function' && typeof RTCRtpSender.getCapabilities === 'function') {
      const codecs = RTCRtpSender.getCapabilities('video')?.codecs || [];
      const vp8 = codecs.filter((c) => c.mimeType?.toLowerCase() === 'video/vp8');
      const auxiliary = codecs.filter((c) => { const m = c.mimeType?.toLowerCase() || ''; return m === 'video/rtx' || m.includes('red') || m.includes('fec'); });
      if (vp8.length) {
        videoTransceiver.setCodecPreferences([...vp8, ...auxiliary]);
        console.log('[relay] setCodecPreferences VP8 applied');
      } else {
        console.warn('[relay] VP8 not in capabilities, using default codecs');
      }
    } else {
      console.warn('[relay] setCodecPreferences not available, using default codecs');
    }
  } catch (e) {
    console.warn('[relay] setCodecPreferences failed (non-fatal):', e?.message);
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') resolve(); };
    setTimeout(resolve, 5000);
  });

  // Fix VP8 ramp-up: force high bitrate after ICE so Chrome starts at full resolution immediately
  const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
  if (videoSender) {
    const params = videoSender.getParameters();
    if (params.encodings?.length) {
      params.encodings[0].maxBitrate = 1_500_000;
      params.encodings[0].scaleResolutionDownBy = 1;
      await videoSender.setParameters(params).catch(() => {});
      console.log('[relay] forced maxBitrate=1.5Mbps scaleResolutionDownBy=1 on video sender');
    }
  }

  console.log('[relay-browser] POST offer -> %s/sessions', relayBaseUrl);
  let response;
  try {
    response = await fetch(`${relayBaseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liveInputId, ingestUrl, streamKey, sdpOffer: pc.localDescription.sdp }),
    });
    console.log('[relay-browser] relay response status=%s', response.status);
  } catch (fetchErr) {
    console.error('[relay-browser] relay fetch ERROR name=%s message=%s', fetchErr.name, fetchErr.message);
    throw fetchErr;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[relay] session create failed: ${response.status} ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  relaySessionId = data.sessionId || null;
  await pc.setRemoteDescription({ type: 'answer', sdp: data.sdpAnswer });

  // Lock video resolution once ICE is connected — encodings are only active at that point
  const connectionPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Relay ICE connection timeout')), 15000);
    pc.onconnectionstatechange = () => {
    console.log('[relay] WebRTC state:', pc.connectionState);
    if (pc.connectionState === 'connected') {
      clearTimeout(timeout);
      for (const sender of pc.getSenders()) {
        const track = sender.track;
        if (!track) continue;
        if (track.kind === 'video') {
          // Log negotiated codec
          sender.getStats().then((stats) => {
            stats.forEach((report) => {
              if (report.type === 'outbound-rtp' && report.codecId) {
                const codec = [...stats.values()].find((r) => r.id === report.codecId);
                if (codec) console.log('[relay] negotiatedVideoCodec=%s payloadType=%s', codec.mimeType, codec.payloadType);
              }
            });
          }).catch(() => {});
          try {
            const params = sender.getParameters();
            if (params.encodings?.length > 0) {
              params.encodings[0].scaleResolutionDownBy = 1.0;
              params.encodings[0].maxBitrate = 3_000_000;
              sender.setParameters(params).then(() =>
                console.log('[relay] locked video sender — scaleResolutionDownBy=1 maxBitrate=3Mbps'),
              ).catch((e) => console.warn('[relay] setParameters failed:', e?.message));
            } else {
              console.warn('[relay] no encodings on connected — cannot lock resolution');
            }
          } catch (e) {
            console.warn('[relay] setParameters error:', e?.message);
          }
        }
      }
      resolve();
    } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      clearTimeout(timeout);
      reject(new Error(`Relay WebRTC ${pc.connectionState}`));
    }
  };
  });
  await connectionPromise;
  console.log('[relay] RTMPS relay connected — Cloudflare is recording');
}

async function stopRtmpRelayConnection() {
  try {
    if (relayPeerConnection) {
      relayPeerConnection.onconnectionstatechange = null;
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

export async function startWhipConnection(stream, whipUrl, whipKey) {
  console.log('[INGEST] trying WHIP —', whipUrl);
  whipPeerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });

  stream.getTracks().forEach((track) => whipPeerConnection.addTrack(track, stream));

  const offer = await whipPeerConnection.createOffer();
  await whipPeerConnection.setLocalDescription(offer);

  await new Promise((resolve) => {
    if (whipPeerConnection.iceGatheringState === 'complete') { resolve(); return; }
    whipPeerConnection.onicegatheringstatechange = () => {
      if (whipPeerConnection.iceGatheringState === 'complete') resolve();
    };
    setTimeout(resolve, 5000);
  });

  const response = await fetch(whipUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sdp',
      ...(whipKey ? { Authorization: `Bearer ${whipKey}` } : {}),
    },
    body: whipPeerConnection.localDescription.sdp,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    whipPeerConnection.close();
    whipPeerConnection = null;
    throw new Error(`WHIP POST failed: HTTP ${response.status} — ${text.slice(0, 200)}`);
  }

  const answerSdp = await response.text();
  await whipPeerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
  console.log('[INGEST] WHIP connected — Cloudflare is receiving the stream');
}

export async function startBroadcast(liveId, userId, existingStream = null, whipUrl = null, whipKey = null) {
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

    // WHIP is now called explicitly from setupBroadcast — not here

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

    if (whipPeerConnection) {
      whipPeerConnection.close();
      whipPeerConnection = null;
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

export async function startRtmpRelayBroadcast(liveId, userId, existingStream = null, relayUrl = null, ingestUrl = null, streamKey = null) {
  try {
    console.log('[relay] startRtmpRelayBroadcast liveId:', liveId, 'relayUrl:', relayUrl);
    if (existingStream?.getTracks?.().length) {
      localStream = existingStream;
    } else {
      localStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
    }
    await startRtmpRelayIngest(relayUrl, liveId, ingestUrl, streamKey, localStream);
    return localStream;
  } catch (err) {
    console.error('[relay] Relay broadcast failed (WHIP still active):', err.message);
    throw err;
  }
}

export async function stopRtmpRelayBroadcast(liveId) {
  try {
    console.log('[relay] stopping relay broadcast');
    relayCanvasCleanup?.();
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    await stopRtmpRelayConnection();
    await updateDoc(doc(db, 'activeLives', liveId), { status: 'ended', endedAt: new Date().toISOString() });
    console.log('[relay] live marked ended');
  } catch (err) {
    console.error('[relay] Failed to stop relay broadcast:', err.message);
    throw err;
  }
}

export function stopRtmpRelayBroadcastSync() {
  try {
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    if (relayPeerConnection) { relayPeerConnection.close(); relayPeerConnection = null; }
    if (relayBaseUrl && relaySessionId) {
      fetch(`${relayBaseUrl}/sessions/${relaySessionId}`, { method: 'DELETE' }).catch(() => {});
      relaySessionId = null; relayBaseUrl = null;
    }
    console.log('[relay] No active relay session to stop');
  } catch (err) {
    console.warn('[relay] sync cleanup error:', err.message);
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
  if (whipPeerConnection) {
    whipPeerConnection.close();
    whipPeerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
}
