import { doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
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
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });

    // Create peer connection
    peerConnection = new RTCPeerConnection(ICE_SERVERS);

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
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering to complete
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
        } else {
          iceGatheringComplete = true;
          resolve();
        }
      };
      setTimeout(checkComplete, 5000); // Timeout after 5s
    });

    // Save offer to Firestore
    await setDoc(doc(db, 'activeLives', liveId), {
      sdpOffer: peerConnection.localDescription.sdp,
      iceCandidates: candidates,
    }, { merge: true });

    console.log('[webrtcService] Offer created and saved');

    // Listen for answer from watcher
    const unsubscribe = onSnapshot(doc(db, 'activeLives', liveId), (doc) => {
      const data = doc.data();
      if (data?.sdpAnswer && !peerConnection.remoteDescription) {
        console.log('[webrtcService] Received answer from watcher');
        const answer = new RTCSessionDescription({
          type: 'answer',
          sdp: data.sdpAnswer
        });
        peerConnection.setRemoteDescription(answer).catch(err => {
          console.error('[webrtcService] Failed to set remote description:', err.message);
        });

        // Add remote ICE candidates
        if (data.watcherIceCandidates) {
          data.watcherIceCandidates.forEach(candidate => {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
              console.warn('[webrtcService] Failed to add ICE candidate:', err.message);
            });
          });
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
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }

    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    // Clear Firestore data
    await setDoc(doc(db, 'activeLives', liveId), {
      sdpOffer: null,
      iceCandidates: null,
      sdpAnswer: null,
      watcherIceCandidates: null,
    }, { merge: true });

    console.log('[webrtcService] Broadcast stopped');
  } catch (err) {
    console.error('[webrtcService] Failed to stop broadcast:', err.message);
  }
}

export async function watchBroadcast(liveId, onStreamReceived) {
  try {
    console.log('[webrtcService] Watching broadcast for live:', liveId);

    // Get the offer from broadcaster
    const liveDoc = await getDoc(doc(db, 'activeLives', liveId));
    if (!liveDoc.exists() || !liveDoc.data().sdpOffer) {
      throw new Error('Broadcaster offer not found');
    }

    const { sdpOffer, iceCandidates } = liveDoc.data();

    // Create peer connection
    peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('[webrtcService] Received remote track');
      onStreamReceived(event.streams[0]);
    };

    // Collect ICE candidates
    const watcherCandidates = [];
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        watcherCandidates.push(event.candidate.toJSON());
      }
    };

    // Set remote description with offer
    const offer = new RTCSessionDescription({
      type: 'offer',
      sdp: sdpOffer
    });
    await peerConnection.setRemoteDescription(offer);

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

    // Create and send answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

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

    // Save answer and candidates to Firestore
    await updateDoc(doc(db, 'activeLives', liveId), {
      sdpAnswer: peerConnection.localDescription.sdp,
      watcherIceCandidates: watcherCandidates,
    });

    console.log('[webrtcService] Answer sent to broadcaster');

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
    onStreamReceived(null);
    throw err;
  }
}

export function getLocalStream() {
  return localStream;
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
