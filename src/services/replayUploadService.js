import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

async function getUploadUrl(liveId, token) {
  const res = await fetch(`/api/streams/${liveId}/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`upload-url failed: ${res.status}`);
  return res.json();
}

async function setFirestoreStatus(liveId, fields) {
  try {
    await updateDoc(doc(db, 'activeLives', liveId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[replayUpload] Firestore update failed:', err.message);
  }
}

export async function uploadReplay(liveId, token) {
  console.warn('[replayUpload] Disabled: Cloudflare Stream replay is managed server-side.');
  await setFirestoreStatus(liveId, { recordingStatus: 'processing' });
  return {};
}
