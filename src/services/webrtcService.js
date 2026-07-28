import Peer from 'peerjs';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';

let peer = null;
let localStream = null;
let remoteStream = null;

export async function initPeer(userId) {
  if (peer) return peer;

  peer = new Peer(userId, {
    host: 'peerjs-server.herokuapp.com',
    secure: true,
  });

  peer.on('error', (err) => {
    console.error('[webrtcService] Peer error:', err);
  });

  return peer;
}

export async function startBroadcast(liveId, userId) {
  try {
    console.log('[webrtcService] Starting broadcast for live:', liveId);

    if (!peer) {
      await initPeer(userId);
    }

    // Get camera stream
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });

    // Save peer ID to Firestore so watchers can connect
    await setDoc(doc(db, 'activeLives', liveId), {
      peerId: peer.id,
      broadcasterUid: userId,
    }, { merge: true });

    console.log('[webrtcService] Broadcasting with peer ID:', peer.id);
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

    // Remove peer ID from Firestore
    await setDoc(doc(db, 'activeLives', liveId), {
      peerId: null,
      broadcasterUid: null,
    }, { merge: true });

    console.log('[webrtcService] Broadcast stopped');
  } catch (err) {
    console.error('[webrtcService] Failed to stop broadcast:', err.message);
  }
}

export async function watchBroadcast(liveId, onStreamReceived) {
  try {
    console.log('[webrtcService] Watching broadcast for live:', liveId);

    const liveDoc = await getDoc(doc(db, 'activeLives', liveId));
    if (!liveDoc.exists()) {
      throw new Error('Live document not found');
    }

    const { peerId } = liveDoc.data();
    if (!peerId) {
      throw new Error('Broadcaster peer ID not found');
    }

    if (!peer) {
      const userId = 'watcher_' + Math.random().toString(36).substr(2, 9);
      await initPeer(userId);
    }

    // Call the broadcaster
    const call = peer.call(peerId, new MediaStream());

    call.on('stream', (stream) => {
      console.log('[webrtcService] Received remote stream');
      remoteStream = stream;
      onStreamReceived(stream);
    });

    call.on('error', (err) => {
      console.error('[webrtcService] Call error:', err);
      onStreamReceived(null);
    });

    call.on('close', () => {
      console.log('[webrtcService] Call closed');
      remoteStream = null;
      onStreamReceived(null);
    });

    // Listen for peer ID changes (broadcast ended)
    const unsubscribe = onSnapshot(doc(db, 'activeLives', liveId), (doc) => {
      if (doc.exists() && !doc.data().peerId) {
        console.log('[webrtcService] Broadcast ended');
        call.close();
        unsubscribe();
      }
    });

    return call;
  } catch (err) {
    console.error('[webrtcService] Failed to watch broadcast:', err.message);
    onStreamReceived(null);
    throw err;
  }
}

export function getLocalStream() {
  return localStream;
}

export function getRemoteStream() {
  return remoteStream;
}

export function closePeer() {
  if (peer) {
    peer.destroy();
    peer = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
    remoteStream = null;
  }
}
