import { doc, setDoc, getDoc, onSnapshot, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase.js';

let localStream = null;
let peerConnection = null;
let iceGatheringComplete = false;

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

export async function startBroadcast(liveId, userId) {
  try {
    console.log('[webrtcService] Starting broadcast for live:', liveId);

    // Get camera stream
    console.log('[webrtcService] Requesting camera stream...');
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });
    console.log('[webrtcService] Camera stream acquired');

    // Create peer connection
    console.log('[webrtcService] Creating peer connection...');
    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    console.log('[webrtcService] Peer connection created');

    // Add local stream tracks to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Collect ICE candidates
    const candidates = [];
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        candidates.push(event.candidate.toJSON());
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
        } else {
          iceGatheringComplete = true;
          console.log('[webrtcService] ICE gathering complete (via candidate event)');
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
    await setDoc(doc(db, 'activeLives', liveId), {
      sdpOffer: peerConnection.localDescription.sdp,
      iceCandidates: candidates,
    }, { merge: true });
    console.log('[webrtcService] Offer created and saved');

    // Listen for answer from watcher
    let answerProcessed = false;
    const unsubscribe = onSnapshot(doc(db, 'activeLives', liveId), async (doc) => {
      const data = doc.data();
      if (data?.sdpAnswer && !answerProcessed && peerConnection.signalingState === 'have-local-offer') {
        answerProcessed = true;
        console.log('[webrtcService] Received answer from watcher');
        try {
          const answer = new RTCSessionDescription({
            type: 'answer',
            sdp: data.sdpAnswer
          });
          await peerConnection.setRemoteDescription(answer);
          console.log('[webrtcService] Remote description set successfully');

          // Add remote ICE candidates
          if (data.watcherIceCandidates && data.watcherIceCandidates.length > 0) {
            for (const candidate of data.watcherIceCandidates) {
              try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.warn('[webrtcService] Failed to add ICE candidate:', err.message);
              }
            }
          }
        } catch (err) {
          console.error('[webrtcService] Failed to set remote description:', err.message);
          answerProcessed = false;
        }
      }
    });

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

export async function watchBroadcast(liveId, onStreamReceived) {
  try {
    console.log('[webrtcService] Watching broadcast for live:', liveId);

    // Wait for broadcaster offer with retry logic
    const offerData = await waitForBroadcasterOffer(liveId);
    console.log('[webrtcService] Broadcaster offer received');

    const { sdpOffer, iceCandidates } = offerData;

    // Create peer connection
    peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('[webrtcService] Received remote track:', event.track.kind);
      console.log('[webrtcService] Streams available:', event.streams.length, event.streams[0]?.getTracks?.().length ?? 0, 'tracks');
      if (event.streams && event.streams.length > 0) {
        onStreamReceived(event.streams[0]);
      }
    };

    // Collect ICE candidates
    const watcherCandidates = [];
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        watcherCandidates.push(event.candidate.toJSON());
      }
    };

    // Set remote description with offer
    await peerConnection.setRemoteDescription({
      type: 'offer',
      sdp: sdpOffer
    });

    // Add broadcaster ICE candidates
    if (iceCandidates && iceCandidates.length > 0) {
      for (const candidate of iceCandidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[webrtcService] Failed to add ICE candidate:', err.message);
        }
      }
    }

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
      await updateDoc(doc(db, 'activeLives', liveId), {
        sdpAnswer: peerConnection.localDescription.sdp,
        watcherIceCandidates: watcherCandidates,
      });
      console.log('[webrtcService] Answer sent to broadcaster');
    } else {
      console.log('[webrtcService] No local description to send (already established)');
    }

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('[webrtcService] Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        onStreamReceived(null);
      }
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
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
}
